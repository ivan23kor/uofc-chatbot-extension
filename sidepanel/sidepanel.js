// University of Calgary ChatBot Side Panel JavaScript
// Handles chat functionality and communication with LLM

class ChatBot {
  constructor() {
    this.messages = [];
    this.isTyping = false;
    this.init();
  }

  init() {
    console.log('UofC ChatBot loaded');
    this.setupChatEventListeners();
    this.setupMessageHandlers();
    this.loadChatHistory();
    this.addWelcomeMessage();
  }

  setupChatEventListeners() {
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSendMessage();
      });
    }

    if (messageInput) {
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });

      messageInput.addEventListener('input', () => {
        this.autoResizeTextarea(messageInput);
      });
    }
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
      case 'llmResponse':
        this.handleLLMResponse(data);
        break;
      case 'chatError':
        this.handleChatError(data);
        break;
      default:
        console.debug('Unknown message in chat panel:', action);
    }
  }

  handleLLMResponse(data) {
    this.hideTypingIndicator();
    if (data.response) {
      this.addMessage('assistant', data.response);
    }
  }

  handleChatError(data) {
    this.hideTypingIndicator();
    this.addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
  }

  async loadChatHistory() {
    try {
      const result = await this.sendMessage({
        action: 'getStorageData',
        data: { keys: ['chatHistory'] }
      });

      if (result.success && result.data.chatHistory) {
        this.messages = result.data.chatHistory;
        this.messages.forEach(msg => this.displayMessage(msg));
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }

  addWelcomeMessage() {
    const welcomeMessage = {
      role: 'assistant',
      content: 'Welcome to UofC ChatBot! How can I help you today?',
      timestamp: Date.now()
    };
    this.addMessage('assistant', welcomeMessage.content);
  }

  async handleSendMessage() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const message = messageInput.value.trim();

    if (!message || this.isTyping) return;

    // Add user message
    this.addMessage('user', message);

    // Clear input
    messageInput.value = '';
    this.autoResizeTextarea(messageInput);

    // Disable send button
    sendButton.disabled = true;

    // Show typing indicator
    this.showTypingIndicator();

    try {
      // Send message to background script for LLM processing
      await this.sendMessage({
        action: 'sendToLLM',
        data: {
          message: message,
          history: this.messages.slice(-10) // Send last 10 messages for context
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
      this.hideTypingIndicator();
      this.addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
      sendButton.disabled = false;
    }
  }

  addMessage(role, content) {
    const message = {
      role: role,
      content: content,
      timestamp: Date.now()
    };

    this.messages.push(message);
    this.displayMessage(message);
    this.saveChatHistory();
  }

  displayMessage(message) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = message.role === 'user' ? 'U' : 'C';

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = message.content;

    messageElement.appendChild(avatar);
    messageElement.appendChild(content);
    messagesContainer.appendChild(messageElement);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  showTypingIndicator() {
    this.isTyping = true;
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;

    const typingElement = document.createElement('div');
    typingElement.className = 'message assistant typing-indicator';
    typingElement.id = 'typingIndicator';

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'typing-dot';
      typingElement.appendChild(dot);
    }

    messagesContainer.appendChild(typingElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  hideTypingIndicator() {
    this.isTyping = false;
    const typingIndicator = document.getElementById('typingIndicator');
    const sendButton = document.getElementById('sendButton');

    if (typingIndicator) {
      typingIndicator.remove();
    }

    if (sendButton) {
      sendButton.disabled = false;
    }
  }

  autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  async saveChatHistory() {
    try {
      await this.sendMessage({
        action: 'setStorageData',
        data: { data: { chatHistory: this.messages } }
      });
    } catch (error) {
      console.error('Failed to save chat history:', error);
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
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ChatBot();
});