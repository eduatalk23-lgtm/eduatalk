"use client";

import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { calculateSchoolYear, gradeToSchoolYear } from "@/lib/utils/schoolYear";
import {
  recordTabQueryOptions,
  supplementaryTabQueryOptions,
  studentRecordKeys,
} from "@/lib/query-options/studentRecord";

type Subject = {
  id: string;
  name: string;
  subject_group?: { name: string } | null;
  subject_type?: { name: string; is_achievement_only: boolean } | null;
};

export type GradeYearPair = {
  grade: number;
  schoolYear: number;
};

/**
 * Phase 4: 기록 + 부가정보 + 가이드 훅 (항상 활성)
 * - 다년도 record/supplementary 병렬 로딩
 * - 세특/창체/행특 가이드 데이터
 * - 파생 데이터: mergedReadings, allRecordSummaries
 */
export function useRecordStageData({
  studentId,
  studentGrade,
  subjects,
}: {
  studentId: string;
  studentGrade: number;
  subjects: Subject[];
}) {
  const currentSchoolYear = calculateSchoolYear();

  // ─── 학년-연도 쌍 계산 ─────────────────────────────────
  const yearGradePairs = useMemo<GradeYearPair[]>(() => {
    const pairs: GradeYearPair[] = [];
    for (let g = 1; g <= studentGrade; g++) {
      const sy = gradeToSchoolYear(g, studentGrade, currentSchoolYear);
      pairs.push({ grade: g, schoolYear: sy });
    }
    return pairs;
  }, [studentGrade, currentSchoolYear]);

  // ─── 다년도 병렬 쿼리 ────────────────────────────────
  const recordQueries = useQueries({
    queries: yearGradePairs.map((p) => recordTabQueryOptions(studentId, p.schoolYear)),
  });

  const supplementaryQueries = useQueries({
    queries: yearGradePairs.map((p) => supplementaryTabQueryOptions(studentId, p.schoolYear)),
  });

  // ─── 세특 가이드 데이터 ──────────────────────────────
  const { data: setekGuidesRes } = useQuery({
    queryKey: studentRecordKeys.setekGuides(studentId),
    queryFn: () => import("@/lib/domains/student-record/actions/activitySummary").then((m) => m.fetchSetekGuides(studentId)),
    staleTime: 60_000,
    enabled: !!studentId,
  });

  const { data: changcheGuidesRes } = useQuery({
    queryKey: studentRecordKeys.changcheGuides(studentId),
    queryFn: () => import("@/lib/domains/student-record/actions/activitySummary").then((m) => m.fetchChangcheGuides(studentId)),
    staleTime: 60_000,
    enabled: !!studentId,
  });
  const { data: haengteukGuideRes } = useQuery({
    queryKey: studentRecordKeys.haengteukGuide(studentId),
    queryFn: () => import("@/lib/domains/student-record/actions/activitySummary").then((m) => m.fetchHaengteukGuide(studentId)),
    staleTime: 60_000,
    enabled: !!studentId,
  });

  // ─── 학년별 데이터 맵 ─────────────────────────────────
  const recordDataArray = recordQueries.map((q) => q.data);
  const recordByGrade = useMemo(() => {
    const map = new Map<number, { grade: number; schoolYear: number; data: NonNullable<(typeof recordQueries)[0]["data"]> }>();
    yearGradePairs.forEach((p, i) => {
      const d = recordDataArray[i];
      if (d) map.set(p.grade, { grade: p.grade, schoolYear: p.schoolYear, data: d });
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recordDataArray 요소별 안정 참조
  }, [yearGradePairs, ...recordDataArray]);

  const suppDataArray = supplementaryQueries.map((q) => q.data);
  const suppByGrade = useMemo(() => {
    const map = new Map<number, { grade: number; schoolYear: number; data: NonNullable<(typeof supplementaryQueries)[0]["data"]> }>();
    yearGradePairs.forEach((p, i) => {
      const d = suppDataArray[i];
      if (d) map.set(p.grade, { grade: p.grade, schoolYear: p.schoolYear, data: d });
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- suppDataArray 요소별 안정 참조
  }, [yearGradePairs, ...suppDataArray]);

  // ─── 로딩/에러 상태 ──────────────────────────────────
  const anyRecordLoading = recordQueries.some((q) => q.isLoading);
  const anySuppLoading = supplementaryQueries.some((q) => q.isLoading);

  const allRecordFailed = recordQueries.every((q) => !!q.error);
  const allSuppFailed = supplementaryQueries.every((q) => !!q.error);
  const firstRecordError = recordQueries.find((q) => q.error)?.error ?? null;

  // ─── 전학년 합산 데이터 ────────────────────────────
  const mergedReadings = useMemo(() => {
    const readings: NonNullable<(typeof recordQueries)[0]["data"]>["readings"] = [];
    for (const [, entry] of recordByGrade) readings.push(...entry.data.readings);
    return readings;
  }, [recordByGrade]);

  // ─── 전체 레코드 요약 (진단 탭용) ───────────────────
  const allRecordSummaries = useMemo(() => {
    const result: { id: string; type: "setek" | "personal_setek" | "changche" | "haengteuk"; label: string; content: string; subjectName?: string; grade?: number }[] = [];
    for (const [g, entry] of recordByGrade) {
      for (const s of entry.data.seteks) {
        const text = s.content?.trim() || s.imported_content || "";
        if (text) {
          const subjectName = subjects.find((sub) => sub.id === s.subject_id)?.name ?? "과목";
          result.push({ id: s.id, type: "setek", label: `${g}학년 ${subjectName}`, content: text, subjectName, grade: g });
        }
      }
      for (const c of entry.data.changche) {
        const text = c.content?.trim() || (c as unknown as { imported_content?: string }).imported_content || "";
        if (text) result.push({ id: c.id, type: "changche", label: `${g}학년 ${c.activity_type}`, content: text, grade: g });
      }
      if (entry.data.haengteuk) {
        const text = entry.data.haengteuk.content?.trim() || (entry.data.haengteuk as unknown as { imported_content?: string }).imported_content || "";
        if (text) result.push({ id: entry.data.haengteuk.id, type: "haengteuk", label: `${g}학년 행특`, content: text, grade: g });
      }
    }
    return result;
  }, [recordByGrade, subjects]);

  // ─── 가이드 변환 ──────────────────────────────────
  const transformedSetekGuideItems = useMemo(() => {
    if (!setekGuidesRes?.success || !setekGuidesRes.data) return undefined;
    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
    const items = setekGuidesRes.data.map((row) => ({
      id: row.id,
      source: (row.source === "manual" ? "manual" : "ai") as "ai" | "manual",
      subjectId: row.subject_id,
      subjectName: subjectMap.get(row.subject_id) ?? row.subject_id,
      schoolYear: row.school_year,
      keywords: row.keywords ?? [],
      direction: row.direction,
      competencyFocus: row.competency_focus,
      cautions: row.cautions ?? undefined,
      teacherPoints: row.teacher_points,
      guideMode: (row.guide_mode === "prospective" ? "prospective" : "retrospective") as "retrospective" | "prospective",
    }));
    return items.length > 0 ? items : undefined;
  }, [setekGuidesRes, subjects]);

  const transformedChangcheGuideItems = useMemo(() => {
    if (!changcheGuidesRes?.success || !changcheGuidesRes.data) return undefined;
    const LABELS: Record<string, string> = { autonomy: "자율", club: "동아리", career: "진로" };
    const items = changcheGuidesRes.data.map((row) => ({
      id: row.id,
      source: (row.source === "manual" ? "manual" : "ai") as "ai" | "manual",
      activityType: row.activity_type,
      activityLabel: LABELS[row.activity_type] ?? row.activity_type,
      schoolYear: row.school_year,
      keywords: row.keywords ?? [],
      direction: row.direction,
      competencyFocus: row.competency_focus,
      cautions: row.cautions ?? undefined,
      teacherPoints: row.teacher_points,
      guideMode: (row.guide_mode === "prospective" ? "prospective" : "retrospective") as "retrospective" | "prospective",
    }));
    return items.length > 0 ? items : undefined;
  }, [changcheGuidesRes]);

  const transformedHaengteukGuideItems = useMemo(() => {
    if (!haengteukGuideRes?.success || !haengteukGuideRes.data) return undefined;
    const rows = Array.isArray(haengteukGuideRes.data) ? haengteukGuideRes.data : [haengteukGuideRes.data];
    const items = rows.map((row) => ({
      id: row.id,
      source: (row.source === "manual" ? "manual" : "ai") as "ai" | "manual",
      schoolYear: row.school_year,
      keywords: row.keywords ?? [],
      direction: row.direction,
      competencyFocus: row.competency_focus,
      cautions: row.cautions ?? undefined,
      teacherPoints: row.teacher_points,
      evaluationItems: row.evaluation_items as Array<{ item: string; score: string; reasoning: string }> | undefined,
      guideMode: (row.guide_mode === "prospective" ? "prospective" : "retrospective") as "retrospective" | "prospective",
    }));
    return items.length > 0 ? items : undefined;
  }, [haengteukGuideRes]);

  return {
    yearGradePairs,
    recordByGrade,
    suppByGrade,
    anyRecordLoading,
    anySuppLoading,
    allRecordFailed,
    allSuppFailed,
    firstRecordError,
    mergedReadings,
    allRecordSummaries,
    setekGuidesRes,
    transformedSetekGuideItems,
    transformedChangcheGuideItems,
    transformedHaengteukGuideItems,
  };
}
