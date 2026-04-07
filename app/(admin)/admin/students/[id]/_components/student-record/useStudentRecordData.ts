"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { calculateSchoolYear, gradeToSchoolYear } from "@/lib/utils/schoolYear";
import {
  recordTabQueryOptions,
  storylineTabQueryOptions,
  supplementaryTabQueryOptions,
  strategyTabQueryOptions,
  diagnosisTabQueryOptions,
  coursePlanTabQueryOptions,
  pipelineStatusQueryOptions,
} from "@/lib/query-options/studentRecord";
import { scorePanelDataQueryOptions } from "@/lib/query-options/scores";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { computeWarnings } from "@/lib/domains/student-record/warnings/engine";
import type { WarningCheckInput } from "@/lib/domains/student-record/warnings/engine";
import type { ProgressCounts } from "./RecordSidebar";

type Subject = {
  id: string;
  name: string;
  subject_group?: { name: string } | null;
  subject_type?: { name: string; is_achievement_only: boolean } | null;
};

type GradeYearPair = {
  grade: number;
  schoolYear: number;
};

export type { GradeYearPair };

export function useStudentRecordData({
  studentId,
  tenantId,
  initialSchoolYear,
  studentGrade,
  subjects,
}: {
  studentId: string;
  tenantId: string;
  initialSchoolYear: number;
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

  const { data: storylineData, isLoading: storylineLoading, error: storylineError } = useQuery(
    storylineTabQueryOptions(studentId, initialSchoolYear),
  );
  const { data: strategyData, isLoading: strategyLoading, error: strategyError } = useQuery(
    strategyTabQueryOptions(studentId, initialSchoolYear),
  );

  // 진단: 전 학년 prefetch
  const diagnosisQueries = useQueries({
    queries: yearGradePairs.map((p) => diagnosisTabQueryOptions(studentId, p.schoolYear, tenantId)),
  });
  const initialDiagIdx = yearGradePairs.findIndex((p) => p.schoolYear === initialSchoolYear);
  const diagnosisData = diagnosisQueries[initialDiagIdx >= 0 ? initialDiagIdx : 0]?.data ?? null;
  const diagnosisLoading = diagnosisQueries.some((q) => q.isLoading);
  const diagnosisError = diagnosisQueries.find((q) => q.error)?.error ?? null;

  const { data: pipelineData } = useQuery(pipelineStatusQueryOptions(studentId));
  const isPipelineRunning = pipelineData?.status === "running";

  // ─── 파이프라인 완료 시 관련 쿼리 자동 갱신 ──────────
  const queryClient = useQueryClient();
  const prevPipelineRunningRef = useRef(false);
  useEffect(() => {
    const wasRunning = prevPipelineRunningRef.current;
    prevPipelineRunningRef.current = isPipelineRunning;

    // running → not running 전환 시 = 파이프라인 완료
    if (wasRunning && !isPipelineRunning) {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.diagnosisTabPrefix(studentId) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.strategyTab(studentId, initialSchoolYear) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.storylineTab(studentId) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.edges(studentId) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.setekGuides(studentId) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.changcheGuides(studentId) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.haengteukGuide(studentId) });
    }
  }, [isPipelineRunning, queryClient, studentId, initialSchoolYear]);

  const { data: coursePlanData } = useQuery(coursePlanTabQueryOptions(studentId));

  // ─── 성적 패널 데이터 (전략 탭 prefetch) ────────────
  const { data: scorePanelData, isLoading: scorePanelLoading } = useQuery(
    scorePanelDataQueryOptions(studentId),
  );

  // ─── 세특 가이드 데이터 ──────────────────────────────
  const { data: setekGuidesRes } = useQuery({
    queryKey: studentRecordKeys.setekGuides(studentId),
    queryFn: () => import("@/lib/domains/student-record/actions/activitySummary").then((m) => m.fetchSetekGuides(studentId)),
    staleTime: 60_000,
    enabled: !!studentId,
  });

  // ─── 창체/행특 가이드 데이터 ─────────────────────────
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
  const recordErrorGrades = useMemo(() => {
    const errors = new Map<number, Error>();
    yearGradePairs.forEach((p, i) => {
      const err = recordQueries[i]?.error;
      if (err) errors.set(p.grade, err as Error);
    });
    return errors;
  }, [yearGradePairs, recordQueries]);
  const suppErrorGrades = useMemo(() => {
    const errors = new Map<number, Error>();
    yearGradePairs.forEach((p, i) => {
      const err = supplementaryQueries[i]?.error;
      if (err) errors.set(p.grade, err as Error);
    });
    return errors;
  }, [yearGradePairs, supplementaryQueries]);

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

  // ─── 경고 계산 ────────────────────────────────────
  const warnings = useMemo(() => {
    const recordsMap = new Map<number, import("@/lib/domains/student-record").RecordTabData>();
    for (const [g, entry] of recordByGrade) recordsMap.set(g, entry.data);
    const input: WarningCheckInput = {
      recordsByGrade: recordsMap,
      storylineData: storylineData ?? null,
      diagnosisData: diagnosisData ?? null,
      strategyData: strategyData ?? null,
      currentGrade: studentGrade,
      qualityScores: diagnosisData?.qualityScores,
      targetMajorField: diagnosisData?.targetMajor ?? null,
      curriculumYear: scorePanelData?.curriculumYear ?? undefined,
      roadmapItems: storylineData?.roadmapItems,
    };
    return computeWarnings(input);
  }, [recordByGrade, storylineData, diagnosisData, strategyData, studentGrade, scorePanelData?.curriculumYear]);

  // ─── 진행률 계산 ─────────────────────────────────
  const progressCounts = useMemo<ProgressCounts>(() => {
    const taskDone = (key: string) => pipelineData?.tasks?.[key as keyof typeof pipelineData.tasks] === "completed";

    let recordFilled = 0;
    const recordTotal = 7;
    if (recordByGrade.size > 0) recordFilled++;
    for (const [, entry] of recordByGrade) {
      if (entry.data.schoolAttendance) { recordFilled++; break; }
    }
    let hasAwards = false;
    for (const [, entry] of suppByGrade) {
      if (entry.data.awards.length > 0 || entry.data.disciplinary.length > 0) { hasAwards = true; break; }
    }
    if (hasAwards) recordFilled++;
    for (const [, entry] of recordByGrade) {
      if (entry.data.changche.length > 0) { recordFilled++; break; }
    }
    for (const [, entry] of recordByGrade) {
      if (entry.data.seteks.length > 0) { recordFilled++; break; }
    }
    let hasReadings = false;
    for (const [, entry] of recordByGrade) {
      if (entry.data.readings.length > 0) { hasReadings = true; break; }
    }
    if (hasReadings) recordFilled++;
    for (const [, entry] of recordByGrade) {
      if (entry.data.haengteuk) { recordFilled++; break; }
    }

    const diagnosisFilled = diagnosisData ? 1 : 0;

    const designFilled = [
      storylineData?.storylines?.length ?? 0,
      storylineData?.roadmapItems?.length ?? 0,
      taskDone("activity_summary") ? 1 : 0,
      taskDone("setek_guide") ? 1 : 0,
      taskDone("guide_matching") ? 1 : 0,
      taskDone("course_recommendation") ? 1 : 0,
      taskDone("bypass_analysis") ? 1 : 0,
    ].filter((n) => n > 0).length;

    let hasApps = false;
    for (const [, entry] of suppByGrade) {
      if (entry.data.applications.length > 0) { hasApps = true; break; }
    }
    const strategyFilled = [
      hasApps ? 1 : 0,
      strategyData?.minScoreTargets?.length ? 1 : 0,
      taskDone("ai_strategy") ? 1 : 0,
      taskDone("interview_generation") ? 1 : 0,
      taskDone("roadmap_generation") ? 1 : 0,
      taskDone("ai_diagnosis") ? 1 : 0,
    ].filter((n) => n > 0).length;

    return { recordFilled, recordTotal, diagnosisFilled, designFilled, strategyFilled };
  }, [recordByGrade, suppByGrade, diagnosisData, storylineData, strategyData, pipelineData]);

  // ─── 세특/창체/행특 가이드 변환 ───────────────────
  const transformedSetekGuideItems = useMemo(() => {
    if (!setekGuidesRes?.success || !setekGuidesRes.data) return undefined;
    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
    const items = setekGuidesRes.data.map((row) => ({
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

  const allFailed = recordQueries.every((q) => !!q.error)
    && supplementaryQueries.every((q) => !!q.error)
    && !!storylineError && !!strategyError;

  const firstError = allFailed
    ? (recordQueries[0]?.error ?? storylineError ?? strategyError)
    : null;

  return {
    // 기본 쌍 목록
    yearGradePairs,
    // 쿼리 원본 (visiblePairs 계산 등에 필요)
    recordQueries,
    supplementaryQueries,
    // 학년별 맵
    recordByGrade,
    suppByGrade,
    // 로딩/에러
    anyRecordLoading,
    anySuppLoading,
    recordErrorGrades,
    suppErrorGrades,
    // 단일 쿼리 결과
    storylineData,
    storylineLoading,
    strategyData,
    strategyLoading,
    diagnosisData,
    diagnosisLoading,
    diagnosisError,
    pipelineData,
    isPipelineRunning,
    coursePlanData,
    scorePanelData,
    scorePanelLoading,
    setekGuidesRes,
    // 변환된 가이드 아이템
    transformedSetekGuideItems,
    transformedChangcheGuideItems,
    transformedHaengteukGuideItems,
    // 합산/파생 데이터
    mergedReadings,
    allRecordSummaries,
    warnings,
    progressCounts,
    // 에러 집계
    allFailed,
    firstError,
  };
}
