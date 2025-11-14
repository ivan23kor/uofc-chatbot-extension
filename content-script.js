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

      if (request.action === 'mcpPageAction') {
        this.handleMCPPageAction(request.data).then(result => {
          sendResponse({ success: true, data: result });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true; // Keep channel open for async
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

  async handleMCPPageAction(data) {
    const { action, params } = data;
    console.log('MCP Page Action:', action, params);

    try {
      switch (action) {
        case 'extractStructuredData':
          return this.extractStructuredData(params);
        case 'findSections':
          return this.findSections(params);
        case 'scrollToSection':
          return this.scrollToSection(params);
        case 'getAllLinks':
          return this.getAllLinks(params);
        case 'extractFormFields':
          return this.extractFormFields(params);
        case 'waitForElement':
          return this.waitForElement(params);
        case 'getComputedStyle':
          return this.getComputedStyle(params);
        default:
          throw new Error(`Unknown MCP page action: ${action}`);
      }
    } catch (error) {
      console.error('MCP page action failed:', error);
      throw error;
    }
  }

  extractStructuredData(params = {}) {
    const { includeImages = false, includeLinks = true, includeHeadings = true, enableSemanticProcessing = true } = params;

    const data = {
      title: document.title,
      url: window.location.href,
      description: this.getMetaDescription(),
      headings: includeHeadings ? this.extractHeadings() : [],
      links: includeLinks ? this.extractLinks() : [],
      images: includeImages ? this.extractImages() : [],
      text: this.getMainTextContent(),
      forms: this.extractForms(),
      tables: this.extractTables(),
      semanticSections: enableSemanticProcessing ? this.extractSemanticSections() : []
    };

    return data;
  }

  getMetaDescription() {
    const metaDesc = document.querySelector('meta[name="description"]');
    return metaDesc ? metaDesc.getAttribute('content') : '';
  }

  extractHeadings() {
    const headings = [];
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
      document.querySelectorAll(tag).forEach((heading, index) => {
        headings.push({
          level: parseInt(tag.substring(1)),
          text: heading.innerText.trim(),
          id: heading.id,
          selector: `${tag}:nth-of-type(${index + 1})`,
          rect: this.getElementRect(heading)
        });
      });
    });
    return headings;
  }

  extractLinks() {
    return Array.from(document.querySelectorAll('a[href]')).map((link, index) => ({
      text: link.innerText.trim(),
      href: link.href,
      title: link.title,
      target: link.target,
      selector: `a[href]:nth-of-type(${index + 1})`,
      rect: this.getElementRect(link)
    }));
  }

  extractImages() {
    return Array.from(document.querySelectorAll('img')).map((img, index) => ({
      src: img.src,
      alt: img.alt,
      title: img.title,
      width: img.width,
      height: img.height,
      selector: `img:nth-of-type(${index + 1})`,
      rect: this.getElementRect(img)
    }));
  }

  getMainTextContent() {
    // Try to find main content area
    const mainSelectors = ['main', '[role="main"]', '.main-content', '#main', 'article'];
    let mainElement = null;

    for (const selector of mainSelectors) {
      mainElement = document.querySelector(selector);
      if (mainElement) break;
    }

    if (mainElement) {
      return mainElement.innerText.trim();
    }

    // Fallback to body, but try to exclude navigation and footers
    const excludeSelectors = ['nav', 'header', 'footer', '.nav', '.navigation', '.menu'];
    let content = document.body.cloneNode(true);

    excludeSelectors.forEach(selector => {
      const elements = content.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });

    return content.innerText.trim();
  }

  extractForms() {
    return Array.from(document.querySelectorAll('form')).map((form, index) => ({
      action: form.action,
      method: form.method,
      fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
        name: field.name,
        type: field.type,
        id: field.id,
        required: field.required,
        placeholder: field.placeholder,
        value: field.value
      })),
      selector: `form:nth-of-type(${index + 1})`
    }));
  }

  extractTables() {
    return Array.from(document.querySelectorAll('table')).map((table, index) => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim());
      const rows = Array.from(table.querySelectorAll('tr')).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())
      );

      return {
        headers,
        rows,
        selector: `table:nth-of-type(${index + 1})`
      };
    });
  }

  findSections(params = {}) {
    const { query } = params;
    const sections = [];

    if (query) {
      // Search for text content
      const allElements = document.querySelectorAll('*');
      for (const element of allElements) {
        if (element.innerText && element.innerText.toLowerCase().includes(query.toLowerCase())) {
          const rect = this.getElementRect(element);
          if (rect.width > 0 && rect.height > 0) {
            sections.push({
              text: element.innerText.trim().substring(0, 200),
              selector: this.getElementSelector(element),
              rect,
              tagName: element.tagName
            });
          }
        }
      }
    } else {
      // Return main sections (headings and their following content)
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach(heading => {
        let content = '';
        let nextElement = heading.nextElementSibling;

        // Collect content until next heading of same or higher level
        const currentLevel = parseInt(heading.tagName.substring(1));
        while (nextElement) {
          if (/^H[1-6]$/.test(nextElement.tagName)) {
            const nextLevel = parseInt(nextElement.tagName.substring(1));
            if (nextLevel <= currentLevel) break;
          }
          content += nextElement.innerText + '\n';
          nextElement = nextElement.nextElementSibling;
        }

        sections.push({
          heading: heading.innerText.trim(),
          content: content.trim(),
          headingSelector: this.getElementSelector(heading),
          rect: this.getElementRect(heading)
        });
      });
    }

    return sections;
  }

  async scrollToSection(params) {
    const { selector, x, y, behavior = 'smooth' } = params;

    if (selector) {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({ behavior, block: 'center' });

        // Highlight the scrolled element
        this.highlightElement(selector);

        return { success: true, selector, scrolled: true };
      } else {
        throw new Error(`Element not found: ${selector}`);
      }
    } else if (x !== undefined && y !== undefined) {
      window.scrollTo({ left: x, top: y, behavior });
      return { success: true, x, y, scrolled: true };
    } else {
      throw new Error('Either selector or coordinates must be provided');
    }
  }

  getAllLinks(params = {}) {
    const { filter } = params;
    let links = this.extractLinks();

    if (filter) {
      links = links.filter(link =>
        link.text.toLowerCase().includes(filter.toLowerCase()) ||
        link.href.toLowerCase().includes(filter.toLowerCase())
      );
    }

    return links;
  }

  extractFormFields(params = {}) {
    const { formSelector } = params;
    const forms = formSelector ?
      [document.querySelector(formSelector)] :
      Array.from(document.querySelectorAll('form'));

    return forms.filter(Boolean).map((form, index) => ({
      action: form.action,
      method: form.method,
      id: form.id,
      fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
        name: field.name,
        type: field.type,
        id: field.id,
        required: field.required,
        placeholder: field.placeholder,
        value: field.value,
        options: field.tagName === 'SELECT' ?
          Array.from(field.options).map(opt => ({ value: opt.value, text: opt.text })) :
          null
      })),
      submitButton: Array.from(form.querySelectorAll('button[type="submit"], input[type="submit"]')).map(btn => ({
        text: btn.innerText || btn.value,
        selector: this.getElementSelector(btn)
      }))
    }));
  }

  async waitForElement(params) {
    const { selector, timeout = 5000 } = params;

    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve({
          found: true,
          selector,
          element: this.getElementInfo(element)
        });
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve({
            found: true,
            selector,
            element: this.getElementInfo(element)
          });
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve({
          found: false,
          selector,
          timeout: true
        });
      }, timeout);
    });
  }

  getComputedStyle(params) {
    const { selector } = params;
    const element = document.querySelector(selector);

    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const styles = window.getComputedStyle(element);
    const importantStyles = [
      'display', 'position', 'visibility', 'opacity',
      'color', 'backgroundColor', 'fontSize', 'fontFamily',
      'width', 'height', 'margin', 'padding', 'border'
    ];

    const result = {};
    importantStyles.forEach(prop => {
      result[prop] = styles[prop];
    });

    return {
      selector,
      styles: result,
      rect: this.getElementRect(element)
    };
  }

  getElementRect(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x + window.scrollX,
      y: rect.y + window.scrollY,
      width: rect.width,
      height: rect.height
    };
  }

  getElementSelector(element) {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ').join('.')}`;

    // Generate a unique selector
    const tagName = element.tagName.toLowerCase();
    const parent = element.parentNode;
    if (!parent) return tagName;

    const siblings = Array.from(parent.children).filter(child => child.tagName === element.tagName);
    const index = siblings.indexOf(element);

    return `${tagName}:nth-of-type(${index + 1})`;
  }

  getElementInfo(element) {
    return {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      text: element.innerText.trim(),
      href: element.href,
      src: element.src,
      selector: this.getElementSelector(element),
      rect: this.getElementRect(element)
    };
  }

  extractSemanticSections() {
    const sections = [];
    const contentBlocks = this.identifyContentBlocks();

    contentBlocks.forEach((block, index) => {
      const section = this.createSemanticSection(block, index);
      if (section.content && section.content.length > 50) {
        sections.push(section);
      }
    });

    return sections;
  }

  identifyContentBlocks() {
    const blocks = [];
    const processedElements = new Set();

    // Find major content sections
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      if (processedElements.has(heading)) return;

      const section = this.extractSectionFromHeading(heading);
      if (section) {
        blocks.push(section);
        section.elements.forEach(el => processedElements.add(el));
      }
    });

    // Find semantic content areas without headings
    const semanticSelectors = [
      'article', 'section', '.content', '.post', '.entry',
      '[role="article"]', '[role="main"]', '.description',
      '.info', '.details', '.summary'
    ];

    semanticSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        if (processedElements.has(element)) return;

        const block = this.extractContentBlock(element);
        if (block && block.content.length > 100) {
          blocks.push(block);
          block.elements.forEach(el => processedElements.add(el));
        }
      });
    });

    // Add remaining meaningful text blocks
    const textBlocks = this.findTextBlocks(processedElements);
    blocks.push(...textBlocks);

    return blocks;
  }

  extractSectionFromHeading(heading) {
    const headingLevel = parseInt(heading.tagName.substring(1));
    let content = '';
    let elements = [heading];
    let nextElement = heading.nextElementSibling;

    while (nextElement) {
      if (/^H[1-6]$/.test(nextElement.tagName)) {
        const nextLevel = parseInt(nextElement.tagName.substring(1));
        if (nextLevel <= headingLevel) break;
      }

      content += nextElement.innerText + '\n';
      elements.push(nextElement);
      nextElement = nextElement.nextElementSibling;
    }

    return {
      heading: heading.innerText.trim(),
      content: content.trim(),
      elements: elements,
      type: 'heading-section',
      level: headingLevel,
      selector: this.getElementSelector(heading)
    };
  }

  extractContentBlock(element) {
    const text = element.innerText.trim();
    const links = Array.from(element.querySelectorAll('a')).map(link => ({
      text: link.innerText.trim(),
      href: link.href
    }));

    return {
      heading: this.getBlockTitle(element),
      content: text,
      elements: [element],
      type: 'semantic-block',
      links: links,
      selector: this.getElementSelector(element)
    };
  }

  getBlockTitle(element) {
    // Try to find a meaningful title for the content block
    const titleSelectors = [
      'h1, h2, h3, h4, h5, h6',
      '.title', '.headline', '.subject',
      '[aria-label]', 'title'
    ];

    for (const selector of titleSelectors) {
      const titleElement = element.querySelector(selector);
      if (titleElement && titleElement.innerText.trim()) {
        return titleElement.innerText.trim();
      }
    }

    // Use element's own attributes
    if (element.getAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    }
    if (element.getAttribute('title')) {
      return element.getAttribute('title');
    }
    if (element.id) {
      return element.id.replace(/[-_]/g, ' ');
    }

    // Extract first sentence as title
    const text = element.innerText.trim();
    const firstSentence = text.match(/^[^.!?]+[.!?]/);
    if (firstSentence) {
      return firstSentence[0].trim();
    }

    return null;
  }

  findTextBlocks(processedElements) {
    const blocks = [];
    const paragraphs = document.querySelectorAll('p, .paragraph, .text');

    paragraphs.forEach(p => {
      if (processedElements.has(p)) return;

      const text = p.innerText.trim();
      if (text.length > 100 && text.length < 1000) {
        const words = text.split(/\s+/);
        if (words.length > 20) {
          blocks.push({
            heading: null,
            content: text,
            elements: [p],
            type: 'text-block',
            selector: this.getElementSelector(p)
          });
        }
      }
    });

    return blocks;
  }

  createSemanticSection(block, index) {
    const sectionId = `semantic-section-${index}`;
    const selector = block.selector || `#${sectionId}`;

    // Add unique ID to the main element for easy targeting
    if (block.elements[0] && !block.elements[0].id) {
      block.elements[0].id = sectionId;
    }

    return {
      id: sectionId,
      heading: block.heading,
      text: block.content,
      selector: selector,
      type: block.type,
      links: block.links || [],
      rect: this.getElementRect(block.elements[0]),
      level: block.level || 0,
      content: this.extractContentForEmbedding(block)
    };
  }

  extractContentForEmbedding(block) {
    const parts = [];

    if (block.heading) {
      parts.push(block.heading);
    }

    if (block.content) {
      parts.push(block.content);
    }

    if (block.links && block.links.length > 0) {
      parts.push(...block.links.map(link => link.text));
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  sendMessage(message) {
    chrome.runtime.sendMessage(message).catch(error => {
      console.error('Failed to send message to service worker:', error);
    });
  }
}

// Initialize content script
new ContentScript();