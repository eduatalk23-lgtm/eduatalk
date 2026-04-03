/**
 * 평가 기준 통합 상수 — 전 프롬프트 파일의 Single Source of Truth
 *
 * 이 파일을 수정하면 setekGuide, changcheGuide, haengteukGuide,
 * competencyHighlight, generateSetekDraft, generateHaengteukDraft,
 * generateChangcheDraft, generateDiagnosis, warnings/engine 모두에 반영됩니다.
 *
 * 향후 DB 기반 evaluation_criteria 테이블 전환 시 이 파일이 fallback 역할.
 */

// ============================================================
// 1. 좋은 세특 8단계 흐름
// ============================================================

export interface SetekFlowStage {
  /** 단계 번호 (1~8) */
  order: number;
  /** 간결 라벨 (프롬프트 내 arrow 표기용) */
  label: string;
  /** 상세 설명 (평가 기준으로 사용) */
  description: string;
}

export const SETEK_FLOW_STAGES: readonly SetekFlowStage[] = [
  { order: 1, label: "지적호기심/의문", description: "수업에서 배운 개념에서 출발한 구체적 의문" },
  { order: 2, label: "주제 선정(진로 연결)", description: "교과에서 자연스럽게 확장된, 학생 수준에 적합한 주제" },
  { order: 3, label: "탐구 내용/이론", description: "교과 이론을 정확하게 적용한 단계적이고 논리적인 탐구" },
  { order: 4, label: "참고문헌/독서", description: "출처가 탐구와 실제로 연결되는 독서·자료 활용" },
  { order: 5, label: "결론(해결방안/제언/창의적 고안)", description: "한계 인식 + 해결방안/정책 제언/창의적 고안까지 이어지는 복합 결론" },
  { order: 6, label: "교사 관찰(구체적 근거)", description: "구체적 관찰 근거 기반 서술 (상투적 표현 ≠ 관찰)" },
  { order: 7, label: "성장 서사", description: "성취과정/발전가능성/잠재력이 드러남" },
  { order: 8, label: "오류→재탐구 순환", description: "한계를 인식하고 원인 분석 후 재적용하여 깨달음 도출 (탐구력 정성적 가산 — 점수 기반이 아닌 입학사정관의 눈에 띄는 +@ 효과)" },
] as const;

/** 8단계 간결 arrow 표기 (프롬프트 삽입용) */
export function formatSetekFlowArrow(): string {
  return SETEK_FLOW_STAGES.map((s) => `${s.order}. ${s.label}`).join(" → ");
}

/** 8단계 상세 표기 (generateSetekDraft용) */
export function formatSetekFlowDetailed(): string {
  return SETEK_FLOW_STAGES.map(
    (s) => `${s.order}. **${s.label}**: ${s.description}`,
  ).join("\n");
}

/** 8단계 평가 기준 표기 (competencyHighlight용) */
export function formatSetekFlowEvaluation(): string {
  return SETEK_FLOW_STAGES.map(
    (s) => `${s.order}. **${s.label}**: ${s.description}`,
  ).join("\n");
}

/**
 * 8단계 충족도(%) → 전형 적합성 판단 기준
 * [컨설턴트 피드백: 모델 비교 보고서]
 * - 80%+: 서류 100% 전형(학종) 도전 가능
 * - 60~70%: 학종 가능하나 전공 관련 교과·창체 중심 점검 필요
 * - ~50%: 교과전형 주전형, 면접전형/수능최저 전형 우선
 *
 * ⑤결론, ⑧오류→재탐구는 +@ 가산 요소이며, 없다고 감점하지 않음.
 * "~임을 설명함" 종결 → 무조건 결론 미완이 아님 (선생님 기재 스타일 차이).
 *   앞 맥락에서 수행 추론 가능 시 → "면접 검증 포인트"로 분류.
 */
export const FLOW_COMPLETION_TIERS = [
  { minPercent: 80, label: "학종_서류100_가능", description: "생기부만으로 학생 역량이 충분히 드러남 — 서류 100% 전형 도전 가능" },
  { minPercent: 60, label: "학종_가능_점검필요", description: "학종 가능하나 전공 관련 교과·창체(동아리, 진로) 중심 충족 확인 필요" },
  { minPercent: 50, label: "학종_어려움", description: "중상위권 학종 합격 어려움. 교과전형 주전형, 면접전형·수능최저 전형 우선 고려" },
  { minPercent: 0, label: "교과전형_추천", description: "내신이 좋다면 교과전형, 아니면 단계별 전형(1차 정량→2차 면접) 추천" },
] as const;

/** 진로교과 세특 최소 충족 단계 — 기본값 (서울 15대학 기준: ① ② ③ ⑤) */
export const CAREER_SUBJECT_MIN_STAGES = [1, 2, 3, 5] as const;

/** SKY카+ 상위권 진로교과 최소 충족 단계 (④ 참고문헌 포함) */
export const CAREER_SUBJECT_MIN_STAGES_TOP = [1, 2, 3, 4, 5] as const;

