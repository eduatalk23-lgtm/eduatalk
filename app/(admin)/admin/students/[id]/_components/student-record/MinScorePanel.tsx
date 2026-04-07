"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMinScoreTargetAction,
  removeMinScoreTargetAction,
  runMinScoreSimulationAction,
} from "@/lib/domains/student-record/actions/strategy";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { simulateMinScore } from "@/lib/domains/student-record";
import type {
  MinScoreTarget,
  MinScoreSimulation,
  MinScoreCriteria,
} from "@/lib/domains/student-record";
import { cn } from "@/lib/cn";
import { DesiredUniversityChips } from "./shared/DesiredUniversityChips";

type MinScorePanelProps = {
  targets: MinScoreTarget[];
  simulations: MinScoreSimulation[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
};

const SUBJECTS = ["국어", "수학", "영어", "탐구1", "탐구2", "한국사"] as const;

export function MinScorePanel({
  targets,
  simulations,
  studentId,
  schoolYear,
  tenantId,
}: MinScorePanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSimForm, setShowSimForm] = useState(false);
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({
    queryKey: studentRecordKeys.strategyTab(studentId, schoolYear),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await removeMinScoreTargetAction(id);
      if (!result.success) throw new Error("error" in result ? result.error : "삭제 실패");
    },
    onSuccess: invalidate,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* 목표 대학 목록 */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-[var(--text-primary)]">
          수능최저 목표 ({targets.length}개)
        </h3>

        {targets.length === 0 && !showAddForm && (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-600">
            최저 목표를 추가하면 시뮬레이션을 실행할 수 있습니다.
          </div>
        )}

        <div className="flex flex-col gap-2">
          {targets.map((target) => {
            const criteria = target.criteria as unknown as MinScoreCriteria;
            const latestSim = simulations.find((s) => s.target_id === target.id);

            return (
              <TargetCard
                key={target.id}
                target={target}
                criteria={criteria}
                latestSim={latestSim}
                onDelete={() => {
                  if (confirm(`${target.university_name} 최저 목표를 삭제하시겠습니까?`)) {
                    deleteMutation.mutate(target.id);
                  }
                }}
              />
            );
          })}
        </div>

        {showAddForm ? (
          <AddTargetForm
            studentId={studentId}
            tenantId={tenantId}
            onClose={() => setShowAddForm(false)}
            onSuccess={invalidate}
          />
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 rounded-lg border border-dashed border-gray-300 p-3 text-sm text-[var(--text-tertiary)] transition hover:border-gray-400 hover:text-[var(--text-secondary)] dark:border-gray-600"
          >
            + 최저 목표 추가
          </button>
        )}
      </div>

      {/* 시뮬레이션 실행 */}
      {targets.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-[var(--text-primary)]">시뮬레이션</h3>

          {showSimForm ? (
            <SimulationForm
              targets={targets}
              studentId={studentId}
              tenantId={tenantId}
              onClose={() => setShowSimForm(false)}
              onSuccess={invalidate}
            />
          ) : (
            <button
              onClick={() => setShowSimForm(true)}
              className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 text-sm text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-400"
            >
              모의고사 등급 입력하여 시뮬레이션 실행
            </button>
          )}

          {/* 최근 시뮬레이션 결과 */}
          {simulations.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 text-xs font-medium text-[var(--text-secondary)]">최근 시뮬레이션 결과</h4>
              <div className="flex flex-col gap-2">
                {simulations.slice(0, 5).map((sim) => {
                  const target = targets.find((t) => t.id === sim.target_id);
                  return (
                    <div key={sim.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-2 text-xs dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "rounded-full px-2 py-0.5 font-medium",
                          sim.is_met
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                        )}>
                          {sim.is_met ? "충족" : "미달"}
                        </span>
                        <span className="text-[var(--text-primary)]">
                          {target?.university_name ?? "?"} {target?.department ?? ""}
                        </span>
                        {sim.grade_sum != null && (
                          <span className="text-[var(--text-tertiary)]">
                            등급합 {sim.grade_sum} (차이 {(sim.gap ?? 0) >= 0 ? "+" : ""}{sim.gap})
                          </span>
                        )}
                      </div>
                      <span className="text-[var(--text-tertiary)]">
                        {sim.mock_score_exam_title} ({sim.mock_score_date})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* What-If 미리보기 */}
      {targets.length > 0 && (
        <WhatIfPreview targets={targets} />
      )}
    </div>
  );
}

// ============================================
// TargetCard
// ============================================

function TargetCard({
  target,
  criteria,
  latestSim,
  onDelete,
}: {
  target: MinScoreTarget;
  criteria: MinScoreCriteria;
  latestSim: MinScoreSimulation | undefined;
  onDelete: () => void;
}) {
  const criteriaLabel = criteria.type === "none"
    ? "최저 없음"
    : criteria.type === "single_grade"
      ? `단일과목 ${criteria.subjects.join("/")} ${criteria.maxSum}등급 이내`
      : `${criteria.subjects.join("+")} 중 ${criteria.count}개 합 ${criteria.maxSum} 이내`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">{target.university_name}</span>
            <span className="text-xs text-[var(--text-secondary)]">{target.department}</span>
            {target.admission_type && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)] dark:bg-gray-800">
                {target.admission_type}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{criteriaLabel}</p>
          {latestSim && (
            <p className="mt-1 text-xs">
              <span className={latestSim.is_met ? "text-emerald-600" : "text-red-600"}>
                최근: {latestSim.is_met ? "충족" : "미달"}
              </span>
              {latestSim.bottleneck_subjects && latestSim.bottleneck_subjects.length > 0 && (
                <span className="ml-1 text-[var(--text-tertiary)]">
                  (병목: {latestSim.bottleneck_subjects.join(", ")})
                </span>
              )}
            </p>
          )}
        </div>
        <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">삭제</button>
      </div>
    </div>
  );
}

// ============================================
// AddTargetForm
// ============================================

function AddTargetForm({
  studentId,
  tenantId,
  onClose,
  onSuccess,
}: {
  studentId: string;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [universityName, setUniversityName] = useState("");
  const [department, setDepartment] = useState("");
  const [criteriaType, setCriteriaType] = useState<"grade_sum" | "single_grade" | "none">("grade_sum");
  const [subjects, setSubjects] = useState("국어,수학,영어,탐구1");
  const [count, setCount] = useState(3);
  const [maxSum, setMaxSum] = useState(6);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!universityName.trim()) throw new Error("대학명을 입력해주세요.");
      if (!department.trim()) throw new Error("학과를 입력해주세요.");

      const criteria: MinScoreCriteria = {
        type: criteriaType,
        subjects: subjects.split(",").map((s) => s.trim()).filter(Boolean),
        count,
        maxSum,
        additional: [],
      };

      const result = await addMinScoreTargetAction({
        student_id: studentId,
        tenant_id: tenantId,
        university_name: universityName.trim(),
        department: department.trim(),
        criteria: criteria as unknown as import("@/lib/supabase/database.types").Json,
        priority: 0,
      });
      if (!result.success) throw new Error("error" in result ? result.error : "추가 실패");
    },
    onSuccess: () => { onSuccess(); onClose(); },
  });

  return (
    <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-primary)]">최저 목표 추가</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)]">취소</button>
      </div>
      <div className="flex flex-col gap-3">
        <DesiredUniversityChips
          studentId={studentId}
          onSelect={(name) => setUniversityName(name)}
          selectedName={universityName}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <input value={universityName} onChange={(e) => setUniversityName(e.target.value)} placeholder="대학명 *" className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
          <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="학과 *" className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <select value={criteriaType} onChange={(e) => setCriteriaType(e.target.value as "grade_sum" | "single_grade" | "none")} className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
            <option value="grade_sum">등급합</option>
            <option value="single_grade">단일과목</option>
            <option value="none">없음</option>
          </select>
          {criteriaType !== "none" && (
            <>
              <input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="과목 (쉼표구분)" className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
              {criteriaType === "grade_sum" && (
                <input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} placeholder="선택 수" className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
              )}
              <input type="number" min={1} value={maxSum} onChange={(e) => setMaxSum(Number(e.target.value))} placeholder={criteriaType === "grade_sum" ? "최대 합" : "최대 등급"} className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </>
          )}
        </div>
        <div className="flex justify-end">
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {mutation.isPending ? "추가 중..." : "추가"}
          </button>
        </div>
        {mutation.isError && <p className="text-xs text-red-600">{mutation.error.message}</p>}
      </div>
    </div>
  );
}

