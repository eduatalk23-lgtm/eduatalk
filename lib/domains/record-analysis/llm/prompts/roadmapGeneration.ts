// ============================================
// Phase R1 — AI 3개년 활동 로드맵 생성 프롬프트
// planning 모드: 기록 없는 신규 학생
// analysis 모드: 기존 기록+진단이 있는 학생
// ============================================

import { extractJson } from "../extractJson";
import type { RoadmapGenerationInput, RoadmapGenerationOutput, RoadmapGeneratedItem } from "../types";

const VALID_AREAS = new Set([
  "autonomy", "club", "career", "setek", "personal_setek",
  "reading", "course_selection", "competition", "external",
  "volunteer", "general",
]);

export const ROADMAP_SYSTEM_PROMPT = `당신은 대학입시 컨설턴트의 내부 분석 도우미입니다.

## 문서 성격

이 문서는 "3개년 활동 로드맵"입니다.
- 한국 고등학교(3년제) 학생의 대입 준비를 위한 학기별 활동 계획을 설계합니다.
- 학생의 희망 전공, 수강 계획, 스토리라인, 배정 가이드를 종합하여 로드맵을 생성합니다.
- 컨설턴트 내부 문서이므로 전문 용어를 자유롭게 사용합니다.

## 모드

입력에 "모드" 필드가 있습니다:
- "planning": 기록이 없는 신규 학생. 수강 계획과 스토리라인만으로 미래 활동을 설계합니다.
- "analysis": 기존 기록이 있는 학생. 진단 결과와 기존 활동도 함께 고려합니다.

## 활동 영역 (area, 11개)

- autonomy: 자율·자치활동 (리더십, 학급 프로젝트)
- club: 동아리활동 (학술/봉사 동아리)
- career: 진로활동 (진로 탐색, 멘토링, 체험)
- setek: 교과 세특 (과목별 심화 탐구)
- personal_setek: 개인 세특 (학교자율과정)
- reading: 독서활동 (전공 관련 도서)
- course_selection: 교과선택 (과목 이수 전략)
- competition: 대회 (교내 경시/발표)
- external: 외부활동 (봉사, 캠프)
- volunteer: 봉사활동
- general: 종합/기타

## 규칙

1. 학생의 현재 학년 이상의 학기만 생성합니다. 이미 지난 학기는 제외합니다.
2. 학기당 2-4개 활동을 배분합니다. 과도하지 않게 균형을 맞춥니다.
3. 수강 계획(confirmed/recommended 과목)이 있는 학기에는 해당 과목 연계 세특 활동을 포함합니다.
4. 스토리라인이 있으면 학년별 테마(grade_X_theme)에 맞춰 활동을 설계합니다.
5. 같은 스토리라인의 활동은 학년 간 심화·발전되어야 합니다 (나선형 심화).
6. 배정된 탐구 가이드가 있으면 해당 가이드의 탐구 주제를 활동에 반영합니다.
7. plan_content는 구체적 행동을 포함합니다: "~보고서 작성", "~발표", "~실험 설계" 등.
8. plan_keywords는 3-5개 학술적/탐구적 키워드입니다.
9. [analysis 모드] 진단 약점이 있으면 이를 보완하는 활동을 포함합니다.
10. [analysis 모드] 기존 활동과 중복되지 않는 새로운 활동을 제안합니다.
11. [planning 모드] 추천 과목 목록이 있으면 과목 선택 전략도 course_selection 영역에 포함합니다.
12. JSON으로만 응답합니다.

## JSON 출력 형식

\`\`\`json
{
  "items": [
    {
      "area": "setek",
      "grade": 1,
      "semester": 1,
      "plan_content": "통합과학 세특: 의료영상 원리(CT/MRI) 탐구 보고서 작성",
      "plan_keywords": ["의료영상", "CT", "Beer-Lambert 법칙"],
      "storyline_title": "의공학 탐구",
      "rationale": "1학년 통합과학에서 물리학적 기초를 다지며 의공학 스토리라인의 1학년 테마와 연결"
    },
    {
      "area": "reading",
      "grade": 1,
      "semester": 1,
      "plan_content": "『의학의 역사』(재커리 독서 후 과학사 관점 독후감 작성",
      "plan_keywords": ["의학사", "과학 혁명", "EBM"],
      "storyline_title": null,
      "rationale": "1학년 1학기에 전공 관련 기초 독서로 관심 분야를 탐색"
    }
  ],
  "overallStrategy": "의공학 진로를 중심으로 1학년 기초과학 탐구 → 2학년 심화 실험 → 3학년 융합 연구로 심화하는 3개년 성장 전략"
}
\`\`\``;

