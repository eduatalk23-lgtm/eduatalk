"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  coursePlanTabQueryOptions,
  studentRecordKeys,
} from "@/lib/query-options/studentRecord";
import {
  generateRecommendationsAction,
  updateCoursePlanStatusAction,
  removeCoursePlanAction,
  saveCoursePlanAction,
  bulkConfirmAction,
  swapCoursePlanPriorityAction,
} from "@/lib/domains/student-record/actions/coursePlan";
import { calculateCourseAdequacy } from "@/lib/domains/student-record/course-adequacy";
import { calculateSchoolYear, gradeToSchoolYear } from "@/lib/utils/schoolYear";
import { cn } from "@/lib/cn";
import {
  Sparkles, ChevronDown, ChevronRight, Plus, CheckCheck,
  AlertCircle, ArrowRight, Info,
} from "lucide-react";
import { CoursePlanCard } from "./CoursePlanCard";
import type { CoursePlanWithSubject } from "@/lib/domains/student-record/course-plan/types";
import { detectPlanConflicts, type PlanConflict } from "@/lib/domains/student-record/course-plan/recommendation";

interface CoursePlanEditorProps {
  studentId: string;
  tenantId: string;
}

export default function CoursePlanEditor({ studentId, tenantId }: CoursePlanEditorProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(coursePlanTabQueryOptions(studentId));

  const [expandedGrades, setExpandedGrades] = useState<Record<number, boolean>>({
    1: true, 2: true, 3: true,
  });
  const [showPlannedAdequacy, setShowPlannedAdequacy] = useState(false);
  const [addingTo, setAddingTo] = useState<{ grade: number; semester: number } | null>(null);
  const [subjectSearch, setSubjectSearch] = useState("");

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: studentRecordKeys.coursePlanTab(studentId) });
  }, [queryClient, studentId]);

  // Mutations
  const generateMutation = useMutation({
    mutationFn: () => generateRecommendationsAction(studentId, tenantId),
    onSuccess: invalidate,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "recommended" | "confirmed" | "completed" }) =>
      updateCoursePlanStatusAction(id, status),
    onSuccess: (_, { status }) => {
      invalidate();
      if (status === "confirmed" || status === "completed") {
        // 상태 변경은 적합도에 영향 → 진단 탭도 무효화
        const sy = calculateSchoolYear();
        queryClient.invalidateQueries({
          queryKey: studentRecordKeys.diagnosisTab(studentId, sy),
        });
      }
      // confirmed 전환 시 빈 세특 생성 → recordTab 무효화
      if (status === "confirmed") {
        queryClient.invalidateQueries({
          queryKey: [...studentRecordKeys.all, "recordTab", studentId],
        });
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeCoursePlanAction(id),
    onSuccess: invalidate,
  });

  const addMutation = useMutation({
    mutationFn: (input: { subjectId: string; grade: number; semester: number }) =>
      saveCoursePlanAction({ tenantId, studentId, ...input }),
    onSuccess: () => { invalidate(); setAddingTo(null); setSubjectSearch(""); },
  });

  const swapMutation = useMutation({
    mutationFn: ({ a, b }: { a: { id: string; priority: number }; b: { id: string; priority: number } }) =>
      swapCoursePlanPriorityAction(a.id, a.priority, b.id, b.priority),
    onSuccess: invalidate,
  });

  const bulkConfirmMutation = useMutation({
    mutationFn: ({ grade, semester }: { grade: number; semester: number }) =>
      bulkConfirmAction(studentId, grade, semester),
    onSuccess: (_, { grade }) => {
      invalidate();
      // 일괄 확정은 적합도에 영향 → 진단 탭도 무효화
      const currentSy = calculateSchoolYear();
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.diagnosisTab(studentId, currentSy),
      });
      // 빈 세특이 자동 생성되므로 recordTab도 무효화
      if (data?.studentGrade) {
        const sy = gradeToSchoolYear(grade, data.studentGrade, currentSy);
        queryClient.invalidateQueries({
          queryKey: studentRecordKeys.recordTab(studentId, sy),
        });
      }
    },
  });

  // 그룹핑: grade → semester → plans
  const plansByGradeSemester = useMemo(() => {
    if (!data?.plans) return {};
    const map: Record<number, Record<number, CoursePlanWithSubject[]>> = {};
    for (const plan of data.plans) {
      if (!map[plan.grade]) map[plan.grade] = {};
      if (!map[plan.grade][plan.semester]) map[plan.grade][plan.semester] = [];
      map[plan.grade][plan.semester].push(plan);
    }
    return map;
  }, [data?.plans]);

  // 통계
  const stats = useMemo(() => {
    const plans = data?.plans ?? [];
    return {
      total: plans.length,
      recommended: plans.filter((p) => p.plan_status === "recommended").length,
      confirmed: plans.filter((p) => p.plan_status === "confirmed").length,
      completed: plans.filter((p) => p.plan_status === "completed").length,
    };
  }, [data?.plans]);

  // P2-A: 충돌 감지
  const conflicts = useMemo<PlanConflict[]>(() => {
    if (!data?.plans || data.plans.length === 0) return [];
    return detectPlanConflicts(data.plans);
  }, [data?.plans]);

  // 적합도 계산 (학교 개설 과목 + 교육과정 연도 반영)
  const adequacy = useMemo(() => {
    if (!data?.targetMajor || !data.plans) return null;
    const offered = data.offeredSubjectNames ?? null;
    const curYear = data.curriculumYear;

    // 이수 과목만
    const completedNames = data.plans
      .filter((p) => p.plan_status === "completed")
      .map((p) => p.subject.name);
    const completedAdequacy = calculateCourseAdequacy(
      data.targetMajor, completedNames, offered, curYear,
    );

    // 이수 + 확정 합산
    const plannedNames = data.plans
      .filter((p) => p.plan_status === "completed" || p.plan_status === "confirmed")
      .map((p) => p.subject.name);
    const plannedAdequacy = calculateCourseAdequacy(
      data.targetMajor, plannedNames, offered, curYear,
    );

    return { completed: completedAdequacy, planned: plannedAdequacy };
  }, [data]);

  const toggleGrade = (grade: number) => {
    setExpandedGrades((prev) => ({ ...prev, [grade]: !prev[grade] }));
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-20 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  // === 빈 상태 분기 ===

  // 1. 진로 미설정
  if (!data?.targetMajor) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/30">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          진로 계열이 설정되어 있지 않습니다
        </p>
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
          프로필에서 진로 계열을 먼저 설정해 주세요. 설정 후 추천 과목을 생성할 수 있습니다.
        </p>
      </div>
    );
  }

  // 2. 추천 미실행
  if (data.plans.length === 0) {
    return (
      <div className="space-y-4">
        <CoursePlanHeader
          targetMajor={data.targetMajor}
          targetMajor2={data.targetMajor2}
          stats={stats}
        />
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-center dark:border-blue-800 dark:bg-blue-950/30">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-blue-500" />
          <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
            추천 과목을 생성해 보세요
          </p>
          <p className="mt-1 text-xs text-blue-600 dark:text-blue-500">
            {data.targetMajor} 계열에 맞는 추천 과목을 자동으로 배치합니다.
          </p>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {generateMutation.isPending ? "생성 중..." : "추천 생성"}
          </button>
        </div>
      </div>
    );
  }

  // === 정상 렌더 ===
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <CoursePlanHeader
        targetMajor={data.targetMajor}
        targetMajor2={data.targetMajor2}
        stats={stats}
        onRegenerate={() => generateMutation.mutate()}
        isRegenerating={generateMutation.isPending}
      />

      {/* 학교 미등록 경고 */}
      {data.offeredSubjects.length === 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          <Info className="h-4 w-4 shrink-0" />
          학교 개설 과목 정보가 등록되어 있지 않아, 과목 배치가 기본값으로 설정되었습니다.
        </div>
      )}

      {/* P2-A: 충돌 경고 */}
      {conflicts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {conflicts.map((c, i) => (
            <div
              key={`conflict-${i}`}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                c.type === "duplicate"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400",
              )}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {c.message}
            </div>
          ))}
        </div>
      )}

      {/* 학년별 아코디언 */}
      {[1, 2, 3].map((grade) => {
        const isExpanded = expandedGrades[grade];
        const gradePlans = plansByGradeSemester[grade] ?? {};
        const gradeCount = Object.values(gradePlans).flat().length;
        const isPast = grade < (data.studentGrade ?? 1);

        return (
          <div
            key={grade}
            className={cn(
              "rounded-lg border border-[var(--border-primary)]",
              isPast && "opacity-70",
            )}
          >
            {/* 학년 헤더 */}
            <button
              onClick={() => toggleGrade(grade)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--surface-hover)] transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" />
                  : <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />}
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {grade}학년
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {gradeCount}과목
                </span>
                {isPast && (
                  <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    과거
                  </span>
                )}
              </div>
            </button>

            {/* 학기별 섹션 */}
            {isExpanded && (
              <div className="divide-y divide-[var(--border-primary)]">
                {[1, 2].map((semester) => {
                  const semesterPlans = gradePlans[semester] ?? [];
                  const hasRecommended = semesterPlans.some((p) => p.plan_status === "recommended");

                  return (
                    <div key={semester} className="px-4 py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          {semester}학기
                        </span>
                        <div className="flex items-center gap-1.5">
                          {hasRecommended && (
                            <button
                              onClick={() => bulkConfirmMutation.mutate({ grade, semester })}
                              disabled={bulkConfirmMutation.isPending}
                              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                            >
                              <CheckCheck className="h-3 w-3" />
                              일괄 확정
                            </button>
                          )}
                          <button
                            onClick={() => setAddingTo(
                              addingTo?.grade === grade && addingTo?.semester === semester
                                ? null : { grade, semester },
                            )}
                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]"
                          >
                            <Plus className="h-3 w-3" />
                            추가
                          </button>
                        </div>
                      </div>

                      {/* 과목 카드 목록 */}
                      <div className="space-y-1.5">
                        {semesterPlans.length === 0 && !addingTo && (
                          <p className="py-2 text-center text-xs text-[var(--text-tertiary)]">
                            배치된 과목이 없습니다
                          </p>
                        )}
                        {semesterPlans.map((plan, idx) => (
                          <CoursePlanCard
                            key={plan.id}
                            id={plan.id}
                            subjectName={plan.subject.name}
                            subjectType={plan.subject.subject_type?.name ?? null}
                            status={plan.plan_status}
                            reason={plan.recommendation_reason}
                            isSchoolOffered={plan.is_school_offered}
                            notes={plan.notes}
                            disabled={isPast}
                            onConfirm={() =>
                              updateStatusMutation.mutate({ id: plan.id, status: "confirmed" })
                            }
                            onRemove={() => removeMutation.mutate(plan.id)}
                            onMoveUp={idx > 0 ? () => swapMutation.mutate({
                              a: { id: plan.id, priority: plan.priority },
                              b: { id: semesterPlans[idx - 1].id, priority: semesterPlans[idx - 1].priority },
                            }) : undefined}
                            onMoveDown={idx < semesterPlans.length - 1 ? () => swapMutation.mutate({
                              a: { id: plan.id, priority: plan.priority },
                              b: { id: semesterPlans[idx + 1].id, priority: semesterPlans[idx + 1].priority },
                            }) : undefined}
                          />
                        ))}
                      </div>

                      {/* 과목 추가 인라인 */}
                      {addingTo?.grade === grade && addingTo?.semester === semester && (
                        <SubjectSearchInput
                          value={subjectSearch}
                          onChange={setSubjectSearch}
                          onSelect={(subjectId) =>
                            addMutation.mutate({ subjectId, grade, semester })
                          }
                          onCancel={() => { setAddingTo(null); setSubjectSearch(""); }}
                          isPending={addMutation.isPending}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* 적합도 미리보기 */}
      {adequacy && (
        <div className="rounded-lg border border-[var(--border-primary)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium text-[var(--text-primary)]">교과 이수 적합도</h4>
            <button
              onClick={() => setShowPlannedAdequacy(!showPlannedAdequacy)}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {showPlannedAdequacy ? "이수만 보기" : "확정 포함 보기"}
            </button>
          </div>
          <AdequacyBar
            label="현재 (이수 과목)"
            score={adequacy.completed?.score ?? 0}
            active={!showPlannedAdequacy}
          />
          {showPlannedAdequacy && (
            <div className="mt-2">
              <AdequacyBar
                label="계획 반영 (이수 + 확정)"
                score={adequacy.planned?.score ?? 0}
                active
              />
              {adequacy.completed && adequacy.planned && (
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <ArrowRight className="h-3 w-3" />
                  +{(adequacy.planned.score ?? 0) - (adequacy.completed.score ?? 0)}%p 개선 예상
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function CoursePlanHeader({
  targetMajor,
  targetMajor2,
  stats,
  onRegenerate,
  isRegenerating,
}: {
  targetMajor: string;
  targetMajor2?: string | null;
  stats: { total: number; recommended: number; confirmed: number; completed: number };
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900 dark:text-violet-300">
          {targetMajor}
        </span>
        {targetMajor2 && (
          <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-500 dark:bg-violet-900/50 dark:text-violet-400">
            +{targetMajor2}
          </span>
        )}
        <span className="text-xs text-[var(--text-tertiary)]">
          전체 {stats.total} · 추천 {stats.recommended} · 확정 {stats.confirmed} · 이수 {stats.completed}
        </span>
      </div>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {isRegenerating ? "생성 중..." : "재추천"}
        </button>
      )}
    </div>
  );
}

function AdequacyBar({
  label, score, active,
}: { label: string; score: number; active: boolean }) {
  return (
    <div className={cn(!active && "opacity-50")}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="font-medium text-[var(--text-primary)]">{score}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500",
          )}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

function SubjectSearchInput({
  value, onChange, onSelect, onCancel, isPending,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (subjectId: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);

  const handleChange = useCallback(async (v: string) => {
    onChange(v);
    if (v.length < 1) { setResults([]); return; }

    // 클라이언트에서 직접 검색 (간단 구현)
    try {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("subjects")
        .select("id, name")
        .ilike("name", `%${v}%`)
        .limit(8);
      setResults(data ?? []);
    } catch {
      setResults([]);
    }
  }, [onChange]);

  return (
    <div className="mt-2 rounded-md border border-blue-200 bg-white p-2 dark:border-blue-800 dark:bg-gray-900">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="과목명 검색..."
        autoFocus
        className="w-full rounded border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1 text-sm outline-none focus:border-blue-400"
      />
      {results.length > 0 && (
        <div className="mt-1 max-h-32 overflow-y-auto">
          {results.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              disabled={isPending}
              className="flex w-full items-center px-2 py-1 text-left text-sm hover:bg-[var(--surface-hover)]"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="mt-1 flex justify-end">
        <button onClick={onCancel} className="text-xs text-[var(--text-tertiary)] hover:underline">
          취소
        </button>
      </div>
    </div>
  );
}
