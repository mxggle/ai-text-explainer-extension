// Background service worker for AI Text Explainer

// Settings Manager class
class SettingsManager {
    constructor() {
        this.defaultSettings = {
            provider: 'openai',
            model: 'gpt-4o-mini',
            detailLevel: 'medium',
            language: 'English',
            theme: 'auto',
            showShortcut: true,
            apiKeys: {}
        };
    }

    async getSettings() {
        try {
            const result = await chrome.storage.sync.get(['aiTextExplainerSettings']);
            return {
                ...this.defaultSettings,
                ...result.aiTextExplainerSettings
            };
        } catch (error) {
            console.error('Error loading settings:', error);
            return this.defaultSettings;
        }
    }

    async saveSettings(settings) {
        try {
            await chrome.storage.sync.set({
                aiTextExplainerSettings: {
                    ...this.defaultSettings,
                    ...settings
                }
            });
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }
}

// AI Service class
class AIService {
    constructor() {
        this.providers = {
            openai: {
                name: 'OpenAI',
                models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
                endpoint: 'https://api.openai.com/v1/chat/completions'
            },
            anthropic: {
                name: 'Anthropic',
                models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
                endpoint: 'https://api.anthropic.com/v1/messages'
            },
            gemini: {
                name: 'Google Gemini',
                models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
                endpoint: 'https://generativelanguage.googleapis.com/v1beta/models'
            },
            xai: {
                name: 'xAI',
                models: ['grok-3-beta', 'grok-3-fast-beta', 'grok-3-mini-beta', 'grok-3-mini-fast-beta', 'grok-beta', 'grok-vision-beta', 'grok-vision-2', 'grok-2'],
                endpoint: 'https://api.x.ai/v1/chat/completions'
            }
        };
    }

    async explainText(selectedText, context, settings) {
        const provider = settings.provider || 'openai';
        const model = settings.model || this.providers[provider].models[0];
        const apiKey = settings.apiKeys && settings.apiKeys[provider];

        if (!apiKey) {
            throw new Error('API key not found for ' + provider + '. Please configure it in settings.');
        }

        const prompt = this.buildExplanationPrompt(selectedText, context, settings);

        switch (provider) {
            case 'openai':
                return await this.callOpenAI(prompt, model, apiKey);
            case 'anthropic':
                return await this.callAnthropic(prompt, model, apiKey);
            case 'gemini':
                return await this.callGemini(prompt, model, apiKey);
            case 'xai':
                return await this.callXAI(prompt, model, apiKey);
            default:
                throw new Error('Unsupported provider: ' + provider);
        }
    }

    buildExplanationPrompt(selectedText, context, settings) {
        const detailLevel = settings.detailLevel || 'medium';
        const language = settings.language || 'English';
        const isSentence = this.isSentence(selectedText);

        const detailInstructions = {
            ultra_brief: 'Provide an ultra-concise explanation in exactly 1 sentence.',
            brief: 'Provide a concise explanation in 1-2 sentences.',
            medium: 'Provide a clear explanation in 2-3 sentences with key details.',
            detailed: 'Provide a comprehensive explanation with examples and context.'
        };

        if (isSentence) {
            // For sentences: translate + explain in context
            return `You are an intelligent text explainer. Your task is to translate and explain sentences based on their context.

Selected sentence: "${selectedText}"

Context: "${context}"

Instructions:
1. First, if the sentence is not in ${language}, translate it to ${language}. If it's already in ${language}, skip translation.
2. Then explain the sentence considering its context
3. ${detailInstructions[detailLevel]}
4. Focus on the meaning, significance, or implications of the sentence
5. If it contains technical terms or cultural references, explain them

Format your response as:
**Translation:** [translation if needed, or "Already in ${language}"]
**Explanation:** [your explanation]

Provide only the translation and explanation, no additional formatting or prefixes.`;
        } else {
            // For non-sentences: dictionary definition + explain in context
            return `You are an intelligent text explainer. Your task is to provide dictionary definitions and contextual explanations for words or phrases.

Selected text: "${selectedText}"

Context: "${context}"

Instructions:
1. First, provide a dictionary-style definition of the selected text
2. Then explain how it's used in the given context
3. Use ${language} language
4. ${detailInstructions[detailLevel]}
5. If it's a technical term, explain it in simple terms
6. If it has multiple meanings, focus on the most relevant one given the context

Format your response as:
**Definition:** [dictionary definition]
**In Context:** [contextual explanation]

Provide only the definition and contextual explanation, no additional formatting or prefixes.`;
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
        // This is a simple check - could be improved with more sophisticated NLP
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

    async callOpenAI(prompt, model, apiKey) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 300,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error('OpenAI API error: ' + (error.error && error.error.message || 'Unknown error'));
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    }

    async callAnthropic(prompt, model, apiKey) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 300,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error('Anthropic API error: ' + (error.error && error.error.message || 'Unknown error'));
        }

