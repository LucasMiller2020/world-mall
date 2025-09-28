import { contentAnalyzer, type ContentAnalysisResult } from './content-analyzer';
import { storage } from './storage';
import type { 
  UserTrustScore, 
  ModerationAction, 
  EnhancedReport,
  ContentSimilarity,
  ModerationAnalysis
} from '@shared/schema';

// User behavior patterns for ML analysis
interface UserBehaviorPattern {
  humanId: string;
  messageFrequency: number; // messages per hour
  reportFrequency: number; // reports received per message
  avgSentiment: number; // 0-100, higher = more positive
  contentVariety: number; // uniqueness of content 0-100
  engagementQuality: number; // stars per message ratio
  suspiciousActivity: {
    rapidPosting: boolean;
    repetitiveContent: boolean;
    linkSpamming: boolean;
    negativeEngagement: boolean;
  };
  riskScore: number; // 0-100, higher = more risky
  trustTrend: 'improving' | 'stable' | 'declining';
}

// Adaptive filtering rules that learn from feedback
interface AdaptiveFilterRule {
  id: string;
  ruleType: 'pattern' | 'keyword' | 'semantic';
  pattern: string;
  confidence: number; // 0-100
  falsePositiveRate: number; // 0-1
  truePositiveRate: number; // 0-1
  applicableLanguages: string[];
  context: 'global' | 'work' | 'both';
  isActive: boolean;
  createdAt: Date;
  lastUpdated: Date;
  performance: {
    totalTriggers: number;
    confirmedPositives: number;
    falsePositives: number;
    overrides: number;
  };
}

// Content clustering for spam detection
interface ContentCluster {
  clusterId: string;
  contentHashes: string[];
  semanticHashes: string[];
  clusterType: 'spam' | 'legitimate' | 'promotional' | 'unknown';
  confidence: number;
  representative: string; // representative content
  firstSeen: Date;
  lastSeen: Date;
  messageCount: number;
  uniqueAuthors: number;
  avgTrustScore: number;
}

export class ModerationMLEngine {
  private adaptiveRules: Map<string, AdaptiveFilterRule> = new Map();
  private contentClusters: Map<string, ContentCluster> = new Map();
  private userBehaviorCache: Map<string, UserBehaviorPattern> = new Map();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  
  constructor() {
    this.initializeDefaultRules();
    
    // Start background tasks
    this.startBehaviorAnalysis();
    this.startAdaptiveLearning();
  }
  
  /**
   * Performs advanced ML-based content analysis
   */
  async analyzeContentAdvanced(
    content: string,
    authorId: string,
    context: {
      room: 'global' | 'work';
      isFirstMessage?: boolean;
      previousMessages?: string[];
    }
  ): Promise<ContentAnalysisResult & {
    userBehaviorRisk: number;
    clusterAnalysis: {
      isDuplicate: boolean;
      clusterType?: string;
      similarityScore: number;
    };
    adaptiveFlags: string[];
  }> {
    
    // Get basic analysis
    const basicAnalysis = await contentAnalyzer.analyzeContent(
      content, 
      'en', // TODO: auto-detect language
      {
        room: context.room,
        authorTrustScore: await this.getUserTrustScore(authorId),
        isFirstMessage: context.isFirstMessage
      }
    );
    
    // Get user behavior analysis
    const userBehavior = await this.analyzeUserBehavior(authorId);
    const userBehaviorRisk = userBehavior.riskScore;
    
    // Perform content clustering analysis
    const clusterAnalysis = await this.analyzeContentClustering(content, authorId);
    
    // Apply adaptive filtering rules
    const adaptiveFlags = await this.applyAdaptiveFilters(content, context);
    
    // Adjust scores based on ML insights
    const adjustedAnalysis = this.adjustScoresWithML(
      basicAnalysis,
      userBehaviorRisk,
      clusterAnalysis,
      adaptiveFlags
    );
    
    return {
      ...adjustedAnalysis,
      userBehaviorRisk,
      clusterAnalysis,
      adaptiveFlags
    };
  }
  
