class SemanticSearch {
  constructor() {
    this.apiKey = null;
    this.model = 'llama-3.3-70b-versatile';
    this.contentEmbeddings = new Map();
    this.searchCache = new Map();
  }

  async initialize(apiKey) {
    this.apiKey = apiKey;
  }

  async generateEmbedding(text) {
    if (!this.apiKey) throw new Error('API key not set');

    try {
      const response = await fetch('https://api.groq.com/openai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          input: text
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  }

  async processContentSections(sections) {
    const processedSections = [];

    for (const section of sections) {
      const content = this.extractContentForEmbedding(section);
      if (content && content.length > 50) {
        const embedding = await this.generateEmbedding(content);
        if (embedding) {
          this.contentEmbeddings.set(section.id, embedding);
          processedSections.push({
            ...section,
            content: content,
            embedding: embedding
          });
        }
      }
    }

    return processedSections;
  }

  extractContentForEmbedding(section) {
    const parts = [];

    if (section.heading) {
      parts.push(section.heading);
    }

    if (section.text) {
      parts.push(section.text);
    }

    if (section.links && section.links.length > 0) {
      parts.push(...section.links.map(link => link.text));
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  async semanticSearch(query, sections, maxResults = 5) {
    if (!this.apiKey) throw new Error('API key not set');

    const cacheKey = `${query}_${sections.length}`;
    if (this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey);
    }

    try {
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) return [];

      const similarities = sections
        .filter(section => this.contentEmbeddings.has(section.id))
        .map(section => ({
          section,
          similarity: this.calculateCosineSimilarity(
            queryEmbedding,
            this.contentEmbeddings.get(section.id)
          )
        }))
        .filter(result => result.similarity > 0.1)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxResults);

      const results = similarities.map(result => ({
        ...result.section,
        relevanceScore: result.similarity,
        relevanceLabel: this.getRelevanceLabel(result.similarity)
      }));

      this.searchCache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Error in semantic search:', error);
      return [];
    }
  }

  calculateCosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  getRelevanceLabel(similarity) {
    if (similarity > 0.8) return 'Very High';
    if (similarity > 0.6) return 'High';
    if (similarity > 0.4) return 'Medium';
    if (similarity > 0.2) return 'Low';
    return 'Very Low';
  }

  async findMostRelevantSections(userRequest, sections) {
    const searchTerms = this.extractSearchTerms(userRequest);
    const allResults = [];

    for (const term of searchTerms) {
      const results = await this.semanticSearch(term, sections);
      allResults.push(...results);
    }

    const deduplicatedResults = this.deduplicateResults(allResults);
    const rankedResults = deduplicatedResults
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3);

    return rankedResults;
  }

  extractSearchTerms(userRequest) {
    const terms = [];

    const scrollMatch = userRequest.match(/scroll\s+(?:to\s+)?(?:a\s+)?(?:section\s+)?(?:that\s+)?(?:mentions?|about|regarding|concerning)?\s*["']?(.+?)["']?$/i);
    if (scrollMatch) {
      terms.push(scrollMatch[1].trim());
    }

    const findMatch = userRequest.match(/find\s+(?:content|section|text)?\s*(?:about|regarding|concerning)?\s*["']?(.+?)["']?$/i);
    if (findMatch) {
      terms.push(findMatch[1].trim());
    }

    if (terms.length === 0) {
      terms.push(userRequest);
    }

    return terms;
  }

  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      if (seen.has(result.id)) {
        const existing = results.find(r => r.id === result.id);
        if (existing && result.relevanceScore > existing.relevanceScore) {
          existing.relevanceScore = result.relevanceScore;
          existing.relevanceLabel = result.relevanceLabel;
        }
        return false;
      }
      seen.add(result.id);
      return true;
    });
  }

  clearCache() {
    this.searchCache.clear();
  }

  clearEmbeddings() {
    this.contentEmbeddings.clear();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SemanticSearch;
} else if (typeof window !== 'undefined') {
  window.SemanticSearch = SemanticSearch;
}