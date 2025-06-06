// Popup JavaScript for AI Text Explainer
class PopupManager {
    constructor() {
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateStatus();
    }

    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'get-settings' });
            if (response && response.success) {
                this.settings = response.settings;
                this.updateDisplay();
            } else {
                this.showError('Failed to load settings');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showError('Error loading settings');
        }
    }

    updateDisplay() {
        // Update provider display
        const providerElement = document.getElementById('current-provider');
        if (providerElement) {
            const providerName = this.getProviderDisplayName(this.settings.provider);
            providerElement.textContent = providerName;
            providerElement.className = 'status-value';
        }

        // Update model display
        const modelElement = document.getElementById('current-model');
        if (modelElement) {
            modelElement.textContent = this.settings.model || 'Not set';
            modelElement.className = 'status-value';
        }
    }

    getProviderDisplayName(provider) {
        const providers = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic Claude',
            'gemini': 'Google Gemini'
        };
        return providers[provider] || 'Unknown';
    }

    setupEventListeners() {
        // Settings button
        const settingsBtn = document.getElementById('open-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                chrome.tabs.create({
                    url: chrome.runtime.getURL('src/settings/settings.html')
                });
                window.close();
            });
        }

        // Test API button
        const testApiBtn = document.getElementById('test-api');
        if (testApiBtn) {
            testApiBtn.addEventListener('click', () => this.testApiConnection());
        }

        // Footer links
        const privacyLink = document.getElementById('privacy-link');
        if (privacyLink) {
            privacyLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showPrivacyInfo();
            });
        }

        const helpLink = document.getElementById('help-link');
        if (helpLink) {
            helpLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showHelp();
            });
        }

        const feedbackLink = document.getElementById('feedback-link');
        if (feedbackLink) {
            feedbackLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showFeedback();
            });
        }
    }

    async testApiConnection() {
        const testBtn = document.getElementById('test-api');
        const originalText = testBtn.textContent;

        // Update button state
        testBtn.textContent = '🔄 Testing...';
        testBtn.disabled = true;

        try {
            const apiKey = this.settings.apiKeys && this.settings.apiKeys[this.settings.provider];

            const response = await chrome.runtime.sendMessage({
                action: 'test-api-key',
                provider: this.settings.provider,
                apiKey: apiKey,
                model: this.settings.model
            });

            if (response && response.success && response.isValid) {
                this.showSuccess('✅ API connection successful!');
                testBtn.textContent = '✅ Success';
                setTimeout(() => {
                    testBtn.textContent = originalText;
                    testBtn.disabled = false;
                }, 2000);
            } else {
                this.showError('❌ API test failed. Check your settings.');
                testBtn.textContent = '❌ Failed';
                setTimeout(() => {
                    testBtn.textContent = originalText;
                    testBtn.disabled = false;
                }, 2000);
            }
        } catch (error) {
            console.error('API test error:', error);
            this.showError('Error testing API connection');
            testBtn.textContent = originalText;
            testBtn.disabled = false;
        }
    }

    updateStatus() {
        const statusElement = document.getElementById('extension-status');
        if (statusElement) {
            // Check if API key is configured
            const hasApiKey = this.settings && this.settings.apiKeys && this.settings.apiKeys[this.settings.provider];

            if (hasApiKey) {
                statusElement.textContent = 'Ready';
                statusElement.className = 'status-value success';
            } else {
                statusElement.textContent = 'Setup Required';
                statusElement.className = 'status-value error';
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
        // Create or update message element
        let messageEl = document.querySelector('.popup-message');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.className = 'popup-message';
            const content = document.querySelector('.popup-content');
            content.insertBefore(messageEl, content.firstChild);
        }

        messageEl.textContent = message;
        messageEl.className = 'popup-message ' + type;

        // Add styles if not already added
        if (!document.querySelector('#popup-message-styles')) {
            const style = document.createElement('style');
            style.id = 'popup-message-styles';
            style.textContent = '.popup-message { padding: 12px; border-radius: 6px; margin-bottom: 16px; font-size: 14px; font-weight: 500; text-align: center; } .popup-message.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; } .popup-message.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; } @media (prefers-color-scheme: dark) { .popup-message.success { background: #1e3d23; color: #4ade80; border-color: #2d5a32; } .popup-message.error { background: #3d1e23; color: #f87171; border-color: #5a2d32; } }';
            document.head.appendChild(style);
        }

        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (messageEl) {
                messageEl.remove();
            }
        }, 3000);
    }

    showPrivacyInfo() {
        const modal = this.createModal('Privacy Information', '<p><strong>AI Text Explainer Privacy Policy</strong></p><ul><li>Your API keys are stored locally in your browser only</li><li>Selected text is sent to your chosen AI provider for explanation</li><li>We do not store or log your text selections</li><li>No personal data is collected by this extension</li><li>You can delete all data by removing the extension</li></ul><p><small>Last updated: ' + new Date().toDateString() + '</small></p>');
        document.body.appendChild(modal);
    }

    showHelp() {
        const modal = this.createModal('Help & FAQ', '<p><strong>How to get started:</strong></p><ol><li>Click "Settings" to configure an AI provider</li><li>Add your API key for OpenAI, Anthropic, or Google Gemini</li><li>Select any text on a webpage</li><li>Click the "🤖 Explain" button that appears</li></ol><p><strong>Troubleshooting:</strong></p><ul><li>If explanations don\'t work, check your API key in settings</li><li>Make sure you have sufficient API credits</li><li>Try switching to a different AI model</li><li>Check your internet connection</li></ul><p><strong>Need more help?</strong> Contact support through the feedback option.</p>');
        document.body.appendChild(modal);
    }

    showFeedback() {
        const modal = this.createModal('Feedback', '<p>We\'d love to hear from you! Help us improve AI Text Explainer:</p><div style="margin: 16px 0;"><p><strong>Ways to provide feedback:</strong></p><ul><li>Report bugs or request features</li><li>Share your experience</li><li>Suggest new AI providers</li><li>Recommend improvements</li></ul></div><p><strong>Contact:</strong></p><p>📧 Email: support@aitextexplainer.com</p><p>🐛 GitHub: github.com/aitextexplainer</p><p><small>Thank you for using AI Text Explainer!</small></p>');
        document.body.appendChild(modal);
    }

    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = '<div class="modal-content"><div class="modal-header"><h3>' + title + '</h3><button class="modal-close">×</button></div><div class="modal-body">' + content + '</div></div>';

        // Add modal styles
        if (!document.querySelector('#modal-styles')) {
            const style = document.createElement('style');
            style.id = 'modal-styles';
            style.textContent = '.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; } .modal-content { background: white; border-radius: 8px; max-width: 90%; max-height: 80%; overflow-y: auto; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); } .modal-header { padding: 16px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; justify-content: space-between; align-items: center; } .modal-header h3 { margin: 0; font-size: 16px; } .modal-close { background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 4px; border-radius: 4px; } .modal-close:hover { background: rgba(255, 255, 255, 0.1); } .modal-body { padding: 20px; font-size: 14px; line-height: 1.5; } .modal-body ul, .modal-body ol { padding-left: 20px; margin: 12px 0; } .modal-body li { margin-bottom: 6px; } @media (prefers-color-scheme: dark) { .modal-content { background: #2d2d2d; color: #e1e1e1; } }';
            document.head.appendChild(style);
        }

        // Add close functionality
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => modal.remove());

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        return modal;
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});