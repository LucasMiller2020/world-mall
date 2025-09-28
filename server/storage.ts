import { 
  type Human, 
  type InsertHuman,
  type GuestSession,
  type InsertGuestSession,
  type Message,
  type InsertMessage,
  type Star,
  type InsertStar,
  type Report,
  type InsertReport,
  type Theme,
  type InsertTheme,
  type Topic,
  type InsertTopic,
  type TopicSchedule,
  type InsertTopicSchedule,
  type TopicEngagement,
  type InsertTopicEngagement,
  type TopicWithSchedule,
  type TopicAnalytics,
  type DailyTopicInfo,
  type AdminTopicSummary,
  type LedgerEntry,
  type InsertLedgerEntry,
  type ConnectRequest,
  type InsertConnectRequest,
  type Verification,
  type InsertVerification,
  // Invite system types
  type InviteCode,
  type InsertInviteCode,
  type Referral,
  type InsertReferral,
  type ReferralReward,
  type InsertReferralReward,
  type ReferralMilestone,
  type InsertReferralMilestone,
  type InviteAnalytics,
  type InsertInviteAnalytics,
  type ReferralLeaderboard,
  type InsertReferralLeaderboard,
  type InviteCodeWithStats,
  type ReferralWithDetails,
  type ReferralDashboard,
  type ReferralLeaderboardEntry,
  type InviteAnalyticsSummary,
  type ReferralSystemStats,
  // Token system types
  type SupportedToken,
  type InsertSupportedToken,
  type UserTokenBalance,
  type InsertUserTokenBalance,
  type TokenTransaction,
  type InsertTokenTransaction,
  type TokenDistributionEvent,
  type InsertTokenDistributionEvent,
  type Permit2Signature,
  type InsertPermit2Signature,
  type TokenSummary,
  type UserTokenSummary,
  type UserTokenHistory,
  type TokenBreakdown,
  type TokenDistributionSummary,
  type TokenLeaderboardEntry,
  type EnhancedHumanProfile,
  // Enhanced moderation system types
  type ModerationAnalysis,
  type InsertModerationAnalysis,
  type ModerationAction,
  type InsertModerationAction,
  type UserTrustScore,
  type InsertUserTrustScore,
  type EnhancedReport,
  type InsertEnhancedReport,
  type ContentSimilarity,
  type InsertContentSimilarity,
  type ModerationQueue,
  type InsertModerationQueue,
  type ModerationAppeal,
  type InsertModerationAppeal,
  type ModerationStats,
  type InsertModerationStats,
  type ModerationQueueItem,
  type ModerationDashboard,
  type UserModerationProfile,
  type ContentModerationResult,
  type ModerationAppealRequest,
  type ModerationReviewAction,
  type ModerationAnalytics,
  // Admin system types
  type SystemConfiguration,
  type InsertSystemConfiguration,
  type AdminActionLog,
  type InsertAdminActionLog,
  type AdminRole,
  type InsertAdminRole,
  type AdminUserRole,
  type InsertAdminUserRole,
  type SystemHealthMetric,
  type InsertSystemHealthMetric,
  type UserAnalytics,
  type InsertUserAnalytics,
  type ContentAnalytics,
  type InsertContentAnalytics,
  type EnhancedUserProfile,
  type InsertEnhancedUserProfile,
  type BulkOperation,
  type InsertBulkOperation,
  type SystemNotification,
  type InsertSystemNotification,
  type AdminDashboardData,
  type UserManagementFilters,
  type UserManagementResult,
  type ContentManagementFilters,
  type ContentManagementResult,
  type SystemAdminSettings,
  type SecurityAuditData,
  type AnalyticsDashboardData,
  // Legacy point system types (kept for backward compatibility)
  type UserPointBalance,
  type InsertUserPointBalance,
  type PointTransaction,
  type InsertPointTransaction,
  type DistributionEvent,
  type InsertDistributionEvent,
  type ParticipationMetric,
  type InsertParticipationMetric,
  type MessageWithAuthor,
  type HumanProfile,
  type OnlinePresence,
  type UserPointSummary,
  type UserPointHistory,
  type PointBreakdown,
  type LeaderboardEntry,
  type DistributionSummary,
  // Database tables
  humans,
  messages,
  stars,
  reports,
  themes,
  topics,
  topicSchedules,
  topicEngagement,
  rateLimits,
  ledgerEntries,
  connectRequests,
  verifications,
  guestSessions,
  // Invite system tables
  inviteCodes,
  referrals,
  referralRewards,
  referralMilestones,
  inviteAnalytics,
  referralLeaderboards,
  // Token system tables
  supportedTokens,
  userTokenBalances,
  tokenTransactions,
  tokenDistributionEvents,
  permit2Signatures,
  // Enhanced moderation system tables
  moderationAnalysis,
  moderationActions,
  userTrustScores,
  enhancedReports,
  contentSimilarity,
  moderationQueue,
  moderationAppeals,
  moderationStats,
  // Admin system tables
  systemConfigurations,
  adminActionLogs,
  adminRoles,
  adminUserRoles,
  systemHealthMetrics,
  userAnalytics,
  contentAnalytics,
  enhancedUserProfiles,
  bulkOperations,
  systemNotifications,
  // Legacy point system tables
  userPointBalances,
  pointTransactions,
  distributionEvents,
  participationMetrics
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, count, and, sql, gte } from "drizzle-orm";

export interface IStorage {
  // Human operations
  getHuman(id: string): Promise<Human | undefined>;
  createHuman(human: InsertHuman): Promise<Human>;
  updateHumanCapsuleSeen(id: string): Promise<void>;
  updateHumanMuteList(id: string, muteList: string[]): Promise<void>;
  updateHumanRole(id: string, role: 'guest' | 'verified' | 'admin'): Promise<void>;
  
  // Guest session operations
  getGuestSession(id: string): Promise<GuestSession | undefined>;
  getGuestSessionByHash(ipHash: string, userAgentHash: string): Promise<GuestSession | undefined>;
  createGuestSession(session: InsertGuestSession): Promise<GuestSession>;
  updateGuestSessionActivity(id: string): Promise<void>;
  incrementGuestMessageCount(id: string, dayBucket: string): Promise<void>;
  getGuestMessageCount(id: string, dayBucket: string): Promise<number>;
  
