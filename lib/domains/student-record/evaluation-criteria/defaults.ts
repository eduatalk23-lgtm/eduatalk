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
  { order: 8, label: "오류→재탐구 순환", description: "한계를 인식하고 추가 탐구를 수행 (있으면 큰 가산)" },
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

/** 진로교과 세특 최소 충족 단계 (① ② ③ ⑤) */
export const CAREER_SUBJECT_MIN_STAGES = [1, 2, 3, 5] as const;

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
  /** 권장 비율 */
  recommendedRatio: { careerLinked: string; subjectOnly: string };
}

export const CAREER_DIFFERENTIAL: CareerDifferentialRule = {
  careerNote:
    "8단계 흐름 중 최소 ①②③⑤를 충족하는 방향 제안. 교과목 단원과 진로관련 호기심을 연결하여 해결하는 사례를 보여주는 방향이 좋음. 탐구 깊이 기대치 높음.",
  nonCareerNote:
    "해당 교과 역량 중심이 정상. 교과목 학습목표에 맞는 순수 호기심으로 탐구하는 것이 더 좋은 평가. 진로 연결 없어도 됨.",
  overloadWarning:
    "모든 교과에 동일 진로 키워드를 강제 삽입하지 마세요 (진로 과잉 도배 = 입학사정관 감점).",
  recommendedRatio: { careerLinked: "2~3과목", subjectOnly: "4~5과목" },
};

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
      "교과 심화 이론, 선행연구 참고, 실험 설계, 사회적 확장. 목표학과 커리큘럼 기초 이론 연결 가능",
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
 * 전체 실패 패턴 목록 — 17개
 *
 * - structural (P1~P4): 세특 구조적 문제
 * - scientific (F1~F6): 과학적/논리적 정합성 문제
 * - macro (F9~F16): 거시적 기록 패턴 문제
 * - meta (M1): 표현 수준 문제
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
  {
    code: "P2_추상적_복붙",
    label: "추상적 복붙",
    description:
      '"적극적으로 참여", "성실한 태도" 등 모든 학생에게 쓸 수 있는 상투적 표현',
    severity: "major",
    group: "structural",
  },
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
  {
    code: "F9_창체참여기록형",
    label: "창체 참여 기록형",
    description:
      '"즐겁게 참여함" 수준의 창체 기록 — 구체적 역할/기여/탐구 없음',
    severity: "major",
    group: "macro",
  },
  {
    code: "F10_성장부재",
    label: "성장 곡선 부재",
    description: "학년 간 내용 깊이가 동일하여 성장 곡선이 없는 경우",
    severity: "major",
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
    severity: "minor",
    group: "macro",
  },

  // ─── 메타 패턴 (M-series) ───
  {
    code: "M1_교사관찰불가",
    label: "교사 관찰 불가 표현",
    description:
      "교사가 직접 관찰할 수 없는 내면 상태를 기술하는 표현 사용",
    severity: "major",
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

export const CHANGCHE_ACTIVITY_CONFIGS: readonly ChangcheActivityConfig[] = [
  {
    type: "autonomy",
    label: "자율",
    weight: 0.096,
    rank: 6,
    importance: "하",
    primaryCompetencies: ["community_collaboration", "community_leadership"],
    secondaryCompetencies: ["career_exploration"],
    keywords: ["자기주도", "협업", "소통", "리더십", "공동체의식", "책임감", "문제해결"],
    evaluationFocus:
      "리더십, 자치활동, 학급 내 역할. 개인 개성이 드러나기 어려우므로 구체적 역할/기여를 명시하는 방향 제안.",
    cautions: [],
  },
  {
    type: "club",
    label: "동아리",
    weight: 0.155,
    rank: 2,
    importance: "상",
    primaryCompetencies: ["career_course_effort", "career_course_achievement"],
    secondaryCompetencies: ["community_collaboration", "academic_inquiry"],
    keywords: ["전공적합성", "탐구력", "적극적참여", "지속성", "협업"],
    evaluationFocus:
      "전공 심화 탐구 수행이 핵심. 동아리 내에서 문제 설정→해결 과정, 결과물/산출물, 동료와의 협업/소통",
    cautions: [
      "2년 이상 지속이 이상적이나, 1학년 때 인기 동아리에 배정받지 못해 2학년에 진로 관련 동아리로 변경하는 것은 정상. 매년 무관한 동아리로 바뀌면 감점",
      '"즐겁게 참여함" 수준의 기록은 합격률 낮은 패턴(F9_창체참여기록형)',
      "3학년은 동아리 활동을 학기 중보다 1학기 기말 후 여름방학 전에 몰아서 활동하고 보고서를 제출하는 경우가 대부분",
    ],
  },
  {
    type: "career",
    label: "진로",
    weight: 0.126,
    rank: 4,
    importance: "중상",
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

export const HAENGTEUK_EVAL_ITEMS: readonly HaengteukEvalItem[] = [
  { name: "자기주도성", description: "스스로 목표를 세우고 계획·실천하는 능력" },
  { name: "갈등관리", description: "갈등 상황에서 합리적으로 해결하는 능력" },
  { name: "리더십", description: "공동체를 이끌고 방향을 제시하는 능력" },
  { name: "타인존중", description: "다양성을 인정하고 타인을 배려하는 태도" },
  { name: "배려나눔", description: "타인을 위해 봉사하고 공감하는 마음" },
  { name: "성실성", description: "책임감을 갖고 꾸준히 노력하는 태도" },
  { name: "규칙준수", description: "공동체 규범을 지키고 질서를 유지하는 능력" },
] as const;

/** 행특 평가 점수 등급 */
export const HAENGTEUK_SCORE_TIERS = ["상", "중", "하"] as const;

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

export const QUALITY_AXES: readonly QualityAxis[] = [
  { key: "specificity", label: "구체성", weight: 25 },
  { key: "coherence", label: "논리적 연결", weight: 15 },
  { key: "depth", label: "탐구 깊이", weight: 25 },
  { key: "grammar", label: "문법/표현", weight: 10 },
  { key: "scientificValidity", label: "과학적 정합성", weight: 25 },
] as const;

/** overallScore 산출 공식 설명 */
export const QUALITY_SCORE_FORMULA =
  "(specificity×25 + coherence×15 + depth×25 + grammar×10 + scientificValidity×25) / 5";

// ============================================================
// 9. 경고 엔진 임계값
// ============================================================

export const WARNING_THRESHOLDS = {
  /** 학년당 최소 독서 기록 수 */
  minReadingsPerGrade: 2,
  /** 교과이수적합도 경고 임계값 (이하 시 경고) */
  courseAdequacyThreshold: 50,
  /** 교과이수적합도 심각 임계값 */
  courseAdequacyCritical: 30,
} as const;

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
