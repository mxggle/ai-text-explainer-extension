// Content script for text selection and explanation display
class TextExplainer {
    constructor() {
        this.isEnabled = true;
        this.currentDialog = null;
        this.selectedText = '';
        this.selectedContext = '';
        this.settings = {};
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.setupMessageListener();
    }

    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'get-settings' });
            if (response.success) {
                this.settings = response.settings;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    setupEventListeners() {
        // Handle text selection
        document.addEventListener('mouseup', (e) => this.handleTextSelection(e));
        document.addEventListener('keyup', (e) => this.handleKeyboardSelection(e));

        // Handle clicks outside dialog to close it
        document.addEventListener('click', (e) => this.handleOutsideClick(e));

        // Handle escape key to close dialog
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentDialog) {
                this.closeDialog();
            }
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'explain-selection') {
                this.explainText(request.text);
            }
        });
    }

    handleTextSelection(e) {
        // Small delay to ensure selection is complete
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (selectedText.length > 0 && selectedText.length <= 500) {
                this.selectedText = selectedText;
                this.selectedContext = this.extractContext(selection);
                this.showFloatingButton(e.clientX, e.clientY);
            } else {
                this.hideFloatingButton();
            }
        }, 10);
    }

    handleKeyboardSelection(e) {
        // Handle keyboard selection (Ctrl+A, Shift+Arrow keys, etc.)
        if (e.ctrlKey || e.shiftKey) {
            this.handleTextSelection(e);
        }
    }

    extractContext(selection) {
        try {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;

            // Find the closest paragraph or meaningful container
            let contextElement = container.nodeType === Node.TEXT_NODE ?
                container.parentElement :
                container;

            // Walk up to find a good context container
            while (contextElement && !this.isGoodContextContainer(contextElement)) {
                contextElement = contextElement.parentElement;
            }

            if (contextElement) {
                const contextText = contextElement.textContent || contextElement.innerText;
                // Return up to 1000 characters of context
                return contextText.length > 1000 ?
                    contextText.substring(0, 1000) + '...' :
                    contextText;
            }

            return this.selectedText; // Fallback to selected text
        } catch (error) {
            console.error('Error extracting context:', error);
            return this.selectedText;
        }
    }

    isGoodContextContainer(element) {
        const goodTags = ['P', 'DIV', 'ARTICLE', 'SECTION', 'BLOCKQUOTE', 'LI', 'TD', 'TH'];
        return goodTags.includes(element.tagName) ||
            element.classList.contains('content') ||
            element.classList.contains('text') ||
            element.classList.contains('paragraph');
    }

    showFloatingButton(x, y) {
        this.hideFloatingButton(); // Remove existing button

        const button = document.createElement('div');
        button.id = 'ai-explainer-button';
        button.innerHTML = '🤖 Explain';
        button.className = 'ai-explainer-floating-button';

        // Position the button near the selection
        button.style.left = (x + 10) + 'px';
        button.style.top = (y - 40) + 'px';

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.explainText(this.selectedText);
            this.hideFloatingButton();
        });

        document.body.appendChild(button);

        // Auto-hide after 5 seconds
        setTimeout(() => this.hideFloatingButton(), 5000);
    }

    hideFloatingButton() {
        const button = document.getElementById('ai-explainer-button');
        if (button) {
            button.remove();
        }
    }

    async explainText(text) {
        if (!text) text = this.selectedText;
        if (!text) return;

        this.closeDialog(); // Close any existing dialog
        this.showLoadingDialog(text);

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'explain-text',
                text: text,
                context: this.selectedContext,
                settings: this.settings
            });

            if (response.success) {
                this.showExplanationDialog(text, response.explanation);
            } else {
                this.showErrorDialog(response.error);
            }
        } catch (error) {
            console.error('Explanation error:', error);
            this.showErrorDialog('Failed to get explanation. Please check your settings and try again.');
        }
    }

    showLoadingDialog(text) {
        const dialog = this.createDialog();
        const displayText = text.length > 150 ? text.substring(0, 150) + '...' : text;

        // Extract just the word or phrase for dictionary-style display
        const wordToDefine = text.trim().replace(/['"]/g, '');

        dialog.innerHTML = `
            <div class="ai-explainer-dialog-header">
                <div class="header-content">
                    <div class="ai-icon">📖</div>
                    <h3>Dictionary</h3>
                </div>
                <button class="ai-explainer-close-btn">×</button>
            </div>
            <div class="ai-explainer-dialog-content">
                <div class="dictionary-entry">
                    <div class="word-container">
                        <div class="dictionary-word">${this.escapeHtml(wordToDefine)}</div>
                        <div class="pronunciation-container">
                            <button class="pronunciation-btn" disabled title="Loading...">
                                <span class="sound-icon">🔊</span>
                            </button>
                        </div>
                    </div>
                    <div class="definition-section">
                        <div class="loading-content">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Looking up definition...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add close button functionality
        const closeBtn = dialog.querySelector('.ai-explainer-close-btn');
        closeBtn.addEventListener('click', () => this.closeDialog());

        this.currentDialog = dialog;
        document.body.appendChild(dialog);
    }

    showExplanationDialog(text, explanation) {
            if (this.currentDialog) {
                this.currentDialog.remove();
            }

            const dialog = this.createDialog();
            const contextText = this.selectedContext && this.selectedContext !== text ? this.selectedContext : '';

            // Parse the explanation to check if it's a sentence or word/phrase
            const isSentence = this.isSentence(text);
            const parsedExplanation = this.parseExplanation(explanation, isSentence);

            // Extract just the word or phrase for dictionary-style display
            // For very long text, show only the first few words with ellipsis
            let displayText = text.trim().replace(/['"]/g, '');
            if (displayText.length > 100) {
                const words = displayText.split(' ');
                if (words.length > 8) {
                    displayText = words.slice(0, 8).join(' ') + '...';
                } else {
                    displayText = displayText.substring(0, 100) + '...';
                }
            }

            const headerTitle = isSentence ? 'Translation & Explanation' : 'Dictionary';
            const headerIcon = isSentence ? '🌐' : '📖';
            const copyButtonText = isSentence ? 'Copy Translation' : 'Copy Definition';

            dialog.innerHTML = `
            <div class="ai-explainer-dialog-header">
                <div class="header-content">
                    <div class="ai-icon">${headerIcon}</div>
                    <h3>${headerTitle}</h3>
                </div>
                <button class="ai-explainer-close-btn">×</button>
            </div>
            <div class="ai-explainer-dialog-content">
                <div class="dictionary-entry">
                    <div class="word-container">
                        <div class="dictionary-word">${this.escapeHtml(displayText)}</div>
                        <div class="pronunciation-container">
                            <button class="pronunciation-btn" id="speak-btn" title="Pronounce text">
                                <span class="sound-icon">🔊</span>
                            </button>
                        </div>
                    </div>
                    <div class="definition-section">
                        <div class="definition-content">
                            ${parsedExplanation.content}
                        </div>
                    </div>
                </div>
                ${contextText ? `
                    <div class="context-section">
                        <div class="context-header" id="context-header">
                            <div class="context-header-title">📄 Context</div>
                            <div class="context-toggle" id="context-toggle">▼</div>
                        </div>
                        <div class="context-content" id="context-content">
                            <div class="context-full-text">${this.escapeHtml(contextText)}</div>
                        </div>
                    </div>
                ` : ''}
                <div class="dialog-actions">
                    <button class="action-btn copy-btn" id="copy-btn">
                        <span class="btn-icon">📋</span>
                        ${copyButtonText}
                    </button>
                    <button class="action-btn settings-btn" id="settings-btn">
                        <span class="btn-icon">⚙️</span>
                        Settings
                    </button>
                </div>
            </div>
        `;

        // Add close button functionality
        const closeBtn = dialog.querySelector('.ai-explainer-close-btn');
        closeBtn.addEventListener('click', () => this.closeDialog());

        // Add pronunciation button functionality
        const speakBtn = dialog.querySelector('#speak-btn');
        speakBtn.addEventListener('click', () => {
            this.speakText(displayText);
        });

        // Add context toggle functionality
        if (contextText) {
            const contextHeader = dialog.querySelector('#context-header');
            const contextContent = dialog.querySelector('#context-content');
            const contextToggle = dialog.querySelector('#context-toggle');

            contextHeader.addEventListener('click', () => {
                const isExpanded = contextContent.classList.contains('show');
                if (isExpanded) {
                    contextContent.classList.remove('show');
                    contextToggle.classList.remove('expanded');
                } else {
                    contextContent.classList.add('show');
                    contextToggle.classList.add('expanded');
                }
            });
        }

        // Add copy button functionality
        const copyBtn = dialog.querySelector('#copy-btn');

        // Add settings button functionality
        const settingsBtn = dialog.querySelector('#settings-btn');
        settingsBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({
                action: 'open-settings'
            });
            this.closeDialog();
        });
        
        copyBtn.addEventListener('click', () => {
            const copyText = `${displayText}\n\n${parsedExplanation.rawText}`;
            navigator.clipboard.writeText(copyText).then(() => {
                const icon = copyBtn.querySelector('.btn-icon');
                const originalText = copyBtn.childNodes[2].textContent.trim();
                icon.textContent = '✓';
                copyBtn.childNodes[2].textContent = ' Copied';
                copyBtn.classList.add('success');

                setTimeout(() => {
                    icon.textContent = '📋';
                    copyBtn.childNodes[2].textContent = ` ${copyButtonText}`;
                    copyBtn.classList.remove('success');
                }, 2000);
            });
        });

        this.currentDialog = dialog;
        document.body.appendChild(dialog);
    }

    showErrorDialog(error) {
        if (this.currentDialog) {
            this.currentDialog.remove();
        }

        const dialog = this.createDialog();
        dialog.innerHTML = `
            <div class="ai-explainer-dialog-header">
                <div class="header-content">
                    <div class="ai-icon">⚠️</div>
                    <h3>Error</h3>
                </div>
                <button class="ai-explainer-close-btn">×</button>
            </div>
            <div class="ai-explainer-dialog-content">
                <div class="error-content">
                    <div class="error-message">${error}</div>
                    <div class="error-hint">Please check your API configuration in settings.</div>
                </div>
                <div class="dialog-actions">
                    <button class="action-btn settings-btn" id="open-settings-btn">
                        <span class="btn-icon">⚙️</span>
                        Open Settings
                    </button>
                </div>
            </div>
        `;

        // Add close button functionality
        const closeBtn = dialog.querySelector('.ai-explainer-close-btn');
        closeBtn.addEventListener('click', () => this.closeDialog());

        // Add settings button functionality
        const settingsBtn = dialog.querySelector('#open-settings-btn');
        settingsBtn.addEventListener('click', () => {
            window.open(chrome.runtime.getURL('src/settings/settings.html'));
        });

        this.currentDialog = dialog;
        document.body.appendChild(dialog);
    }

    createDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'ai-explainer-dialog';
        dialog.setAttribute('data-theme', this.settings.theme || 'auto');
        return dialog;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    speakText(text) {
        // Stop any ongoing speech
        window.speechSynthesis.cancel();
        
        // Create a new utterance
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set default properties
        utterance.rate = 1.0;  // Normal speed
        utterance.pitch = 1.0; // Normal pitch
        utterance.volume = 1.0; // Full volume
        
        // Function to set voice and speak
        const setVoiceAndSpeak = () => {
            const voices = window.speechSynthesis.getVoices();
            
            // Try to find a good English voice
            let voice = voices.find(voice => voice.lang.includes('en') && voice.name.includes('Google'));
            
            // If no Google voice found, use the first English voice
            if (!voice) {
                voice = voices.find(voice => voice.lang.includes('en'));
            }
            
            // If an English voice is found, use it
            if (voice) {
                utterance.voice = voice;
            }
            
            // Speak the text
            window.speechSynthesis.speak(utterance);
        };
        
        // Check if voices are already loaded
        if (window.speechSynthesis.getVoices().length > 0) {
            setVoiceAndSpeak();
        } else {
            // Wait for voices to be loaded
            window.speechSynthesis.onvoiceschanged = setVoiceAndSpeak;
        }
    }

    isSentence(text) {
        const trimmed = text.trim();
        
        // Check if it's too short to be a sentence (less than 2 words typically)
        const words = trimmed.split(/\s+/).filter(word => word.length > 0);
        if (words.length < 2) {
            return false;
        }
        
        // Check if it ends with sentence-ending punctuation
        const endsWithPunctuation = /[.!?;]$/.test(trimmed);
        
        // Check if it contains a verb (basic heuristic)
        const commonVerbs = /\b(is|are|was|were|have|has|had|do|does|did|will|would|could|should|can|may|might|must|shall|am|be|been|being|go|goes|went|come|comes|came|get|gets|got|make|makes|made|take|takes|took|see|sees|saw|know|knows|knew|think|thinks|thought|say|says|said|tell|tells|told|give|gives|gave|find|finds|found|feel|feels|felt|look|looks|looked|seem|seems|seemed|become|becomes|became|leave|leaves|left|put|puts|use|uses|used|work|works|worked|call|calls|called|try|tries|tried|ask|asks|asked|need|needs|needed|want|wants|wanted|turn|turns|turned|start|starts|started|show|shows|showed|hear|hears|heard|play|plays|played|run|runs|ran|move|moves|moved|live|lives|lived|believe|believes|believed|hold|holds|held|bring|brings|brought|happen|happens|happened|write|writes|wrote|provide|provides|provided|sit|sits|sat|stand|stands|stood|lose|loses|lost|pay|pays|paid|meet|meets|met|include|includes|included|continue|continues|continued|set|sets|serve|serves|served|appear|appears|appeared|allow|allows|allowed|lead|leads|led|help|helps|helped|offer|offers|offered|spend|spends|spent|talk|talks|talked|return|returns|returned|change|changes|changed|raise|raises|raised|pass|passes|passed|sell|sells|sold|require|requires|required|report|reports|reported|decide|decides|decided|pull|pulls|pulled)\b/i;
        const hasVerb = commonVerbs.test(trimmed);
        
        // Check if it has sentence structure (capital letter at start)
        const startsWithCapital = /^[A-Z]/.test(trimmed);
        
        // A text is likely a sentence if:
        // 1. It has multiple words AND
        // 2. (It ends with punctuation OR has a verb) AND
        // 3. Starts with a capital letter (optional but helpful)
        return words.length >= 2 && (endsWithPunctuation || hasVerb) && (startsWithCapital || endsWithPunctuation || hasVerb);
    }

    parseExplanation(explanation, isSentence) {
        if (isSentence) {
            // Parse sentence explanation format: **Translation:** and **Explanation:**
            const translationMatch = explanation.match(/\*\*Translation:\*\*\s*(.+?)(?=\*\*Explanation:\*\*|$)/s);
            const explanationMatch = explanation.match(/\*\*Explanation:\*\*\s*(.+)/s);
            
            const translation = translationMatch ? translationMatch[1].trim() : '';
            const explanationText = explanationMatch ? explanationMatch[1].trim() : explanation;
            
            let content = '';
            if (translation && !translation.toLowerCase().includes('already in')) {
                content += `<div class="translation-section">
                    <div class="section-header">🌐 Translation</div>
                    <div class="section-content">${this.escapeHtml(translation)}</div>
                </div>`;
            }
            
            content += `<div class="explanation-section">
                <div class="section-header">💡 Explanation</div>
                <div class="section-content">${this.escapeHtml(explanationText)}</div>
            </div>`;
            
            return {
                content: content,
                rawText: explanation
            };
        } else {
            // Parse word/phrase explanation format: **Definition:** and **In Context:**
            const definitionMatch = explanation.match(/\*\*Definition:\*\*\s*(.+?)(?=\*\*In Context:\*\*|$)/s);
            const contextMatch = explanation.match(/\*\*In Context:\*\*\s*(.+)/s);
            
            const definition = definitionMatch ? definitionMatch[1].trim() : '';
            const contextExplanation = contextMatch ? contextMatch[1].trim() : explanation;
            
            let content = '';
            if (definition) {
                content += `<div class="definition-section">
                    <div class="section-header">📖 Definition</div>
                    <div class="section-content">${this.escapeHtml(definition)}</div>
                </div>`;
            }
            
            if (contextExplanation && contextExplanation !== definition) {
                content += `<div class="context-explanation-section">
                    <div class="section-header">💭 In Context</div>
                    <div class="section-content">${this.escapeHtml(contextExplanation)}</div>
                </div>`;
            }
            
            // If parsing failed, just show the raw explanation
            if (!content) {
                content = `<div class="section-content">${this.escapeHtml(explanation)}</div>`;
            }
            
            return {
                content: content,
                rawText: explanation
            };
        }
    }

    closeDialog() {
        if (this.currentDialog) {
            this.currentDialog.remove();
            this.currentDialog = null;
        }
    }

    handleOutsideClick(e) {
        if (this.currentDialog && !this.currentDialog.contains(e.target)) {
            // Don't close if clicking on the floating button
            if (!e.target.closest('#ai-explainer-button')) {
                this.closeDialog();
            }
        }

        // Hide floating button if clicking outside
        if (!e.target.closest('#ai-explainer-button')) {
            this.hideFloatingButton();
        }
    }
}

// Initialize the text explainer
new TextExplainer();