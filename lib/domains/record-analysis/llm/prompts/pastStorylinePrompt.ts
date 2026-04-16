// ============================================
// Past Storyline 프롬프트 — NEIS 기반 과거 서사 생성
//
// 4축×3층 통합 아키텍처 A층(Past Analytics). 2026-04-16 D.
// Final Storyline(전체 3년)과 별도로, 이미 확정된 NEIS 학년만을 대상으로
// "현재까지의 탐구 서사"를 생성한다.
//
// 원칙:
//   - 입력: NEIS 레코드(imported_content/confirmed_content)만.
//   - 금지: 3학년 가안(ai_draft_content) 또는 Blueprint 미래 투사 언급.
//   - 톤: 과거 성장 서술. "~다" 또는 "~았다/었다" 체.
// ============================================

import { extractJson } from "../extractJson";
import type { RecordSummary } from "./inquiryLinking";

export interface PastStorylineConnection {
  fromIndex: number;
  toIndex: number;
  linkType: "sequential" | "parallel" | "retrospective";
  theme: string;
  reasoning: string;
}

export interface PastStorylineItem {
  title: string;
  keywords: string[];
  connectionIndices: number[];
  /** 과거 시제 서사 (2~4문장) */
  narrative: string;
  careerField: string;
  /** 해당 학년 NEIS가 없으면 빈 문자열 */
  grade1Theme: string;
  grade2Theme: string;
  grade3Theme: string;
}

export interface PastStorylineResult {
  connections: PastStorylineConnection[];
  storylines: PastStorylineItem[];
}

const LINK_TYPE_DESC = `
- "sequential": 순차 심화 — 이전 학년의 탐구 주제가 다음 학년에서 더 깊이 발전
- "parallel": 병렬 확장 — 같은 학년 내에서 다른 교과 관점으로 확장
- "retrospective": 회고적 연결 — 후속 활동이 이전 탐구를 재조명`;

export const PAST_STORYLINE_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다. 학생의 **지금까지 확정된 생기부(NEIS)** 기록만을 분석하여 과거의 탐구 서사(Past Storyline)를 구성합니다.

## 분석 원칙 (엄수)

1. **NEIS 확정 기록만 입력**: 아직 쓰이지 않은 미래 활동, 가안, 수강 계획, Blueprint 등은 주어지지 않습니다. 출력에 "3학년 계획", "앞으로 ~할 예정" 같은 미래 투사 금지.
2. **과거 시제 서술**: narrative는 반드시 과거·현재완료형("~다/~았다/~었다/~해 왔다") 사용. "~할 것이다"는 금지.
3. **근거 기반**: 실제 기록에 등장한 키워드/주제·활동만 인용. 지어내기 금지.
4. **연결이 없으면 빈 배열**: 단일 학년/단일 기록만 있어도 억지 연결 금지. connections=[], storylines=[]가 허용됩니다.

## 연결 유형
${LINK_TYPE_DESC}

## JSON 출력 형식

\`\`\`json
{
  "connections": [
    {
      "fromIndex": 0,
      "toIndex": 2,
      "linkType": "sequential",
      "theme": "의료영상의 수학적 원리",
      "reasoning": "1학년 연립방정식→CT 탐구가 2학년 푸리에변환으로 심화됨"
    }
  ],
  "storylines": [
    {
      "title": "의료영상·방사선 탐구",
      "keywords": ["CT", "푸리에변환", "방사선"],
      "connectionIndices": [0],
      "narrative": "1학년 수학에서 연립방정식을 CT 스캐닝에 적용하며 의료영상에 관심을 가졌고, 2학년 물리에서 방사선 원리를 탐구하며 진단기기의 과학적 기반을 이해해 왔다.",
      "careerField": "의공학·바이오메디컬",
      "grade1Theme": "수학적 원리 발견",
      "grade2Theme": "물리·방사선 심화",
      "grade3Theme": ""
    }
  ]
}
\`\`\`

## 필드 설명
- **narrative**: 확정된 학년까지의 성장 과정을 2~4문장의 과거 시제로 서술. 미래 예고·추측 금지.
- **careerField**: 이 서사가 가리키는 진로/전공 분야.
- **grade_X_theme**: NEIS 기록이 있는 학년만 채움. 없으면 빈 문자열.`;

function contentLimit(totalRecords: number): number {
  if (totalRecords <= 10) return 800;
  if (totalRecords <= 20) return 600;
  return 500;
}

export function buildPastStorylineUserPrompt(
  records: RecordSummary[],
  neisGrades: number[],
): string {
  const limit = contentLimit(records.length);
  const recordList = records
    .map((r) => {
      const trimmed = r.content.length > limit ? r.content.slice(0, limit) + "..." : r.content;
      return `[${r.index}] ${r.grade}학년 ${r.subject} (${r.type}): ${trimmed}`;
    })
    .join("\n\n");

  const gradesLabel = neisGrades.map((g) => `${g}학년`).join(", ");

  return `## 확정 생기부 기록 (NEIS, ${records.length}건)

분석 대상 학년: **${gradesLabel}** (이후 학년은 아직 확정되지 않음 — 미래 투사 금지)

${recordList}

위 NEIS 확정 기록만을 사용해, 지금까지의 성장 서사(Past Storyline)를 과거 시제로 서술하세요. 연결·서사 모두 "이미 일어난 일"로만 표현합니다. 근거가 약하면 빈 배열을 반환하세요.`;
}

const VALID_LINK_TYPES = new Set(["sequential", "parallel", "retrospective"]);

export function parsePastStorylineResponse(
  content: string,
  maxIndex: number,
): PastStorylineResult {
  const parsed = extractJson(content);

  const connections: PastStorylineConnection[] = (parsed.connections ?? [])
    .filter(
      (c: Record<string, unknown>) =>
        typeof c.fromIndex === "number" &&
        typeof c.toIndex === "number" &&
        c.fromIndex >= 0 &&
        c.fromIndex <= maxIndex &&
        c.toIndex >= 0 &&
        c.toIndex <= maxIndex &&
        c.fromIndex !== c.toIndex &&
        VALID_LINK_TYPES.has(c.linkType as string),
    )
    .map((c: Record<string, unknown>) => ({
      fromIndex: c.fromIndex as number,
      toIndex: c.toIndex as number,
      linkType: c.linkType as PastStorylineConnection["linkType"],
      theme: String(c.theme ?? ""),
      reasoning: String(c.reasoning ?? ""),
    }));

  const storylines: PastStorylineItem[] = (parsed.storylines ?? [])
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

  return { connections, storylines };
}