/**
 * 대학 수준별 진로교과 최소 충족 단계 반환
 * [2026-04-03 컨설턴트 피드백]
 * - SKY카+ (상위권): ①②③④⑤ (5개, 참고문헌 필수)
 * - 서울 15대학 이하: ①②③⑤ (4개)
 */
export type UniversityTier = "top" | "mid" | "lower";

export function getCareerMinStages(tier: UniversityTier): readonly number[] {
  if (tier === "top") return CAREER_SUBJECT_MIN_STAGES_TOP;
  return CAREER_SUBJECT_MIN_STAGES;
}

// ============================================================
// 2. 진로교과 vs 비진로교과 차등 기준
// ============================================================

export interface CareerDifferentialRule {
  /** 진로교과 세특 기대 */
  careerNote: string;
  /** 비진로교과 세특 기대 */
  nonCareerNote: string;
  /** 과잉 도배 경고 */
  overloadWarning: string;
  /** 권장 비율 — 기본값 (하위~중위) */
  recommendedRatio: { careerLinked: string; subjectOnly: string };
}

export const CAREER_DIFFERENTIAL: CareerDifferentialRule = {
  careerNote:
    "8단계 흐름 중 최소 ①②③⑤를 충족하는 방향 제안. 교과목 단원과 진로관련 호기심을 연결하여 해결하는 사례를 보여주는 방향이 좋음. 탐구 깊이 기대치 높음.",
  nonCareerNote:
    "해당 교과 역량 중심이 정상. 교과목 학습목표에 맞는 순수 호기심으로 탐구하는 것이 더 좋은 평가. 진로 연결 없어도 됨.",
  overloadWarning:
    "모든 교과에 동일 진로 키워드를 강제 삽입하지 마세요 (진로 과잉 도배 = 입학사정관 감점).",
  recommendedRatio: { careerLinked: "3~4과목", subjectOnly: "3~4과목" },
};

/**
 * 대학 수준별 진로 연결 권장 비율
 * [2026-04-03 컨설턴트 피드백]
 * - 상위권(SKY카+): 가능한 모든 진로 관련 교과에서 진로 연결
 * - 중상위권(서울 15대학): 3~4과목 진로 연결
 * - 하위권: 3~4과목 진로 연결
 */
export function getRecommendedCareerRatio(tier: UniversityTier): { careerLinked: string; subjectOnly: string; note: string } {
  switch (tier) {
    case "top":
      return {
        careerLinked: "가능한 모든 진로 관련 교과",
        subjectOnly: "비진로 교과만 교과 역량 중심",
        note: "상위권 대학일수록 진로 연계 교과가 많을수록 유리. 단, 비진로교과에 강제 삽입은 금지.",
      };
    case "mid":
      return {
        careerLinked: "3~4과목",
        subjectOnly: "3~4과목",
        note: "진로 연결 3~4과목이 적당. 교과 역량 중심도 균형 유지.",
      };
    case "lower":
    default:
      return {
        careerLinked: "3~4과목",
        subjectOnly: "3~4과목",
        note: "진로 연결 3~4과목이 적당.",
      };
  }
}

// ============================================================
// 3. 내신 등급별 탐구 난이도 차등
// ============================================================

export interface GradeDiffTier {
  /** 9등급제 범위 (시작~끝) */
  grade9Range: [number, number];
  /** 5등급제 대응 */
  grade5Label: string;
  /** 난이도 라벨 */
  level: string;
  /** 기대 수준 상세 */
  expectation: string;
}

export const GRADE_DIFF_TIERS: readonly GradeDiffTier[] = [
  {
    grade9Range: [1, 2],
    grade5Label: "A (1등급)",
    level: "심화+확장",
    expectation:
      "교과 심화 이론, 선행연구 참고, 실험 설계, 사회적 확장. 목표학과 커리큘럼 1~2학년 개론 수준 이론 연결 가능",
  },
  {
    grade9Range: [3, 4],
    grade5Label: "B~C (2~3등급)",
    level: "발전",
    expectation:
      "교과 기반 자연스러운 확장. 단계적 탐구 + 명확한 결론. 전공 개론서 이하",
  },
  {
    grade9Range: [5, 9],
    grade5Label: "D~E (4~5등급)",
    level: "기본",
    expectation:
      "교과 핵심 개념 이해·적용. 교과 성취 기반 태도·노력 중심",
  },
] as const;

/** 9등급 → 난이도 레벨 변환 (코드 로직용) */
export function getGradeDiffLevel(grade9: number): string {
  if (grade9 <= 2) return "심화+확장";
  if (grade9 <= 4) return "발전";
  return "기본";
}

/** 진로선택 과목 성취도 → 난이도 매핑 */
export const CAREER_SUBJECT_ACHIEVEMENT_MAP: Record<string, string> = {
  A: "심화+확장",
  B: "발전",
  C: "기본",
};

/** 등급별 난이도 마크다운 테이블 (프롬프트 삽입용) */
export function formatGradeDiffTable(): string {
  const header = "| 9등급 | 5등급 | 난이도 | 기대 수준 |\n|---|---|---|---|";
  const rows = GRADE_DIFF_TIERS.map(
    (t) =>
      `| ${t.grade9Range[0]}~${t.grade9Range[1]}등급 | ${t.grade5Label} | **${t.level}** | ${t.expectation} |`,
  );
  return [header, ...rows].join("\n");
}