  /**
   * Analyzes user behavior patterns for risk assessment
   */
  async analyzeUserBehavior(humanId: string): Promise<UserBehaviorPattern> {
    // Check cache first
    const cached = this.userBehaviorCache.get(humanId);
    if (cached && Date.now() - cached.riskScore < this.CACHE_TTL) {
      return cached;
    }
    
    // Get user's trust score and history
    const trustScore = await storage.getUserTrustScore(humanId);
    const recentActions = await storage.getModerationActionsForUser(humanId);
    const recentReports = await storage.getReportsByReporter(humanId);
    
    // Calculate behavior metrics
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    
    // Message frequency (simplified - would need actual message history)
    const messageFrequency = this.estimateMessageFrequency(humanId);
    
    // Report frequency
    const reportFrequency = await this.calculateReportFrequency(humanId);
    
    // Content analysis
    const contentMetrics = await this.analyzeUserContentPatterns(humanId);
    
    // Detect suspicious activities
    const suspiciousActivity = {
      rapidPosting: messageFrequency > 10, // More than 10 messages per hour
      repetitiveContent: contentMetrics.uniqueness < 30,
      linkSpamming: contentMetrics.linkRatio > 0.5,
      negativeEngagement: contentMetrics.avgSentiment < 30
    };
    
    // Calculate overall risk score
    let riskScore = 0;
    if (suspiciousActivity.rapidPosting) riskScore += 25;
    if (suspiciousActivity.repetitiveContent) riskScore += 30;
    if (suspiciousActivity.linkSpamming) riskScore += 35;
    if (suspiciousActivity.negativeEngagement) riskScore += 20;
    
    // Adjust based on trust score
    if (trustScore) {
      riskScore = Math.max(0, riskScore - (trustScore.overallTrustScore / 2));
    }
    
    // Determine trust trend
    const trustTrend = this.calculateTrustTrend(humanId, recentActions);
    
    const pattern: UserBehaviorPattern = {
      humanId,
      messageFrequency,
      reportFrequency,
      avgSentiment: contentMetrics.avgSentiment,
      contentVariety: contentMetrics.uniqueness,
      engagementQuality: contentMetrics.engagementRatio,
      suspiciousActivity,
      riskScore: Math.min(100, riskScore),
      trustTrend
    };
    
    // Cache the result
    this.userBehaviorCache.set(humanId, pattern);
    
    return pattern;
  }
  
  /**
   * Performs content clustering analysis for spam detection
   */
  async analyzeContentClustering(content: string, authorId: string): Promise<{
    isDuplicate: boolean;
    clusterType?: string;
    similarityScore: number;
  }> {
    
    const similarity = contentAnalyzer.analyzeContentSimilarity(content);
    
    // Find similar content in existing clusters
    let bestMatch: ContentCluster | null = null;
    let bestSimilarity = 0;
    
    for (const cluster of this.contentClusters.values()) {
      // Check if any content in the cluster is similar
      for (const hash of cluster.semanticHashes) {
        const score = this.calculateSemanticSimilarity(similarity.semanticHash, hash);
        if (score > bestSimilarity) {
          bestSimilarity = score;
          bestMatch = cluster;
        }
      }
    }
    
    const isDuplicate = bestSimilarity > 80; // 80% similarity threshold
    
    // Update or create cluster
    if (bestMatch && bestSimilarity > 70) {
      this.updateContentCluster(bestMatch, similarity, authorId);
    } else if (bestSimilarity < 70) {
      // Create new cluster if content is unique enough
      this.createNewContentCluster(similarity, authorId);
    }
    
    return {
      isDuplicate,
      clusterType: bestMatch?.clusterType,
      similarityScore: bestSimilarity
    };
  }
  
