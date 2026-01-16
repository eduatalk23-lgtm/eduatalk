/**
 * Chat 도메인 Public API
 */

// Types
export type {
  // 기본 타입
  ChatRoom,
  ChatRoomMember,
  ChatMessage,
  ChatBlock,
  ChatReport,
  // Insert/Update 타입
  ChatRoomInsert,
  ChatRoomUpdate,
  ChatRoomMemberInsert,
  ChatRoomMemberUpdate,
  ChatMessageInsert,
  ChatMessageUpdate,
  ChatBlockInsert,
  ChatReportInsert,
  ChatReportUpdate,
  // 열거형
  ChatRoomType,
  ChatUserType,
  ChatMemberRole,
  ChatMessageType,
  ReportReason,
  ReportStatus,
  // 복합 타입
  ChatUser,
  ChatMessageWithSender,
  ChatRoomWithDetails,
  ChatRoomMemberWithUser,
  ChatRoomListItem,
  // API 타입
  CreateChatRoomRequest,
  SendMessageRequest,
  GetMessagesOptions,
  GetRoomsOptions,
  ChatActionResult,
  PaginatedResult,
} from "./types";

// Service (비즈니스 로직)
export {
  createOrGetRoom,
  getRoomList,
  getRoomDetail,
  sendMessage,
  getMessages,
  deleteMessage,
  markRoomAsRead,
  inviteMembers,
  leaveRoom,
  blockUser,
  unblockUser,
  reportMessage,
} from "./service";

// Repository (데이터 접근 - 필요 시 직접 사용)
export * as chatRepository from "./repository";