// ============================================================
// 4. 실패 패턴 (P1~P4 구조, F1~F6 과학, F9~F16 거시, M1 메타)
// ============================================================

export type PatternSeverity = "critical" | "major" | "minor";

export interface FailPattern {
  /** 패턴 코드 (P1_나열식, F2_인과단절 등) */
  code: string;
  /** 간결 라벨 */
  label: string;
  /** 상세 설명 (프롬프트 + UI 겸용) */
  description: string;
  /** 심각도 */
  severity: PatternSeverity;
  /** 패턴 그룹 */
  group: "structural" | "scientific" | "macro" | "meta";
}

/**
 * 전체 실패 패턴 목록 — 14개
 *
 * - structural (P1, P3, P4): 세특 구조적 문제
 * - scientific (F1~F6): 과학적/논리적 정합성 문제
 * - macro (F10, F12, F16): 거시적 기록 패턴 문제
 * - meta (M1): 표현 수준 문제
 *
 * [2026-04-03 컨설턴트 피드백 반영]
 * - P2_추상적_복붙 삭제: 수업태도 평가 글은 추상적이어도 실패 아님, 실질 문제는 F12로 포착
 * - F9_창체참여기록형 삭제: P2와 본질적으로 동일한 패턴
 * - F16: minor → major (입학사정관 실제 감점 요인)
 * - F10: major → minor (참고 수준)
 * - M1: major → minor (참고 수준)
 */
export const FAIL_PATTERNS: readonly FailPattern[] = [
  // ─── 구조적 문제 (P-series) ───
  {
    code: "P1_나열식",
    label: "나열식",
    description: "수행평가 내용을 연결 없이 나열만 한 경우",
    severity: "major",
    group: "structural",
  },
  // P2_추상적_복붙 삭제 — 수업태도 관련 추상적 표현은 실패 패턴이 아님 (F12로 포착)
  {
    code: "P3_키워드만",
    label: "키워드만",
    description:
      "전문용어/키워드는 있으나 구체적 탐구 방향이나 내용을 알 수 없는 경우",
    severity: "minor",
    group: "structural",
  },
  {
    code: "P4_내신탐구불일치",
    label: "내신↔탐구 불일치",
    description:
      "(진로교과인 경우) 학생 수준을 크게 벗어나는 대학원급 내용이 기술된 경우 — 대리작성 의심",
    severity: "critical",
    group: "structural",
  },

  // ─── 과학적/논리적 정합성 (F1~F6) ───
  {
    code: "F1_별개활동포장",
    label: "별개 활동 포장",
    description: "서로 다른 원리의 활동을 하나의 연속 탐구처럼 서술",
    severity: "major",
    group: "scientific",
  },
  {
    code: "F2_인과단절",
    label: "인과 단절",
    description:
      "실험결과와 무관한 결론으로 갑자기 전환 (예: 강도비교→환경문제)",
    severity: "critical",
    group: "scientific",
  },
  {
    code: "F3_출처불일치",
    label: "출처 불일치",
    description:
      "참고 도서/자료의 실제 내용과 학생 주장이 맞지 않는 경우",
    severity: "major",
    group: "scientific",
  },
  {
    code: "F4_전제불일치",
    label: "전제 불일치",
    description:
      '탐구 전제(질문)와 실험 방법의 개념이 불일치 (예: "좋은 성분" → 항산화 실험)',
    severity: "major",
    group: "scientific",
  },
  {
    code: "F5_비교군오류",
    label: "비교군 오류",
    description:
      "비교군/대조군 설계가 잘못된 경우 (예: 천연 두 가지끼리만 비교)",
    severity: "major",
    group: "scientific",
  },
  {
    code: "F6_자명한결론",
    label: "자명한 결론",
    description: "화학적/과학적으로 당연한 결론을 발견처럼 포장",
    severity: "minor",
    group: "scientific",
  },

  // ─── 거시적 패턴 (F9~F16) ───
  // F9_창체참여기록형 삭제 — P2와 본질적으로 동일한 패턴
  {
    code: "F10_성장부재",
    label: "성장 곡선 부재",
    description: "학년 간 내용 깊이가 동일하여 성장 곡선이 없는 경우",
    severity: "minor",
    group: "macro",
  },
  {
    code: "F12_자기주도성부재",
    label: "자기주도성 부재",
    description:
      "모든 활동이 교사 과제 중심이며 학생 스스로 질문을 만든 흔적 없음",
    severity: "major",
    group: "macro",
  },
  {
    code: "F16_진로과잉도배",
    label: "진로 과잉 도배",
    description:
      "모든 교과에 동일 진로 키워드를 강제 삽입하여 해당 교과 역량 불명확",
    severity: "major",
    group: "macro",
  },

  // ─── 메타 패턴 (M-series) ───
  {
    code: "M1_교사관찰불가",
    label: "교사 관찰 불가 표현",
    description:
      "교사가 직접 관찰할 수 없는 내면 상태를 기술하는 표현 사용",
    severity: "minor",
    group: "meta",
  },
] as const;

