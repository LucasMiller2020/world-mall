import { storage } from './storage';
import { contentAnalyzer, type ContentAnalysisResult } from './content-analyzer';
import { moderationML } from './moderation-ml';
import type { 
  InsertModerationAction,
  InsertModerationAnalysis,
  InsertModerationQueue,
  InsertUserTrustScore,
  InsertContentSimilarity,
  ModerationAction,
  UserTrustScore
} from '@shared/schema';
import { randomUUID } from 'crypto';

// Action thresholds for automated responses
const ACTION_THRESHOLDS = {
  AUTO_APPROVE: 20,
  AUTO_WARN: 30,
  QUEUE_REVIEW: 50,
  AUTO_HIDE: 70,
  AUTO_BAN: 85
};

// User trust level thresholds
const TRUST_LEVELS = {
  NEW: { min: 0, max: 20 },
  BASIC: { min: 21, max: 40 },
  TRUSTED: { min: 41, max: 70 },
  VETERAN: { min: 71, max: 100 },
  RESTRICTED: { min: 0, max: 30 }, // Special case for problematic users
  SUSPENDED: { min: 0, max: 10 }   // Special case for banned users
};

// Context-specific moderation settings
const CONTEXT_MODIFIERS = {
  work: {
    promotional: 1.5,    // 50% stricter on promotional content
    spam: 1.3,           // 30% stricter on spam
    toxicity: 1.1,       // 10% stricter on toxicity
    scam: 1.2            // 20% stricter on scams
  },
  global: {
    promotional: 1.0,    // Standard enforcement
    spam: 1.0,
    toxicity: 1.0,
    scam: 1.0
  }
};

export interface ModerationDecision {
  action: 'approve' | 'warn' | 'hide' | 'delete' | 'temp_ban' | 'perm_ban' | 'review';
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration?: number; // hours for temporary actions
  requiresHumanReview: boolean;
  confidence: number; // 0-100
  evidence: {
    analysisScores: {
      toxicity: number;
      spam: number;
      scam: number;
      promotional: number;
      sentiment: number;
    };
    userFactors: {
      trustScore: number;
      violationHistory: number;
      accountAge: number;
    };
    contentFactors: {
      isDuplicate: boolean;
      hasUrls: boolean;
      languageDetected: string;
    };
    contextFactors: {
      room: string;
      isFirstMessage: boolean;
      timeOfDay: string;
    };
  };
}

export class AutomatedModerationEngine {
  
  /**
   * Main entry point for automated content moderation
   */
  async moderateContent(
    contentId: string,
    content: string,
    authorId: string,
    context: {
      room: 'global' | 'work';
      isFirstMessage?: boolean;
      hasUrls?: boolean;
      language?: string;
    }
  ): Promise<ModerationDecision> {
    
    try {
      // Step 1: Perform advanced content analysis
      const analysis = await moderationML.analyzeContentAdvanced(content, authorId, context);
      
      // Step 2: Get user moderation profile
      const userProfile = await this.getUserModerationContext(authorId);
      
      // Step 3: Apply context-specific modifiers
      const adjustedScores = this.applyContextModifiers(analysis, context.room);
      
      // Step 4: Calculate overall risk and make decision
      const decision = await this.makeAutomatedDecision(
        adjustedScores,
        userProfile,
        context,
        contentId
      );
      
      // Step 5: Store analysis and take action if needed
      await this.executeDecision(contentId, content, authorId, analysis, decision);
      
      return decision;
      
    } catch (error) {
      console.error('Error in automated moderation:', error);
      
      // Fallback to safe decision on error
      return {
        action: 'review',
        reason: 'Moderation system error - requires human review',
        severity: 'medium',
        requiresHumanReview: true,
        confidence: 0,
        evidence: this.createMinimalEvidence(content, authorId, context)
      };
    }
  }
  
