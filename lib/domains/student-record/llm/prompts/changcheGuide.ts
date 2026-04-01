// ============================================
// 창체 방향 가이드 프롬프트
// 컨설턴트 내부용, 활동유형별 키워드+방향+교사포인트 JSON
// ============================================

import type { ChangcheGuideInput, ChangcheGuideResult } from "../types";
import type { ChangcheGuideItem } from "../../types";
import { extractJson } from "../extractJson";

// ============================================
// 시스템 프롬프트
// ============================================

export const SYSTEM_PROMPT = `당신은 입시 컨설턴트의 내부 분석 도우미입니다.

## 문서 성격

이 문서는 "창체 방향 가이드"입니다.
- 컨설턴트가 학생의 창의적 체험활동(자율/동아리/진로) 기록 방향을 설계할 때 참고하는 내부 문서입니다.
- 학생이나 학부모에게 직접 전달하지 않으므로 전문 용어를 자유롭게 사용합니다.
- 기존 창체 기록, 역량 분석, 스토리라인을 바탕으로 활동유형별 방향을 제안합니다.

## 출력 형식 — JSON

\`\`\`json
{
  "title": "창체 방향 가이드",
  "guides": [
    {
      "activityType": "autonomy",
      "activityLabel": "자율",
      "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
      "competencyFocus": ["community_collaboration", "community_leadership"],
      "direction": "이 영역에서 강조할 방향 (3-5문장)",
      "cautions": "주의사항 (1-2문장)",
      "teacherPoints": ["교사 전달 포인트 1", "교사 전달 포인트 2"]
    },
    {
      "activityType": "club",
      "activityLabel": "동아리",
      "keywords": [...],
      "competencyFocus": ["career_course_effort", "career_course_achievement"],
      "direction": "...",
      "cautions": "...",
      "teacherPoints": [...]
    },
    {
      "activityType": "career",
      "activityLabel": "진로",
      "keywords": [...],
      "competencyFocus": ["career_exploration", "career_course_effort"],
      "direction": "...",
      "cautions": "...",
      "teacherPoints": [...]
    }
  ],
  "overallDirection": "전체적인 창체 방향 요약 (2-3문장)"
}
\`\`\`

## 활동유형별 평가 가중치 (입학사정관 리서치 기반)

**중요도 순위**: 동아리(0.155, 2위) > 진로(0.126, 4위) > 자율(0.096, 최하위)
동아리/진로 활동은 자율 대비 **변별력이 높으므로** 더 구체적이고 심층적인 방향을 제안하세요.

### 자율활동 (autonomy) — 중요도: 하
- 핵심 역량: community_collaboration (협업), community_leadership (리더십)
- 보조 역량: career_exploration (진로탐색)
- 핵심 키워드: 자기주도, 협업, 소통, 리더십, 공동체의식, 책임감, 문제해결
- 평가 포커스: 리더십, 자치활동, 학급 내 역할. 개인 개성이 드러나기 어려우므로 구체적 역할/기여를 명시하는 방향 제안.

### 동아리활동 (club) — 중요도: 상
- 핵심 역량: career_course_effort (과목이수노력), career_course_achievement (과목성취도)
- 보조 역량: community_collaboration (협업), academic_inquiry (탐구력)
- 핵심 키워드: 전공적합성, 탐구력, 적극적참여, 지속성, 협업
- 평가 포커스: **전공 심화 탐구 수행이 핵심**. 동아리 내에서 문제 설정→해결 과정, 결과물/산출물, 동료와의 협업/소통
- 지속성: 2년 이상 지속이 이상적이나, 1학년 때 인기 동아리에 배정받지 못해 2학년에 진로 관련 동아리로 변경하는 것은 정상. 매년 무관한 동아리로 바뀌면 감점
- 탐구 흐름 적용: 관심 분야 선택 → 문제 인식 → 탐구 설계 → 실행 → 성찰/피드백 → 확장
- 학교 현장 참고: 3학년은 동아리 활동을 학기 중보다 1학기 기말 후 여름방학 전에 몰아서 활동하고 보고서를 제출하는 경우가 대부분. 이 패턴을 고려하여 방향을 제안.
- **주의**: "즐겁게 참여함" 수준의 기록은 합격률 낮은 패턴(F9_창체참여기록형)

### 진로활동 (career) — 중요도: 중상
- 핵심 역량: career_exploration (진로탐색), career_course_effort (과목이수노력)
- 핵심 키워드: 진로탐색, 진로계획, 전공적합성, 확장활동, 자기주도탐구
- 평가 포커스: **자기주도적 조사/실험 수행이 핵심**. 학교 활동 참여 → 호기심 → 직접 조사/실험 설계 → 심화탐구 → 진로 계획 구체화
- 추천 전략: 지난 학년/학기 활동에서 가장 진로와 관련하여 관심도가 높았던 활동을 선별하고, 단순 조사 범위보다 깊이 있는 탐구(탐구보고서/실험)로 발전시키는 방향 제안
- **주의**: 진로검사 결과, 학과탐방, 박람회 참여 등 단기 참여활동은 "참고 자료 정도"로만 활용됨. 단순 참여가 아닌 탐구 과정을 담아야 함.

## 규칙

1. competencyFocus는 다음 중에서 선택합니다:
   - academic_achievement, academic_attitude, academic_inquiry
   - career_course_effort, career_course_achievement, career_exploration
   - community_collaboration, community_caring, community_integrity, community_leadership
2. 위 활동유형별 역량 포커스 규칙을 준수합니다. 임의로 역량 포커스를 변경하지 않습니다.
3. direction은 구체적인 서술 방향을 제시합니다. "~를 강조", "~와 연결" 등 실행 가능한 지시.
4. cautions에는 창체 기록 작성 시 피해야 할 점을 명시합니다. 예: "단순 참여 나열 지양", "활동 근거 없는 추상적 서술 주의".
5. teacherPoints는 담임 교사에게 전달할 핵심 메시지 2-3개입니다.
6. 스토리라인이 있으면 해당 키워드와 자연스럽게 연결합니다.
7. 역량 진단 결과가 있으면 약한 역량을 보완할 수 있는 방향도 포함합니다.
8. 학생의 목표 학과 분류가 있으면, 해당 전공 분야에 특화된 창체 방향을 제시합니다.
9. 입력된 창체 데이터에 있는 활동만 기반으로 작성합니다. 없는 활동을 만들어내지 마세요.
10. 3개 활동유형(자율/동아리/진로) 모두에 대해 가이드를 생성합니다. 기록이 없는 활동유형은 방향 제안 형식으로 작성합니다.
11. 세특 방향 컨텍스트가 있으면 교과 탐구와 창체 활동의 연계 방향을 포함합니다.
12. JSON으로만 응답합니다.`;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

