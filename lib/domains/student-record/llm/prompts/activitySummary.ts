// ============================================
// Phase 9.2 — AI 활동 요약서 프롬프트
// 학생 관점 1인칭 문체, 7개 섹션 JSON 출력
// ============================================

import type { ActivitySummaryInput, ActivitySummaryResult } from "../types";
import type { ActivitySummarySection } from "../../types";
import { extractJson } from "../extractJson";

// ============================================
// 시스템 프롬프트
// ============================================

export const SYSTEM_PROMPT = `당신은 학생의 고등학교 활동을 정리하는 도우미입니다.

## 문서 성격

이 문서는 "학생 활동 요약서"입니다.
- 학생이 담임교사에게 제출하여 생기부(생활기록부) 작성 시 참고할 수 있는 정리본입니다.
- 학생 관점 1인칭("저는 ~ 탐구했습니다", "~ 활동에 참여하면서")으로 작성합니다.
- NEIS 세특 양식(~하였음, ~을 보임, ~가 돋보임)으로 작성하지 마세요.
- 사실에 기반하여 작성하되, 학생의 성장과 노력을 자연스럽게 드러내세요.

## 출력 형식 — JSON

\`\`\`json
{
  "title": "2026학년도 활동 요약서",
  "sections": [
    {
      "sectionType": "intro",
      "title": "소개",
      "content": "전체적인 학업 방향과 관심사 소개 (3-4문장)"
    },
    {
      "sectionType": "subject_setek",
      "title": "교과 학습 활동",
      "content": "교과별 주요 탐구·학습 활동 요약",
      "relatedSubjects": ["과목1", "과목2"]
    },
    {
      "sectionType": "personal_setek",
      "title": "개인 탐구 활동",
      "content": "개인 세특(학교자율과정) 활동 요약"
    },
    {
      "sectionType": "changche",
      "title": "창의적 체험활동",
      "content": "자율활동/동아리/진로활동 요약"
    },
    {
      "sectionType": "reading",
      "title": "독서 활동",
      "content": "읽은 도서 목록과 인상적인 독서 경험"
    },
    {
      "sectionType": "haengteuk",
      "title": "학교생활 및 인성",
      "content": "학교생활 태도와 인성적 성장"
    },
    {
      "sectionType": "growth",
      "title": "종합 성장 요약",
      "content": "고교 생활 전체의 학업·활동 성장 서사 (진로 일관성 중심)"
    }
  ]
}
\`\`\`

## 규칙

1. 입력된 세특/창체/행특/독서 데이터에 있는 내용만 기반으로 작성합니다. 없는 활동을 만들어내지 마세요.
2. 각 섹션은 학년 순서로 활동을 나열하되, 성장 과정이 드러나도록 서술합니다.
3. subject_setek 섹션: 과목별로 구분하여 주요 활동을 요약합니다. relatedSubjects에 과목명을 포함합니다.
4. changche 섹션: 자율/동아리/진로 유형별로 구분합니다.
5. growth 섹션: 스토리라인(있는 경우)을 자연스럽게 녹여 진로 일관성을 보여줍니다.
6. 데이터가 없는 섹션은 생략합니다 (sections 배열에서 제외).
7. 전체 분량: 각 섹션 200-500자, 총 2000-4000자 내외.
8. JSON으로만 응답합니다.`;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

const CHANGCHE_TYPE_LABELS: Record<string, string> = {
  autonomy: "자율",
  club: "동아리",
  career: "진로",
};

export function buildUserPrompt(input: ActivitySummaryInput): string {
  let prompt = `## 학생 정보\n\n`;
  prompt += `- 이름: ${input.studentName}\n`;
  prompt += `- 현재 학년: ${input.grade}학년\n`;
  if (input.targetMajor) prompt += `- 희망 전공 계열: ${input.targetMajor}\n`;
  prompt += `- 대상 학년: ${input.targetGrades.join(", ")}학년\n\n`;

  // 스토리라인
  if (input.storylines && input.storylines.length > 0) {
    prompt += `## 스토리라인\n\n`;
    for (const s of input.storylines) {
      prompt += `- ${s.title} (키워드: ${s.keywords.join(", ")})\n`;
    }
    prompt += "\n";
  }

  // 학년별 데이터
  for (const grade of input.targetGrades) {
    const data = input.recordDataByGrade[grade];
    if (!data) continue;

    prompt += `## ${grade}학년 기록\n\n`;

    if (data.seteks.length > 0) {
      prompt += `### 교과 세특\n`;
      for (const s of data.seteks) {
        const truncated = s.content.slice(0, 300);
        prompt += `- **${s.subject_name}**: ${truncated}${s.content.length > 300 ? "..." : ""}\n`;
      }
      prompt += "\n";
    }

    if (data.personalSeteks.length > 0) {
      prompt += `### 개인 세특\n`;
      for (const ps of data.personalSeteks) {
        const truncated = ps.content.slice(0, 300);
        prompt += `- **${ps.title}**: ${truncated}${ps.content.length > 300 ? "..." : ""}\n`;
      }
      prompt += "\n";
    }

    if (data.changche.length > 0) {
      prompt += `### 창의적 체험활동\n`;
      for (const c of data.changche) {
        const typeLabel =
          CHANGCHE_TYPE_LABELS[c.activity_type] ?? c.activity_type;
        const truncated = c.content.slice(0, 300);
        prompt += `- **[${typeLabel}]**: ${truncated}${c.content.length > 300 ? "..." : ""}\n`;
      }
      prompt += "\n";
    }

    if (data.haengteuk?.content) {
      prompt += `### 행동특성 및 종합의견\n`;
      prompt += `${data.haengteuk.content.slice(0, 500)}\n\n`;
    }

    if (data.readings.length > 0) {
      prompt += `### 독서\n`;
      for (const r of data.readings) {
        prompt += `- ${r.book_title}${r.book_author ? ` (${r.book_author})` : ""}\n`;
      }
      prompt += "\n";
    }
  }

  prompt += `위 기록을 바탕으로 학생 관점의 활동 요약서를 JSON으로 작성해주세요.`;
  return prompt;
}

// ============================================
// 응답 파서
// ============================================

const VALID_SECTION_TYPES = new Set([
  "intro",
  "subject_setek",
  "personal_setek",
  "changche",
  "haengteuk",
  "reading",
  "growth",
]);

export function parseResponse(content: string): ActivitySummaryResult {
  const parsed = extractJson(content);

  const sections: ActivitySummarySection[] = [];
  for (const s of parsed.sections ?? []) {
    if (!VALID_SECTION_TYPES.has(s.sectionType)) continue;
    if (!s.content || typeof s.content !== "string") continue;

    sections.push({
      sectionType: s.sectionType,
      title: String(s.title ?? ""),
      content: s.content,
      ...(Array.isArray(s.relatedSubjects)
        ? { relatedSubjects: s.relatedSubjects }
        : {}),
    });
  }

  const fullText = sections.map((s) => `[${s.title}]\n${s.content}`).join("\n\n");

  return {
    title: String(parsed.title ?? "활동 요약서"),
    sections,
    fullText,
  };
}
