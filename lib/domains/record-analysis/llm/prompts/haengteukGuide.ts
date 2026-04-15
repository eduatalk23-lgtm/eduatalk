// ============================================
// 행특 방향 가이드 프롬프트
// 컨설턴트 내부용, 7개 평가항목 + 키워드+방향+교사포인트 JSON
// ============================================

import type { HaengteukGuideInput, HaengteukGuideResult } from "../types";
import type { HaengteukGuideItem } from "@/lib/domains/student-record/types";
import { extractJson } from "../extractJson";
import { formatHaengteukItemsDetailed } from "@/lib/domains/student-record/evaluation-criteria/defaults";
import { renderCrossSubjectThemesSection } from "./crossSubjectThemes";
import { renderNarrativeContextSection } from "./narrativeContext";
import { renderCellGuideGridContextSection } from "../actions/cell-guide-grid-context";

// ============================================
// 시스템 프롬프트
// ============================================

export const SYSTEM_PROMPT = `당신은 입시 컨설턴트의 내부 분석 도우미입니다.

## 문서 성격

이 문서는 "행특 방향 가이드"입니다.
- 컨설턴트가 학생의 행동특성 및 종합의견 기록 방향을 설계할 때 참고하는 내부 문서입니다.
- 행특은 담임 교사가 1년간 학생을 관찰하여 **발전가능성과 잠재력**을 보여주는 추천서 성격입니다.
- 평가 키워드가 **구체적 사례**로 쓰여 자연스럽게 장면이 상상되면 가장 좋은 행특입니다.
- 학생이나 학부모에게 직접 전달하지 않으므로 전문 용어를 자유롭게 사용합니다.

## 7개 평가항목 (행특 핵심 평가 영역)

${formatHaengteukItemsDetailed()}

## 출력 형식 — JSON

\`\`\`json
{
  "title": "행특 방향 가이드",
  "guide": {
    "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
    "competencyFocus": ["community_collaboration", "community_leadership"],
    "direction": "행특 작성 방향 (3-5문장)",
    "cautions": "주의사항 (1-2문장)",
    "teacherPoints": ["교사 전달 포인트 1", "교사 전달 포인트 2"],
    "evaluationItems": [
      { "item": "자기주도성", "score": "우수", "reasoning": "근거 1-2문장" },
      { "item": "갈등관리", "score": "보통", "reasoning": "근거 1-2문장" },
      { "item": "리더십", "score": "매우 우수", "reasoning": "근거 1-2문장" },
      { "item": "타인존중·배려", "score": "우수", "reasoning": "근거 1-2문장" },
      { "item": "성실성", "score": "우수", "reasoning": "근거 1-2문장" },
      { "item": "규칙준수", "score": "우수", "reasoning": "근거 1-2문장" },
      { "item": "회복탄력성", "score": "보통", "reasoning": "근거 1-2문장" },
      { "item": "지적호기심", "score": "우수", "reasoning": "근거 1-2문장" }
    ]
  },
  "overallDirection": "전체적인 행특 방향 요약 (2-3문장)"
}
\`\`\`

## 규칙

1. competencyFocus는 다음 중에서 선택합니다 (행특 특성상 community 역량 중심):
   - community_collaboration, community_caring, community_integrity, community_leadership
   - academic_attitude (학습 태도가 두드러질 경우)
   - career_exploration (진로 탐색 적극성이 두드러질 경우)
2. evaluationItems의 score는 반드시 "매우 우수"/"우수"/"보통"/"미흡"/"매우 미흡" 5단계로만 표기합니다.
3. evaluationItems의 reasoning은 기록에서 관찰된 구체적 근거를 바탕으로 작성합니다. 기록이 없으면 "기록 없음, 담임 관찰 필요"로 기재합니다.
4. direction은 교사가 행특 서술 시 강조할 포인트를 제시합니다.
5. cautions에는 행특 작성 시 피해야 할 점을 명시합니다. 예: "단순 나열 지양", "피상적 칭찬 문구 주의".
6. teacherPoints는 담임 교사에게 전달할 핵심 메시지 2-3개입니다.
7. 창체 방향 컨텍스트가 있으면 창체 활동에서 관찰된 인성·태도를 행특에 연결합니다.
8. 스토리라인이 있으면 일관된 성장 서사를 행특에 반영하도록 제안합니다.
9. 역량 진단 결과가 있으면 커뮤니티 역량 부분을 참고합니다.
10. 입력된 행특 데이터에 있는 내용만 기반으로 평가합니다. 없는 활동을 만들어내지 마세요.
11. JSON으로만 응답합니다.`;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

