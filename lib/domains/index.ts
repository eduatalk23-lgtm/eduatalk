/**
 * 도메인 기반 아키텍처 인덱스
 *
 * 각 도메인은 다음 구조를 따릅니다:
 * - actions.ts: Server Actions (폼 제출, mutation)
 * - queries.ts: 데이터 조회 함수 (repository 역할)
 * - types.ts: 타입 정의
 * - validation.ts: Zod 스키마
 * - utils.ts: 도메인 특화 유틸리티 (선택)
 *
 * 도메인 목록:
 * - auth: 인증/세션 관리
 * - school: 학교 관리
 * - score: 성적 관리
 * - plan: 학습 계획 관리
 * - content: 콘텐츠 관리
 * - goal: 목표 관리
 * - block: 블록/시간표 관리
 * - student: 학생 정보 관리
 * - career: 진로/진학 관리
 * - camp: 캠프 관리
 * - tenant: 테넌트 관리
 * - subject: 과목 관리
 */

// Re-export domains
// 완전 구현된 도메인
export * from "./school";
export * from "./score";

// 기본 구조 (re-export 방식)
export * from "./plan";
export * from "./content";
export * from "./goal";
export * from "./auth";
export * from "./student";
export * from "./block";
export * from "./camp";
export * from "./tenant";
export * from "./subject";

