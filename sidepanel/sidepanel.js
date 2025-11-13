// Side Panel JavaScript - Handles UI interactions and communication
// This skeleton provides basic structure for side panel functionality

class SidePanel {
  constructor() {
    this.init();
  }

  init() {
    console.log('Side panel loaded');
    this.setupEventListeners();
    this.setupMessageHandlers();
    this.loadInitialData();
    this.updateStatus('Ready');
  }

  setupEventListeners() {
    // Action buttons
    document.getElementById('extractContent')?.addEventListener('click', () => {
      this.extractPageContent();
    });

    document.getElementById('highlightElements')?.addEventListener('click', () => {
      this.highlightElements();
    });

    document.getElementById('clearStorage')?.addEventListener('click', () => {
      this.clearStorage();
    });

    document.getElementById('copyData')?.addEventListener('click', () => {
      this.copyDataToClipboard();
    });

    // Settings
    document.getElementById('enableLogging')?.addEventListener('change', (e) => {
      this.updateSetting('enableLogging', e.target.checked);
    });

    document.getElementById('autoExtract')?.addEventListener('change', (e) => {
      this.updateSetting('autoExtract', e.target.checked);
    });
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }

  handleMessage(request, sender, sendResponse) {
    const { action, data } = request;

    switch (action) {
      case 'tabUpdated':
        this.handleTabUpdated(data);
        break;
      case 'contentExtracted':
        this.displayExtractedContent(data);
        break;
      default:
        console.debug('Unknown message in side panel:', action);
    }
  }

  handleTabUpdated(tabData) {
    document.getElementById('pageTitle').textContent = tabData.title || 'No title';
    document.getElementById('pageUrl').textContent = tabData.url || '-';
    document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();

    // Auto extract content if enabled
    const autoExtract = document.getElementById('autoExtract');
    if (autoExtract && autoExtract.checked) {
      this.extractPageContent();
    }
  }

  async loadInitialData() {
    try {
      const result = await this.sendMessage({
        action: 'getStorageData',
        data: { keys: ['settings', 'lastPage'] }
      });

      if (result.success) {
        this.loadSettings(result.data.settings || {});

        if (result.data.lastPage) {
          document.getElementById('pageTitle').textContent = result.data.lastPage.title || 'No page loaded';
          document.getElementById('pageUrl').textContent = result.data.lastPage.url || '-';
        }
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }

  loadSettings(settings) {
    const enableLogging = document.getElementById('enableLogging');
    const autoExtract = document.getElementById('autoExtract');

    if (enableLogging) enableLogging.checked = settings.enableLogging || false;
    if (autoExtract) autoExtract.checked = settings.autoExtract || false;
  }

  async extractPageContent() {
    this.updateStatus('Extracting content...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getPageContent'
      });

      if (response && response.content) {
        this.displayExtractedContent(response.content);
        this.updateStatus('Content extracted');
      } else {
        this.showError('Failed to extract content');
      }
    } catch (error) {
      console.error('Error extracting content:', error);
      this.showError('Error: ' + error.message);
    }
  }

  displayExtractedContent(content) {
    const output = document.getElementById('dataOutput');
    if (output) {
      output.value = JSON.stringify(content, null, 2);
    }

    // Store in local storage
    this.sendMessage({
      action: 'setStorageData',
      data: { data: { lastExtractedContent: content } }
    });
  }

  async highlightElements() {
    this.updateStatus('Highlighting elements...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Example: highlight main content areas
      const selectors = ['main', 'article', '[role="main"]', '.content', '#content'];

      for (const selector of selectors) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'highlightElement',
          selector: selector
        });
      }

      this.updateStatus('Elements highlighted');
    } catch (error) {
      console.error('Error highlighting elements:', error);
      this.showError('Error: ' + error.message);
    }
  }

  async clearStorage() {
    if (confirm('Are you sure you want to clear all extension data?')) {
      try {
        await chrome.storage.local.clear();
        document.getElementById('dataOutput').value = '';
        this.updateStatus('Storage cleared');

        // Reload settings
        this.loadSettings({});
      } catch (error) {
        console.error('Error clearing storage:', error);
        this.showError('Error: ' + error.message);
      }
    }
  }

  copyDataToClipboard() {
    const output = document.getElementById('dataOutput');
    if (output && output.value) {
      navigator.clipboard.writeText(output.value).then(() => {
        this.updateStatus('Copied to clipboard');
        setTimeout(() => this.updateStatus('Ready'), 2000);
      }).catch(error => {
        console.error('Failed to copy:', error);
        this.showError('Failed to copy to clipboard');
      });
    }
  }

  async updateSetting(key, value) {
    try {
      const result = await this.sendMessage({
        action: 'getStorageData',
        data: { keys: ['settings'] }
      });

      const settings = result.success ? result.data.settings || {} : {};
      settings[key] = value;

      await this.sendMessage({
        action: 'setStorageData',
        data: { data: { settings } }
      });

      console.log('Setting updated:', key, value);
    } catch (error) {
      console.error('Failed to update setting:', error);
    }
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  updateStatus(text, type = 'success') {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusDot = statusIndicator?.querySelector('.status-dot');
    const statusText = statusIndicator?.querySelector('.status-text');

    if (statusText) statusText.textContent = text;

    if (statusDot) {
      statusDot.style.backgroundColor = type === 'error' ? '#ea4335' : '#4caf50';
    }

    // Log if enabled
    const enableLogging = document.getElementById('enableLogging');
    if (enableLogging && enableLogging.checked) {
      console.log(`[${type.toUpperCase()}] ${text}`);
    }
  }

  showError(message) {
    this.updateStatus(message, 'error');
    setTimeout(() => this.updateStatus('Ready'), 3000);
  }
}

// Initialize side panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SidePanel();
});