  /**
   * Processes user appeals against moderation actions
   */
  async processAppeal(
    originalActionId: string,
    appellantId: string,
    reason: string,
    additionalContext?: string
  ): Promise<{
    accepted: boolean;
    newAction?: ModerationAction;
    reviewRequired: boolean;
    reason: string;
  }> {
    
    const originalAction = await storage.getModerationAction(originalActionId);
    if (!originalAction) {
      throw new Error('Original action not found');
    }
    
    // Get user's trust score and history
    const userTrust = await storage.getUserTrustScore(appellantId) ?? null;
    const userHistory = await storage.getModerationActionsForUser(appellantId);
    
    // Analyze appeal merit
    const appealMerit = this.analyzeAppealMerit(
      originalAction,
      userTrust,
      userHistory,
      reason
    );
    
    // Auto-approve appeals for trusted users with minor violations
    if (appealMerit.autoApprove) {
      const newAction = await this.createAppealResolutionAction(
        originalAction,
        'approve',
        'Appeal auto-approved for trusted user'
      );
      
      return {
        accepted: true,
        newAction,
        reviewRequired: false,
        reason: 'Appeal automatically approved based on user trust and violation severity'
      };
    }
    
    // Auto-reject appeals for severely problematic content
    if (appealMerit.autoReject) {
      return {
        accepted: false,
        reviewRequired: false,
        reason: 'Appeal rejected due to severity of violation and user history'
      };
    }
    
    // Queue for human review
    await this.queueAppealForReview(originalActionId, appellantId, reason, additionalContext);
    
    return {
      accepted: false,
      reviewRequired: true,
      reason: 'Appeal queued for human review'
    };
  }
  
  /**
   * Updates user trust scores based on behavior and feedback
   */
  async updateUserTrustScore(
    humanId: string,
    event: {
      type: 'message_posted' | 'report_received' | 'report_made' | 'moderation_action' | 'appeal_result';
      details: any;
    }
  ): Promise<UserTrustScore> {
    
    let trustScore = await storage.getUserTrustScore(humanId);
    
    if (!trustScore) {
      // Create initial trust score for new user
      trustScore = await storage.createUserTrustScore({
        humanId,
        overallTrustScore: 50, // Start at neutral
        contentQualityScore: 50,
        communityEngagementScore: 50,
        reportAccuracyScore: 50,
        totalMessages: 0,
        totalReportsReceived: 0,
        totalReportsMade: 0,
        accurateReports: 0,
        falseReports: 0,
        warningsCount: 0,
        tempBansCount: 0,
        daysWithoutViolation: 0,
        trustLevel: 'new',
        canReportUsers: true,
        requiresReview: false,
        maxDailyMessages: 50 // New users have lower limits
      });
    }
    
    // Update based on event type
    const updates = this.calculateTrustScoreUpdates(trustScore, event);
    
    // Apply updates
    const updatedTrustScore = await storage.updateUserTrustScore(humanId, updates);
    
    // Update trust level and permissions
    await this.updateUserPermissions(updatedTrustScore);
    
    return updatedTrustScore;
  }
  
  /**
   * Performs background cleanup of expired moderation actions
   */
  async cleanupExpiredActions(): Promise<void> {
    await storage.expireModerationActions();
  }
  
  /**
   * Checks if user should be subject to additional restrictions
   */
  async checkUserModerationStatus(humanId: string): Promise<{
    isBanned: boolean;
    isShadowBanned: boolean;
    isRestricted: boolean;
    trustLevel: string;
    requiresReview: boolean;
    maxDailyMessages: number;
    activeRestrictions: ModerationAction[];
  }> {
    
    const activeActions = await storage.getActiveModerationActions(humanId);
    const trustScore = await storage.getUserTrustScore(humanId);
    
    const isBanned = activeActions.some(action => action.actionType === 'perm_ban');
    const isShadowBanned = activeActions.some(action => action.actionType === 'shadow_ban');
    const isRestricted = activeActions.some(action => 
      ['temp_ban', 'shadow_ban', 'warn'].includes(action.actionType)
    );
    
    return {
      isBanned,
      isShadowBanned,
      isRestricted,
      trustLevel: trustScore?.trustLevel || 'new',
      requiresReview: trustScore?.requiresReview || false,
      maxDailyMessages: trustScore?.maxDailyMessages || 50,
      activeRestrictions: activeActions
    };
  }
  
