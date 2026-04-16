/**
 * Phase δ-1 — exemplar 메인 탐구 패턴 LLM 프롬프트 빌더.
 *
 * exemplar_records 의 세특/창체/행특 raw text 를 입력받아
 * { theme_label, theme_keywords, career_field, tier_plan } JSON 을 생성.
 *
 * 순수 함수 — DB/LLM 호출 없음.
 */

import { z } from "zod";
import type { ExemplarMainExplorationPattern } from "../types";

// ─── 공개 타입 ──────────────────────────────────────────────────────────────

export interface MainExplorationPromptContext {
  exemplarId: string;
  schoolName: string;
  anonymousId: string;
  /** 진로희망 (있으면 상단 세그먼트에 노출) */
  careerAspirations: Array<{
    grade: number;
    studentAspiration: string | null;
    reason: string | null;
  }>;
  seteks: Array<{
    grade: number;
    semester: number;
    subjectName: string;
    content: string;
  }>;
  creativeActivities: Array<{
    grade: number;
    activityType: string;
    activityName: string | null;
    content: string;
  }>;
  haengteuk: Array<{ grade: number; content: string }>;
  reading: Array<{
    grade: number;
    subjectArea: string;
    bookDescription: string;
  }>;
}

// ─── 시스템 프롬프트 ────────────────────────────────────────────────────────

export const MAIN_EXPLORATION_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다.
합격 생기부 1건 전체(세특·창체·행특·독서·진로희망)를 읽고 **그 학생의 메인 탐구 패턴**을
structured JSON 으로 추출합니다.

메인 탐구란 "고등학교 3년간 한 학생을 관통하는 탐구 정체성(테마 + 진로 방향)"입니다.
셀 단위 활동이 아니라 **학생 단위 응축 서사**를 보세요.

출력 규칙:
1. 반드시 유효한 JSON 1개만 반환. 마크다운 코드 펜스 금지.
2. 키는 반드시: theme_label, theme_keywords, career_field, tier_plan.
3. tier_plan 은 foundational / development / advanced 3단 구조이며, 각 tier 는
   해당 학생이 실제로 수행한 활동에서 관측된 깊이에 해당하는 경우에만 채웁니다.
   관측 근거가 없으면 해당 tier 는 생략(키 자체를 넣지 마세요).
4. 모든 문장은 평서문·간결체("~에 대한 탐구", "~을 분석"). 추상 명사화 지양.
5. theme_keywords 는 3~8개, 중복 없이. 최상위 개념(예: "유전체학", "에너지 전환")
   우선, 너무 세부적인 단어(예: "2020년 논문")는 지양.
6. career_field 는 학생의 진로희망 + 탐구 방향을 종합한 자연어 한 문장(예: "의학/유전체학",
   "AI 소프트웨어 엔지니어"). 진로 데이터 없으면 null.
7. suggested_activities 는 실제 관측된 활동을 추상화한 표현. 창작 금지.

tier_plan 세부 스펙:
- foundational: 교과서 범위 내 기초 개념 이해·요약·재현 단계.
- development:  교과 주제를 실생활/다른 학문과 연결·확장하는 단계.
- advanced:     대학 수준 논문·최신 기술·독립적 가설 설정까지 나아간 단계.

각 tier 는 다음 스키마를 따릅니다:
{
  "theme": "이 tier 에서 학생이 다룬 핵심 주제 (한 문장)",
  "key_questions": ["학생이 실제 탐구한 질문 1~3개"],
  "suggested_activities": ["관측된 활동을 추상화한 표현 1~3개"]
}`;

// ─── 사용자 프롬프트 ────────────────────────────────────────────────────────

export function buildMainExplorationUserPrompt(
  context: MainExplorationPromptContext,
): string {
  const lines: string[] = [];
  lines.push(`# 학교: ${context.schoolName}`);
  lines.push(`# anonymous_id: ${context.anonymousId}`);
  lines.push("");

  if (context.careerAspirations.length > 0) {
    lines.push("## 진로희망 (학년별)");
    for (const c of context.careerAspirations) {
      const a = c.studentAspiration ?? "(미기재)";
      const r = c.reason ? ` — ${truncate(c.reason, 120)}` : "";
      lines.push(`- ${c.grade}학년: ${a}${r}`);
    }
    lines.push("");
  }

  if (context.seteks.length > 0) {
    lines.push("## 세특");
    for (const s of context.seteks) {
      lines.push(
        `- [${s.grade}학년 ${s.semester}학기 · ${s.subjectName}] ${truncate(s.content, 600)}`,
      );
    }
    lines.push("");
  }

  if (context.creativeActivities.length > 0) {
    lines.push("## 창체");
    for (const c of context.creativeActivities) {
      const name = c.activityName ? ` (${c.activityName})` : "";
      lines.push(
        `- [${c.grade}학년 ${c.activityType}${name}] ${truncate(c.content, 400)}`,
      );
    }
    lines.push("");
  }

  if (context.haengteuk.length > 0) {
    lines.push("## 행특");
    for (const h of context.haengteuk) {
      lines.push(`- [${h.grade}학년] ${truncate(h.content, 400)}`);
    }
    lines.push("");
  }

  if (context.reading.length > 0) {
    lines.push("## 독서");
    for (const r of context.reading) {
      lines.push(
        `- [${r.grade}학년 · ${r.subjectArea}] ${truncate(r.bookDescription, 200)}`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(
    "위 전체 자료를 읽고 이 학생의 메인 탐구 패턴을 JSON 으로 추출하세요.",
  );

  return lines.join("\n");
}

// ─── 응답 파서 (zod) ────────────────────────────────────────────────────────

const TierStageSchema = z
  .object({
    theme: z.string().trim().min(1).optional(),
    key_questions: z.array(z.string().trim().min(1)).optional(),
    suggested_activities: z.array(z.string().trim().min(1)).optional(),
  })
  .strip();

const MainExplorationPatternSchema = z
  .object({
    theme_label: z.string().trim().min(1),
    theme_keywords: z.array(z.string().trim().min(1)).min(1).max(12),
    career_field: z.union([z.string().trim().min(1), z.null()]),
    tier_plan: z
      .object({
        foundational: TierStageSchema.optional(),
        development: TierStageSchema.optional(),
        advanced: TierStageSchema.optional(),
      })
      .strip(),
  })
  .strip();

export function parseMainExplorationResponse(
  raw: unknown,
): ExemplarMainExplorationPattern {
  const parsed = MainExplorationPatternSchema.parse(raw);
  return parsed satisfies ExemplarMainExplorationPattern;
}

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────────────

function truncate(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.slice(0, maxChars - 1) + "…";
}