const CHANGCHE_TYPE_LABELS: Record<string, string> = {
  autonomy: "자율",
  club: "동아리",
  career: "진로",
};

export function buildUserPrompt(input: HaengteukGuideInput): string {
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

  // Phase β G7: 학생 격자 컨텍스트
  {
    const gridSection = renderCellGuideGridContextSection(input.gridContext);
    if (gridSection) prompt += gridSection;
  }

  // D→B단계: 역량 분석 맥락 (Phase 1-3 결과 주입)
  if (input.analysisContext) {
    const { qualityIssues, weakCompetencies, warningPatterns } = input.analysisContext;
    // 행특 관련 이슈 우선 (없으면 창체도 포함)
    const haengteukIssues = qualityIssues.filter(
      (qi) => qi.issues.length > 0 && qi.recordType === "haengteuk",
    );
    const relevantIssues = haengteukIssues.length > 0
      ? haengteukIssues
      : qualityIssues.filter((qi) => qi.issues.length > 0 && qi.recordType === "changche");
    const hasWarnings = warningPatterns && warningPatterns.length > 0;
    const hasIssues = relevantIssues.length > 0;
    // community 역량 약점만 (행특은 community 역량 핵심)
    const communityWeak = weakCompetencies.filter((wc) => wc.item.startsWith("community_"));
    const hasWeakComp = communityWeak.length > 0;

    if (hasWarnings || hasIssues || hasWeakComp) {
      prompt += `## 역량 분석 결과 (이 학생의 구체적 약점)\n\n`;
      prompt += `→ 아래 약점을 보완하는 행특 방향을 제안하세요. 심각도가 높을수록 우선적으로 대응하세요.\n\n`;

      // E1: 경고 패턴 (severity + suggestion 포함)
      if (hasWarnings) {
        prompt += `### 감지된 경고 패턴\n`;
        for (const wp of warningPatterns) {
          prompt += `- **[${wp.severity.toUpperCase()}]** ${wp.title}\n`;
          prompt += `  → ${wp.suggestion}\n`;
        }
        prompt += "\n";
      }

      if (hasIssues) {
        // 경고 패턴에 매칭되지 않은 일반 이슈만 표시
        const warningCodes = new Set((warningPatterns ?? []).map((wp) => wp.code));
        const remainingIssues = [...new Set(relevantIssues.flatMap((qi) => qi.issues))]
          .filter((i) => !warningCodes.has(i));
        if (remainingIssues.length > 0) {
          prompt += `### 기타 품질 이슈\n`;
          prompt += remainingIssues.map((i) => `- ${i}`).join("\n") + "\n\n";
        }

        const feedbacks = relevantIssues.filter((qi) => qi.feedback).slice(0, 2);
        if (feedbacks.length > 0) {
          prompt += `### 품질 피드백\n`;
          for (const qi of feedbacks) {
            const label = qi.recordType === "haengteuk" ? "행특" : "창체";
            prompt += `- [${label}] ${qi.feedback}\n`;
          }
          prompt += "\n";
        }
      }

      if (hasWeakComp) {
        prompt += `### 약점 역량 (B- 이하, community 영역)\n`;
        for (const wc of communityWeak.slice(0, 4)) {
          prompt += `- ${wc.item} ${wc.grade}`;
          if (wc.reasoning) prompt += ` — ${wc.reasoning.slice(0, 120)}`;
          prompt += "\n";
        }
        prompt += "\n";
      }
    }
  }

  // H1 / L3-A: 학년 관통 테마 (과목 교차 dominant)
  {
    const themesSection = renderCrossSubjectThemesSection(input.analysisContext?.crossSubjectThemes);
    if (themesSection) prompt += themesSection;
  }

  // L4-E / Phase 2-1: 보강 우선순위 + 설계 모드 레코드 우선순위
  {
    const narrativeSection = renderNarrativeContextSection(input.analysisContext?.narrativeContext);
    if (narrativeSection) prompt += narrativeSection;
  }

  // 창체 방향 컨텍스트
  if (input.changcheGuideContext) {
    prompt += `## 창체 방향 컨텍스트\n\n${input.changcheGuideContext}\n\n`;
  }

  // Impl-4: 이전 분석 학년의 보완방향 참조
  if (input.crossGradeDirections) {
    prompt += `## 이전 학년 보완방향 (분석 결과 기반)\n\n`;
    prompt += `→ 아래 보완방향을 이어받아 설계방향에 반영하세요.\n\n`;
    prompt += `${input.crossGradeDirections}\n\n`;
  }

  // 학년별 기록
  const CONTENT_LIMIT = 600;

  for (const grade of input.targetGrades) {
    const data = input.recordDataByGrade[grade];
    if (!data) continue;

    prompt += `## ${grade}학년 기록\n\n`;

    if (data.haengteuk?.content) {
      const truncated = data.haengteuk.content.slice(0, CONTENT_LIMIT);
      prompt += `### 행동특성 및 종합의견\n${truncated}${data.haengteuk.content.length > CONTENT_LIMIT ? "..." : ""}\n\n`;
    }

    if (data.changche.length > 0) {
      prompt += `### 창의적 체험활동\n`;
      for (const c of data.changche) {
        const typeLabel = CHANGCHE_TYPE_LABELS[c.activity_type] ?? c.activity_type;
        const truncated = c.content.slice(0, 300);
        prompt += `- **[${typeLabel}]**: ${truncated}${c.content.length > 300 ? "..." : ""}\n`;
      }
      prompt += "\n";
    }

    if (data.seteks.length > 0) {
      prompt += `### 교과 세특 (참고용)\n`;
      for (const s of data.seteks.slice(0, 4)) {
        const truncated = s.content.slice(0, 200);
        prompt += `- **${s.subject_name}**: ${truncated}${s.content.length > 200 ? "..." : ""}\n`;
      }
      prompt += "\n";
    }
  }

  prompt += `위 기록과 진단 결과를 바탕으로 행특 방향 가이드를 JSON으로 작성해주세요. 7개 평가항목 모두 반드시 포함해야 합니다.`;

  return prompt;
}

