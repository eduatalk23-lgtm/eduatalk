/**
 * Google Calendar 동기화 관련 타입 정의
 */

export interface GoogleOAuthToken {
  id: string;
  admin_user_id: string;
  tenant_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  scope: string;
  calendar_id: string;
  google_email: string | null;
  sync_enabled: boolean;
  connected_at: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SyncAction = "create" | "update" | "cancel";
export type SyncTarget = "personal" | "shared" | "both";
export type SyncQueueStatus = "pending" | "processing" | "completed" | "failed";

export interface SyncQueueItem {
  id: string;
  tenant_id: string;
  schedule_id: string;
  action: SyncAction;
  target: SyncTarget;
  admin_user_id: string | null;
  status: SyncQueueStatus;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

/** Google Calendar 이벤트 생성/수정용 매핑 데이터 */
export interface GoogleCalendarEventData {
  summary: string;
  description: string;
  location: string | null;
  startDateTime: string; // ISO 8601
  endDateTime: string; // ISO 8601
  colorId: string;
  extendedProperties: {
    private: {
      timelevelup_schedule_id: string;
      timelevelup_tenant_id: string;
    };
  };
}

/** OAuth state 파라미터 (CSRF 방지) */
export interface OAuthStatePayload {
  adminUserId: string;
  tenantId: string;
  target: "personal" | "shared";
  timestamp: number;
}

/** 세션 타입별 Google Calendar 색상 ID */
export const SESSION_TYPE_GOOGLE_COLOR: Record<string, string> = {
  정기상담: "1", // 라벤더 (파랑)
  학부모상담: "3", // 포도 (보라)
  진로상담: "2", // 세이지 (초록)
  성적상담: "5", // 바나나 (노랑)
  긴급상담: "11", // 토마토 (빨강)
  기타: "8", // 흑연 (회색)
};

/** 최대 재시도 횟수 */
export const MAX_RETRY_COUNT = 3;

/** OAuth scope */
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];