/** 패턴 코드로 패턴 조회 */
export function getFailPattern(code: string): FailPattern | undefined {
  return FAIL_PATTERNS.find((p) => p.code === code);
}

/** 그룹별 패턴 조회 */
export function getFailPatternsByGroup(
  group: FailPattern["group"],
): readonly FailPattern[] {
  return FAIL_PATTERNS.filter((p) => p.group === group);
}

/** 과학적 정합성 패턴 코드 목록 (F1~F6) — engine.ts 호환 */
export const SCIENTIFIC_PATTERN_CODES = FAIL_PATTERNS
  .filter((p) => p.group === "scientific")
  .map((p) => p.code);

// ============================================================
// 5. 교사 관찰 불가 표현 (M1 패턴 상세)
// ============================================================

/** 교사가 관찰할 수 없는 내면 상태 표현 — 세특/행특/창체 초안에서 금지 */
export const BANNED_TEACHER_EXPRESSIONS: readonly string[] = [
  "~다짐함",
  "~생각함",
  "~깨닫게 됨",
  "~를 알게 됨",
  "적극적임",
  "흥미를 보임",
  // [2026-04-03 컨설턴트 피드백 추가]
  "~하겠다고 함",
  "~모습을 보임",
  "~제출함", // 보고서 제목만 쓰이고 추가 내용 없는 경우
  "~발표함", // 추가적인 내용 없이 발표 사실만 기재
] as const;

/** 교사 관찰 불가 표현 프롬프트 텍스트 생성 */
export function formatBannedExpressions(): string {
  return BANNED_TEACHER_EXPRESSIONS.map((e) => `"${e}"`).join(", ");
}

// ============================================================
// 6. 창체 활동유형별 가중치 + 역량 포커스
// ============================================================

export type ChangcheActivityType = "autonomy" | "club" | "career";

export interface ChangcheActivityConfig {
  type: ChangcheActivityType;
  label: string;
  /** 입학사정관 리서치 기반 가중치 */
  weight: number;
  /** 중요도 순위 (전체 평가 항목 중) */
  rank: number;
  /** 중요도 라벨 */
  importance: "상" | "중상" | "하";
  /** 핵심 역량 */
  primaryCompetencies: string[];
  /** 보조 역량 */
  secondaryCompetencies: string[];
  /** 핵심 키워드 */
  keywords: string[];
  /** 평가 포커스 설명 */
  evaluationFocus: string;
  /** 주의사항 */
  cautions: string[];
}

/**
 * 12개 계열 분류 — 동아리 변경 판단, 교과이수적합도 등에 사용
 * [2026-04-03 컨설턴트 2차 피드백]
 */
export const ACADEMIC_FIELD_GROUPS = {
  /** 문과 그룹 — 상호 변경 OK */
  liberal_arts: {
    label: "문과 그룹",
    fields: [
      { code: "humanities", label: "인문계열", majors: "사학, 철학, 언론홍보, 미디어, 신문방송" },
      { code: "language", label: "어문계열", majors: "국어분야, 외국어분야" },
      { code: "social_science", label: "사회과학계열", majors: "법, 행정, 정치외교, 사회, 사회복지, 심리학" },
      { code: "business", label: "상경계열", majors: "경영, 경제" },
    ],
  },
  /** 이과 그룹 — 상호 변경 OK */
  natural_sciences: {
    label: "이과 그룹",
    fields: [
      { code: "natural_science", label: "자연과학계열", majors: "수학, 물리학, 통계학, 화학, 생명과학, 지구과학, 천문학" },
      { code: "engineering", label: "공학계열", majors: "기계, 로봇, 컴퓨터, 전기전자, 반도체, 에너지, 환경, 생명, 화학, 유전, 바이오, 재료, 식품공학" },
      { code: "medical", label: "의약학계열", majors: "의학과, 치의학과, 한의학과, 수의예과, 약학과" },
      { code: "health", label: "보건계열", majors: "간호학과, 물리치료학과, 방사선학과, 보건환경융합공학과" },
      { code: "life_science", label: "생활과학계열", majors: "식품영양, 섬유디자인" },
      { code: "agriculture", label: "농림분야", majors: "산림과학, 식물자원, 동물자원, 축산학" },
    ],
  },
  /** 특수 그룹 */
  special: {
    label: "특수 그룹",
    fields: [
      { code: "arts", label: "예체능계열", majors: "음악, 미술, 체육" },
      { code: "education", label: "사범·교육계열", majors: "사범대(국어/영어/수학/과학교육과), 교육학과, 교대" },
    ],
  },
} as const;

/**
 * 동아리 변경 규칙 — 컨설턴트 2차 피드백 기반
 *
 * 핵심: 진로선택과목 수요조사 타이밍(1학년 1학기 종료~2학기 종료)에 의해
 * 1→2학년 전환 시 계열 변경이 가능하지만, 2→3학년에서는 같은 계열만 가능.
 */
