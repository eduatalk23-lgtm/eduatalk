// ============================================
// α4 Proposal → 로드맵 자동 생성 (2026-04-20)
//
// 컨설턴트가 proposal_items 의 특정 item 을 "수락" 하면
// student_record_roadmap_items 에 row 를 자동 생성한다.
//
// 이 모듈은 순수 함수만 제공. I/O·DB 없음.
//   - mapHorizonToWhen: horizon + stateAsOf → (schoolYear, grade, semester)
//   - normalizeRoadmapArea: LLM 이 잘못된 문자열을 반환해도 안전한 폴백
//   - buildRoadmapInsertFromProposal: ProposalItem + 컨텍스트 → roadmap_items Insert shape
//
// 호출자: actions/proposal-accept.ts (server action)
// ============================================

import type { RoadmapArea } from "../types/enums";
import type { ProposalItem, ProposalHorizon } from "../types/proposal";
import type { StudentStateAsOf } from "../types/student-state";

// ─── 1. horizon → (schoolYear, grade, semester) ───────────────

export interface RoadmapWhen {
  readonly schoolYear: number;
  readonly grade: 1 | 2 | 3;
  readonly semester: 1 | 2;
}

/**
 * horizon 별 매핑:
 *   immediate / this_semester → asOf 동일
 *   next_semester → semester 1→2 (같은 학년도/학년) · 2→다음 학년도 다음 학년 1학기
 *   long_term → 다음 학년도 · grade+1 · 1학기 (고3 은 그대로)
 *
 * grade 는 1~3 로 clamp (고등학교 3년 범위).
 */
export function mapHorizonToWhen(
  horizon: ProposalHorizon,
  asOf: StudentStateAsOf,
): RoadmapWhen {
  const clampGrade = (g: number): 1 | 2 | 3 =>
    g <= 1 ? 1 : g >= 3 ? 3 : (g as 1 | 2 | 3);

  switch (horizon) {
    case "immediate":
    case "this_semester":
      return {
        schoolYear: asOf.schoolYear,
        grade: asOf.grade,
        semester: asOf.semester,
      };
    case "next_semester":
      if (asOf.semester === 1) {
        return {
          schoolYear: asOf.schoolYear,
          grade: asOf.grade,
          semester: 2,
        };
      }
      return {
        schoolYear: asOf.schoolYear + 1,
        grade: clampGrade(asOf.grade + 1),
        semester: 1,
      };
    case "long_term":
      return {
        schoolYear: asOf.schoolYear + 1,
        grade: clampGrade(asOf.grade + 1),
        semester: 1,
      };
  }
}

// ─── 2. roadmap_area 정규화 ────────────────────────────────────

const VALID_ROADMAP_AREAS: readonly RoadmapArea[] = [
  "autonomy",
  "club",
  "career",
  "setek",
  "personal_setek",
  "reading",
  "course_selection",
  "competition",
  "external",
  "volunteer",
  "general",
] as const;

/**
 * 로드맵 area 정규화. 알려진 값이면 그대로, 아니면 'general' 폴백.
 *
 * proposal_items.roadmap_area 는 DB 레벨 CHECK 가 없어 LLM 실수가 잠재할 수 있음.
 * `haengteuk` 처럼 roadmap 에 대응 area 가 없는 값도 'general' 로 흡수.
 */
export function normalizeRoadmapArea(raw: string | null | undefined): RoadmapArea {
  if (!raw) return "general";
  const v = raw.toLowerCase();
  return (VALID_ROADMAP_AREAS as readonly string[]).includes(v)
    ? (v as RoadmapArea)
    : "general";
}

// ─── 3. plan_content 빌더 ──────────────────────────────────────

/** name + summary + rationale + prerequisite + risks 를 읽기 쉬운 plan_content 로 직렬화. */
export function buildPlanContent(item: ProposalItem): string {
  const lines: string[] = [];
  lines.push(item.name);
  lines.push("");
  lines.push(item.summary);
  if (item.rationale.trim()) {
    lines.push("");
    lines.push("[근거]");
    lines.push(item.rationale);
  }
  if (item.prerequisite.length > 0) {
    lines.push("");
    lines.push("[실행 전 준비]");
    for (const p of item.prerequisite) lines.push(`- ${p}`);
  }
  if (item.risks.length > 0) {
    lines.push("");
    lines.push("[주의]");
    for (const r of item.risks) lines.push(`- ${r}`);
  }
  return lines.join("\n").trim();
}

// ─── 4. Roadmap Insert shape ────────────────────────────────────

export interface BuildRoadmapInsertInput {
  readonly item: ProposalItem;
  readonly tenantId: string;
  readonly studentId: string;
  readonly asOf: StudentStateAsOf;
  readonly sortOrder: number; // 같은 student+year 의 max+1
}

/**
 * DB Insert 에 필요한 shape 를 생성 (순수 함수).
 * 호출자가 await supabase.from("student_record_roadmap_items").insert(...) 에 전달.
 */
export function buildRoadmapInsertFromProposal(
  input: BuildRoadmapInsertInput,
): {
  tenant_id: string;
  student_id: string;
  school_year: number;
  grade: number;
  semester: number | null;
  area: RoadmapArea;
  plan_content: string;
  plan_keywords: string[];
  planned_at: string;
  sort_order: number;
} {
  const when = mapHorizonToWhen(input.item.horizon, input.asOf);
  const area = normalizeRoadmapArea(input.item.roadmapArea);
  const planContent = buildPlanContent(input.item);
  // targetAxes 를 그대로 keyword 로 저장 (영문 코드 — 검색·집계에 일관).
  const keywords = [...input.item.targetAxes];

  return {
    tenant_id: input.tenantId,
    student_id: input.studentId,
    school_year: when.schoolYear,
    grade: when.grade,
    semester: when.semester,
    area,
    plan_content: planContent,
    plan_keywords: keywords,
    planned_at: new Date().toISOString(),
    sort_order: input.sortOrder,
  };
}
