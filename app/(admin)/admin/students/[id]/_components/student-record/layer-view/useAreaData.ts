import { useMemo } from "react";
import type { RecordTabData } from "@/lib/domains/student-record/types";
import type { RecordArea, LayerGuideAssignment, LayerActivityTag, LayerSetekGuide } from "./types";

export interface AreaData {
  /** 해당 영역의 기록 레코드 (content, ai_draft_content 등) */
  record: RecordTabData["seteks"][number] | RecordTabData["changche"][number] | RecordTabData["haengteuk"] | null;
  /** 매칭된 가이드 배정 (영역 매칭 + 범용 배정 포함) */
  guideAssignments: LayerGuideAssignment[];
  /** 매칭된 역량 태그 */
  activityTags: LayerActivityTag[];
  /** 매칭된 세특 방향 가이드 */
  setekGuides: LayerSetekGuide[];
  /** 결과물 파일 수 (배정 ID → 파일 수) */
  deliverableFileCounts: Record<string, number>;
}

interface UseAreaDataInput {
  area: RecordArea;
  recordByGrade: Map<number, { data: RecordTabData }>;
  guideAssignments: LayerGuideAssignment[];
  activityTags: LayerActivityTag[];
  setekGuides: LayerSetekGuide[];
  deliverableFileCounts?: Record<string, number>;
}

/**
 * selectedArea에 매칭되는 데이터를 전체 데이터에서 필터링
 */
export function useAreaData({
  area,
  recordByGrade,
  guideAssignments,
  activityTags,
  setekGuides,
  deliverableFileCounts,
}: UseAreaDataInput): AreaData {
  return useMemo(() => {
    const entry = recordByGrade.get(area.grade);

    // 레코드 찾기
    let record: AreaData["record"] = null;
    if (entry) {
      switch (area.type) {
        case "setek":
          record = area.subjectId
            ? entry.data.seteks.find((s) => s.subject_id === area.subjectId) ?? null
            : area.recordId
              ? entry.data.personalSeteks?.find((ps) => ps.id === area.recordId) ?? null
              : null;
          break;
        case "changche":
          record = entry.data.changche.find((c) => c.activity_type === area.activityType) ?? null;
          break;
        case "haengteuk":
          record = entry.data.haengteuk ?? null;
          break;
      }
    }

    // 가이드 배정 필터 (영역 매칭 + 범용 배정 포함)
    const matchedGuides = guideAssignments.filter((a) => {
      // 범용 배정 (target 미지정) → 모든 영역에 표시
      if (!a.target_subject_id && !a.target_activity_type) return true;
      if (area.type === "setek" && area.subjectId) return a.target_subject_id === area.subjectId;
      if (area.type === "changche" && area.activityType) return a.target_activity_type === area.activityType;
      return false;
    });

    // 태그 필터
    const matchedTags = area.recordId
      ? activityTags.filter((t) => t.record_id === area.recordId)
      : [];

    // 방향 가이드 필터
    const matchedDirection = area.type === "setek" && area.subjectId
      ? setekGuides.filter((g) => g.subject_id === area.subjectId)
      : [];

    // 파일 수 필터
    const fileCounts: Record<string, number> = {};
    if (deliverableFileCounts) {
      for (const g of matchedGuides) {
        const count = deliverableFileCounts[g.id];
        if (count) fileCounts[g.id] = count;
      }
    }

    return {
      record,
      guideAssignments: matchedGuides,
      activityTags: matchedTags,
      setekGuides: matchedDirection,
      deliverableFileCounts: fileCounts,
    };
  }, [area, recordByGrade, guideAssignments, activityTags, setekGuides, deliverableFileCounts]);
}
