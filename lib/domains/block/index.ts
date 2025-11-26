/**
 * Block 도메인 Public API
 *
 * 시간 블록/시간표 관련 기능을 통합합니다:
 * - 블록 세트 관리
 * - 시간 블록 CRUD
 * - 블록 통계
 */

// 블록 세트 re-export
export {
  getBlockSets,
  getBlockSetById,
  getBlockSetsByTenant,
  createBlockSet,
  updateBlockSet,
  deleteBlockSet,
  duplicateBlockSet,
} from "@/lib/data/blockSets";

// 블록 유틸리티 re-export
export {
  calculateBlockStatistics,
  getBlockTotalTime,
} from "@/lib/blocks/statistics";

export {
  parseTimeRange,
  formatTimeRange,
  isValidTimeRange,
} from "@/lib/blocks/timeRange";

export {
  validateBlockSet,
  validateBlock,
} from "@/lib/blocks/validation";

/**
 * 향후 마이그레이션 계획:
 *
 * 1. types.ts 추가
 *    - BlockSet, Block, TimeRange 타입 통합
 *
 * 2. validation.ts 추가
 *    - 블록 세트 생성/수정 스키마
 *
 * 3. actions.ts 통합
 *    - app/actions/blocks.ts
 *    - app/actions/blockSets.ts
 */

