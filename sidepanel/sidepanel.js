// University of Calgary ChatBot Side Panel JavaScript
// Handles API key modal, chat functionality, and Groq LLM integration

class APIKeyModal {
  constructor() {
    this.modal = document.getElementById('apiKeyModal');
    this.overlay = document.getElementById('modalOverlay');
    this.closeBtn = document.getElementById('modalClose');
    this.cancelBtn = document.getElementById('modalCancel');
    this.saveBtn = document.getElementById('modalSave');
    this.input = document.getElementById('apiKeyInput');
    this.validation = document.getElementById('inputValidation');

    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.hide());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.hide());
    }

    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => this.hide());
    }

    if (this.saveBtn) {
      this.saveBtn.addEventListener('click', () => this.handleSave());
    }

    if (this.input) {
      this.input.addEventListener('input', () => this.validateInput());
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleSave();
        }
      });
    }
  }

  show() {
    if (this.modal) {
      this.modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      if (this.input) {
        this.input.focus();
      }
    }
  }

  hide() {
    if (this.modal) {
      this.modal.style.display = 'none';
      document.body.style.overflow = '';
      this.clearInput();
    }
  }

  clearInput() {
    if (this.input) {
      this.input.value = '';
      this.input.classList.remove('error', 'success');
    }
    if (this.validation) {
      this.validation.textContent = '';
      this.validation.classList.remove('error', 'success');
    }
    if (this.saveBtn) {
      this.saveBtn.disabled = true;
    }
  }

  validateInput() {
    if (!this.input || !this.validation || !this.saveBtn) return false;

    const apiKey = this.input.value.trim();

    if (!apiKey) {
      this.showValidation('Please enter your API key', 'error');
      this.input.classList.add('error');
      this.input.classList.remove('success');
      this.saveBtn.disabled = true;
      return false;
    }

    if (!apiKey.startsWith('gsk_')) {
      this.showValidation('Invalid API key format. Groq API keys should start with "gsk_"', 'error');
      this.input.classList.add('error');
      this.input.classList.remove('success');
      this.saveBtn.disabled = true;
      return false;
    }

    if (apiKey.length < 20) {
      this.showValidation('API key appears to be too short', 'error');
      this.input.classList.add('error');
      this.input.classList.remove('success');
      this.saveBtn.disabled = true;
      return false;
    }

    this.showValidation('API key format looks valid!', 'success');
    this.input.classList.remove('error');
    this.input.classList.add('success');
    this.saveBtn.disabled = false;
    return true;
  }

  showValidation(message, type) {
    this.validation.textContent = message;
    this.validation.classList.remove('error', 'success');
    this.validation.classList.add(type);
  }

  async handleSave() {
    if (!this.validateInput() || !this.input) return;

    const apiKey = this.input.value.trim();

    try {
      // Test the API key with a simple request
      const isValid = await this.testAPIKey(apiKey);

      if (isValid) {
        // Save the API key to storage
        await chrome.storage.local.set({ groqApiKey: apiKey });
        this.hide();
        // Trigger chatbot initialization
        window.chatBot.init();
      } else {
        this.showValidation('API key validation failed. Please check your key.', 'error');
        this.input.classList.add('error');
        this.input.classList.remove('success');
      }
    } catch (error) {
      console.error('Error testing API key:', error);
      this.showValidation('Error validating API key. Please try again.', 'error');
      this.input.classList.add('error');
      this.input.classList.remove('success');
    }
  }

  async testAPIKey(apiKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5
        })
      });

      return response.ok;
    } catch (error) {
      console.error('API key test failed:', error);
      return false;
    }
  }
}

class ChatBot {
  constructor() {
    this.messages = [];
    this.isTyping = false;
    this.apiKeyModal = new APIKeyModal();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    console.log('UofC ChatBot loaded');

    try {
      // Check if API key is configured
      const { groqApiKey } = await chrome.storage.local.get(['groqApiKey']);

      if (!groqApiKey) {
        // Show API key modal
        this.apiKeyModal.show();
        return;
      }

      // API key exists, initialize chat
      this.groqApiKey = groqApiKey;
      this.setupChatEventListeners();
      this.setupMessageHandlers();
      this.loadChatHistory();
      this.addWelcomeMessage();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize chatbot:', error);
      this.apiKeyModal.show();
    }
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
      const result = await chrome.storage.local.get(['chatHistory']);

      if (result.chatHistory) {
        this.messages = result.chatHistory;
        this.messages.forEach(msg => this.displayMessage(msg));
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }

  addWelcomeMessage() {
    const welcomeMessage = {
      role: 'assistant',
      content: 'Welcome to UofC ChatBot! I\'m powered by Llama 3.3 and ready to help. What can I assist you with today?',
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
      // Send message directly to Groq API
      const response = await this.sendToGroq(message);
      this.hideTypingIndicator();
      this.addMessage('assistant', response);
    } catch (error) {
      console.error('Error sending message:', error);
      this.hideTypingIndicator();
      this.addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
      sendButton.disabled = false;
    }
  }

  async sendToGroq(message) {
    const requestBody = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        ...this.messages.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      top_p: 1,
      stream: false
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.groqApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
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
      await chrome.storage.local.set({ chatHistory: this.messages });
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.chatBot = new ChatBot();
});