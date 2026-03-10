/**
 * Chat Query Key Factory
 *
 * 모든 채팅 관련 React Query 키를 중앙에서 관리합니다.
 * 직접 문자열 배열을 쓰지 않고 이 팩토리를 통해 키를 생성하여
 * 오타, 불일치 버그를 구조적으로 방지합니다.
 *
 * @example
 * // 쿼리 정의
 * queryKey: chatKeys.rooms()
 *
 * // 캐시 무효화
 * queryClient.invalidateQueries({ queryKey: chatKeys.rooms() })
 *
 * // 캐시 직접 접근
 * queryClient.getQueryData(chatKeys.messages(roomId))
 */
export const chatKeys = {
  /** 모든 chat- 쿼리의 공통 prefix (predicate 필터링용) */
  prefix: "chat" as const,

  // ============================================
  // 채팅방 목록/상세
  // ============================================

  /** 채팅방 목록 */
  rooms: () => ["chat-rooms"] as const,

  /** 채팅방 상세 정보 */
  room: (roomId: string) => ["chat-room", roomId] as const,

  /** 채팅방 멤버 목록 */
  roomMembers: (roomId: string) => ["chat-room-members", roomId] as const,

  // ============================================
  // 메시지
  // ============================================

  /** 채팅 메시지 목록 (infinite query) */
  messages: (roomId: string) => ["chat-messages", roomId] as const,

  /** 메시지 검색 */
  search: (roomId: string, query: string) => ["chat-search", roomId, query] as const,

  // ============================================
  // 고정/공지
  // ============================================

  /** 고정 메시지 목록 */
  pinned: (roomId: string) => ["chat-pinned", roomId] as const,

  /** 공지 */
  announcement: (roomId: string) => ["chat-announcement", roomId] as const,

  // ============================================
  // 권한/설정
  // ============================================

  /** 고정 권한 */
  canPin: (roomId: string) => ["chat-can-pin", roomId] as const,

  /** 공지 설정 권한 */
  canSetAnnouncement: (roomId: string) => ["chat-can-set-announcement", roomId] as const,

  /** 알림 설정 (소리/진동/읽음확인) */
  notificationPrefs: () => ["chat-notification-prefs"] as const,

  // ============================================
  // 채팅방 생성용 (멤버 후보 조회)
  // ============================================

  /** 초대 가능한 학생 목록 */
  availableStudents: () => ["chat-available-students"] as const,

  /** 초대 가능한 학생 목록 (상세) */
  availableStudentsWithDetails: () => ["chat-available-students-with-details"] as const,

  /** 초대 가능한 팀 멤버 목록 */
  availableTeamMembers: () => ["chat-available-team-members"] as const,

  /** 초대 가능한 관리자 목록 */
  availableAdmins: () => ["chat-available-admins"] as const,

  // ============================================
  // 멤버 탭 (연락처)
  // ============================================

  /** 테넌트 멤버 목록 (멤버 탭용, 항상 전체 조회 후 클라이언트 필터링) */
  tenantMembers: () => ["chat-tenant-members"] as const,
} as const;