  // Private helper methods
  
  private async getUserModerationContext(humanId: string): Promise<{
    trustScore: UserTrustScore | null;
    recentViolations: number;
    accountAge: number;
    messageCount: number;
  }> {
    
    const trustScore = await storage.getUserTrustScore(humanId) ?? null;
    const human = await storage.getHuman(humanId);
    const recentActions = await storage.getModerationActionsForUser(humanId);
    
    // Calculate recent violations (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentViolations = recentActions.filter(action => 
      new Date(action.createdAt) > thirtyDaysAgo &&
      ['warn', 'hide', 'temp_ban', 'perm_ban'].includes(action.actionType)
    ).length;
    
    const accountAge = human ? 
      Math.floor((Date.now() - new Date(human.joinedAt).getTime()) / (24 * 60 * 60 * 1000)) : 0;
    
    return {
      trustScore,
      recentViolations,
      accountAge,
      messageCount: trustScore?.totalMessages || 0
    };
  }
  
  private applyContextModifiers(
    analysis: ContentAnalysisResult & any,
    room: 'global' | 'work'
  ): ContentAnalysisResult {
    
    const modifiers = CONTEXT_MODIFIERS[room];
    
    return {
      ...analysis,
      spamScore: Math.min(100, analysis.spamScore * modifiers.spam),
      scamScore: Math.min(100, analysis.scamScore * modifiers.scam),
      toxicityScore: Math.min(100, analysis.toxicityScore * modifiers.toxicity),
      promotionalScore: Math.min(100, analysis.promotionalScore * modifiers.promotional)
    };
  }
  
  private async makeAutomatedDecision(
    analysis: ContentAnalysisResult & any,
    userProfile: any,
    context: any,
    contentId: string
  ): Promise<ModerationDecision> {
    
    // Calculate weighted risk score
    let riskScore = 0;
    
    // Content factors (60% weight)
    riskScore += analysis.toxicityScore * 0.25;
    riskScore += analysis.spamScore * 0.15;
    riskScore += analysis.scamScore * 0.15;
    riskScore += analysis.promotionalScore * 0.05;
    
    // User factors (30% weight)
    const userTrustScore = userProfile.trustScore?.overallTrustScore || 50;
    const trustPenalty = Math.max(0, (50 - userTrustScore) * 0.6); // Penalty for low trust
    riskScore += trustPenalty * 0.3;
    
    // User behavior ML insights (10% weight)
    riskScore += analysis.userBehaviorRisk * 0.1;
    
    // Apply additional penalties
    if (userProfile.recentViolations > 0) {
      riskScore += userProfile.recentViolations * 5;
    }
    
    if (analysis.clusterAnalysis.isDuplicate && analysis.clusterAnalysis.clusterType === 'spam') {
      riskScore += 20;
    }
    
    if (context.isFirstMessage && userProfile.accountAge < 1) {
      riskScore += 10; // Extra scrutiny for new users' first posts
    }
    
    // Determine action based on risk score
    let action: ModerationDecision['action'];
    let severity: ModerationDecision['severity'];
    let reason: string;
    let requiresHumanReview = false;
    let duration: number | undefined;
    
    if (riskScore >= ACTION_THRESHOLDS.AUTO_BAN) {
      action = 'perm_ban';
      severity = 'critical';
      reason = 'Automated ban due to high-risk content and user behavior patterns';
      requiresHumanReview = true; // Critical actions should be reviewed
    } else if (riskScore >= ACTION_THRESHOLDS.AUTO_HIDE) {
      action = 'hide';
      severity = 'high';
      reason = 'Content hidden due to policy violations';
      
      // Consider temp ban for repeat offenders
      if (userProfile.recentViolations >= 3) {
        action = 'temp_ban';
        duration = Math.min(24 * 7, userProfile.recentViolations * 24); // Max 1 week
        reason = 'Temporary ban due to repeated violations';
      }
    } else if (riskScore >= ACTION_THRESHOLDS.QUEUE_REVIEW) {
      action = 'review';
      severity = 'medium';
      reason = 'Content flagged for human review';
      requiresHumanReview = true;
    } else if (riskScore >= ACTION_THRESHOLDS.AUTO_WARN) {
      action = 'warn';
      severity = 'low';
      reason = 'Content warning due to minor policy concerns';
    } else {
      action = 'approve';
      severity = 'low';
      reason = 'Content approved by automated system';
    }
    
    // Build evidence object
    const evidence = {
      analysisScores: {
        toxicity: analysis.toxicityScore,
        spam: analysis.spamScore,
        scam: analysis.scamScore,
        promotional: analysis.promotionalScore,
        sentiment: analysis.sentimentScore
      },
      userFactors: {
        trustScore: userTrustScore,
        violationHistory: userProfile.recentViolations,
        accountAge: userProfile.accountAge
      },
      contentFactors: {
        isDuplicate: analysis.clusterAnalysis.isDuplicate,
        hasUrls: analysis.extractedUrls.length > 0,
        languageDetected: analysis.detectedLanguages[0] || 'unknown'
      },
      contextFactors: {
        room: context.room,
        isFirstMessage: context.isFirstMessage || false,
        timeOfDay: new Date().getHours() < 12 ? 'morning' : 
                  new Date().getHours() < 18 ? 'afternoon' : 'evening'
      }
    };
    
    return {
      action,
      reason,
      severity,
      duration,
      requiresHumanReview,
      confidence: Math.round(100 - (riskScore * 0.5)), // Higher risk = lower confidence
      evidence
    };
  }
  
  private async executeDecision(
    contentId: string,
    content: string,
    authorId: string,
    analysis: ContentAnalysisResult & any,
    decision: ModerationDecision
  ): Promise<void> {
    
    // Store the analysis
    const analysisRecord: InsertModerationAnalysis = {
      contentId,
      contentType: 'message',
      contentText: content,
      language: analysis.detectedLanguages[0] || 'en',
      toxicityScore: analysis.toxicityScore,
      sentimentScore: analysis.sentimentScore,
      spamScore: analysis.spamScore,
      scamScore: analysis.scamScore,
      promotionalScore: analysis.promotionalScore,
      detectedLanguages: analysis.detectedLanguages,
      flaggedPatterns: analysis.flaggedPatterns,
      extractedUrls: analysis.extractedUrls,
      semanticCategories: analysis.semanticCategories,
      riskLevel: analysis.riskLevel,
      recommendedAction: analysis.recommendedAction,
      analysisVersion: analysis.analysisVersion,
      processingTime: analysis.processingTime
    };
    
    const storedAnalysis = await storage.createModerationAnalysis(analysisRecord);
    
    // Store content similarity data
    const similarity = contentAnalyzer.analyzeContentSimilarity(content);
    const similarityRecord: InsertContentSimilarity = {
      contentId,
      contentType: 'message',
      contentHash: similarity.contentHash,
      semanticHash: similarity.semanticHash,
      similarityScore: analysis.clusterAnalysis.similarityScore,
      isSpamCluster: analysis.clusterAnalysis.clusterType === 'spam',
      wordCount: similarity.wordCount,
      uniqueWordRatio: similarity.uniqueWordRatio,
      uppercaseRatio: similarity.uppercaseRatio,
      urlCount: similarity.urlCount
    };
    
    await storage.createContentSimilarity(similarityRecord);
    
    // Take action if needed
    if (decision.action !== 'approve') {
      await this.executeModerationAction(
        contentId,
        authorId,
        decision,
        storedAnalysis.id
      );
    }
    
    // Queue for human review if required
    if (decision.requiresHumanReview) {
      await this.queueForHumanReview(contentId, decision, storedAnalysis.id);
    }
    
    // Update user trust score
    await this.updateUserTrustScore(authorId, {
      type: 'moderation_action',
      details: { action: decision.action, severity: decision.severity }
    });
  }
  
  private async executeModerationAction(
    contentId: string,
    targetId: string,
    decision: ModerationDecision,
    analysisId: string
  ): Promise<void> {
    
    const actionRecord = {
      targetId: contentId,
      targetType: 'message',
      moderatorType: 'auto',
      actionType: decision.action as any,
      reason: decision.reason,
      severity: decision.severity,
      durationHours: decision.duration,
      expiresAt: decision.duration ? 
        new Date(Date.now() + decision.duration * 60 * 60 * 1000) : undefined,
      analysisId,
      reportIds: [],
      evidence: {
        automatedFlags: Object.keys(decision.evidence.analysisScores),
        humanReports: 0,
        similarContent: [],
        userHistory: []
      },
      isAppeal: false,
      isOverride: false
    } as unknown as InsertModerationAction;
    
    await storage.createModerationAction(actionRecord);
    
    // Apply the action
    switch (decision.action) {
      case 'hide':
        await storage.hideMessage(contentId);
        break;
      case 'temp_ban':
      case 'perm_ban':
        // These would update user status in the humans table
        break;
    }
  }
  
  private async queueForHumanReview(
    contentId: string,
    decision: ModerationDecision,
    analysisId: string
  ): Promise<void> {
    
    const queueItem: InsertModerationQueue = {
      contentId,
      contentType: 'message',
      priority: decision.severity === 'critical' ? 'urgent' : 
                decision.severity === 'high' ? 'high' : 'medium',
      queueType: 'auto_flagged',
      analysisId,
      reportCount: 0,
      flaggedReasons: [decision.reason],
      status: 'pending'
    };
    
    await storage.createModerationQueueItem(queueItem);
  }
  
  private analyzeAppealMerit(
    originalAction: ModerationAction,
    userTrust: UserTrustScore | null,
    userHistory: ModerationAction[],
    reason: string
  ): { autoApprove: boolean; autoReject: boolean } {
    
    // Auto-approve conditions
    const isMinorViolation = originalAction.severity === 'low';
    const isTrustedUser = userTrust && userTrust.overallTrustScore > 70;
    const hasCleanHistory = userHistory.filter(a => 
      ['temp_ban', 'perm_ban'].includes(a.actionType)
    ).length === 0;
    const reasonableAppeal = reason.length > 20; // At least some explanation
    
    const autoApprove = isMinorViolation && isTrustedUser && hasCleanHistory && reasonableAppeal;
    
    // Auto-reject conditions
    const isSevereViolation = originalAction.severity === 'critical';
    const hasRecentBans = userHistory.filter(a => 
      ['temp_ban', 'perm_ban'].includes(a.actionType) &&
      new Date(a.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length > 0;
    
    const autoReject = isSevereViolation && hasRecentBans;
    
    return { autoApprove: !!autoApprove, autoReject: !!autoReject };
  }
  
  private async createAppealResolutionAction(
    originalAction: ModerationAction,
    resolution: 'approve' | 'deny',
    reason: string
  ): Promise<ModerationAction> {
    
    const newActionRecord = {
      targetId: originalAction.targetId,
      targetType: originalAction.targetType,
      moderatorType: 'auto',
      actionType: resolution === 'approve' ? 'restore' : originalAction.actionType,
      reason,
      severity: 'low',
      analysisId: originalAction.analysisId,
      reportIds: originalAction.reportIds,
      evidence: originalAction.evidence,
      isAppeal: true,
      isOverride: true,
      overriddenActionId: originalAction.id
    } as unknown as InsertModerationAction;
    
    return await storage.createModerationAction(newActionRecord);
  }
  
  private async queueAppealForReview(
    originalActionId: string,
    appellantId: string,
    reason: string,
    additionalContext?: string
  ): Promise<void> {
    
    // This would queue the appeal for human review
    // Implementation would depend on the appeal system design
  }
  
  private calculateTrustScoreUpdates(
    currentScore: UserTrustScore,
    event: { type: string; details: any }
  ): Partial<InsertUserTrustScore> {
    
    const updates: Partial<InsertUserTrustScore> = {};
    
    switch (event.type) {
      case 'message_posted':
        updates.totalMessages = currentScore.totalMessages + 1;
        break;
        
      case 'report_received':
        updates.totalReportsReceived = currentScore.totalReportsReceived + 1;
        // Decrease trust scores for receiving reports
        updates.overallTrustScore = Math.max(0, currentScore.overallTrustScore - 2);
        updates.contentQualityScore = Math.max(0, currentScore.contentQualityScore - 3);
        break;
        
      case 'moderation_action':
        if (event.details.action === 'warn') {
          updates.warningsCount = currentScore.warningsCount + 1;
          updates.overallTrustScore = Math.max(0, currentScore.overallTrustScore - 5);
        } else if (event.details.action === 'temp_ban') {
          updates.tempBansCount = currentScore.tempBansCount + 1;
          updates.overallTrustScore = Math.max(0, currentScore.overallTrustScore - 15);
          updates.requiresReview = true;
        }
        updates.lastViolationAt = new Date();
        updates.daysWithoutViolation = 0;
        break;
    }
    
    return updates;
  }
  
  private async updateUserPermissions(trustScore: UserTrustScore): Promise<void> {
    const updates: Partial<InsertUserTrustScore> = {};
    
    // Update trust level based on score
    if (trustScore.overallTrustScore >= TRUST_LEVELS.VETERAN.min) {
      updates.trustLevel = 'veteran';
      updates.maxDailyMessages = 500;
      updates.requiresReview = false;
    } else if (trustScore.overallTrustScore >= TRUST_LEVELS.TRUSTED.min) {
      updates.trustLevel = 'trusted';
      updates.maxDailyMessages = 300;
      updates.requiresReview = false;
    } else if (trustScore.overallTrustScore >= TRUST_LEVELS.BASIC.min) {
      updates.trustLevel = 'basic';
      updates.maxDailyMessages = 200;
    } else {
      updates.trustLevel = 'new';
      updates.maxDailyMessages = 50;
    }
    
    // Special cases for problematic users
    if (trustScore.tempBansCount > 3 || trustScore.warningsCount > 10) {
      updates.trustLevel = 'restricted';
      updates.maxDailyMessages = 25;
      updates.requiresReview = true;
    }
    
    if (Object.keys(updates).length > 0) {
      await storage.updateUserTrustScore(trustScore.humanId, updates);
    }
  }
  
  private createMinimalEvidence(content: string, authorId: string, context: any): ModerationDecision['evidence'] {
    return {
      analysisScores: {
        toxicity: 0,
        spam: 0,
        scam: 0,
        promotional: 0,
        sentiment: 50
      },
      userFactors: {
        trustScore: 50,
        violationHistory: 0,
        accountAge: 0
      },
      contentFactors: {
        isDuplicate: false,
        hasUrls: false,
        languageDetected: 'unknown'
      },
      contextFactors: {
        room: context.room,
        isFirstMessage: context.isFirstMessage || false,
        timeOfDay: 'unknown'
      }
    };
  }
}

// Export singleton instance
export const automatedModeration = new AutomatedModerationEngine();