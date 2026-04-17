/**
 * Phase T-4 핸드오프 소스 화이트리스트
 *
 * 기존 GUI 페이지에서 /ai-chat 으로 진입할 때 허용되는 source 키 집합.
 * 서버에서 from 값을 이 테이블에서 찾지 못하면 무시(일반 진입).
 *
 * 추가 시 체크:
 * - allowedRoles: 어느 역할이 이 페이지에서 진입 가능한가
 * - requiresStudentId: 학생 맥락이 필수인가
 * - contextResolver: resolvers/ 에 대응 구현 필요
 * - seeds: 4개 프리셋 추천 질문 (선공 메시지 내부 chips로 사용)
 * - openerTemplate: 템플릿 선공 메시지 본문 (slot 치환 {name}, {grade}, {semester}, {count})
 */

export type HandoffAllowedRole =
  | "student"
  | "admin"
  | "consultant"
  | "parent"
  | "superadmin";

export type HandoffSeed = {
  category: string;
  text: string;
};

export type HandoffSource = {
  /** 내부 키 */
  key: string;
  /** UI 라벨 (배너 표시용) */
  label: string;
  /** 출발 페이지 경로 (원본 보기 링크) */
  originPath: string;
  /** 학생 맥락 필수 여부 */
  requiresStudentId: boolean;
  /** 허용 역할 */
  allowedRoles: readonly HandoffAllowedRole[];
  /** resolvers/ 폴더의 리졸버 키 */
  contextResolver: "scores" | "admin-record";
  /** 선공 메시지 내부 chips */
  seeds: readonly HandoffSeed[];
  /**
   * 템플릿 선공 메시지 본문.
   * slot: {name} {grade} {semester} {count}
   * 값이 비어있으면 괄호 포함 자연스러운 문장으로 치환되도록 opener 가 정리.
   */
  openerTemplate: string;
};

const SCORES_SEEDS: readonly HandoffSeed[] = [
  { category: "분석", text: "이 성적의 강점과 약점은?" },
  { category: "전략", text: "어느 과목에 집중해야 할까?" },
  { category: "비교", text: "지난 학기와 비교해줘" },
  { category: "진학", text: "이 성적으로 갈 수 있는 계열은?" },
];

const ADMIN_RECORD_SEEDS: readonly HandoffSeed[] = [
  { category: "진단", text: "이 학생의 생기부 강점과 약점을 짚어줘" },
  { category: "개선", text: "보완이 시급한 영역은?" },
  { category: "전략", text: "2학년 2학기 집중 포인트 제안해줘" },
  { category: "탐구", text: "이 학생에게 어울리는 탐구 주제 추천" },
];

export const HANDOFF_SOURCES: Record<string, HandoffSource> = {
  scores: {
    key: "scores",
    label: "성적 화면",
    originPath: "/scores",
    requiresStudentId: false,
    allowedRoles: ["student"],
    contextResolver: "scores",
    seeds: SCORES_SEEDS,
    openerTemplate:
      "{name}{grade}{semester} 성적{count}을 보고 계셨네요. 어느 관점으로 살펴볼까요?",
  },
  "admin-scores": {
    key: "admin-scores",
    label: "관리자 성적 화면",
    originPath: "/admin/students",
    requiresStudentId: true,
    allowedRoles: ["admin", "consultant"],
    contextResolver: "scores",
    seeds: SCORES_SEEDS,
    openerTemplate:
      "{name}{grade}{semester} 성적{count}을 검토 중이시네요. 어떤 분석이 필요하세요?",
  },
  "admin-record": {
    key: "admin-record",
    label: "생기부 관리 화면",
    originPath: "/admin/students",
    requiresStudentId: true,
    allowedRoles: ["admin", "consultant"],
    contextResolver: "admin-record",
    seeds: ADMIN_RECORD_SEEDS,
    openerTemplate:
      "{name}{grade}생기부를 검토하고 계시네요. 어떤 점이 궁금하세요?",
  },
};

export function getHandoffSource(key: string | undefined): HandoffSource | null {
  if (!key) return null;
  return HANDOFF_SOURCES[key] ?? null;
}
