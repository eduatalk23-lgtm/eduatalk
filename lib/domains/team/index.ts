/**
 * 팀 관리 도메인
 *
 * 테넌트 관리자가 컨설턴트/관리자를 관리하는 기능 제공
 * 초대는 통합 초대 시스템(lib/domains/invitation)으로 이관됨
 */

// Types
export type {
  TeamMember,
  TeamOverview,
  InvitationRole,
} from "./types";

// Actions
export {
  removeTeamMember,
  updateMemberRole,
} from "./actions";

// Queries
export {
  getTeamMembers,
  getTeamOverview,
} from "./queries";
