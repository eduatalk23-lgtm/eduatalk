"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addApplicationAction,
  updateApplicationAction,
  removeApplicationAction,
} from "@/lib/domains/student-record/actions/supplementary";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { APPLICATION_ROUND_LABELS } from "@/lib/domains/student-record";
import type { RecordApplication, InterviewConflict, ApplicationResult } from "@/lib/domains/student-record";
import { cn } from "@/lib/cn";

type ApplicationBoardProps = {
  applications: RecordApplication[];
  interviewConflicts: InterviewConflict[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
};

const RESULT_LABELS: Record<ApplicationResult, { label: string; className: string }> = {
  pending: { label: "대기", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  accepted: { label: "합격", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  waitlisted: { label: "예비", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  rejected: { label: "불합격", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  registered: { label: "등록", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
};

const MAX_EARLY = 6;

export function ApplicationBoard({
  applications,
  interviewConflicts,
  studentId,
  schoolYear,
  tenantId,
}: ApplicationBoardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();

  const earlyApps = applications.filter((a) => a.round.startsWith("early_"));
  const regularApps = applications.filter((a) => a.round.startsWith("regular_"));
  const otherApps = applications.filter(
    (a) => !a.round.startsWith("early_") && !a.round.startsWith("regular_"),
  );

  const hasRegistered = applications.some((a) => a.result === "registered");

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await removeApplicationAction(id);
      if (!result.success) throw new Error("error" in result ? result.error : "삭제 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.supplementaryTab(studentId, schoolYear) });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      {/* 면접일 겹침 경고 */}
      {interviewConflicts.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/20">
          <h4 className="mb-2 text-sm font-medium text-red-700 dark:text-red-400">면접일 겹침 경고</h4>
          <div className="flex flex-col gap-1">
            {interviewConflicts.map((c, i) => (
              <p key={i} className="text-xs text-red-600 dark:text-red-400">
                <span className={cn(
                  "mr-1 rounded px-1 py-0.5 text-[10px] font-bold uppercase",
                  c.severity === "critical" ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800",
                )}>
                  {c.severity === "critical" ? "동일일" : "연일"}
                </span>
                {c.university1} / {c.university2} — {c.conflictDate}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 등록 경고 */}
      {hasRegistered && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-950/20">
          <p className="text-xs text-indigo-700 dark:text-indigo-400">
            등록 완료된 대학이 있습니다. 정시 지원이 제한될 수 있습니다.
          </p>
        </div>
      )}

      {/* 수시 (최대 6장) */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">수시</h3>
          <span className={cn(
            "text-xs font-medium",
            earlyApps.length >= MAX_EARLY ? "text-red-600" : "text-[var(--text-tertiary)]",
          )}>
            {earlyApps.length}/{MAX_EARLY}장
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {earlyApps.map((app) => (
            <ApplicationCard
              key={app.id}
              application={app}
              studentId={studentId}
              schoolYear={schoolYear}
              onDelete={() => {
                if (confirm(`${app.university_name} ${app.department} 지원을 삭제하시겠습니까?`)) {
                  deleteMutation.mutate(app.id);
                }
              }}
            />
          ))}
          {earlyApps.length < MAX_EARLY && earlyApps.length > 0 &&
            Array.from({ length: MAX_EARLY - earlyApps.length }).map((_, i) => (
              <div key={`empty-${i}`} className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-[var(--text-placeholder)] dark:border-gray-700">
                빈 슬롯
              </div>
            ))
          }
        </div>
      </div>

      {/* 정시 (가/나/다) */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-[var(--text-primary)]">정시</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(["regular_ga", "regular_na", "regular_da"] as const).map((round) => {
            const app = regularApps.find((a) => a.round === round);
            return app ? (
              <ApplicationCard
                key={app.id}
                application={app}
                studentId={studentId}
                schoolYear={schoolYear}
                onDelete={() => {
                  if (confirm(`${app.university_name} 지원을 삭제하시겠습니까?`)) {
                    deleteMutation.mutate(app.id);
                  }
                }}
              />
            ) : (
              <div key={round} className="rounded-lg border border-dashed border-gray-200 p-4 text-center dark:border-gray-700">
                <span className="text-xs text-[var(--text-placeholder)]">
                  {APPLICATION_ROUND_LABELS[round]} — 미등록
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 기타 (추가모집/정원외) */}
      {otherApps.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-[var(--text-primary)]">기타</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {otherApps.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                studentId={studentId}
                schoolYear={schoolYear}
                onDelete={() => {
                  if (confirm("이 지원을 삭제하시겠습니까?")) {
                    deleteMutation.mutate(app.id);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 추가 폼 */}
      {showAddForm ? (
        <AddApplicationForm
          studentId={studentId}
          schoolYear={schoolYear}
          tenantId={tenantId}
          earlyCount={earlyApps.length}
          onClose={() => setShowAddForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-[var(--text-tertiary)] transition hover:border-gray-400 hover:text-[var(--text-secondary)] dark:border-gray-600"
        >
          + 지원 추가
        </button>
      )}
    </div>
  );
}

// ============================================
// ApplicationCard
// ============================================

function ApplicationCard({
  application,
  studentId,
  schoolYear,
  onDelete,
}: {
  application: RecordApplication;
  studentId: string;
  schoolYear: number;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [result, setResult] = useState(application.result);
  const [competitionRate, setCompetitionRate] = useState(
    application.current_competition_rate?.toString() ?? "",
  );
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async () => {
      const updates: Record<string, unknown> = { result };
      if (competitionRate) {
        updates.current_competition_rate = parseFloat(competitionRate);
        updates.competition_updated_at = new Date().toISOString();
      }
      const res = await updateApplicationAction(application.id, updates);
      if (!res.success) throw new Error("error" in res ? res.error : "수정 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.supplementaryTab(studentId, schoolYear) });
      setIsEditing(false);
    },
  });

  const resultConfig = RESULT_LABELS[application.result as ApplicationResult] ?? RESULT_LABELS.pending;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs text-[var(--text-tertiary)]">
            {APPLICATION_ROUND_LABELS[application.round] ?? application.round}
          </span>
          <h4 className="text-sm font-medium text-[var(--text-primary)]">{application.university_name}</h4>
          <p className="text-xs text-[var(--text-secondary)]">{application.department}</p>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", resultConfig.className)}>
          {resultConfig.label}
        </span>
      </div>

      {application.score_type && (
        <span className={cn(
          "mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium",
          application.score_type === "estimated"
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        )}>
          {application.score_type === "estimated" ? "가채점" : "실채점"}
        </span>
      )}

      {application.interview_date && (
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          면접: {application.interview_date}
          {application.interview_time ? ` ${application.interview_time}` : ""}
        </p>
      )}

      {application.current_competition_rate && (
        <p className="text-xs text-[var(--text-tertiary)]">
          경쟁률: {application.current_competition_rate}:1
        </p>
      )}

      {isEditing ? (
        <div className="mt-2 flex flex-col gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
          <div className="flex gap-2">
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="flex-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
            >
              {(Object.entries(RESULT_LABELS) as [ApplicationResult, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <input
              value={competitionRate}
              onChange={(e) => setCompetitionRate(e.target.value)}
              placeholder="경쟁률"
              className="w-20 rounded-md border border-gray-200 px-2 py-1 text-center text-xs dark:border-gray-700 dark:bg-gray-800"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              저장
            </button>
            <button onClick={() => setIsEditing(false)} className="text-xs text-[var(--text-tertiary)]">취소</button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
          <button onClick={() => setIsEditing(true)} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">수정</button>
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">삭제</button>
        </div>
      )}
    </div>
  );
}

// ============================================
// AddApplicationForm
// ============================================

function AddApplicationForm({
  studentId,
  schoolYear,
  tenantId,
  earlyCount,
  onClose,
}: {
  studentId: string;
  schoolYear: number;
  tenantId: string;
  earlyCount: number;
  onClose: () => void;
}) {
  const [round, setRound] = useState<string>("early_comprehensive");
  const [universityName, setUniversityName] = useState("");
  const [department, setDepartment] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [scoreType, setScoreType] = useState<string>("");
  const queryClient = useQueryClient();

  const isEarly = round.startsWith("early_");
  const isRegular = round.startsWith("regular_");
  const earlyFull = isEarly && earlyCount >= MAX_EARLY;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!universityName.trim()) throw new Error("대학명을 입력해주세요.");
      if (!department.trim()) throw new Error("학과를 입력해주세요.");
      const result = await addApplicationAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        round,
        university_name: universityName.trim(),
        department: department.trim(),
        interview_date: interviewDate || null,
        score_type: isRegular && scoreType ? scoreType : null,
      });
      if (!result.success) throw new Error("error" in result ? result.error : "추가 실패");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.supplementaryTab(studentId, schoolYear) });
      onClose();
    },
  });

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-primary)]">지원 추가</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)]">취소</button>
      </div>
      {earlyFull && (
        <p className="mb-2 text-xs text-red-600">수시 6장이 모두 등록되어 있습니다. 정시/기타만 추가 가능합니다.</p>
      )}
      <div className="flex flex-col gap-3">
        <div className={cn("grid grid-cols-2 gap-3", isRegular ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
          <select
            value={round}
            onChange={(e) => setRound(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {Object.entries(APPLICATION_ROUND_LABELS).map(([k, v]) => (
              <option key={k} value={k} disabled={k.startsWith("early_") && earlyFull}>
                {v}
              </option>
            ))}
          </select>
          <input
            value={universityName}
            onChange={(e) => setUniversityName(e.target.value)}
            placeholder="대학명 *"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="학과 *"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <input
            type="date"
            value={interviewDate}
            onChange={(e) => setInterviewDate(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="면접일"
          />
          {isRegular && (
            <select
              value={scoreType}
              onChange={(e) => setScoreType(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">점수 유형</option>
              <option value="estimated">가채점</option>
              <option value="actual">실채점</option>
            </select>
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || earlyFull}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? "추가 중..." : "추가"}
          </button>
        </div>
        {mutation.isError && <p className="text-xs text-red-600">{mutation.error.message}</p>}
      </div>
    </div>
  );
}
