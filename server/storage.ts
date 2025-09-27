import { 
  type Human, 
  type InsertHuman,
  type Message,
  type InsertMessage,
  type Star,
  type InsertStar,
  type Report,
  type InsertReport,
  type Theme,
  type InsertTheme,
  type LedgerEntry,
  type InsertLedgerEntry,
  type ConnectRequest,
  type InsertConnectRequest,
  type MessageWithAuthor,
  type HumanProfile,
  type OnlinePresence
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Human operations
  getHuman(id: string): Promise<Human | undefined>;
  createHuman(human: InsertHuman): Promise<Human>;
  updateHumanCapsuleSeen(id: string): Promise<void>;
  updateHumanMuteList(id: string, muteList: string[]): Promise<void>;
  
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
  
  // Theme operations
  getThemeForDate(date: string): Promise<Theme | undefined>;
  createTheme(theme: InsertTheme): Promise<Theme>;
  
  // Rate limiting
  getRateLimit(humanId: string, action: string, windowType: string): Promise<number>;
  incrementRateLimit(humanId: string, action: string, windowType: string): Promise<void>;
  
  // Ledger operations
  getLedgerEntries(limit?: number): Promise<LedgerEntry[]>;
  createLedgerEntry(entry: InsertLedgerEntry): Promise<LedgerEntry>;
  
  // Connect requests
  createConnectRequest(request: InsertConnectRequest): Promise<ConnectRequest>;
  
  // Profile operations
  getHumanProfile(humanId: string): Promise<HumanProfile | undefined>;
  
  // Presence
  getOnlinePresence(): Promise<OnlinePresence>;
  updatePresence(humanId: string): Promise<void>;
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
  private presenceMap: Map<string, Date> = new Map();

  constructor() {
    // Initialize with today's default theme
    const today = new Date().toISOString().split('T')[0];
    this.themes.set(today, {
      id: randomUUID(),
      date: today,
      topicText: "What are you building today?"
    });

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

  async getHumanProfile(humanId: string): Promise<HumanProfile | undefined> {
    const human = this.humans.get(humanId);
    if (!human) return undefined;

    const userMessages = Array.from(this.messages.values())
      .filter(m => m.authorHumanId === humanId);
    
    const totalStars = userMessages.reduce((sum, m) => sum + m.starsCount, 0);
    
    return {
      id: humanId,
      handle: this.generateHandle(humanId),
      initials: this.generateInitials(humanId),
      firstSeen: human.joinedAt.toLocaleDateString(),
      totalPosts: userMessages.length,
      starsReceived: totalStars
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
}

export const storage = new MemStorage();