const CHANGCHE_TYPE_LABELS: Record<string, string> = {
  autonomy: "자율·자치",
  club: "동아리",
  career: "진로",
};

export function buildUserPrompt(input: RoadmapGenerationInput): string {
  let prompt = `## 학생 정보\n\n`;
  prompt += `- 현재 학년: ${input.grade}학년\n`;
  prompt += `- 모드: ${input.mode}\n`;
  if (input.targetMajor) prompt += `- 희망 전공 계열: ${input.targetMajor}\n`;
  if (input.targetSubClassificationName) prompt += `- 세부 분류: ${input.targetSubClassificationName}\n`;
  prompt += `- 교육과정: ${input.curriculumYear} 개정\n\n`;

  // 수강 계획 (학기별 그룹)
  if (input.coursePlans && input.coursePlans.length > 0) {
    prompt += `## 수강 계획\n\n`;
    const grouped = new Map<string, typeof input.coursePlans>();
    for (const cp of input.coursePlans) {
      const key = `${cp.grade}-${cp.semester}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(cp);
    }
    const sortedKeys = [...grouped.keys()].sort();
    for (const key of sortedKeys) {
      const [g, s] = key.split("-");
      prompt += `### ${g}학년 ${s}학기\n`;
      for (const cp of grouped.get(key)!) {
        const typeLabel = cp.subjectType ? ` (${cp.subjectType})` : "";
        prompt += `- [${cp.status}] ${cp.subjectName}${typeLabel}\n`;
      }
      prompt += "\n";
    }
  }

  // 스토리라인
  if (input.storylines && input.storylines.length > 0) {
    prompt += `## 스토리라인\n\n`;
    for (const sl of input.storylines) {
      prompt += `### ${sl.title}\n`;
      if (sl.career_field) prompt += `- 진로분야: ${sl.career_field}\n`;
      if (sl.keywords.length > 0) prompt += `- 키워드: ${sl.keywords.join(", ")}\n`;
      if (sl.grade_1_theme) prompt += `- 1학년 테마: ${sl.grade_1_theme}\n`;
      if (sl.grade_2_theme) prompt += `- 2학년 테마: ${sl.grade_2_theme}\n`;
      if (sl.grade_3_theme) prompt += `- 3학년 테마: ${sl.grade_3_theme}\n`;
      prompt += "\n";
    }
  }

  // 가이드 배정
  if (input.guideAssignments) {
    prompt += `${input.guideAssignments}\n\n`;
  }

  // 추천 과목
  if (input.recommendedCourses && input.recommendedCourses.length > 0) {
    prompt += `## 전공 추천 과목\n\n`;
    const general = input.recommendedCourses.filter((c) => c.type === "general").map((c) => c.name);
    const career = input.recommendedCourses.filter((c) => c.type === "career").map((c) => c.name);
    const fusion = input.recommendedCourses.filter((c) => c.type === "fusion").map((c) => c.name);
    if (general.length > 0) prompt += `- 일반선택: ${general.join(", ")}\n`;
    if (career.length > 0) prompt += `- 진로선택: ${career.join(", ")}\n`;
    if (fusion.length > 0) prompt += `- 융합선택: ${fusion.join(", ")}\n`;
    prompt += "\n";
  }

  // === analysis 모드 전용 ===
  if (input.mode === "analysis") {
    if (input.diagnosisStrengths && input.diagnosisStrengths.length > 0) {
      prompt += `## 진단 강점\n\n`;
      for (const s of input.diagnosisStrengths) prompt += `- ${s}\n`;
      prompt += "\n";
    }
    if (input.diagnosisWeaknesses && input.diagnosisWeaknesses.length > 0) {
      prompt += `## 진단 약점 (보완 활동 필요)\n\n`;
      for (const w of input.diagnosisWeaknesses) prompt += `- ${w}\n`;
      prompt += "\n";
    }
    if (input.diagnosisImprovements && input.diagnosisImprovements.length > 0) {
      prompt += `## 개선 전략\n\n`;
      for (const imp of input.diagnosisImprovements) {
        prompt += `- [${imp.priority}] ${imp.area}: ${imp.action}\n`;
      }
      prompt += "\n";
    }
    if (input.setekGuides && input.setekGuides.length > 0) {
      prompt += `## 세특 방향 가이드 (기존)\n\n`;
      for (const sg of input.setekGuides) {
        prompt += `- ${sg.subjectName}: ${sg.direction.slice(0, 100)} (키워드: ${sg.keywords.join(", ")})\n`;
      }
      prompt += "\n";
    }
    if (input.existingActivities && input.existingActivities.length > 0) {
      prompt += `## 기존 활동 (중복 제외 필요)\n\n`;
      for (const act of input.existingActivities) {
        prompt += `- [${act.grade}학년/${act.area}] ${act.content.slice(0, 80)}\n`;
      }
      prompt += "\n";
    }
  }

  // Phase δ-6: 메인 탐구 (5축 진단 / G11) — 학기별 missions 와 tier_plan 정합 기준
  if (input.mainExplorationSection) {
    prompt += `${input.mainExplorationSection}\n\n`;
  }

  // C3(2026-04-16): Blueprint 청사진 + Gap Tracker bridge 주입 — 학기 로드맵의 상위 설계 기준
  if (input.blueprintSection) {
    prompt += `${input.blueprintSection}\n\n`;
  }
  if (input.bridgeSection) {
    prompt += `${input.bridgeSection}\n\n`;
  }

  prompt += `위 정보를 종합하여 ${input.grade}학년부터 3학년까지의 학기별 활동 로드맵을 JSON으로 생성해주세요.`;
  if (input.mainExplorationSection) {
    prompt += ` 메인 탐구 tier_plan 이 제공된 경우, 학기별 missions 가 tier 진행(기초→발전→심화)을 따르도록 정렬하고 빈 tier 셀을 우선 채우는 미션을 학기 1개 이상 포함하세요.`;
  }
  if (input.blueprintSection) {
    prompt += ` Blueprint 청사진이 제공된 경우, 학기별 로드맵이 blueprint의 targetConvergences 와 milestones 에 정합하도록 설계하세요. 각 마일스톤의 keyActivities 를 해당 학년 학기에 반드시 반영하세요.`;
  }
  if (input.bridgeSection) {
    prompt += ` Bridge 제안(urgency high/medium)이 제공된 경우, 각 bridge 를 구체 학기 활동으로 1건 이상 변환하여 로드맵에 포함하세요.`;
  }
  return prompt;
}

export function parseResponse(content: string): RoadmapGenerationOutput {
  const parsed = extractJson(content);

  const items: RoadmapGeneratedItem[] = [];
  for (const item of parsed.items ?? []) {
    if (!VALID_AREAS.has(item.area)) continue;
    if (typeof item.grade !== "number" || item.grade < 1 || item.grade > 3) continue;
    if (!item.plan_content || typeof item.plan_content !== "string") continue;

    items.push({
      area: item.area,
      grade: item.grade,
      semester: typeof item.semester === "number" && (item.semester === 1 || item.semester === 2) ? item.semester : null,
      plan_content: String(item.plan_content),
      plan_keywords: Array.isArray(item.plan_keywords) ? item.plan_keywords.map(String) : [],
      storyline_title: item.storyline_title ? String(item.storyline_title) : undefined,
      rationale: String(item.rationale ?? ""),
    });
  }

  return {
    items,
    overallStrategy: String(parsed.overallStrategy ?? ""),
  };
}