        const data = await response.json();
        return data.content[0].text.trim();
    }

    async callGemini(prompt, model, apiKey) {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    maxOutputTokens: 300,
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error('Gemini API error: ' + (error.error && error.error.message || 'Unknown error'));
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    }

    async callXAI(prompt, model, apiKey) {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 300,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error('xAI API error: ' + (error.error && error.error.message || 'Unknown error'));
        }

        const data = await response.json();
        const message = data.choices[0].message;

        // xAI's Grok models sometimes put the actual response in reasoning_content instead of content
        // So we check reasoning_content first if content is empty
        if (!message.content && message.reasoning_content) {
            return message.reasoning_content.trim();
        }

        return message.content ? message.content.trim() : '';
    }

    async testApiKey(provider, apiKey, model) {
        try {
            const testPrompt = 'Test connection';

            switch (provider) {
                case 'openai':
                    await this.callOpenAI(testPrompt, model, apiKey);
                    break;
                case 'anthropic':
                    await this.callAnthropic(testPrompt, model, apiKey);
                    break;
                case 'gemini':
                    await this.callGemini(testPrompt, model, apiKey);
                    break;
                case 'xai':
                    await this.callXAI(testPrompt, model, apiKey);
                    break;
                default:
                    return false;
            }
            return true;
        } catch (error) {
            console.error('API key test failed:', error);
            return false;
        }
    }

    getAvailableProviders() {
        return this.providers;
    }
}

// Background Service class
class BackgroundService {
    constructor() {
        this.aiService = new AIService();
        this.settingsManager = new SettingsManager();
        this.init();
    }

    init() {
        // Set up context menu
        chrome.runtime.onInstalled.addListener(() => {
            this.createContextMenu();
        });

        // Handle messages from content scripts
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Will respond asynchronously
        });
    }

    createContextMenu() {
        chrome.contextMenus.create({
            id: 'explain-text',
            title: 'Explain selected text',
            contexts: ['selection']
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
            if (info.menuItemId === 'explain-text') {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'explain-selection',
                    text: info.selectionText
                });
            }
        });
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'explain-text':
                    const explanation = await this.aiService.explainText(
                        request.text,
                        request.context,
                        request.settings
                    );
                    sendResponse({ success: true, explanation: explanation });
                    break;

                case 'get-settings':
                    const settings = await this.settingsManager.getSettings();
                    sendResponse({ success: true, settings: settings });
                    break;

                case 'save-settings':
                    await this.settingsManager.saveSettings(request.settings);
                    sendResponse({ success: true });
                    break;

                case 'test-api-key':
                    const isValid = await this.aiService.testApiKey(
                        request.provider,
                        request.apiKey,
                        request.model
                    );
                    sendResponse({ success: true, isValid: isValid });
                    break;

                case 'open-settings':
                    chrome.tabs.create({
                        url: chrome.runtime.getURL('src/settings/settings.html')
                    });
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
}

// Initialize the background service
new BackgroundService();