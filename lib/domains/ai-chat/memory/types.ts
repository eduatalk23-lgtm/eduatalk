/**
 * Phase D-4 Sprint 1: 대화 장기 기억 타입.
 *
 * DB 스키마 `ai_conversation_memories` 와 정합.
 */

export const MEMORY_KINDS = ["turn", "summary", "explicit"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/** 단일 기억 row (DB 행의 runtime 표현). */
export interface ConversationMemoryRow {
  id: string;
  ownerUserId: string;
  tenantId: string | null;
  subjectStudentId: string | null;
  conversationId: string | null;
  sourceMessageId: string | null;
  content: string;
  kind: MemoryKind;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `search_conversation_memories` RPC 결과 row. */
export interface MemorySearchHit {
  id: string;
  content: string;
  kind: MemoryKind;
  conversationId: string | null;
  createdAt: string;
  /** cosine similarity (1 - distance). 높을수록 유사. */
  score: number;
}

export interface InsertMemoryArgs {
  ownerUserId: string;
  tenantId: string | null;
  subjectStudentId: string | null;
  conversationId: string | null;
  sourceMessageId: string | null;
  content: string;
  embedding: number[];
  kind?: MemoryKind;
  pinned?: boolean;
}

export interface SearchMemoryArgs {
  queryEmbedding: number[];
  ownerUserId: string;
  subjectStudentId?: string | null;
  matchCount?: number;
  similarityThreshold?: number;
}
