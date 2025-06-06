// Popup JavaScript for AI Text Explainer
class PopupManager {
    constructor() {
        this.currentText = null;
        this.isLoading = false;
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateStatus();
        this.checkForRecentExplanation();
        this.setState('empty'); // Start with empty state
    }

    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'get-settings' });
            if (response && response.success) {
                this.settings = response.settings;
            } else {
                console.warn('Failed to load settings, using defaults');
                this.settings = { provider: 'openai', model: 'gpt-3.5-turbo' };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = { provider: 'openai', model: 'gpt-3.5-turbo' };
        }
    }

    async checkForRecentExplanation() {
        try {
            // Check if there's recent text that was explained
            const response = await chrome.runtime.sendMessage({ action: 'get-recent-explanation' });
            if (response && response.success && response.data) {
                this.displayExplanation(response.data.text, response.data.explanation);
            }
        } catch (error) {
            console.error('Error checking recent explanation:', error);
        }
    }

    setupEventListeners() {
        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                chrome.tabs.create({
                    url: chrome.runtime.getURL('src/settings/settings.html')
                });
                window.close();
            });
        }

        // Pronunciation play button
        const playBtn = document.getElementById('play-pronunciation');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.playPronunciation());
        }

        // Favorite button
        const favoriteBtn = document.getElementById('favorite-btn');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', () => this.toggleFavorite());
        }

        // Heart button
        const heartBtn = document.getElementById('heart-btn');
        if (heartBtn) {
            heartBtn.addEventListener('click', () => this.toggleHeart());
        }

        // Expand button
        const expandBtn = document.getElementById('expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => this.expandView());
        }

        // New window button
        const newWindowBtn = document.getElementById('new-window-btn');
        if (newWindowBtn) {
            newWindowBtn.addEventListener('click', () => this.openInNewWindow());
        }

        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'text-selected') {
                this.handleTextSelection(message.text);
            } else if (message.action === 'explanation-ready') {
                this.displayExplanation(message.text, message.explanation);
            }
        });
    }

    setState(state) {
        const container = document.querySelector('.popup-container');
        container.className = `popup-container ${state}`;

        // Update bottom padding based on state
        if (state === 'empty') {
            container.style.paddingBottom = '60px'; // Space for bottom actions
        } else {
            container.style.paddingBottom = '60px';
        }
    }

    async handleTextSelection(text) {
        if (!text || text.trim().length === 0) {
            this.setState('empty');
            return;
        }

        this.currentText = text.trim();
        this.setState('loading');
        this.isLoading = true;

        try {
            // Send request for explanation
            const response = await chrome.runtime.sendMessage({
                action: 'explain-text',
                text: this.currentText,
                provider: this.settings.provider,
                model: this.settings.model
            });

            if (response && response.success) {
                this.displayExplanation(this.currentText, response.explanation);
            } else {
                this.showError('Failed to get explanation. Please check your settings.');
                this.setState('empty');
            }
        } catch (error) {
            console.error('Error getting explanation:', error);
            this.showError('Error getting explanation. Please try again.');
            this.setState('empty');
        } finally {
            this.isLoading = false;
        }
    }

    displayExplanation(text, explanation) {
        // Update word title
        const wordTitle = document.getElementById('word-title');
        if (wordTitle) {
            wordTitle.textContent = text;
        }

        // Update pronunciation and language indicator
        const pronunciationEl = document.getElementById('pronunciation');
        const pronunciationLabel = document.querySelector('.pronunciation-label');
        if (pronunciationEl && pronunciationLabel) {
            const detectedLang = this.detectLanguage(text);
            const langCode = detectedLang.split('-')[0].toUpperCase();

            // Update language label
            pronunciationLabel.textContent = langCode;

            // Generate pronunciation
            pronunciationEl.textContent = this.generatePronunciation(text);
        }

        // Update definitions
        this.updateDefinitions(explanation);

        this.setState('has-content');
    }

    generatePronunciation(text) {
        const detectedLang = this.detectLanguage(text);
        const langCode = detectedLang.split('-')[0];

        // Different pronunciation formatting based on language
        switch (langCode) {
            case 'ja':
                // For Japanese, show romanization hint
                return `/${text}/`;
            case 'zh':
                // For Chinese, show pinyin placeholder
                return `/pínyīn/`;
            case 'ko':
                // For Korean, show hangul
                return `/${text}/`;
            case 'ar':
                // For Arabic
                return `/${text}/`;
            case 'ru':
                // For Russian
                return `/${text}/`;
            case 'th':
                // For Thai
                return `/${text}/`;
            case 'hi':
                // For Hindi
                return `/${text}/`;
            default:
                // For Latin scripts, create IPA-like format
                const word = text.toLowerCase().replace(/[^a-z]/g, '');
                if (word.length === 0) {
                    return `/${text}/`;
                }
                if (word.length <= 4) {
                    return `/${word}/`;
                }
                return `/ˈ${word.substring(0, Math.ceil(word.length/2))}${word.substring(Math.ceil(word.length/2))}/`;
        }
    }

    updateDefinitions(explanation) {
        const definitionsSection = document.getElementById('definitions-section');
        if (!definitionsSection) return;

        // Clear existing definitions
        definitionsSection.innerHTML = '';

        // Parse explanation into different types/categories
        const definitions = this.parseExplanation(explanation);

        definitions.forEach(def => {
            const defEntry = document.createElement('div');
            defEntry.className = 'definition-entry';

            const defType = document.createElement('span');
            defType.className = 'definition-type';
            defType.textContent = def.type;

            const defText = document.createElement('span');
            defText.className = 'definition-text';
            defText.textContent = def.text;

            defEntry.appendChild(defType);
            defEntry.appendChild(defText);
            definitionsSection.appendChild(defEntry);
        });
    }

    parseExplanation(explanation) {
        // Try to parse the explanation into different categories
        // This is a simple parser - you might want to make it more sophisticated
        const definitions = [];

        if (explanation.includes('\n')) {
            const lines = explanation.split('\n').filter(line => line.trim());
            lines.forEach((line, index) => {
                if (line.trim()) {
                    definitions.push({
                        type: index === 0 ? 'def.' : `${index + 1}.`,
                        text: line.trim()
                    });
                }
            });
        } else {
            // Single explanation
            definitions.push({
                type: 'def.',
                text: explanation
            });
        }

        return definitions;
    }

    playPronunciation() {
        // Use Web Speech API to pronounce the word
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(this.currentText);
            utterance.rate = 0.8;
            utterance.pitch = 1;

            // Detect language and set appropriate voice
            const detectedLanguage = this.detectLanguage(this.currentText);
            utterance.lang = detectedLanguage;

            // Function to set voice and speak
            const speakWithVoice = () => {
                const voices = speechSynthesis.getVoices();

                if (voices.length > 0) {
                    // Try to find a voice for the detected language
                    const appropriateVoice = voices.find(voice =>
                        voice.lang.startsWith(detectedLanguage.split('-')[0])
                    );

                    if (appropriateVoice) {
                        utterance.voice = appropriateVoice;
                        console.log(`Using voice: ${appropriateVoice.name} (${appropriateVoice.lang}) for detected language: ${detectedLanguage}`);
                    } else {
                        console.log(`No voice found for ${detectedLanguage}, using default`);
                    }
                }

                speechSynthesis.speak(utterance);
            };

            // Check if voices are loaded, if not wait for them
            if (speechSynthesis.getVoices().length === 0) {
                speechSynthesis.addEventListener('voiceschanged', speakWithVoice, { once: true });
            } else {
                speakWithVoice();
            }
        } else {
            this.showMessage('Speech synthesis not supported in this browser', 'info');
        }
    }

    detectLanguage(text) {
        // Simple language detection based on character ranges
        const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
        const hasChinese = /[\u4e00-\u9fff]/.test(text);
        const hasKorean = /[\uac00-\ud7af]/.test(text);
        const hasArabic = /[\u0600-\u06ff]/.test(text);
        const hasRussian = /[\u0400-\u04ff]/.test(text);
        const hasGreek = /[\u0370-\u03ff]/.test(text);
        const hasThai = /[\u0e00-\u0e7f]/.test(text);
        const hasHindi = /[\u0900-\u097f]/.test(text);

        // Priority order for mixed scripts
        if (hasJapanese) {
            return 'ja-JP';
        } else if (hasChinese && !hasJapanese) {
            // Distinguish between Traditional and Simplified Chinese
            const hasTraditional = /[\u4e00-\u9fff]/.test(text);
            return 'zh-CN'; // Default to Simplified, could be enhanced
        } else if (hasKorean) {
            return 'ko-KR';
        } else if (hasArabic) {
            return 'ar-SA';
        } else if (hasRussian) {
            return 'ru-RU';
        } else if (hasGreek) {
            return 'el-GR';
        } else if (hasThai) {
            return 'th-TH';
        } else if (hasHindi) {
            return 'hi-IN';
        } else {
            // For Latin scripts, try to detect specific languages
            return this.detectLatinLanguage(text);
        }
    }

    detectLatinLanguage(text) {
        const lowerText = text.toLowerCase();

        // Common words/patterns for different languages
        const languagePatterns = {
            'es-ES': /\b(el|la|los|las|un|una|de|en|y|a|que|es|se|no|te|lo|le|da|su|por|son|con|para|al|una|sobre|todo|pero|más|me|muy|yo|ahora|como|donde|cuando)\b/g,
            'fr-FR': /\b(le|la|les|un|une|de|du|des|et|à|ce|il|être|et|en|avoir|que|pour|dans|ce|son|une|sur|avec|ne|se|pas|tout|mais|plus|dire|me|on|mon|lui|nous|comme|où|quand)\b/g,
            'de-DE': /\b(der|die|das|und|in|den|von|zu|mit|sich|auf|für|als|bei|nach|über|aus|an|werden|hat|er|es|sie|nicht|werden|haben|sein|werden|können|müssen|sollen|wollen|dürfen|mögen)\b/g,
            'it-IT': /\b(il|lo|la|i|gli|le|un|uno|una|di|a|da|in|con|su|per|tra|fra|e|che|non|si|è|sono|ha|hanno|essere|avere|fare|dire|andare|stare|vedere|sapere|dare|volere|dovere|potere|come|dove|quando)\b/g,
            'pt-PT': /\b(o|a|os|as|um|uma|de|em|para|com|por|se|que|não|é|são|tem|ter|ser|estar|fazer|ir|ver|dar|vir|dizer|poder|querer|dever|saber|como|onde|quando)\b/g,
            'nl-NL': /\b(de|het|een|van|in|op|met|voor|door|naar|uit|aan|bij|over|onder|tegen|zonder|binnen|buiten|tussen|achter|naast|boven|beneden|links|rechts|zoals|waar|wanneer)\b/g,
        };

        let maxMatches = 0;
        let detectedLang = 'en-US'; // default

        for (const [lang, pattern] of Object.entries(languagePatterns)) {
            const matches = (lowerText.match(pattern) || []).length;
            if (matches > maxMatches) {
                maxMatches = matches;
                detectedLang = lang;
            }
        }

        // If no pattern matches well, check for special characters
        if (maxMatches < 2) {
            if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(lowerText)) {
                if (/[àáâãç]/.test(lowerText)) return 'pt-PT';
                if (/[àâéèêëôùûüÿç]/.test(lowerText)) return 'fr-FR';
                if (/[äöüß]/.test(lowerText)) return 'de-DE';
                if (/[àèéìíîòóù]/.test(lowerText)) return 'it-IT';
                if (/[áéíñóú]/.test(lowerText)) return 'es-ES';
            }
        }

        return detectedLang;
    }

    toggleFavorite() {
        const btn = document.getElementById('favorite-btn');
        btn.classList.toggle('active');
        // In a real app, you'd save this to storage
        this.showMessage('Added to favorites', 'success');
    }

    toggleHeart() {
        const btn = document.getElementById('heart-btn');
        btn.classList.toggle('active');
        // In a real app, you'd save this to storage
        this.showMessage('Liked!', 'success');
    }

    expandView() {
        // Toggle between compact and expanded view
        const container = document.querySelector('.popup-container');
        if (container.style.height === '600px') {
            container.style.height = '400px';
        } else {
            container.style.height = '600px';
        }
    }

    openInNewWindow() {
        if (this.currentText) {
            chrome.tabs.create({
                url: `https://www.google.com/search?q=define+${encodeURIComponent(this.currentText)}`
            });
        }
    }

    updateStatus() {
        const statusDot = document.getElementById('status-dot');
        const statusCount = document.getElementById('status-count');

        if (statusDot && statusCount) {
            // Check if API key is configured
            const hasApiKey = this.settings && this.settings.apiKeys && this.settings.apiKeys[this.settings.provider];

            if (hasApiKey) {
                statusDot.style.background = '#4ade80'; // Green
                statusCount.textContent = '✓';
                statusCount.style.background = '#4ade80';
            } else {
                statusDot.style.background = '#f87171'; // Red
                statusCount.textContent = '!';
                statusCount.style.background = '#f87171';
            }
        }
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type) {
        // Create temporary toast message
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        // Style the toast
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            fontSize: '14px',
            zIndex: '10000',
            animation: 'slideIn 0.3s ease',
            background: type === 'success' ? '#4ade80' : type === 'error' ? '#f87171' : '#6b7280'
        });

        document.body.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);

        // Add CSS animations if not already added
        if (!document.querySelector('#toast-animations')) {
            const style = document.createElement('style');
            style.id = 'toast-animations';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});

// Handle browser extension context
if (chrome && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Popup received message:', message);
        // Handle any additional messages
        return true;
    });
}