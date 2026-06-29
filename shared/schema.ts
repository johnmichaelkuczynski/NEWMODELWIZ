import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Updated User model - username/password authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"), // Optional email field
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
});

// Document model for storing analyzed documents
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  originalContent: text("original_content"), // Store original content
  filename: text("filename"),
  mimeType: text("mime_type"),
  userId: integer("user_id").references(() => users.id),
  wordCount: integer("word_count"),
  mathNotationCount: integer("math_notation_count"), // Count of LaTeX expressions
  complexity: text("complexity"), // low, medium, high
  createdAt: timestamp("created_at").defaultNow().notNull(),
  aiProbability: integer("ai_probability"),
  isAi: boolean("is_ai"),
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  content: true,
  originalContent: true,
  filename: true,
  mimeType: true,
  userId: true,
  wordCount: true,
  mathNotationCount: true,
  complexity: true,
});

// Analysis model for storing document analysis results
export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  summary: text("summary").notNull(),
  overallScore: integer("overall_score").notNull(),
  overallAssessment: text("overall_assessment").notNull(),
  dimensions: jsonb("dimensions").notNull(),
  cognitivePatterns: jsonb("cognitive_patterns"), // AI-identified thinking patterns
  writingStyle: jsonb("writing_style"), // Style analysis
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalysisSchema = createInsertSchema(analyses).pick({
  documentId: true,
  userId: true,
  summary: true,
  overallScore: true,
  overallAssessment: true,
  dimensions: true,
  cognitivePatterns: true,
  writingStyle: true,
});

