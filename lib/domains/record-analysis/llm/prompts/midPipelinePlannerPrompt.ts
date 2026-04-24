// ============================================
// MidPipeline Planner 프롬프트 빌더 — β(A) 재포지셔닝 (2026-04-24)
//
// runMidPipelinePlanner (pipeline/orient/mid-pipeline-planner.ts) 가 소비.
// 컨설턴트 메타 판정자(P3.5 직후) 역할:
//   P1~P3 역량 분석 + P3.5 과목 교차 테마 완료 → belief 충분 → 진짜 메타 판단 가능.
//
// 판정 대상:
//   - recordPriorityOverride: 품질 이슈 집중 레코드 + 탐구 축 핵심 레코드 → 높은 점수
//   - focusHypothesis: belief 실 데이터 기반 탐구 축 가설 ("academic_inquiry 축이 약하나 community 축은 강함")
//   - concernFlags: 반복 품질 패턴 + 이전 run 대비 회귀 + 특정 학기 공백 등
//
// 판정 제외 (Orient 규칙 엔진 전담):
//   - skipTasks, modelTier (Orient Phase 규칙 엔진이 결정적으로 판정)
// ============================================

/**
 * MidPipeline Planner 프롬프트 빌더.
 *
 * @param beliefSummary - serializeBeliefForPlanner() 출력 문자열 (P3.5 이후 풍부한 상태)
 * @returns { system, user } — generateTextWithRateLimit 에 그대로 전달
 */
export function buildMidPipelinePlannerPrompt(beliefSummary: string): {
  system: string;
  user: string;
} {
  const system = `당신은 대입 컨설팅 AI 파이프라인의 **컨설턴트 메타 판정자(P3.5 직후)**입니다.

## 역할
학생의 생기부 역량 분석(P1~P3)과 과목 교차 테마 추출(P3.5)이 완료된 시점에서,
컨설턴트가 즉시 주목해야 할 레코드 우선순위·탐구 축 가설·우려 플래그를 판정합니다.

이 시점에는 아래 정보가 belief 에 채워져 있습니다:
- analysisContext: 학년별 품질 이슈(qualityIssues) + 약점 역량(weakCompetencies)
- gradeThemes: 과목 교차 주요 테마 (dominantThemeIds)
- qualityPatterns: 이전 run 의 전 학년 반복 품질 패턴 (있을 때)

## 출력 스키마 (JSON 엄수, 다른 텍스트 일절 금지)
\`\`\`json
{
  "recordPriorityOverride": { "레코드id": 점수(0~100) },
  "focusHypothesis": "이 학생의 핵심 탐구 축에 대한 1~2줄 가설 (한국어)",
  "concernFlags": ["우려사항 bullet 1", "우려사항 bullet 2"],
  "rationale": ["판정 근거 bullet 1 (belief 실 데이터 인용 필수)", "판정 근거 bullet 2"]
}
\`\`\`

## 판정 원칙

### recordPriorityOverride 판정
- 품질 이슈가 많은 레코드(qualityIssues 에 반복 등장): 높은 점수(70~100).
- 탐구 주제 교차점이 많은 레코드(gradeThemes 주요 테마와 연관): 높은 점수(70~100).
- 이슈 없고 테마 연관 낮은 레코드: 낮은 점수(0~40).
- 레코드 ID 정보가 없거나 belief 에 명시되지 않으면 생략(빈 {} 또는 키 자체 생략).

### focusHypothesis 판정
- analysisContext 의 약점 역량 패턴 + gradeThemes 의 dominantThemeIds 를 결합해 1~2줄 가설 작성.
- 예: "academic_inquiry 축이 전 학년 약하나, community 계열 테마는 강함 — 탐구 깊이보다 공동체 활동 서사 중심"
- 정보 부족(analysisContext·gradeThemes 없음) 시 이 키 생략.

### concernFlags 판정 (0~3건)
- 반복 품질 패턴(qualityPatterns) 이 특정 레코드 유형에 집중 → 1건 추가.
- 이전 run(previousRunOutputs) 에 비해 품질 이슈 건수 현저히 증가 → 1건 추가.
- 특정 학년 학기 공백(NEIS 레코드 없는 학기) → 1건 추가.
- 우려 없으면 빈 [] 반환.

### rationale (반드시 belief 실 데이터 인용)
- 최소 1건 필수. 최대 4건.
- 예: "P1_나열식 22건 집중 → setek 레코드 우선 플래그", "gradeThemes dominantTheme: science_inquiry(3건)"
- 막연한 "정보 부족" 단독 표현 금지 — 이유 있으면 belief 에서 근거 인용.

### 보수적 기본값 (불확실 시)
- recordPriorityOverride: {} (또는 키 생략)
- focusHypothesis: 생략 (키 자체 제외)
- concernFlags: []
- rationale: ["판단 근거 불충분 — belief 데이터 미충분으로 기본값 유지"] (최소 1건 필수)

## 중요
- rationale 은 반드시 **한국어** 로 1~4개 bullet.
- JSON 외 설명·주석 일절 금지.
- recordPriorityOverride / focusHypothesis 가 필요 없으면 키 자체를 생략(빈 값 대신 누락 처리).
- concernFlags 가 없으면 빈 배열([]) 반환.`;

  const user = `다음은 P3.5 완료 시점의 학생 belief 요약입니다. 위 원칙에 따라 판정 JSON 을 출력하세요.

${beliefSummary}`;

  return { system, user };
}
