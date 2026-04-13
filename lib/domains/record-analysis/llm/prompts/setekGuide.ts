// ============================================
// Phase 9.3 — 세특 방향 가이드 프롬프트
// 컨설턴트 내부용, 과목별 키워드+방향+교사포인트 JSON
// ============================================

import type { SetekGuideInput, SetekGuideResult } from "../types";
import type { SetekGuideItem } from "@/lib/domains/student-record/types";
import { extractJson } from "../extractJson";
import { renderCrossSubjectThemesSection } from "./crossSubjectThemes";
import { renderNarrativeContextSection } from "./narrativeContext";
import {
  formatSetekFlowArrow,
  CAREER_DIFFERENTIAL,
  formatGradeDiffTable,
  CAREER_SUBJECT_MIN_STAGES,
  CAREER_SUBJECT_ACHIEVEMENT_MAP,
  formatBannedExpressions,
  formatScientificCautions,
} from "@/lib/domains/student-record/evaluation-criteria/defaults";

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

## 모드

입력에 "모드" 필드가 있습니다:
- "retrospective" (기본): 기존 세특 기록을 분석하여 방향을 제안합니다.
- "prospective": 기록이 없는 계획 과목에 대해 미래 세특 작성 방향을 제안합니다.

## 좋은 세특의 8단계 흐름 (방향 제안 시 반드시 고려)

direction 작성 시 아래 흐름이 자연스럽게 달성되는 방향을 제안하세요:
${formatSetekFlowArrow()} (8단계 오류→재탐구 있으면 큰 가산)

## 진로교과 vs 비진로교과 차등 기준

- **진로(계열) 관련 교과**: 8단계 흐름 중 최소 ${CAREER_SUBJECT_MIN_STAGES.map((s) => `${"①②③④⑤⑥⑦⑧"[s - 1]}`).join("")}를 충족하는 방향 제안. ${CAREER_DIFFERENTIAL.careerNote}
  - **SKY카+ 상위권**: 최소 ①②③④⑤(참고문헌 포함 5단계) 충족 필수. 가능한 모든 진로 관련 교과에서 진로 연결.
  - **서울 15대학 이하**: ①②③⑤(4단계)로 충분. 진로 연결 3~4과목 권장.
- **비진로교과(국어/체육/음악 등)**: ${CAREER_DIFFERENTIAL.nonCareerNote}
  - **국어-문학**: 독자적 해석, 작품 간 비교(심경변화·상황 종합), 현대사회 기준 재해석, 함축적 의미 창의적 해석, 비판적 사고
  - **국어-독서/작문**: 자료해석능력, 독해능력, 비판적 사고, 논리추론능력
  - **국어-화법/언어**: 품사·문장 구조 활용, 담화 구성, 공적 의사소통(토의·토론·연설·협상)
  - **영어**: 독해(세부정보·요지·추론·어휘구문) + 읽기·쓰기·듣기·말하기 종합
  - ⑧ 오류→재탐구는 비진로교과에서 필수 아니나, 있으면 학업역량에서 좋은 평가
- **주의**: ${CAREER_DIFFERENTIAL.overloadWarning}

## 내신 등급별 탐구 난이도 차등 (필수)

학생의 해당 교과 내신 등급에 따라 탐구 주제/방향의 난이도를 차등 조절하세요.
**9등급제(2015 개정)와 5등급제(2022 개정)** 모두 동일 기준 적용:

${formatGradeDiffTable()}

- **진로선택 과목(성취도 A/B/C)**: ${Object.entries(CAREER_SUBJECT_ACHIEVEMENT_MAP).map(([k, v]) => `${k}=${v}`).join(", ")}으로 적용.
- **학년별 심화 허용**: 2~3학년으로 올라갈수록 진로교과 선택이 늘어나므로 내용이 조금씩 심화되어도 정상. 단, 고교 수준에서 이해·설명할 수 있는 범위 내.
- **주의**: 내신 하위권인데 대학원급 심화 탐구를 제안하면 대리작성 의심(P4 패턴). 학생 수준에 맞는 현실적 방향을 제안하세요.

## 규칙 (공통)

