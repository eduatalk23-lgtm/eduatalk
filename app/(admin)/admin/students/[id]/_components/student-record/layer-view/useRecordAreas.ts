import { useMemo } from "react";
import type { RecordTabData } from "@/lib/domains/student-record/types";
import { CHANGCHE_TYPE_LABELS } from "@/lib/domains/student-record/constants";
import type { RecordArea } from "./types";

interface Subject {
  id: string;
  name: string;
}

interface GradePair {
  grade: number;
  schoolYear: number;
}

/**
 * recordByGrade + subjects로 영역 플랫 리스트 생성
 * NEIS 순서: 6.창체 → 7.세특 → 8.독서 → 9.행특
 */
export function useRecordAreas(
  visiblePairs: GradePair[],
  recordByGrade: Map<number, { data: RecordTabData }>,
  subjects: Subject[],
): RecordArea[] {
  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s.name])),
    [subjects],
  );

  return useMemo(() => {
    const areas: RecordArea[] = [];
    const changcheTypes = ["autonomy", "club", "career"] as const;

    for (const { grade } of visiblePairs) {
      const entry = recordByGrade.get(grade);

      // --- Section 6: 창체 (3유형 항상 표시) ---
      for (const actType of changcheTypes) {
        const record = entry?.data.changche.find((c) => c.activity_type === actType);
        areas.push({
          id: `changche-${actType}-${grade}`,
          sectionNumber: 6,
          type: "changche",
          label: CHANGCHE_TYPE_LABELS[actType] ?? actType,
          grade,
          activityType: actType,
          recordId: record?.id,
        });
      }

      // --- Section 7: 세특 (과목별) ---
      const seenSubjects = new Set<string>();

      // 실제 세특 레코드
      for (const setek of entry?.data.seteks ?? []) {
        seenSubjects.add(setek.subject_id);
        const name = subjectMap.get(setek.subject_id) ?? "과목 미정";
        areas.push({
          id: `setek-${setek.subject_id}-${grade}`,
          sectionNumber: 7,
          type: "setek",
          label: `세특-${name}`,
          grade,
          subjectId: setek.subject_id,
          recordId: setek.id,
        });
      }

      // 개인세특도 포함
      for (const ps of entry?.data.personalSeteks ?? []) {
        areas.push({
          id: `setek-personal-${ps.id}-${grade}`,
          sectionNumber: 7,
          type: "setek",
          label: `개인세특-${ps.title || "무제"}`,
          grade,
          recordId: ps.id,
        });
      }

      // --- Section 8: 독서 ---
      const readingCount = entry?.data.readings?.length ?? 0;
      areas.push({
        id: `reading-${grade}`,
        sectionNumber: 8,
        type: "reading",
        label: `독서${readingCount > 0 ? ` (${readingCount}권)` : ""}`,
        grade,
      });

      // --- Section 9: 행특 ---
      areas.push({
        id: `haengteuk-${grade}`,
        sectionNumber: 9,
        type: "haengteuk",
        label: "행동특성 및 종합의견",
        grade,
        recordId: entry?.data.haengteuk?.id,
      });
    }

    // NEIS 순서 유지 (이미 grade 순 → section 순으로 push됨)
    return areas;
  }, [visiblePairs, recordByGrade, subjectMap]);
}
