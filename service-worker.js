// Service Worker - Background script for the extension
// This skeleton provides basic structure for extension background tasks

class ServiceWorker {
  constructor() {
    this.init();
  }

  init() {
    console.log('Extension service worker loaded');
    this.setupEventListeners();
    this.setupMessageHandlers();
  }

  setupEventListeners() {
    // Extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      console.log('Extension installed:', details);
      this.handleInstall(details);
    });

    // Extension startup
    chrome.runtime.onStartup.addListener(() => {
      console.log('Extension started');
    });

    // Extension action click
    chrome.action.onClicked.addListener(async (tab) => {
      console.log('Extension action clicked');
      try {
        await chrome.sidePanel.open({ tabId: tab.id });
        console.log('Side panel opened');
      } catch (error) {
        console.error('Failed to open side panel:', error);
      }
    });

    // Tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.handleTabUpdate(tabId, tab);
      }
    });
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  handleInstall(details) {
    if (details.reason === 'install') {
      console.log('First time installation');
      this.setInitialStorage();
    } else if (details.reason === 'update') {
      console.log('Extension updated');
    }
  }

  handleTabUpdate(tabId, tab) {
    console.log('Tab updated:', tab.url);

    // Notify side panel about tab changes if it's open
    this.sendMessageToSidePanel({
      action: 'tabUpdated',
      data: {
        tabId: tabId,
        url: tab.url,
        title: tab.title
      }
    });
  }

  handleMessage(request, sender, sendResponse) {
    const { action, data } = request;

    switch (action) {
      case 'pageLoaded':
        this.handlePageLoaded(data, sender);
        sendResponse({ success: true });
        break;

      case 'getStorageData':
        this.getStorageData(data.keys).then(result => {
          sendResponse(result);
        });
        break;

      case 'setStorageData':
        this.setStorageData(data.data).then(() => {
          sendResponse({ success: true });
        });
        break;

      case 'openSidePanel':
        this.openSidePanel();
        sendResponse({ success: true });
        break;

      default:
        console.warn('Unknown action:', action);
        sendResponse({ error: 'Unknown action' });
    }
  }

  handlePageLoaded(pageData, sender) {
    console.log('Page loaded notification:', pageData);

    // Store page information
    this.setStorageData({
      lastPage: pageData,
      lastPageTimestamp: Date.now()
    });
  }

  async getStorageData(keys) {
    try {
      const result = await chrome.storage.local.get(keys);
      return { success: true, data: result };
    } catch (error) {
      console.error('Failed to get storage data:', error);
      return { success: false, error: error.message };
    }
  }

  async setStorageData(data) {
    try {
      await chrome.storage.local.set(data);
      console.log('Storage data saved:', data);
    } catch (error) {
      console.error('Failed to set storage data:', error);
      throw error;
    }
  }

  async openSidePanel() {
    try {
      await chrome.sidePanel.open({ tabId: (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id });
      console.log('Side panel opened');
    } catch (error) {
      console.error('Failed to open side panel:', error);
    }
  }

  sendMessageToSidePanel(message) {
    chrome.runtime.sendMessage(message).catch(error => {
      // Side panel might not be open, which is fine
      console.debug('Could not send message to side panel (might be closed):', error);
    });
  }

  setInitialStorage() {
    const initialData = {
      extensionInstalled: Date.now(),
      settings: {
        enabled: true,
        theme: 'default'
      }
    };

    this.setStorageData(initialData);
  }
}

// Initialize service worker
new ServiceWorker();