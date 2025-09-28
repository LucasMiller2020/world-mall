import crypto from 'crypto';

// Multi-language toxicity patterns and keywords
const TOXIC_PATTERNS = {
  // English patterns
  en: {
    words: [
      'idiot', 'stupid', 'moron', 'retard', 'dumb', 'trash', 'garbage', 'pathetic',
      'loser', 'failure', 'worthless', 'useless', 'disgusting', 'hate', 'kill',
      'die', 'death', 'murder', 'violence', 'terror', 'threat', 'bomb', 'gun',
      'weapon', 'attack', 'destroy', 'annihilate'
    ],
    patterns: [
      /you\s+(are|r)\s+(stupid|dumb|an?\s+idiot)/i,
      /kill\s+your?self/i,
      /go\s+(die|kill\s+yourself)/i,
      /i\s+(hate|despise)\s+you/i,
      /\b(fuck|shit|damn)\s+(you|off|this)/i,
      /\b(nazi|hitler|genocide|holocaust\s+denial)/i
    ]
  },
  
  // Spanish patterns
  es: {
    words: [
      'idiota', 'estúpido', 'tonto', 'basura', 'patético', 'perdedor',
      'inútil', 'odio', 'matar', 'muerte', 'violencia', 'amenaza'
    ],
    patterns: [
      /eres\s+un?\s+(idiota|estúpido|tonto)/i,
      /vete\s+a\s+morir/i,
      /te\s+odio/i
    ]
  },
  
  // French patterns
  fr: {
    words: [
      'idiot', 'stupide', 'con', 'débile', 'nul', 'pourri', 'pathétique',
      'perdant', 'inutile', 'haine', 'tuer', 'mort', 'violence', 'menace'
    ],
    patterns: [
      /tu\s+es\s+un?\s+(idiot|con|débile)/i,
      /va\s+mourir/i,
      /je\s+te\s+déteste/i
    ]
  },
  
  // German patterns
  de: {
    words: [
      'idiot', 'dumm', 'blöd', 'müll', 'pathetic', 'verlierer',
      'nutzlos', 'hass', 'töten', 'tod', 'gewalt', 'drohung'
    ],
    patterns: [
      /du\s+bist\s+(dumm|blöd|ein\s+idiot)/i,
      /geh\s+sterben/i,
      /ich\s+hasse\s+dich/i
    ]
  },
  
  // Add more languages as needed...
  it: { words: ['idiota', 'stupido', 'scemo', 'spazzatura'], patterns: [] },
  pt: { words: ['idiota', 'estúpido', 'burro', 'lixo'], patterns: [] },
  ru: { words: ['идиот', 'глупый', 'дурак', 'мусор'], patterns: [] },
  ja: { words: ['ばか', 'あほ', 'くそ', 'ゴミ'], patterns: [] },
  ko: { words: ['바보', '멍청이', '쓰레기', '병신'], patterns: [] },
  zh: { words: ['笨蛋', '愚蠢', '垃圾', '白痴'], patterns: [] }
};

// Advanced spam detection patterns
const SPAM_PATTERNS = [
  // Crypto/financial spam
  /\b(bitcoin|btc|ethereum|eth|crypto|nft)\s+(investment|trading|profit|signals?)\b/i,
  /\b(guaranteed|easy|quick)\s+(money|profit|returns?|income)\b/i,
  /\bmake\s+\$?\d+\s*(per|\/)\s+(day|hour|week)\b/i,
  /\b(join|check)\s+(my|our)\s+(telegram|discord|whatsapp)\s+(group|channel)\b/i,
  
  // Generic spam patterns
  /\b(click|visit|check)\s+(link|url)\s+(in|below|here)\b/i,
  /\b(dm|message|contact)\s+me\s+(for|about|regarding)\b/i,
  /\bfollow\s+(me|us)\s+(on|@)\b/i,
  /\b(promo|discount|coupon)\s+code\b/i,
  /\b(limited|exclusive)\s+(time|offer)\b/i,
  
  // Repetitive patterns (relaxed - entropy check will handle real spam)
  // Removed simple character repetition check - now handled by entropy analysis
  /(\b\w+\b)\s+\1\s+\1\s+\1/i, // Quadruple word repetition (was triple)
  
  // Excessive emoji/symbols
  /[🎉🔥💰💎🚀📈]{3,}/g,
  /[!]{3,}/g,
];

