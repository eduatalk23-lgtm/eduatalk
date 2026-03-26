import { useMemo } from "react";
import type { RecordTabData } from "@/lib/domains/student-record/types";
import type { RecordArea, AreaSummary, LayerId, PerspectiveId } from "./types";

/** 가이드 배정 (findAssignmentsWithGuides 결과 타입 일부) */
interface GuideAssignment {
  id: string;
  status: string;
  target_subject_id: string | null;
  target_activity_type: string | null;
  ai_recommendation_reason: string | null;
  confirmed_at: string | null;
}

/** activity_tags 행 */
interface ActivityTag {
  record_type: string;
  record_id: string;
  source?: string;
  status?: string;
}

/** setek_guides 행 */
interface SetekGuide {
  subject_id: string;
  source: string;
  status: string;
  direction: string;
  keywords: string[];
}

interface UseAreaSummaryInput {
  areas: RecordArea[];
  layer: LayerId;
  perspective: PerspectiveId;
  recordByGrade: Map<number, { data: RecordTabData }>;
  guideAssignments: GuideAssignment[];
  activityTags: ActivityTag[];
  setekGuides: SetekGuide[];
  /** 배정 ID → 파일 수 (📎결과물 레이어용) */
  deliverableFileCounts?: Record<string, number>;
}

const EMPTY: AreaSummary = { text: "", isEmpty: true };

function charSummary(content: string | null | undefined, limit?: number): AreaSummary {
  if (!content) return { text: "미작성", isEmpty: true };
  const len = content.length;
  return {
    text: limit ? `${len}/${limit}자` : `${len}자`,
    charCount: len,
    charLimit: limit ?? undefined,
    isEmpty: false,
  };
}

/**
 * 각 영역에 대해 선택된 레이어×관점의 요약 데이터를 계산
 */
export function useAreaSummary({
  areas,
  layer,
  perspective,
  recordByGrade,
  guideAssignments,
  activityTags,
  setekGuides,
  deliverableFileCounts,
}: UseAreaSummaryInput): Map<string, AreaSummary> {
  return useMemo(() => {
    const map = new Map<string, AreaSummary>();

    for (const area of areas) {
      const summary = computeSummary(
        area, layer, perspective,
        recordByGrade, guideAssignments, activityTags, setekGuides,
        deliverableFileCounts,
      );
      map.set(area.id, summary);
    }

    return map;
  }, [areas, layer, perspective, recordByGrade, guideAssignments, activityTags, setekGuides, deliverableFileCounts]);
}

function computeSummary(
  area: RecordArea,
  layer: LayerId,
  perspective: PerspectiveId,
  recordByGrade: Map<number, { data: RecordTabData }>,
  guideAssignments: GuideAssignment[],
  activityTags: ActivityTag[],
  setekGuides: SetekGuide[],
  deliverableFileCounts?: Record<string, number>,
): AreaSummary {
  switch (layer) {
    case "guide":
      return computeGuideSummary(area, perspective, guideAssignments);
    case "deliverable":
      return computeDeliverableSummary(area, guideAssignments, deliverableFileCounts);
    case "draft":
      return computeDraftSummary(area, perspective, recordByGrade);
    case "actual":
      return computeActualSummary(area, recordByGrade);
    case "analysis":
      return computeAnalysisSummary(area, perspective, activityTags);
    case "direction":
      return computeDirectionSummary(area, perspective, setekGuides);
    default:
      return EMPTY;
  }
}

// --- 📎결과물 ---
function computeDeliverableSummary(
  area: RecordArea,
  assignments: GuideAssignment[],
  fileCounts?: Record<string, number>,
): AreaSummary {
  // 영역 매칭 배정 찾기
  const matched = assignments.filter((a) => {
    if (area.type === "setek" && area.subjectId) return a.target_subject_id === area.subjectId;
    if (area.type === "changche" && area.activityType) return a.target_activity_type === area.activityType;
    return false;
  });

  if (matched.length === 0) return { text: "배정 없음", isEmpty: true };
  if (!fileCounts) return { text: "조회 중…", isEmpty: true };

  let total = 0;
  for (const a of matched) {
    total += fileCounts[a.id] ?? 0;
  }

  if (total === 0) return { text: "파일 없음", isEmpty: true };
  return { text: `파일 ${total}건`, isEmpty: false };
}

