/**
 * 학교 공통 교육프로그램 — 창체 자율·자치 활동의 원천 (Phase 2 Wave 1.3 / Decision #4)
 *
 * 컨설턴트 평가 프레임워크에 따르면 창체 자율 활동의 "최선" 형태는:
 *   학교 교육프로그램(성폭력 예방, 생명존중, 학교폭력 예방 등)
 *   + 교과 이론 대입 (사회학·심리학·경제학 등 학문적 도구)
 *   + 사회 동향/대응방안에 대한 인문학적 성찰
 *
 * 이 상수는 `reflection_program` 가이드 생성 시 LLM 프롬프트의 few-shot 예시 제공을
 * 목적으로 한다. 단순 캠페인 활동·포스터 만들기 같은 피상적 주제 생성을 방지.
 *
 * 향후 DB 외부화는 evaluation_criteria 테이블 패턴을 따른다 (이 파일이 fallback).
 */

import type { CompetencyItemCode } from "../types";

// ============================================================
// 타입 정의
// ============================================================

export type ProgramCategory = "legal" | "community" | "career" | "safety";

export interface SchoolCommonProgram {
  /** 영문 코드 (DB 외부화 시 키) */
  code: string;
  /** 한글 명칭 (UI/프롬프트 표시용) */
  name: string;
  /** 카테고리 — 법정 의무교육 / 공동체 / 진로 / 안전 */
  category: ProgramCategory;
  /** 프로그램 목적·성격 */
  description: string;
  /** 이 프로그램이 강조하는 평가 역량 (창체 자율·자치 매핑용) */
  relatedCompetencies: CompetencyItemCode[];
  /**
   * LLM few-shot용 우수 탐구 주제 예시 (3개 권장).
   * 형식: "{교과 이론 대입} + {사회 동향 분석} + {성찰}"
   * 단순 "캠페인" 같은 피상적 표현 금지.
   */
  exampleThemes: string[];
  /**
   * 대입 가능한 교과 이론·학술 개념 (주제 설계의 academic hook).
   * LLM이 "어느 교과의 어떤 이론으로 풀어낼지"를 결정하는 단서로 사용.
   */
  academicHooks: string[];
}

// ============================================================
// 프로그램 정의 — 13개 (법정 7 + 공동체 4 + 진로 1 + 안전 1)
// ============================================================

