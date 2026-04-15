// ============================================
// Phase 9.2 — AI 활동 요약서 프롬프트
// 학생 관점 1인칭 문체, 7개 섹션 JSON 출력
// ============================================

import type { ActivitySummaryInput, ActivitySummaryResult } from "../types";
import type { ActivitySummarySection } from "@/lib/domains/student-record/types";
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
8. JSON으로만 응답합니다.
9. 이전 학년 요약이 제공된 경우, growth 섹션에서 이전 대비 성장·변화 포인트를 구체적으로 서술합니다. 같은 내용을 반복하지 마세요.

## B8: 시계열 모드별 톤 (mode 입력 참고)

- **mode=analysis**: 모든 활동이 NEIS 확정 기록. 1인칭 회고형("저는 ~ 탐구했습니다").
- **mode=prospective**: 모든 활동이 AI 가안. **"예정된 활동 청사진"으로 서술** — 미래형/계획형 표현 사용("저는 ~ 탐구할 계획입니다", "~ 활동을 통해 ~을 보여줄 예정입니다"). 가안임을 명시적으로 라벨링하지 말되, 톤은 청사진/계획 어조 유지.
- **mode=hybrid**: 학년별로 다름. **이미 수행한 학년은 회고형, 예정 학년은 청사진형**으로 학년 단위 톤 전환. growth 섹션에서 "이미 한 활동 → 앞으로 할 활동" 연속체 서술.

각 학년 데이터에 \`gradeMode\` 필드가 동봉됩니다. 해당 학년의 톤을 \`gradeMode\`에 맞춰 전환하세요.
가안 라벨(\`(가안)\`)이 붙은 항목은 "예정 활동" 또는 "계획 중인 탐구"로 자연스럽게 풀어쓰세요.`;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

const CHANGCHE_TYPE_LABELS: Record<string, string> = {
  autonomy: "자율",
  club: "동아리",
  career: "진로",
};

const MODE_GUIDANCE: Record<ActivitySummaryInput["mode"], string> = {
  analysis: "모든 학년이 NEIS 확정 기록 기반입니다. 회고형 1인칭 톤을 사용하세요.",
  prospective:
    "모든 학년이 AI 가안 기반입니다. **예정된 활동 청사진**으로 서술하세요. 미래형/계획형 표현을 사용하세요.",
  hybrid:
    "학년별 모드(gradeMode)가 다릅니다. 이미 수행한 학년은 회고형으로, 예정 학년은 청사진형으로 학년 단위로 톤을 전환하세요.",
};

export function buildUserPrompt(input: ActivitySummaryInput): string {
  let prompt = `## 학생 정보\n\n`;
  prompt += `- 이름: ${input.studentName}\n`;
  prompt += `- 현재 학년: ${input.grade}학년\n`;
  if (input.targetMajor) prompt += `- 희망 전공 계열: ${input.targetMajor}\n`;
  prompt += `- 대상 학년: ${input.targetGrades.join(", ")}학년\n`;
  prompt += `- 시계열 모드: **${input.mode}** — ${MODE_GUIDANCE[input.mode]}\n\n`;

  // 스토리라인
  if (input.storylines && input.storylines.length > 0) {
    prompt += `## 스토리라인\n\n`;
    for (const s of input.storylines) {
      prompt += `- ${s.title} (키워드: ${s.keywords.join(", ")})\n`;
    }
    prompt += "\n";
  }

  // 영역간 연결 (Phase E2)
  if (input.edgePromptSection) {
    prompt += input.edgePromptSection + "\n";
  }

  // Q3: 이전 학년 요약 (다학년 비교 성장 서술용)
  if (input.previousSummaryText) {
    prompt += `## 이전 학년 활동 요약 (성장 비교 기준)\n\n`;
    prompt += `${input.previousSummaryText.slice(0, 1500)}\n\n`;
    prompt += `위 이전 요약 대비 이번 학년의 성장·변화·심화 포인트를 growth 섹션에 구체적으로 서술해주세요.\n\n`;
  }

  // B8: 설계 산출물 (prospective/hybrid 학년의 활동 청사진 보강)
  if (input.designArtifactsSection) {
    prompt += input.designArtifactsSection + "\n\n";
  }

  // 학년별 데이터
  for (const grade of input.targetGrades) {
    const data = input.recordDataByGrade[grade];
    if (!data) continue;

    const gradeModeLabel: Record<ActivitySummaryInput["mode"], string> = {
      analysis: "확정 기록",
      prospective: "예정 활동(가안)",
      hybrid: "혼재(가안+확정)",
    };
    prompt += `## ${grade}학년 기록 — ${gradeModeLabel[data.gradeMode]}\n\n`;

    // 절삭 한도: 활동 원문을 최대한 보존하여 풍부한 요약 생성
    const CONTENT_LIMIT = 600;
    const draftMark = (isDraft: boolean) => (isDraft ? " (가안)" : "");

    if (data.seteks.length > 0) {
      prompt += `### 교과 세특\n`;
      for (const s of data.seteks) {
        const truncated = s.content.slice(0, CONTENT_LIMIT);
        prompt += `- **${s.subject_name}**${draftMark(s.isDraft)}: ${truncated}${s.content.length > CONTENT_LIMIT ? "..." : ""}\n`;
      }
      prompt += "\n";
    }

    if (data.personalSeteks.length > 0) {
      prompt += `### 개인 세특\n`;
      for (const ps of data.personalSeteks) {
        const truncated = ps.content.slice(0, CONTENT_LIMIT);
        prompt += `- **${ps.title}**${draftMark(ps.isDraft)}: ${truncated}${ps.content.length > CONTENT_LIMIT ? "..." : ""}\n`;
      }
      prompt += "\n";
    }

    if (data.changche.length > 0) {
      prompt += `### 창의적 체험활동\n`;
      for (const c of data.changche) {
        const typeLabel =
          CHANGCHE_TYPE_LABELS[c.activity_type] ?? c.activity_type;
        const truncated = c.content.slice(0, CONTENT_LIMIT);
        prompt += `- **[${typeLabel}]**${draftMark(c.isDraft)}: ${truncated}${c.content.length > CONTENT_LIMIT ? "..." : ""}\n`;
      }
      prompt += "\n";
    }

    if (data.haengteuk?.content) {
      prompt += `### 행동특성 및 종합의견${draftMark(data.haengteuk.isDraft)}\n`;
      prompt += `${data.haengteuk.content.slice(0, 800)}\n\n`;
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
  if (input.mode !== "analysis") {
    prompt += `\n\n**중요**: 가안(\`(가안)\` 표기) 항목은 미래 시제·청사진 톤으로 풀어쓰세요. "~할 계획입니다", "~할 예정입니다" 등.`;
  }
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
