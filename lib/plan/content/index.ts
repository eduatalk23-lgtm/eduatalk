/**
 * Content Resolution Module
 *
 * 마스터 콘텐츠 ID 해석을 위한 통합 모듈
 */

export {
  // Types
  type ContentType,
  type MasterContentHolder,
  type ResolvedMasterId,
  // Functions
  getMasterContentId,
  isFromMaster,
  resolveMasterId,
  resolveMasterIdBatch,
  createStudentToMasterMap,
  createMasterToStudentMap,
  extractMasterIds,
  filterWithMaster,
  filterWithoutMaster,
} from "./ContentResolverService";