// Scam detection patterns
const SCAM_PATTERNS = [
  /\b(nigerian|prince|inheritance|beneficiary)\b/i,
  /\b(won|lottery|jackpot|prize)\s+\$?\d+/i,
  /\b(verify|confirm)\s+(account|identity|payment)\b/i,
  /\b(suspended|blocked|frozen)\s+account\b/i,
  /\bclick\s+(here|link)\s+to\s+(claim|verify|activate)\b/i,
  /\b(phishing|malware|virus)\b/i,
  /\b(fake|scam|fraud|steal)\b/i,
];

// URL reputation checking
const SUSPICIOUS_DOMAINS = [
  'bit.ly', 'tinyurl.com', 'short.link', 't.co', 'ow.ly',
  'telegram.me', 'discord.gg', 'whatsapp.com'
];

const MALICIOUS_DOMAINS = [
  'phishing-site.com', 'fake-bank.net', 'scam-crypto.org'
  // In production, this would be a comprehensive database
];

export interface ContentAnalysisResult {
  // Core scores (0-100, higher = more problematic)
  toxicityScore: number;
  sentimentScore: number; // 0=very negative, 50=neutral, 100=very positive
  spamScore: number;
  scamScore: number;
  promotionalScore: number;
  
  // Detailed analysis
  detectedLanguages: string[];
  flaggedPatterns: string[];
  extractedUrls: {
    url: string;
    domain: string;
    reputation: 'safe' | 'suspicious' | 'malicious' | 'unknown';
    reputationScore: number;
  }[];
  
  // ML/semantic analysis
  semanticCategories: {
    category: string;
    confidence: number;
  }[];
  
  // Overall assessment
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: 'approve' | 'review' | 'auto_warn' | 'auto_hide' | 'auto_ban';
  
  // Metadata
  analysisVersion: string;
  processingTime: number;
}

export interface ContentSimilarityResult {
  contentHash: string;
  semanticHash: string;
  duplicateGroup?: string;
  similarityScore: number;
  isSpamCluster: boolean;
  wordCount: number;
  uniqueWordRatio: number;
  uppercaseRatio: number;
  urlCount: number;
}

export class AdvancedContentAnalyzer {
  private version = '1.0';
  
  /**
   * Performs comprehensive content analysis
   */
  async analyzeContent(
    content: string,
    language: string = 'en',
    context?: {
      room?: 'global' | 'work';
      authorTrustScore?: number;
      isFirstMessage?: boolean;
    }
  ): Promise<ContentAnalysisResult> {
    const startTime = Date.now();
    
    // Basic validation
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid content provided');
    }
    
    const normalizedContent = this.normalizeContent(content);
    
    // Run parallel analysis
    const [
      toxicityScore,
      sentimentScore,
      spamScore,
      scamScore,
      promotionalScore,
      detectedLanguages,
      flaggedPatterns,
      extractedUrls,
      semanticCategories
    ] = await Promise.all([
      this.analyzeToxicity(normalizedContent, language),
      this.analyzeSentiment(normalizedContent, language),
      this.analyzeSpam(normalizedContent, language),
      this.analyzeScam(normalizedContent, language),
      this.analyzePromotional(normalizedContent, language),
      this.detectLanguages(normalizedContent),
      this.detectPatterns(normalizedContent, language),
      this.analyzeUrls(content),
      this.analyzeSemanticCategories(normalizedContent, language)
    ]);
    
    // Calculate overall risk and recommendation
    const { riskLevel, recommendedAction } = this.calculateRiskAssessment({
      toxicityScore,
      sentimentScore,
      spamScore,
      scamScore,
      promotionalScore,
      context
    });
    
    const processingTime = Date.now() - startTime;
    