  /**
   * Applies adaptive filtering rules that learn from feedback
   */
  async applyAdaptiveFilters(content: string, context: {
    room: 'global' | 'work';
  }): Promise<string[]> {
    
    const flags: string[] = [];
    
    for (const rule of this.adaptiveRules.values()) {
      if (!rule.isActive) continue;
      
      // Check if rule applies to current context
      if (rule.context !== 'both' && rule.context !== context.room) continue;
      
      // Apply the rule
      let matches = false;
      
      switch (rule.ruleType) {
        case 'pattern':
          matches = new RegExp(rule.pattern, 'i').test(content);
          break;
        case 'keyword':
          matches = content.toLowerCase().includes(rule.pattern.toLowerCase());
          break;
        case 'semantic':
          // Simplified semantic matching (would use embeddings in production)
          matches = this.semanticMatch(content, rule.pattern) > 0.8;
          break;
      }
      
      if (matches) {
        // Consider rule confidence and performance
        if (rule.confidence > 60 && rule.performance.falsePositives < rule.performance.confirmedPositives) {
          flags.push(`adaptive_${rule.id}`);
        }
        
        // Update rule statistics
        rule.performance.totalTriggers++;
      }
    }
    
    return flags;
  }
  
  /**
   * Adjusts analysis scores based on ML insights
   */
  private adjustScoresWithML(
    basicAnalysis: ContentAnalysisResult,
    userBehaviorRisk: number,
    clusterAnalysis: any,
    adaptiveFlags: string[]
  ): ContentAnalysisResult {
    
    let adjusted = { ...basicAnalysis };
    
    // Adjust spam score based on user behavior
    if (userBehaviorRisk > 70) {
      adjusted.spamScore = Math.min(100, adjusted.spamScore + 20);
    }
    
    // Adjust based on content clustering
    if (clusterAnalysis.isDuplicate) {
      if (clusterAnalysis.clusterType === 'spam') {
        adjusted.spamScore = Math.min(100, adjusted.spamScore + 40);
      }
      adjusted.flaggedPatterns.push('duplicate_content');
    }
    
    // Adjust based on adaptive filters
    if (adaptiveFlags.length > 0) {
      adjusted.spamScore = Math.min(100, adjusted.spamScore + (adaptiveFlags.length * 15));
      adjusted.flaggedPatterns = [...adjusted.flaggedPatterns, ...adaptiveFlags];
    }
    
    // Recalculate risk level and recommended action
    const totalRisk = (
      adjusted.toxicityScore * 0.3 +
      adjusted.spamScore * 0.25 +
      adjusted.scamScore * 0.25 +
      userBehaviorRisk * 0.2
    );
    
    if (totalRisk >= 80) {
      adjusted.riskLevel = 'critical';
      adjusted.recommendedAction = 'auto_ban';
    } else if (totalRisk >= 60) {
      adjusted.riskLevel = 'high';
      adjusted.recommendedAction = 'auto_hide';
    } else if (totalRisk >= 40) {
      adjusted.riskLevel = 'medium';
      adjusted.recommendedAction = 'review';
    } else {
      adjusted.riskLevel = 'low';
      adjusted.recommendedAction = 'approve';
    }
    
    return adjusted;
  }
  
  /**
   * Learns from moderation feedback to improve filtering
   */
  async learnFromFeedback(
    analysisId: string,
    action: ModerationAction,
    wasCorrect: boolean
  ): Promise<void> {
    
    // Get the original analysis
    const analysis = await storage.getModerationAnalysis(analysisId);
    if (!analysis) return;
    
    // Update adaptive rules that were triggered
    for (const pattern of analysis.flaggedPatterns) {
      if (pattern.startsWith('adaptive_')) {
        const ruleId = pattern.replace('adaptive_', '');
        const rule = this.adaptiveRules.get(ruleId);
        
        if (rule) {
          if (wasCorrect) {
            rule.performance.confirmedPositives++;
            rule.confidence = Math.min(100, rule.confidence + 2);
          } else {
            rule.performance.falsePositives++;
            rule.confidence = Math.max(0, rule.confidence - 5);
          }
          
          // Disable rule if performance is poor
          if (rule.performance.falsePositives > rule.performance.confirmedPositives * 2) {
            rule.isActive = false;
          }
          
          rule.lastUpdated = new Date();
        }
      }
    }
    
    // Update content clusters based on feedback
    await this.updateClustersFromFeedback(analysis.contentId, wasCorrect);
  }
  
