/**
 * Chat 도메인 타입 정의
 *
 * 채팅 시스템의 핵심 타입들을 정의합니다.
 * 마이그레이션 후 Supabase CLI로 타입을 재생성하면 Tables<"chat_rooms"> 등으로 변경 가능합니다.
 */

// ============================================
// 기본 열거형 타입
// ============================================

/** 채팅방 유형 */
export type ChatRoomType = "direct" | "group";

/** 사용자 유형 */
export type ChatUserType = "student" | "admin";

/** 채팅방 멤버 역할 */
export type ChatMemberRole = "owner" | "admin" | "member";

/** 메시지 유형 */
export type ChatMessageType = "text" | "system";

/** 메시지 전송 상태 (클라이언트 전용) */
export type MessageStatus = "sending" | "sent" | "error";

/** 신고 사유 */
export type ReportReason =
  | "spam"
  | "harassment"
  | "inappropriate"
  | "hate_speech"
  | "other";

/** 신고 상태 */
export type ReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";

// ============================================
// Presence 타입 (실시간 상태)
// ============================================

/** Presence 사용자 상태 */
export interface PresenceUser {
  userId: string;
  name: string;
  isTyping: boolean;
  lastSeen: string;
}

// ============================================
// 메시지 리액션 타입
// ============================================

/** 지원하는 리액션 이모지 목록 */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🔥", "😮"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** 메시지 리액션 */
export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  user_type: ChatUserType;
  emoji: ReactionEmoji;
  created_at: string;
}

/** 리액션 요약 (UI 표시용) */
export interface ReactionSummary {
  emoji: ReactionEmoji;
  count: number;
  hasReacted: boolean; // 현재 사용자가 리액션했는지
}

/** 리액션 토글 입력 */
export interface ReactionToggleInput {
  messageId: string;
  emoji: ReactionEmoji;
}

// ============================================
// 채팅방 타입
// ============================================