export const CLUB_CHANGE_RULES = {
  summary: "동아리 변경은 학년 초에만 가능. 같은 계열 그룹 내 변경은 OK. 계열 그룹 간 전환은 2학년에서만 가능.",
  rules: [
    "문과 그룹(인문/어문/사회과학/상경) 간 상호 변경 OK",
    "이과 그룹(자연과학/공학/의약학/보건/생활과학/농림) 간 상호 변경 OK",
    "문과↔이과 전환: 2학년에서만 가능 (1학년 1학기 종료 후 진로선택과목 수요조사 타이밍). 3학년에서 다시 돌아가기 어려움",
    "문과/이과 → 사범·교육 전환: 가능하나 뚜렷한 진로 변경 동기가 필요 → 전문 컨설턴트 확인 권장",
    "3학년 동아리 변경: 1,2학년과 같은 계열일 경우만 가능",
    "계열 변경 시 진로선택과목 이수가 맞는지 추가 확인 필요 → 전문 컨설턴트 의견 권장",
  ],
  okExamples: [
    "1학년 문학동아리 → 2학년 신문작성반 → 3학년 영어신문반 (인문 계열 내)",
    "1학년 인문 → 2학년 자연과학 (진로선택과목 변경 시) → 3학년 자연과학",
    "1학년 의약학 → 2학년 인문 (계열 전환, 진로선택과목 맞으면 OK)",
  ],
  penaltyExamples: [
    "과학실험 → 방송반 → 교사동아리 (계열 연속성 없음)",
    "2학년 자연 → 3학년 인문 (3학년에서 다시 전환 어려움)",
  ],
} as const;

/**
 * [2026-04-03 컨설턴트 피드백 반영]
 * - 동아리 = 진로 동등 비중 (기존: 동아리 > 진로)
 * - 자율활동: 학교 교육프로그램 + 교과이론 대입 + 인문학적 성찰이 최선
 * - 동아리 변경: 12계열 분류 기반 판단
 */
export const CHANGCHE_ACTIVITY_CONFIGS: readonly ChangcheActivityConfig[] = [
  {
    type: "autonomy",
    label: "자율",
    weight: 0.096,
    rank: 6,
    importance: "하",
    primaryCompetencies: ["community_collaboration", "community_leadership"],
    secondaryCompetencies: ["career_exploration"],
    keywords: ["자기주도", "협업", "소통", "리더십", "공동체의식", "책임감", "문제해결", "인문학적성찰"],
    evaluationFocus:
      "최선: 학교 교육프로그램(성폭력예방, 생명존중, 학교폭력예방 등)을 듣고 교과 이론을 대입하여 사회동향·대응방안을 고찰하는 인문학적 성찰. " +
      "차선: 공동체역량(전교회장/부회장/반장 등)이 강조되며 공동체 발전을 위한 구체적 사례가 드러나는 기록. " +
      "활용: 다른 영역에 기재 수가 부족할 때 담임 재량으로 진로 탐색/독서 탐구를 추가 기재하는 용도로도 사용됨.",
    cautions: [
      "인문학적 성찰이 담긴 자율활동이 공동체역량 기록보다 더 높은 평가를 받음",
      "단순 학급 역할 나열은 변별력이 낮음 — 구체적 기여 사례 필요",
    ],
  },
  {
    type: "club",
    label: "동아리",
    weight: 0.14,
    rank: 2,
    importance: "상",
    primaryCompetencies: ["career_course_effort", "career_course_achievement"],
    secondaryCompetencies: ["community_collaboration", "academic_inquiry"],
    keywords: ["전공적합성", "탐구력", "적극적참여", "지속성", "협업"],
    evaluationFocus:
      "전공 심화 탐구 수행이 핵심. 동아리 내에서 문제 설정→해결 과정, 결과물/산출물, 동료와의 협업/소통",
    cautions: [
      "2년 이상 지속이 이상적. 12계열 분류(문과: 인문/어문/사회과학/상경, 이과: 자연과학/공학/의약학/보건/생활과학/농림) 기반 판단. " +
        "같은 그룹 내 변경 OK. 문과↔이과 전환은 2학년에서만(진로선택과목 변경 타이밍). 3학년은 같은 계열만. " +
        "OK예: 문학→신문→영어신문 (문과 내). 감점예: 과학실험→방송반→교사동아리 (계열 연속성 없음)",
      '"즐겁게 참여함" 수준의 기록은 변별력이 없음 — 구체적 역할, 탐구 과정, 결과물을 명시해야 함',
      "3학년은 동아리 활동을 학기 중보다 1학기 기말 후 여름방학 전에 몰아서 활동하고 보고서를 제출하는 경우가 대부분",
    ],
  },
  {
    type: "career",
    label: "진로",
    weight: 0.14,
    rank: 2,
    importance: "상",
    primaryCompetencies: ["career_exploration", "career_course_effort"],
    secondaryCompetencies: [],
    keywords: ["진로탐색", "진로계획", "전공적합성", "확장활동", "자기주도탐구"],
    evaluationFocus:
      "자기주도적 조사/실험 수행이 핵심. 학교 활동 참여 → 호기심 → 직접 조사/실험 설계 → 심화탐구 → 진로 계획 구체화",
    cautions: [
      "진로검사 결과, 학과탐방, 박람회 참여 등 단기 참여활동은 참고 자료 정도로만 활용됨. 단순 참여가 아닌 탐구 과정을 담아야 함",
    ],
  },
] as const;

