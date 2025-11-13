# Extension Skeleton

A clean browser extension skeleton based on modern Chrome Extension Manifest V3 architecture.

## Structure

```
extension-skeleton/
├── manifest.json              # Extension configuration
├── content-script.js          # Content script for page interaction
├── service-worker.js          # Background service worker
├── sidepanel/
│   ├── sidepanel.html         # Side panel UI
│   ├── sidepanel.css          # Side panel styling
│   └── sidepanel.js           # Side panel functionality
└── README.md                  # This file
```

## Components

### Manifest V3 (`manifest.json`)
- Modern Chrome extension configuration
- Essential permissions for functionality
- Content script and service worker setup
- Side panel configuration

### Content Script (`content-script.js`)
- Runs in the context of web pages
- Page detection and content extraction
- Element highlighting capabilities
- Message passing to service worker

### Service Worker (`service-worker.js`)
- Background processing and coordination
- Chrome storage management
- Message routing between components
- Event handling (install, tab updates, etc.)

### Side Panel (`sidepanel/`)
- Clean, responsive UI for extension controls
- Page information display
- Action buttons for common tasks
- Settings management
- Real-time status updates

## Features

- **Modern Architecture**: Uses Manifest V3 with service workers
- **Clean Communication**: Message passing between all components
- **Storage Management**: Chrome storage API integration
- **Responsive UI**: Mobile-friendly side panel design
- **Error Handling**: Comprehensive error handling throughout
- **Logging**: Optional logging for debugging
- **Settings**: Persistent configuration storage

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the extension directory
4. The extension will appear in your extensions list

## Usage

1. Navigate to any webpage
2. Click the extension icon to open the side panel
3. Use the side panel to:
   - View current page information
   - Extract page content
   - Highlight page elements
   - Manage extension settings
   - View extracted data

## Development

This skeleton provides:
- Basic component structure
- Message passing patterns
- Storage management
- UI framework
- Event handling

Build upon this foundation to add your specific extension functionality.

## Permissions

The extension requests minimal permissions:
- `activeTab` - Access to current active tab
- `storage` - Chrome storage for data persistence
- `scripting` - Content script injection
- `tabs` - Tab management
- `sidePanel` - Side panel API access
- `<all_urls>` - Access to all web pages

## Browser Support

- Chrome 88+ (Manifest V3 compatible)
- Edge 88+ (Chromium-based)
- Other Chromium-based browsers may work