export const SCHOOL_COMMON_PROGRAMS: readonly SchoolCommonProgram[] = [
  // ── 법정 의무교육 (7) ──
  {
    code: "violence_prevention",
    name: "학교폭력 예방교육",
    category: "legal",
    description:
      "법정 의무교육. 학교폭력의 유형(신체·언어·금품·따돌림·사이버)과 가해·피해·방관자 역할, 회복적 정의 기반 대응방안 학습.",
    relatedCompetencies: ["community_caring", "community_integrity"],
    exampleThemes: [
      "낙인이론 관점에서 본 학교폭력 가해자 교정 프로그램의 한계와 회복적 정의 비교 분석",
      "SNS 발달과 사이버 불링의 양상 변화 — 디지털 익명성 이론으로 본 가해 메커니즘 탐구",
      "방관자 효과(Bystander Effect) 실험을 학급 환경에 적용한 미니 연구 설계와 개입 방안 제언",
    ],
    academicHooks: [
      "사회학의 낙인이론(Labeling Theory)",
      "심리학의 방관자 효과·집단역학",
      "회복적 정의(Restorative Justice) 이론",
    ],
  },
  {
    code: "sexual_violence_prevention",
    name: "성폭력 예방교육",
    category: "legal",
    description:
      "법정 의무교육. 성적 자기결정권, 동의 문화, 디지털 성범죄 예방, 피해자 지원 체계 학습.",
    relatedCompetencies: ["community_caring", "community_integrity"],
    exampleThemes: [
      "디지털 성범죄 양형 기준의 국가 간 비교(한국·독일·캐나다) — 형법·여성학 관점 융합 분석",
      "스쿨 미투(MeToo) 이후 학교 구조 변화 — 미디어 프레이밍 이론으로 본 사회 인식 전환 과정",
      "동의 문화(Consent Culture) 교육 효과 분석 — 행동심리학의 행동 변화 모형 적용",
    ],
    academicHooks: [
      "여성학의 성적 자기결정권 이론",
      "법학의 형사 양형 기준 비교법학",
      "미디어 학의 프레이밍 이론",
    ],
  },
  {
    code: "suicide_prevention",
    name: "자살 예방·생명존중 교육",
    category: "legal",
    description:
      "법정 의무교육. 청소년 자살 위험 신호 인지, 또래 지지 체계, 정신건강 자원 접근성 학습.",
    relatedCompetencies: ["community_caring", "academic_attitude"],
    exampleThemes: [
      "베르테르 효과 vs 파파게노 효과 — 미디어 보도 가이드라인이 청소년 자살률에 미치는 영향 통계 분석",
      "긍정심리학(Positive Psychology)의 회복탄력성 모형을 학교 교육과정에 통합하는 방안 탐구",
      "OECD 국가별 청소년 자살률과 사회안전망 지출 상관관계 분석 — 데이터 기반 정책 제언",
    ],
    academicHooks: [
      "심리학의 긍정심리학·회복탄력성(Resilience)",
      "사회학의 뒤르켐(Durkheim) 자살론",
      "공중보건학의 사회안전망 이론",
    ],
  },
  {
    code: "smoking_alcohol_prevention",
    name: "흡연·음주 예방교육",
    category: "legal",
    description:
      "법정 의무교육. 청소년 약물 의존 메커니즘, 또래 압력, 광고·미디어 영향 학습.",
    relatedCompetencies: ["community_integrity", "academic_inquiry"],
    exampleThemes: [
      "전자담배 시장 확대와 청소년 흡연율의 상관관계 — 행동경제학의 넛지 이론으로 본 정책 효과",
      "주류 광고 규제와 청소년 음주율 상관성 — 호주·스웨덴 사례 비교법학 분석",
      "도파민 보상 회로(Reward Circuit) 관점에서 본 니코틴 중독의 신경생리학적 메커니즘 탐구",
    ],
    academicHooks: [
      "행동경제학의 넛지(Nudge) 이론",
      "신경과학의 도파민 보상 회로",
      "보건학의 광고 규제 정책 평가",
    ],
  },
  {
    code: "info_ethics",
    name: "정보통신윤리교육",
    category: "legal",
    description:
      "법정 의무교육. 디지털 시민성, 알고리즘 편향, 개인정보 보호, AI 윤리 학습.",
    relatedCompetencies: ["academic_inquiry", "community_integrity"],
    exampleThemes: [
      "추천 알고리즘의 필터버블 효과와 청소년의 정치 양극화 — 사회학·통계학 융합 데이터 분석",
      "딥페이크 식별 기법의 정확도 비교 실험과 미디어 리터러시 교육의 필요성",
      "GDPR vs 한국 개인정보보호법 — 학생 데이터 수집 동의 모형의 법적·윤리적 비교",
    ],
    academicHooks: [
      "정보학의 알고리즘 편향(Algorithmic Bias)",
      "통계학의 추천 시스템 평가",
      "법학의 정보 자기결정권",
    ],
  },
  {
    code: "human_rights",
    name: "인권교육",
    category: "legal",
    description:
      "법정 의무교육. 보편 인권 개념, 차별 금지, 학생 인권 조례 학습.",
    relatedCompetencies: ["community_caring", "community_integrity"],
    exampleThemes: [
      "학생 인권 조례 시·도별 비교와 학업성취도 상관관계 — 교육사회학적 양적 분석",
      "장애학생 통합교육의 효과 — 사회모델 vs 의료모델 관점의 교육과정 차이 비교 탐구",
      "이주배경 청소년의 학업 격차 — 부르디외(Bourdieu) 문화자본 이론 적용 분석",
    ],
    academicHooks: [
      "사회학의 부르디외 문화자본 이론",
      "법학의 평등권·차별금지법",
      "교육학의 통합교육 모델",
    ],
  },
  {
    code: "safety_education",
    name: "안전교육 (재난·생활안전)",
    category: "legal",
    description:
      "법정 의무교육. 화재·지진·교통·응급처치 등 7대 안전 영역 학습.",
    relatedCompetencies: ["academic_inquiry", "community_collaboration"],
    exampleThemes: [
      "재난 조기경보 시스템의 베이지안 확률 모델 — 통계학·공학 융합 의사결정 모형 탐구",
      "지진 대피 시뮬레이션 — 군중 동역학(Crowd Dynamics) 미분방정식 모델로 본 동선 최적화",
      "심정지 골든타임과 AED 배치 밀도 — 한국·일본 데이터 비교 통한 공중보건 정책 제언",
    ],
    academicHooks: [
      "통계학의 베이지안 추론",
      "물리학의 군중 동역학",
      "공중보건학의 응급의료 시스템",
    ],
  },

  // ── 공동체·시민 (4) ──
  {
    code: "democratic_citizenship",
    name: "민주시민교육",
    category: "community",
    description:
      "선거·정치 참여, 미디어 리터러시, 토론·합의 문화, 사회 갈등 조정 학습.",
    relatedCompetencies: ["community_leadership", "community_integrity"],
    exampleThemes: [
      "여론조사의 통계적 오류 — 22대 총선 데이터로 본 표본 편향과 가중치 보정 방법론 탐구",
      "숙의민주주의 모형의 학생 자치 적용 — 공론화위원회 사례 비교 분석과 학급 모의 운영",
      "정치 양극화의 미디어 요인 — 에코체임버 효과를 SNS 데이터로 측정한 양적 연구 설계",
    ],
    academicHooks: [
      "정치학의 숙의민주주의(Deliberative Democracy)",
      "통계학의 표본 추출과 가중치",
      "미디어학의 에코체임버·필터버블",
    ],
  },
  {
    code: "unification_education",
    name: "통일·평화교육",
    category: "community",
    description: "남북관계 역사·현황, 분단 비용, 평화 외교 학습.",
    relatedCompetencies: ["community_caring", "academic_inquiry"],
    exampleThemes: [
      "독일 통일 30년 후 동·서독 격차 — 부르디외 문화자본 이론으로 본 교육 격차 분석",
      "분단 비용의 거시경제학적 추산 — 한국개발연구원(KDI) 모형 비판적 검토",
      "한반도 평화 협정의 국제법적 단계 — 비교법학 관점의 정전협정→평화협정 전환 경로 탐구",
    ],
    academicHooks: [
      "거시경제학의 통일 비용 추산 모형",
      "국제법의 평화협정 이론",
      "사회학의 통일 후 사회 통합",
    ],
  },
  {
    code: "multicultural_education",
    name: "다문화·세계시민교육",
    category: "community",
    description: "문화 다양성 존중, 글로벌 이슈, SDG(지속가능발전목표) 학습.",
    relatedCompetencies: ["community_caring", "community_collaboration"],
    exampleThemes: [
      "이주배경 학생의 학업 적응 — 베리(Berry)의 문화 적응 모형 4가지 적용 사례 비교",
      "SDG 4(양질의 교육) 달성도 국가 비교 — 교육 격차 지표(GINI) 통계 분석",
      "글로벌 공급망 윤리 — 공정무역 인증 효과의 양적·질적 혼합 연구 설계",
    ],
    academicHooks: [
      "문화인류학의 문화 적응 이론",
      "통계학의 국제 비교 지표",
      "경영학의 ESG·공정무역",
    ],
  },
  {
    code: "environmental_education",
    name: "환경·생태교육",
    category: "community",
    description: "기후변화, 생물다양성, 지속가능한 소비 학습.",
    relatedCompetencies: ["academic_inquiry", "community_caring"],
    exampleThemes: [
      "탄소중립 시나리오의 LCA(Life Cycle Assessment) 비교 — 화학·환경공학 융합 정량 분석",
      "기후변화 회의론(Skepticism)의 미디어 프레이밍 — 비판적 미디어 분석 + 과학 커뮤니케이션 탐구",
      "지역 생물다양성 시민과학(Citizen Science) 프로젝트 설계 — 표본 조사법과 데이터 검증",
    ],
    academicHooks: [
      "환경공학의 LCA(전과정 평가)",
      "과학 커뮤니케이션학",
      "생태학의 시민과학 방법론",
    ],
  },

  // ── 진로 (1) ──
  {
    code: "career_education",
    name: "진로교육",
    category: "career",
    description: "자기이해, 직업 세계 탐색, 진로 의사결정 학습.",
    relatedCompetencies: ["career_exploration", "academic_attitude"],
    exampleThemes: [
      "AI 시대의 직업 양극화 — 노동경제학의 SBTC(기술편향적 기술변화) 이론 적용 분석",
      "전공별 졸업 후 임금 격차 — 학력 신호 이론(Signaling Theory) 비판적 검토",
      "성장 마인드셋(Growth Mindset)이 진로 결정 자기효능감에 미치는 영향 — 학급 단위 횡단 연구",
    ],
    academicHooks: [
      "노동경제학의 SBTC·인적자본 이론",
      "교육학의 신호 이론",
      "심리학의 성장 마인드셋",
    ],
  },

  // ── 보건·기타 (1) ──
  {
    code: "mental_health",
    name: "정신건강·보건교육",
    category: "safety",
    description: "스트레스 관리, 정서 조절, 정신건강 자원 학습.",
    relatedCompetencies: ["community_caring", "academic_attitude"],
    exampleThemes: [
      "청소년 우울증과 SNS 사용 시간 — 종단 연구 데이터로 본 인과 vs 상관 구분의 통계학적 도전",
      "마음챙김(Mindfulness) 명상의 학업 성취 효과 — 무선통제실험(RCT) 메타분석 비판적 검토",
      "수면 부족과 인지 기능 — 청소년 수면 패턴 미니 실험 설계와 통제 변인 관리",
    ],
    academicHooks: [
      "임상심리학의 인지행동치료(CBT)",
      "통계학의 종단 연구·메타분석",
      "신경과학의 수면과 인지",
    ],
  },
];

