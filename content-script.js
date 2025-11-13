// Content Script - Runs in the context of web pages
// This skeleton provides basic structure for page interaction

class ContentScript {
  constructor() {
    this.init();
  }

  init() {
    console.log('Extension content script loaded');
    this.setupMessageListeners();
    this.detectPage();
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getPageContent') {
        const content = this.extractPageContent();
        sendResponse({ content: content });
      }

      if (request.action === 'highlightElement') {
        this.highlightElement(request.selector);
        sendResponse({ success: true });
      }
    });
  }

  detectPage() {
    // Basic page detection logic
    const url = window.location.href;
    const title = document.title;

    console.log('Page detected:', { url, title });

    // Notify service worker about page load
    this.sendMessage({
      action: 'pageLoaded',
      data: {
        url: url,
        title: title,
        timestamp: Date.now()
      }
    });
  }

  extractPageContent() {
    return {
      title: document.title,
      url: window.location.href,
      content: document.body.innerText,
      html: document.documentElement.outerHTML
    };
  }

  highlightElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
      element.style.border = '2px solid #ff0000';
      element.style.backgroundColor = '#ffff00';
      setTimeout(() => {
        element.style.border = '';
        element.style.backgroundColor = '';
      }, 3000);
    }
  }

  sendMessage(message) {
    chrome.runtime.sendMessage(message).catch(error => {
      console.error('Failed to send message to service worker:', error);
    });
  }
}

// Initialize content script
new ContentScript();