// Settings page JavaScript for AI Text Explainer
class SettingsManager {
    constructor() {
        this.settings = {
            provider: 'openai',
            model: 'gpt-4',
            apiKeys: {},
            detailLevel: 'medium',
            language: 'English',
            theme: 'auto',
            contextLength: 1000,
            responseLength: 300
        };
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateModelOptions();
        this.updateUI();
    }

    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'get-settings' });
            if (response && response.success) {
                this.settings = Object.assign(this.settings, response.settings);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    async saveSettings() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'save-settings',
                settings: this.settings
            });

            if (response && response.success) {
                this.showMessage('Settings saved successfully', 'success');
            } else {
                this.showMessage('Failed to save settings', 'error');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showMessage('Error saving settings', 'error');
        }
    }

    setupEventListeners() {
        // Provider dropdown
        const providerSelect = document.getElementById('provider-select');
        if (providerSelect) {
            providerSelect.addEventListener('change', (e) => {
                this.settings.provider = e.target.value;
                this.updateModelOptions();
                this.updateApiKeySection();
                this.saveSettings();
            });
        }

        // Model dropdown
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                this.settings.model = e.target.value;
                this.saveSettings();
            });
        }

        // API key inputs
        this.setupApiKeyInputs();

        // Other settings
        this.setupOtherSettings();

        // Test API buttons (for each provider)
        const testButtons = document.querySelectorAll('.test-key');
        testButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const provider = btn.getAttribute('data-provider');
                this.testApiKey(provider);
            });
        });

        // Save button
        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        // Reset button
        const resetBtn = document.getElementById('reset-settings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }

        // API tabs
        const apiTabs = document.querySelectorAll('.api-tab');
        apiTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const provider = tab.getAttribute('data-provider');
                this.switchApiTab(provider);
            });
        });

        // Clear all data button
        const clearBtn = document.getElementById('clear-all-data');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAllData());
        }

        // Toggle visibility buttons
        const toggleButtons = document.querySelectorAll('.toggle-visibility');
        toggleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const targetInput = document.getElementById(targetId);
                if (targetInput) {
                    if (targetInput.type === 'password') {
                        targetInput.type = 'text';
                        btn.textContent = '🙈';
                    } else {
                        targetInput.type = 'password';
                        btn.textContent = '👁️';
                    }
                }
            });
        });
    }

    setupApiKeyInputs() {
        const providers = ['openai', 'anthropic', 'gemini', 'xai'];

        providers.forEach(provider => {
            const input = document.getElementById(provider + '-key');
            if (input) {
                input.addEventListener('input', (e) => {
                    if (!this.settings.apiKeys) {
                        this.settings.apiKeys = {};
                    }
                    this.settings.apiKeys[provider] = e.target.value.trim();
                });

                input.addEventListener('blur', () => {
                    this.saveSettings();
                });
            }
        });
    }

    setupOtherSettings() {
        // Detail level
        const detailLevel = document.getElementById('detail-level');
        if (detailLevel) {
            detailLevel.addEventListener('change', (e) => {
                this.settings.detailLevel = e.target.value;
                this.saveSettings();
            });
        }

        // Language
        const language = document.getElementById('language-select');
        if (language) {
            language.addEventListener('change', (e) => {
                this.settings.language = e.target.value;
                this.saveSettings();
            });
        }

        // Theme
        const theme = document.getElementById('theme-select');
        if (theme) {
            theme.addEventListener('change', (e) => {
                this.settings.theme = e.target.value;
                this.applyTheme(e.target.value);
                this.saveSettings();
            });
        }

        // Context length
        const contextLength = document.getElementById('context-length');
        if (contextLength) {
            contextLength.addEventListener('input', (e) => {
                this.settings.contextLength = parseInt(e.target.value);
                this.updateContextLengthDisplay();
            });

            contextLength.addEventListener('change', () => {
                this.saveSettings();
            });
        }

        // Response length
        const responseLength = document.getElementById('response-length');
        if (responseLength) {
            responseLength.addEventListener('input', (e) => {
                this.settings.responseLength = parseInt(e.target.value);
                this.updateResponseLengthDisplay();
            });

            responseLength.addEventListener('change', () => {
                this.saveSettings();
            });
        }
    }

    updateModelOptions() {
        const modelSelect = document.getElementById('model-select');
        if (!modelSelect) return;

        // Clear existing options
        modelSelect.innerHTML = '';

        const models = this.getModelsForProvider(this.settings.provider);

        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });

        // Set current model or default
        if (models.some(m => m.id === this.settings.model)) {
            modelSelect.value = this.settings.model;
        } else {
            this.settings.model = models[0].id;
            modelSelect.value = this.settings.model;
        }
    }

    getModelsForProvider(provider) {
        const modelOptions = {
            openai: [
                { id: 'gpt-4o', name: 'GPT-4o ($5/$15 per 1M tokens) - Latest multimodal' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini ($0.15/$0.60 per 1M tokens) - Fast & economical' },
                { id: 'o1', name: 'o1 ($15/$60 per 1M tokens) - Advanced reasoning' },
                { id: 'o1-mini', name: 'o1-mini ($3/$12 per 1M tokens) - Fast reasoning' },
                { id: 'gpt-4-turbo', name: 'GPT-4 Turbo ($10/$30 per 1M tokens) - High capability' },
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo ($0.50/$1.50 per 1M tokens) - Most economical' }
            ],
            anthropic: [
                { id: 'claude-opus-4-20250514', name: 'Claude Opus 4 ($15/$75 per 1M tokens) - Most capable' },
                { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 ($3/$15 per 1M tokens) - High performance' },
                { id: 'claude-3-7-sonnet-20250219', name: 'Claude Sonnet 3.7 ($3/$15 per 1M tokens) - Extended thinking' },
                { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet ($3/$15 per 1M tokens) - Balanced' },
                { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku ($0.80/$4 per 1M tokens) - Fastest' },
                { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus ($15/$75 per 1M tokens) - Legacy powerful' },
                { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku ($0.25/$1.25 per 1M tokens) - Most economical' }
            ],
            gemini: [
                { id: 'gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash ($0.15/$0.60 per 1M tokens) - Latest hybrid reasoning' },
                { id: 'gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro ($1.25/$10 per 1M tokens) - Most advanced thinking' },
                { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash ($0.10/$0.40 per 1M tokens) - Multimodal agent-ready' },
                { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite ($0.075/$0.30 per 1M tokens) - Cost efficient' },
                { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro ($1.25/$5 per 1M tokens) - Large context' },
                { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash ($0.075/$0.30 per 1M tokens) - Fast & versatile' },
                { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B ($0.0375/$0.15 per 1M tokens) - Most economical' }
            ],
            xai: [
                { id: 'grok-3-beta', name: 'Grok 3 Beta (Pricing TBA) - Most advanced with Think mode & 1M context' },
                { id: 'grok-3-fast-beta', name: 'Grok 3 Fast Beta ($5/$25 per 1M tokens) - Fast response version' },
                { id: 'grok-3-mini-beta', name: 'Grok 3 Mini Beta ($0.30/$0.50 per 1M tokens) - Cost-efficient reasoning' },
                { id: 'grok-3-mini-fast-beta', name: 'Grok 3 Mini Fast Beta ($0.60/$4 per 1M tokens) - Fast mini version' },
                { id: 'grok-beta', name: 'Grok Beta ($5/$15 per 1M tokens) - Comparable to Grok 2 with efficiency' },
                { id: 'grok-vision-beta', name: 'Grok Vision Beta (Pricing TBA) - Vision capabilities for images' },
                { id: 'grok-vision-2', name: 'Grok Vision 2 (Pricing TBA) - Enhanced vision processing' },
                { id: 'grok-2', name: 'Grok 2 ($2/$10 per 1M tokens) - Previous generation model' }
            ]
        };

        return modelOptions[provider] || [];
    }

    updateUI() {
        // Update provider dropdown
        const providerSelect = document.getElementById('provider-select');
        if (providerSelect) {
            providerSelect.value = this.settings.provider;
        }

        // Update model dropdown
        this.updateModelOptions();

        // Update API key inputs
        const providers = ['openai', 'anthropic', 'gemini', 'xai'];
        providers.forEach(provider => {
            const input = document.getElementById(provider + '-key');
            if (input && this.settings.apiKeys && this.settings.apiKeys[provider]) {
                input.value = this.settings.apiKeys[provider];
            }
        });

        // Update other settings
        const detailLevel = document.getElementById('detail-level');
        if (detailLevel) {
            detailLevel.value = this.settings.detailLevel;
        }

        const language = document.getElementById('language-select');
        if (language) {
            language.value = this.settings.language;
        }

        const theme = document.getElementById('theme-select');
        if (theme) {
            theme.value = this.settings.theme;
            this.applyTheme(this.settings.theme);
        }

        const contextLength = document.getElementById('context-length');
        if (contextLength) {
            contextLength.value = this.settings.contextLength;
            this.updateContextLengthDisplay();
        }

        const responseLength = document.getElementById('response-length');
        if (responseLength) {
            responseLength.value = this.settings.responseLength;
            this.updateResponseLengthDisplay();
        }

        // Update API key section
        this.updateApiKeySection();
    }

    updateApiKeySection() {
        // Switch to the active provider's tab
        this.switchApiTab(this.settings.provider);
    }

    updateContextLengthDisplay() {
        const display = document.getElementById('context-length-display');
        if (display) {
            display.textContent = this.settings.contextLength + ' characters';
        }
    }

    updateResponseLengthDisplay() {
        const display = document.getElementById('response-length-display');
        if (display) {
            display.textContent = this.settings.responseLength + ' characters';
        }
    }

    async testApiKey(provider) {
        const testBtn = document.querySelector(`[data-provider="${provider}"].test-key`);
        if (!testBtn) return;

        const originalText = testBtn.textContent;
        testBtn.textContent = '🔄 Testing...';
        testBtn.disabled = true;

        try {
            const apiKey = this.settings.apiKeys && this.settings.apiKeys[provider];
            if (!apiKey) {
                this.showMessage('Please enter an API key first', 'error');
                testBtn.textContent = originalText;
                testBtn.disabled = false;
                return;
            }

            const response = await chrome.runtime.sendMessage({
                action: 'test-api-key',
                provider: provider,
                apiKey: apiKey,
                model: this.settings.model
            });

            if (response && response.success && response.isValid) {
                this.showMessage(`✅ ${provider.toUpperCase()} API connection successful!`, 'success');
                testBtn.textContent = '✅ Success';
                testBtn.className = 'btn btn-outline success';
            } else {
                this.showMessage(`❌ ${provider.toUpperCase()} API test failed. Please check your API key.`, 'error');
                testBtn.textContent = '❌ Failed';
                testBtn.className = 'btn btn-outline danger';
            }
        } catch (error) {
            console.error('API test error:', error);
            this.showMessage('Error testing API connection', 'error');
            testBtn.textContent = '❌ Error';
            testBtn.className = 'btn btn-outline danger';
        }

        // Reset button after 3 seconds
        setTimeout(() => {
            testBtn.textContent = originalText;
            testBtn.className = 'btn btn-outline';
            testBtn.disabled = false;
        }, 3000);
    }

    switchApiTab(provider) {
        // Update tabs
        document.querySelectorAll('.api-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-provider="${provider}"].api-tab`).classList.add('active');

        // Update panels
        document.querySelectorAll('.api-key-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.querySelector(`[data-provider="${provider}"].api-key-panel`).classList.add('active');
    }

    clearAllData() {
        if (confirm('Are you sure you want to clear all extension data? This will remove all settings and API keys permanently.')) {
            chrome.storage.local.clear(() => {
                this.showMessage('All extension data cleared', 'success');
                // Reset to defaults
                this.settings = {
                    provider: 'openai',
                    model: 'gpt-4',
                    apiKeys: {},
                    detailLevel: 'medium',
                    language: 'English',
                    theme: 'auto',
                    contextLength: 1000,
                    responseLength: 300
                };
                this.updateUI();
            });
        }
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    showMessage(message, type) {
        // Remove existing messages
        document.querySelectorAll('.settings-message').forEach(el => el.remove());

        const messageEl = document.createElement('div');
        messageEl.className = 'settings-message ' + type;
        messageEl.textContent = message;

        const container = document.querySelector('.settings-container');
        if (container) {
            container.insertBefore(messageEl, container.firstChild);
        }

        // Auto-hide after 4 seconds
        setTimeout(() => {
            messageEl.remove();
        }, 4000);
    }

    async resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults? This will clear all your API keys.')) {
            this.settings = {
                provider: 'openai',
                model: 'gpt-4',
                apiKeys: {},
                detailLevel: 'medium',
                language: 'English',
                theme: 'auto',
                contextLength: 1000,
                responseLength: 300
            };

            await this.saveSettings();
            this.updateUI();
            this.showMessage('Settings reset to defaults', 'success');
        }
    }
}

// Initialize settings when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});