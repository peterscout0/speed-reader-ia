# Speed Reader IA

AI-powered Chrome extension for text-to-speech and intelligent content analysis using Google Gemini API.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-green.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

## Overview

Speed Reader IA combines text-to-speech capabilities with AI-powered content analysis. Read web content aloud, analyze images, understand code snippets, and get contextual AI assistance directly in your browser.

## Features

### Text-to-Speech
- Read selected text on any webpage
- Adjustable speed and volume controls
- Floating compact player
- Multi-language support

### AI Analysis
- Image description using Gemini Vision
- Code snippet analysis and explanation
- Custom queries with context awareness
- Smart content interpretation

### History Management
- Track AI consultations
- Separate history for images and code
- Export consultation data
- Configurable auto-cleanup

### Multilingual Interface
- English and Spanish support
- Automatic language detection
- Extensible translation system

## Installation

### From Source
1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

### Requirements
- Google Chrome or Chromium-based browser
- Gemini API key (free tier available at [Google AI Studio](https://makersuite.google.com/app/apikey))

## Configuration

### API Key Setup
1. Obtain a free API key from Google AI Studio
2. Click the extension icon in your browser
3. Enter your API key in the settings
4. Configure optional preferences (speed, voice, history limits)

### Available Settings
- Reading speed (0.5x to 2.0x)
- Voice selection
- History retention limits
- Automatic cleanup intervals

## Usage

### Reading Text
1. Select text on any webpage
2. Click "Read" in the contextual menu
3. Control playback with the floating player

### Analyzing Images
1. Right-click on any image
2. Select "Describe Image"
3. View AI-generated description

### Analyzing Code
1. Select code snippet
2. Right-click and choose "Analyze Code"
3. Review detailed explanation

## Privacy

- No data collection or tracking
- API key encrypted and stored locally
- All history stored in browser local storage
- No external servers or analytics
- Open source and auditable

See [PRIVACY.md](PRIVACY.md) for complete privacy policy.

## Permissions

- **activeTab**: Access current tab content for reading
- **storage**: Save settings and history locally
- **tts**: Text-to-speech functionality
- **tabs**: Extension component communication
- **scripting**: Content script injection
- **host_permissions**: Web page access and Gemini API communication

## Technical Stack

- Manifest Version 3
- Vanilla JavaScript
- Google Gemini 1.5 Flash
- Chrome Storage API
- Service Worker architecture

## Development

### Building
No build process required. Load directly as unpacked extension.

## Changelog

### Version 1.0.0
- Initial release
- Text-to-speech with compact player
- Image and code analysis via Gemini
- Multilingual support (EN/ES)
- History management with export
- Contextual AI queries

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

- Google Gemini API
- Chrome Extensions Platform
- Open source community

---

**Note**: Gemini API key required for AI features. Free tier available at [Google AI Studio](https://makersuite.google.com/app/apikey).