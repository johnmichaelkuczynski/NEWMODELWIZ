import { 
  users, 
  documents, 
  analyses, 
  userActivities, 
  cognitiveProfiles, 
  intelligentRewrites,
  rewriteJobs,
  userCredits,
  creditTransactions,
  type User, 
  type InsertUser, 
  type InsertDocument, 
  type Document, 
  type InsertUserActivity, 
  type InsertCognitiveProfile,
  type InsertRewriteJob,
  type RewriteJob,
  type UserCredits,
  type InsertUserCredits,
  type CreditTransaction,
  type InsertCreditTransaction
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  sessionStore: any;
  
  // Document operations
  createDocument(doc: InsertDocument): Promise<Document>;
  getDocumentsByUser(userId: number): Promise<Document[]>;
  
  // Analysis operations
  createAnalysis(analysis: any): Promise<any>;
  
  // Intelligent Rewrite operations
  createIntelligentRewrite(rewrite: any): Promise<any>;
  
  // Activity tracking
  logActivity(activity: InsertUserActivity): Promise<void>;
  
  // Cognitive profile operations
  getCognitiveProfile(userId: number): Promise<any>;
  updateCognitiveProfile(userId: number, profile: Partial<InsertCognitiveProfile>): Promise<void>;
  
  // GPT Bypass Humanizer operations
  createRewriteJob(job: InsertRewriteJob): Promise<RewriteJob>;
  getRewriteJob(id: number): Promise<RewriteJob | undefined>;
  updateRewriteJob(id: number, updates: Partial<RewriteJob>): Promise<RewriteJob>;
  listRewriteJobs(): Promise<RewriteJob[]>;
  
  // Credit system operations
  getUserCredits(userId: number, provider: string): Promise<UserCredits | undefined>;
  getAllUserCredits(userId: number): Promise<UserCredits[]>;
  initializeUserCredits(userId: number, provider: string): Promise<UserCredits>;
  updateUserCredits(userId: number, provider: string, credits: number): Promise<UserCredits>;
  deductCredits(userId: number, provider: string, amount: number): Promise<boolean>;
  createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction>;
  getCreditTransaction(id: number): Promise<CreditTransaction | undefined>;
  getCreditTransactionByStripeSession(sessionId: string): Promise<CreditTransaction | undefined>;
  updateCreditTransactionStatus(id: number, status: string, paymentIntentId?: string): Promise<CreditTransaction>;
  updateCreditTransactionSessionId(id: number, sessionId: string): Promise<CreditTransaction>;
}

const MemoryStore = createMemoryStore(session);

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(doc)
      .returning();
    return document;
  }

  async getDocumentsByUser(userId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId));
  }

  async logActivity(activity: InsertUserActivity): Promise<void> {
    await db.insert(userActivities).values(activity);
  }

  async getCognitiveProfile(userId: number): Promise<any> {
    const [profile] = await db
      .select()
      .from(cognitiveProfiles)
      .where(eq(cognitiveProfiles.userId, userId));
    return profile;
  }

  async updateCognitiveProfile(userId: number, profile: Partial<InsertCognitiveProfile>): Promise<void> {
    await db
      .insert(cognitiveProfiles)
      .values({ ...profile, userId })
      .onConflictDoUpdate({
        target: cognitiveProfiles.userId,
        set: { ...profile, lastUpdated: new Date() }
      });
  }

  async createAnalysis(analysis: any): Promise<any> {
    const [result] = await db
      .insert(analyses)
      .values(analysis)
      .returning();
    return result;
  }

  async createIntelligentRewrite(rewrite: any): Promise<any> {
    const [result] = await db
      .insert(intelligentRewrites)
      .values(rewrite)
      .returning();
    return result;
  }
  
  // GPT Bypass Humanizer operations
  async createRewriteJob(insertJob: InsertRewriteJob): Promise<RewriteJob> {
    const [job] = await db
      .insert(rewriteJobs)
      .values(insertJob)
      .returning();
    return job;
  }

  async getRewriteJob(id: number): Promise<RewriteJob | undefined> {
    const result = await db
      .select()
      .from(rewriteJobs)
      .where(eq(rewriteJobs.id, id))
      .limit(1);
    return result[0];
  }

  async updateRewriteJob(id: number, updates: Partial<RewriteJob>): Promise<RewriteJob> {
    const [updated] = await db
      .update(rewriteJobs)
      .set(updates)
      .where(eq(rewriteJobs.id, id))
      .returning();
    return updated;
  }

  async listRewriteJobs(): Promise<RewriteJob[]> {
    return await db
      .select()
      .from(rewriteJobs)
      .orderBy(eq(rewriteJobs.createdAt, rewriteJobs.createdAt)) // Simple order by
      .limit(50);
  }
  
  // Credit system implementation
  async getUserCredits(userId: number, provider: string): Promise<UserCredits | undefined> {
    const [credits] = await db
      .select()
      .from(userCredits)
      .where(and(eq(userCredits.userId, userId), eq(userCredits.provider, provider)));
    return credits;
  }

  async getAllUserCredits(userId: number): Promise<UserCredits[]> {
    return await db
      .select()
      .from(userCredits)
      .where(eq(userCredits.userId, userId));
  }

  async initializeUserCredits(userId: number, provider: string): Promise<UserCredits> {
    const [credits] = await db
      .insert(userCredits)
      .values({ userId, provider, credits: 0 })
      .returning();
    return credits;
  }

  async updateUserCredits(userId: number, provider: string, credits: number): Promise<UserCredits> {
    const existing = await this.getUserCredits(userId, provider);
    if (!existing) {
      return this.initializeUserCredits(userId, provider);
    }
    
    const [updated] = await db
      .update(userCredits)
      .set({ credits, lastUpdated: new Date() })
      .where(eq(userCredits.id, existing.id))
      .returning();
    return updated;
  }

  async deductCredits(userId: number, provider: string, amount: number): Promise<boolean> {
    const existing = await this.getUserCredits(userId, provider);
    if (!existing || existing.credits < amount) {
      return false;
    }
    
    await db
      .update(userCredits)
      .set({ 
        credits: existing.credits - amount,
        lastUpdated: new Date()
      })
      .where(eq(userCredits.id, existing.id));
    
    return true;
  }

  async createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction> {
    const [result] = await db
      .insert(creditTransactions)
      .values(transaction)
      .returning();
    return result;
  }

  async getCreditTransaction(id: number): Promise<CreditTransaction | undefined> {
    const [transaction] = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.id, id));
    return transaction;
  }

  async getCreditTransactionByStripeSession(sessionId: string): Promise<CreditTransaction | undefined> {
    const [transaction] = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.stripeSessionId, sessionId));
    return transaction;
  }

  async updateCreditTransactionStatus(
    id: number, 
    status: string, 
    paymentIntentId?: string
  ): Promise<CreditTransaction> {
    const updateData: any = { status };
    if (paymentIntentId) {
      updateData.stripePaymentIntentId = paymentIntentId;
    }
    
    const [updated] = await db
      .update(creditTransactions)
      .set(updateData)
      .where(eq(creditTransactions.id, id))
      .returning();
    return updated;
  }

  async updateCreditTransactionSessionId(id: number, sessionId: string): Promise<CreditTransaction> {
    const [updated] = await db
      .update(creditTransactions)
      .set({ stripeSessionId: sessionId })
      .where(eq(creditTransactions.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