/** 활동유형별 설정 조회 */
export function getChangcheConfig(
  type: ChangcheActivityType,
): ChangcheActivityConfig {
  return CHANGCHE_ACTIVITY_CONFIGS.find((c) => c.type === type)!;
}

// ============================================================
// 7. 행특 7개 평가항목
// ============================================================

export interface HaengteukEvalItem {
  /** 항목명 */
  name: string;
  /** 설명 */
  description: string;
}

/**
 * [2026-04-03 컨설턴트 2차 피드백]
 * - 타인존중 + 배려나눔 → "타인존중·배려" 통합
 * - 회복탄력성, 지적호기심 추가
 */
export const HAENGTEUK_EVAL_ITEMS: readonly HaengteukEvalItem[] = [
  { name: "자기주도성", description: "스스로 목표를 세우고 계획·실천하는 능력" },
  { name: "갈등관리", description: "갈등 상황에서 합리적으로 해결하는 능력" },
  { name: "리더십", description: "공동체를 이끌고 방향을 제시하는 능력" },
  { name: "타인존중·배려", description: "다양성을 인정하고 타인을 배려하며 봉사와 공감을 실천하는 태도" },
  { name: "성실성", description: "책임감을 갖고 꾸준히 노력하는 태도" },
  { name: "규칙준수", description: "공동체 규범을 지키고 질서를 유지하는 능력" },
  { name: "회복탄력성", description: "실패나 어려움 후 다시 도전하고 성장하는 능력" },
  { name: "지적호기심", description: "스스로 질문을 만들고 답을 찾아가는 탐구적 태도" },
] as const;

/**
 * 행특 평가 점수 등급 — 5단계
 * [2026-04-03 컨설턴트 피드백] 3단계(상/중/하) → 5단계로 세분화
 */
export const HAENGTEUK_SCORE_TIERS = ["매우 우수", "우수", "보통", "미흡", "매우 미흡"] as const;

/** 행특 항목명 목록 (프롬프트 삽입용) */
export function formatHaengteukItemNames(): string {
  return HAENGTEUK_EVAL_ITEMS.map((i) => i.name).join(", ");
}

/** 행특 항목 상세 목록 (프롬프트 삽입용) */
export function formatHaengteukItemsDetailed(): string {
  return HAENGTEUK_EVAL_ITEMS.map(
    (item, i) => `${i + 1}. **${item.name}**: ${item.description}`,
  ).join("\n");
}

// ============================================================
// 8. 5축 품질 평가 가중치
// ============================================================

export interface QualityAxis {
  key: string;
  label: string;
  /** 종합점수 가중치 (합계 = 100) */
  weight: number;
}

/**
 * [2026-04-03 컨설턴트 피드백 반영]
 * scientificValidity → researchValidity (과학·수리·사회연구 정합성)
 * - 이공계: 개념 정확성, 실험/모델링 설계 타당성, 결론 비자명성, 원리 해석 오류
 * - 인문/사회계: 연구가설 설정 → 연구방법(양적/질적) 적용 → 결과 도출 → 한계점·대응방안의 논리적 전개
 */
export const QUALITY_AXES: readonly QualityAxis[] = [
  { key: "specificity", label: "구체성", weight: 25 },
  { key: "coherence", label: "논리적 연결", weight: 15 },
  { key: "depth", label: "탐구 깊이", weight: 25 },
  { key: "grammar", label: "문법/표현", weight: 10 },
  { key: "scientificValidity", label: "연구 정합성", weight: 25 },
] as const;

/** overallScore 산출 공식 설명 */
export const QUALITY_SCORE_FORMULA =
  "(specificity×25 + coherence×15 + depth×25 + grammar×10 + scientificValidity×25) / 5";

/**
 * 연구 정합성 축의 계열별 평가 기준 — 프롬프트에서 계열 분기 시 사용
 */
