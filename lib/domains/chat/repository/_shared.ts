/**
 * Chat Repository 공통 유틸리티 및 상수
 */

import { createSupabaseAdminClient, type SupabaseAdminClient } from "@/lib/supabase/admin";

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 커서 유효성 검증 및 안전한 값 반환
 * 페이지네이션 커서로 사용되는 타임스탬프 유효성 확인
 * @returns 유효한 커서 또는 undefined
 */
export function validateCursor(cursor: string | undefined): string | undefined {
  if (!cursor) return undefined;

  // ISO 8601 형식 또는 일반 날짜 형식 허용
  const date = new Date(cursor);
  if (isNaN(date.getTime())) {
    console.warn(`[ChatRepository] Invalid cursor format: ${cursor}`);
    return undefined;
  }

  return cursor;
}

/**
 * Chat 테이블 접근을 위한 Admin 클라이언트
 *
 * 주의: Database 타입에 chat 테이블이 포함되지 않아 타입 단언 사용
 * chat 테이블은 별도의 마이그레이션으로 생성되어 타입 생성 시 누락됨
 *
 * TODO: Supabase 타입 재생성 후 이 함수 제거하고 SupabaseAdminClient 직접 사용
 *
 * @throws Error Admin client 초기화 실패 시
 */
export function getAdminClientForChat(): SupabaseAdminClient {
  const client = createSupabaseAdminClient();
  if (!client) {
    throw new Error("Admin client initialization failed: Service role key not configured");
  }
  return client;
}

/**
 * 프로필 이미지 URL을 안전하게 추출 (students 테이블에 통합됨)
 */
export function extractProfileImageUrl(
  profileImageUrl: string | null | undefined
): string | null {
  return profileImageUrl ?? null;
}

// ============================================
// 컬럼 정의
// ============================================

export const CHAT_ROOM_COLUMNS = `
  id,
  tenant_id,
  type,
  category,
  name,
  topic,
  status,
  created_by,
  created_by_type,
  is_active,
  announcement,
  announcement_by,
  announcement_by_type,
  announcement_at,
  archived_at,
  history_visible,
  created_at,
  updated_at,
  last_message_content,
  last_message_type,
  last_message_sender_name,
  last_message_sender_id,
  last_message_at
` as const;

export const CHAT_MEMBER_COLUMNS = `
  id,
  room_id,
  user_id,
  user_type,
  role,
  last_read_at,
  is_muted,
  left_at,
  deleted_at,
  visible_from,
  created_at,
  updated_at
` as const;

export const CHAT_MESSAGE_COLUMNS = `
  id,
  room_id,
  sender_id,
  sender_type,
  message_type,
  content,
  reply_to_id,
  is_deleted,
  deleted_at,
  created_at,
  updated_at,
  sender_name,
  sender_profile_url,
  metadata
` as const;

export const CHAT_REACTION_COLUMNS = `
  id,
  message_id,
  user_id,
  user_type,
  emoji,
  created_at
` as const;

export const CHAT_ATTACHMENT_COLUMNS = `
  id, message_id, room_id, file_name, file_size, mime_type,
  storage_path, public_url, width, height, thumbnail_url,
  thumbnail_storage_path, attachment_type, created_at, sender_id
` as const;

export const CHAT_LINK_PREVIEW_COLUMNS = `
  id, message_id, url, title, description, image_url, site_name, fetched_at
` as const;

export const PINNED_MESSAGE_COLUMNS = `
  id,
  room_id,
  message_id,
  pinned_by,
  pinned_by_type,
  pin_order,
  created_at
` as const;
