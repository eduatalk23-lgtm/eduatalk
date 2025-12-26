/**
 * Camp 도메인 Public API
 *
 * Note: attendance와 learningStats는 server-only 코드를 포함하므로
 * 직접 import 필요: import { ... } from "@/lib/domains/camp/attendance"
 */

// Types
export * from "./types";

// Actions (Server Actions - can be used in client components)
export * from "./actions";

// Errors (Client & Server - error handling utilities)
export * from "./errors";

// Permissions (Server-only - permission guards)
// Note: 권한 검증 유틸리티는 서버에서만 사용
// import { requireCampAdminAuth, ... } from "@/lib/domains/camp/permissions"