// --- 📘가이드 ---
function computeGuideSummary(
  area: RecordArea,
  perspective: PerspectiveId,
  assignments: GuideAssignment[],
): AreaSummary {
  // 영역 매칭
  const matched = assignments.filter((a) => {
    if (area.type === "setek" && area.subjectId) return a.target_subject_id === area.subjectId;
    if (area.type === "changche" && area.activityType) return a.target_activity_type === area.activityType;
    return false;
  });

  if (matched.length === 0) return { text: "미배정", isEmpty: true };

  let filtered: GuideAssignment[];
  switch (perspective) {
    case "ai":
      filtered = matched.filter((a) => a.ai_recommendation_reason != null && a.confirmed_at == null);
      break;
    case "consultant":
      filtered = matched.filter((a) => a.ai_recommendation_reason == null && a.confirmed_at == null);
      break;
    case "confirmed":
      filtered = matched.filter((a) => a.confirmed_at != null);
      break;
  }

  if (filtered.length === 0) return { text: "해당 없음", isEmpty: true };

  const statusCounts = new Map<string, number>();
  for (const a of filtered) statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
  const statusText = [...statusCounts.entries()].map(([s, c]) => `${s} ${c}건`).join(", ");

  return {
    text: `${filtered.length}건 배정`,
    badge: statusText,
    isEmpty: false,
  };
}

// --- 📝가안 ---
function computeDraftSummary(
  area: RecordArea,
  perspective: PerspectiveId,
  recordByGrade: Map<number, { data: RecordTabData }>,
): AreaSummary {
  const entry = recordByGrade.get(area.grade);
  if (!entry) return EMPTY;

  const record = findRecord(area, entry.data);
  if (!record) return { text: "미작성", isEmpty: true };

  const limit = record.char_limit;

  switch (perspective) {
    case "ai":
      return charSummary(record.ai_draft_content, limit);
    case "consultant":
      return charSummary(record.content, limit);
    case "confirmed":
      return charSummary(record.confirmed_content, limit);
  }
}

// --- 📄실생기부 ---
function computeActualSummary(
  area: RecordArea,
  recordByGrade: Map<number, { data: RecordTabData }>,
): AreaSummary {
  const entry = recordByGrade.get(area.grade);
  if (!entry) return EMPTY;

  const record = findRecord(area, entry.data);
  if (!record) return { text: "미임포트", isEmpty: true };

  if (!record.imported_content) return { text: "미임포트", isEmpty: true };

  const len = record.imported_content.length;
  const dateStr = record.imported_at
    ? new Date(record.imported_at).toLocaleDateString("ko-KR")
    : "";

  return {
    text: `${len}자${dateStr ? ` · ${dateStr}` : ""}`,
    charCount: len,
    isEmpty: false,
  };
}

// --- 🔍분석 ---
function computeAnalysisSummary(
  area: RecordArea,
  perspective: PerspectiveId,
  tags: ActivityTag[],
): AreaSummary {
  if (!area.recordId) return { text: "미분석", isEmpty: true };

  const matched = tags.filter(
    (t) => t.record_id === area.recordId,
  );

  let filtered: ActivityTag[];
  switch (perspective) {
    case "ai":
      filtered = matched.filter((t) => t.source === "ai");
      break;
    case "consultant":
      filtered = matched.filter((t) => t.source === "manual");
      break;
    case "confirmed":
      filtered = matched.filter((t) => t.status === "confirmed");
      break;
  }

  if (filtered.length === 0) return { text: "미분석", isEmpty: true };

  return { text: `태그 ${filtered.length}개`, isEmpty: false };
}

// --- 📝방향 ---
function computeDirectionSummary(
  area: RecordArea,
  perspective: PerspectiveId,
  guides: SetekGuide[],
): AreaSummary {
  if (area.type !== "setek" || !area.subjectId) {
    return { text: "해당 없음", isEmpty: true };
  }

  const matched = guides.filter((g) => g.subject_id === area.subjectId);

  let filtered: SetekGuide[];
  switch (perspective) {
    case "ai":
      filtered = matched.filter((g) => g.source === "ai");
      break;
    case "consultant":
      filtered = matched.filter((g) => g.source === "manual");
      break;
    case "confirmed":
      filtered = matched.filter((g) => g.status === "confirmed");
      break;
  }

  if (filtered.length === 0) return { text: "미작성", isEmpty: true };

  const g = filtered[0];
  const preview = g.direction.length > 30 ? g.direction.slice(0, 30) + "…" : g.direction;
  const kw = g.keywords.slice(0, 3).join(", ");

  return {
    text: kw ? `${kw}` : preview,
    badge: g.status === "confirmed" ? "확정" : "초안",
    isEmpty: false,
  };
}

// --- 유틸: 영역에 매칭되는 레코드 찾기 ---
function findRecord(
  area: RecordArea,
  data: RecordTabData,
): (RecordTabData["seteks"][number] | RecordTabData["changche"][number] | RecordTabData["haengteuk"]) | null {
  switch (area.type) {
    case "setek":
      if (area.subjectId) {
        return data.seteks.find((s) => s.subject_id === area.subjectId) ?? null;
      }
      // 개인세특
      if (area.recordId) {
        return data.personalSeteks?.find((ps) => ps.id === area.recordId) ?? null;
      }
      return null;
    case "changche":
      return data.changche.find((c) => c.activity_type === area.activityType) ?? null;
    case "haengteuk":
      return data.haengteuk ?? null;
    case "reading":
      return null; // 독서는 content 기반이 아님
    default:
      return null;
  }
}
