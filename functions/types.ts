/// <reference path="./types.d.ts" />

/**
 * Shared type definitions for the functions layer
 */

// ============================================
// Environment & Context Types
// ============================================

export interface Env {
  DB: D1Database;
  POLICY_AUD?: string;
  TEAM_DOMAIN?: string;
}

export interface AuthContext extends Record<string, unknown> {
  email: string;
}

export interface ServiceContext {
  userId: string;
  userEmail: string;
  DB: D1Database;
}

// ============================================
// Entity Types
// ============================================

/**
 * Supported entity types in the sync system
 * - CAT: Category
 * - TXN: Transaction
 * - SHR: User Share
 */
export type EntityType = "CAT" | "TXN" | "SHR";

/**
 * Supported action types for sync operations
 */
export type ActionType = "PUT" | "DELETE" | "POST";

/**
 * Entry type for categories
 */
export type EntryType = "EXPENSE" | "INCOME";

// ============================================
// User Entities
// ============================================

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface UserShare {
  id: string;
  owner_id: string;
  owner_email: string;
  viewer_id: string;
  viewer_email: string;
  status: string;
  version: number;
  is_deleted: number;
}

// ============================================
// Data Entities
// ============================================

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: string;
  version: number;
  is_deleted: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string;
  type: string;
  amount: number;
  note: string | null;
  date: number;
  version: number;
  is_deleted: number;
}

// ============================================
// Sync Types
// ============================================

export interface SyncEvent {
  id: number;
  user_id: string;
  mutation_id: string;
  entity_type: string;
  entity_id: string;
  payload: string | null;
  created_at: string;
}

export interface SyncRequest {
  last_cursor: number;
  push_commands?: PushCommand[];
  user?: { id: string; email: string } | null;
}

export interface PushCommand {
  mutation_id: string;
  entity_type: EntityType;
  entity_id: string;
  action: ActionType;
  base_version: number;
  payload?: unknown;
}

export interface PushResult {
  mutation_id: string;
  status: 'OK' | 'ERROR' | 'SKIPPED';
  version?: number | null;
  error_code?: string | null;
  error_message?: string | null;
}

export interface PullEvent {
  id: number;
  mutation_id: string;
  entity_type: EntityType;
  entity_id: string;
  action: ActionType;
  version: number;
  payload?: string | null;
}

// ============================================
// Utility Types
// ============================================

export type EntityHandler = (event: PushCommand, context: ServiceContext) => Promise<PushResult>;
