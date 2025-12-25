/**
 * Plan 도메인 Public API
 *
 * Note: repository와 service는 server-only 코드를 포함하므로
 * 직접 import 필요: import { ... } from "@/lib/domains/plan/service"
 */

// ============================================
// Types
// ============================================

export * from "./types";

// ============================================
// Actions (Server Actions - can be used in client components)
// ============================================

export * from "./actions";

// ============================================
// Transactions (Atomic operations via PostgreSQL RPC)
// ============================================

export {
  createPlanGroupAtomic,
  generatePlansAtomic,
  type AtomicPlanGroupInput,
  type AtomicPlanContentInput,
  type AtomicExclusionInput,
  type AtomicAcademyScheduleInput,
  type AtomicPlanGroupResult,
  type AtomicPlanPayload,
  type AtomicPlansResult,
} from "./transactions";