/** 채팅방 기본 타입 */
export interface ChatRoom {
  id: string;
  tenant_id: string;
  type: ChatRoomType;
  name: string | null;
  created_by: string;
  created_by_type: ChatUserType;
  is_active: boolean;
  /** 채팅방 공지 내용 */
  announcement: string | null;
  /** 공지 작성자 ID */
  announcement_by: string | null;
  /** 공지 작성자 유형 */
  announcement_by_type: ChatUserType | null;
  /** 공지 작성 시간 */
  announcement_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 채팅방 생성 입력 타입 */
export interface ChatRoomInsert {
  tenant_id: string;
  type: ChatRoomType;
  name?: string | null;
  created_by: string;
  created_by_type: ChatUserType;
  is_active?: boolean;
}

/** 채팅방 수정 입력 타입 */
export interface ChatRoomUpdate {
  name?: string | null;
  is_active?: boolean;
  announcement?: string | null;
  announcement_by?: string | null;
  announcement_by_type?: ChatUserType | null;
  announcement_at?: string | null;
}

// ============================================
// 채팅방 멤버 타입
// ============================================

/** 채팅방 멤버 기본 타입 */
export interface ChatRoomMember {
  id: string;
  room_id: string;
  user_id: string;
  user_type: ChatUserType;
  role: ChatMemberRole;
  last_read_at: string;
  is_muted: boolean;
  left_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 채팅방 멤버 생성 입력 타입 */
export interface ChatRoomMemberInsert {
  room_id: string;
  user_id: string;
  user_type: ChatUserType;
  role?: ChatMemberRole;
  last_read_at?: string;
  is_muted?: boolean;
}

/** 채팅방 멤버 수정 입력 타입 */
export interface ChatRoomMemberUpdate {
  role?: ChatMemberRole;
  last_read_at?: string;
  is_muted?: boolean;
  left_at?: string | null;
}

// ============================================
// 메시지 타입
// ============================================

/** 메시지 기본 타입 */
export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_type: ChatUserType;
  message_type: ChatMessageType;
  content: string;
  reply_to_id: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  /** 비정규화된 발신자 이름 스냅샷 */
  sender_name: string;
  /** 비정규화된 발신자 프로필 URL 스냅샷 */
  sender_profile_url: string | null;
}

/** 메시지 생성 입력 타입 */
export interface ChatMessageInsert {
  room_id: string;
  sender_id: string;
  sender_type: ChatUserType;
  message_type?: ChatMessageType;
  content: string;
  reply_to_id?: string | null;
  /** 삽입 시 필수: 발신자 이름 스냅샷 */
  sender_name: string;
  /** 삽입 시 선택: 발신자 프로필 URL 스냅샷 */
  sender_profile_url?: string | null;
}

/** 메시지 수정 입력 타입 */
export interface ChatMessageUpdate {
  content?: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

/** 메시지가 수정되었는지 확인하는 헬퍼 함수 */
export function isMessageEdited(message: ChatMessage): boolean {
  return message.created_at !== message.updated_at && !message.is_deleted;
}

// ============================================
// 차단 타입
// ============================================

/** 차단 기본 타입 */
export interface ChatBlock {
  id: string;
  blocker_id: string;
  blocker_type: ChatUserType;
  blocked_id: string;
  blocked_type: ChatUserType;
  created_at: string;
}

/** 차단 생성 입력 타입 */
export interface ChatBlockInsert {
  blocker_id: string;
  blocker_type: ChatUserType;
  blocked_id: string;
  blocked_type: ChatUserType;
}

// ============================================
// 신고 타입
// ============================================

/** 신고 기본 타입 */
export interface ChatReport {
  id: string;
  reporter_id: string;
  reporter_type: ChatUserType;
  reported_message_id: string | null;
  reported_user_id: string | null;
  reported_user_type: ChatUserType | null;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

/** 신고 생성 입력 타입 */
export interface ChatReportInsert {
  reporter_id: string;
  reporter_type: ChatUserType;
  reported_message_id?: string | null;
  reported_user_id?: string | null;
  reported_user_type?: ChatUserType | null;
  reason: ReportReason;
  description?: string | null;
}

/** 신고 수정 입력 타입 (관리자용) */
export interface ChatReportUpdate {
  status?: ReportStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  resolution_notes?: string | null;
}

/** 신고 + 상세 정보 (관리자 UI용) */
export interface ChatReportWithDetails extends ChatReport {
  /** 신고된 메시지 정보 */
  reportedMessage?: ChatMessage | null;
  /** 신고자 정보 */
  reporter?: ChatUser | null;
  /** 피신고자 정보 */
  reportedUser?: ChatUser | null;
}

/** 신고 목록 조회 필터 옵션 */
export interface GetReportsFilter {
  status?: ReportStatus | "all";
  reason?: ReportReason | "all";
}

// ============================================
// 복합 타입 (UI 렌더링용)
// ============================================

/** 사용자 정보 (메시지/멤버 표시용) */
export interface ChatUser {
  id: string;
  type: ChatUserType;
  name: string;
  profileImageUrl?: string | null;
  /** 학생인 경우 학교명 */
  schoolName?: string | null;
  /** 학생인 경우 학년 표시 (예: "고2") */
  gradeDisplay?: string | null;
}

/** 답장 원본 메시지 정보 (UI용) */
export interface ReplyTargetInfo {
  id: string;
  content: string;
  senderName: string;
  isDeleted: boolean;
}

/** 메시지 + 발신자 정보 */
export interface ChatMessageWithSender extends ChatMessage {
  sender: ChatUser;
  /** 메시지 리액션 요약 (옵션) */
  reactions?: ReactionSummary[];
  /** 답장 원본 메시지 정보 (옵션) */
  replyTarget?: ReplyTargetInfo | null;
}

/** 메시지 그룹핑 정보 (UI 렌더링용) */
export interface MessageGroupingInfo {
  /** 발신자 이름 표시 여부 (그룹 첫 메시지만 true) */
  showName: boolean;
  /** 시간 표시 여부 (그룹 마지막 메시지만 true) */
  showTime: boolean;
  /** 그룹의 일부인지 여부 (간격 축소용) */
  isGrouped: boolean;
  /** 날짜 구분선 표시 여부 */
  showDateDivider: boolean;
  /** 날짜 구분선 텍스트 (예: "2024년 1월 15일 월요일") */
  dateDividerText?: string;
}

/** 그룹핑 정보가 포함된 메시지 */
export interface ChatMessageWithGrouping extends ChatMessageWithSender {
  grouping: MessageGroupingInfo;
}

/** 채팅방 + 추가 정보 (목록 표시용) */
export interface ChatRoomWithDetails extends ChatRoom {
  members: ChatRoomMemberWithUser[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

/** 채팅방 멤버 + 사용자 정보 */
export interface ChatRoomMemberWithUser extends ChatRoomMember {
  user: ChatUser;
}

/** 채팅방 목록 아이템 (간략 버전) */
export interface ChatRoomListItem {
  id: string;
  type: ChatRoomType;
  name: string | null;
  /** direct일 경우 상대방 정보, group일 경우 null */
  otherUser: ChatUser | null;
  /** group일 경우 멤버 수 */
  memberCount: number;
  lastMessage: {
    content: string;
    senderName: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

// ============================================
// API 응답/요청 타입
// ============================================

/** 채팅방 생성 요청 */
export interface CreateChatRoomRequest {
  type: ChatRoomType;
  name?: string; // group일 경우
  memberIds: string[]; // 초대할 멤버 user_id 목록
  memberTypes: ChatUserType[]; // 각 멤버의 타입 (memberIds와 같은 순서)
}

/** 메시지 전송 요청 */
export interface SendMessageRequest {
  roomId: string;
  content: string;
  messageType?: ChatMessageType;
  replyToId?: string | null;
}

/** 메시지 목록 조회 옵션 */
export interface GetMessagesOptions {
  roomId: string;
  limit?: number;
  before?: string; // cursor pagination: 이 시간 이전 메시지
}

/** 채팅방 목록 조회 옵션 */
export interface GetRoomsOptions {
  limit?: number;
  offset?: number;
}

// ============================================
// 액션 결과 타입
// ============================================

/** 기본 액션 결과 */
export interface ChatActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  /** 에러 코드 (충돌 감지 등) */
  code?: string;
}

/** 페이지네이션 결과 */
export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
}

// ============================================
// 메시지 검색 타입
// ============================================

/** 메시지 검색 옵션 */
export interface SearchMessagesOptions {
  roomId: string;
  query: string;
  limit?: number;
  offset?: number;
}

/** 메시지 검색 결과 */
export interface SearchMessagesResult {
  messages: ChatMessageWithSender[];
  total: number;
  query: string;
}

// ============================================
// 읽음 표시 타입
// ============================================

/** 메시지 + 읽음 상태 결과 */
export interface MessagesWithReadStatusResult {
  messages: ChatMessageWithSender[];
  /** 메시지 ID별 안 읽은 멤버 수 */
  readCounts: Record<string, number>;
  hasMore: boolean;
}

// ============================================
// 고정 메시지 타입
// ============================================

/** 고정 메시지 기본 타입 */
export interface PinnedMessage {
  id: string;
  room_id: string;
  message_id: string;
  pinned_by: string;
  pinned_by_type: ChatUserType;
  pin_order: number;
  created_at: string;
}

/** 고정 메시지 + 내용 (UI 표시용) */
export interface PinnedMessageWithContent extends PinnedMessage {
  message: {
    content: string;
    senderName: string;
    isDeleted: boolean;
  };
}

/** 고정 메시지 입력 타입 */
export interface PinMessageInput {
  roomId: string;
  messageId: string;
}

/** 고정 메시지 삽입 타입 (Repository용) */
export interface PinnedMessageInsert {
  room_id: string;
  message_id: string;
  pinned_by: string;
  pinned_by_type: ChatUserType;
  pin_order?: number;
}

// ============================================
// 공지 타입
// ============================================

/** 공지 정보 (UI 표시용) */
export interface AnnouncementInfo {
  content: string;
  authorName: string;
  authorType: ChatUserType;
  createdAt: string;
}

/** 공지 설정 입력 타입 */
export interface SetAnnouncementInput {
  roomId: string;
  content: string | null; // null이면 공지 삭제
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 역할 문자열을 ChatUserType으로 변환
 * @param role 사용자 역할 (admin, consultant, student 등)
 * @returns ChatUserType (admin 또는 student)
 */
export function getUserType(role: string | null): ChatUserType {
  if (role === "admin" || role === "consultant") return "admin";
  return "student";
}