  /**
   * Performs sentiment analysis on text
   */
  async performSentimentAnalysis(text: string, language: string = 'en'): Promise<{
    sentiment: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
    confidence: number;
    score: number; // -1 to 1
  }> {
    
    // Simplified sentiment analysis (would use proper NLP models in production)
    const positiveWords = this.getPositiveWords(language);
    const negativeWords = this.getNegativeWords(language);
    const intensifiers = ['very', 'extremely', 'really', 'absolutely', 'totally'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    let emotionalWords = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const prevWord = i > 0 ? words[i - 1] : '';
      const multiplier = intensifiers.includes(prevWord) ? 2 : 1;
      
      if (positiveWords.includes(word)) {
        score += 1 * multiplier;
        emotionalWords++;
      } else if (negativeWords.includes(word)) {
        score -= 1 * multiplier;
        emotionalWords++;
      }
    }
    
    // Normalize score
    const normalizedScore = emotionalWords > 0 ? score / emotionalWords : 0;
    const confidence = Math.min(100, emotionalWords * 10); // More emotional words = higher confidence
    
    let sentiment: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
    if (normalizedScore <= -0.6) sentiment = 'very_negative';
    else if (normalizedScore <= -0.2) sentiment = 'negative';
    else if (normalizedScore >= 0.6) sentiment = 'very_positive';
    else if (normalizedScore >= 0.2) sentiment = 'positive';
    else sentiment = 'neutral';
    
    return {
      sentiment,
      confidence,
      score: Math.max(-1, Math.min(1, normalizedScore))
    };
  }
  
  /**
   * Detects coordinated inauthentic behavior
   */
  async detectCoordinatedBehavior(
    messageIds: string[],
    timeWindow: number = 60 * 60 * 1000 // 1 hour
  ): Promise<{
    isCoordinated: boolean;
    confidence: number;
    patterns: string[];
    involvedUsers: string[];
  }> {
    
    // This would analyze patterns across multiple users and messages
    // For now, return a simplified implementation
    
    return {
      isCoordinated: false,
      confidence: 0,
      patterns: [],
      involvedUsers: []
    };
  }
  
  // Private helper methods
  
  private initializeDefaultRules(): void {
    const defaultRules: AdaptiveFilterRule[] = [
      {
        id: 'crypto_pump',
        ruleType: 'pattern',
        pattern: '(to the moon|diamond hands|hodl)',
        confidence: 75,
        falsePositiveRate: 0.1,
        truePositiveRate: 0.8,
        applicableLanguages: ['en'],
        context: 'both',
        isActive: true,
        createdAt: new Date(),
        lastUpdated: new Date(),
        performance: {
          totalTriggers: 0,
          confirmedPositives: 0,
          falsePositives: 0,
          overrides: 0
        }
      }
    ];
    
    defaultRules.forEach(rule => {
      this.adaptiveRules.set(rule.id, rule);
    });
  }
  
  private startBehaviorAnalysis(): void {
    // Run behavior analysis every 10 minutes
    setInterval(async () => {
      await this.analyzeBehaviorPatterns();
    }, 10 * 60 * 1000);
  }
  
  private startAdaptiveLearning(): void {
    // Update adaptive rules every hour
    setInterval(async () => {
      await this.updateAdaptiveRules();
    }, 60 * 60 * 1000);
  }
  
  private async analyzeBehaviorPatterns(): Promise<void> {
    // Analyze patterns across all users
    // This would be more sophisticated in production
  }
  
  private async updateAdaptiveRules(): Promise<void> {
    // Update rule performance and confidence
    // Disable poorly performing rules
    // Create new rules based on patterns
  }
  
  private estimateMessageFrequency(humanId: string): number {
    // This would query actual message history
    return Math.random() * 5; // Placeholder
  }
  