// ============================================
// 응답 파서
// ============================================

export function parseResponse(content: string): HaengteukGuideResult {
  const parsed = extractJson(content);

  const g = parsed.guide ?? {};

  const evaluationItems = Array.isArray(g.evaluationItems)
    ? g.evaluationItems
        .filter(
          (e: unknown) =>
            typeof (e as Record<string, unknown>)?.item === "string" &&
            typeof (e as Record<string, unknown>)?.score === "string",
        )
        .map((e: Record<string, unknown>) => ({
          item: String(e.item),
          score: String(e.score),
          reasoning: typeof e.reasoning === "string" ? e.reasoning : "",
        }))
    : undefined;

  const guide: HaengteukGuideItem = {
    keywords: Array.isArray(g.keywords)
      ? g.keywords.filter((k: unknown) => typeof k === "string")
      : [],
    competencyFocus: Array.isArray(g.competencyFocus)
      ? g.competencyFocus.filter((c: unknown) => typeof c === "string")
      : [],
    direction: typeof g.direction === "string" ? g.direction : "",
    cautions: typeof g.cautions === "string" ? g.cautions : "",
    teacherPoints: Array.isArray(g.teacherPoints)
      ? g.teacherPoints.filter((t: unknown) => typeof t === "string")
      : [],
    evaluationItems,
  };

  return {
    title: String(parsed.title ?? "행특 방향 가이드"),
    guide,
    overallDirection: String(parsed.overallDirection ?? ""),
  };
}
