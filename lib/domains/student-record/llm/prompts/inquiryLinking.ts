// ============================================
// 학년간 후속탐구 연결 감지 프롬프트
// Phase 6.3 — 전 학년 세특에서 탐구 주제 연결 자동 감지
// ============================================

import { extractJson } from "../extractJson";

export type RecordSummary = {
  index: number;
  id: string;
  grade: number;
  subject: string;
  type: string;
  content: string;
};

export interface InquiryConnection {
  fromIndex: number;
  toIndex: number;
  linkType: "sequential" | "parallel" | "retrospective";
  theme: string;
  reasoning: string;
}

export interface SuggestedStoryline {
  title: string;
  keywords: string[];
  connectionIndices: number[];
  narrative: string;
  careerField: string;
  grade1Theme: string;
  grade2Theme: string;
  grade3Theme: string;
}

export interface InquiryLinkResult {
  connections: InquiryConnection[];
  suggestedStorylines: SuggestedStoryline[];
}

const LINK_TYPE_DESC = `
- "sequential": 순차 심화 — 이전 학년의 탐구 주제가 다음 학년에서 더 깊이 발전 (예: 1학년 연립방정식 → 2학년 푸리에변환)
- "parallel": 병렬 확장 — 같은 학년 또는 다른 학년에서 동일 주제를 다른 교과 관점으로 탐구 (예: 수학 의료영상 ↔ 화학 방사선)
- "retrospective": 회고적 연결 — 후속 활동이 이전 탐구를 종합하거나 재조명 (예: 3학년 진로 세특에서 1~2학년 활동 언급)`;

export const INQUIRY_LINK_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다. 학생의 전 학년 생기부 기록을 분석하여 **학년간 탐구 주제의 연결관계**를 감지합니다.

## 연결 유형
${LINK_TYPE_DESC}

## 분석 규칙

1. **핵심 주제 기반**: 단순히 같은 과목이라서가 아니라, 탐구 주제·키워드가 실제로 연결될 때만 감지합니다.
2. **구체적 근거**: 어떤 키워드/활동이 연결되는지 명확히 서술합니다.
3. **스토리라인 제안**: 연결된 탐구들을 묶어 스토리라인(성장 서사)을 제안합니다. 각 스토리라인에는 **서사(narrative)**, **진로 분야**, **학년별 테마**를 반드시 포함합니다.
4. **연결이 없으면 빈 배열**: 억지로 연결하지 않습니다.
5. **JSON 형식으로만 응답합니다.**

## JSON 출력 형식

\`\`\`json
{
  "connections": [
    {
      "fromIndex": 0,
      "toIndex": 3,
      "linkType": "sequential",
      "theme": "의료영상의 수학적 원리",
      "reasoning": "1학년 연립방정식→CT 탐구가 2학년 푸리에변환으로 심화됨"
    }
  ],
  "suggestedStorylines": [
    {
      "title": "의료영상·방사선 탐구",
      "keywords": ["CT", "푸리에변환", "방사선"],
      "connectionIndices": [0],
      "narrative": "1학년 수학에서 연립방정식을 CT 스캐닝에 적용하며 의료영상에 관심을 가졌고, 2학년 물리에서 방사선의 원리를 탐구하며 진단기기의 과학적 기반을 이해했다. 3학년에서는 AI 기반 의료영상 분석으로 확장하여 공학적 문제 해결 역량을 보여주었다.",
      "careerField": "의공학·바이오메디컬",
      "grade1Theme": "수학적 원리 발견",
      "grade2Theme": "물리·방사선 심화 탐구",
      "grade3Theme": "AI 의료영상 응용"
    }
  ]
}
\`\`\`

## 스토리라인 필드 설명
- **narrative**: 학생의 3년간 성장 과정을 2~4문장으로 서술. 학년 간 연결과 심화 과정을 포함.
- **careerField**: 해당 스토리라인이 가리키는 진로/전공 분야 (예: "법·행정", "의공학·바이오메디컬")
- **grade1Theme**: 1학년 핵심 테마 (관심·발견 단계). 해당 학년 기록이 없으면 빈 문자열.
- **grade2Theme**: 2학년 핵심 테마 (탐구·심화 단계). 해당 학년 기록이 없으면 빈 문자열.
- **grade3Theme**: 3학년 핵심 테마 (주도·실천 단계). 해당 학년 기록이 없으면 빈 문자열.`;

export function buildInquiryLinkUserPrompt(records: RecordSummary[]): string {
  const recordList = records
    .map((r) => `[${r.index}] ${r.grade}학년 ${r.subject} (${r.type}): ${r.content.length > 200 ? r.content.slice(0, 200) + "..." : r.content}`)
    .join("\n\n");

  return `## 분석 대상 학생의 전 학년 생기부 기록 (${records.length}건)

${recordList}

위 기록들에서 학년간 탐구 주제의 연결관계를 감지하고, 스토리라인을 제안해주세요.
연결이 있는 경우에만 응답하며, 억지 연결은 하지 마세요.`;
}

// ─── 파서 ──────────────────────────────────

const VALID_LINK_TYPES = new Set(["sequential", "parallel", "retrospective"]);

export function parseInquiryLinkResponse(content: string, maxIndex: number): InquiryLinkResult {
  const parsed = extractJson(content);

  const connections: InquiryConnection[] = (parsed.connections ?? [])
    .filter((c: Record<string, unknown>) =>
      typeof c.fromIndex === "number" &&
      typeof c.toIndex === "number" &&
      c.fromIndex >= 0 && c.fromIndex <= maxIndex &&
      c.toIndex >= 0 && c.toIndex <= maxIndex &&
      c.fromIndex !== c.toIndex &&
      VALID_LINK_TYPES.has(c.linkType as string),
    )
    .map((c: Record<string, unknown>) => ({
      fromIndex: c.fromIndex as number,
      toIndex: c.toIndex as number,
      linkType: c.linkType as InquiryConnection["linkType"],
      theme: String(c.theme ?? ""),
      reasoning: String(c.reasoning ?? ""),
    }));

  const suggestedStorylines: SuggestedStoryline[] = (parsed.suggestedStorylines ?? [])
    .filter((s: Record<string, unknown>) =>
      typeof s.title === "string" && s.title.length > 0,
    )
    .map((s: Record<string, unknown>) => ({
      title: String(s.title),
      keywords: Array.isArray(s.keywords) ? (s.keywords as unknown[]).map(String) : [],
      connectionIndices: Array.isArray(s.connectionIndices)
        ? (s.connectionIndices as unknown[]).filter((i): i is number => typeof i === "number")
        : [],
      narrative: String(s.narrative ?? ""),
      careerField: String(s.careerField ?? ""),
      grade1Theme: String(s.grade1Theme ?? ""),
      grade2Theme: String(s.grade2Theme ?? ""),
      grade3Theme: String(s.grade3Theme ?? ""),
    }));

  return { connections, suggestedStorylines };
}