// ============================================================
// 헬퍼 함수
// ============================================================

/** 카테고리별 프로그램 조회 */
export function getProgramsByCategory(
  category: ProgramCategory,
): readonly SchoolCommonProgram[] {
  return SCHOOL_COMMON_PROGRAMS.filter((p) => p.category === category);
}

/** 특정 역량과 연결된 프로그램 조회 (창체 자율 추천 시 사용) */
export function getProgramsByCompetency(
  competency: CompetencyItemCode,
): readonly SchoolCommonProgram[] {
  return SCHOOL_COMMON_PROGRAMS.filter((p) =>
    p.relatedCompetencies.includes(competency),
  );
}

/** 코드로 단일 프로그램 조회 */
export function getProgramByCode(code: string): SchoolCommonProgram | null {
  return SCHOOL_COMMON_PROGRAMS.find((p) => p.code === code) ?? null;
}

/**
 * LLM 프롬프트 few-shot 섹션 빌더 — `reflection_program` 가이드 생성 시 사용.
 * 학생의 storyline·targetMajor 맥락에 가까운 프로그램 N개를 골라 주제 예시 삽입.
 *
 * 사용처: `lib/domains/guide/llm/prompts/reflection-program.ts` (Phase 2 Wave 3 예정)
 */
export function formatProgramsForPrompt(
  programs: readonly SchoolCommonProgram[],
): string {
  const lines: string[] = ["## 참고 — 학교 공통 교육프로그램 (자율·자치 주제 원천)"];
  for (const p of programs) {
    lines.push(`\n### ${p.name} (${p.category})`);
    lines.push(`- 목적: ${p.description}`);
    lines.push(`- 적용 가능 학문: ${p.academicHooks.join(", ")}`);
    lines.push(`- 우수 주제 예시:`);
    for (const theme of p.exampleThemes) {
      lines.push(`  · ${theme}`);
    }
  }
  return lines.join("\n");
}
