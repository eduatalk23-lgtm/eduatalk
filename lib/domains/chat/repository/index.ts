/**
 * Chat Repository barrel export
 *
 * 모든 하위 모듈을 re-export하여 기존 `import * as repository from "./repository"` 호환
 */

// 채팅방
export {
  findRoomById,
  findRoomsByUser,
  findDirectRoom,
  findDirectRoomIncludingLeft,
  insertRoom,
  updateRoom,
} from "./rooms";

// 멤버
export {
  findMembersByRoom,
  findMembersByRoomIds,
  findMember,
  findMemberIncludingLeft,
  findOtherMemberInDirectRoom,
  insertMember,
  updateMember,
  markAsRead,
  findActiveMembersWithReadStatus,
  findExistingMembersByRoomBatch,
  insertMembersBatch,
} from "./members";

// 메시지
export {
  findMessagesByRoom,
  findLastMessagesByRoomIds,
  countUnreadByRoomIds,
  insertMessage,
  deleteMessage,
  countUnreadMessages,
  findMessageById,
  updateMessageContent,
  searchMessagesByRoom,
  findMessagesWithReadCounts,
  findReplyTargetsByIds,
  findMessagesSince,
} from "./messages";

// 발신자 정보
export {
  findSendersByIds,
  findSenderById,
  getSenderInfoForInsert,
} from "./senders";

// 차단/신고
export {
  findBlocksByUser,
  isBlocked,
  insertBlock,
  deleteBlock,
  insertReport,
  findPendingReports,
  updateReport,
  findAllReports,
  findReportById,
} from "./safety";

// 리액션
export {
  insertReaction,
  deleteReaction,
  hasReaction,
  findReactionsByMessageIds,
} from "./reactions";

// 고정 메시지 + 공지
export {
  findPinnedMessagesByRoom,
  insertPinnedMessage,
  deletePinnedMessage,
  isPinnedMessage,
  countPinnedMessages,
  setRoomAnnouncement,
} from "./pins";

// 첨부파일
export {
  insertAttachment,
  findAttachmentById,
  findAttachmentsByIds,
  findAttachmentsByMessageIds,
  linkAttachmentsToMessage,
  deleteAttachment,
  findOrphanedAttachments,
  findExpiredAttachments,
  deleteAttachmentsByIds,
  getUserStorageUsage,
  findAttachmentsByRoom,
  searchAttachmentsByRoom,
  hideAttachmentsForUser,
  findHiddenAttachmentIds,
} from "./attachments";

// 링크 프리뷰
export {
  insertLinkPreview,
  findLinkPreviewsByMessageIds,
} from "./linkPreviews";
