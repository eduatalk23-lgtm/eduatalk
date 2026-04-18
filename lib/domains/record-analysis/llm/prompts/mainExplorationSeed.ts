// ============================================
// Phase 1 Auto-Bootstrap: main_exploration seed 프롬프트
//
// target_major 만으로 초안 main_exploration 생성 (theme_label/keywords/tier_plan 3단).
// Phase 3 (2026-04-18): recordSummary 옵션 추가 — k≥1 학생의 기존 탐구 키워드 주입.
// ============================================

import { extractJson } from "../extractJson";

/**
 * k≥1 학생(이전 학년 분석 완료)의 기존 탐구 경험 요약.
 * Bootstrap LLM 에 주입되어 학생 개별화된 메인 탐구 초안을 얻기 위함.
 */
export interface MainExplorationRecordSummary {
  /** 기존 탐구 핵심 키워드 (storyline title/keywords 또는 activity_tag 빈도 상위 N개). 최대 10개. */
  keywords: string[];
  /** 이수 과목 이름 (세특 대상 과목). 최대 10개. */
  subjectAreas: string[];
}

export interface MainExplorationSeedInput {
  /** Tier 2 키 (예: "수리·통계"). ALL_MAJOR_KEYS 검증 통과된 값. */
  targetMajor: string;
  /** 복수 전공 (optional). */
  targetMajor2?: string | null;
  /** Tier 1 코드 (HUM/SOC/EDU/ENG/NAT/MED/ART). career_field 로 저장. */
  tier1Code: string;
  /** 현재 학년 (1~3). */
  currentGrade: 1 | 2 | 3;
  /** Phase 3. k≥1 학생의 기존 탐구 요약. k=0 이면 omit. */
  recordSummary?: MainExplorationRecordSummary;
}

export interface MainExplorationSeedTierEntry {
  theme: string;
  key_questions: string[];
  suggested_activities: string[];
}

export interface MainExplorationSeedResult {
  themeLabel: string;
  themeKeywords: string[];
  tierPlan: {
    foundational: MainExplorationSeedTierEntry;
    development: MainExplorationSeedTierEntry;
    advanced: MainExplorationSeedTierEntry;
  };
}

export const MAIN_EXPLORATION_SEED_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가로, 학생의 진로 계열(Tier 2 대분류)만 주어진 상태에서 **초안 메인 탐구**(main_exploration)를 설계합니다.

## 메인 탐구란
- 학생의 3년(또는 남은 고교 기간) 탐구 서사를 관통하는 **중심축 주제**
- 세특/창체/행특/독서가 이 축을 중심으로 수렴하도록 이끎
- 이후 컨설턴트가 검수·수정할 **AI 초안**을 생성하는 것이 당신의 역할

## 출력 구조

1. **themeLabel**: 한 줄 제목. 진로 계열 기반 탐구 주제. (예: "수학·통계 기반 사회현상 분석과 의사결정 탐구")
   - 30~60자 한국어. "연구"·"탐구" 같은 단어 남용 금지
2. **themeKeywords**: 3~7개. 탐구를 대표하는 핵심 개념어 (예: ["통계적 추론", "데이터 윤리", "확률", "모형화"])
3. **tierPlan**: 3단 (foundational → development → advanced). 각 단계는:
   - **theme**: 해당 단계의 중심 주제 (20~50자)
   - **key_questions**: 2~4개. 학생이 스스로 던질 질문 (각 15~40자)
   - **suggested_activities**: 3~5개. 구체적 활동 (세특·창체·독서·개인 과제). 각 20~50자

## 3단 발달 원칙
- **foundational**: 해당 계열의 기본 개념·도구 학습. 질문이 열려 있고 답이 확정적
- **development**: 현실 문제에 개념 적용. 여러 관점·방법 비교. 학생이 선택·판단 시작
- **advanced**: 논쟁·한계·윤리 차원. 자기 관점 형성 + 자신의 결론을 정당화

## 주의사항
- **해당 진로 계열의 전형적 탐구** 를 제시. 과도하게 난해하거나 비현실적 활동 금지
- 현재 학년(grade)이 2~3학년이면 foundational 은 이미 완료되었다 가정 → development/advanced 에 무게
- Tier 1/Tier 2 불일치 시 Tier 2 우선
- **반드시 JSON 형식**으로만 응답. 설명/서론/주석 금지.

## 출력 JSON 스키마