1. competencyFocus는 다음 중에서 선택합니다:
   - academic_achievement, academic_attitude, academic_inquiry
   - career_course_effort, career_course_achievement, career_exploration
   - community_collaboration, community_caring, community_integrity, community_leadership
2. direction은 구체적인 서술 방향을 제시합니다. "~를 강조", "~와 연결" 등 실행 가능한 지시.
3. cautions에는 세특 작성 시 피해야 할 점을 명시합니다. 아래 유형을 포함하세요:
   - 형식적 문제: "단순 나열 지양", "활동 근거 없는 추상적 서술 주의", "상투적 복붙 표현 금지"
   - 내용 오류 (F1~F6): ${formatScientificCautions()}
   - 교사 관찰: "교사가 관찰 불가능한 표현(${formatBannedExpressions()}) 사용 금지"
   - 인문·사회계열 교과: 사회문제 연구방법(문제정의→질문설정→연구설계→자료수집→자료분석→결론·제언)의 논리적 전개가 드러나도록 방향 제시. 양적연구(질문지법, 통계분석)와 질적연구(면접법, 참여관찰법, 문헌연구법) 중 적합한 접근을 안내.
4. teacherPoints는 담임/교과 교사에게 전달할 핵심 메시지 2-3개입니다.
5. 스토리라인이 있으면 해당 키워드와 자연스럽게 연결합니다.
6. 역량 진단 결과가 있으면 약한 역량을 보완할 수 있는 방향도 포함합니다.
7. 학생의 목표 학과 분류(소분류)가 있으면, 해당 전공 분야에 특화된 세특 방향을 제시합니다.
8. JSON으로만 응답합니다.

## 규칙 (retrospective 전용 — 현재 기록 평가)

9. 입력된 세특/창체 데이터에 있는 활동만 기반으로 작성합니다. 없는 활동을 만들어내지 마세요.
10. 과목별로 5-7개의 핵심 키워드를 기존 기록에서 추출합니다.
11. 세특 데이터가 있는 과목만 가이드를 생성합니다. 데이터 없는 과목은 생략합니다.
12. **관용적 평가 원칙**: 학생부는 선생님마다 기재 스타일이 다름. 탐구 폭과 방향이 맞으면 인정. "~임을 설명함" 종결도 앞 맥락에서 수행 추론 가능하면 면접 검증 포인트로 분류하되, 현재 기록 자체는 긍정적으로 해석.

## 규칙 (prospective 전용 — 다음 학기 방향 설계)

