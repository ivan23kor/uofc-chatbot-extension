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
    this.mcpEnabled = false;
    this.semanticSearch = null;
    this.semanticSections = [];
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
      this.checkMCPStatus();
      this.initializeSemanticSearch();
      this.setupQuickActions();
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

  async checkMCPStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getMCPStatus' });
      this.mcpEnabled = response.connected;
      console.log('MCP Status:', this.mcpEnabled);
      this.updateMCPStatusIndicator();
    } catch (error) {
      console.error('Failed to check MCP status:', error);
      this.mcpEnabled = false;
      this.updateMCPStatusIndicator();
    }
  }

  updateMCPStatusIndicator() {
    const statusDot = document.getElementById('mcpStatusDot');
    if (statusDot) {
      if (this.mcpEnabled) {
        statusDot.classList.remove('inactive');
      } else {
        statusDot.classList.add('inactive');
      }
    }
  }

  setupQuickActions() {
    const readPageBtn = document.getElementById('readPageBtn');
    const getLinksBtn = document.getElementById('getLinksBtn');
    const helpBtn = document.getElementById('helpBtn');
    const helpClose = document.getElementById('helpClose');
    const helpModal = document.getElementById('helpModal');

    if (readPageBtn) {
      readPageBtn.addEventListener('click', () => {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
          messageInput.value = 'read this page';
          this.handleSendMessage();
        }
      });
    }

    if (getLinksBtn) {
      getLinksBtn.addEventListener('click', () => {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
          messageInput.value = 'get all links';
          this.handleSendMessage();
        }
      });
    }

    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        if (helpModal) {
          helpModal.style.display = 'flex';
        }
      });
    }

    if (helpClose) {
      helpClose.addEventListener('click', () => {
        if (helpModal) {
          helpModal.style.display = 'none';
        }
      });
    }

    // Close help modal when clicking outside
    if (helpModal) {
      helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
          helpModal.style.display = 'none';
        }
      });
    }
  }

  addWelcomeMessage() {
    let welcomeText = 'Welcome to UofC ChatBot! I\'m powered by Llama 3.3 and ready to help.';
    if (this.mcpEnabled) {
      welcomeText += ' I can help you interact with web pages with both traditional and semantic search:\n\n';
      welcomeText += '**Traditional commands:** "read this page", "find sections about X", "scroll to heading", "get all links"\n\n';
      welcomeText += '**Semantic commands:** "semantic search for tuition", "find content like costs and fees", "smart scroll to admission requirements"';
    }
    welcomeText += '\n\nWhat can I assist you with today?';

    const welcomeMessage = {
      role: 'assistant',
      content: welcomeText,
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
      // Check if this is a web interaction command
      const webCommand = this.parseWebCommand(message);
      if (webCommand && this.mcpEnabled) {
        const response = await this.handleWebCommand(webCommand);
        this.hideTypingIndicator();
        this.addMessage('assistant', response);
      } else {
        // Send message directly to Groq API
        const response = await this.sendToGroq(message);
        this.hideTypingIndicator();
        this.addMessage('assistant', response);
      }
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

    // Parse and render content with interactive elements
    if (message.content.includes('Click on any section number below')) {
      content.innerHTML = this.parseInteractiveMessage(message.content);
    } else {
      content.textContent = message.content;
    }

    messageElement.appendChild(avatar);
    messageElement.appendChild(content);
    messagesContainer.appendChild(messageElement);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  parseInteractiveMessage(content) {
    // Parse markdown and add interactive elements
    let html = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^\d+\.\s+\*\*(.*?)\*\*/g, function(match, text) {
        const sectionNum = match.match(/^\d+/)[0];
        return `<div class="search-result-item" data-section="${sectionNum}">
          <strong>${sectionNum}. ${text}</strong>
          <button class="scroll-to-btn" onclick="window.chatBot.scrollToSearchResult(${parseInt(sectionNum) - 1})">
            📍 Scroll here
          </button>
        </div>`;
      })
      .replace(/^(\d+\.\s+)/gm, '<div class="search-result-item" data-section="$1">$1</div>');

    return '<p>' + html + '</p>';
  }

  async scrollToSearchResult(index) {
    // Check regular search results first
    if (this.currentSearchResults && this.currentSearchResults[index]) {
      const section = this.currentSearchResults[index];
      try {
        const result = await this.executeMCPAction('scrollToSection', { selector: section.selector });
        return `✅ Scrolled to: **${section.text.substring(0, 50)}**`;
      } catch (error) {
        return `❌ Failed to scroll: ${error.message}`;
      }
    }

    // Check semantic search results
    if (this.currentSemanticResults && this.currentSemanticResults[index]) {
      const section = this.currentSemanticResults[index];
      try {
        const result = await this.executeMCPAction('scrollToSection', { selector: section.selector });
        return `🎯 **Scrolled to semantically relevant section:**\n\n**${section.heading || 'Untitled Section'}**\nRelevance: ${section.relevanceLabel} (${Math.round(section.relevanceScore * 100)}%)`;
      } catch (error) {
        return `❌ Failed to scroll: ${error.message}`;
      }
    }

    return '❌ Section not found. Please search again.';
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

  async initializeSemanticSearch() {
    try {
      if (typeof SemanticSearch !== 'undefined') {
        this.semanticSearch = new SemanticSearch();
        await this.semanticSearch.initialize(this.groqApiKey);
        console.log('Semantic search initialized successfully');
      } else {
        console.error('SemanticSearch class not found - semantic search will be disabled');
        this.semanticSearch = null;
      }
    } catch (error) {
      console.error('Failed to initialize semantic search:', error);
      this.semanticSearch = null;
    }
  }

  parseWebCommand(message) {
    const commands = [
      {
        pattern: /^(read|extract|scan)(\s+this)?(\s+page)?$/i,
        action: 'extractStructuredData',
        description: 'Extract structured data from the current page'
      },
      {
        pattern: /^semantic\s+(search|find)\s+(for\s+)?(.+)$/i,
        action: 'semanticSearch',
        description: 'Semantic search for content similar to your query',
        extractParam: 2
      },
      {
        pattern: /^find\s+content\s+(like|about|similar\s+to)\s+(.+)$/i,
        action: 'semanticSearch',
        description: 'Find content semantically similar to your description',
        extractParam: 2
      },
      {
        pattern: /^(find|search)(\s+for)?\s+(.+)$/i,
        action: 'findSections',
        description: 'Find sections containing specific text',
        extractParam: 2
      },
      {
        pattern: /^smart\s+scroll\s+to\s+(.+)$/i,
        action: 'semanticScroll',
        description: 'Scroll to the most semantically relevant section',
        extractParam: 1
      },
      {
        pattern: /^(scroll|go)\s+to\s+(.+)$/i,
        action: 'scrollToSection',
        description: 'Scroll to a specific section or element',
        extractParam: 2
      },
      {
        pattern: /^scroll\s+to\s+section\s+(\d+)$/i,
        action: 'scrollToSectionByNumber',
        description: 'Scroll to a section by number from search results',
        extractParam: 1
      },
      {
        pattern: /^(get|list|show)(\s+all)?\s+links?$/i,
        action: 'getAllLinks',
        description: 'Get all links on the current page'
      },
      {
        pattern: /^(navigate|go)\s+to\s+(https?:\/\/.+)$/i,
        action: 'navigate',
        description: 'Navigate to a specific URL',
        extractParam: 2
      },
      {
        pattern: /^(click|press)\s+(.+)$/i,
        action: 'click',
        description: 'Click on an element',
        extractParam: 1
      },
      {
        pattern: /^(forms?|inputs?|fields?)$/i,
        action: 'extractFormFields',
        description: 'Extract form fields from the page'
      }
    ];

    for (const command of commands) {
      const match = message.match(command.pattern);
      if (match) {
        const result = {
          action: command.action,
          description: command.description
        };

        if (command.extractParam !== undefined) {
          result.params = { query: match[command.extractParam].trim() };
        }

        return result;
      }
    }

    return null;
  }

  async handleWebCommand(command) {
    console.log('Executing web command:', command);

    try {
      let result;

      switch (command.action) {
        case 'extractStructuredData':
          result = await this.executeMCPAction('extractStructuredData', { enableSemanticProcessing: true });
          if (result.semanticSections) {
            await this.processSemanticSections(result.semanticSections);
          }
          return this.formatStructuredDataResponse(result);

        case 'semanticSearch':
          return await this.handleSemanticSearch(command.params.query);

        case 'semanticScroll':
          return await this.handleSemanticScroll(command.params.query);

        case 'findSections':
          result = await this.executeMCPAction('findSections', { query: command.params.query });
          return this.formatSectionsResponse(result, command.params.query);

        case 'scrollToSection':
          result = await this.executeMCPAction('scrollToSection', { query: command.params.query });
          return this.formatScrollResponse(result);

        case 'scrollToSectionByNumber':
          const sectionIndex = parseInt(command.params.query) - 1;
          return await this.scrollToSearchResult(sectionIndex);

        case 'getAllLinks':
          result = await this.executeMCPAction('getAllLinks', {});
          return this.formatLinksResponse(result);

        case 'navigate':
          result = await this.executeMCPAction('navigate', { url: command.params.query });
          return `Navigated to ${command.params.query}`;

        case 'click':
          result = await this.executeMCPAction('click', { selector: command.params.query });
          return `Clicked on element: ${command.params.query}`;

        case 'extractFormFields':
          result = await this.executeMCPAction('extractFormFields', {});
          return this.formatFormFieldsResponse(result);

        default:
          return `Unknown web command: ${command.action}`;
      }
    } catch (error) {
      console.error('Web command failed:', error);
      return `Failed to execute web command: ${error.message}`;
    }
  }

  async executeMCPAction(action, params) {
    if (action === 'navigate' || action === 'click') {
      // Browser-level actions go through service worker
      const method = action === 'navigate' ? 'browser_navigate' : 'browser_click';
      const response = await chrome.runtime.sendMessage({
        action: 'mcpCall',
        data: { method, params }
      });
      return response.data;
    } else {
      // Page-level actions go through content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'mcpPageAction',
        data: { action, params }
      });
      return response.data;
    }
  }

  formatStructuredDataResponse(data) {
    let response = `**Page Analysis: ${data.title}**\n\n`;

    if (data.description) {
      response += `**Description:** ${data.description}\n\n`;
    }

    if (data.headings && data.headings.length > 0) {
      response += `**Main Sections:**\n`;
      data.headings.slice(0, 10).forEach(heading => {
        response += `${'  '.repeat(heading.level - 1)}• ${heading.text}\n`;
      });
      response += '\n';
    }

    if (data.links && data.links.length > 0) {
      response += `**Links Found:** ${data.links.length} total\n`;
      const importantLinks = data.links.slice(0, 5);
      importantLinks.forEach(link => {
        response += `• ${link.text} (${link.href})\n`;
      });
      if (data.links.length > 5) {
        response += `... and ${data.links.length - 5} more links\n`;
      }
      response += '\n';
    }

    if (data.forms && data.forms.length > 0) {
      response += `**Forms Found:** ${data.forms.length}\n`;
    }

    if (data.tables && data.tables.length > 0) {
      response += `**Tables Found:** ${data.tables.length}\n`;
    }

    const textPreview = data.text.substring(0, 500);
    if (textPreview) {
      response += `**Content Preview:**\n${textPreview}${data.text.length > 500 ? '...' : ''}\n\n`;
    }

    return response;
  }

  formatSectionsResponse(sections, query) {
    if (sections.length === 0) {
      return `No sections found containing "${query}"`;
    }

    let response = `**Found ${sections.length} sections containing "${query}":**\n\n`;

    sections.slice(0, 10).forEach((section, index) => {
      response += `${index + 1}. **${section.text.substring(0, 100)}**\n`;
      response += `   Element: ${section.tagName}\n\n`;
    });

    if (sections.length > 10) {
      response += `... and ${sections.length - 10} more matches\n\n`;
    }

    response += `Click on any section number below to scroll to it, or say "scroll to section [number]"`;

    // Store sections for interactive clicking
    this.currentSearchResults = sections.slice(0, 10);

    return response;
  }

  formatScrollResponse(result) {
    if (result && result.success) {
      return `✅ Scrolled to the target section and highlighted it.`;
    } else {
      return `❌ Failed to scroll: ${result?.error || 'Unknown error'}`;
    }
  }

  formatLinksResponse(links) {
    if (links.length === 0) {
      return 'No links found on this page.';
    }

    let response = `**Found ${links.length} links on this page:**\n\n`;

    links.slice(0, 20).forEach((link, index) => {
      response += `${index + 1}. ${link.text || '[No text]'}\n`;
      response += `   ${link.href}\n\n`;
    });

    if (links.length > 20) {
      response += `... and ${links.length - 20} more links\n\n`;
    }

    return response;
  }

  formatFormFieldsResponse(forms) {
    if (forms.length === 0) {
      return 'No forms found on this page.';
    }

    let response = `**Found ${forms.length} form(s) on this page:**\n\n`;

    forms.forEach((form, index) => {
      response += `${index + 1}. **Form**${form.action ? ` (action: ${form.action})` : ''}\n`;

      if (form.fields && form.fields.length > 0) {
        response += `   **Fields:**\n`;
        form.fields.forEach(field => {
          const required = field.required ? ' (required)' : '';
          response += `   • ${field.name || field.id || '[unnamed]'} (${field.type})${required}\n`;
        });
      }

      response += '\n';
    });

    return response;
  }

  async saveChatHistory() {
    try {
      await chrome.storage.local.set({ chatHistory: this.messages });
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  }

  async processSemanticSections(semanticSections) {
    if (!this.semanticSearch || !semanticSections) return;

    try {
      this.semanticSections = await this.semanticSearch.processContentSections(semanticSections);
      console.log(`Processed ${this.semanticSections.length} semantic sections`);
    } catch (error) {
      console.error('Failed to process semantic sections:', error);
      this.semanticSections = [];
    }
  }

  async handleSemanticSearch(query) {
    if (!this.semanticSearch) {
      return 'Semantic search is not available. Please try reading the page first to enable semantic processing.';
    }

    if (this.semanticSections.length === 0) {
      const result = await this.executeMCPAction('extractStructuredData', { enableSemanticProcessing: true });
      if (result.semanticSections) {
        await this.processSemanticSections(result.semanticSections);
      } else {
        return 'No semantic content found on this page. Please try reading the page first.';
      }
    }

    try {
      const results = await this.semanticSearch.findMostRelevantSections(query, this.semanticSections);

      if (results.length === 0) {
        return `No semantically relevant content found for "${query}". Try different keywords or use the regular "find" command.`;
      }

      let response = `**Found ${results.length} semantically relevant sections for "${query}":**\n\n`;

      results.forEach((section, index) => {
        const relevanceEmoji = this.getRelevanceEmoji(section.relevanceScore);
        response += `${index + 1}. ${relevanceEmoji} **${section.heading || 'Untitled Section'}**\n`;
        response += `   Relevance: ${section.relevanceLabel} (${Math.round(section.relevanceScore * 100)}%)\n`;
        response += `   Preview: ${section.text.substring(0, 150)}${section.text.length > 150 ? '...' : ''}\n\n`;
      });

      response += `📍 **Scroll to section [1-${results.length}]** to navigate to any result`;

      // Store semantic results for interactive scrolling
      this.currentSemanticResults = results;

      return response;
    } catch (error) {
      console.error('Semantic search failed:', error);
      return `Semantic search failed: ${error.message}. Please try again or use regular search.`;
    }
  }

  async handleSemanticScroll(query) {
    if (!this.semanticSearch) {
      return 'Semantic scroll is not available. Please try reading the page first to enable semantic processing.';
    }

    if (this.semanticSections.length === 0) {
      const result = await this.executeMCPAction('extractStructuredData', { enableSemanticProcessing: true });
      if (result.semanticSections) {
        await this.processSemanticSections(result.semanticSections);
      } else {
        return 'No semantic content found on this page. Please try reading the page first.';
      }
    }

    try {
      const results = await this.semanticSearch.findMostRelevantSections(query, this.semanticSections);

      if (results.length === 0) {
        return `No semantically relevant content found for "${query}". Try different keywords.`;
      }

      const bestMatch = results[0];
      const scrollResult = await this.executeMCPAction('scrollToSection', { selector: bestMatch.selector });

      if (scrollResult && scrollResult.success) {
        return `🎯 **Smart scrolled to the most relevant section:**\n\n${bestMatch.heading || 'Untitled Section'}\nRelevance: ${bestMatch.relevanceLabel} (${Math.round(bestMatch.relevanceScore * 100)}%)`;
      } else {
        return `Failed to scroll to the semantic section: ${scrollResult?.error || 'Unknown error'}`;
      }
    } catch (error) {
      console.error('Semantic scroll failed:', error);
      return `Semantic scroll failed: ${error.message}. Please try again.`;
    }
  }

  getRelevanceEmoji(score) {
    if (score > 0.8) return '🎯';
    if (score > 0.6) return '✅';
    if (score > 0.4) return '👍';
    if (score > 0.2) return '🤔';
    return '❓';
  }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.chatBot = new ChatBot();
  window.chatBot.init();
});