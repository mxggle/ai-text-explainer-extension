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
        document.addEventListener('mouseup', e => this.handleTextSelection(e));
        document.addEventListener('keyup', e => this.handleKeyboardSelection(e));

        // Handle clicks outside dialog to close it
        document.addEventListener('click', e => this.handleOutsideClick(e));

        // Handle escape key to close dialog
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && this.currentDialog) {
                this.closeDialog();
            }
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'explain-selection') {
                this.explainText(request.text);
            } else if (request.action === 'stream-chunk') {
                this.handleStreamChunk(request);
            } else if (request.action === 'stream-complete') {
                this.handleStreamComplete(request);
            } else if (request.action === 'stream-error') {
                this.handleStreamError(request);
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
            let contextElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

            // Walk up to find a good context container
            while (contextElement && !this.isGoodContextContainer(contextElement)) {
                contextElement = contextElement.parentElement;
            }

            if (contextElement) {
                const contextText = contextElement.textContent || contextElement.innerText;
                // Return up to 1000 characters of context
                return contextText.length > 1000 ? contextText.substring(0, 1000) + '...' : contextText;
            }

            return this.selectedText; // Fallback to selected text
        } catch (error) {
            console.error('Error extracting context:', error);
            return this.selectedText;
        }
    }

    isGoodContextContainer(element) {
        const goodTags = ['P', 'DIV', 'ARTICLE', 'SECTION', 'BLOCKQUOTE', 'LI', 'TD', 'TH'];
        return (
            goodTags.includes(element.tagName) ||
            element.classList.contains('content') ||
            element.classList.contains('text') ||
            element.classList.contains('paragraph')
        );
    }

    showFloatingButton(x, y) {
        this.hideFloatingButton(); // Remove existing button

        const button = document.createElement('div');
        button.id = 'ai-explainer-button';
        button.innerHTML = '🤖 Explain';
        button.className = 'ai-explainer-floating-button';

        // Position the button near the selection
        button.style.left = x + 10 + 'px';
        button.style.top = y - 40 + 'px';

        button.addEventListener('click', e => {
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
            // Determine if it's a sentence for both UI and AI processing
            const isTextSentence = this.isSentence(text);
            console.log('Text is sentence:', isTextSentence, 'Text:', text);

            // Use streaming API and pass sentence detection information
            const response = await chrome.runtime.sendMessage({
                action: 'explain-text-stream',
                text: text,
                context: this.selectedContext,
                settings: this.settings,
                isSentence: isTextSentence // Pass sentence detection to background script
            });

            if (response.success && response.streaming) {
                // Initialize streaming dialog
                this.showStreamingExplanationDialog(text, isTextSentence);
            } else {
                this.showErrorDialog('Failed to start streaming explanation');
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

        // Make dialog draggable and resizable
        this.setupDialogDrag(dialog);
        this.setupDialogResize(dialog);

        this.currentDialog = dialog;
        document.body.appendChild(dialog);
    }

    showExplanationDialog(text, explanation, grammarAnalysis = null, isSentence = false) {
        if (this.currentDialog) {
            this.currentDialog.remove();
        }

        const dialog = this.createDialog();
        const contextText = this.selectedContext && this.selectedContext !== text ? this.selectedContext : '';

        // Parse the explanation to check if it's a sentence or word/phrase
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

        // Create tabs - show Grammar tab for all sentences (even if analysis failed)
        const showGrammarTab = isSentence;

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

                    ${
                        showGrammarTab
                            ? `
                        <div class="tabs-container">
                            <div class="tabs-header">
                                <button class="tab-btn active" data-tab="definition">Definition</button>
                                <button class="tab-btn" data-tab="grammar">Grammar</button>
                            </div>
                            <div class="tabs-content">
                                <div class="tab-panel active" id="definition-panel">
                                    <div class="definition-section">
                                        <div class="definition-content">
                                            ${parsedExplanation.content}
                                        </div>
                                    </div>
                                </div>
                                <div class="tab-panel" id="grammar-panel">
                                    <div class="grammar-analysis">
                                        ${
                                            grammarAnalysis
                                                ? this.parseMarkdown(grammarAnalysis)
                                                : '<div class="loading-content"><div class="loading-spinner"></div><div class="loading-text">Analyzing grammar...</div></div>'
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                    `
                            : `
                        <div class="definition-section">
                            <div class="definition-content">
                                ${parsedExplanation.content}
                            </div>
                        </div>
                    `
                    }
                </div>
                ${
                    contextText
                        ? `
                    <div class="context-section">
                        <div class="context-header" id="context-header">
                            <div class="context-header-title">📄 Context</div>
                            <div class="context-toggle" id="context-toggle">▼</div>
                        </div>
                        <div class="context-content" id="context-content">
                            <div class="context-full-text">${this.escapeHtml(contextText)}</div>
                        </div>
                    </div>
                `
                        : ''
                }
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

        // Add tabs functionality with lazy loading for Grammar tab
        if (showGrammarTab) {
            const tabBtns = dialog.querySelectorAll('.tab-btn');
            const tabPanels = dialog.querySelectorAll('.tab-panel');
            let grammarLoaded = false;

            tabBtns.forEach(btn => {
                btn.addEventListener('click', async () => {
                    const tabName = btn.getAttribute('data-tab');

                    // Remove active class from all tabs and panels
                    tabBtns.forEach(b => b.classList.remove('active'));
                    tabPanels.forEach(p => p.classList.remove('active'));

                    // Add active class to clicked tab and corresponding panel
                    btn.classList.add('active');
                    const panel = dialog.querySelector(`#${tabName}-panel`);
                    if (panel) {
                        panel.classList.add('active');
                    }

                    // Lazy load grammar analysis when Grammar tab is clicked
                    if (tabName === 'grammar' && !grammarLoaded) {
                        grammarLoaded = true;
                        const grammarContent = panel.querySelector('.grammar-analysis');

                        try {
                            console.log('Requesting grammar analysis for:', text);
                            const grammarResponse = await chrome.runtime.sendMessage({
                                action: 'analyze-grammar',
                                text: text,
                                context: this.selectedContext,
                                settings: this.settings
                            });
                            console.log('Grammar response:', grammarResponse);

                            if (grammarResponse.success) {
                                grammarContent.innerHTML = this.parseMarkdown(grammarResponse.analysis);
                                console.log('Grammar analysis received and displayed');
                            } else {
                                console.error('Grammar analysis failed:', grammarResponse.error);
                                grammarContent.innerHTML = `<div class="error-content">
                                    <div class="error-message">Failed to analyze grammar</div>
                                    <div class="error-hint">${grammarResponse.error || 'Unknown error'}</div>
                                </div>`;
                            }
                        } catch (error) {
                            console.error('Grammar analysis error:', error);
                            grammarContent.innerHTML = `<div class="error-content">
                                <div class="error-message">Failed to analyze grammar</div>
                                <div class="error-hint">${error.message}</div>
                            </div>`;
                        }
                    }
                });
            });
        }

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
            const activePanel = dialog.querySelector('.tab-panel.active');
            let copyText = `${displayText}\n\n`;

            if (activePanel && activePanel.id === 'grammar-panel' && grammarAnalysis) {
                copyText += `Grammar Analysis:\n${grammarAnalysis}`;
            } else {
                copyText += parsedExplanation.rawText;
            }

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

        // Make dialog draggable and resizable
        this.setupDialogDrag(dialog);
        this.setupDialogResize(dialog);

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

        // Make dialog draggable and resizable
        this.setupDialogDrag(dialog);
        this.setupDialogResize(dialog);

        this.currentDialog = dialog;
        document.body.appendChild(dialog);
    }

    createDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'ai-explainer-dialog';
        dialog.setAttribute('data-theme', this.settings.theme || 'auto');

        // Add resizers
        const resizers = document.createElement('div');
        resizers.className = 'resizers-container';
        resizers.innerHTML = `
            <div class="resizer resizer-r"></div>
            <div class="resizer resizer-b"></div>
            <div class="resizer resizer-br"></div>
        `;
        dialog.appendChild(resizers);

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
        utterance.rate = 1.0; // Normal speed
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

        // Handle very short text
        if (trimmed.length < 3) {
            return false;
        }

        // Check for Japanese/Chinese characters - these often form sentences without spaces
        const hasAsianChars = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uac00-\ud7af]/.test(trimmed);

        if (hasAsianChars) {
            // For Asian languages, check for sentence-ending patterns
            const asianSentenceEnders = /[。！？；だよねますでしたですが]$/.test(trimmed);
            const hasLength = trimmed.length >= 5; // Reasonable sentence length
            return hasLength && (asianSentenceEnders || trimmed.length >= 10);
        }

        // For Latin-script languages, use the original logic
        const words = trimmed.split(/\s+/).filter(word => word.length > 0);
        if (words.length < 2) {
            return false;
        }

        // Check if it ends with sentence-ending punctuation
        const endsWithPunctuation = /[.!?;]$/.test(trimmed);

        // Check if it contains a verb (basic heuristic)
        const commonVerbs =
            /\b(is|are|was|were|have|has|had|do|does|did|will|would|could|should|can|may|might|must|shall|am|be|been|being|go|goes|went|come|comes|came|get|gets|got|make|makes|made|take|takes|took|see|sees|saw|know|knows|knew|think|thinks|thought|say|says|said|tell|tells|told|give|gives|gave|find|finds|found|feel|feels|felt|look|looks|looked|seem|seems|seemed|become|becomes|became|leave|leaves|left|put|puts|use|uses|used|work|works|worked|call|calls|called|try|tries|tried|ask|asks|asked|need|needs|needed|want|wants|wanted|turn|turns|turned|start|starts|started|show|shows|showed|hear|hears|heard|play|plays|played|run|runs|ran|move|moves|moved|live|lives|lived|believe|believes|believed|hold|holds|held|bring|brings|brought|happen|happens|happened|write|writes|wrote|provide|provides|provided|sit|sits|sat|stand|stands|stood|lose|loses|lost|pay|pays|paid|meet|meets|met|include|includes|included|continue|continues|continued|set|sets|serve|serves|served|appear|appears|appeared|allow|allows|allowed|lead|leads|led|help|helps|helped|offer|offers|offered|spend|spends|spent|talk|talks|talked|return|returns|returned|change|changes|changed|raise|raises|raised|pass|passes|passed|sell|sells|sold|require|requires|required|report|reports|reported|decide|decides|decided|pull|pulls|pulled)\b/i;
        const hasVerb = commonVerbs.test(trimmed);

        // Check if it has sentence structure (capital letter at start)
        const startsWithCapital = /^[A-Z]/.test(trimmed);

        // A text is likely a sentence if:
        // 1. It has multiple words AND
        // 2. (It ends with punctuation OR has a verb) AND
        // 3. Starts with a capital letter (optional but helpful)
        return (
            words.length >= 2 &&
            (endsWithPunctuation || hasVerb) &&
            (startsWithCapital || endsWithPunctuation || hasVerb)
        );
    }

    parseExplanation(explanation, isSentence) {
        // First, try to detect which format we have regardless of isSentence flag
        const hasTranslation = /\*\*Translation:\*\*/.test(explanation);
        const hasDefinition = /\*\*Definition:\*\*/.test(explanation);

        if (hasTranslation || (isSentence && !hasDefinition)) {
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
            const contextExplanation = contextMatch ? contextMatch[1].trim() : '';

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

            // If parsing failed, clean up the markdown formatting and show as plain content
            if (!content) {
                // Remove markdown formatting from the explanation
                let cleanedExplanation = explanation
                    .replace(/\*\*Definition:\*\*/g, '')
                    .replace(/\*\*In Context:\*\*/g, '')
                    .replace(/\*\*Translation:\*\*/g, '')
                    .replace(/\*\*Explanation:\*\*/g, '')
                    .trim();

                content = `<div class="section-content">${this.escapeHtml(cleanedExplanation)}</div>`;
            }

            return {
                content: content,
                rawText: explanation
            };
        }
    }

    parseMarkdown(text) {
        if (!text) return '';

        let html = this.escapeHtml(text);

        // Convert markdown headers (### -> h4, #### -> h5)
        html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^#### (.+)$/gm, '<h5>$1</h5>');

        // Convert bold text (**text** -> <strong>text</strong>)
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Convert bullet points (- item -> <li>item</li>)
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

        // Wrap consecutive <li> items in <ul>
        html = html.replace(/(<li>.*<\/li>)(\n<li>.*<\/li>)*/g, function (match) {
            return '<ul>' + match.replace(/\n/g, '') + '</ul>';
        });

        // Convert markdown tables
        html = this.parseMarkdownTables(html);

        // Convert line breaks to <br> but preserve paragraph structure
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');

        // Wrap in paragraph tags if not already wrapped
        if (!html.startsWith('<') || html.includes('<br>')) {
            html = '<p>' + html + '</p>';
        }

        // Clean up empty paragraphs
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p><br><\/p>/g, '');

        return html;
    }

    parseMarkdownTables(html) {
        // Find and convert markdown tables
        const tableRegex = /(\|[^\n]*\|\n(\|[-:| ]*\|\n)?(\|[^\n]*\|\n?)*)/g;

        return html.replace(tableRegex, match => {
            const lines = match.trim().split('\n');
            if (lines.length < 2) return match;

            let tableHtml = '<table class="markdown-table">';
            let headerProcessed = false;
            let separatorFound = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line.startsWith('|') || !line.endsWith('|')) continue;

                // Check if this is a separator row (contains only |, -, :, and spaces)
                if (/^\|[\s\-:]+\|$/.test(line)) {
                    separatorFound = true;
                    continue;
                }

                // Split by | and clean up cells
                const cells = line
                    .slice(1, -1)
                    .split('|')
                    .map(cell => cell.trim());

                if (!headerProcessed && !separatorFound) {
                    // This is likely a header row
                    tableHtml += '<thead><tr>';
                    cells.forEach(cell => {
                        tableHtml += `<th>${cell}</th>`;
                    });
                    tableHtml += '</tr></thead>';
                    headerProcessed = true;
                } else {
                    // This is a data row
                    if (!tableHtml.includes('<tbody>')) {
                        tableHtml += '<tbody>';
                    }
                    tableHtml += '<tr>';
                    cells.forEach(cell => {
                        tableHtml += `<td>${cell}</td>`;
                    });
                    tableHtml += '</tr>';
                }
            }

            if (tableHtml.includes('<tbody>')) {
                tableHtml += '</tbody>';
            }
            tableHtml += '</table>';

            return tableHtml;
        });
    }

    closeDialog() {
        if (this.currentDialog) {
            // Clean up drag event listeners
            if (this.currentDialog._dragCleanup) {
                this.currentDialog._dragCleanup();
            }
            // Clean up resize event listeners
            if (this.currentDialog._resizeCleanup) {
                this.currentDialog._resizeCleanup();
            }
            // Clean up scroll prevention event listeners
            if (this.currentDialog._scrollCleanup) {
                this.currentDialog._scrollCleanup();
            }
            this.currentDialog.remove();
            this.currentDialog = null;
        }
    }

    handleOutsideClick(e) {
        if (this.currentDialog && !this.currentDialog.contains(e.target)) {
            // Don't close if clicking on the floating button or if currently resizing
            if (!e.target.closest('#ai-explainer-button') && !this._isResizing) {
                this.closeDialog();
            }
        }

        // Hide floating button if clicking outside (but not during resize)
        if (!e.target.closest('#ai-explainer-button') && !this._isResizing) {
            this.hideFloatingButton();
        }
    }

    showStreamingExplanationDialog(text, isSentence) {
        if (this.currentDialog) {
            this.currentDialog.remove();
        }

        const dialog = this.createDialog();
        const contextText = this.selectedContext && this.selectedContext !== text ? this.selectedContext : '';

        // Extract just the word or phrase for dictionary-style display
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
        const showGrammarTab = isSentence;

        // Initialize with streaming content placeholders
        // Note: Don't use innerHTML as it removes the resizer elements added by createDialog()
        dialog.insertAdjacentHTML(
            'beforeend',
            `
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

                    ${
                        showGrammarTab
                            ? `
                        <div class="tabs-container">
                            <div class="tabs-header">
                                <button class="tab-btn active" data-tab="definition">Definition</button>
                                <button class="tab-btn" data-tab="grammar">Grammar</button>
                            </div>
                            <div class="tabs-content">
                                <div class="tab-panel active" id="definition-panel">
                                    <div class="definition-section">
                                        <div class="definition-content">
                                            <div class="streaming-content" id="streaming-content">
                                                <div class="streaming-placeholder">
                                                    <div class="streaming-cursor"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="tab-panel" id="grammar-panel">
                                    <div class="grammar-analysis">
                                        <div class="loading-content">
                                            <div class="loading-spinner"></div>
                                            <div class="loading-text">Click to analyze grammar...</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `
                            : `
                        <div class="definition-section">
                            <div class="definition-content">
                                <div class="streaming-content" id="streaming-content">
                                    <div class="streaming-placeholder">
                                        <div class="streaming-cursor"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `
                    }
                </div>
                ${
                    contextText
                        ? `
                    <div class="context-section">
                        <div class="context-header" id="context-header">
                            <div class="context-header-title">📄 Context</div>
                            <div class="context-toggle" id="context-toggle">▼</div>
                        </div>
                        <div class="context-content" id="context-content">
                            <div class="context-full-text">${this.escapeHtml(contextText)}</div>
                        </div>
                    </div>
                `
                        : ''
                }
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
        `
        );

        // Store dialog state for streaming
        this.currentDialog = dialog;
        this.currentDialogState = {
            text: text,
            isSentence: isSentence,
            streamingContent: '',
            isStreaming: true,
            grammarLoaded: false
        };

        // Add event listeners
        this.setupDialogEventListeners(dialog, displayText, showGrammarTab, copyButtonText, contextText);

        document.body.appendChild(dialog);
    }

    setupDialogEventListeners(dialog, displayText, showGrammarTab, copyButtonText, contextText) {
        // Make dialog draggable
        this.setupDialogDrag(dialog);
        this.setupDialogResize(dialog);

        // Prevent main page scrolling when scrolling inside dialog
        this.setupScrollPrevention(dialog);

        // Close button
        const closeBtn = dialog.querySelector('.ai-explainer-close-btn');
        closeBtn.addEventListener('click', () => this.closeDialog());

        // Pronunciation button
        const speakBtn = dialog.querySelector('#speak-btn');
        speakBtn.addEventListener('click', () => {
            this.speakText(displayText);
        });

        // Tabs functionality with lazy loading for Grammar tab
        if (showGrammarTab) {
            const tabBtns = dialog.querySelectorAll('.tab-btn');
            const tabPanels = dialog.querySelectorAll('.tab-panel');

            tabBtns.forEach(btn => {
                btn.addEventListener('click', async () => {
                    const tabName = btn.getAttribute('data-tab');

                    // Remove active class from all tabs and panels
                    tabBtns.forEach(b => b.classList.remove('active'));
                    tabPanels.forEach(p => p.classList.remove('active'));

                    // Add active class to clicked tab and corresponding panel
                    btn.classList.add('active');
                    const panel = dialog.querySelector(`#${tabName}-panel`);
                    if (panel) {
                        panel.classList.add('active');
                    }

                    // Lazy load grammar analysis when Grammar tab is clicked
                    if (tabName === 'grammar' && !this.currentDialogState.grammarLoaded) {
                        this.currentDialogState.grammarLoaded = true;
                        const grammarContent = panel.querySelector('.grammar-analysis');

                        try {
                            console.log('Requesting streaming grammar analysis for:', this.currentDialogState.text);

                            // Start streaming grammar analysis
                            const response = await chrome.runtime.sendMessage({
                                action: 'analyze-grammar-stream',
                                text: this.currentDialogState.text,
                                context: this.selectedContext,
                                settings: this.settings
                            });

                            if (response.success && response.streaming) {
                                grammarContent.innerHTML = `
                                    <div class="streaming-content" id="grammar-streaming-content">
                                        <div class="streaming-placeholder">
                                            <div class="streaming-cursor"></div>
                                        </div>
                                    </div>
                                `;
                            }
                        } catch (error) {
                            console.error('Grammar analysis error:', error);
                            grammarContent.innerHTML = `<div class="error-content">
                                <div class="error-message">Failed to analyze grammar</div>
                                <div class="error-hint">${error.message}</div>
                            </div>`;
                        }
                    }
                });
            });
        }

        // Context toggle functionality
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

        // Copy and settings buttons
        const copyBtn = dialog.querySelector('#copy-btn');
        const settingsBtn = dialog.querySelector('#settings-btn');

        settingsBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({
                action: 'open-settings'
            });
            this.closeDialog();
        });

        copyBtn.addEventListener('click', () => {
            const copyText = `${displayText}\n\n${this.currentDialogState.streamingContent}`;

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
    }

    setupDialogDrag(dialog) {
        const header = dialog.querySelector('.ai-explainer-dialog-header');
        if (!header) return;

        let isDragging = false;
        let initialMouseX = 0;
        let initialMouseY = 0;
        let dialogX = 0;
        let dialogY = 0;
        let initialDialogX = 0;
        let initialDialogY = 0;

        const handleMouseDown = e => {
            if (e.target.closest('.ai-explainer-close-btn, button, input')) {
                return;
            }
            e.preventDefault();

            isDragging = true;
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            initialDialogX = dialogX;
            initialDialogY = dialogY;

            header.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
        };

        const handleMouseMove = e => {
            if (!isDragging) return;
            e.preventDefault();

            const deltaX = e.clientX - initialMouseX;
            const deltaY = e.clientY - initialMouseY;

            let newDialogX = initialDialogX + deltaX;
            let newDialogY = initialDialogY + deltaY;

            const dialogWidth = dialog.offsetWidth;
            const dialogHeight = dialog.offsetHeight;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            const minX = dialogWidth / 2 - viewportWidth / 2;
            const maxX = viewportWidth / 2 - dialogWidth / 2;
            const minY = dialogHeight / 2 - viewportHeight / 2;
            const maxY = viewportHeight / 2 - dialogHeight / 2;

            newDialogX = Math.max(minX, Math.min(maxX, newDialogX));
            newDialogY = Math.max(minY, Math.min(maxY, newDialogY));

            dialogX = newDialogX;
            dialogY = newDialogY;

            dialog.style.transform = `translate(calc(-50% + ${dialogX}px), calc(-50% + ${dialogY}px))`;
        };

        const handleMouseUp = () => {
            if (!isDragging) return;
            isDragging = false;
            header.style.cursor = 'grab';
            document.body.style.userSelect = '';
        };

        // Add event listeners
        header.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mouseleave', handleMouseUp); // Stop dragging if mouse leaves window

        // Store cleanup function
        dialog._dragCleanup = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mouseleave', handleMouseUp);
            header.removeEventListener('mousedown', handleMouseDown);
            document.body.style.userSelect = '';
        };
    }

    setupDialogResize(dialog) {
        const resizers = dialog.querySelectorAll('.resizer');
        const MIN_WIDTH = 380;
        const MIN_HEIGHT = 200;
        // Remove max size limitations to allow unlimited resizing

        const resizeEventListeners = [];

        resizers.forEach(resizer => {
            const handleMouseDown = e => {
                e.preventDefault();
                e.stopPropagation(); // Stop drag from firing

                // Set flag to prevent dialog from closing during resize
                this._isResizing = true;

                // Get current dialog dimensions and position
                const rect = dialog.getBoundingClientRect();
                const originalWidth = rect.width;
                const originalHeight = rect.height;
                const originalMouseX = e.clientX;
                const originalMouseY = e.clientY;

                // Disable user selection during resize
                document.body.style.userSelect = 'none';
                document.body.style.webkitUserSelect = 'none';

                const handleMouseMove = e => {
                    let newWidth = originalWidth;
                    let newHeight = originalHeight;

                    if (resizer.classList.contains('resizer-r')) {
                        // Right edge resize
                        newWidth = originalWidth + (e.clientX - originalMouseX);
                    } else if (resizer.classList.contains('resizer-b')) {
                        // Bottom edge resize
                        newHeight = originalHeight + (e.clientY - originalMouseY);
                    } else if (resizer.classList.contains('resizer-br')) {
                        // Bottom-right corner resize
                        newWidth = originalWidth + (e.clientX - originalMouseX);
                        newHeight = originalHeight + (e.clientY - originalMouseY);
                    }

                    // Apply only minimum constraints (no maximum)
                    newWidth = Math.max(newWidth, MIN_WIDTH);
                    newHeight = Math.max(newHeight, MIN_HEIGHT);

                    // Apply new dimensions
                    dialog.style.width = newWidth + 'px';
                    dialog.style.height = newHeight + 'px';

                    // Remove max-width and max-height constraints from CSS when manually resizing
                    dialog.style.maxWidth = 'none';
                    dialog.style.maxHeight = 'none';

                    // Ensure content is scrollable if needed
                    const content = dialog.querySelector('.ai-explainer-dialog-content');
                    if (content) {
                        content.style.maxHeight = newHeight - 50 + 'px'; // Account for header
                        content.style.overflowY = 'auto';
                    }
                };

                const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);

                    // Re-enable user selection
                    document.body.style.userSelect = '';
                    document.body.style.webkitUserSelect = '';

                    // Clear resize flag with a small delay to prevent accidental closing
                    setTimeout(() => {
                        this._isResizing = false;
                    }, 100);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            };

            resizer.addEventListener('mousedown', handleMouseDown);
            resizeEventListeners.push({ element: resizer, handler: handleMouseDown });
        });

        // Store cleanup function for resize functionality
        dialog._resizeCleanup = () => {
            resizeEventListeners.forEach(({ element, handler }) => {
                element.removeEventListener('mousedown', handler);
            });
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
            this._isResizing = false;
        };
    }

    setupScrollPrevention(dialog) {
        // Prevent wheel events from bubbling up to prevent main page scrolling
        const handleWheel = e => {
            const dialogContent = dialog.querySelector('.ai-explainer-dialog-content');
            if (!dialogContent) return;

            const isScrollable = dialogContent.scrollHeight > dialogContent.clientHeight;

            if (isScrollable) {
                const atTop = dialogContent.scrollTop === 0;
                const atBottom = dialogContent.scrollTop + dialogContent.clientHeight >= dialogContent.scrollHeight;

                // Prevent main page scroll only if we're not at the boundaries or scrolling in the right direction
                if ((!atTop && e.deltaY < 0) || (!atBottom && e.deltaY > 0)) {
                    e.stopPropagation();
                } else if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
                    // At boundary and trying to scroll beyond - prevent main page scroll
                    e.preventDefault();
                    e.stopPropagation();
                }
            } else {
                // If content isn't scrollable, prevent main page scroll entirely
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // Prevent touch scroll events on mobile
        const handleTouchMove = e => {
            const dialogContent = dialog.querySelector('.ai-explainer-dialog-content');
            if (!dialogContent) return;

            // Only prevent if the touch is within the dialog content area
            if (dialogContent.contains(e.target)) {
                const isScrollable = dialogContent.scrollHeight > dialogContent.clientHeight;
                if (!isScrollable) {
                    e.preventDefault();
                }
                e.stopPropagation();
            }
        };

        // Add event listeners with passive: false to allow preventDefault
        dialog.addEventListener('wheel', handleWheel, { passive: false });
        dialog.addEventListener('touchmove', handleTouchMove, { passive: false });

        // Store cleanup function for scroll prevention
        dialog._scrollCleanup = () => {
            dialog.removeEventListener('wheel', handleWheel);
            dialog.removeEventListener('touchmove', handleTouchMove);
        };
    }

    handleStreamChunk(request) {
        console.log(`Received ${request.type} chunk:`, request.chunk);

        if (!this.currentDialog || !this.currentDialogState) {
            console.log('No dialog or dialog state available');
            return;
        }

        // Update the appropriate streaming content area
        let contentElement;
        let streamingContent = '';

        if (request.type === 'explain') {
            // Only update for explanation if still streaming
            if (!this.currentDialogState.isStreaming) {
                console.log('Explanation not streaming, ignoring chunk');
                return;
            }

            this.currentDialogState.streamingContent += request.chunk;
            contentElement = this.currentDialog.querySelector('#streaming-content');
            streamingContent = this.currentDialogState.streamingContent;
            console.log('Updated explanation content, total length:', streamingContent.length);
        } else if (request.type === 'grammar') {
            // Handle grammar streaming separately
            if (!this.currentDialogState.grammarStreamingContent) {
                this.currentDialogState.grammarStreamingContent = '';
            }
            this.currentDialogState.grammarStreamingContent += request.chunk;
            contentElement = this.currentDialog.querySelector('#grammar-streaming-content');
            streamingContent = this.currentDialogState.grammarStreamingContent;
            console.log('Updated grammar content, total length:', streamingContent.length);
        }

        if (contentElement) {
            // Parse and display the streamed content
            const parsedContent = this.parseStreamingContent(
                streamingContent,
                this.currentDialogState.isSentence,
                request.type
            );
            contentElement.innerHTML = parsedContent + '<div class="streaming-cursor"></div>';
            console.log('Updated content element for', request.type);
        } else {
            console.log('Content element not found for type:', request.type);
        }
    }

    handleStreamComplete(request) {
        if (!this.currentDialog || !this.currentDialogState) {
            return;
        }

        // Update the appropriate content area with final content
        let contentElement;
        if (request.type === 'explain') {
            contentElement = this.currentDialog.querySelector('#streaming-content');
            this.currentDialogState.isStreaming = false;
        } else if (request.type === 'grammar') {
            contentElement = this.currentDialog.querySelector('#grammar-streaming-content');
        }

        if (contentElement) {
            if (request.type === 'explain') {
                // Parse the final explanation
                const parsedExplanation = this.parseExplanation(request.result, this.currentDialogState.isSentence);
                contentElement.innerHTML = parsedExplanation.content;
                this.currentDialogState.streamingContent = request.result;
            } else if (request.type === 'grammar') {
                // Display final grammar analysis with consistent formatting
                const parsedContent = this.parseStreamingContent(request.result, false, request.type);
                contentElement.innerHTML = parsedContent;
                this.currentDialogState.grammarStreamingContent = request.result;
            }
        }
    }

    handleStreamError(request) {
        if (!this.currentDialog) {
            return;
        }

        // Update the appropriate content area with error message
        let contentElement;
        if (request.type === 'explain') {
            contentElement = this.currentDialog.querySelector('#streaming-content');
        } else if (request.type === 'grammar') {
            contentElement = this.currentDialog.querySelector('#grammar-streaming-content');
        }

        if (contentElement) {
            contentElement.innerHTML = `<div class="error-content">
                <div class="error-message">Failed to ${
                    request.type === 'explain' ? 'get explanation' : 'analyze grammar'
                }</div>
                <div class="error-hint">${request.error}</div>
            </div>`;
        }
    }

    parseStreamingContent(content, isSentence, type) {
        // Use the same structured parsing as the final version for consistency
        // This ensures streaming and final content have the same styling

        // Handle grammar analysis content
        if (type === 'grammar') {
            // Grammar analysis content should be parsed as markdown
            return this.parseMarkdown(content);
        }

        // Handle explanation content
        // First, try to detect which format we have regardless of isSentence flag
        const hasTranslation = /\*\*Translation:\*\*/.test(content);
        const hasDefinition = /\*\*Definition:\*\*/.test(content);

        if (hasTranslation || (isSentence && !hasDefinition)) {
            // Parse sentence explanation format: **Translation:** and **Explanation:**
            const translationMatch = content.match(/\*\*Translation:\*\*\s*(.+?)(?=\*\*Explanation:\*\*|$)/s);
            const explanationMatch = content.match(/\*\*Explanation:\*\*\s*(.+)/s);

            const translation = translationMatch ? translationMatch[1].trim() : '';
            const explanationText = explanationMatch ? explanationMatch[1].trim() : '';

            let html = '';
            if (translation && !translation.toLowerCase().includes('already in')) {
                html += `<div class="translation-section">
                    <div class="section-header">🌐 Translation</div>
                    <div class="section-content">${this.escapeHtml(translation)}</div>
                </div>`;
            }

            if (explanationText) {
                html += `<div class="explanation-section">
                    <div class="section-header">💡 Explanation</div>
                    <div class="section-content">${this.escapeHtml(explanationText)}</div>
                </div>`;
            }

            // If we have partial content, show what we have so far
            if (!html && content.trim()) {
                // Remove any markdown headers and show as plain content
                let cleanedContent = content
                    .replace(/\*\*Translation:\*\*/g, '')
                    .replace(/\*\*Explanation:\*\*/g, '')
                    .trim();

                if (cleanedContent) {
                    // Escape HTML first, then convert markdown patterns
                    cleanedContent = this.escapeHtml(cleanedContent);
                    cleanedContent = cleanedContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                    cleanedContent = cleanedContent.replace(/\n/g, '<br>');
                    html = `<div class="section-content">${cleanedContent}</div>`;
                }
            }

            return html;
        } else {
            // Parse word/phrase explanation format: **Definition:** and **In Context:**
            const definitionMatch = content.match(/\*\*Definition:\*\*\s*(.+?)(?=\*\*In Context:\*\*|$)/s);
            const contextMatch = content.match(/\*\*In Context:\*\*\s*(.+)/s);

            const definition = definitionMatch ? definitionMatch[1].trim() : '';
            const contextExplanation = contextMatch ? contextMatch[1].trim() : '';

            let html = '';
            if (definition) {
                html += `<div class="definition-section">
                    <div class="section-header">📖 Definition</div>
                    <div class="section-content">${this.escapeHtml(definition)}</div>
                </div>`;
            }

            if (contextExplanation && contextExplanation !== definition) {
                html += `<div class="context-explanation-section">
                    <div class="section-header">💭 In Context</div>
                    <div class="section-content">${this.escapeHtml(contextExplanation)}</div>
                </div>`;
            }

            // If parsing failed or we have partial content, show as plain content
            if (!html && content.trim()) {
                // Remove markdown formatting and show cleaned content
                let cleanedContent = content
                    .replace(/\*\*Definition:\*\*/g, '')
                    .replace(/\*\*In Context:\*\*/g, '')
                    .trim();

                if (cleanedContent) {
                    // Escape HTML first, then convert markdown patterns
                    cleanedContent = this.escapeHtml(cleanedContent);
                    cleanedContent = cleanedContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                    cleanedContent = cleanedContent.replace(/\n/g, '<br>');
                    html = `<div class="section-content">${cleanedContent}</div>`;
                }
            }

            return html;
        }
    }
}

// Initialize the text explainer
new TextExplainer();