  // Message operations
  getMessages(room: string, limit?: number): Promise<MessageWithAuthor[]>;
  getMessageById(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  incrementMessageStars(messageId: string): Promise<void>;
  incrementMessageReports(messageId: string): Promise<void>;
  hideMessage(messageId: string): Promise<void>;
  
  // Star operations
  getUserStarForMessage(messageId: string, humanId: string): Promise<Star | undefined>;
  createStar(star: InsertStar): Promise<Star>;
  
  // Report operations
  createReport(report: InsertReport): Promise<Report>;
  getReportCountForMessage(messageId: string): Promise<number>;
  
  // Legacy theme operations (kept for backward compatibility)
  getThemeForDate(date: string): Promise<Theme | undefined>;
  createTheme(theme: InsertTheme): Promise<Theme>;
  
  // Enhanced topic system operations
  getTopic(id: string): Promise<Topic | undefined>;
  getTopics(filters?: { category?: string; status?: string; authorId?: string; limit?: number }): Promise<Topic[]>;
  createTopic(topic: InsertTopic): Promise<Topic>;
  updateTopic(id: string, updates: Partial<InsertTopic>): Promise<Topic | undefined>;
  deleteTopic(id: string): Promise<boolean>;
  
  // Topic scheduling operations
  getTopicSchedule(id: string): Promise<TopicSchedule | undefined>;
  getTopicScheduleByDate(date: string): Promise<TopicSchedule | undefined>;
  getTopicSchedules(filters?: { startDate?: string; endDate?: string; isActive?: boolean }): Promise<TopicSchedule[]>;
  createTopicSchedule(schedule: InsertTopicSchedule): Promise<TopicSchedule>;
  updateTopicSchedule(id: string, updates: Partial<InsertTopicSchedule>): Promise<TopicSchedule | undefined>;
  activateTopicSchedule(id: string): Promise<void>;
  deactivateTopicSchedule(id: string): Promise<void>;
  
  // Topic engagement operations
  getTopicEngagement(topicId: string, date: string): Promise<TopicEngagement | undefined>;
  updateTopicEngagement(engagement: InsertTopicEngagement): Promise<TopicEngagement>;
  getTopicEngagementHistory(topicId: string): Promise<TopicEngagement[]>;
  
  // Daily topic operations
  getCurrentTopic(): Promise<TopicWithSchedule | null>;
  getDailyTopicInfo(): Promise<DailyTopicInfo>;
  getUpcomingTopics(limit?: number): Promise<TopicWithSchedule[]>;
  getRecentTopics(limit?: number): Promise<TopicWithSchedule[]>;
  
  // Topic analytics operations
  getTopicAnalytics(topicId: string): Promise<TopicAnalytics | undefined>;
  getTopicsAnalytics(filters?: { category?: string; dateRange?: { start: string; end: string } }): Promise<TopicAnalytics[]>;
  getAdminTopicSummary(): Promise<AdminTopicSummary>;
  
  // Topic rotation operations
  rotateTopics(): Promise<void>;
  scheduleTopicRotation(date: string, topicId: string): Promise<TopicSchedule>;
  getTopicRotationSchedule(dateRange: { start: string; end: string }): Promise<TopicSchedule[]>;
  
  // Rate limiting
  getRateLimit(humanId: string, action: string, windowType: string): Promise<number>;
  incrementRateLimit(humanId: string, action: string, windowType: string): Promise<void>;
  
  // Ledger operations
  getLedgerEntries(limit?: number): Promise<LedgerEntry[]>;
  createLedgerEntry(entry: InsertLedgerEntry): Promise<LedgerEntry>;
  
  // Connect requests
  createConnectRequest(request: InsertConnectRequest): Promise<ConnectRequest>;
  
  // Verification operations
  getVerificationByNullifierHash(nullifierHashHashed: string): Promise<Verification | undefined>;
  createVerification(verification: InsertVerification): Promise<Verification>;
  
  // Profile operations
  getHumanProfile(humanId: string): Promise<HumanProfile | undefined>;
  
  // Presence
  getOnlinePresence(): Promise<OnlinePresence>;
  updatePresence(humanId: string): Promise<void>;

  // Point balance operations
  getUserPointBalance(humanId: string): Promise<UserPointBalance | undefined>;
  createUserPointBalance(balance: InsertUserPointBalance): Promise<UserPointBalance>;
  updateUserPointBalance(humanId: string, points: number, lifetimeEarned: number): Promise<void>;

  // Point transaction operations
  createPointTransaction(transaction: InsertPointTransaction): Promise<PointTransaction>;
  getUserPointTransactions(humanId: string, limit?: number): Promise<PointTransaction[]>;
  getUserPointHistory(humanId: string): Promise<UserPointHistory>;

  // Distribution event operations
  createDistributionEvent(event: InsertDistributionEvent): Promise<DistributionEvent>;
  getDistributionEvents(limit?: number): Promise<DistributionEvent[]>;
  getDistributionEventById(id: string): Promise<DistributionEvent | undefined>;

  // Participation metrics operations
  updateParticipationMetrics(humanId: string, room: string, metrics: Partial<InsertParticipationMetric>): Promise<void>;
  getParticipationMetrics(humanId: string, date: string, room: string): Promise<ParticipationMetric | undefined>;
  getUsersForDistribution(timeRange: { start: Date; end: Date }, room: string): Promise<ParticipationMetric[]>;

  // Leaderboard operations
  getLeaderboard(period: 'daily' | 'weekly' | 'all', limit?: number): Promise<LeaderboardEntry[]>;
  getUserRank(humanId: string, period: 'daily' | 'weekly' | 'all'): Promise<number>;

  // Point calculation operations
  calculateDailyDistribution(room: string): Promise<DistributionSummary>;
  calculateWeeklyDistribution(room: string): Promise<DistributionSummary>;
  executeDistribution(distributionSummary: DistributionSummary, distributionEventId: string): Promise<void>;
  
  // Topic engagement tracking
  recordTopicEngagement(messageId: string, topicId: string): Promise<void>;
  getMessageTopicEngagement(messageId: string): Promise<string | null>;

  // Invite system operations
  // Invite code operations
  getInviteCode(id: string): Promise<InviteCode | undefined>;
  getInviteCodeByCode(code: string): Promise<InviteCode | undefined>;
  getUserInviteCodes(humanId: string): Promise<InviteCodeWithStats[]>;
  createInviteCode(inviteCode: InsertInviteCode): Promise<InviteCode>;
  updateInviteCodeUsage(codeId: string): Promise<void>;
  deactivateInviteCode(codeId: string): Promise<void>;
  generateUniqueInviteCode(): Promise<string>;

  // Referral operations
  getReferral(id: string): Promise<Referral | undefined>;
  getReferralsByInviter(humanId: string): Promise<ReferralWithDetails[]>;
  getReferralsByInvitee(humanId: string): Promise<ReferralWithDetails[]>;
  createReferral(referral: InsertReferral): Promise<Referral>;
  updateReferralStatus(id: string, status: string): Promise<void>;
  getReferralCount(humanId: string): Promise<number>;
  validateInviteCode(code: string): Promise<{ valid: boolean; inviteCode?: InviteCode; reason?: string }>;

  // Referral reward operations
  getReferralReward(id: string): Promise<ReferralReward | undefined>;
  getReferralRewardsByHuman(humanId: string): Promise<ReferralReward[]>;
  createReferralReward(reward: InsertReferralReward): Promise<ReferralReward>;
  processReferralReward(rewardId: string): Promise<void>;
  calculateReferralRewards(referralId: string): Promise<InsertReferralReward[]>;
  distributeReferralRewards(referralId: string): Promise<void>;

  // Referral milestone operations
  getReferralMilestone(id: string): Promise<ReferralMilestone | undefined>;
  getUserMilestones(humanId: string): Promise<ReferralMilestone[]>;
  createReferralMilestone(milestone: InsertReferralMilestone): Promise<ReferralMilestone>;
  checkAndAwardMilestones(humanId: string): Promise<ReferralMilestone[]>;
  getNextMilestone(humanId: string): Promise<{ level: number; progress: number; remaining: number; reward: number } | undefined>;

  // Invite analytics operations
  getInviteAnalytics(id: string): Promise<InviteAnalytics | undefined>;
  getInviteAnalyticsByCode(codeId: string): Promise<InviteAnalytics[]>;
  createInviteAnalytics(analytics: InsertInviteAnalytics): Promise<InviteAnalytics>;
  getInviteAnalyticsSummary(codeId: string): Promise<InviteAnalyticsSummary>;
  trackInviteEvent(codeId: string, eventType: string, metadata?: any): Promise<void>;

  // Referral leaderboard operations
  getReferralLeaderboard(period: string, limit?: number): Promise<ReferralLeaderboardEntry[]>;
  updateReferralLeaderboards(): Promise<void>;
  getUserReferralRank(humanId: string, period: string): Promise<number>;

  // Referral dashboard operations
  getReferralDashboard(humanId: string): Promise<ReferralDashboard>;
  getReferralSystemStats(): Promise<ReferralSystemStats>;

  // Token system operations
  // Supported tokens operations
  getSupportedTokens(): Promise<SupportedToken[]>;
  getSupportedToken(id: string): Promise<SupportedToken | undefined>;
  getSupportedTokenByAddress(address: string, chainId: number): Promise<SupportedToken | undefined>;
  createSupportedToken(token: InsertSupportedToken): Promise<SupportedToken>;
  updateSupportedToken(id: string, updates: Partial<InsertSupportedToken>): Promise<SupportedToken | undefined>;
  deactivateSupportedToken(id: string): Promise<void>;

  // User token balance operations
  getUserTokenBalances(humanId: string): Promise<UserTokenBalance[]>;
  getUserTokenBalance(humanId: string, tokenId: string): Promise<UserTokenBalance | undefined>;
  createUserTokenBalance(balance: InsertUserTokenBalance): Promise<UserTokenBalance>;
  updateUserTokenBalance(humanId: string, tokenId: string, amount: string, lifetimeEarned: string): Promise<void>;
  getUserTokenSummary(humanId: string): Promise<UserTokenSummary>;

  // Token transaction operations
  createTokenTransaction(transaction: InsertTokenTransaction): Promise<TokenTransaction>;
  getUserTokenTransactions(humanId: string, tokenId?: string, limit?: number): Promise<TokenTransaction[]>;
  getUserTokenHistory(humanId: string): Promise<UserTokenHistory>;
  updateTokenTransactionStatus(id: string, status: string, txHash?: string): Promise<void>;

  // Token distribution event operations
  createTokenDistributionEvent(event: InsertTokenDistributionEvent): Promise<TokenDistributionEvent>;
  getTokenDistributionEvents(tokenId?: string, limit?: number): Promise<TokenDistributionEvent[]>;
  getTokenDistributionEventById(id: string): Promise<TokenDistributionEvent | undefined>;
  updateTokenDistributionEventStatus(id: string, status: string, txHash?: string): Promise<void>;

  // Permit2 signature operations
  createPermit2Signature(signature: InsertPermit2Signature): Promise<Permit2Signature>;
  getPermit2Signature(id: string): Promise<Permit2Signature | undefined>;
  getUnusedPermit2Signatures(humanId: string, tokenId: string): Promise<Permit2Signature[]>;
  markPermit2SignatureUsed(id: string, txHash: string): Promise<void>;

  // Token leaderboard operations
  getTokenLeaderboard(tokenId?: string, period?: 'daily' | 'weekly' | 'all', limit?: number): Promise<TokenLeaderboardEntry[]>;
  getUserTokenRank(humanId: string, tokenId?: string, period?: 'daily' | 'weekly' | 'all'): Promise<number>;

  // Token distribution calculation operations
  calculateDailyTokenDistribution(room: string, tokenId: string): Promise<TokenDistributionSummary>;
  calculateWeeklyTokenDistribution(room: string, tokenId: string): Promise<TokenDistributionSummary>;
  executeTokenDistribution(distributionSummary: TokenDistributionSummary, distributionEventId: string): Promise<void>;
  
  // Enhanced profile with token balances
  getEnhancedHumanProfile(humanId: string): Promise<EnhancedHumanProfile | undefined>;

  // ===== ENHANCED MODERATION SYSTEM METHODS =====
  
  // Moderation analysis operations
  getModerationAnalysis(contentId: string): Promise<ModerationAnalysis | undefined>;
  createModerationAnalysis(analysis: InsertModerationAnalysis): Promise<ModerationAnalysis>;
  getModerationAnalysisHistory(contentId: string): Promise<ModerationAnalysis[]>;
  
  // Moderation action operations
  getModerationAction(id: string): Promise<ModerationAction | undefined>;
  createModerationAction(action: InsertModerationAction): Promise<ModerationAction>;
  getModerationActionsForContent(contentId: string): Promise<ModerationAction[]>;
  getModerationActionsForUser(humanId: string): Promise<ModerationAction[]>;
  getActiveModerationActions(humanId: string): Promise<ModerationAction[]>;
  expireModerationActions(): Promise<void>;
  
  // User trust score operations
  getUserTrustScore(humanId: string): Promise<UserTrustScore | undefined>;
  createUserTrustScore(trustScore: InsertUserTrustScore): Promise<UserTrustScore>;
  updateUserTrustScore(humanId: string, updates: Partial<InsertUserTrustScore>): Promise<UserTrustScore>;
  calculateUserTrustScore(humanId: string): Promise<UserTrustScore>;
  getUsersByTrustLevel(trustLevel: string): Promise<UserTrustScore[]>;
  
  // Enhanced report operations
  getEnhancedReport(id: string): Promise<EnhancedReport | undefined>;
  createEnhancedReport(report: InsertEnhancedReport): Promise<EnhancedReport>;
  getReportsForMessage(messageId: string): Promise<EnhancedReport[]>;
  getReportsForUser(humanId: string): Promise<EnhancedReport[]>;
  getReportsByReporter(reporterHumanId: string): Promise<EnhancedReport[]>;
  updateReportStatus(id: string, status: string, resolution?: string): Promise<EnhancedReport>;
  
  // Content similarity operations
  getContentSimilarity(contentId: string): Promise<ContentSimilarity | undefined>;
  createContentSimilarity(similarity: InsertContentSimilarity): Promise<ContentSimilarity>;
  findSimilarContent(contentHash: string, semanticHash: string): Promise<ContentSimilarity[]>;
  getSpamClusters(): Promise<ContentSimilarity[]>;
  markAsSpamCluster(duplicateGroup: string): Promise<void>;
  
  // Moderation queue operations
  getModerationQueueItem(id: string): Promise<ModerationQueue | undefined>;
  createModerationQueueItem(item: InsertModerationQueue): Promise<ModerationQueue>;
  getModerationQueue(filters?: { 
    status?: string; 
    priority?: string; 
    assignedTo?: string; 
    queueType?: string;
    limit?: number;
  }): Promise<ModerationQueueItem[]>;
  updateModerationQueueItem(id: string, updates: Partial<InsertModerationQueue>): Promise<ModerationQueue>;
  assignModerationQueueItem(id: string, assignedTo: string): Promise<void>;
  resolveModerationQueueItem(id: string, actionTaken: string, reviewNotes?: string): Promise<void>;
  
  // Moderation appeal operations
  getModerationAppeal(id: string): Promise<ModerationAppeal | undefined>;
  createModerationAppeal(appeal: InsertModerationAppeal): Promise<ModerationAppeal>;
  getUserAppeals(humanId: string): Promise<ModerationAppeal[]>;
  updateModerationAppeal(id: string, updates: Partial<InsertModerationAppeal>): Promise<ModerationAppeal>;
  processAppeal(id: string, approved: boolean, reviewNotes: string, reviewerId: string): Promise<ModerationAppeal>;
  
  // Moderation statistics operations
  getModerationStats(date: string): Promise<ModerationStats | undefined>;
  createModerationStats(stats: InsertModerationStats): Promise<ModerationStats>;
  updateModerationStats(date: string, updates: Partial<InsertModerationStats>): Promise<ModerationStats>;
  getModerationStatsRange(startDate: string, endDate: string): Promise<ModerationStats[]>;
  
  // High-level moderation operations
  getModerationDashboard(): Promise<ModerationDashboard>;
  getUserModerationProfile(humanId: string): Promise<UserModerationProfile>;
  getContentModerationResult(contentId: string): Promise<ContentModerationResult>;
  processModerationReview(review: ModerationReviewAction): Promise<void>;
  getModerationAnalytics(filters?: { 
    period?: 'day' | 'week' | 'month';
    startDate?: string; 
    endDate?: string;
  }): Promise<ModerationAnalytics>;
  
  // Automated moderation operations
  processAutomatedModeration(contentId: string, analysis: ModerationAnalysis): Promise<ModerationAction | null>;
  checkUserModerationStatus(humanId: string): Promise<{
    isBanned: boolean;
    isShadowBanned: boolean;
    trustLevel: string;
    requiresReview: boolean;
    maxDailyMessages: number;
  }>;

  // ===== ADMIN SYSTEM OPERATIONS =====
  
  // System configuration operations
  getSystemConfiguration(key: string): Promise<SystemConfiguration | undefined>;
  getSystemConfigurations(category?: string): Promise<SystemConfiguration[]>;
  createSystemConfiguration(config: InsertSystemConfiguration): Promise<SystemConfiguration>;
  updateSystemConfiguration(key: string, updates: Partial<InsertSystemConfiguration>): Promise<SystemConfiguration>;
  deleteSystemConfiguration(key: string): Promise<boolean>;
  getSystemAdminSettings(): Promise<SystemAdminSettings>;
  updateSystemAdminSettings(settings: Partial<SystemAdminSettings>, updatedBy: string): Promise<void>;
  
  // Admin action audit operations
  getAdminActionLog(id: string): Promise<AdminActionLog | undefined>;
  getAdminActionLogs(filters?: { 
    adminId?: string; 
    action?: string; 
    resourceType?: string; 
    severity?: string;
    dateRange?: { start: string; end: string };
    limit?: number;
  }): Promise<AdminActionLog[]>;
  createAdminActionLog(log: InsertAdminActionLog): Promise<AdminActionLog>;
  getSecurityAuditData(): Promise<SecurityAuditData>;
  
  // Admin roles and permissions operations
  getAdminRole(id: string): Promise<AdminRole | undefined>;
  getAdminRoles(): Promise<AdminRole[]>;
  createAdminRole(role: InsertAdminRole): Promise<AdminRole>;
  updateAdminRole(id: string, updates: Partial<InsertAdminRole>): Promise<AdminRole>;
  deleteAdminRole(id: string): Promise<boolean>;
  
  // Admin user role assignments
  getAdminUserRole(humanId: string): Promise<AdminUserRole | undefined>;
  getAdminUserRoles(roleId?: string): Promise<AdminUserRole[]>;
  createAdminUserRole(userRole: InsertAdminUserRole): Promise<AdminUserRole>;
  updateAdminUserRole(id: string, updates: Partial<InsertAdminUserRole>): Promise<AdminUserRole>;
  revokeAdminUserRole(id: string): Promise<void>;
  checkAdminPermissions(humanId: string, permission: string): Promise<boolean>;
  getAdminPermissions(humanId: string): Promise<string[]>;
  
  // System health monitoring operations
  getSystemHealthMetric(id: string): Promise<SystemHealthMetric | undefined>;
  getSystemHealthMetrics(filters?: { 
    metricType?: string; 
    status?: string;
    timeRange?: { start: Date; end: Date };
    limit?: number;
  }): Promise<SystemHealthMetric[]>;
  createSystemHealthMetric(metric: InsertSystemHealthMetric): Promise<SystemHealthMetric>;
  getCurrentSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    responseTime: number;
    errorRate: number;
    activeUsers: number;
    databaseHealth: string;
    queueSizes: { [key: string]: number };
  }>;
  recordSystemHealthMetric(metricType: string, value: number, unit: string, status?: string, details?: any): Promise<void>;
  
  // User analytics operations
  getUserAnalytics(date: string): Promise<UserAnalytics | undefined>;
  getUserAnalyticsRange(startDate: string, endDate: string): Promise<UserAnalytics[]>;
  createUserAnalytics(analytics: InsertUserAnalytics): Promise<UserAnalytics>;
  updateUserAnalytics(date: string, updates: Partial<InsertUserAnalytics>): Promise<UserAnalytics>;
  calculateDailyUserAnalytics(date: string): Promise<UserAnalytics>;
  
  // Content analytics operations
  getContentAnalytics(date: string, topicId?: string): Promise<ContentAnalytics | undefined>;
  getContentAnalyticsRange(startDate: string, endDate: string): Promise<ContentAnalytics[]>;
  createContentAnalytics(analytics: InsertContentAnalytics): Promise<ContentAnalytics>;
  updateContentAnalytics(date: string, updates: Partial<InsertContentAnalytics>): Promise<ContentAnalytics>;
  calculateDailyContentAnalytics(date: string): Promise<ContentAnalytics>;
  
  // Enhanced user profile operations
  getEnhancedUserProfile(humanId: string): Promise<EnhancedUserProfile | undefined>;
  getEnhancedUserProfiles(filters?: UserManagementFilters, limit?: number, offset?: number): Promise<UserManagementResult>;
  createEnhancedUserProfile(profile: InsertEnhancedUserProfile): Promise<EnhancedUserProfile>;
  updateEnhancedUserProfile(humanId: string, updates: Partial<InsertEnhancedUserProfile>): Promise<EnhancedUserProfile>;
  deleteEnhancedUserProfile(humanId: string): Promise<boolean>;
  bulkUpdateUserProfiles(updates: { humanId: string; updates: Partial<InsertEnhancedUserProfile> }[]): Promise<void>;
  searchUsers(query: string, filters?: UserManagementFilters): Promise<UserManagementResult>;
  
  // Bulk operations
  getBulkOperation(id: string): Promise<BulkOperation | undefined>;
  getBulkOperations(operatorId?: string, status?: string, limit?: number): Promise<BulkOperation[]>;
  createBulkOperation(operation: InsertBulkOperation): Promise<BulkOperation>;
  updateBulkOperation(id: string, updates: Partial<InsertBulkOperation>): Promise<BulkOperation>;
  processBulkOperation(id: string): Promise<void>;
  executeBulkUserAction(operationType: string, criteria: any, operatorId: string): Promise<BulkOperation>;
  executeBulkContentAction(operationType: string, criteria: any, operatorId: string): Promise<BulkOperation>;
  
  // System notifications operations
  getSystemNotification(id: string): Promise<SystemNotification | undefined>;
  getSystemNotifications(filters?: { 
    type?: string; 
    severity?: string; 
    isRead?: boolean; 
    targetRoles?: string[];
    limit?: number;
  }): Promise<SystemNotification[]>;
  createSystemNotification(notification: InsertSystemNotification): Promise<SystemNotification>;
  updateSystemNotification(id: string, updates: Partial<InsertSystemNotification>): Promise<SystemNotification>;
  markNotificationAsRead(id: string, adminId: string): Promise<void>;
  resolveSystemNotification(id: string, resolvedBy: string): Promise<void>;
  getUnreadNotificationsForAdmin(adminId: string, roles: string[]): Promise<SystemNotification[]>;
  
  // High-level admin dashboard operations
  getAdminDashboardData(adminId: string): Promise<AdminDashboardData>;
  getAnalyticsDashboardData(filters?: { 
    period?: 'day' | 'week' | 'month';
    startDate?: string;
    endDate?: string;
  }): Promise<AnalyticsDashboardData>;
  
  // Content management operations
  getContentForModeration(filters?: ContentManagementFilters, limit?: number, offset?: number): Promise<ContentManagementResult>;
  bulkApproveContent(messageIds: string[], moderatorId: string): Promise<void>;
  bulkDeleteContent(messageIds: string[], moderatorId: string, reason: string): Promise<void>;
  bulkHideContent(messageIds: string[], moderatorId: string, reason: string): Promise<void>;
  searchContent(query: string, filters?: ContentManagementFilters): Promise<ContentManagementResult>;
  getContentAuditTrail(contentId: string): Promise<AdminActionLog[]>;
  
  // User management operations
  banUser(humanId: string, moderatorId: string, reason: string, duration?: number): Promise<void>;
  unbanUser(humanId: string, moderatorId: string, reason: string): Promise<void>;
  warnUser(humanId: string, moderatorId: string, reason: string): Promise<void>;
  suspendUser(humanId: string, moderatorId: string, reason: string, duration: number): Promise<void>;
  verifyUser(humanId: string, moderatorId: string, verificationLevel: string): Promise<void>;
  updateUserTrustLevel(humanId: string, trustLevel: string, moderatorId: string): Promise<void>;
  resetUserViolations(humanId: string, moderatorId: string, reason: string): Promise<void>;
  exportUserData(humanId: string, requestedBy: string): Promise<any>;
  deleteUserAccount(humanId: string, moderatorId: string, reason: string): Promise<void>;
  
  // Compliance and reporting operations
  generateComplianceReport(type: string, dateRange: { start: string; end: string }): Promise<any>;
  exportAuditLog(filters?: any, format?: 'json' | 'csv'): Promise<any>;
  exportUserData(filters?: any): Promise<any>;
  generateSystemReport(type: string, parameters?: any): Promise<any>;
}

