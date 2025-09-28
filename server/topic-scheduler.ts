import { storage } from "./storage";

/**
 * TopicRotationScheduler handles automatic topic rotation at midnight UTC
 * and manages scheduled topic changes throughout the day.
 */
export class TopicRotationScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 60 * 1000; // Check every minute

  /**
   * Start the topic rotation scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Topic rotation scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting topic rotation scheduler...');

    // Run initial check
    await this.checkAndRotateTopics();

    // Schedule regular checks
    this.intervalId = setInterval(async () => {
      try {
        await this.checkAndRotateTopics();
      } catch (error) {
        console.error('Error in scheduled topic rotation check:', error);
      }
    }, this.checkIntervalMs);

    console.log(`Topic rotation scheduler started with ${this.checkIntervalMs}ms interval`);
  }

  /**
   * Stop the topic rotation scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('Topic rotation scheduler stopped');
  }

  /**
   * Check if topics need to be rotated and perform rotation if necessary
   */
  private async checkAndRotateTopics(): Promise<void> {
    try {
      const now = new Date();
      const today = this.formatDateUTC(now);
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();

      // Check if it's midnight UTC (topic rotation time)
      if (currentHour === 0 && currentMinute === 0) {
        console.log('Midnight UTC detected - triggering topic rotation');
        await this.performDailyRotation(today);
      }

      // Check for scheduled topic activations
      await this.checkScheduledActivations(today);

      // Ensure we have an active topic for today
      await this.ensureActiveTopic(today);

    } catch (error) {
      console.error('Error in checkAndRotateTopics:', error);
    }
  }

  /**
   * Perform daily topic rotation at midnight UTC
   */
  private async performDailyRotation(date: string): Promise<void> {
    console.log(`Performing daily topic rotation for ${date}`);

    try {
      // Deactivate yesterday's topic
      const yesterday = this.getYesterday(date);
      const yesterdaySchedule = await storage.getTopicScheduleByDate(yesterday);
      if (yesterdaySchedule && yesterdaySchedule.isActive) {
        await storage.deactivateTopicSchedule(yesterdaySchedule.id);
        console.log(`Deactivated yesterday's topic: ${yesterdaySchedule.topicId}`);
      }

      // Check if there's a scheduled topic for today
      let todaySchedule = await storage.getTopicScheduleByDate(date);
      
      if (!todaySchedule) {
        // No scheduled topic, create one using rotation algorithm
        const nextTopicId = await this.selectNextTopic(date);
        if (nextTopicId) {
          todaySchedule = await storage.scheduleTopicRotation(date, nextTopicId);
          console.log(`Auto-scheduled topic ${nextTopicId} for ${date}`);
        }
      }

      // Activate today's topic
      if (todaySchedule) {
        await storage.activateTopicSchedule(todaySchedule.id);
        console.log(`Activated topic schedule: ${todaySchedule.id}`);
        
        // Update engagement metrics for the new active topic
        await this.initializeDailyEngagement(todaySchedule.topicId, date);
      }

      console.log(`Daily rotation completed for ${date}`);
    } catch (error) {
      console.error(`Error performing daily rotation for ${date}:`, error);
    }
  }

  /**
   * Check for any scheduled topic activations that need to happen
   */
  private async checkScheduledActivations(date: string): Promise<void> {
    try {
      const schedules = await storage.getTopicSchedules({
        startDate: date,
        endDate: date,
        isActive: false
      });

      for (const schedule of schedules) {
        if (schedule.scheduledDate === date && !schedule.isActive) {
          // Check if this should be activated (e.g., special events, time-based activations)
          if (await this.shouldActivateSchedule(schedule)) {
            await storage.activateTopicSchedule(schedule.id);
            console.log(`Activated scheduled topic: ${schedule.topicId} for ${date}`);
          }
        }
      }
    } catch (error) {
      console.error('Error checking scheduled activations:', error);
    }
  }

  /**
   * Ensure there's an active topic for the given date
   */
  private async ensureActiveTopic(date: string): Promise<void> {
    try {
      const currentTopic = await storage.getCurrentTopic();
      
      if (!currentTopic || !currentTopic.isActive) {
        console.log(`No active topic found for ${date}, creating fallback`);
        
        // Try to find a scheduled topic for today
        let todaySchedule = await storage.getTopicScheduleByDate(date);
        
        if (!todaySchedule) {
          // Create a fallback topic schedule
          const fallbackTopicId = await this.selectFallbackTopic();
          if (fallbackTopicId) {
            todaySchedule = await storage.scheduleTopicRotation(date, fallbackTopicId);
            console.log(`Created fallback schedule for ${date}: ${fallbackTopicId}`);
          }
        }
        
        if (todaySchedule) {
          await storage.activateTopicSchedule(todaySchedule.id);
          console.log(`Activated fallback topic for ${date}`);
        }
      }
    } catch (error) {
      console.error('Error ensuring active topic:', error);
    }
  }

  /**
   * Smart topic selection algorithm that considers:
   * - Topic popularity and engagement
   * - Category diversity
   * - Recent usage history
   * - Special events or dates
   */
  private async selectNextTopic(date: string): Promise<string | null> {
    try {
      // Get all approved topics
      const availableTopics = await storage.getTopics({ status: 'approved' });
      
      if (availableTopics.length === 0) {
        console.warn('No approved topics available for rotation');
        return null;
      }

      // Get recent topic usage to avoid immediate repeats
      const recentTopics = await storage.getRecentTopics(7); // Last 7 days
      const recentTopicIds = new Set(recentTopics.map(t => t.id));

      // Get topic analytics for performance scoring
      const topicAnalytics = await Promise.all(
        availableTopics.map(async (topic) => ({
          topic,
          analytics: await storage.getTopicAnalytics(topic.id)
        }))
      );

      // Score topics based on multiple factors
      const scoredTopics = topicAnalytics.map(({ topic, analytics }) => {
        let score = 0;

        // Base score from priority
        score += topic.priority * 10;

        // Performance bonus (if we have analytics)
        if (analytics) {
          score += analytics.performanceScore * 0.1;
        }

        // Category diversity bonus
        const categoryBonus = this.getCategoryDiversityBonus(topic.category, date);
        score += categoryBonus;

        // Special topic bonus
        if (topic.isSpecial) {
          score += 20;
        }

        // Penalty for recent usage
        if (recentTopicIds.has(topic.id)) {
          score -= 30;
        }

        // Day-of-week specific bonuses
        const dayOfWeekBonus = this.getDayOfWeekBonus(topic, date);
        score += dayOfWeekBonus;

        return { topic, score };
      });

      // Sort by score and select the best topic
      scoredTopics.sort((a, b) => b.score - a.score);
      
      const selectedTopic = scoredTopics[0]?.topic;
      
      if (selectedTopic) {
        console.log(`Selected topic for ${date}: ${selectedTopic.title} (score: ${scoredTopics[0].score})`);
        return selectedTopic.id;
      }

      return null;
    } catch (error) {
      console.error('Error selecting next topic:', error);
      return null;
    }
  }

  /**
   * Select a fallback topic when no scheduled topics are available
   */
  private async selectFallbackTopic(): Promise<string | null> {
    try {
      const fallbackTopics = await storage.getTopics({ 
        status: 'approved',
        category: 'general',
        limit: 1
      });

      return fallbackTopics[0]?.id || null;
    } catch (error) {
      console.error('Error selecting fallback topic:', error);
      return null;
    }
  }

  /**
   * Determine if a schedule should be activated based on various criteria
   */
  private async shouldActivateSchedule(schedule: any): Promise<boolean> {
    // For now, activate all schedules on their scheduled date
    // This could be extended with time-based activation, user voting, etc.
    return true;
  }

  /**
   * Initialize daily engagement metrics for a newly activated topic
   */
  private async initializeDailyEngagement(topicId: string, date: string): Promise<void> {
    try {
      await storage.updateTopicEngagement({
        topicId,
        date,
        messagesCount: 0,
        starsCount: 0,
        participantsCount: 0,
        avgEngagementScore: 0
      });
    } catch (error) {
      console.error('Error initializing daily engagement:', error);
    }
  }

  /**
   * Get category diversity bonus to encourage variety
   */
  private getCategoryDiversityBonus(category: string, date: string): number {
    // This could be enhanced to check recent category usage
    // For now, give small bonuses to certain categories on specific days
    const dayOfWeek = new Date(date).getUTCDay();
    
    switch (dayOfWeek) {
      case 1: // Monday - tech focus
        return category === 'tech' ? 5 : 0;
      case 2: // Tuesday - collaboration
        return category === 'collaboration' ? 5 : 0;
      case 3: // Wednesday - general
        return category === 'general' ? 5 : 0;
      case 4: // Thursday - creativity
        return category === 'creativity' ? 5 : 0;
      case 5: // Friday - inspiration
        return category === 'inspiration' ? 5 : 0;
      default:
        return 0;
    }
  }

  /**
   * Get day-of-week specific bonuses for topics
   */
  private getDayOfWeekBonus(topic: any, date: string): number {
    const dayOfWeek = new Date(date).getUTCDay();
    
    // Weekend bonus for community and wellness topics
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (topic.category === 'community' || topic.category === 'wellness') {
        return 10;
      }
    }
    
    return 0;
  }

  /**
   * Format date as YYYY-MM-DD in UTC
   */
  private formatDateUTC(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get yesterday's date in YYYY-MM-DD format
   */
  private getYesterday(date: string): string {
    const yesterday = new Date(date);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return this.formatDateUTC(yesterday);
  }

  /**
   * Manual trigger for topic rotation (for admin use)
   */
  async triggerManualRotation(): Promise<void> {
    const today = this.formatDateUTC(new Date());
    console.log('Manual topic rotation triggered');
    await this.performDailyRotation(today);
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkIntervalMs,
      nextCheck: this.intervalId ? Date.now() + this.checkIntervalMs : null
    };
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(config: { checkIntervalMs?: number }) {
    if (config.checkIntervalMs && config.checkIntervalMs > 0) {
      this.checkIntervalMs = config.checkIntervalMs;
      
      // Restart if running
      if (this.isRunning) {
        this.stop();
        this.start();
      }
    }
  }
}