    return {
      toxicityScore,
      sentimentScore,
      spamScore,
      scamScore,
      promotionalScore,
      detectedLanguages,
      flaggedPatterns,
      extractedUrls,
      semanticCategories,
      riskLevel,
      recommendedAction,
      analysisVersion: this.version,
      processingTime
    };
  }
  
  /**
   * Analyzes content similarity for duplicate detection
   */
  analyzeContentSimilarity(content: string): ContentSimilarityResult {
    const normalizedContent = this.normalizeContent(content);
    
    // Generate content hashes
    const contentHash = crypto.createHash('md5').update(normalizedContent.toLowerCase()).digest('hex');
    const semanticHash = this.generateSemanticHash(normalizedContent);
    
    // Analyze content features
    const words = normalizedContent.split(/\s+/).filter(word => word.length > 0);
    const uniqueWords = new Set(words);
    const uppercaseChars = content.replace(/[^A-Z]/g, '').length;
    const totalChars = content.replace(/[^a-zA-Z]/g, '').length;
    const urls = this.extractUrls(content);
    
    return {
      contentHash,
      semanticHash,
      similarityScore: 0, // Will be calculated against existing content
      isSpamCluster: false, // Will be determined by clustering analysis
      wordCount: words.length,
      uniqueWordRatio: Math.round((uniqueWords.size / Math.max(words.length, 1)) * 100),
      uppercaseRatio: Math.round((uppercaseChars / Math.max(totalChars, 1)) * 100),
      urlCount: urls.length
    };
  }
  
  /**
   * Normalizes content for analysis
   */
  private normalizeContent(content: string): string {
    return content
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?;:'"()-]/g, '') // Remove special characters but keep punctuation
      .toLowerCase();
  }
  
  /**
   * Analyzes toxicity using multi-language patterns
   */
  private async analyzeToxicity(content: string, language: string): Promise<number> {
    let score = 0;
    const langPatterns = TOXIC_PATTERNS[language as keyof typeof TOXIC_PATTERNS] || TOXIC_PATTERNS.en;
    
    // Check toxic words
    for (const word of langPatterns.words) {
      if (content.includes(word)) {
        score += 15; // Each toxic word adds 15 points
      }
    }
    
    // Check toxic patterns
    for (const pattern of langPatterns.patterns) {
      if (pattern.test(content)) {
        score += 25; // Each toxic pattern adds 25 points
      }
    }
    
    // Cap at 100
    return Math.min(score, 100);
  }
  
  /**
   * Analyzes sentiment of content
   */
  private async analyzeSentiment(content: string, language: string): Promise<number> {
    // Simplified sentiment analysis
    // In production, this would use a proper NLP library
    
    const positiveWords = ['good', 'great', 'awesome', 'amazing', 'love', 'like', 'happy', 'excellent'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'horrible'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const word of positiveWords) {
      if (content.includes(word)) positiveCount++;
    }
    
    for (const word of negativeWords) {
      if (content.includes(word)) negativeCount++;
    }
    
    // Calculate sentiment score (0-100, 50 is neutral)
    const totalEmotionalWords = positiveCount + negativeCount;
    if (totalEmotionalWords === 0) return 50; // Neutral
    
    const positiveRatio = positiveCount / totalEmotionalWords;
    return Math.round(positiveRatio * 100);
  }
  
  /**
   * Analyzes spam patterns
   */
  private async analyzeSpam(content: string, language: string): Promise<number> {
    let score = 0;
    
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(content)) {
        score += 20;
      }
    }
    
    // Check for excessive repetition
    if (this.hasExcessiveRepetition(content)) {
      score += 30;
    }
    
    // Check for excessive capitalization
    if (this.hasExcessiveCapitalization(content)) {
      score += 15;
    }
    
    return Math.min(score, 100);
  }
  
  /**
   * Analyzes scam patterns
   */
  private async analyzeScam(content: string, language: string): Promise<number> {
    let score = 0;
    
    for (const pattern of SCAM_PATTERNS) {
      if (pattern.test(content)) {
        score += 30;
      }
    }
    
    return Math.min(score, 100);
  }
  
  /**
   * Analyzes promotional content
   */
  private async analyzePromotional(content: string, language: string): Promise<number> {
    let score = 0;
    
    const promotionalPatterns = [
      /\b(buy|purchase|order)\s+(now|today)\b/i,
      /\b(discount|sale|offer|deal)\b/i,
      /\b(subscribe|follow|like)\s+(me|us|our)\b/i,
      /\b(check\s+out|visit)\s+(my|our)\b/i,
    ];
    
    for (const pattern of promotionalPatterns) {
      if (pattern.test(content)) {
        score += 25;
      }
    }
    
    return Math.min(score, 100);
  }
  
  /**
   * Detects languages in content
   */
  private async detectLanguages(content: string): Promise<string[]> {
    // Simplified language detection
    // In production, this would use a proper language detection library
    
    const languagePatterns = {
      en: /\b(the|and|or|but|in|on|at|to|for|with|by)\b/g,
      es: /\b(el|la|los|las|y|o|pero|en|de|con|por|para)\b/g,
      fr: /\b(le|la|les|et|ou|mais|dans|de|avec|par|pour)\b/g,
      de: /\b(der|die|das|und|oder|aber|in|von|mit|für)\b/g,
      it: /\b(il|la|i|le|e|o|ma|in|di|con|per)\b/g,
      pt: /\b(o|a|os|as|e|ou|mas|em|de|com|por|para)\b/g,
    };
    
    const detected: string[] = [];
    
    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      const matches = content.match(pattern);
      if (matches && matches.length >= 2) {
        detected.push(lang);
      }
    }
    
    return detected.length > 0 ? detected : ['en']; // Default to English
  }
  
  /**
   * Detects harmful patterns in content
   */
  private async detectPatterns(content: string, language: string): Promise<string[]> {
    const flagged: string[] = [];
    
    // Check all pattern types
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(content)) {
        flagged.push('spam_pattern');
        break;
      }
    }
    
    for (const pattern of SCAM_PATTERNS) {
      if (pattern.test(content)) {
        flagged.push('scam_pattern');
        break;
      }
    }
    
    const langPatterns = TOXIC_PATTERNS[language as keyof typeof TOXIC_PATTERNS] || TOXIC_PATTERNS.en;
    for (const pattern of langPatterns.patterns) {
      if (pattern.test(content)) {
        flagged.push('toxicity_pattern');
        break;
      }
    }
    
    return flagged;
  }
  
  /**
   * Analyzes URLs in content
   */
  private async analyzeUrls(content: string): Promise<ContentAnalysisResult['extractedUrls']> {
    const urls = this.extractUrls(content);
    const analyzed: ContentAnalysisResult['extractedUrls'] = [];
    
    for (const url of urls) {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.toLowerCase();
        
        let reputation: 'safe' | 'suspicious' | 'malicious' | 'unknown' = 'unknown';
        let reputationScore = 50;
        
        if (MALICIOUS_DOMAINS.includes(domain)) {
          reputation = 'malicious';
          reputationScore = 90;
        } else if (SUSPICIOUS_DOMAINS.includes(domain)) {
          reputation = 'suspicious';
          reputationScore = 70;
        } else if (this.isSafeDomain(domain)) {
          reputation = 'safe';
          reputationScore = 10;
        }
        
        analyzed.push({
          url,
          domain,
          reputation,
          reputationScore
        });
      } catch (error) {
        // Invalid URL
        analyzed.push({
          url,
          domain: 'invalid',
          reputation: 'malicious',
          reputationScore: 100
        });
      }
    }
    
    return analyzed;
  }
  
  /**
   * Analyzes semantic categories
   */
  private async analyzeSemanticCategories(content: string, language: string): Promise<ContentAnalysisResult['semanticCategories']> {
    // Simplified semantic analysis
    // In production, this would use ML models
    
    const categories = [
      { category: 'technology', keywords: ['code', 'programming', 'software', 'app', 'website', 'ai', 'ml'], confidence: 0 },
      { category: 'business', keywords: ['startup', 'company', 'product', 'market', 'sales', 'revenue'], confidence: 0 },
      { category: 'help_request', keywords: ['help', 'problem', 'issue', 'stuck', 'error', 'how to'], confidence: 0 },
      { category: 'collaboration', keywords: ['team', 'together', 'collaborate', 'partner', 'join', 'group'], confidence: 0 },
      { category: 'spam', keywords: ['free money', 'get rich', 'click here', 'buy now', 'limited time'], confidence: 0 }
    ];
    
    for (const category of categories) {
      let matches = 0;
      for (const keyword of category.keywords) {
        if (content.includes(keyword)) {
          matches++;
        }
      }
      category.confidence = Math.min((matches / category.keywords.length) * 100, 100);
    }
    
    return categories.filter(cat => cat.confidence > 20);
  }
  
  /**
   * Calculates overall risk assessment
   */
  private calculateRiskAssessment(scores: {
    toxicityScore: number;
    sentimentScore: number;
    spamScore: number;
    scamScore: number;
    promotionalScore: number;
    context?: any;
  }): { riskLevel: ContentAnalysisResult['riskLevel']; recommendedAction: ContentAnalysisResult['recommendedAction'] } {
    
    const { toxicityScore, spamScore, scamScore, promotionalScore, context } = scores;
    
    // Calculate weighted risk score
    let riskScore = 0;
    riskScore += toxicityScore * 0.4; // Toxicity is most important
    riskScore += scamScore * 0.3; // Scams are serious
    riskScore += spamScore * 0.2; // Spam is annoying but less harmful
    riskScore += promotionalScore * 0.1; // Promotional content is least concerning
    
    // Adjust based on context
    if (context?.room === 'work' && promotionalScore > 30) {
      riskScore += 20; // Work mode is stricter about promotional content
    }
    
    if (context?.authorTrustScore && context.authorTrustScore < 30) {
      riskScore += 15; // Less trusted users get stricter moderation
    }
    
    if (context?.isFirstMessage) {
      riskScore += 10; // First messages get extra scrutiny
    }
    
    // Determine risk level and action
    let riskLevel: ContentAnalysisResult['riskLevel'];
    let recommendedAction: ContentAnalysisResult['recommendedAction'];
    
    if (riskScore >= 80) {
      riskLevel = 'critical';
      recommendedAction = 'auto_ban';
    } else if (riskScore >= 60) {
      riskLevel = 'high';
      recommendedAction = 'auto_hide';
    } else if (riskScore >= 40) {
      riskLevel = 'medium';
      recommendedAction = 'review';
    } else if (riskScore >= 20) {
      riskLevel = 'low';
      recommendedAction = 'auto_warn';
    } else {
      riskLevel = 'low';
      recommendedAction = 'approve';
    }
    
    return { riskLevel, recommendedAction };
  }
  
  /**
   * Extracts URLs from content
   */
  private extractUrls(content: string): string[] {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    return content.match(urlRegex) || [];
  }
  
  /**
   * Checks if domain is safe
   */
  private isSafeDomain(domain: string): boolean {
    const safeDomains = [
      'github.com', 'gitlab.com', 'stackoverflow.com', 'medium.com',
      'dev.to', 'twitter.com', 'x.com', 'linkedin.com', 'youtube.com',
      'docs.worldcoin.org', 'worldcoin.org', 'ethereum.org'
    ];
    
    return safeDomains.some(safe => domain === safe || domain.endsWith('.' + safe));
  }
  
  /**
   * Calculate Shannon entropy to detect low-diversity spam
   */
  private calculateEntropy(text: string): number {
    if (!text || text.length === 0) return 0;
    
    const charCounts = new Map<string, number>();
    for (const char of text) {
      charCounts.set(char, (charCounts.get(char) || 0) + 1);
    }
    
    let entropy = 0;
    const textLength = text.length;
    
    for (const count of charCounts.values()) {
      const probability = count / textLength;
      entropy -= probability * Math.log2(probability);
    }
    
    return entropy;
  }
  
  /**
   * Check if text is emoji-heavy
   */
  private isEmojiHeavy(text: string): boolean {
    // Regex to match emojis - covers most common emoji ranges
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
    const emojis = text.match(emojiRegex) || [];
    const emojiCount = emojis.length;
    
    // If more than 30% of the visible characters are emojis, consider it emoji-heavy
    const visibleChars = text.replace(/\s/g, '').length;
    return visibleChars > 0 && (emojiCount / visibleChars) > 0.3;
  }
  
  /**
   * Enhanced repetition check with entropy analysis
   */
  private hasExcessiveRepetition(content: string): boolean {
    // Allow emoji runs - they're expressive communication
    if (this.isEmojiHeavy(content)) {
      console.log('[content-analyzer] Allowing emoji-heavy content');
      return false;
    }
    
    // Common natural expressions that should be allowed
    const naturalExpressions = /^(a+h+|h+m+|z+z+|y+e+s+|n+o+|w+o+w+|o+h+|u+h+|e+h+)/i;
    if (naturalExpressions.test(content.replace(/[^a-z]/gi, '').toLowerCase())) {
      console.log('[content-analyzer] Allowing natural expression');
      return false;
    }
    
    // Calculate text entropy
    const entropy = this.calculateEntropy(content.toLowerCase());
    
    // Check for single character repetition
    const singleCharRepeat = /(.)\1{5,}/.exec(content);
    if (singleCharRepeat) {
      // Found 6+ repeated characters
      const repeatedChar = singleCharRepeat[0];
      const charRatio = repeatedChar.length / content.length;
      
      // For short messages (< 12 chars), be more lenient
      if (content.length < 12) {
        // Only block if it's almost all the same character AND entropy is very low
        if (charRatio > 0.75 && entropy < 1.5) {
          console.log(`[content-analyzer] Blocked: content_filter_low_entropy (entropy: ${entropy.toFixed(2)}, char_ratio: ${charRatio.toFixed(2)})`);
          return true;
        }
      } else {
        // For longer messages, use original thresholds
        if (charRatio > 0.5 && entropy < 2.0) {
          console.log(`[content-analyzer] Blocked: content_filter_low_entropy (entropy: ${entropy.toFixed(2)}, char_ratio: ${charRatio.toFixed(2)})`);
          return true;
        }
      }
      
      // For very low entropy with long repetitions, always block
      if (entropy < 0.5 && singleCharRepeat[0].length > 10) {
        console.log(`[content-analyzer] Blocked: content_filter_low_entropy - very low diversity (entropy: ${entropy.toFixed(2)})`);
        return true;
      }
    }
    
    // Allow natural elongations like "Howdyyyyy" or "Hellooooo"
    // These have reasonable entropy despite repetition
    if (entropy > 2.5) {
      // High entropy means diverse characters - likely natural language
      console.log(`[content-analyzer] Allowing content with good entropy: ${entropy.toFixed(2)}`);
      return false;
    }
    
    // Check for repeated words (less strict now)
    const words = content.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();
    let totalWords = 0;
    
    for (const word of words) {
      if (word.length > 2) {
        totalWords++;
        const count = wordCounts.get(word) || 0;
        wordCounts.set(word, count + 1);
        
        // Same word appears 5+ times and is majority of message
        if (count >= 4 && (count + 1) / totalWords > 0.6) {
          console.log(`[content-analyzer] Blocked: excessive word repetition`);
          return true;
        }
      }
    }
    
    // Check for patterns like "ababababab"
    if (content.length >= 8) {
      const pattern2 = /(..)(..)?\1{3,}/; // Pattern repeats 4+ times
      const pattern3 = /(...)(...)?(...)??\1{2,}/; // Pattern repeats 3+ times
      
      if (pattern2.test(content) && entropy < 2.0) {
        console.log(`[content-analyzer] Blocked: content_filter_low_entropy - repetitive pattern`);
        return true;
      }
      
      if (pattern3.test(content) && entropy < 1.5) {
        console.log(`[content-analyzer] Blocked: content_filter_low_entropy - very repetitive pattern`);
        return true;
      }
    }
    
    console.log(`[content-analyzer] Allowing content (entropy: ${entropy.toFixed(2)})`);
    return false;
  }
  
  /**
   * Checks for excessive capitalization
   */
  private hasExcessiveCapitalization(content: string): boolean {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 10) return false;
    
    const caps = content.replace(/[^A-Z]/g, '');
    const capsRatio = caps.length / letters.length;
    
    return capsRatio > 0.7; // More than 70% caps
  }
  
  /**
   * Generates semantic hash for similarity detection
   */
  private generateSemanticHash(content: string): string {
    // Simplified semantic hashing
    // Remove stop words and create hash of remaining words
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by'];
    const words = content.split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .sort()
      .join(' ');
    
    return crypto.createHash('md5').update(words).digest('hex');
  }
}

// Export singleton instance
export const contentAnalyzer = new AdvancedContentAnalyzer();