export class MemStorage implements IStorage {
  private humans: Map<string, Human> = new Map();
  private messages: Map<string, Message> = new Map();
  private stars: Map<string, Star> = new Map();
  private reports: Map<string, Report> = new Map();
  private themes: Map<string, Theme> = new Map();
  private rateLimits: Map<string, { count: number; windowStart: Date }> = new Map();
  private ledgerEntries: LedgerEntry[] = [];
  private connectRequests: Map<string, ConnectRequest> = new Map();
  private verifications: Map<string, Verification> = new Map();
  private presenceMap: Map<string, Date> = new Map();
  private guestSessions: Map<string, GuestSession> = new Map();
  
  // Point system data structures
  private userPointBalances: Map<string, UserPointBalance> = new Map();
  private pointTransactions: PointTransaction[] = [];
  private distributionEvents: Map<string, DistributionEvent> = new Map();
  private participationMetrics: Map<string, ParticipationMetric> = new Map();
  
  // Enhanced topic system data structures
  private topics: Map<string, Topic> = new Map();
  private topicSchedules: Map<string, TopicSchedule> = new Map();
  private topicEngagement: Map<string, TopicEngagement> = new Map();
  private messageTopicEngagement: Map<string, string> = new Map(); // messageId -> topicId

  // Invite system data structures
  private inviteCodes: Map<string, InviteCode> = new Map();
  private inviteCodesByCode: Map<string, InviteCode> = new Map(); // code -> InviteCode
  private referrals: Map<string, Referral> = new Map();
  private referralRewards: Map<string, ReferralReward> = new Map();
  private referralMilestones: Map<string, ReferralMilestone> = new Map();
  private inviteAnalytics: Map<string, InviteAnalytics> = new Map();
  private referralLeaderboards: Map<string, ReferralLeaderboard> = new Map();

  // Admin system data structures
  private systemConfigurations: Map<string, SystemConfiguration> = new Map();
  private adminActionLogs: AdminActionLog[] = [];
  private adminRoles: Map<string, AdminRole> = new Map();
  private adminUserRoles: Map<string, AdminUserRole> = new Map();
  private systemHealthMetrics: SystemHealthMetric[] = [];
  private userAnalytics: Map<string, UserAnalytics> = new Map();
  private contentAnalytics: Map<string, ContentAnalytics> = new Map();
  private enhancedUserProfiles: Map<string, EnhancedUserProfile> = new Map();
  private bulkOperations: Map<string, BulkOperation> = new Map();
  private systemNotifications: Map<string, SystemNotification> = new Map();

  // Enhanced moderation system data structures
  private moderationActions: Map<string, ModerationAction> = new Map();
  private userTrustScores: Map<string, UserTrustScore> = new Map();
  private moderationAnalyses: Map<string, ModerationAnalysis> = new Map();
  private enhancedReports: Map<string, EnhancedReport> = new Map();
  private contentSimilarities: Map<string, ContentSimilarity> = new Map();
  private moderationQueue: Map<string, ModerationQueue> = new Map();
  private moderationAppeals: Map<string, ModerationAppeal> = new Map();
  private moderationStats: Map<string, ModerationStats> = new Map();

  constructor() {
    // Initialize with today's default theme
    const today = new Date().toISOString().split('T')[0];
    this.themes.set(today, {
      id: randomUUID(),
      date: today,
      topicText: "What are you building today?"
    });

    // Initialize default topics for the enhanced system
    this.initializeDefaultTopics();

    // Initialize with some demo ledger entries
    this.ledgerEntries.push({
      id: randomUUID(),
      title: "Daily Room Rain #247",
      description: "Points distributed to active humans based on engagement and upvotes",
      totalPoints: 1000,
      participantCount: 23,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    });

    this.ledgerEntries.push({
      id: randomUUID(),
      title: "Weekly Bonus Rain #35", 
      description: "Bonus points for most helpful humans in Work Mode",
      totalPoints: 500,
      participantCount: 12,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
    });
  }

  private initializeDefaultTopics() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Create some default topics
    const defaultTopics = [
      {
        id: randomUUID(),
        title: "What are you building today?",
        description: "Share your current projects, ideas, or anything you're working on!",
        category: "general" as const,
        status: "approved" as const,
        priority: 1,
        tags: ["building", "projects", "general"],
        isSpecial: false,
        createdAt: now,
        updatedAt: now
      },
      {
        id: randomUUID(),
        title: "Tech Talk Tuesday",
        description: "Discuss the latest in technology, frameworks, and tools",
        category: "tech" as const,
        status: "approved" as const,
        priority: 2,
        tags: ["technology", "frameworks", "tools"],
        isSpecial: false,
        createdAt: now,
        updatedAt: now
      },
      {
        id: randomUUID(),
        title: "Collaboration Corner",
        description: "Looking for collaborators? Share your project and find teammates!",
        category: "collaboration" as const,
        status: "approved" as const,
        priority: 3,
        tags: ["collaboration", "teamwork", "projects"],
        isSpecial: false,
        createdAt: now,
        updatedAt: now
      }
    ];

    // Store topics
    defaultTopics.forEach(topic => {
      this.topics.set(topic.id, topic);
    });