// Intelligent Rewrite model for storing rewrite results
export const intelligentRewrites = pgTable("intelligent_rewrites", {
  id: serial("id").primaryKey(),
  originalDocumentId: integer("original_document_id").references(() => documents.id).notNull(),
  rewrittenDocumentId: integer("rewritten_document_id").references(() => documents.id).notNull(),
  originalAnalysisId: integer("original_analysis_id").references(() => analyses.id).notNull(),
  rewrittenAnalysisId: integer("rewritten_analysis_id").references(() => analyses.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  provider: text("provider").notNull(),
  customInstructions: text("custom_instructions"),
  originalScore: integer("original_score").notNull(),
  rewrittenScore: integer("rewritten_score").notNull(),
  scoreImprovement: integer("score_improvement").notNull(),
  rewriteReport: text("rewrite_report").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIntelligentRewriteSchema = createInsertSchema(intelligentRewrites).pick({
  originalDocumentId: true,
  rewrittenDocumentId: true,
  originalAnalysisId: true,
  rewrittenAnalysisId: true,
  userId: true,
  provider: true,
  customInstructions: true,
  originalScore: true,
  rewrittenScore: true,
  scoreImprovement: true,
  rewriteReport: true,
});

// Comparison model for storing comparison results between two documents
export const comparisons = pgTable("comparisons", {
  id: serial("id").primaryKey(),
  documentAId: integer("document_a_id").references(() => documents.id).notNull(),
  documentBId: integer("document_b_id").references(() => documents.id).notNull(),
  analysisAId: integer("analysis_a_id").references(() => analyses.id).notNull(),
  analysisBId: integer("analysis_b_id").references(() => analyses.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  comparisonResults: jsonb("comparison_results").notNull(),
  improvementSuggestions: jsonb("improvement_suggestions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertComparisonSchema = createInsertSchema(comparisons).pick({
  documentAId: true,
  documentBId: true,
  analysisAId: true,
  analysisBId: true,
  userId: true,
  comparisonResults: true,
  improvementSuggestions: true,
});

// Case assessment model for evaluating how well documents make their case
export const caseAssessments = pgTable("case_assessments", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  proofEffectiveness: integer("proof_effectiveness").notNull(), // 0-100 score
  claimCredibility: integer("claim_credibility").notNull(), // 0-100 score  
  nonTriviality: integer("non_triviality").notNull(), // 0-100 score
  proofQuality: integer("proof_quality").notNull(), // 0-100 score
  functionalWriting: integer("functional_writing").notNull(), // 0-100 score
  overallCaseScore: integer("overall_case_score").notNull(), // 0-100 score
  detailedAssessment: text("detailed_assessment").notNull(), // Full LLM-generated report
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCaseAssessmentSchema = createInsertSchema(caseAssessments).pick({
  documentId: true,
  userId: true,
  proofEffectiveness: true,
  claimCredibility: true,
  nonTriviality: true,
  proofQuality: true,
  functionalWriting: true,
  overallCaseScore: true,
  detailedAssessment: true,
});

// User activity tracking for cognitive pattern analysis
export const userActivities = pgTable("user_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  activityType: text("activity_type").notNull(), // upload, analyze, compare, search
  activityData: jsonb("activity_data"), // Detailed activity information
  documentId: integer("document_id").references(() => documents.id),
  sessionDuration: integer("session_duration"), // in seconds
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertUserActivitySchema = createInsertSchema(userActivities).pick({
  userId: true,
  activityType: true,
  activityData: true,
  documentId: true,
  sessionDuration: true,
});

// Comprehensive cognitive profiles - the core analytics system
export const cognitiveProfiles = pgTable("cognitive_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).unique(),
  // Writing patterns and intellectual analysis
  writingPatterns: jsonb("writing_patterns"), // Sentence structure, vocabulary, complexity
  intellectualInterests: jsonb("intellectual_interests"), // Topics, subjects, domains
  cognitiveStyle: jsonb("cognitive_style"), // Analytical vs intuitive, detail vs big picture
  learningBehavior: jsonb("learning_behavior"), // How user improves over time
  documentPreferences: jsonb("document_preferences"), // Types and formats preferred

  collaborationStyle: jsonb("collaboration_style"), // Interaction with AI systems
  // Psychological indicators
  conceptualComplexity: text("conceptual_complexity"), // comfort with complex ideas
  attentionToDetail: integer("attention_to_detail"), // 1-10 scale
  creativityIndex: integer("creativity_index"), // 1-10 scale
  systematicThinking: integer("systematic_thinking"), // 1-10 scale
  // Behavioral metrics
  averageSessionLength: integer("average_session_length"), // in minutes
  totalDocumentsProcessed: integer("total_documents_processed"),
  preferredAIProvider: text("preferred_ai_provider"),
  productivityPattern: jsonb("productivity_pattern"), // Time of day, frequency patterns
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCognitiveProfileSchema = createInsertSchema(cognitiveProfiles).pick({
  userId: true,
  writingPatterns: true,
  intellectualInterests: true,
  cognitiveStyle: true,
  learningBehavior: true,
  documentPreferences: true,

  collaborationStyle: true,
  conceptualComplexity: true,
  attentionToDetail: true,
  creativityIndex: true,
  systematicThinking: true,
  averageSessionLength: true,
  totalDocumentsProcessed: true,
  preferredAIProvider: true,
  productivityPattern: true,
});



// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginData = Pick<InsertUser, "username" | "password">;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

export type InsertComparison = z.infer<typeof insertComparisonSchema>;
export type Comparison = typeof comparisons.$inferSelect;

export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;
export type UserActivity = typeof userActivities.$inferSelect;

export type InsertCognitiveProfile = z.infer<typeof insertCognitiveProfileSchema>;
export type CognitiveProfile = typeof cognitiveProfiles.$inferSelect;



export type InsertCaseAssessment = z.infer<typeof insertCaseAssessmentSchema>;
export type CaseAssessment = typeof caseAssessments.$inferSelect;

// GPT Bypass Humanizer tables - using serial IDs to match existing schema
export const rewriteJobs = pgTable("rewrite_jobs", {
  id: serial("id").primaryKey(),
  inputText: text("input_text").notNull(),
  styleText: text("style_text"),
  contentMixText: text("content_mix_text"),
  customInstructions: text("custom_instructions"),
  selectedPresets: jsonb("selected_presets").$type<string[]>(),
  provider: text("provider").notNull(),
  chunks: jsonb("chunks").$type<TextChunk[]>(),
  selectedChunkIds: jsonb("selected_chunk_ids").$type<string[]>(),
  mixingMode: text("mixing_mode").$type<'style' | 'content' | 'both'>(),
  outputText: text("output_text"),
  inputAiScore: integer("input_ai_score"),
  outputAiScore: integer("output_ai_score"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRewriteJobSchema = createInsertSchema(rewriteJobs).omit({
  id: true,
  createdAt: true,
});

export type InsertRewriteJob = z.infer<typeof insertRewriteJobSchema>;
export type RewriteJob = typeof rewriteJobs.$inferSelect;

export interface TextChunk {
  id: string;
  content: string;
  startWord: number;
  endWord: number;
  aiScore?: number;
}

export interface InstructionPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  instruction: string;
}

export interface WritingSample {
  id: string;
  name: string;
  preview: string;
  content: string;
  category: string;
}

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'perplexity';
  model?: string;
}

export interface RewriteRequest {
  inputText: string;
  styleText?: string;
  contentMixText?: string;
  customInstructions?: string;
  selectedPresets?: string[];
  provider: string;
  selectedChunkIds?: string[];
  mixingMode?: 'style' | 'content' | 'both';
}

export interface RewriteResponse {
  rewrittenText: string;
  inputAiScore: number;
  outputAiScore: number;
  jobId: string;
}

// Credit system tables for Stripe payment integration
export const userCredits = pgTable("user_credits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  provider: text("provider").notNull(), // openai, anthropic, perplexity, deepseek
  credits: integer("credits").notNull().default(0), // word credits for this provider
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  provider: text("provider").notNull(),
  amount: integer("amount").notNull(), // dollar amount in cents
  credits: integer("credits").notNull(), // word credits purchased/used
  transactionType: text("transaction_type").notNull(), // purchase, deduction
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("pending"), // pending, completed, failed
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserCreditsSchema = createInsertSchema(userCredits).omit({
  id: true,
  lastUpdated: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

export type InsertUserCredits = z.infer<typeof insertUserCreditsSchema>;
export type UserCredits = typeof userCredits.$inferSelect;

export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
