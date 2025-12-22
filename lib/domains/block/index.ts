/**
 * Block 도메인 Public API
 *
 * 시간 블록/시간표 관련 기능을 통합합니다:
 * - 블록 세트 관리
 * - 시간 블록 CRUD
 * - 블록 통계
 */

// ============================================
// Types
// ============================================

export type {
  Block,
  BlockSet,
  CreateBlockInput,
  UpdateBlockInput,
  CreateBlockSetInput,
  UpdateBlockSetInput,
  BlockFormData,
  BlockActionResult,
  BlockServiceContext,
} from "./types";

// BlockSetWithBlocks는 lib/data/blockSets.ts의 타입을 사용
export type { BlockSetWithBlocks } from "./repository";

export { blockSchema } from "./types";

// ============================================
// Repository (읽기 전용 접근)
// ============================================

export {
  findBlockById,
  findBlocksBySetId,
  findBlockSetById,
  findBlockSetsByStudentId,
  findActiveBlockSetId,
  getBlockSetCount,
} from "./repository";

// ============================================
// Service (비즈니스 로직)
// ============================================

export {
  addBlock as addBlockService,
  updateBlock as updateBlockService,
  deleteBlock as deleteBlockService,
  duplicateBlock as duplicateBlockService,
  addBlocksToMultipleDays as addBlocksToMultipleDaysService,
} from "./service";

// ============================================
// Actions (Server Actions)
// ============================================

export {
  // Block Actions
  addBlock,
  updateBlock,
  deleteBlock,
  duplicateBlock,
  addBlocksToMultipleDays,
  // Direct API (JSON 기반)
  addBlockDirect,
  updateBlockDirect,
  deleteBlockDirect,
  // Block Set Actions
  createBlockSet,
  updateBlockSet,
  deleteBlockSet,
  setActiveBlockSet,
  duplicateBlockSet,
  getBlockSets,
} from "./actions";

// ============================================
// Legacy re-exports (호환성)
// ============================================

export { fetchBlockSetsWithBlocks } from "@/lib/data/blockSets";

// ============================================
// Utilities
// ============================================

export {
  calculateBlockStatistics,
  calculateDayDistribution,
  calculateTimeDistribution,
  calculateHourlyDistribution,
  isValidBlock,
  findInvalidBlocks,
} from "@/lib/blocks/statistics";

export {
  calculateAutoTimeRange,
  createManualTimeRange,
} from "@/lib/blocks/timeRange";

export {
  checkBlockOverlap,
  calculateBlockDuration,
} from "@/lib/blocks/validation";