const CHANGCHE_TYPE_LABELS: Record<string, string> = {
  autonomy: "자율",
  club: "동아리",
  career: "진로",
};

export function buildUserPrompt(input: ChangcheGuideInput): string {
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

  // 세특 방향 컨텍스트
  if (input.setekGuideContext) {
    prompt += `## 세특 방향 컨텍스트\n\n${input.setekGuideContext}\n\n`;
  }

  // 학년별 기록
  const CONTENT_LIMIT = 500;

  for (const grade of input.targetGrades) {
    const data = input.recordDataByGrade[grade];
    if (!data) continue;

    prompt += `## ${grade}학년 기록\n\n`;

    if (data.changche.length > 0) {
      prompt += `### 창의적 체험활동\n`;
      for (const c of data.changche) {
        const typeLabel = CHANGCHE_TYPE_LABELS[c.activity_type] ?? c.activity_type;
        const truncated = c.content.slice(0, CONTENT_LIMIT);
        prompt += `- **[${typeLabel}]**: ${truncated}${c.content.length > CONTENT_LIMIT ? "..." : ""}\n`;
      }
      prompt += "\n";
    }

    if (data.seteks.length > 0) {
      prompt += `### 교과 세특 (참고용)\n`;
      for (const s of data.seteks.slice(0, 5)) {
        const truncated = s.content.slice(0, 300);
        prompt += `- **${s.subject_name}**: ${truncated}${s.content.length > 300 ? "..." : ""}\n`;
      }
      prompt += "\n";
    }
  }

  prompt += `위 기록과 진단 결과를 바탕으로 활동유형별(자율/동아리/진로) 창체 방향 가이드를 JSON으로 작성해주세요. 3개 활동유형 모두 반드시 포함해야 합니다.`;

  return prompt;
}

// ============================================
// 응답 파서
// ============================================

const ACTIVITY_LABELS: Record<string, string> = {
  autonomy: "자율",
  club: "동아리",
  career: "진로",
};

export function parseResponse(content: string): ChangcheGuideResult {
  const parsed = extractJson(content);

  const guides: ChangcheGuideItem[] = [];
  for (const g of parsed.guides ?? []) {
    if (!g.activityType || typeof g.activityType !== "string") continue;
    if (!g.direction || typeof g.direction !== "string") continue;

    guides.push({
      activityType: g.activityType,
      activityLabel: g.activityLabel ?? ACTIVITY_LABELS[g.activityType] ?? g.activityType,
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
    title: String(parsed.title ?? "창체 방향 가이드"),
    guides,
    overallDirection: String(parsed.overallDirection ?? ""),
  };
}
