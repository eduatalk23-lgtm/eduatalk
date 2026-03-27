// ============================================
// Phase 9.3 — 세특 방향 가이드 프롬프트
// 컨설턴트 내부용, 과목별 키워드+방향+교사포인트 JSON
// ============================================

import type { SetekGuideInput, SetekGuideResult } from "../types";
import type { SetekGuideItem } from "../../types";
import { extractJson } from "../extractJson";

// ============================================
// 시스템 프롬프트
// ============================================

export const SYSTEM_PROMPT = `당신은 입시 컨설턴트의 내부 분석 도우미입니다.

## 문서 성격

이 문서는 "세특 방향 가이드"입니다.
- 컨설턴트가 학생의 과목별 세특(세부능력 및 특기사항) 작성 방향을 설계할 때 참고하는 내부 문서입니다.
- 학생이나 학부모에게 직접 전달하지 않으므로 전문 용어를 자유롭게 사용합니다.
- 기존 세특 기록, 역량 분석, 스토리라인을 바탕으로 과목별 방향을 제안합니다.

## 출력 형식 — JSON

\`\`\`json
{
  "title": "세특 방향 가이드",
  "guides": [
    {
      "subjectName": "과목명",
      "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
      "competencyFocus": ["academic_inquiry", "career_exploration"],
      "direction": "이 과목 세특에서 강조할 방향 (3-5문장)",
      "cautions": "주의사항 (1-2문장)",
      "teacherPoints": ["교사 전달 포인트 1", "교사 전달 포인트 2"]
    }
  ],
  "overallDirection": "전체적인 세특 방향 요약 (2-3문장)"
}
\`\`\`

## 규칙

1. 입력된 세특/창체 데이터에 있는 활동만 기반으로 작성합니다. 없는 활동을 만들어내지 마세요.
2. 과목별로 5-7개의 핵심 키워드를 추출합니다. 키워드는 세특에 녹일 수 있는 학술적/탐구적 개념입니다.
3. competencyFocus는 다음 중에서 선택합니다:
   - academic_achievement, academic_attitude, academic_inquiry
   - career_course_effort, career_course_achievement, career_exploration
   - community_collaboration, community_caring, community_integrity, community_leadership
4. direction은 구체적인 서술 방향을 제시합니다. "~를 강조", "~와 연결" 등 실행 가능한 지시.
5. cautions에는 세특 작성 시 피해야 할 점을 명시합니다. 예: "단순 나열 지양", "활동 근거 없는 추상적 서술 주의".
6. teacherPoints는 담임/교과 교사에게 전달할 핵심 메시지 2-3개입니다.
7. 스토리라인이 있으면 해당 키워드와 자연스럽게 연결합니다.
8. 역량 진단 결과가 있으면 약한 역량을 보완할 수 있는 방향도 포함합니다.
9. 세특 데이터가 있는 과목만 가이드를 생성합니다. 데이터 없는 과목은 생략합니다.
10. 학생의 목표 학과 분류(소분류)가 있으면, 해당 전공 분야에 특화된 세특 방향을 제시합니다.
11. JSON으로만 응답합니다.`;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

const CHANGCHE_TYPE_LABELS: Record<string, string> = {
  autonomy: "자율",
  club: "동아리",
  career: "진로",
};

export function buildUserPrompt(input: SetekGuideInput): string {
  let prompt = `## 학생 정보\n\n`;
  prompt += `- 이름: ${input.studentName}\n`;
  prompt += `- 현재 학년: ${input.grade}학년\n`;
  if (input.targetMajor) prompt += `- 희망 전공 계열: ${input.targetMajor}\n`;
  if (input.targetMidName || input.targetSubClassificationName) {
    const parts = [input.targetMidName, input.targetSubClassificationName].filter(Boolean);
    prompt += `- 목표 학과 분류: ${parts.join(" > ")}\n`;
  }
  prompt += `- 대상 학년: ${input.targetGrades.join(", ")}학년\n\n`;

  // 스토리라인
  if (input.storylines && input.storylines.length > 0) {
    prompt += `## 스토리라인\n\n`;
    for (const s of input.storylines) {
      prompt += `- ${s.title} (키워드: ${s.keywords.join(", ")})\n`;
    }
    prompt += "\n";
  }

  // 역량 진단
  if (input.competencyScores && input.competencyScores.length > 0) {
    prompt += `## 역량 진단 결과\n\n`;
    for (const cs of input.competencyScores) {
      prompt += `- ${cs.item}: ${cs.grade}${cs.narrative ? ` — ${cs.narrative}` : ""}\n`;
    }
    prompt += "\n";
  }

  // 강점/약점
  if (input.strengths && input.strengths.length > 0) {
    prompt += `## 강점\n${input.strengths.map((s) => `- ${s}`).join("\n")}\n\n`;
  }
  if (input.weaknesses && input.weaknesses.length > 0) {
    prompt += `## 약점 (보완 필요)\n${input.weaknesses.map((w) => `- ${w}`).join("\n")}\n\n`;
  }

  // 영역간 연결 (Phase E2)
  if (input.edgePromptSection) {
    prompt += input.edgePromptSection + "\n";
  }

  // 학년별 데이터
  for (const grade of input.targetGrades) {
    const data = input.recordDataByGrade[grade];
    if (!data) continue;

    prompt += `## ${grade}학년 기록\n\n`;

    const CONTENT_LIMIT = 600;

    if (data.seteks.length > 0) {
      prompt += `### 교과 세특\n`;
      for (const s of data.seteks) {
        const truncated = s.content.slice(0, CONTENT_LIMIT);
        prompt += `- **${s.subject_name}**: ${truncated}${s.content.length > CONTENT_LIMIT ? "..." : ""}\n`;
      }
      prompt += "\n";
    }

    if (data.changche.length > 0) {
      prompt += `### 창의적 체험활동\n`;
      for (const c of data.changche) {
        const typeLabel = CHANGCHE_TYPE_LABELS[c.activity_type] ?? c.activity_type;
        const truncated = c.content.slice(0, CONTENT_LIMIT);
        prompt += `- **[${typeLabel}]**: ${truncated}${c.content.length > CONTENT_LIMIT ? "..." : ""}\n`;
      }
      prompt += "\n";
    }
  }

  prompt += `위 기록과 진단 결과를 바탕으로 과목별 세특 방향 가이드를 JSON으로 작성해주세요.`;
  return prompt;
}

// ============================================
// 응답 파서
// ============================================

export function parseResponse(content: string): SetekGuideResult {
  const parsed = extractJson(content);

  const guides: SetekGuideItem[] = [];
  for (const g of parsed.guides ?? []) {
    if (!g.subjectName || typeof g.subjectName !== "string") continue;
    if (!g.direction || typeof g.direction !== "string") continue;

    guides.push({
      subjectName: g.subjectName,
      keywords: Array.isArray(g.keywords)
        ? g.keywords.filter((k: unknown) => typeof k === "string")
        : [],
      competencyFocus: Array.isArray(g.competencyFocus)
        ? g.competencyFocus.filter((c: unknown) => typeof c === "string")
        : [],
      direction: g.direction,
      cautions: typeof g.cautions === "string" ? g.cautions : "",
      teacherPoints: Array.isArray(g.teacherPoints)
        ? g.teacherPoints.filter((t: unknown) => typeof t === "string")
        : [],
    });
  }

  return {
    title: String(parsed.title ?? "세특 방향 가이드"),
    guides,
    overallDirection: String(parsed.overallDirection ?? ""),
  };
}