13. **엄격한 8단계 이상향 적용**: 각 탐구의 결론·방법론이 구체적이도록 가이드. 상위권 대학일수록 깊이(결론·방법론) 중시.
14. 계획 과목 목록을 기반으로, 해당 과목에서 수행할 수 있는 탐구 주제와 방향을 제안합니다.
15. keywords는 해당 과목에서 세특에 녹일 수 있는 탐구적 키워드 5-7개를 제안합니다 (추출이 아닌 제안).
16. 배정된 탐구 가이드가 있으면, 해당 가이드의 주제를 키워드와 방향에 반영합니다.
17. 목표 전공과 연결되는 교차 과목 탐구 방향도 포함합니다.
18. 계획 과목 전체에 대해 가이드를 생성합니다.`;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

const CHANGCHE_TYPE_LABELS: Record<string, string> = {
  autonomy: "자율",
  club: "동아리",
  career: "진로",
};

export function buildUserPrompt(input: SetekGuideInput): string {
  const mode = input.mode ?? "retrospective";

  let prompt = `## 학생 정보\n\n`;
  prompt += `- 이름: ${input.studentName}\n`;
  prompt += `- 현재 학년: ${input.grade}학년\n`;
  prompt += `- 모드: ${mode}\n`;
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

  // 역량 진단 (retrospective)
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

  // D→B단계: 역량 분석 맥락 (Phase 1-3 결과 주입)
  if (input.analysisContext) {
    const { qualityIssues, weakCompetencies, warningPatterns } = input.analysisContext;
    const hasWarnings = warningPatterns && warningPatterns.length > 0;
    const hasIssues = qualityIssues.some((qi) => qi.issues.length > 0);
    const hasWeakComp = weakCompetencies.length > 0;

    if (hasWarnings || hasIssues || hasWeakComp) {
      prompt += `## 역량 분석 결과 (이 학생의 구체적 약점)\n\n`;
      prompt += `→ 아래 약점을 보완하는 방향으로 가이드를 작성하세요. 심각도가 높을수록 우선적으로 대응하세요.\n\n`;

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
        const remainingIssues = [...new Set(qualityIssues.flatMap((qi) => qi.issues))]
          .filter((i) => !warningCodes.has(i));
        if (remainingIssues.length > 0) {
          prompt += `### 기타 품질 이슈\n`;
          prompt += remainingIssues.map((i) => `- ${i}`).join("\n") + "\n\n";
        }

        // issues가 있는 레코드 중 feedback 있는 것만 최대 3개
        const feedbacks = qualityIssues
          .filter((qi) => qi.issues.length > 0 && qi.feedback)
          .slice(0, 3);
        if (feedbacks.length > 0) {
          prompt += `### 품질 피드백\n`;
          for (const qi of feedbacks) {
            const label = qi.recordType === "setek" ? "세특" : qi.recordType === "changche" ? "창체" : "행특";
            prompt += `- [${label}] ${qi.feedback}\n`;
          }
          prompt += "\n";
        }
      }

      if (hasWeakComp) {
        prompt += `### 약점 역량 (B- 이하)\n`;
        for (const wc of weakCompetencies.slice(0, 5)) {
          prompt += `- ${wc.item} ${wc.grade}`;
          if (wc.reasoning) prompt += ` — ${wc.reasoning.slice(0, 120)}`;
          prompt += "\n";
        }
        prompt += "\n";
      }
    }
  }

  // H1 / L3-A: 학년 관통 테마 (과목 교차 dominant)
  // analysisContext 블록 외부에서 주입 — analysisContext가 비어도 themes만 있으면 표시
  {
    const themesSection = renderCrossSubjectThemesSection(input.analysisContext?.crossSubjectThemes);
    if (themesSection) prompt += themesSection;
  }

  // L4-E / Phase 2-1: 보강 우선순위(severity 통합) + 설계 모드 레코드 우선순위
  {
    const narrativeSection = renderNarrativeContextSection(input.analysisContext?.narrativeContext);
    if (narrativeSection) prompt += narrativeSection;
  }

  // 가이드 배정 (Phase R2, prospective 특히 유용)
  if (input.guideAssignments) {
    prompt += `${input.guideAssignments}\n\n`;
  }

  // Impl-4: 이전 분석 학년의 보완방향 참조
  if (input.crossGradeDirections) {
    prompt += `## 이전 학년 보완방향 (분석 결과 기반)\n\n`;
    prompt += `→ 아래 보완방향을 이어받아 설계방향에 반영하세요.\n\n`;
    prompt += `${input.crossGradeDirections}\n\n`;
  }

  if (mode === "prospective") {
    // prospective: 계획 과목 기반
    if (input.plannedSubjects && input.plannedSubjects.length > 0) {
      prompt += `## 계획 과목 (세특 미작성, 방향 제안 필요)\n\n`;
      const grouped = new Map<number, typeof input.plannedSubjects>();
      for (const ps of input.plannedSubjects) {
        if (!grouped.has(ps.grade)) grouped.set(ps.grade, []);
        grouped.get(ps.grade)!.push(ps);
      }
      for (const [grade, subjects] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
        prompt += `### ${grade}학년\n`;
        for (const s of subjects) {
          const typeLabel = s.subjectType ? ` (${s.subjectType})` : "";
          prompt += `- ${s.subjectName}${typeLabel} — ${s.semester}학기\n`;
        }
        prompt += "\n";
      }
    }
    prompt += `위 계획 과목에 대해 미래 세특 작성 방향을 JSON으로 제안해주세요. 각 과목에서 어떤 탐구 주제를 다루면 좋을지, 어떤 키워드를 세특에 녹이면 좋을지 구체적으로 제시해주세요.`;
  } else {
    // retrospective: 기존 기록 분석
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
  }

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
