// Service Worker - Background script for the extension
// This skeleton provides basic structure for extension background tasks

class ServiceWorker {
  constructor() {
    this.mcpPort = null;
    this.mcpConnected = false;
    this.init();
  }

  init() {
    console.log('Extension service worker loaded');
    this.setupEventListeners();
    this.setupMessageHandlers();
    this.initializeMCP();
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

      case 'mcpCall':
        this.handleMCPCall(data).then(result => {
          sendResponse(result);
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        break;

      case 'getMCPStatus':
        sendResponse({ connected: this.mcpConnected });
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

  initializeMCP() {
    console.log('Initializing MCP connection...');
    // For now, we'll simulate MCP connection
    // In a real implementation, this would connect to the MCP server
    this.mcpConnected = true;
    console.log('MCP connection initialized');
  }

  async handleMCPCall(data) {
    if (!this.mcpConnected) {
      throw new Error('MCP server not connected');
    }

    const { method, params } = data;
    console.log('MCP Call:', method, params);

    try {
      let result;

      // Simulate MCP calls for now
      // In real implementation, these would be actual MCP server calls
      switch (method) {
        case 'browser_navigate':
          result = await this.simulateNavigate(params);
          break;
        case 'browser_getPageContent':
          result = await this.simulateGetPageContent(params);
          break;
        case 'browser_findElement':
          result = await this.simulateFindElement(params);
          break;
        case 'browser_scrollTo':
          result = await this.simulateScrollTo(params);
          break;
        case 'browser_click':
          result = await this.simulateClick(params);
          break;
        case 'browser_getLinks':
          result = await this.simulateGetLinks(params);
          break;
        default:
          throw new Error(`Unknown MCP method: ${method}`);
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('MCP call failed:', error);
      throw error;
    }
  }

  async simulateNavigate(params) {
    const { url } = params;
    // Get current active tab and navigate
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(tab.id, { url });
    return { url, status: 'navigated' };
  }

  async simulateGetPageContent(params) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return {
          title: document.title,
          url: window.location.href,
          content: document.body.innerText,
          html: document.documentElement.outerHTML
        };
      }
    });
    return results[0].result;
  }

  async simulateFindElement(params) {
    const { selector } = params;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (sel) => {
        const element = document.querySelector(sel);
        if (!element) return null;

        const rect = element.getBoundingClientRect();
        return {
          selector: sel,
          text: element.innerText,
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        };
      },
      args: [selector]
    });
    return results[0].result;
  }

  async simulateScrollTo(params) {
    const { selector, x, y } = params;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (params) => {
        if (params.selector) {
          const element = document.querySelector(params.selector);
          if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (params.x !== undefined && params.y !== undefined) {
          window.scrollTo({ left: params.x, top: params.y, behavior: 'smooth' });
        }
      },
      args: [{ selector, x, y }]
    });

    return { scrolled: true, selector, x, y };
  }

  async simulateClick(params) {
    const { selector } = params;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (sel) => {
        const element = document.querySelector(sel);
        if (element) {
          element.click();
          return true;
        }
        return false;
      },
      args: [selector]
    });

    return { clicked: true, selector };
  }

  async simulateGetLinks(params) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const links = Array.from(document.querySelectorAll('a[href]')).map(link => ({
          text: link.innerText.trim(),
          href: link.href,
          title: link.title,
          target: link.target
        }));
        return links;
      }
    });
    return results[0].result;
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