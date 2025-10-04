# Speed Reader IA - AI-Powered Reading Assistant

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-green.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

## Description

Speed Reader IA is a powerful Chrome extension that combines text-to-speech capabilities with AI-powered content analysis using Google's Gemini API. Read any web content aloud, analyze images, understand code snippets, and get intelligent contextual assistance.

## Key Features

### Text-to-Speech
- **Intelligent Reading**: Read any selected text on any webpage
- **Voice Controls**: Play, pause, adjust speed and volume
- **Compact Player**: Floating audio player that follows you across pages
- **Multiple Languages**: Support for various languages and accents

### AI-Powered Analysis
- **Image Description**: Analyze and describe images using Gemini Vision
- **Code Analysis**: Understand code snippets with detailed explanations
- **Smart Queries**: Ask questions about selected content
- **Context-Aware**: Get relevant answers based on webpage context

### History Management
- **Query History**: Keep track of all your AI consultations
- **Image & Code Analysis**: Separate history for different content types
- **Export Options**: Export your consultation history
- **Auto-Cleanup**: Configurable automatic history cleanup

### Multilingual Support
- **English & Spanish**: Full interface translation
- **Browser Language Detection**: Automatically adapts to your browser language
- **Custom Translations**: Extensible translation system

## Configuration

### Gemini API Key (Required)
1. Get your free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click the extension icon in your browser
3. Enter your API key in the configuration section
4. Save settings

### Optional Settings
- **Reading Speed**: Adjust text-to-speech speed (0.5x - 2.0x)
- **Voice Selection**: Choose from available system voices
- **History Limits**: Configure maximum saved consultations
- **Auto-Cleanup**: Set automatic history deletion periods

## How to Use

### Text-to-Speech
1. Select any text on a webpage
2. Click the "Read" button in the contextual menu
3. Use the floating player to control playback

### Image Analysis
1. Right-click on any image
2. Select "Describe Image" from the context menu
3. View AI-generated description and ask follow-up questions

### Code Analysis
1. Select code snippet on any webpage
2. Right-click and select "Analyze Code"
3. Get detailed explanation and documentation

## Privacy & Security

- **No Data Collection**: We don't collect or store any user data
- **API Key Encryption**: Your API key is encrypted locally
- **Local Storage**: All history is stored locally in your browser
- **Optional Features**: All AI features require explicit user consent
- **Transparent Code**: Open source for community review

## Permissions Explained

- **activeTab**: Access current tab for reading content
- **storage**: Save settings and history locally
- **tts**: Text-to-speech functionality
- **tabs**: Communicate between extension components
- **scripting**: Inject content scripts for features
- **host_permissions**: Access web pages and Gemini API

## Technical Details

- **Manifest Version**: 3
- **Framework**: Vanilla JavaScript
- **AI Model**: Google Gemini 1.5 Flash
- **Storage**: Chrome Storage API (local & sync)
- **Architecture**: Service Worker + Content Scripts

## Changelog

### Version 1.0.0 (Current)
- Initial release
- Text-to-speech with compact player
- Image and code analysis
- Multilingual support (EN/ES)
- History management with export
- Contextual AI queries

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

##  Author

Created with ❤️ by I

## Acknowledgments

- Google Gemini API for AI capabilities
- Chrome Extensions documentation
- Open source community

---

**Note**: This extension requires a Gemini API key to function. Get your free key at [Google AI Studio](https://makersuite.google.com/app/apikey).