    // Create today's schedule with the first topic
    const todaySchedule: TopicSchedule = {
      id: randomUUID(),
      topicId: defaultTopics[0].id,
      scheduledDate: today,
      activatedAt: now,
      rotationType: "daily",
      isActive: true,
      createdAt: now
    };
    this.topicSchedules.set(todaySchedule.id, todaySchedule);
  }

  async getHuman(id: string): Promise<Human | undefined> {
    return this.humans.get(id);
  }

  async createHuman(insertHuman: InsertHuman): Promise<Human> {
    const human: Human = {
      ...insertHuman,
      joinedAt: new Date(),
      capsuleSeen: false,
      muteList: []
    };
    this.humans.set(human.id, human);
    return human;
  }

  async updateHumanCapsuleSeen(id: string): Promise<void> {
    const human = this.humans.get(id);
    if (human) {
      human.capsuleSeen = true;
      this.humans.set(id, human);
    }
  }

  async updateHumanMuteList(id: string, muteList: string[]): Promise<void> {
    const human = this.humans.get(id);
    if (human) {
      human.muteList = muteList;
      this.humans.set(id, human);
    }
  }

  async updateHumanRole(id: string, role: 'guest' | 'verified' | 'admin'): Promise<void> {
    const human = this.humans.get(id);
    if (human) {
      human.role = role;
      this.humans.set(id, human);
    }
  }

  async getGuestSession(id: string): Promise<GuestSession | undefined> {
    return this.guestSessions.get(id);
  }

  async getGuestSessionByHash(ipHash: string, userAgentHash: string): Promise<GuestSession | undefined> {
    return Array.from(this.guestSessions.values()).find(
      session => session.ipHash === ipHash && session.userAgentHash === userAgentHash
    );
  }

  async createGuestSession(session: InsertGuestSession): Promise<GuestSession> {
    const guestSession: GuestSession = {
      id: randomUUID(),
      ...session,
      createdAt: new Date(),
      lastSeen: new Date(),
      messageCount: session.messageCount || 0
    };
    this.guestSessions.set(guestSession.id, guestSession);
    return guestSession;
  }

  async updateGuestSessionActivity(id: string): Promise<void> {
    const session = this.guestSessions.get(id);
    if (session) {
      session.lastSeen = new Date();
      this.guestSessions.set(id, session);
    }
  }

  async incrementGuestMessageCount(id: string, dayBucket: string): Promise<void> {
    const session = this.guestSessions.get(id);
    if (session) {
      if (session.dayBucket !== dayBucket) {
        session.dayBucket = dayBucket;
        session.messageCount = 1;
      } else {
        session.messageCount++;
      }
      this.guestSessions.set(id, session);
    }
  }

  async getGuestMessageCount(id: string, dayBucket: string): Promise<number> {
    const session = this.guestSessions.get(id);
    if (session && session.dayBucket === dayBucket) {
      return session.messageCount;
    }
    return 0;
  }

  async getMessages(room: string, limit = 50): Promise<MessageWithAuthor[]> {
    const allMessages = Array.from(this.messages.values())
      .filter(m => m.room === room && !m.isHidden)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .reverse(); // Return in chronological order

    return allMessages.map(message => {
      const author = this.humans.get(message.authorHumanId);
      return {
        ...message,
        authorHandle: this.generateHandle(message.authorHumanId),
        isStarredByUser: false // This would be set based on current user
      };
    });
  }

  async getMessageById(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const message: Message = {
      id: randomUUID(),
      ...insertMessage,
      link: insertMessage.link || null,
      category: insertMessage.category || null,
      geoScope: insertMessage.geoScope || null,
      createdAt: new Date(),
      starsCount: 0,
      reportsCount: 0,
      isHidden: false
    };
    this.messages.set(message.id, message);
    return message;
  }

  async incrementMessageStars(messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      message.starsCount += 1;
      this.messages.set(messageId, message);
    }
  }

  async incrementMessageReports(messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      message.reportsCount += 1;
      this.messages.set(messageId, message);
    }
  }

  async hideMessage(messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      message.isHidden = true;
      this.messages.set(messageId, message);
    }
  }

  async getUserStarForMessage(messageId: string, humanId: string): Promise<Star | undefined> {
    return Array.from(this.stars.values())
      .find(star => star.messageId === messageId && star.humanId === humanId);
  }

  async createStar(insertStar: InsertStar): Promise<Star> {
    const star: Star = {
      ...insertStar,
      createdAt: new Date()
    };
    const key = `${star.messageId}:${star.humanId}`;
    this.stars.set(key, star);
    await this.incrementMessageStars(star.messageId);
    return star;
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const report: Report = {
      id: randomUUID(),
      ...insertReport,
      createdAt: new Date()
    };
    this.reports.set(report.id, report);
    await this.incrementMessageReports(report.messageId);
    
    // Auto-hide if report threshold reached (e.g., 3 reports)
    const reportCount = await this.getReportCountForMessage(report.messageId);
    if (reportCount >= 3) {
      await this.hideMessage(report.messageId);
    }
    
    return report;
  }

  async getReportCountForMessage(messageId: string): Promise<number> {
    return Array.from(this.reports.values())
      .filter(report => report.messageId === messageId).length;
  }

  async getThemeForDate(date: string): Promise<Theme | undefined> {
    return this.themes.get(date);
  }

  async createTheme(insertTheme: InsertTheme): Promise<Theme> {
    const theme: Theme = {
      id: randomUUID(),
      ...insertTheme
    };
    this.themes.set(theme.date, theme);
    return theme;
  }

  // Enhanced topic system operations
  async getTopic(id: string): Promise<Topic | undefined> {
    return this.topics.get(id);
  }

  async getTopics(filters?: { category?: string; status?: string; authorId?: string; limit?: number }): Promise<Topic[]> {
    let filteredTopics = Array.from(this.topics.values());

    if (filters?.category) {
      filteredTopics = filteredTopics.filter(topic => topic.category === filters.category);
    }
    if (filters?.status) {
      filteredTopics = filteredTopics.filter(topic => topic.status === filters.status);
    }
    if (filters?.authorId) {
      filteredTopics = filteredTopics.filter(topic => topic.authorHumanId === filters.authorId);
    }

    // Sort by priority, then by creation date
    filteredTopics.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return b.createdAt.getTime() - a.createdAt.getTime(); // Newer first
    });

    return filteredTopics.slice(0, filters?.limit || filteredTopics.length);
  }

  async createTopic(insertTopic: InsertTopic): Promise<Topic> {
    const topic: Topic = {
      ...insertTopic,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: insertTopic.tags || [],
      status: insertTopic.status || 'draft',
      priority: insertTopic.priority || 0,
      isSpecial: insertTopic.isSpecial || false,
      authorHumanId: insertTopic.authorHumanId || null,
      authorName: insertTopic.authorName || null,
      description: insertTopic.description || null,
    };
    this.topics.set(topic.id, topic);
    return topic;
  }

  async updateTopic(id: string, updates: Partial<InsertTopic>): Promise<Topic | undefined> {
    const topic = this.topics.get(id);
    if (!topic) return undefined;

    const updatedTopic = { ...topic, ...updates, updatedAt: new Date() };
    this.topics.set(id, updatedTopic);
    return updatedTopic;
  }

  async deleteTopic(id: string): Promise<boolean> {
    return this.topics.delete(id);
  }

  // Topic scheduling operations
  async getTopicSchedule(id: string): Promise<TopicSchedule | undefined> {
    return this.topicSchedules.get(id);
  }

  async getTopicScheduleByDate(date: string): Promise<TopicSchedule | undefined> {
    return Array.from(this.topicSchedules.values()).find(schedule => schedule.scheduledDate === date);
  }

  async getTopicSchedules(filters?: { startDate?: string; endDate?: string; isActive?: boolean }): Promise<TopicSchedule[]> {
    let schedules = Array.from(this.topicSchedules.values());

    if (filters?.startDate) {
      schedules = schedules.filter(s => s.scheduledDate >= filters.startDate!);
    }
    if (filters?.endDate) {
      schedules = schedules.filter(s => s.scheduledDate <= filters.endDate!);
    }
    if (filters?.isActive !== undefined) {
      schedules = schedules.filter(s => s.isActive === filters.isActive);
    }

    return schedules;
  }

  async createTopicSchedule(schedule: InsertTopicSchedule): Promise<TopicSchedule> {
    const topicSchedule: TopicSchedule = {
      ...schedule,
      id: randomUUID(),
      createdAt: new Date(),
      activatedAt: null,
      deactivatedAt: null,
      isActive: false,
    };
    this.topicSchedules.set(topicSchedule.id, topicSchedule);
    return topicSchedule;
  }

  async updateTopicSchedule(id: string, updates: Partial<InsertTopicSchedule>): Promise<TopicSchedule | undefined> {
    const schedule = this.topicSchedules.get(id);
    if (!schedule) return undefined;

    const updatedSchedule = { ...schedule, ...updates };
    this.topicSchedules.set(id, updatedSchedule);
    return updatedSchedule;
  }

  async activateTopicSchedule(id: string): Promise<void> {
    const schedule = this.topicSchedules.get(id);
    if (!schedule) return;
    
    // Deactivate other active schedules for the same date
    Array.from(this.topicSchedules.values()).forEach(s => {
      if (s.scheduledDate === schedule.scheduledDate && s.id !== id && s.isActive) {
        this.deactivateTopicSchedule(s.id);
      }
    });
    
    await this.updateTopicSchedule(id, { isActive: true, activatedAt: new Date() });
  }

  async deactivateTopicSchedule(id: string): Promise<void> {
    await this.updateTopicSchedule(id, { isActive: false, deactivatedAt: new Date() });
  }

  // Topic engagement operations
  async getTopicEngagement(topicId: string, date: string): Promise<TopicEngagement | undefined> {
    const key = `${topicId}:${date}`;
    return this.topicEngagement.get(key);
  }

  async updateTopicEngagement(engagement: InsertTopicEngagement): Promise<TopicEngagement> {
    const key = `${engagement.topicId}:${engagement.date}`;
    const existing = this.topicEngagement.get(key);

    const updatedEngagement: TopicEngagement = {
      ...engagement,
      id: existing?.id || randomUUID(),
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.topicEngagement.set(key, updatedEngagement);
    return updatedEngagement;
  }

  async getTopicEngagementHistory(topicId: string): Promise<TopicEngagement[]> {
    return Array.from(this.topicEngagement.values())
      .filter(engagement => engagement.topicId === topicId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Daily topic operations
  async getCurrentTopic(): Promise<TopicWithSchedule | null> {
    const today = new Date().toISOString().split('T')[0];
    const schedule = await this.getTopicScheduleByDate(today);
    
    if (!schedule || !schedule.isActive) {
      // Fallback to the highest priority approved topic if no active schedule
      const topics = await this.getTopics({ status: 'approved', limit: 1 });
      if (topics.length > 0) {
        return {
          ...topics[0],
          schedule: null,
          engagement: null,
          isScheduled: false,
          isActive: false,
        };
      }
      return null;
    }

    const topic = await this.getTopic(schedule.topicId);
    if (!topic) return null;

    const engagement = await this.getTopicEngagement(topic.id, today);

    return {
      ...topic,
      schedule,
      engagement,
      isScheduled: true,
      isActive: schedule.isActive,
    };
  }

  async getDailyTopicInfo(): Promise<DailyTopicInfo> {
    const current = await this.getCurrentTopic();
    const upcoming = await this.getUpcomingTopics(5);
    const recent = await this.getRecentTopics(5);

    // Fallback topic if current is null
    let fallbackTopic: Topic | null = null;
    if (!current) {
      const topics = await this.getTopics({ status: 'approved', limit: 1 });
      fallbackTopic = topics[0] || null;
    }

    return {
      current: current,
      upcoming,
      recent,
      fallback: fallbackTopic!,
    };
  }

  async getUpcomingTopics(limit = 5): Promise<TopicWithSchedule[]> {
    const today = new Date().toISOString().split('T')[0];
    const schedules = await this.getTopicSchedules({ startDate: today });
    const upcomingSchedules = schedules
      .filter(s => s.scheduledDate > today)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
      .slice(0, limit);

    const results: TopicWithSchedule[] = [];
    for (const schedule of upcomingSchedules) {
      const topic = await this.getTopic(schedule.topicId);
      if (topic) {
        results.push({
          ...topic,
          schedule,
          engagement: null,
          isScheduled: true,
          isActive: schedule.isActive,
        });
      }
    }
    return results;
  }

  async getRecentTopics(limit = 5): Promise<TopicWithSchedule[]> {
    const today = new Date().toISOString().split('T')[0];
    const schedules = await this.getTopicSchedules({ endDate: today });
    const recentSchedules = schedules
      .filter(s => s.scheduledDate < today)
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
      .slice(0, limit);

    const results: TopicWithSchedule[] = [];
    for (const schedule of recentSchedules) {
      const topic = await this.getTopic(schedule.topicId);
      if (topic) {
        const engagement = await this.getTopicEngagement(topic.id, schedule.scheduledDate);
        results.push({
          ...topic,
          schedule,
          engagement,
          isScheduled: true,
          isActive: schedule.isActive,
        });
      }
    }
    return results;
  }

  // Topic analytics operations
  async getTopicAnalytics(topicId: string): Promise<TopicAnalytics | undefined> {
    const topic = await this.getTopic(topicId);
    if (!topic) return undefined;

    const engagements = await this.getTopicEngagementHistory(topicId);
    if (engagements.length === 0) {
      return {
        topicId: topic.id,
        title: topic.title,
        category: topic.category,
        totalDays: 0,
        totalMessages: 0,
        totalStars: 0,
        totalParticipants: 0,
        avgEngagementPerDay: 0,
        lastUsed: undefined,
        performanceScore: 0,
      };
    }

    let totalMessages = 0;
    let totalStars = 0;
    let totalParticipants = 0;
    let avgEngagementScore = 0;

    engagements.forEach(eng => {
      totalMessages += eng.messagesCount;
      totalStars += eng.starsCount;
      totalParticipants += eng.participantsCount;
      avgEngagementScore += eng.avgEngagementScore;
    });

    const performanceScore = (totalStars * 10 + totalMessages * 5 + totalParticipants * 2) / engagements.length;

    return {
      topicId: topic.id,
      title: topic.title,
      category: topic.category,
      totalDays: engagements.length,
      totalMessages,
      totalStars,
      totalParticipants,
      avgEngagementPerDay: Math.round(avgEngagementScore / engagements.length),
      lastUsed: engagements[engagements.length - 1]?.date,
      performanceScore: Math.round(performanceScore),
    };
  }

  async getTopicsAnalytics(filters?: { category?: string; dateRange?: { start: string; end: string } }): Promise<TopicAnalytics[]> {
    const topics = await this.getTopics();
    const analyticsPromises = topics.map(topic => this.getTopicAnalytics(topic.id));
    const analytics = await Promise.all(analyticsPromises);

    return analytics.filter((a): a is TopicAnalytics => !!a);
  }

  async getAdminTopicSummary(): Promise<AdminTopicSummary> {
    const allTopics = await this.getTopics();
    const activeSchedules = await this.getTopicSchedules({ isActive: true });

    const activeTopics = new Set(activeSchedules.map(s => s.topicId));
    const today = new Date().toISOString().split('T')[0];
    const scheduledTopics = await this.getTopicSchedules({ startDate: today });

    const summary = {
      totalTopics: allTopics.length,
      activeTopics: activeTopics.size,
      scheduledTopics: scheduledTopics.length,
      draftTopics: allTopics.filter(t => t.status === 'draft').length,
      topCategories: [] as { category: string; count: number }[],
      recentActivity: [] as TopicAnalytics[],
    };

    // Top categories
    const categoryCounts = new Map<string, number>();
    allTopics.forEach(topic => {
      const count = categoryCounts.get(topic.category) || 0;
      categoryCounts.set(topic.category, count + 1);
    });
    summary.topCategories = Array.from(categoryCounts.entries())
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    // Recent activity (last 5 topics with analytics)
    const recentTopicAnalytics = await this.getTopicsAnalytics();
    summary.recentActivity = recentTopicAnalytics
      .sort((a, b) => (b.lastUsed || '').localeCompare(a.lastUsed || ''))
      .slice(0, 5);

    return summary;
  }

  // Topic rotation operations
  async rotateTopics(): Promise<void> {
    // This would be called by a background job to rotate topics
    const today = new Date().toISOString().split('T')[0];
    const todaySchedule = await this.getTopicScheduleByDate(today);
    
    if (!todaySchedule || !todaySchedule.isActive) {
      // Find next available topic for today
      const availableTopics = await this.getTopics({ status: 'approved' });
      if (availableTopics.length > 0) {
        await this.scheduleTopicRotation(today, availableTopics[0].id);
        await this.activateTopicSchedule((await this.getTopicScheduleByDate(today))!.id);
      }
    }
  }

  async scheduleTopicRotation(date: string, topicId: string): Promise<TopicSchedule> {
    // Check if a schedule already exists for this date
    const existing = await this.getTopicScheduleByDate(date);
    if (existing && existing.topicId === topicId) {
      return existing; // Already scheduled
    }

    // Deactivate existing schedule for this date if it exists and is different
    if (existing && existing.id) {
      await this.deactivateTopicSchedule(existing.id);
    }

    // Create new schedule
    return this.createTopicSchedule({
      topicId,
      scheduledDate: date,
      rotationType: 'daily', // Default to daily rotation
    });
  }

  async getTopicRotationSchedule(timeRange: { start: string; end: string }): Promise<TopicSchedule[]> {
    return this.getTopicSchedules({ startDate: timeRange.start, endDate: timeRange.end });
  }

  // Topic engagement tracking
  async recordTopicEngagement(messageId: string, topicId: string): Promise<void> {
    this.messageTopicEngagement.set(messageId, topicId);
    
    // Update daily engagement metrics
    const today = new Date().toISOString().split('T')[0];
    const currentEngagement = await this.getTopicEngagement(topicId, today) || {
      topicId,
      date: today,
      messagesCount: 0,
      starsCount: 0,
      participantsCount: 0,
      avgEngagementScore: 0,
    };
    
    // Increment message count
    await this.updateTopicEngagement({
      ...currentEngagement,
      messagesCount: currentEngagement.messagesCount + 1,
    });
  }

  async getMessageTopicEngagement(messageId: string): Promise<string | null> {
    return this.messageTopicEngagement.get(messageId) || null;
  }

  // Invite system operations implementation
  // Invite code operations
  async getInviteCode(id: string): Promise<InviteCode | undefined> {
    return this.inviteCodes.get(id);
  }

  async getInviteCodeByCode(code: string): Promise<InviteCode | undefined> {
    return this.inviteCodesByCode.get(code);
  }

  async getUserInviteCodes(humanId: string): Promise<InviteCodeWithStats[]> {
    const userCodes = Array.from(this.inviteCodes.values())
      .filter(code => code.creatorHumanId === humanId);

    return userCodes.map(code => {
      const referrals = Array.from(this.referrals.values())
        .filter(ref => ref.inviteCodeId === code.id);
      
      const successfulReferrals = referrals.filter(ref => ref.status === 'completed').length;
      const totalReferrals = referrals.length;
      const conversionRate = totalReferrals > 0 ? (successfulReferrals / totalReferrals) * 100 : 0;
      
      const rewards = Array.from(this.referralRewards.values())
        .filter(reward => referrals.some(ref => ref.id === reward.referralId));
      const totalRewards = rewards.reduce((sum, reward) => sum + reward.pointsAwarded, 0);
      
      const isExpired = code.expiresAt ? new Date(code.expiresAt) < new Date() : false;
      const daysActive = Math.floor((Date.now() - new Date(code.createdAt).getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...code,
        totalReferrals,
        successfulReferrals,
        conversionRate: Math.round(conversionRate),
        totalRewards,
        isExpired,
        daysActive
      };
    });
  }

  async createInviteCode(inviteCode: InsertInviteCode): Promise<InviteCode> {
    const code = await this.generateUniqueInviteCode();
    const id = randomUUID();
    const now = new Date();
    
    const newInviteCode: InviteCode = {
      id,
      code,
      ...inviteCode,
      createdAt: now,
      updatedAt: now
    };

    this.inviteCodes.set(id, newInviteCode);
    this.inviteCodesByCode.set(code, newInviteCode);
    return newInviteCode;
  }

  async updateInviteCodeUsage(codeId: string): Promise<void> {
    const inviteCode = this.inviteCodes.get(codeId);
    if (inviteCode) {
      const updated = {
        ...inviteCode,
        usageCount: inviteCode.usageCount + 1,
        updatedAt: new Date()
      };
      this.inviteCodes.set(codeId, updated);
      this.inviteCodesByCode.set(inviteCode.code, updated);
    }
  }

  async deactivateInviteCode(codeId: string): Promise<void> {
    const inviteCode = this.inviteCodes.get(codeId);
    if (inviteCode) {
      const updated = {
        ...inviteCode,
        isActive: false,
        updatedAt: new Date()
      };
      this.inviteCodes.set(codeId, updated);
      this.inviteCodesByCode.set(inviteCode.code, updated);
    }
  }

  async generateUniqueInviteCode(): Promise<string> {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    do {
      code = '';
      for (let i = 0; i < 8; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }
    } while (this.inviteCodesByCode.has(code));
    return code;
  }

  // Referral operations
  async getReferral(id: string): Promise<Referral | undefined> {
    return this.referrals.get(id);
  }

  async getReferralsByInviter(humanId: string): Promise<ReferralWithDetails[]> {
    const referrals = Array.from(this.referrals.values())
      .filter(ref => ref.inviterHumanId === humanId);

    return this.populateReferralDetails(referrals);
  }

  async getReferralsByInvitee(humanId: string): Promise<ReferralWithDetails[]> {
    const referrals = Array.from(this.referrals.values())
      .filter(ref => ref.inviteeHumanId === humanId);

    return this.populateReferralDetails(referrals);
  }

  private async populateReferralDetails(referrals: Referral[]): Promise<ReferralWithDetails[]> {
    return referrals.map(referral => {
      const inviter = this.humans.get(referral.inviterHumanId);
      const invitee = this.humans.get(referral.inviteeHumanId);
      const inviteCodeData = this.inviteCodes.get(referral.inviteCodeId);
      const rewards = Array.from(this.referralRewards.values())
        .filter(reward => reward.referralId === referral.id);

      return {
        ...referral,
        inviter: {
          handle: this.generateHandle(referral.inviterHumanId),
          initials: this.generateInitials(referral.inviterHumanId)
        },
        invitee: {
          handle: this.generateHandle(referral.inviteeHumanId),
          initials: this.generateInitials(referral.inviteeHumanId)
        },
        inviteCodeData: inviteCodeData!,
        rewards
      };
    });
  }

  async createReferral(referral: InsertReferral): Promise<Referral> {
    const id = randomUUID();
    const now = new Date();
    
    const newReferral: Referral = {
      id,
      ...referral,
      createdAt: now
    };

    this.referrals.set(id, newReferral);
    return newReferral;
  }

  async updateReferralStatus(id: string, status: string): Promise<void> {
    const referral = this.referrals.get(id);
    if (referral) {
      this.referrals.set(id, { ...referral, status: status as any });
    }
  }

  async getReferralCount(humanId: string): Promise<number> {
    return Array.from(this.referrals.values())
      .filter(ref => ref.inviterHumanId === humanId && ref.status === 'completed')
      .length;
  }

  async validateInviteCode(code: string): Promise<{ valid: boolean; inviteCode?: InviteCode; reason?: string }> {
    const inviteCode = this.inviteCodesByCode.get(code);
    
    if (!inviteCode) {
      return { valid: false, reason: 'Invite code not found' };
    }

    if (!inviteCode.isActive) {
      return { valid: false, reason: 'Invite code is no longer active' };
    }

    if (inviteCode.expiresAt && new Date(inviteCode.expiresAt) < new Date()) {
      return { valid: false, reason: 'Invite code has expired' };
    }

    if (inviteCode.usageCount >= inviteCode.maxUsage) {
      return { valid: false, reason: 'Invite code has reached its usage limit' };
    }

    return { valid: true, inviteCode };
  }

  // Referral reward operations
  async getReferralReward(id: string): Promise<ReferralReward | undefined> {
    return this.referralRewards.get(id);
  }

  async getReferralRewardsByHuman(humanId: string): Promise<ReferralReward[]> {
    return Array.from(this.referralRewards.values())
      .filter(reward => reward.recipientHumanId === humanId);
  }

  async createReferralReward(reward: InsertReferralReward): Promise<ReferralReward> {
    const id = randomUUID();
    const now = new Date();
    
    const newReward: ReferralReward = {
      id,
      ...reward,
      createdAt: now
    };

    this.referralRewards.set(id, newReward);
    return newReward;
  }

  async processReferralReward(rewardId: string): Promise<void> {
    const reward = this.referralRewards.get(rewardId);
    if (reward && !reward.isProcessed) {
      const updated = {
        ...reward,
        isProcessed: true,
        processedAt: new Date()
      };
      this.referralRewards.set(rewardId, updated);

      // Update user point balance
      if (reward.pointsAwarded > 0) {
        const currentBalance = this.userPointBalances.get(reward.recipientHumanId);
        if (currentBalance) {
          const newBalance = {
            ...currentBalance,
            points: currentBalance.points + reward.pointsAwarded,
            lifetimeEarned: currentBalance.lifetimeEarned + reward.pointsAwarded
          };
          this.userPointBalances.set(reward.recipientHumanId, newBalance);
        } else {
          this.userPointBalances.set(reward.recipientHumanId, {
            humanId: reward.recipientHumanId,
            points: reward.pointsAwarded,
            lifetimeEarned: reward.pointsAwarded,
            lifetimeSpent: 0
          });
        }
      }
    }
  }

  async calculateReferralRewards(referralId: string): Promise<InsertReferralReward[]> {
    const referral = this.referrals.get(referralId);
    if (!referral) return [];

    const rewards: InsertReferralReward[] = [];

    // Inviter reward
    rewards.push({
      referralId,
      recipientHumanId: referral.inviterHumanId,
      recipientType: 'inviter',
      rewardType: 'referral_bonus',
      pointsAwarded: 100, // Base referral reward
      description: 'Referral bonus for successful invite',
      isProcessed: false,
      metadata: {}
    });

    // Invitee reward
    rewards.push({
      referralId,
      recipientHumanId: referral.inviteeHumanId,
      recipientType: 'invitee',
      rewardType: 'referral_bonus',
      pointsAwarded: 50, // Welcome bonus
      description: 'Welcome bonus for joining through invite',
      isProcessed: false,
      metadata: {}
    });

    return rewards;
  }

  async distributeReferralRewards(referralId: string): Promise<void> {
    const rewards = await this.calculateReferralRewards(referralId);
    
    for (const rewardData of rewards) {
      const reward = await this.createReferralReward(rewardData);
      await this.processReferralReward(reward.id);
    }

    // Check for milestone achievements
    const referral = this.referrals.get(referralId);
    if (referral) {
      await this.checkAndAwardMilestones(referral.inviterHumanId);
    }
  }

  // Referral milestone operations
  async getReferralMilestone(id: string): Promise<ReferralMilestone | undefined> {
    return this.referralMilestones.get(id);
  }

  async getUserMilestones(humanId: string): Promise<ReferralMilestone[]> {
    return Array.from(this.referralMilestones.values())
      .filter(milestone => milestone.humanId === humanId)
      .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());
  }

  async createReferralMilestone(milestone: InsertReferralMilestone): Promise<ReferralMilestone> {
    const id = randomUUID();
    const now = new Date();
    
    const newMilestone: ReferralMilestone = {
      id,
      ...milestone,
      achievedAt: now
    };

    this.referralMilestones.set(id, newMilestone);
    return newMilestone;
  }

  async checkAndAwardMilestones(humanId: string): Promise<ReferralMilestone[]> {
    const referralCount = await this.getReferralCount(humanId);
    const existingMilestones = await this.getUserMilestones(humanId);
    const achievedLevels = existingMilestones
      .filter(m => m.milestoneType === 'referral_count')
      .map(m => m.level);

    const milestones: ReferralMilestone[] = [];
    const milestoneTargets = [5, 10, 25, 50, 100];
    
    for (const target of milestoneTargets) {
      if (referralCount >= target && !achievedLevels.includes(target)) {
        const pointsReward = target * 50; // Escalating rewards
        
        const milestone = await this.createReferralMilestone({
          humanId,
          milestoneType: 'referral_count',
          level: target,
          value: referralCount,
          title: `${target} Referrals Milestone`,
          description: `Achieved ${target} successful referrals!`,
          pointsRewarded: pointsReward,
          tokenAmountRewarded: '0',
          badgeIcon: 'users',
          badgeColor: target >= 50 ? 'gold' : target >= 25 ? 'silver' : 'bronze',
          isSpecial: target >= 50
        });

        milestones.push(milestone);

        // Award points
        await this.createReferralReward({
          referralId: '', // Not tied to specific referral
          recipientHumanId: humanId,
          recipientType: 'inviter',
          rewardType: 'milestone_bonus',
          pointsAwarded: pointsReward,
          milestoneLevel: target,
          description: `Milestone reward for ${target} referrals`,
          isProcessed: false,
          metadata: { milestoneType: 'referral_count' }
        });
      }
    }

    return milestones;
  }

  async getNextMilestone(humanId: string): Promise<{ level: number; progress: number; remaining: number; reward: number } | undefined> {
    const referralCount = await this.getReferralCount(humanId);
    const milestoneTargets = [5, 10, 25, 50, 100];
    
    const nextTarget = milestoneTargets.find(target => target > referralCount);
    if (!nextTarget) return undefined;

    return {
      level: nextTarget,
      progress: referralCount,
      remaining: nextTarget - referralCount,
      reward: nextTarget * 50
    };
  }

  // Invite analytics operations
  async getInviteAnalytics(id: string): Promise<InviteAnalytics | undefined> {
    return this.inviteAnalytics.get(id);
  }

  async getInviteAnalyticsByCode(codeId: string): Promise<InviteAnalytics[]> {
    return Array.from(this.inviteAnalytics.values())
      .filter(analytics => analytics.inviteCodeId === codeId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createInviteAnalytics(analytics: InsertInviteAnalytics): Promise<InviteAnalytics> {
    const id = randomUUID();
    const now = new Date();
    
    const newAnalytics: InviteAnalytics = {
      id,
      ...analytics,
      timestamp: now
    };

    this.inviteAnalytics.set(id, newAnalytics);
    return newAnalytics;
  }

  async getInviteAnalyticsSummary(codeId: string): Promise<InviteAnalyticsSummary> {
    const analytics = await this.getInviteAnalyticsByCode(codeId);
    const inviteCode = this.inviteCodes.get(codeId);
    
    const totalClicks = analytics.filter(a => a.eventType === 'link_click').length;
    const uniqueVisitors = new Set(analytics.map(a => a.sessionId).filter(Boolean)).size;
    const registrations = analytics.filter(a => a.eventType === 'registration_complete').length;
    
    const referrals = Array.from(this.referrals.values())
      .filter(ref => ref.inviteCodeId === codeId);
    const conversions = referrals.filter(ref => ref.status === 'completed').length;
    
    const conversionRate = totalClicks > 0 ? (conversions / totalClicks) * 100 : 0;

    // Group by source
    const sourceCounts = new Map<string, number>();
    analytics.forEach(a => {
      if (a.metadata.referrer) {
        const source = a.metadata.referrer;
        sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      }
    });

    // Group by country
    const countryCounts = new Map<string, number>();
    analytics.forEach(a => {
      if (a.metadata.ipCountry) {
        const country = a.metadata.ipCountry;
        countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
      }
    });

    // Create timeline (last 30 days)
    const timeline: { date: string; clicks: number; conversions: number }[] = [];
    const last30Days = Array.from({length: 30}, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    last30Days.forEach(date => {
      const dayClicks = analytics.filter(a => 
        a.eventType === 'link_click' && 
        a.timestamp.toISOString().split('T')[0] === date
      ).length;
      
      const dayConversions = referrals.filter(ref => 
        ref.status === 'completed' && 
        ref.createdAt.toISOString().split('T')[0] === date
      ).length;

      timeline.push({ date, clicks: dayClicks, conversions: dayConversions });
    });

    return {
      inviteCodeId: codeId,
      code: inviteCode?.code || '',
      totalClicks,
      uniqueVisitors,
      registrations,
      conversions,
      conversionRate: Math.round(conversionRate),
      topSources: Array.from(sourceCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([source, count]) => ({ source, count })),
      topCountries: Array.from(countryCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([country, count]) => ({ country, count })),
      timeline
    };
  }

  async trackInviteEvent(codeId: string, eventType: string, metadata?: any): Promise<void> {
    await this.createInviteAnalytics({
      inviteCodeId: codeId,
      eventType: eventType as any,
      sessionId: metadata?.sessionId,
      metadata: metadata || {}
    });
  }

  // Referral leaderboard operations
  async getReferralLeaderboard(period: string, limit: number = 10): Promise<ReferralLeaderboardEntry[]> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get all humans and calculate their referral stats
    const humanStats = new Map<string, {
      referralCount: number;
      pointsEarned: number;
      tokensEarned: string;
    }>();

    // Calculate referral counts for the period
    Array.from(this.referrals.values())
      .filter(ref => ref.status === 'completed' && new Date(ref.createdAt) >= startDate)
      .forEach(referral => {
        const stats = humanStats.get(referral.inviterHumanId) || {
          referralCount: 0,
          pointsEarned: 0,
          tokensEarned: '0'
        };
        stats.referralCount++;
        humanStats.set(referral.inviterHumanId, stats);
      });

    // Calculate points earned for the period
    Array.from(this.referralRewards.values())
      .filter(reward => reward.isProcessed && new Date(reward.createdAt) >= startDate)
      .forEach(reward => {
        const stats = humanStats.get(reward.recipientHumanId) || {
          referralCount: 0,
          pointsEarned: 0,
          tokensEarned: '0'
        };
        stats.pointsEarned += reward.pointsAwarded;
        humanStats.set(reward.recipientHumanId, stats);
      });

    // Convert to leaderboard entries and sort
    const entries = Array.from(humanStats.entries())
      .map(([humanId, stats], index) => ({
        rank: index + 1,
        humanId,
        handle: this.generateHandle(humanId),
        initials: this.generateInitials(humanId),
        referralCount: stats.referralCount,
        conversionRate: 100, // Simplified for MemStorage
        pointsEarned: stats.pointsEarned,
        tokensEarned: stats.tokensEarned,
        isCurrentUser: false, // Will be set by caller
        trend: 'same' as const,
        badges: this.calculateBadges(stats.referralCount)
      }))
      .sort((a, b) => {
        if (b.referralCount !== a.referralCount) {
          return b.referralCount - a.referralCount;
        }
        return b.pointsEarned - a.pointsEarned;
      })
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    return entries;
  }

  private calculateBadges(referralCount: number): string[] {
    const badges: string[] = [];
    if (referralCount >= 100) badges.push('legendary');
    else if (referralCount >= 50) badges.push('elite');
    else if (referralCount >= 25) badges.push('champion');
    else if (referralCount >= 10) badges.push('expert');
    else if (referralCount >= 5) badges.push('rising-star');
    return badges;
  }

  async updateReferralLeaderboards(): Promise<void> {
    // In MemStorage, leaderboards are calculated on-demand
    // This method would be used to cache leaderboard data in a database implementation
    const periods = ['daily', 'weekly', 'monthly', 'all_time'];
    const today = new Date().toISOString().split('T')[0];

    for (const period of periods) {
      const leaderboard = await this.getReferralLeaderboard(period, 50);
      
      // Store leaderboard snapshots
      leaderboard.forEach((entry, index) => {
        const id = randomUUID();
        const leaderboardEntry: ReferralLeaderboard = {
          id,
          humanId: entry.humanId,
          period: period as any,
          date: today,
          rank: index + 1,
          referralCount: entry.referralCount,
          conversionRate: entry.conversionRate * 100, // Store as integer
          pointsEarned: entry.pointsEarned,
          tokensEarned: entry.tokensEarned,
          isTopPerformer: index < 5, // Top 5 are considered top performers
          createdAt: new Date()
        };
        this.referralLeaderboards.set(id, leaderboardEntry);
      });
    }
  }

  async getUserReferralRank(humanId: string, period: string): Promise<number> {
    const leaderboard = await this.getReferralLeaderboard(period, 1000); // Get more entries to find rank
    const userEntry = leaderboard.find(entry => entry.humanId === humanId);
    return userEntry?.rank || 0;
  }

  // Referral dashboard operations
  async getReferralDashboard(humanId: string): Promise<ReferralDashboard> {
    const activeCodes = await this.getUserInviteCodes(humanId);
    const recentReferrals = await this.getReferralsByInviter(humanId);
    const milestones = await this.getUserMilestones(humanId);
    const nextMilestone = await this.getNextMilestone(humanId);
    
    const totalReferrals = await this.getReferralCount(humanId);
    const successfulReferrals = recentReferrals.filter(ref => ref.status === 'completed').length;
    const conversionRate = totalReferrals > 0 ? (successfulReferrals / totalReferrals) * 100 : 0;
    
    const rewards = await this.getReferralRewardsByHuman(humanId);
    const totalPointsEarned = rewards.reduce((sum, reward) => sum + reward.pointsAwarded, 0);
    const totalTokensEarned = '0'; // For now, no token rewards in MemStorage

    const currentRank = await this.getUserReferralRank(humanId, 'all_time');

    return {
      humanId,
      handle: this.generateHandle(humanId),
      totalReferrals,
      successfulReferrals,
      conversionRate: Math.round(conversionRate),
      totalPointsEarned,
      totalTokensEarned,
      currentRank,
      activeCodes,
      recentReferrals: recentReferrals.slice(0, 10), // Last 10 referrals
      milestones,
      nextMilestone
    };
  }

  async getReferralSystemStats(): Promise<ReferralSystemStats> {
    const totalInviteCodes = this.inviteCodes.size;
    const totalReferrals = Array.from(this.referrals.values())
      .filter(ref => ref.status === 'completed').length;
    
    const allRewards = Array.from(this.referralRewards.values());
    const totalRewardsDistributed = allRewards
      .filter(reward => reward.isProcessed)
      .reduce((sum, reward) => sum + reward.pointsAwarded, 0);

    // Calculate average conversion rate
    const codeStats = Array.from(this.inviteCodes.values()).map(code => {
      const codeReferrals = Array.from(this.referrals.values())
        .filter(ref => ref.inviteCodeId === code.id);
      const successful = codeReferrals.filter(ref => ref.status === 'completed').length;
      return codeReferrals.length > 0 ? (successful / codeReferrals.length) * 100 : 0;
    });
    const averageConversionRate = codeStats.length > 0 
      ? Math.round(codeStats.reduce((sum, rate) => sum + rate, 0) / codeStats.length)
      : 0;

    const topPerformers = await this.getReferralLeaderboard('all_time', 5);

    // Recent activity (last 7 days)
    const last7Days = Array.from({length: 7}, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    const recentActivity = last7Days.map(date => {
      const dayReferrals = Array.from(this.referrals.values())
        .filter(ref => ref.createdAt.toISOString().split('T')[0] === date).length;
      
      const dayRewards = allRewards
        .filter(reward => reward.createdAt.toISOString().split('T')[0] === date)
        .reduce((sum, reward) => sum + reward.pointsAwarded, 0);

      return {
        date,
        newReferrals: dayReferrals,
        rewardsDistributed: dayRewards
      };
    });

    // Milestone breakdown
    const milestoneTargets = [5, 10, 25, 50, 100];
    const milestoneBreakdown = milestoneTargets.map(level => {
      const achievedMilestones = Array.from(this.referralMilestones.values())
        .filter(m => m.milestoneType === 'referral_count' && m.level === level);
      
      const totalRewards = achievedMilestones
        .reduce((sum, m) => sum + m.pointsRewarded, 0);

      return {
        level,
        achievedCount: achievedMilestones.length,
        totalRewards
      };
    });

    return {
      totalInviteCodes,
      totalReferrals,
      totalRewardsDistributed,
      averageConversionRate,
      topPerformers,
      recentActivity,
      milestoneBreakdown
    };
  }

  async getRateLimit(humanId: string, action: string, windowType: string): Promise<number> {
    const key = `${humanId}:${action}:${windowType}`;
    const limit = this.rateLimits.get(key);
    
    if (!limit) return 0;
    
    const now = new Date();
    const windowMs = this.getWindowMs(windowType);
    
    if (now.getTime() - limit.windowStart.getTime() > windowMs) {
      this.rateLimits.delete(key);
      return 0;
    }
    
    return limit.count;
  }

  async incrementRateLimit(humanId: string, action: string, windowType: string): Promise<void> {
    const key = `${humanId}:${action}:${windowType}`;
    const existing = this.rateLimits.get(key);
    const now = new Date();
    
    if (!existing) {
      this.rateLimits.set(key, { count: 1, windowStart: now });
      return;
    }
    
    const windowMs = this.getWindowMs(windowType);
    if (now.getTime() - existing.windowStart.getTime() > windowMs) {
      this.rateLimits.set(key, { count: 1, windowStart: now });
    } else {
      existing.count += 1;
      this.rateLimits.set(key, existing);
    }
  }

  async getLedgerEntries(limit = 20): Promise<LedgerEntry[]> {
    return this.ledgerEntries
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createLedgerEntry(insertEntry: InsertLedgerEntry): Promise<LedgerEntry> {
    const entry: LedgerEntry = {
      id: randomUUID(),
      ...insertEntry,
      createdAt: new Date()
    };
    this.ledgerEntries.push(entry);
    return entry;
  }

  async createConnectRequest(insertRequest: InsertConnectRequest): Promise<ConnectRequest> {
    const request: ConnectRequest = {
      id: randomUUID(),
      ...insertRequest,
      createdAt: new Date()
    };
    this.connectRequests.set(request.id, request);
    return request;
  }

  async getVerificationByNullifierHash(nullifierHashHashed: string): Promise<Verification | undefined> {
    return Array.from(this.verifications.values()).find(v => v.nullifierHashHashed === nullifierHashHashed);
  }

  async createVerification(insertVerification: InsertVerification): Promise<Verification> {
    const verification: Verification = {
      id: randomUUID(),
      ...insertVerification,
      createdAt: new Date()
    };
    this.verifications.set(verification.id, verification);
    return verification;
  }

  async getHumanProfile(humanId: string): Promise<HumanProfile | undefined> {
    const human = this.humans.get(humanId);
    if (!human) return undefined;

    const userMessages = Array.from(this.messages.values())
      .filter(m => m.authorHumanId === humanId);
    
    const totalStars = userMessages.reduce((sum, m) => sum + m.starsCount, 0);
    
    // Get point balance
    const pointBalance = await this.getUserPointBalance(humanId);
    
    // Get today's points
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = this.pointTransactions
      .filter(t => t.humanId === humanId && 
                   t.type === 'earn' && 
                   t.createdAt.toISOString().split('T')[0] === today);
    const pointsEarnedToday = todayTransactions.reduce((sum, t) => sum + t.points, 0);
    
    // Get user rank
    const rank = await this.getUserRank(humanId, 'all');
    
    return {
      id: humanId,
      handle: this.generateHandle(humanId),
      initials: this.generateInitials(humanId),
      firstSeen: human.joinedAt.toLocaleDateString(),
      totalPosts: userMessages.length,
      starsReceived: totalStars,
      pointBalance: pointBalance?.totalPoints || 0,
      lifetimePointsEarned: pointBalance?.lifetimeEarned || 0,
      pointsEarnedToday,
      leaderboardRank: rank > 0 ? rank : undefined
    };
  }

  async getOnlinePresence(): Promise<OnlinePresence> {
    // Clean up old presence records (older than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    for (const [humanId, lastSeen] of Array.from(this.presenceMap.entries())) {
      if (lastSeen < fiveMinutesAgo) {
        this.presenceMap.delete(humanId);
      }
    }
    
    const count = this.presenceMap.size;
    const roundedCount = count < 10 ? `${count}` : `${Math.round(count / 10) * 10}+`;
    
    return { count, roundedCount };
  }

  async updatePresence(humanId: string): Promise<void> {
    this.presenceMap.set(humanId, new Date());
  }

  private getWindowMs(windowType: string): number {
    switch (windowType) {
      case 'minute': return 60 * 1000;
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      default: return 60 * 1000;
    }
  }

  private generateHandle(humanId: string): string {
    // Generate a consistent pseudonymous handle from the human ID
    const names = ['alex', 'sarah', 'maya', 'jake', 'eli', 'zoe', 'kai', 'luna'];
    const suffixes = ['dev', 'pm', 'founder', 'mentor', 'curious', 'builder', 'creator', 'human'];
    
    const hash = this.simpleHash(humanId);
    const name = names[hash % names.length];
    const suffix = suffixes[(hash >> 3) % suffixes.length];
    
    return `${name}_${suffix}`;
  }

  private generateInitials(humanId: string): string {
    const handle = this.generateHandle(humanId);
    const parts = handle.split('_');
    return parts.map(part => part[0].toUpperCase()).join('');
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Point balance operations
  async getUserPointBalance(humanId: string): Promise<UserPointBalance | undefined> {
    return this.userPointBalances.get(humanId);
  }

  async createUserPointBalance(balance: InsertUserPointBalance): Promise<UserPointBalance> {
    const userBalance: UserPointBalance = {
      ...balance,
      lastUpdated: new Date()
    };
    this.userPointBalances.set(balance.humanId, userBalance);
    return userBalance;
  }

  async updateUserPointBalance(humanId: string, pointsChange: number, lifetimeEarnedChange: number): Promise<void> {
    let balance = this.userPointBalances.get(humanId);
    
    if (!balance) {
      balance = await this.createUserPointBalance({
        humanId,
        totalPoints: Math.max(0, pointsChange),
        lifetimeEarned: Math.max(0, lifetimeEarnedChange),
        lifetimeSpent: 0
      });
      return;
    }

    balance.totalPoints = Math.max(0, balance.totalPoints + pointsChange);
    balance.lifetimeEarned += Math.max(0, lifetimeEarnedChange);
    if (pointsChange < 0) {
      balance.lifetimeSpent += Math.abs(pointsChange);
    }
    balance.lastUpdated = new Date();
    
    this.userPointBalances.set(humanId, balance);
  }

  // Point transaction operations
  async createPointTransaction(transaction: InsertPointTransaction): Promise<PointTransaction> {
    const pointTransaction: PointTransaction = {
      id: randomUUID(),
      ...transaction,
      createdAt: new Date()
    };
    this.pointTransactions.push(pointTransaction);
    
    // Update user balance
    const pointsChange = transaction.type === 'earn' ? transaction.points : -transaction.points;
    const lifetimeChange = transaction.type === 'earn' ? transaction.points : 0;
    await this.updateUserPointBalance(transaction.humanId, pointsChange, lifetimeChange);
    
    return pointTransaction;
  }

  async getUserPointTransactions(humanId: string, limit = 50): Promise<PointTransaction[]> {
    return this.pointTransactions
      .filter(t => t.humanId === humanId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getUserPointHistory(humanId: string): Promise<UserPointHistory> {
    const transactions = await this.getUserPointTransactions(humanId, 100);
    const balance = await this.getUserPointBalance(humanId);
    
    // Create breakdown by source
    const breakdownMap = new Map<string, { points: number; count: number }>();
    
    transactions.forEach(t => {
      if (t.type === 'earn') {
        const existing = breakdownMap.get(t.source) || { points: 0, count: 0 };
        existing.points += t.points;
        existing.count += 1;
        breakdownMap.set(t.source, existing);
      }
    });

    const breakdown: PointBreakdown[] = Array.from(breakdownMap.entries()).map(([source, data]) => ({
      source,
      points: data.points,
      count: data.count,
      description: this.getSourceDescription(source)
    }));

    return {
      transactions,
      breakdown,
      totalEarned: balance?.lifetimeEarned || 0,
      totalSpent: balance?.lifetimeSpent || 0,
      currentBalance: balance?.totalPoints || 0
    };
  }

  // Distribution event operations
  async createDistributionEvent(event: InsertDistributionEvent): Promise<DistributionEvent> {
    const distributionEvent: DistributionEvent = {
      id: randomUUID(),
      ...event,
      executedAt: new Date(),
      createdAt: new Date()
    };
    this.distributionEvents.set(distributionEvent.id, distributionEvent);
    return distributionEvent;
  }

  async getDistributionEvents(limit = 20): Promise<DistributionEvent[]> {
    return Array.from(this.distributionEvents.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getDistributionEventById(id: string): Promise<DistributionEvent | undefined> {
    return this.distributionEvents.get(id);
  }

  // Participation metrics operations
  async updateParticipationMetrics(humanId: string, room: string, metrics: Partial<InsertParticipationMetric>): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const key = `${humanId}:${today}:${room}`;
    
    let existing = this.participationMetrics.get(key);
    
    if (!existing) {
      existing = {
        id: randomUUID(),
        humanId,
        date: today,
        room,
        messagesPosted: 0,
        starsReceived: 0,
        starsGiven: 0,
        workLinksShared: 0,
        helpPostsCreated: 0,
        advicePostsCreated: 0,
        collabPostsCreated: 0,
        lastActive: new Date(),
        updatedAt: new Date()
      };
    }

    // Update with provided metrics
    Object.assign(existing, metrics);
    existing.lastActive = new Date();
    existing.updatedAt = new Date();
    
    this.participationMetrics.set(key, existing);
  }

  async getParticipationMetrics(humanId: string, date: string, room: string): Promise<ParticipationMetric | undefined> {
    const key = `${humanId}:${date}:${room}`;
    return this.participationMetrics.get(key);
  }

  async getUsersForDistribution(timeRange: { start: Date; end: Date }, room: string): Promise<ParticipationMetric[]> {
    const startDate = timeRange.start.toISOString().split('T')[0];
    const endDate = timeRange.end.toISOString().split('T')[0];
    
    return Array.from(this.participationMetrics.values()).filter(metric => 
      metric.room === room &&
      metric.date >= startDate &&
      metric.date <= endDate &&
      (metric.messagesPosted > 0 || metric.starsReceived > 0)
    );
  }

  // Leaderboard operations
  async getLeaderboard(period: 'daily' | 'weekly' | 'all', limit = 10): Promise<LeaderboardEntry[]> {
    let relevantTransactions = this.pointTransactions;
    
    if (period !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      if (period === 'daily') {
        cutoff.setDate(now.getDate() - 1);
      } else if (period === 'weekly') {
        cutoff.setDate(now.getDate() - 7);
      }
      
      relevantTransactions = this.pointTransactions.filter(t => 
        t.createdAt >= cutoff && t.type === 'earn'
      );
    }

    // Aggregate points by user
    const userPoints = new Map<string, number>();
    relevantTransactions.forEach(t => {
      if (t.type === 'earn') {
        userPoints.set(t.humanId, (userPoints.get(t.humanId) || 0) + t.points);
      }
    });

    // Convert to leaderboard entries
    const entries: LeaderboardEntry[] = Array.from(userPoints.entries())
      .map(([humanId, points]) => ({
        rank: 0, // Will be set below
        humanId,
        handle: this.generateHandle(humanId),
        initials: this.generateInitials(humanId),
        points,
        trend: 'same' as const // Simplified for now
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);

    // Set ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries;
  }

  async getUserRank(humanId: string, period: 'daily' | 'weekly' | 'all'): Promise<number> {
    const leaderboard = await this.getLeaderboard(period, 100);
    const userEntry = leaderboard.find(entry => entry.humanId === humanId);
    return userEntry?.rank || 0;
  }

  // Point calculation operations
  async calculateDailyDistribution(room: string): Promise<DistributionSummary> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const users = await this.getUsersForDistribution({ start: yesterday, end: now }, room);
    
    // Point calculation constants
    const POINTS_PER_MESSAGE = 10;
    const POINTS_PER_STAR = 25;
    const WORK_MODE_BONUS = 1.5;
    const ACTIVITY_MULTIPLIER = 1.2;
    
    let totalPoints = 0;
    const topRecipients: UserPointSummary[] = users.map(user => {
      const basePoints = user.messagesPosted * POINTS_PER_MESSAGE + user.starsReceived * POINTS_PER_STAR;
      let finalPoints = basePoints;
      
      // Work mode bonus
      if (room === 'work' && (user.helpPostsCreated > 0 || user.advicePostsCreated > 0 || user.collabPostsCreated > 0)) {
        finalPoints = Math.floor(finalPoints * WORK_MODE_BONUS);
      }
      
      // Activity multiplier for very active users
      if (user.messagesPosted >= 10) {
        finalPoints = Math.floor(finalPoints * ACTIVITY_MULTIPLIER);
      }
      
      totalPoints += finalPoints;
      
      return {
        humanId: user.humanId,
        handle: this.generateHandle(user.humanId),
        totalPoints: finalPoints,
        lifetimeEarned: 0, // Will be filled later if needed
        pointsToday: finalPoints,
        rank: 0 // Will be set after sorting
      };
    })
    .filter(user => user.totalPoints > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints);

    // Set ranks
    topRecipients.forEach((user, index) => {
      user.rank = index + 1;
    });

    return {
      totalParticipants: topRecipients.length,
      totalPointsDistributed: totalPoints,
      averagePointsPerUser: topRecipients.length > 0 ? Math.round(totalPoints / topRecipients.length) : 0,
      topRecipients: topRecipients.slice(0, 10),
      distributionMethod: 'engagement_based'
    };
  }

  async calculateWeeklyDistribution(room: string): Promise<DistributionSummary> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const users = await this.getUsersForDistribution({ start: weekAgo, end: now }, room);
    
    // Weekly bonuses are higher
    const POINTS_PER_MESSAGE = 15;
    const POINTS_PER_STAR = 40;
    const WORK_MODE_BONUS = 2.0;
    const CONSISTENCY_BONUS = 1.3;
    
    // Group by user and sum across all days
    const userMetrics = new Map<string, ParticipationMetric>();
    users.forEach(metric => {
      const existing = userMetrics.get(metric.humanId);
      if (existing) {
        existing.messagesPosted += metric.messagesPosted;
        existing.starsReceived += metric.starsReceived;
        existing.workLinksShared += metric.workLinksShared;
        existing.helpPostsCreated += metric.helpPostsCreated;
        existing.advicePostsCreated += metric.advicePostsCreated;
        existing.collabPostsCreated += metric.collabPostsCreated;
      } else {
        userMetrics.set(metric.humanId, { ...metric });
      }
    });

    let totalPoints = 0;
    const topRecipients: UserPointSummary[] = Array.from(userMetrics.values()).map(user => {
      const basePoints = user.messagesPosted * POINTS_PER_MESSAGE + user.starsReceived * POINTS_PER_STAR;
      let finalPoints = basePoints;
      
      // Work mode bonus
      if (room === 'work' && (user.helpPostsCreated > 0 || user.advicePostsCreated > 0 || user.collabPostsCreated > 0)) {
        finalPoints = Math.floor(finalPoints * WORK_MODE_BONUS);
      }
      
      // Consistency bonus for users active multiple days
      const userDays = users.filter(u => u.humanId === user.humanId).length;
      if (userDays >= 5) {
        finalPoints = Math.floor(finalPoints * CONSISTENCY_BONUS);
      }
      
      totalPoints += finalPoints;
      
      return {
        humanId: user.humanId,
        handle: this.generateHandle(user.humanId),
        totalPoints: finalPoints,
        lifetimeEarned: 0,
        pointsToday: finalPoints,
        rank: 0
      };
    })
    .filter(user => user.totalPoints > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints);

    // Set ranks
    topRecipients.forEach((user, index) => {
      user.rank = index + 1;
    });

    return {
      totalParticipants: topRecipients.length,
      totalPointsDistributed: totalPoints,
      averagePointsPerUser: topRecipients.length > 0 ? Math.round(totalPoints / topRecipients.length) : 0,
      topRecipients: topRecipients.slice(0, 15),
      distributionMethod: 'weekly_consistency'
    };
  }

  async executeDistribution(distributionSummary: DistributionSummary, distributionEventId: string): Promise<void> {
    // Create point transactions for each recipient
    for (const recipient of distributionSummary.topRecipients) {
      if (recipient.totalPoints > 0) {
        await this.createPointTransaction({
          humanId: recipient.humanId,
          type: 'earn',
          source: distributionSummary.distributionMethod.includes('weekly') ? 'weekly_rain' : 'daily_rain',
          points: recipient.totalPoints,
          description: `Room Rain distribution - ${recipient.totalPoints} points earned`,
          distributionEventId
        });
      }
    }
  }

  private getSourceDescription(source: string): string {
    const descriptions = {
      'message': 'Points earned from posting messages',
      'star': 'Bonus points from receiving stars',
      'work_bonus': 'Work Mode collaboration bonus',
      'daily_rain': 'Daily Room Rain distribution',
      'weekly_rain': 'Weekly bonus distribution',
      'activity_bonus': 'Activity participation bonus'
    };
    return descriptions[source] || 'Points earned';
  }

  // Moderation action operations
  async getModerationAction(id: string): Promise<ModerationAction | undefined> {
    return this.moderationActions.get(id);
  }

  async createModerationAction(action: InsertModerationAction): Promise<ModerationAction> {
    const newAction: ModerationAction = {
      ...action,
      id: action.id || randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };
    this.moderationActions.set(newAction.id, newAction);
    return newAction;
  }

  async getModerationActionsForContent(contentId: string): Promise<ModerationAction[]> {
    return Array.from(this.moderationActions.values())
      .filter(action => action.targetId === contentId && action.targetType === 'content');
  }

  async getModerationActionsForUser(humanId: string): Promise<ModerationAction[]> {
    return Array.from(this.moderationActions.values())
      .filter(action => action.targetId === humanId && action.targetType === 'user');
  }

  async getActiveModerationActions(humanId: string): Promise<ModerationAction[]> {
    const now = new Date();
    return Array.from(this.moderationActions.values())
      .filter(action => 
        action.targetId === humanId && 
        action.targetType === 'user' &&
        action.isActive &&
        (!action.expiresAt || new Date(action.expiresAt) > now)
      );
  }

  async expireModerationActions(): Promise<void> {
    const now = new Date();
    for (const [id, action] of this.moderationActions.entries()) {
      if (action.expiresAt && new Date(action.expiresAt) <= now) {
        action.isActive = false;
        this.moderationActions.set(id, action);
      }
    }
  }

  // User trust score operations
  async getUserTrustScore(humanId: string): Promise<UserTrustScore | undefined> {
    return this.userTrustScores.get(humanId);
  }

  async createUserTrustScore(trustScore: InsertUserTrustScore): Promise<UserTrustScore> {
    const newTrustScore: UserTrustScore = {
      ...trustScore,
      id: trustScore.id || randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.userTrustScores.set(newTrustScore.humanId, newTrustScore);
    return newTrustScore;
  }

  async updateUserTrustScore(humanId: string, updates: Partial<InsertUserTrustScore>): Promise<UserTrustScore> {
    const existing = this.userTrustScores.get(humanId);
    if (!existing) {
      return this.createUserTrustScore({ ...updates, humanId } as InsertUserTrustScore);
    }
    const updated: UserTrustScore = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.userTrustScores.set(humanId, updated);
    return updated;
  }

  async calculateUserTrustScore(humanId: string): Promise<UserTrustScore> {
    // Simple implementation for MemStorage
    const existing = await this.getUserTrustScore(humanId);
    if (existing) return existing;
    
    return this.createUserTrustScore({
      humanId,
      overallTrustScore: 50,
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
      maxDailyMessages: 50
    });
  }

  async getUsersByTrustLevel(trustLevel: string): Promise<UserTrustScore[]> {
    return Array.from(this.userTrustScores.values())
      .filter(score => score.trustLevel === trustLevel);
  }

  // Moderation analysis operations
  async createModerationAnalysis(analysis: InsertModerationAnalysis): Promise<ModerationAnalysis> {
    const newAnalysis: ModerationAnalysis = {
      ...analysis,
      id: analysis.id || randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.moderationAnalyses.set(newAnalysis.id, newAnalysis);
    return newAnalysis;
  }

  // Content similarity operations
  async createContentSimilarity(similarity: InsertContentSimilarity): Promise<ContentSimilarity> {
    const newSimilarity: ContentSimilarity = {
      ...similarity,
      id: similarity.id || randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.contentSimilarities.set(newSimilarity.id, newSimilarity);
    return newSimilarity;
  }

  // Moderation queue operations  
  async createModerationQueueItem(item: InsertModerationQueue): Promise<ModerationQueue> {
    const newItem: ModerationQueue = {
      ...item,
      id: item.id || randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.moderationQueue.set(newItem.id, newItem);
    return newItem;
  }
}

export class DatabaseStorage implements IStorage {
  private presenceMap: Map<string, Date> = new Map();

  constructor() {
    this.initializeDefaultData();
  }

  private async initializeDefaultData(): Promise<void> {
    try {
      // Initialize with today's default theme if not exists
      const today = new Date().toISOString().split('T')[0];
      const existingTheme = await this.getThemeForDate(today);
      
      if (!existingTheme) {
        await this.createTheme({
          date: today,
          topicText: "What are you building today?"
        });
      }

      // Initialize with some demo ledger entries if empty
      const existingEntries = await this.getLedgerEntries(1);
      if (existingEntries.length === 0) {
        await this.createLedgerEntry({
          title: "Daily Room Rain #247",
          description: "Points distributed to active humans based on engagement and upvotes",
          totalPoints: 1000,
          participantCount: 23
        });

        await this.createLedgerEntry({
          title: "Weekly Bonus Rain #35", 
          description: "Bonus points for most helpful humans in Work Mode",
          totalPoints: 500,
          participantCount: 12
        });
      }
    } catch (error) {
      console.error('Error initializing default data:', error);
    }
  }

  async getHuman(id: string): Promise<Human | undefined> {
    const result = await db.select().from(humans).where(eq(humans.id, id)).limit(1);
    return result[0] || undefined;
  }

  async createHuman(insertHuman: InsertHuman): Promise<Human> {
    const result = await db.insert(humans).values(insertHuman).returning();
    return result[0];
  }

  async updateHumanCapsuleSeen(id: string): Promise<void> {
    await db.update(humans).set({ capsuleSeen: true }).where(eq(humans.id, id));
  }

  async updateHumanMuteList(id: string, muteList: string[]): Promise<void> {
    await db.update(humans).set({ muteList }).where(eq(humans.id, id));
  }

  async updateHumanRole(id: string, role: 'guest' | 'verified' | 'admin'): Promise<void> {
    await db.update(humans).set({ role }).where(eq(humans.id, id));
  }

  async getGuestSession(id: string): Promise<GuestSession | undefined> {
    const result = await db.select().from(guestSessions).where(eq(guestSessions.id, id)).limit(1);
    return result[0] || undefined;
  }

  async getGuestSessionByHash(ipHash: string, userAgentHash: string): Promise<GuestSession | undefined> {
    const result = await db.select().from(guestSessions)
      .where(and(
        eq(guestSessions.ipHash, ipHash),
        eq(guestSessions.userAgentHash, userAgentHash)
      ))
      .limit(1);
    return result[0] || undefined;
  }

  async createGuestSession(session: InsertGuestSession): Promise<GuestSession> {
    const result = await db.insert(guestSessions).values(session).returning();
    return result[0];
  }

  async updateGuestSessionActivity(id: string): Promise<void> {
    await db.update(guestSessions).set({ lastSeen: new Date() }).where(eq(guestSessions.id, id));
  }

  async incrementGuestMessageCount(id: string, dayBucket: string): Promise<void> {
    const session = await this.getGuestSession(id);
    if (session) {
      if (session.dayBucket !== dayBucket) {
        await db.update(guestSessions).set({ 
          dayBucket,
          messageCount: 1 
        }).where(eq(guestSessions.id, id));
      } else {
        await db.update(guestSessions)
          .set({ messageCount: sql`${guestSessions.messageCount} + 1` })
          .where(eq(guestSessions.id, id));
      }
    }
  }

  async getGuestMessageCount(id: string, dayBucket: string): Promise<number> {
    const session = await this.getGuestSession(id);
    if (session && session.dayBucket === dayBucket) {
      return session.messageCount;
    }
    return 0;
  }

  async getMessages(room: string, limit = 50): Promise<MessageWithAuthor[]> {
    const messageResults = await db
      .select()
      .from(messages)
      .where(and(eq(messages.room, room), eq(messages.isHidden, false)))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    // Reverse to get chronological order
    const sortedMessages = messageResults.reverse();

    return sortedMessages.map(message => ({
      ...message,
      authorHandle: this.generateHandle(message.authorHumanId),
      isStarredByUser: false
    }));
  }

  async getMessageById(id: string): Promise<Message | undefined> {
    const result = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return result[0] || undefined;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(insertMessage).returning();
    return result[0];
  }

  async incrementMessageStars(messageId: string): Promise<void> {
    await db
      .update(messages)
      .set({ starsCount: sql`${messages.starsCount} + 1` })
      .where(eq(messages.id, messageId));
  }

  async incrementMessageReports(messageId: string): Promise<void> {
    await db
      .update(messages)
      .set({ reportsCount: sql`${messages.reportsCount} + 1` })
      .where(eq(messages.id, messageId));
  }

  async hideMessage(messageId: string): Promise<void> {
    await db.update(messages).set({ isHidden: true }).where(eq(messages.id, messageId));
  }

  async getUserStarForMessage(messageId: string, humanId: string): Promise<Star | undefined> {
    const result = await db
      .select()
      .from(stars)
      .where(and(eq(stars.messageId, messageId), eq(stars.humanId, humanId)))
      .limit(1);
    return result[0] || undefined;
  }

  async createStar(insertStar: InsertStar): Promise<Star> {
    const result = await db.insert(stars).values(insertStar).returning();
    await this.incrementMessageStars(insertStar.messageId);
    return result[0];
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const result = await db.insert(reports).values(insertReport).returning();
    await this.incrementMessageReports(insertReport.messageId);
    
    // Auto-hide if report threshold reached (3 reports)
    const reportCount = await this.getReportCountForMessage(insertReport.messageId);
    if (reportCount >= 3) {
      await this.hideMessage(insertReport.messageId);
    }
    
    return result[0];
  }

  async getReportCountForMessage(messageId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(reports)
      .where(eq(reports.messageId, messageId));
    return result[0]?.count || 0;
  }

  async getThemeForDate(date: string): Promise<Theme | undefined> {
    const result = await db.select().from(themes).where(eq(themes.date, date)).limit(1);
    return result[0] || undefined;
  }

  async createTheme(insertTheme: InsertTheme): Promise<Theme> {
    const result = await db.insert(themes).values(insertTheme).returning();
    return result[0];
  }

  async getRateLimit(humanId: string, action: string, windowType: string): Promise<number> {
    const windowMs = this.getWindowMs(windowType);
    const windowStart = new Date(Date.now() - windowMs);
    
    const result = await db
      .select({ count: sql<number>`sum(${rateLimits.count})` })
      .from(rateLimits)
      .where(and(
        eq(rateLimits.humanId, humanId),
        eq(rateLimits.action, action),
        eq(rateLimits.windowType, windowType),
        gte(rateLimits.windowStart, windowStart)
      ));
    
    return Number(result[0]?.count) || 0;
  }

  async incrementRateLimit(humanId: string, action: string, windowType: string): Promise<void> {
    const windowMs = this.getWindowMs(windowType);
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    
    // Check if there's an existing rate limit entry within the current window
    const existing = await db
      .select()
      .from(rateLimits)
      .where(and(
        eq(rateLimits.humanId, humanId),
        eq(rateLimits.action, action),
        eq(rateLimits.windowType, windowType),
        gte(rateLimits.windowStart, windowStart)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing entry
      await db
        .update(rateLimits)
        .set({ count: sql`${rateLimits.count} + 1` })
        .where(eq(rateLimits.id, existing[0].id));
    } else {
      // Create new entry
      await db.insert(rateLimits).values({
        humanId,
        action,
        windowType,
        count: 1,
        windowStart: now
      });
    }
  }

  async getLedgerEntries(limit = 20): Promise<LedgerEntry[]> {
    const result = await db
      .select()
      .from(ledgerEntries)
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(limit);
    return result;
  }

  async createLedgerEntry(insertEntry: InsertLedgerEntry): Promise<LedgerEntry> {
    const result = await db.insert(ledgerEntries).values(insertEntry).returning();
    return result[0];
  }

  async createConnectRequest(insertRequest: InsertConnectRequest): Promise<ConnectRequest> {
    const result = await db.insert(connectRequests).values(insertRequest).returning();
    return result[0];
  }

  async getVerificationByNullifierHash(nullifierHashHashed: string): Promise<Verification | undefined> {
    const result = await db
      .select()
      .from(verifications)
      .where(eq(verifications.nullifierHashHashed, nullifierHashHashed))
      .limit(1);
    return result[0];
  }

  async createVerification(insertVerification: InsertVerification): Promise<Verification> {
    const result = await db.insert(verifications).values(insertVerification).returning();
    return result[0];
  }

  async getHumanProfile(humanId: string): Promise<HumanProfile | undefined> {
    const human = await this.getHuman(humanId);
    if (!human) return undefined;

    // Get message count and total stars for this user
    const messageStats = await db
      .select({
        totalPosts: count(),
        starsReceived: sql<number>`sum(${messages.starsCount})`
      })
      .from(messages)
      .where(eq(messages.authorHumanId, humanId));
    
    const stats = messageStats[0] || { totalPosts: 0, starsReceived: 0 };
    
    return {
      id: humanId,
      handle: this.generateHandle(humanId),
      initials: this.generateInitials(humanId),
      firstSeen: human.joinedAt.toLocaleDateString(),
      totalPosts: stats.totalPosts,
      starsReceived: Number(stats.starsReceived) || 0
    };
  }

  async getOnlinePresence(): Promise<OnlinePresence> {
    // Clean up old presence records (older than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    for (const [humanId, lastSeen] of Array.from(this.presenceMap.entries())) {
      if (lastSeen < fiveMinutesAgo) {
        this.presenceMap.delete(humanId);
      }
    }
    
    const count = this.presenceMap.size;
    const roundedCount = count < 10 ? `${count}` : `${Math.round(count / 10) * 10}+`;
    
    return { count, roundedCount };
  }

  async updatePresence(humanId: string): Promise<void> {
    this.presenceMap.set(humanId, new Date());
  }

  private getWindowMs(windowType: string): number {
    switch (windowType) {
      case 'minute': return 60 * 1000;
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      default: return 60 * 1000;
    }
  }

  private generateHandle(humanId: string): string {
    // Generate a consistent pseudonymous handle from the human ID
    const names = ['alex', 'sarah', 'maya', 'jake', 'eli', 'zoe', 'kai', 'luna'];
    const suffixes = ['dev', 'pm', 'founder', 'mentor', 'curious', 'builder', 'creator', 'human'];
    
    const hash = this.simpleHash(humanId);
    const name = names[hash % names.length];
    const suffix = suffixes[(hash >> 3) % suffixes.length];
    
    return `${name}_${suffix}`;
  }

  private generateInitials(humanId: string): string {
    const handle = this.generateHandle(humanId);
    const parts = handle.split('_');
    return parts.map(part => part[0].toUpperCase()).join('');
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Enhanced topic system operations for DatabaseStorage
  async getTopic(id: string): Promise<Topic | undefined> {
    const result = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
    return result[0] || undefined;
  }

  async getTopics(filters?: { category?: string; status?: string; authorId?: string; limit?: number }): Promise<Topic[]> {
    let query = db.select().from(topics);
    
    const conditions = [];
    if (filters?.category) {
      conditions.push(eq(topics.category, filters.category));
    }
    if (filters?.status) {
      conditions.push(eq(topics.status, filters.status));
    }
    if (filters?.authorId) {
      conditions.push(eq(topics.authorHumanId, filters.authorId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(topics.priority), desc(topics.createdAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
  }

  async createTopic(insertTopic: InsertTopic): Promise<Topic> {
    const result = await db.insert(topics).values(insertTopic).returning();
    return result[0];
  }

  async updateTopic(id: string, updates: Partial<InsertTopic>): Promise<Topic | undefined> {
    const result = await db.update(topics)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(topics.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deleteTopic(id: string): Promise<boolean> {
    const result = await db.delete(topics).where(eq(topics.id, id));
    return result.rowCount > 0;
  }

  // Topic scheduling operations
  async getTopicSchedule(id: string): Promise<TopicSchedule | undefined> {
    const result = await db.select().from(topicSchedules).where(eq(topicSchedules.id, id)).limit(1);
    return result[0] || undefined;
  }

  async getTopicScheduleByDate(date: string): Promise<TopicSchedule | undefined> {
    const result = await db.select().from(topicSchedules)
      .where(eq(topicSchedules.scheduledDate, date))
      .orderBy(desc(topicSchedules.isActive), desc(topicSchedules.createdAt))
      .limit(1);
    return result[0] || undefined;
  }

  async getTopicSchedules(filters?: { startDate?: string; endDate?: string; isActive?: boolean }): Promise<TopicSchedule[]> {
    let query = db.select().from(topicSchedules);
    
    const conditions = [];
    if (filters?.startDate) {
      conditions.push(gte(topicSchedules.scheduledDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(sql`${topicSchedules.scheduledDate} <= ${filters.endDate}`);
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(topicSchedules.isActive, filters.isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(topicSchedules.scheduledDate);
  }

  async createTopicSchedule(schedule: InsertTopicSchedule): Promise<TopicSchedule> {
    const result = await db.insert(topicSchedules).values(schedule).returning();
    return result[0];
  }

  async updateTopicSchedule(id: string, updates: Partial<InsertTopicSchedule>): Promise<TopicSchedule | undefined> {
    const result = await db.update(topicSchedules)
      .set(updates)
      .where(eq(topicSchedules.id, id))
      .returning();
    return result[0] || undefined;
  }

  async activateTopicSchedule(id: string): Promise<void> {
    const schedule = await this.getTopicSchedule(id);
    if (!schedule) return;
    
    // Deactivate other active schedules for the same date
    await db.update(topicSchedules)
      .set({ isActive: false, deactivatedAt: new Date() })
      .where(and(
        eq(topicSchedules.scheduledDate, schedule.scheduledDate),
        sql`${topicSchedules.id} != ${id}`,
        eq(topicSchedules.isActive, true)
      ));
    
    // Activate this schedule
    await db.update(topicSchedules)
      .set({ isActive: true, activatedAt: new Date() })
      .where(eq(topicSchedules.id, id));
  }

  async deactivateTopicSchedule(id: string): Promise<void> {
    await db.update(topicSchedules)
      .set({ isActive: false, deactivatedAt: new Date() })
      .where(eq(topicSchedules.id, id));
  }

  // Topic engagement operations
  async getTopicEngagement(topicId: string, date: string): Promise<TopicEngagement | undefined> {
    const result = await db.select().from(topicEngagement)
      .where(and(
        eq(topicEngagement.topicId, topicId),
        eq(topicEngagement.date, date)
      ))
      .limit(1);
    return result[0] || undefined;
  }

  async updateTopicEngagement(engagement: InsertTopicEngagement): Promise<TopicEngagement> {
    const existing = await this.getTopicEngagement(engagement.topicId, engagement.date);
    
    if (existing) {
      const result = await db.update(topicEngagement)
        .set({ ...engagement, updatedAt: new Date() })
        .where(and(
          eq(topicEngagement.topicId, engagement.topicId),
          eq(topicEngagement.date, engagement.date)
        ))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(topicEngagement).values(engagement).returning();
      return result[0];
    }
  }

  async getTopicEngagementHistory(topicId: string): Promise<TopicEngagement[]> {
    return await db.select().from(topicEngagement)
      .where(eq(topicEngagement.topicId, topicId))
      .orderBy(topicEngagement.date);
  }

  // Daily topic operations
  async getCurrentTopic(): Promise<TopicWithSchedule | null> {
    const today = new Date().toISOString().split('T')[0];
    const schedule = await this.getTopicScheduleByDate(today);
    
    if (!schedule || !schedule.isActive) {
      // Fallback to the highest priority approved topic
      const fallbackTopics = await this.getTopics({ status: 'approved', limit: 1 });
      if (fallbackTopics.length > 0) {
        return {
          ...fallbackTopics[0],
          schedule: null,
          engagement: null,
          isScheduled: false,
          isActive: false,
        };
      }
      return null;
    }

    const topic = await this.getTopic(schedule.topicId);
    if (!topic) return null;

    const engagement = await this.getTopicEngagement(topic.id, today);

    return {
      ...topic,
      schedule,
      engagement: engagement || null,
      isScheduled: true,
      isActive: schedule.isActive,
    };
  }

  async getDailyTopicInfo(): Promise<DailyTopicInfo> {
    const current = await this.getCurrentTopic();
    const upcoming = await this.getUpcomingTopics(5);
    const recent = await this.getRecentTopics(5);

    // Fallback topic if current is null
    let fallbackTopic: Topic | null = null;
    if (!current) {
      const topics = await this.getTopics({ status: 'approved', limit: 1 });
      fallbackTopic = topics[0] || null;
    }

    return {
      current: current,
      upcoming,
      recent,
      fallback: fallbackTopic!,
    };
  }

  async getUpcomingTopics(limit = 5): Promise<TopicWithSchedule[]> {
    const today = new Date().toISOString().split('T')[0];
    const schedules = await db.select().from(topicSchedules)
      .where(sql`${topicSchedules.scheduledDate} > ${today}`)
      .orderBy(topicSchedules.scheduledDate)
      .limit(limit);

    const results: TopicWithSchedule[] = [];
    for (const schedule of schedules) {
      const topic = await this.getTopic(schedule.topicId);
      if (topic) {
        results.push({
          ...topic,
          schedule,
          engagement: null,
          isScheduled: true,
          isActive: schedule.isActive,
        });
      }
    }
    return results;
  }

  async getRecentTopics(limit = 5): Promise<TopicWithSchedule[]> {
    const today = new Date().toISOString().split('T')[0];
    const schedules = await db.select().from(topicSchedules)
      .where(sql`${topicSchedules.scheduledDate} < ${today}`)
      .orderBy(desc(topicSchedules.scheduledDate))
      .limit(limit);

    const results: TopicWithSchedule[] = [];
    for (const schedule of schedules) {
      const topic = await this.getTopic(schedule.topicId);
      if (topic) {
        const engagement = await this.getTopicEngagement(topic.id, schedule.scheduledDate);
        results.push({
          ...topic,
          schedule,
          engagement: engagement || null,
          isScheduled: true,
          isActive: schedule.isActive,
        });
      }
    }
    return results;
  }

  // Topic analytics operations
  async getTopicAnalytics(topicId: string): Promise<TopicAnalytics | undefined> {
    const topic = await this.getTopic(topicId);
    if (!topic) return undefined;

    const engagements = await this.getTopicEngagementHistory(topicId);
    if (engagements.length === 0) {
      return {
        topicId: topic.id,
        title: topic.title,
        category: topic.category,
        totalDays: 0,
        totalMessages: 0,
        totalStars: 0,
        totalParticipants: 0,
        avgEngagementPerDay: 0,
        lastUsed: undefined,
        performanceScore: 0,
      };
    }

    let totalMessages = 0;
    let totalStars = 0;
    let totalParticipants = 0;
    let avgEngagementScore = 0;

    engagements.forEach(eng => {
      totalMessages += eng.messagesCount;
      totalStars += eng.starsCount;
      totalParticipants += eng.participantsCount;
      avgEngagementScore += eng.avgEngagementScore;
    });

    const performanceScore = (totalStars * 10 + totalMessages * 5 + totalParticipants * 2) / engagements.length;

    return {
      topicId: topic.id,
      title: topic.title,
      category: topic.category,
      totalDays: engagements.length,
      totalMessages,
      totalStars,
      totalParticipants,
      avgEngagementPerDay: Math.round(avgEngagementScore / engagements.length),
      lastUsed: engagements[engagements.length - 1]?.date,
      performanceScore: Math.round(performanceScore),
    };
  }

  async getTopicsAnalytics(filters?: { category?: string; dateRange?: { start: string; end: string } }): Promise<TopicAnalytics[]> {
    const allTopics = await this.getTopics();
    const analyticsPromises = allTopics.map(topic => this.getTopicAnalytics(topic.id));
    const analytics = await Promise.all(analyticsPromises);

    return analytics.filter((a): a is TopicAnalytics => !!a);
  }

  async getAdminTopicSummary(): Promise<AdminTopicSummary> {
    const allTopics = await this.getTopics();
    const activeSchedules = await this.getTopicSchedules({ isActive: true });

    const activeTopics = new Set(activeSchedules.map(s => s.topicId));
    const today = new Date().toISOString().split('T')[0];
    const scheduledTopics = await this.getTopicSchedules({ startDate: today });

    const summary = {
      totalTopics: allTopics.length,
      activeTopics: activeTopics.size,
      scheduledTopics: scheduledTopics.length,
      draftTopics: allTopics.filter(t => t.status === 'draft').length,
      topCategories: [] as { category: string; count: number }[],
      recentActivity: [] as TopicAnalytics[],
    };

    // Top categories
    const categoryCounts = new Map<string, number>();
    allTopics.forEach(topic => {
      const count = categoryCounts.get(topic.category) || 0;
      categoryCounts.set(topic.category, count + 1);
    });
    summary.topCategories = Array.from(categoryCounts.entries())
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    // Recent activity
    const recentTopicAnalytics = await this.getTopicsAnalytics();
    summary.recentActivity = recentTopicAnalytics
      .sort((a, b) => (b.lastUsed || '').localeCompare(a.lastUsed || ''))
      .slice(0, 5);

    return summary;
  }

  // Topic rotation operations
  async rotateTopics(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const todaySchedule = await this.getTopicScheduleByDate(today);
    
    if (!todaySchedule || !todaySchedule.isActive) {
      // Find next available topic for today
      const availableTopics = await this.getTopics({ status: 'approved' });
      if (availableTopics.length > 0) {
        await this.scheduleTopicRotation(today, availableTopics[0].id);
        const newSchedule = await this.getTopicScheduleByDate(today);
        if (newSchedule) {
          await this.activateTopicSchedule(newSchedule.id);
        }
      }
    }
  }

  async scheduleTopicRotation(date: string, topicId: string): Promise<TopicSchedule> {
    // Check if a schedule already exists for this date
    const existing = await this.getTopicScheduleByDate(date);
    if (existing && existing.topicId === topicId) {
      return existing; // Already scheduled
    }

    // Deactivate existing schedule for this date if it exists and is different
    if (existing && existing.id) {
      await this.deactivateTopicSchedule(existing.id);
    }

    // Create new schedule
    return this.createTopicSchedule({
      topicId,
      scheduledDate: date,
      rotationType: 'daily', // Default to daily rotation
    });
  }

  async getTopicRotationSchedule(timeRange: { start: string; end: string }): Promise<TopicSchedule[]> {
    return this.getTopicSchedules({ startDate: timeRange.start, endDate: timeRange.end });
  }

  // Topic engagement tracking
  async recordTopicEngagement(messageId: string, topicId: string): Promise<void> {
    // For DatabaseStorage, we could store this in a separate table if needed
    // For now, just update daily engagement metrics
    const today = new Date().toISOString().split('T')[0];
    const currentEngagement = await this.getTopicEngagement(topicId, today) || {
      topicId,
      date: today,
      messagesCount: 0,
      starsCount: 0,
      participantsCount: 0,
      avgEngagementScore: 0,
    };
    
    // Increment message count
    await this.updateTopicEngagement({
      ...currentEngagement,
      messagesCount: currentEngagement.messagesCount + 1,
    });
  }

  async getMessageTopicEngagement(messageId: string): Promise<string | null> {
    // For DatabaseStorage, this would require a separate table to track message-topic associations
    // For now, return null as this is primarily used for memory storage
    return null;
  }

  // Moderation action operations
  async getModerationAction(id: string): Promise<ModerationAction | undefined> {
    const result = await db.select().from(moderationActions).where(eq(moderationActions.id, id)).limit(1);
    return result[0];
  }

  async createModerationAction(action: InsertModerationAction): Promise<ModerationAction> {
    const result = await db.insert(moderationActions).values({
      ...action,
      id: action.id || randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }).returning();
    return result[0];
  }

  async getModerationActionsForContent(contentId: string): Promise<ModerationAction[]> {
    return await db.select()
      .from(moderationActions)
      .where(and(
        eq(moderationActions.targetId, contentId),
        eq(moderationActions.targetType, 'content')
      ));
  }

  async getModerationActionsForUser(humanId: string): Promise<ModerationAction[]> {
    return await db.select()
      .from(moderationActions)
      .where(and(
        eq(moderationActions.targetId, humanId),
        eq(moderationActions.targetType, 'user')
      ));
  }

  async getActiveModerationActions(humanId: string): Promise<ModerationAction[]> {
    const now = new Date();
    return await db.select()
      .from(moderationActions)
      .where(and(
        eq(moderationActions.targetId, humanId),
        eq(moderationActions.targetType, 'user'),
        eq(moderationActions.isActive, true),
        sql`(${moderationActions.expiresAt} IS NULL OR ${moderationActions.expiresAt} > ${now})`
      ));
  }

  async expireModerationActions(): Promise<void> {
    const now = new Date();
    await db.update(moderationActions)
      .set({ isActive: false, updatedAt: now })
      .where(and(
        eq(moderationActions.isActive, true),
        sql`${moderationActions.expiresAt} <= ${now}`
      ));
  }

  // User trust score operations
  async getUserTrustScore(humanId: string): Promise<UserTrustScore | undefined> {
    const result = await db.select().from(userTrustScores).where(eq(userTrustScores.humanId, humanId)).limit(1);
    return result[0];
  }

  async createUserTrustScore(trustScore: InsertUserTrustScore): Promise<UserTrustScore> {
    const result = await db.insert(userTrustScores).values({
      ...trustScore,
      id: trustScore.id || randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result[0];
  }

  async updateUserTrustScore(humanId: string, updates: Partial<InsertUserTrustScore>): Promise<UserTrustScore> {
    const existing = await this.getUserTrustScore(humanId);
    if (!existing) {
      return this.createUserTrustScore({ ...updates, humanId } as InsertUserTrustScore);
    }
    
    const result = await db.update(userTrustScores)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userTrustScores.humanId, humanId))
      .returning();
    return result[0];
  }

  async calculateUserTrustScore(humanId: string): Promise<UserTrustScore> {
    // For DatabaseStorage, fetch or create with default values
    const existing = await this.getUserTrustScore(humanId);
    if (existing) return existing;
    
    return this.createUserTrustScore({
      humanId,
      overallTrustScore: 50,
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
      maxDailyMessages: 50
    });
  }

  async getUsersByTrustLevel(trustLevel: string): Promise<UserTrustScore[]> {
    return await db.select()
      .from(userTrustScores)
      .where(eq(userTrustScores.trustLevel, trustLevel));
  }

  // Moderation analysis operations
  async createModerationAnalysis(analysis: InsertModerationAnalysis): Promise<ModerationAnalysis> {
    const result = await db.insert(moderationAnalysis).values({
      ...analysis,
      id: analysis.id || randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result[0];
  }

  // Content similarity operations
  async createContentSimilarity(similarity: InsertContentSimilarity): Promise<ContentSimilarity> {
    const result = await db.insert(contentSimilarity).values({
      ...similarity,
      id: similarity.id || randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result[0];
  }

  // Moderation queue operations
  async createModerationQueueItem(item: InsertModerationQueue): Promise<ModerationQueue> {
    const result = await db.insert(moderationQueue).values({
      ...item,
      id: item.id || randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
