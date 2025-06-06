# 🤖 AI Text Explainer Chrome Extension

A powerful Chrome extension that provides instant AI-powered explanations for any text you select on webpages. Simply select text and get contextual explanations using state-of-the-art AI models from OpenAI, Anthropic, or Google Gemini.

## ✨ Features

### 🎯 Core Functionality
- **Instant Text Explanations**: Select any text on any webpage to get AI-powered explanations
- **Context-Aware Analysis**: Uses surrounding paragraph context for more accurate explanations
- **Multiple AI Providers**: Support for OpenAI GPT, Anthropic Claude, and Google Gemini
- **Floating Button Interface**: Clean, non-intrusive UI that appears on text selection

### 🔧 Advanced Configuration
- **Multiple AI Models**: Choose from various models within each provider
- **Customizable Detail Levels**: Brief, medium, or detailed explanations
- **Multi-Language Support**: Get explanations in 12+ languages
- **Theme Support**: Light, dark, and auto themes following system preferences

### 🛡️ Privacy & Security
- **Local Storage**: API keys stored securely in your browser only
- **No Data Collection**: Zero tracking or analytics
- **Direct API Communication**: Your text goes directly to your chosen AI provider
- **Transparent Privacy**: Full control over your data

## 🚀 Installation

### Method 1: From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store
2. Search for "AI Text Explainer"
3. Click "Add to Chrome"

### Method 2: Developer Mode Installation
1. **Download or Clone**: Get the extension files
   ```bash
   git clone https://github.com/your-username/ai-text-explainer-extension.git
   ```

2. **Open Chrome Extensions**: Navigate to `chrome://extensions/`

3. **Enable Developer Mode**: Toggle the "Developer mode" switch in the top right

4. **Load Extension**: Click "Load unpacked" and select the extension folder

5. **Configure Settings**: Click the extension icon and go to Settings to add your API keys

## ⚙️ Setup & Configuration

### 1. Get API Keys

Choose one or more AI providers and obtain API keys:

#### OpenAI
- Visit [OpenAI Platform](https://platform.openai.com/api-keys)
- Create an account or sign in
- Generate a new API key
- Copy the key (starts with `sk-`)

#### Anthropic Claude
- Visit [Anthropic Console](https://console.anthropic.com/)
- Create an account or sign in
- Generate an API key
- Copy the key (starts with `sk-ant-`)

#### Google Gemini
- Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
- Create or select a Google Cloud project
- Generate an API key
- Copy the key (starts with `AIza`)

### 2. Configure the Extension

1. **Open Settings**: Click the extension icon → Settings
2. **Select Provider**: Choose your preferred AI provider
3. **Add API Key**: Enter your API key in the corresponding tab
4. **Test Connection**: Click "Test" to verify your API key works
5. **Customize Preferences**: 
   - Set explanation detail level
   - Choose language
   - Select theme
   - Configure advanced options

## 📖 Usage Guide

### Basic Usage
1. **Select Text**: Highlight any text on a webpage
2. **Click Explain**: Click the "🤖 Explain" button that appears
3. **View Explanation**: Read the AI-generated explanation in the popup dialog

### Alternative Methods
- **Right-Click Menu**: Right-click selected text → "Explain selected text"
- **Keyboard Shortcut**: Press `Esc` to close explanation dialogs

### Tips for Better Explanations
- **Select Complete Phrases**: Highlight complete words or sentences
- **Include Context**: The extension automatically uses surrounding text for context
- **Try Different Models**: Experiment with different AI models for varied perspectives
- **Adjust Detail Level**: Use brief for quick explanations, detailed for comprehensive analysis

## 🎨 Customization Options

### AI Provider Settings
- **Provider**: OpenAI, Anthropic, or Google Gemini
- **Model**: Choose from available models (GPT-4, Claude-3, Gemini-Pro, etc.)
- **Response Length**: Short (150), Medium (300), or Long (500) tokens

### Explanation Preferences
- **Detail Level**: Brief, Medium, or Detailed explanations
- **Language**: 12+ supported languages including English, Spanish, French, German, Chinese, Japanese
- **Context Awareness**: Toggle to include/exclude surrounding paragraph context

### User Interface
- **Theme**: Auto (system), Light, or Dark mode
- **Keyboard Shortcuts**: Show/hide shortcut hints in explanations
- **Response Display**: Customize how explanations are presented

## 🔧 Troubleshooting

### Common Issues

#### "API key not found" Error
- **Solution**: Go to Settings → Add your API key for the selected provider
- **Verification**: Use the "Test" button to verify your API key

#### "Failed to get explanation" Error
- **Check Internet**: Ensure stable internet connection
- **API Credits**: Verify you have sufficient API credits with your provider
- **Try Different Model**: Switch to a different AI model in settings

#### Extension Not Working
- **Refresh Page**: Reload the webpage and try again
- **Check Permissions**: Ensure the extension has permissions for the current site
- **Browser Restart**: Try restarting Chrome

#### No Floating Button Appears
- **Check Selection**: Ensure you're selecting text (not images or other elements)
- **Text Length**: Very short selections (1-2 characters) won't trigger the button
- **Extension Status**: Check if extension is enabled in chrome://extensions/

### Performance Tips
- **Shorter Selections**: Smaller text selections process faster
- **Model Selection**: Faster models (GPT-3.5, Claude Haiku, Gemini Flash) respond quicker
- **Detail Level**: Brief explanations are faster than detailed ones

## 📊 Supported AI Models

### OpenAI Models
- **GPT-4o**: Latest and most capable model
- **GPT-4o-mini**: Fast and cost-effective
- **GPT-3.5-turbo**: Quick responses, good for simple explanations

### Anthropic Models
- **Claude-3.5-Sonnet**: Excellent for detailed explanations
- **Claude-3.5-Haiku**: Fast and efficient
- **Claude-3-Opus**: Most capable for complex analysis

### Google Gemini Models
- **Gemini-1.5-Pro**: Advanced reasoning and analysis
- **Gemini-1.5-Flash**: Fast responses for quick explanations

## 🌍 Supported Languages

- English
- Spanish (Español)
- French (Français)
- German (Deutsch)
- Italian (Italiano)
- Portuguese (Português)
- Russian (Русский)
- Chinese (中文)
- Japanese (日本語)
- Korean (한국어)
- Arabic (العربية)
- Hindi (हिन्दी)

## 🔒 Privacy Policy

- **No Data Collection**: We don't collect, store, or analyze your text selections
- **Local Storage**: All settings and API keys are stored locally in your browser
- **Direct Communication**: Selected text is sent directly to your chosen AI provider
- **No Tracking**: Zero analytics, tracking pixels, or user behavior monitoring
- **Data Deletion**: Remove the extension to delete all associated data

## 🛠️ Development

### Project Structure
```
ai-text-explainer-extension/
├── manifest.json                 # Extension manifest
├── src/
│   ├── background/              # Background scripts
│   │   ├── background.js        # Main service worker
│   │   └── ai-service.js        # AI provider integration
│   ├── content/                 # Content scripts
│   │   ├── content.js           # Text selection handling
│   │   └── content.css          # Dialog and UI styles
│   ├── popup/                   # Extension popup
│   │   ├── popup.html           # Popup interface
│   │   ├── popup.css            # Popup styles
│   │   └── popup.js             # Popup functionality
│   ├── settings/                # Settings page
│   │   ├── settings.html        # Settings interface
│   │   ├── settings.css         # Settings styles
│   │   └── settings.js          # Settings management
│   └── utils/                   # Utility modules
│       └── settings-manager.js  # Settings persistence
├── assets/                      # Extension assets
└── README.md                    # This file
```

### Building from Source
1. Clone the repository
2. No build process required - it's pure JavaScript
3. Load as unpacked extension in Chrome

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- **Issues**: Report bugs on [GitHub Issues](https://github.com/your-username/ai-text-explainer-extension/issues)
- **Feature Requests**: Suggest improvements via GitHub Issues
- **Documentation**: Check this README and inline code comments

## 🙏 Acknowledgments

- Built with modern Chrome Extension Manifest V3
- UI inspired by modern design principles
- Thanks to the AI providers (OpenAI, Anthropic, Google) for their APIs

---

**Enjoy explaining text with AI! 🚀** 