export const RESEARCH_VALIDITY_CRITERIA = {
  /** 이공계열: 기존 과학적 정합성 */
  science: {
    label: "과학·수리적 정합성",
    criteria: [
      "개념 정확성 (이론/용어/원리 사용의 정확도)",
      "실험·모델링 설계 타당성 (비교군/대조군, 변인 통제)",
      "결론 비자명성 (당연한 결론을 발견처럼 포장하지 않았는지)",
      "원리 해석 오류 (인과 단절, 전제 불일치)",
    ],
  },
  /** 인문·사회계열: 사회과학 연구방법론 기반 */
  humanities: {
    label: "사회연구 정합성",
    criteria: [
      "문제 정의와 연구 질문 설정의 명확성",
      "연구방법 적용 적절성 (양적: 질문지법·통계분석 / 질적: 면접법·참여관찰법·문헌연구법)",
      "연구 프로세스의 논리적 전개 (문제인식→질문설정→연구설계→자료수집→자료분석→결론과 제언)",
      "한계점 인식 및 대응방안의 논리적 도출",
    ],
    /**
     * 고등학생 수준 기준 (컨설턴트 2차 피드백):
     * - 양적연구: 표본 규모보다 "고등학생이 직접 진행하여 결과를 도출"한 것이 핵심
     * - 문헌연구: 책뿐 아니라 국내외 연구논문, 학술지 참고 정도면 충분
     */
    highSchoolLevel: "표본 규모보다 학생이 직접 설계·수행·결과 도출한 과정이 핵심. 문헌연구는 책 + 국내외 연구논문·학술지 참고.",
    /** 우수 사례 (프롬프트 few-shot용) */
    exemplars: [
      "뉴스 감성 점수와 주가 상관관계 분석 → 양의 상관관계 유지 구간과 불일치 구간 발견 → 감성 기반 예측의 한계와 다변수 접근 필요성 결론 (금융/IT 융합)",
      "넛지 독서 후 식사 선택 실험 설계 → 200명 대상 확장 연구 → 연령대별 선택 경향성 도출 (행동경제학)",
      "문학작품(난장이가 쏘아올린 작은 공, 원미동 사람들) + 경제지표(지니계수, 로렌츠 곡선) 융합 → 시대별 소득불평등 구조 시각화 및 현대 사회 문제 통찰 (인문+경제 융합)",
    ],
  },
} as const;

// ============================================================
// 8-2. 비진로교과 세특 평가 기준
// ============================================================

/**
 * [2026-04-03 컨설턴트 2차 피드백]
 * 비진로교과(국어, 영어, 체육 등)의 좋은 세특 기준.
 * 진로교과의 8단계 흐름과 별도로 적용.
 * 비진로교과에서 ⑧오류→재탐구는 필수는 아니지만, 있으면 학업역량에서 좋은 평가 +
 * 진로 교과 종합평가에서 탐구력 이해 근거로 작용.
 */
export const NON_CAREER_SUBJECT_CRITERIA = {
  korean: {
    label: "국어",
    subcriteria: {
      literature: {
        label: "문학",
        criteria: [
          "문학 작품에 대한 독자적 해석",
          "작품 간 비교를 통한 인물 심경변화·상황 종합 해석",
          "현대사회 기준으로 재해석 (유사 상황 탐색, 나라면 어떤 선택을 했을지)",
          "내가 작가라면 결론을 어떻게 냈을지 — 창의적 결말 고안",
          "함축적 의미의 창의적 해석, 더 좋은 표현 방법 고안",
          "비판적 사고",
        ],
      },
      readingWriting: {
        label: "독서와 작문",
        criteria: [
          "자료해석능력",
          "독해능력",
          "비판적 사고",
          "논리추론능력",
        ],
      },
      speechLanguage: {
        label: "화법과 언어",
        criteria: [
          "표준 발음, 품사·문장 구조 활용",
          "어휘·문장 선택의 적절성",
          "담화 구성 능력",
          "공적 의사소통 (토의·토론·연설·협상)",
        ],
      },
    },
  },
  english: {
    label: "영어",
    criteria: [
      "활동중심·모둠협력 수업 내 대화·발표·작업을 평가 근거로 활용",
      "독해: 세부정보, 요지, 논리적 관계, 추론, 어휘·구문 이해",
      "읽기·쓰기·듣기·말하기 언어기능 종합 평가",
    ],
  },
  general: {
    label: "비진로교과 공통",
    note: "⑧ 오류→재탐구는 비진로교과에서 필수가 아니나, 있으면 학업역량에서 좋은 평가. 진로 교과 종합평가에서 학생의 탐구력을 유기적으로 이해하는 근거로 작용.",
  },
} as const;

// ============================================================
// 9. 경고 엔진 임계값
// ============================================================

export const WARNING_THRESHOLDS = {
  /** 학년당 최소 독서 기록 수 */
  minReadingsPerGrade: 2,
  /** 교과이수적합도 경고 임계값 — 기본 (이하 시 경고) */
  courseAdequacyThreshold: 50,
  /** 교과이수적합도 심각 임계값 — 기본 */
  courseAdequacyCritical: 30,
} as const;

/**
 * 대학별 교과이수적합도 임계값 — 4단계
 * [2026-04-03 컨설턴트 2차 피드백]
 */
export type CourseAdequacyTier = "tier1" | "tier2" | "tier3" | "tier4";