// ============================================
// SimulationForm — 모의고사 등급 입력
// ============================================

function SimulationForm({
  targets,
  studentId,
  tenantId,
  onClose,
  onSuccess,
}: {
  targets: MinScoreTarget[];
  studentId: string;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [examTitle, setExamTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [autoLoaded, setAutoLoaded] = useState(false);

  // 최신 모의고사 자동 로드
  const { data: latestMock } = useQuery({
    queryKey: ["mockScores", "latestGrades", studentId, tenantId],
    queryFn: async () => {
      const { fetchLatestMockGradesAction } = await import("@/lib/domains/score/actions/core");
      return fetchLatestMockGradesAction(studentId, tenantId);
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (latestMock && !autoLoaded && Object.keys(grades).length === 0) {
      setExamTitle(latestMock.examTitle);
      setExamDate(latestMock.examDate);
      setGrades(latestMock.grades);
      setAutoLoaded(true);
    }
  }, [latestMock, autoLoaded, grades]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!examTitle.trim()) throw new Error("시험명을 입력해주세요.");
      if (!examDate) throw new Error("시험일을 입력해주세요.");
      if (Object.keys(grades).length === 0) throw new Error("등급을 입력해주세요.");

      // Run simulation for each target
      for (const target of targets) {
        const criteria = target.criteria as unknown as MinScoreCriteria;
        await runMinScoreSimulationAction(
          {
            student_id: studentId,
            tenant_id: tenantId,
            target_id: target.id,
            mock_score_date: examDate,
            mock_score_exam_title: examTitle.trim(),
            actual_grades: grades as unknown as import("@/lib/supabase/database.types").Json,
          },
          criteria,
        );
      }
    },
    onSuccess: () => { onSuccess(); onClose(); },
  });

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-primary)]">시뮬레이션 실행</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)]">취소</button>
      </div>
      <div className="flex flex-col gap-3">
        {autoLoaded && (
          <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1.5 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
            <span>최근 모의고사에서 불러옴 ({latestMock?.examTitle})</span>
            <button type="button" onClick={() => { setExamTitle(""); setExamDate(""); setGrades({}); setAutoLoaded(false); }} className="underline">초기화</button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <input value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="시험명 (예: 6월 모평) *" className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
          <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SUBJECTS.map((subj) => (
            <div key={subj}>
              <label className="mb-1 block text-[10px] text-[var(--text-tertiary)]">{subj}</label>
              <input
                type="number"
                min={1}
                max={9}
                value={grades[subj] ?? ""}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setGrades((prev) => val ? { ...prev, [subj]: val } : (() => { const next = { ...prev }; delete next[subj]; return next; })());
                }}
                placeholder="등급"
                className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-center text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
          ))}
        </div>

        {/* 즉석 미리보기 */}
        {Object.keys(grades).length > 0 && targets.length > 0 && (
          <div className="rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-1 text-[10px] font-medium text-[var(--text-secondary)]">미리보기</p>
            {targets.map((t) => {
              const criteria = t.criteria as unknown as MinScoreCriteria;
              const result = simulateMinScore(criteria, grades);
              return (
                <p key={t.id} className="text-xs">
                  <span className={result.isMet ? "text-emerald-600" : "text-red-600"}>
                    {result.isMet ? "O" : "X"}
                  </span>
                  {" "}{t.university_name} {t.department}
                  {result.gradeSum != null && <span className="text-[var(--text-tertiary)]"> (합 {result.gradeSum})</span>}
                </p>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {mutation.isPending ? "저장 중..." : "시뮬레이션 저장"}
          </button>
        </div>
        {mutation.isError && <p className="text-xs text-red-600">{mutation.error.message}</p>}
      </div>
    </div>
  );
}

// ============================================
// WhatIfPreview — what-if 시나리오
// ============================================

function WhatIfPreview({ targets }: { targets: MinScoreTarget[] }) {
  const [subject, setSubject] = useState("수학");
  const [currentGrade, setCurrentGrade] = useState(4);
  const [improvedGrade, setImprovedGrade] = useState(2);

  const currentGrades: Record<string, number> = { [subject]: currentGrade };
  const improvedGrades: Record<string, number> = { [subject]: improvedGrade };

  const currentResults = targets.map((t) => {
    const c = t.criteria as unknown as MinScoreCriteria;
    return { ...simulateMinScore(c, currentGrades), name: `${t.university_name} ${t.department}` };
  });
  const improvedResults = targets.map((t) => {
    const c = t.criteria as unknown as MinScoreCriteria;
    return { ...simulateMinScore(c, improvedGrades), name: `${t.university_name} ${t.department}` };
  });

  const currentMet = currentResults.filter((r) => r.isMet).length;
  const afterMet = improvedResults.filter((r) => r.isMet).length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <h4 className="mb-3 text-sm font-medium text-[var(--text-primary)]">What-If 시나리오</h4>
      <div className="flex items-end gap-3">
        <div>
          <label className="mb-1 block text-[10px] text-[var(--text-tertiary)]">과목</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-md border border-gray-200 bg-[var(--bg-surface)] px-2 py-1.5 text-sm dark:border-gray-700">
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-[var(--text-tertiary)]">현재 등급</label>
          <input type="number" min={1} max={9} value={currentGrade} onChange={(e) => setCurrentGrade(Number(e.target.value))} className="w-16 rounded-md border border-gray-200 px-2 py-1.5 text-center text-sm dark:border-gray-700 dark:bg-gray-800" />
        </div>
        <span className="pb-1 text-sm text-[var(--text-tertiary)]">→</span>
        <div>
          <label className="mb-1 block text-[10px] text-[var(--text-tertiary)]">개선 등급</label>
          <input type="number" min={1} max={9} value={improvedGrade} onChange={(e) => setImprovedGrade(Number(e.target.value))} className="w-16 rounded-md border border-gray-200 px-2 py-1.5 text-center text-sm dark:border-gray-700 dark:bg-gray-800" />
        </div>
        <p className="pb-1 text-sm">
          충족: <span className="text-[var(--text-tertiary)]">{currentMet}</span> → <span className="font-medium text-emerald-600">{afterMet}</span>개
          {afterMet > currentMet && <span className="ml-1 text-xs text-emerald-600">(+{afterMet - currentMet})</span>}
        </p>
      </div>
    </div>
  );
}
