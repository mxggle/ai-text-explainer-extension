// Popup JavaScript for AI Text Explainer - Mini Settings Interface
class PopupManager {
    constructor() {
        this.settings = {};
        this.providers = {
            'openai': {
                name: 'OpenAI',
                models: [
                    { id: 'gpt-4o', name: 'GPT-4o' },
                    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
                    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
                ]
            },
            'anthropic': {
                name: 'Anthropic',
                models: [
                    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
                    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
                    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
                ]
            },
            'gemini': {
                name: 'Google Gemini',
                models: [
                    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
                    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
                ]
            },
            'xai': {
                name: 'xAI',
                models: [
                    { id: 'grok-3-beta', name: 'Grok 3 Beta' },
                    { id: 'grok-3-fast-beta', name: 'Grok 3 Fast Beta' },
                    { id: 'grok-3-mini-beta', name: 'Grok 3 Mini Beta' },
                    { id: 'grok-3-mini-fast-beta', name: 'Grok 3 Mini Fast' },
                    { id: 'grok-beta', name: 'Grok Beta' },
                    { id: 'grok-vision-beta', name: 'Grok Vision Beta' },
                    { id: 'grok-vision-2', name: 'Grok Vision 2' },
                    { id: 'grok-2', name: 'Grok 2' }
                ]
            }
        };
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateUI();
        this.updateStatus();
    }

    async loadSettings() {
        try {
            console.log('PopupManager: Loading settings...');
            const response = await chrome.runtime.sendMessage({ action: 'get-settings' });
            console.log('PopupManager: Received response:', response);

            if (response && response.success) {
                this.settings = response.settings;
                console.log('PopupManager: Settings loaded successfully:', this.settings);
            } else {
                console.log('PopupManager: No settings found, using defaults');
                // Default settings
                this.settings = {
                    provider: 'openai',
                    model: 'gpt-4o-mini',
                    detailLevel: 'medium',
                    language: 'English',
                    apiKeys: {}
                };
            }
        } catch (error) {
            console.error('PopupManager: Failed to load settings:', error);
            this.showMessage('Failed to load settings', 'error');

            // Fallback to defaults
            this.settings = {
                provider: 'openai',
                model: 'gpt-4o-mini',
                detailLevel: 'medium',
                language: 'English',
                apiKeys: {}
            };
        }
    }

