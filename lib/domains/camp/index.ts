/**
 * Camp 도메인 Public API
 *
 * 캠프 관련 기능을 통합합니다:
 * - 캠프 템플릿 관리
 * - 캠프 초대 관리
 * - 캠프 플랜 그룹
 */

// 캠프 템플릿 re-export
export {
  getCampTemplates,
  getCampTemplateById,
  getCampTemplatesByTenant,
  createCampTemplate,
  updateCampTemplate,
  deleteCampTemplate,
} from "@/lib/data/campTemplates";

/**
 * 향후 마이그레이션 계획:
 *
 * 1. types.ts 추가
 *    - CampTemplate, CampInvitation 타입 통합
 *
 * 2. validation.ts 추가
 *    - 캠프 템플릿 생성/수정 스키마
 *
 * 3. actions.ts 통합
 *    - app/(admin)/actions/campTemplateActions.ts
 *    - app/(admin)/actions/campTemplateBlockSets.ts
 *    - app/(student)/actions/campActions.ts
 */