  private async calculateReportFrequency(humanId: string): Promise<number> {
    const trustScore = await storage.getUserTrustScore(humanId);
    if (!trustScore) return 0;
    
    const totalMessages = trustScore.totalMessages;
    const totalReports = trustScore.totalReportsReceived;
    
    return totalMessages > 0 ? totalReports / totalMessages : 0;
  }
  
  private async analyzeUserContentPatterns(humanId: string): Promise<{
    uniqueness: number;
    linkRatio: number;
    avgSentiment: number;
    engagementRatio: number;
  }> {
    // This would analyze the user's message history
    return {
      uniqueness: 70 + Math.random() * 30,
      linkRatio: Math.random() * 0.3,
      avgSentiment: 50 + Math.random() * 40,
      engagementRatio: Math.random() * 2
    };
  }
  
  private calculateTrustTrend(humanId: string, recentActions: ModerationAction[]): 'improving' | 'stable' | 'declining' {
    if (recentActions.length === 0) return 'stable';
    
    const recentNegativeActions = recentActions.filter(action => 
      ['warn', 'hide', 'temp_ban'].includes(action.actionType)
    ).length;
    
    if (recentNegativeActions > 2) return 'declining';
    if (recentNegativeActions === 0) return 'improving';
    return 'stable';
  }
  
  private calculateSemanticSimilarity(hash1: string, hash2: string): number {
    // Simplified similarity calculation
    let matches = 0;
    const minLength = Math.min(hash1.length, hash2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (hash1[i] === hash2[i]) matches++;
    }
    
    return (matches / minLength) * 100;
  }
  
  private updateContentCluster(cluster: ContentCluster, similarity: any, authorId: string): void {
    cluster.contentHashes.push(similarity.contentHash);
    cluster.semanticHashes.push(similarity.semanticHash);
    cluster.lastSeen = new Date();
    cluster.messageCount++;
    // Update unique authors count and average trust score
  }
  
  private createNewContentCluster(similarity: any, authorId: string): void {
    const clusterId = `cluster_${Date.now()}`;
    const cluster: ContentCluster = {
      clusterId,
      contentHashes: [similarity.contentHash],
      semanticHashes: [similarity.semanticHash],
      clusterType: 'unknown',
      confidence: 50,
      representative: '', // Would store actual content
      firstSeen: new Date(),
      lastSeen: new Date(),
      messageCount: 1,
      uniqueAuthors: 1,
      avgTrustScore: 50
    };
    
    this.contentClusters.set(clusterId, cluster);
  }
  
  private semanticMatch(text1: string, text2: string): number {
    // Simplified semantic matching
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  private async updateClustersFromFeedback(contentId: string, wasCorrect: boolean): Promise<void> {
    // Update cluster classifications based on moderation feedback
  }
  
  private async getUserTrustScore(humanId: string): Promise<number> {
    const trustScore = await storage.getUserTrustScore(humanId);
    return trustScore?.overallTrustScore || 50;
  }
  
  private getPositiveWords(language: string): string[] {
    const wordLists = {
      en: ['good', 'great', 'awesome', 'amazing', 'love', 'like', 'happy', 'excellent', 'wonderful', 'fantastic'],
      es: ['bueno', 'genial', 'increíble', 'amor', 'feliz', 'excelente', 'maravilloso'],
      fr: ['bon', 'génial', 'incroyable', 'amour', 'heureux', 'excellent', 'merveilleux'],
      // Add more languages...
    };
    
    return wordLists[language as keyof typeof wordLists] || wordLists.en;
  }
  
  private getNegativeWords(language: string): string[] {
    const wordLists = {
      en: ['bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'horrible', 'disgusting'],
      es: ['malo', 'terrible', 'horrible', 'odio', 'triste', 'enfadado'],
      fr: ['mauvais', 'terrible', 'horrible', 'déteste', 'triste', 'en colère'],
      // Add more languages...
    };
    
    return wordLists[language as keyof typeof wordLists] || wordLists.en;
  }
}

// Export singleton instance
export const moderationML = new ModerationMLEngine();