export const COURSE_ADEQUACY_TIERS: Record<CourseAdequacyTier, {
  label: string;
  threshold: number;
  universities: string[];
}> = {
  tier1: {
    label: "최상위권",
    threshold: 90,
    universities: [
      "서울대", "연세대", "고려대", "한양대", "성균관대", "서강대",
      "KAIST", "UNIST", "DGIST", "GIST", "포항공대",
      "이화여대", "숙명여대", "건국대", "중앙대", "서울시립대",
      "한국외대", "동국대", "홍익대",
    ],
  },
  tier2: {
    label: "상위권",
    threshold: 70,
    universities: [
      "숭실대", "국민대", "세종대", "성신여대", "동덕여대", "덕성여대",
      "서울여대", "단국대", "광운대", "서울과기대", "한양대(에리카)", "한국항공대",
    ],
  },
  tier3: {
    label: "중위권",
    threshold: 60,
    universities: [
      "가천대", "인천대", "한국외대(글로벌)", "중앙대(안성)", "상명대", "명지대",
    ],
  },
  tier4: {
    label: "기타",
    threshold: 50,
    universities: [],
  },
};

/** 의약학 계열은 학과 기준으로 반드시 90~100% 이수 필요 */
export const MEDICAL_FIELD_ADEQUACY_THRESHOLD = 90;

/** 대학명 or 학과 기반 교과이수 임계값 반환 */
export function getCourseAdequacyThreshold(universityName?: string, isMedicalField?: boolean): number {
  if (isMedicalField) return MEDICAL_FIELD_ADEQUACY_THRESHOLD;
  if (!universityName) return WARNING_THRESHOLDS.courseAdequacyThreshold;

  for (const tier of Object.values(COURSE_ADEQUACY_TIERS)) {
    if (tier.universities.some((u) => universityName.includes(u))) {
      return tier.threshold;
    }
  }
  return WARNING_THRESHOLDS.courseAdequacyThreshold;
}

// ============================================================
// 10. 프롬프트 빌더 유틸리티
// ============================================================

/** 실패 패턴 프롬프트 텍스트 — competencyHighlight/setekGuide 등에서 사용 */
export function formatFailPatternsForPrompt(
  groups?: FailPattern["group"][],
): string {
  const patterns = groups
    ? FAIL_PATTERNS.filter((p) => groups.includes(p.group))
    : FAIL_PATTERNS.filter((p) => p.group !== "meta"); // meta 제외 (별도 처리)

  return patterns
    .map((p) => `- **${p.code}**: ${p.description}`)
    .join("\n");
}

/** 세특 가이드용 F1~F6 cautions 텍스트 */
export function formatScientificCautions(): string {
  return getFailPatternsByGroup("scientific")
    .map((p) => `"${p.description.split("(")[0].trim()}"`)
    .join(", ");
}

/** generateSetekDraft용 "절대 금지" 목록 */
export function formatDraftBannedPatterns(): string {
  const structural = getFailPatternsByGroup("structural");
  const key_scientific = FAIL_PATTERNS.filter((p) =>
    ["F2_인과단절", "F6_자명한결론"].includes(p.code),
  );
  const macro = FAIL_PATTERNS.filter((p) => p.code === "F16_진로과잉도배");

  const all = [...structural, ...key_scientific, ...macro];
  const lines = all.map((p) => `- ❌ **${p.label}**: ${p.description}`);

  // 교사 관찰 불가 표현 추가
  lines.push(
    `- ❌ **교사 관찰 불가 표현**: ${formatBannedExpressions()} (교사가 관찰할 수 없는 내면 상태)`,
  );

  return lines.join("\n");
}

/** 행특 초안용 "절대 금지" 목록 */
export function formatHaengteukBannedPatterns(): string {
  return [
    '- ❌ "수업에 성실히 참여함", "학습 태도가 좋음", "모범적인 학생" — 모든 학생에게 해당하는 상투적 표현',
    '- ❌ "관심을 보임", "노력하는 모습을 보임" — 구체적 성과/근거 없음',
    `- ❌ ${formatBannedExpressions()} — 교사가 직접 관찰할 수 없는 내면 상태`,
  ].join("\n");
}

/** 진단용 진로교과 약점 패턴 목록 */
export function formatDiagnosisCareerWeakPatterns(): string {
  return [
    "진로교과인데 탐구 활동이 피상적 (수행평가 나열식, 구체적 탐구 없음)",
    "진로교과인데 세특 내용이 상투적/추상적 (복붙 의심)",
    "진로교과 성적은 낮은데(B 이하) 세특에 대학원급 심화 내용 (내신↔탐구 불일치 = 대리작성 의심)",
    "진로교과에서 탐구 결론이 자명하거나, 실험설계 오류, 인과 단절이 있는 경우",
  ]
    .map((d) => `  - ${d}`)
    .join("\n");
}

/** 진단용 합격률 낮은 거시 패턴 */
export function formatDiagnosisMacroPatterns(): string {
  return [
    '**성장 곡선 부재**: 학년 간 탐구 깊이가 동일 → "학년별 심화 과정이 드러나지 않음"',
    '**전공 스토리라인 단절**: 교과/창체/동아리가 각각 다른 방향 → "진로 일관성 약함"',
    "**자기주도성 부재**: 모든 활동이 교사 과제 중심, 학생 주도 탐구 흔적 없음",
    "**진로 과잉 도배**: 모든 교과에 동일 키워드 강제 삽입, 각 교과 고유 역량 불명확",
  ]
    .map((d) => `- ${d}`)
    .join("\n");
}