    setupEventListeners() {
        // Provider selection
        const providerSelect = document.getElementById('provider-select');
        if (providerSelect) {
            providerSelect.addEventListener('change', (e) => {
                this.settings.provider = e.target.value;
                this.updateModelOptions();
                this.updateStatus();
            });
        }

        // Model selection
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                this.settings.model = e.target.value;
            });
        }

        // Detail level
        const detailLevel = document.getElementById('detail-level');
        if (detailLevel) {
            detailLevel.addEventListener('change', (e) => {
                this.settings.detailLevel = e.target.value;
            });
        }

        // Language
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => {
                this.settings.language = e.target.value;
            });
        }

        // Test API button
        const testApiBtn = document.getElementById('test-api-btn');
        if (testApiBtn) {
            testApiBtn.addEventListener('click', () => this.testApiConnection());
        }

        // Save button
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        // Full settings button
        const fullSettingsBtn = document.getElementById('full-settings-btn');
        if (fullSettingsBtn) {
            fullSettingsBtn.addEventListener('click', () => {
                chrome.tabs.create({
                    url: chrome.runtime.getURL('src/settings/settings.html')
                });
                window.close();
            });
        }
    }

    updateUI() {
        console.log('PopupManager: Updating UI with settings:', this.settings);

        // Update provider dropdown
        const providerSelect = document.getElementById('provider-select');
        if (providerSelect) {
            providerSelect.value = this.settings.provider;
            console.log('PopupManager: Set provider to:', this.settings.provider);
        } else {
            console.error('PopupManager: Provider select element not found');
        }

        // Update model options and selection
        this.updateModelOptions();

        // Update detail level
        const detailLevel = document.getElementById('detail-level');
        if (detailLevel) {
            detailLevel.value = this.settings.detailLevel;
            console.log('PopupManager: Set detail level to:', this.settings.detailLevel);
        } else {
            console.error('PopupManager: Detail level element not found');
        }

        // Update language
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.value = this.settings.language;
            console.log('PopupManager: Set language to:', this.settings.language);
        } else {
            console.error('PopupManager: Language select element not found');
        }
    }

    updateModelOptions() {
        console.log('PopupManager: Updating model options for provider:', this.settings.provider);
        const modelSelect = document.getElementById('model-select');
        if (!modelSelect) {
            console.error('PopupManager: Model select element not found');
            return;
        }

        // Clear existing options
        modelSelect.innerHTML = '';

        const provider = this.providers[this.settings.provider];
        const models = provider && provider.models ? provider.models : [];

        console.log('PopupManager: Found provider:', provider);
        console.log('PopupManager: Available models:', models);

        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });

        // Set current model or default to first
        if (models.some(m => m.id === this.settings.model)) {
            modelSelect.value = this.settings.model;
            console.log('PopupManager: Set model to existing:', this.settings.model);
        } else if (models.length > 0) {
            this.settings.model = models[0].id;
            modelSelect.value = this.settings.model;
            console.log('PopupManager: Set model to first available:', this.settings.model);
        } else {
            console.warn('PopupManager: No models available for provider:', this.settings.provider);
        }
    }

    updateStatus() {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        const apiStatusText = document.getElementById('api-status-text');
        const apiStatusSubtitle = document.getElementById('api-status-subtitle');

        const hasApiKey = this.settings.apiKeys && this.settings.apiKeys[this.settings.provider];

        if (hasApiKey) {
            statusDot.className = 'status-dot';
            statusText.textContent = 'Ready';
            apiStatusText.textContent = 'API Key Configured';
            apiStatusSubtitle.textContent = `${this.providers[this.settings.provider]?.name || 'Unknown'} - ${this.settings.model}`;
        } else {
            statusDot.className = 'status-dot warning';
            statusText.textContent = 'Setup Required';
            apiStatusText.textContent = 'API Key Missing';
            apiStatusSubtitle.textContent = `Please configure ${this.providers[this.settings.provider]?.name || 'Provider'} API key`;
        }
    }

    async testApiConnection() {
        const testBtn = document.getElementById('test-api-btn');
        const originalText = testBtn.textContent;

        // Check if API key exists
        const apiKey = this.settings.apiKeys && this.settings.apiKeys[this.settings.provider];
        if (!apiKey) {
            this.showMessage('Please configure API key first', 'warning');
            return;
        }

        // Update button state
        testBtn.textContent = 'Testing...';
        testBtn.className = 'test-btn testing';
        testBtn.disabled = true;

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'test-api-key',
                provider: this.settings.provider,
                apiKey: apiKey,
                model: this.settings.model
            });

            if (response && response.success && response.isValid) {
                testBtn.textContent = 'Success';
                testBtn.className = 'test-btn success';
                this.showMessage('API connection successful!', 'success');
            } else {
                testBtn.textContent = 'Failed';
                testBtn.className = 'test-btn error';
                this.showMessage('API test failed. Check your key.', 'error');
            }
        } catch (error) {
            console.error('API test error:', error);
            testBtn.textContent = 'Error';
            testBtn.className = 'test-btn error';
            this.showMessage('Error testing API connection', 'error');
        }

        // Reset button after 3 seconds
        setTimeout(() => {
            testBtn.textContent = originalText;
            testBtn.className = 'test-btn';
            testBtn.disabled = false;
        }, 3000);
    }

    async saveSettings() {
        const saveBtn = document.getElementById('save-btn');
        const originalText = saveBtn.textContent;

        try {
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;

            const response = await chrome.runtime.sendMessage({
                action: 'save-settings',
                settings: this.settings
            });

            if (response && response.success) {
                saveBtn.textContent = 'Saved!';
                this.showMessage('Settings saved successfully', 'success');
                this.updateStatus();
            } else {
                this.showMessage('Failed to save settings', 'error');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showMessage('Error saving settings', 'error');
        }

        // Reset button
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }, 2000);
    }

    showMessage(text, type = 'success') {
        const messageEl = document.getElementById('message');
        if (messageEl) {
            messageEl.textContent = text;
            messageEl.className = `message ${type}`;
            messageEl.style.display = 'block';

            // Auto-hide after 3 seconds
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 3000);
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});