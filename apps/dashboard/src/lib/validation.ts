import { z } from 'zod';

// Common validation schemas
export const emailSchema = z.string().email('Invalid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const urlSchema = z.string().url('Invalid URL');

export const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

export const statusSchema = z.enum(['open', 'fixed', 'ignored', 'false_positive']);

// Repository schemas
export const repositoryConfigSchema = z.object({
  scanOnPush: z.boolean().default(false),
  scanOnPr: z.boolean().default(true),
  defaultBranch: z.string().min(1, 'Default branch is required'),
  excludePaths: z.array(z.string()).default([]),
  includePaths: z.array(z.string()).default([]),
  scanners: z.array(z.string()).default(['semgrep']),
});

// Connection schemas
export const patConnectionSchema = z.object({
  provider: z.enum(['github', 'gitlab', 'bitbucket']),
  token: z.string().min(1, 'Personal access token is required'),
});

// Finding schemas
export const findingUpdateSchema = z.object({
  status: statusSchema.optional(),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
  assignee: z.string().optional(),
});

// Scan configuration schemas
export const scanConfigSchema = z.object({
  repositoryId: z.string().uuid('Invalid repository ID'),
  branch: z.string().min(1, 'Branch is required'),
  scanners: z.array(z.string()).min(1, 'At least one scanner is required'),
});

// Threat model schemas
export const threatModelSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be less than 200 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  methodology: z.enum(['stride', 'pasta', 'linddun', 'custom']).default('stride'),
  components: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['process', 'datastore', 'external', 'boundary']),
    description: z.string().optional(),
  })).optional(),
  dataFlows: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
  })).optional(),
});

// SBOM schemas
export const sbomUploadSchema = z.object({
  format: z.enum(['cyclonedx', 'spdx']),
  repositoryId: z.string().uuid('Invalid repository ID'),
  version: z.string().optional(),
});

// Notification settings schemas
export const notificationSettingsSchema = z.object({
  email: z.boolean().default(true),
  slack: z.boolean().default(false),
  slackWebhookUrl: z.string().url('Invalid Slack webhook URL').optional().or(z.literal('')),
  discord: z.boolean().default(false),
  discordWebhookUrl: z.string().url('Invalid Discord webhook URL').optional().or(z.literal('')),
  severityThreshold: severitySchema.default('medium'),
  digestFrequency: z.enum(['immediate', 'daily', 'weekly']).default('immediate'),
});

// User profile schemas
export const userProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  email: emailSchema,
  timezone: z.string().optional(),
  avatar: z.string().url('Invalid avatar URL').optional().or(z.literal('')),
});

// Team schemas
export const inviteTeamMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(['admin', 'member', 'viewer']),
});

// Type exports for use in components
export type RepositoryConfig = z.infer<typeof repositoryConfigSchema>;
export type PatConnection = z.infer<typeof patConnectionSchema>;
export type FindingUpdate = z.infer<typeof findingUpdateSchema>;
export type ScanConfig = z.infer<typeof scanConfigSchema>;
export type ThreatModel = z.infer<typeof threatModelSchema>;
export type SbomUpload = z.infer<typeof sbomUploadSchema>;
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type InviteTeamMember = z.infer<typeof inviteTeamMemberSchema>;