\`\`\`json
{
  "themeLabel": "string",
  "themeKeywords": ["string", ...],
  "tierPlan": {
    "foundational": { "theme": "string", "key_questions": ["..."], "suggested_activities": ["..."] },
    "development":  { "theme": "string", "key_questions": ["..."], "suggested_activities": ["..."] },
    "advanced":     { "theme": "string", "key_questions": ["..."], "suggested_activities": ["..."] }
  }
}
\`\`\`
`;

export function buildMainExplorationSeedUserPrompt(
  input: MainExplorationSeedInput,
): string {
  const hasSummary =
    input.recordSummary &&
    (input.recordSummary.keywords.length > 0 ||
      input.recordSummary.subjectAreas.length > 0);

  const lines: (string | null)[] = [
    `## 학생 진로 정보`,
    `- 주 전공 계열 (Tier 2): ${input.targetMajor}`,
    input.targetMajor2 ? `- 복수 전공 계열 (Tier 2): ${input.targetMajor2}` : null,
    `- 대분류 (Tier 1): ${input.tier1Code}`,
    `- 현재 학년: ${input.currentGrade}학년`,
    ``,
  ];

  if (hasSummary) {
    lines.push(
      `## 학생의 기존 탐구 경험 (NEIS 기반 요약)`,
      input.recordSummary!.keywords.length > 0
        ? `- 핵심 키워드: ${input.recordSummary!.keywords.join(", ")}`
        : null,
      input.recordSummary!.subjectAreas.length > 0
        ? `- 이수 과목: ${input.recordSummary!.subjectAreas.join(", ")}`
        : null,
      ``,
      `위 진로 정보 + **기존 탐구 경험을 반영**한 초안 main_exploration 을 JSON 으로 생성하세요.`,
      `- 기존 키워드를 정면 부정하지 말고 **연장·심화** 방향으로 조정`,
      `- foundational 단계는 이미 다뤄진 내용을 중복 나열하지 말고, development/advanced 에서 기존 탐구를 발전시키는 방향으로 제시`,
    );
  } else {
    lines.push(
      `위 진로 정보만을 기반으로 초안 main_exploration 을 JSON 으로 생성하세요.`,
    );
  }

  return lines.filter((l): l is string => l !== null).join("\n");
}

export function parseMainExplorationSeedResponse(
  raw: string,
): MainExplorationSeedResult {
  const parsed = extractJson<{
    themeLabel?: unknown;
    themeKeywords?: unknown;
    tierPlan?: unknown;
  }>(raw);
  if (!parsed) throw new Error("JSON 파싱 실패: 응답에서 JSON 을 찾지 못함");

  const themeLabel =
    typeof parsed.themeLabel === "string" && parsed.themeLabel.trim().length > 0
      ? parsed.themeLabel.trim()
      : null;
  if (!themeLabel) throw new Error("themeLabel 이 비어있음");

  const kwRaw = Array.isArray(parsed.themeKeywords) ? parsed.themeKeywords : [];
  const themeKeywords = kwRaw
    .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    .map((k) => k.trim());
  if (themeKeywords.length < 3) throw new Error(`themeKeywords 최소 3개 필요 (실제 ${themeKeywords.length}개)`);

  const tp = parsed.tierPlan as Record<string, unknown> | undefined;
  if (!tp) throw new Error("tierPlan 누락");

  const parseTier = (key: string): MainExplorationSeedTierEntry => {
    const raw = tp[key] as Record<string, unknown> | undefined;
    if (!raw) throw new Error(`tierPlan.${key} 누락`);
    const theme = typeof raw.theme === "string" ? raw.theme.trim() : "";
    const kqRaw = Array.isArray(raw.key_questions) ? raw.key_questions : [];
    const saRaw = Array.isArray(raw.suggested_activities) ? raw.suggested_activities : [];
    const key_questions = kqRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    const suggested_activities = saRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    if (!theme) throw new Error(`tierPlan.${key}.theme 비어있음`);
    if (key_questions.length < 2) throw new Error(`tierPlan.${key}.key_questions 최소 2개 필요`);
    if (suggested_activities.length < 3) throw new Error(`tierPlan.${key}.suggested_activities 최소 3개 필요`);
    return { theme, key_questions, suggested_activities };
  };

  return {
    themeLabel,
    themeKeywords,
    tierPlan: {
      foundational: parseTier("foundational"),
      development: parseTier("development"),
      advanced: parseTier("advanced"),
    },
  };
}
