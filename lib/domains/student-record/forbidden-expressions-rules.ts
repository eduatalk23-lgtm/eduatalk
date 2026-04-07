// ============================================
// NEIS 금칙어 규칙 데이터
// 교육부 학교생활기록부 기재요령 기반
// ============================================

import type { ForbiddenExpressionRule } from "./forbidden-expressions";

/**
 * NEIS 금칙어 기본 규칙셋
 *
 * severity:
 * - "error": 절대 금지 (NEIS 시스템에서 기재 불가 또는 감점 확정)
 * - "warning": 주의 필요 (맥락에 따라 허용될 수 있으나 위험)
 */
export const NEIS_FORBIDDEN_RULES: ForbiddenExpressionRule[] = [
  // ─── 수상 내역 직접 기재 ─────────────────────
  {
    id: "award_001",
    category: "award_mention",
    severity: "error",
    pattern: /(?:금상|은상|동상|대상|장려상|입상|최우수상|우수상|특별상|공로상)/g,
    description: "수상 내역(상 명칭) 직접 기재 금지",
  },
  {
    id: "award_002",
    category: "award_mention",
    severity: "error",
    pattern: /(?:(?:교내|교외|전국|지역|시|도|전교)\s*(?:대회|경시대회|경진대회|올림피아드|공모전)(?:에서)?\s*(?:수상|입상|선발|1등|2등|3등))/g,
    description: "대회 수상 사실 기재 금지",
  },
  {
    id: "award_003",
    category: "award_mention",
    severity: "warning",
    pattern: /(?:수상\s*(?:경력|실적|내역|이력))/g,
    description: "수상 경력 언급 주의",
  },

  // ─── 대학명 직접 언급 ──────────────────────
  {
    id: "univ_001",
    category: "university_name",
    severity: "error",
    pattern: /(?:서울대|연세대|고려대|성균관대|한양대|중앙대|경희대|서강대|이화여대|숙명여대|한국외대|건국대|동국대|홍익대|국민대|숭실대|세종대|광운대|단국대|인하대|아주대|명지대|상명대|한국과학기술원|포항공과대학교|KAIST|POSTECH|카이스트|포항공대|울산과학기술원|UNIST|지스트|GIST|DGIST)\s*(?:학교|대학교|대학원)?/gi,
    description: "대학명 직접 기재 금지",
  },
  {
    id: "univ_002",
    category: "university_name",
    severity: "warning",
    pattern: /(?:(?:○○|△△|□□)\s*대학)/g,
    description: "대학명 우회 표현 주의 (○○대학 등)",
  },

  // ─── 사교육 기관명 ─────────────────────────
  {
    id: "academy_001",
    category: "private_academy",
    severity: "error",
    pattern: /(?:학원|과외|인강|사교육|메가스터디|이투스|대성마이맥|스카이에듀|에듀윌|해커스|YBM|시대인재|종로학원|청솔학원|이강학원)/gi,
    description: "사교육 기관명 기재 금지",
  },

  // ─── 자격증/인증시험 점수 ─────────────────────
  {
    id: "cert_001",
    category: "certification_score",
    severity: "error",
    pattern: /(?:TOEIC|TOEFL|IELTS|TEPS|토익|토플|텝스|아이엘츠)\s*\d{2,4}\s*점?/gi,
    description: "어학시험 점수 기재 금지",
  },
  {
    id: "cert_002",
    category: "certification_score",
    severity: "error",
    pattern: /(?:한국사능력검정|한국사)\s*(?:시험)?\s*\d\s*급/gi,
    description: "한국사능력검정 등급 기재 금지",
  },
  {
    id: "cert_003",
    category: "certification_score",
    severity: "error",
    pattern: /(?:(?:ITQ|MOS|컴퓨터활용능력|정보처리|워드프로세서)\s*\d\s*급)/gi,
    description: "자격증 등급 기재 금지",
  },

  // ─── 논문 제목 직접 기재 ──────────────────────
  {
    id: "paper_001",
    category: "paper_citation",
    severity: "warning",
    pattern: /(?:et\s+al\.|pp\.\s*\d|vol\.\s*\d|doi:\s*10\.\d)/gi,
    description: "학술 논문 인용 형식 주의",
  },

  // ─── 학교 밖 활동 상세 ──────────────────────
  {
    id: "outside_001",
    category: "outside_school_activity",
    severity: "warning",
    pattern: /(?:교외\s*(?:활동|봉사|대회|프로그램)|외부\s*(?:활동|기관|프로그램)에\s*(?:참여|참가))/g,
    description: "학교 밖 활동 상세 기재 주의",
  },

  // ─── 외부 기관/플랫폼 명칭 ─────────────────────
  {
    id: "extorg_001",
    category: "external_org",
    severity: "warning",
    pattern: /(?:한국과학창의재단|한국교육과정평가원|EBS|KBS|MBC|SBS|유튜브|YouTube|인스타그램|Instagram|TikTok|틱톡|네이버|카카오|구글|Google)/gi,
    description: "외부 기관/플랫폼 명칭 기재 주의",
  },

  // ─── 학교폭력 관련 ──────────────────────────
  {
    id: "violence_001",
    category: "school_violence",
    severity: "error",
    pattern: /(?:학교\s*폭력|학폭|가해\s*학생|피해\s*학생|(?:전학|퇴학)\s*조치|(?:출석\s*)?정지\s*처분)/g,
    description: "학교폭력 관련 기재 금지 (해당 항목 외)",
  },
];

/** 연도별 활성 규칙 필터 */
export function getActiveRules(curriculumYear: number): ForbiddenExpressionRule[] {
  return NEIS_FORBIDDEN_RULES.filter((rule) => {
    if (rule.fromYear != null && curriculumYear < rule.fromYear) return false;
    if (rule.untilYear != null && curriculumYear > rule.untilYear) return false;
    return true;
  });
}
