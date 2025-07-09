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
                models: [
                    'grok-3-beta',
                    'grok-3-fast-beta',
                    'grok-3-mini-beta',
                    'grok-3-mini-fast-beta',
                    'grok-beta',
                    'grok-vision-beta',
                    'grok-vision-2',
                    'grok-2'
                ],
                endpoint: 'https://api.x.ai/v1/chat/completions'
            }
        };
    }

    async explainText(selectedText, context, settings, isSentence = null) {
        const provider = settings.provider || 'openai';
        const model = settings.model || this.providers[provider].models[0];
        const apiKey = settings.apiKeys && settings.apiKeys[provider];

        if (!apiKey) {
            throw new Error('API key not found for ' + provider + '. Please configure it in settings.');
        }

        const prompt = this.buildExplanationPrompt(selectedText, context, settings, isSentence);

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

    buildExplanationPrompt(selectedText, context, settings, isSentence = null) {
        const detailLevel = settings.detailLevel || 'medium';
        const language = settings.language || 'English';

        // Use passed sentence detection or fallback to our own detection
        const isTextSentence = isSentence !== null ? isSentence : this.isSentence(selectedText);

        const detailInstructions = {
            ultra_brief: 'Provide an ultra-concise explanation in exactly 1 sentence.',
            brief: 'Provide a concise explanation in 1-2 sentences.',
            medium: 'Provide a clear explanation in 2-3 sentences with key details.',
            detailed: 'Provide a comprehensive explanation with examples and context.'
        };

        if (isTextSentence) {
            // For sentences: ALWAYS prioritize translation first, then explain
            return `You are an intelligent text explainer specializing in sentence translation and explanation.

Selected sentence: "${selectedText}"

Context: "${context}"

CRITICAL INSTRUCTIONS:
1. **TRANSLATION FIRST**: Always start by translating the sentence to ${language}. If it's already in ${language}, write "Already in ${language}".
2. **THEN EXPLAIN IN ${language}**: After translation, provide a detailed explanation of the sentence in its context. THE EXPLANATION MUST BE WRITTEN IN ${language}.
3. ${detailInstructions[detailLevel]}
4. Focus on the meaning, cultural context, implications, and significance of the sentence
5. Explain any idioms, technical terms, or cultural references
6. Consider the tone, register, and style of the original sentence

Response Format (MANDATORY):
**Translation:** [Always provide translation or "Already in ${language}"]
**Explanation:** [Comprehensive explanation in ${language} considering context, meaning, and cultural aspects]

IMPORTANT: Both the translation AND explanation must be in ${language}. Do not use English for the explanation.`;
        } else {
            // For non-sentences: dictionary definition + explain in context
            return `You are an intelligent text explainer. Your task is to provide dictionary definitions and contextual explanations for words or phrases.

Selected text: "${selectedText}"

Context: "${context}"

Instructions:
1. First, provide a dictionary-style definition of the selected text
2. Then explain how it's used in the given context
3. Use ${language} language for ALL responses
4. ${detailInstructions[detailLevel]}
5. If it's a technical term, explain it in simple terms
6. If it has multiple meanings, focus on the most relevant one given the context

Format your response as:
**Definition:** [dictionary definition in ${language}]
**In Context:** [contextual explanation in ${language}]

IMPORTANT: Both the definition AND contextual explanation must be written in ${language}. Do not use English.`;
        }
    }

    buildGrammarAnalysisPrompt(selectedText, context, settings) {
        const language = settings.language || 'English';

        return `You are a grammar expert. Analyze the grammatical structure of the given sentence and provide a clear, educational breakdown.

Sentence: "${selectedText}"

Context: "${context}"

Instructions:
1. Identify the main grammatical components (subject, verb, object, etc.)
2. Break down the sentence structure step by step
3. Identify any special grammatical patterns, clauses, or constructions
4. Explain verb tenses, voice (active/passive), and mood if relevant
5. Point out any interesting grammatical features
6. Use ${language} language for explanations
7. Format as a structured analysis that's easy to understand

Provide a clear grammatical breakdown with labeled components and explanations.`;
    }

    buildExamplesPrompt(selectedText, context, settings) {
        // Example sentences should be in the learning language (detected from selected text)
        const detectedLanguage = this.detectTextLanguage(selectedText);
        const exampleLanguage = detectedLanguage || 'English';

        // Explanations should be in the user's interface language
        const explanationLanguage = settings.language || 'English';

        return `You are a language expert. Provide practical examples showing how the word or phrase is used in different contexts.

Selected text: "${selectedText}"

Context: "${context}"

CRITICAL INSTRUCTIONS:
1. Example sentences must be in ${exampleLanguage} (the learning language)
2. In each example sentence, put the word/phrase "${selectedText}" in **bold markdown** (use **word**)
3. Explanations must be in ${explanationLanguage} (the user's native language)

Guidelines:
1. Provide 4-6 practical examples of how this word/phrase is used
2. Show different meanings or contexts if applicable
3. Include both formal and informal usage examples
4. Make examples relevant and easy to understand
5. Each example should be a complete sentence in ${exampleLanguage}
6. Brief explanations should be in ${explanationLanguage}
7. Show variety in sentence structure and complexity

Format your response as:
**Examples:**

1. [Example sentence 1 in ${exampleLanguage} with **${selectedText}** highlighted] - [Brief explanation in ${explanationLanguage}]
2. [Example sentence 2 in ${exampleLanguage} with **${selectedText}** highlighted] - [Brief explanation in ${explanationLanguage}]
3. [Example sentence 3 in ${exampleLanguage} with **${selectedText}** highlighted] - [Brief explanation in ${explanationLanguage}]
4. [Example sentence 4 in ${exampleLanguage} with **${selectedText}** highlighted] - [Brief explanation in ${explanationLanguage}]
5. [Example sentence 5 in ${exampleLanguage} with **${selectedText}** highlighted] - [Brief explanation in ${explanationLanguage}]

**Usage Notes:** [Brief notes about common usage patterns in ${explanationLanguage}]

IMPORTANT:
- Example sentences: ${exampleLanguage}
- Explanations: ${explanationLanguage}
- Always highlight "${selectedText}" with **bold** in examples`;
    }

    async analyzeGrammar(selectedText, context, settings) {
        const provider = settings.provider || 'openai';
        const model = settings.model || this.providers[provider].models[0];
        const apiKey = settings.apiKeys && settings.apiKeys[provider];

        if (!apiKey) {
            throw new Error('API key not found for ' + provider + '. Please configure it in settings.');
        }

        const prompt = this.buildGrammarAnalysisPrompt(selectedText, context, settings);

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

    async generateExamples(selectedText, context, settings) {
        const provider = settings.provider || 'openai';
        const model = settings.model || this.providers[provider].models[0];
        const apiKey = settings.apiKeys && settings.apiKeys[provider];

        if (!apiKey) {
            throw new Error('API key not found for ' + provider + '. Please configure it in settings.');
        }

        const prompt = this.buildExamplesPrompt(selectedText, context, settings);

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

    async explainTextStream(selectedText, context, settings, onChunk, isSentence = null) {
        const provider = settings.provider || 'openai';
        const model = settings.model || this.providers[provider].models[0];
        const apiKey = settings.apiKeys && settings.apiKeys[provider];

        if (!apiKey) {
            throw new Error('API key not found for ' + provider + '. Please configure it in settings.');
        }

        const prompt = this.buildExplanationPrompt(selectedText, context, settings, isSentence);

        switch (provider) {
            case 'openai':
                return await this.callOpenAIStream(prompt, model, apiKey, onChunk);
            case 'anthropic':
                // Fallback to non-streaming for other providers
                return await this.simulateStreamingResponse(await this.callAnthropic(prompt, model, apiKey), onChunk);
            case 'gemini':
                return await this.simulateStreamingResponse(await this.callGemini(prompt, model, apiKey), onChunk);
            case 'xai':
                return await this.simulateStreamingResponse(await this.callXAI(prompt, model, apiKey), onChunk);
            default:
                throw new Error('Unsupported provider: ' + provider);
        }
    }

    async analyzeGrammarStream(selectedText, context, settings, onChunk) {
        const provider = settings.provider || 'openai';
        const model = settings.model || this.providers[provider].models[0];
        const apiKey = settings.apiKeys && settings.apiKeys[provider];

        if (!apiKey) {
            throw new Error('API key not found for ' + provider + '. Please configure it in settings.');
        }

        const prompt = this.buildGrammarAnalysisPrompt(selectedText, context, settings);

        switch (provider) {
            case 'openai':
                return await this.callOpenAIStream(prompt, model, apiKey, onChunk);
            case 'anthropic':
                return await this.simulateStreamingResponse(await this.callAnthropic(prompt, model, apiKey), onChunk);
            case 'gemini':
                return await this.simulateStreamingResponse(await this.callGemini(prompt, model, apiKey), onChunk);
            case 'xai':
                return await this.simulateStreamingResponse(await this.callXAI(prompt, model, apiKey), onChunk);
            default:
                throw new Error('Unsupported provider: ' + provider);
        }
    }

    async generateExamplesStream(selectedText, context, settings, onChunk) {
        const provider = settings.provider || 'openai';
        const model = settings.model || this.providers[provider].models[0];
        const apiKey = settings.apiKeys && settings.apiKeys[provider];

        if (!apiKey) {
            throw new Error('API key not found for ' + provider + '. Please configure it in settings.');
        }

        const prompt = this.buildExamplesPrompt(selectedText, context, settings);

        switch (provider) {
            case 'openai':
                return await this.callOpenAIStream(prompt, model, apiKey, onChunk);
            case 'anthropic':
                return await this.simulateStreamingResponse(await this.callAnthropic(prompt, model, apiKey), onChunk);
            case 'gemini':
                return await this.simulateStreamingResponse(await this.callGemini(prompt, model, apiKey), onChunk);
            case 'xai':
                return await this.simulateStreamingResponse(await this.callXAI(prompt, model, apiKey), onChunk);
            default:
                throw new Error('Unsupported provider: ' + provider);
        }
    }

    async simulateStreamingResponse(fullResponse, onChunk) {
        // Simulate streaming for providers that don't support it
        console.log('Simulating streaming for response length:', fullResponse.length);
        const words = fullResponse.split(/(\s+)/); // Keep whitespace in the split

        for (let i = 0; i < words.length; i++) {
            const chunk = words[i];
            if (chunk.trim()) {
                // Only log non-whitespace chunks
                console.log('Sending word chunk:', chunk);
            }
            onChunk(chunk);
            // Delay to make streaming visible but not too slow
            await new Promise(resolve => setTimeout(resolve, 80));
        }

        console.log('Streaming simulation complete');
        return fullResponse;
    }

    detectTextLanguage(text) {
        const trimmed = text.trim();

        // Check for common language patterns
        // Chinese/Japanese/Korean characters
        if (/[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(trimmed)) {
            if (/[\u4e00-\u9faf]/.test(trimmed)) return 'Chinese';
            if (/[\u3040-\u309f\u30a0-\u30ff]/.test(trimmed)) return 'Japanese';
            if (/[\uac00-\ud7af]/.test(trimmed)) return 'Korean';
        }

        // Arabic script
        if (/[\u0600-\u06ff]/.test(trimmed)) return 'Arabic';

        // Cyrillic script (Russian, etc.)
        if (/[\u0400-\u04ff]/.test(trimmed)) return 'Russian';

        // Greek script
        if (/[\u0370-\u03ff]/.test(trimmed)) return 'Greek';

        // Hebrew script
        if (/[\u0590-\u05ff]/.test(trimmed)) return 'Hebrew';

        // Thai script
        if (/[\u0e00-\u0e7f]/.test(trimmed)) return 'Thai';

        // For Latin scripts, check for common non-English patterns
        // Spanish indicators
        if (
            /[ñáéíóúü]/.test(trimmed.toLowerCase()) ||
            /\b(el|la|los|las|un|una|de|del|en|con|por|para|que|es|está|son|están|no|sí|muy|más|todo|todos|como)\b/.test(
                trimmed.toLowerCase()
            )
        ) {
            return 'Spanish';
        }

        // French indicators
        if (
            /[àâäéèêëïîôöùûüÿç]/.test(trimmed.toLowerCase()) ||
            /\b(le|la|les|un|une|de|du|des|et|ou|est|sont|dans|avec|pour|par|sur|ce|cette|ces|qui|que|dont|où)\b/.test(
                trimmed.toLowerCase()
            )
        ) {
            return 'French';
        }

        // German indicators
        if (
            /[äöüß]/.test(trimmed.toLowerCase()) ||
            /\b(der|die|das|ein|eine|und|oder|ist|sind|in|mit|für|von|zu|auf|an|bei|nach|über|unter|durch|zwischen)\b/.test(
                trimmed.toLowerCase()
            )
        ) {
            return 'German';
        }

        // Italian indicators
        if (
            /\b(il|la|lo|gli|le|un|una|di|da|in|con|su|per|tra|fra|che|chi|cui|dove|quando|come|perché|è|sono|ha|hanno|non|più|molto|tutto|tutti)\b/.test(
                trimmed.toLowerCase()
            )
        ) {
            return 'Italian';
        }

        // Portuguese indicators
        if (
            /[ãõç]/.test(trimmed.toLowerCase()) ||
            /\b(o|a|os|as|um|uma|de|da|do|das|dos|em|com|por|para|que|é|são|não|mais|muito|todo|todos|como)\b/.test(
                trimmed.toLowerCase()
            )
        ) {
            return 'Portuguese';
        }

        // Default to English for Latin script text
        return 'English';
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

    async callOpenAI(prompt, model, apiKey) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 800,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

            try {
                const error = await response.json();
                if (error.error && error.error.message) {
                    errorMessage = error.error.message;

                    // Provide more specific error messages for common issues
                    if (error.error.code === 'invalid_api_key') {
                        errorMessage = 'Invalid API key. Please check your OpenAI API key.';
                    } else if (error.error.code === 'insufficient_quota') {
                        errorMessage = 'API quota exceeded. Please check your OpenAI billing.';
                    } else if (error.error.code === 'model_not_found') {
                        errorMessage = `Model "${model}" not found. Please select a valid model.`;
                    }
                }
            } catch (e) {
                // If we can't parse the error response, use the HTTP status
            }

            throw new Error('OpenAI API error: ' + errorMessage);
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    }

    async callOpenAIStream(prompt, model, apiKey, onChunk) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 800,
                temperature: 0.7,
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error('OpenAI API error: ' + ((error.error && error.error.message) || 'Unknown error'));
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;

                            if (content) {
                                fullContent += content;
                                onChunk(content);
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return fullContent.trim();
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
                max_tokens: 800,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error('Anthropic API error: ' + ((error.error && error.error.message) || 'Unknown error'));
        }

        const data = await response.json();
        return data.content?.[0]?.text?.trim() || '';
    }

    async callGemini(prompt, model, apiKey) {
        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }]
                        }
                    ],
                    generationConfig: {
                        maxOutputTokens: 800,
                        temperature: 0.7
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error('Gemini API error: ' + ((error.error && error.error.message) || 'Unknown error'));
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.[0]?.text?.trim() || '';
    }

    async callXAI(prompt, model, apiKey) {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 800,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error('xAI API error: ' + ((error.error && error.error.message) || 'Unknown error'));
        }

        const data = await response.json();
        const message = data.choices?.[0]?.message;

        if (!message) {
            return '';
        }

        // xAI's Grok models sometimes put the actual response in reasoning_content instead of content
        // So we check reasoning_content first if content is empty
        if (!message.content && message.reasoning_content) {
            return message.reasoning_content.trim();
        }

        return message.content ? message.content.trim() : '';
    }

    async testApiKey(provider, apiKey, model) {
        if (!apiKey || apiKey.trim() === '') {
            throw new Error('Please enter an API key first');
        }

        if (!provider) {
            throw new Error('Provider not specified');
        }

        console.log(`Testing ${provider} API key with model: ${model}`);
        const testPrompt = 'Hello';

        try {
            switch (provider) {
                case 'openai':
                    await this.callOpenAI(testPrompt, model || 'gpt-4o-mini', apiKey);
                    break;
                case 'anthropic':
                    await this.callAnthropic(testPrompt, model || 'claude-3-5-haiku-20241022', apiKey);
                    break;
                case 'gemini':
                    await this.callGemini(testPrompt, model || 'gemini-1.5-flash', apiKey);
                    break;
                case 'xai':
                    await this.callXAI(testPrompt, model || 'grok-beta', apiKey);
                    break;
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
            console.log(`${provider} API key test successful`);
            return true;
        } catch (error) {
            console.error(`${provider} API key test failed:`, error.message);
            throw error; // Re-throw to let the caller handle the specific error message
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
            if (request.action === 'get-settings') {
                const settings = await this.settingsManager.getSettings();
                sendResponse({ success: true, settings });
            } else if (request.action === 'save-settings') {
                await this.settingsManager.saveSettings(request.settings);
                sendResponse({ success: true });
            } else if (request.action === 'explain-text') {
                const explanation = await this.aiService.explainText(
                    request.text,
                    request.context,
                    request.settings,
                    request.isSentence
                );
                sendResponse({ success: true, explanation });
            } else if (request.action === 'explain-text-stream') {
                // Handle streaming explanation
                this.handleStreamingRequest(request, sender, 'explain');
                sendResponse({ success: true, streaming: true });
            } else if (request.action === 'analyze-grammar') {
                const analysis = await this.aiService.analyzeGrammar(request.text, request.context, request.settings);
                sendResponse({ success: true, analysis });
            } else if (request.action === 'analyze-grammar-stream') {
                // Handle streaming grammar analysis
                this.handleStreamingRequest(request, sender, 'grammar');
                sendResponse({ success: true, streaming: true });
            } else if (request.action === 'generate-examples') {
                const examples = await this.aiService.generateExamples(request.text, request.context, request.settings);
                sendResponse({ success: true, examples });
            } else if (request.action === 'generate-examples-stream') {
                // Handle streaming examples generation
                this.handleStreamingRequest(request, sender, 'examples');
                sendResponse({ success: true, streaming: true });
            } else if (request.action === 'test-api-key') {
                const isValid = await this.aiService.testApiKey(request.provider, request.apiKey, request.model);
                sendResponse({ success: true, isValid });
            } else if (request.action === 'get-providers') {
                const providers = this.aiService.getAvailableProviders();
                sendResponse({ success: true, providers });
            } else if (request.action === 'open-settings') {
                chrome.tabs.create({
                    url: chrome.runtime.getURL('src/settings/settings.html')
                });
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async handleStreamingRequest(request, sender, type) {
        const streamId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log(`Starting streaming request for type: ${type}, text: "${request.text}"`);

        try {
            const onChunk = chunk => {
                console.log(`Sending ${type} chunk:`, chunk);
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'stream-chunk',
                    streamId: streamId,
                    chunk: chunk,
                    type: type
                });
            };

            let result;
            if (type === 'explain') {
                result = await this.aiService.explainTextStream(
                    request.text,
                    request.context,
                    request.settings,
                    onChunk,
                    request.isSentence
                );
            } else if (type === 'grammar') {
                console.log('Starting grammar analysis stream');
                result = await this.aiService.analyzeGrammarStream(
                    request.text,
                    request.context,
                    request.settings,
                    onChunk
                );
                console.log('Grammar analysis stream completed, result length:', result.length);
            } else if (type === 'examples') {
                console.log('Starting examples generation stream');
                result = await this.aiService.generateExamplesStream(
                    request.text,
                    request.context,
                    request.settings,
                    onChunk
                );
                console.log('Examples generation stream completed, result length:', result.length);
            }

            // Send completion message
            console.log(`Sending ${type} completion message`);
            chrome.tabs.sendMessage(sender.tab.id, {
                action: 'stream-complete',
                streamId: streamId,
                result: result,
                type: type
            });
        } catch (error) {
            console.error('Streaming error:', error);
            chrome.tabs.sendMessage(sender.tab.id, {
                action: 'stream-error',
                streamId: streamId,
                error: error.message,
                type: type
            });
        }
    }
}

// Initialize the background service
new BackgroundService();
