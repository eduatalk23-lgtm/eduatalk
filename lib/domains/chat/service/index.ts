/**
 * Chat Service barrel export
 *
 * 모든 하위 모듈을 re-export하여 기존 `import { ... } from "./service"` 호환
 */

// 채팅방 서비스
export {
  createOrGetRoom,
  getRoomList,
  getRoomDetail,
} from "./rooms";

// 메시지 서비스
export {
  sendMessage,
  getMessages,
  deleteMessage,
  markRoomAsRead,
  editMessage,
  searchMessages,
  getMessagesWithReadStatus,
} from "./messages";

// 멤버 서비스
export {
  inviteMembers,
  leaveRoom,
  archiveRoom,
  unarchiveRoom,
  deleteMemberRoom,
} from "./members";

// 차단/신고 서비스
export {
  blockUser,
  unblockUser,
  reportMessage,
} from "./safety";

// 리액션 서비스
export {
  toggleReaction,
} from "./reactions";

// 고정 메시지 서비스
export {
  pinMessage,
  unpinMessage,
  getPinnedMessages,
  checkMessagePinned,
  canUserPinMessages,
} from "./pins";

// 공지 서비스
export {
  setAnnouncement,
  getAnnouncement,
  canUserSetAnnouncement,
} from "./announcements";
