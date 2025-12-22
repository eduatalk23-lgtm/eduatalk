/**
 * 마스터 콘텐츠 관련 유틸리티 함수
 *
 * @deprecated lib/plan/content 모듈을 직접 사용하세요.
 * 이 파일은 하위 호환성을 위해 유지됩니다.
 */

// 새로운 통합 서비스에서 re-export
export {
  isFromMaster,
  getMasterContentId,
  resolveMasterId,
  resolveMasterIdBatch,
  createStudentToMasterMap,
  createMasterToStudentMap,
  extractMasterIds,
  filterWithMaster,
  filterWithoutMaster,
  type ContentType,
  type MasterContentHolder,
  type ResolvedMasterId,
} from "@/lib/plan/content";

