"use server";

/**
 * Phase E-1: analyzeRecord tool 서버 액션
 *
 * admin/consultant 가 자연어로 "김세린 생기부 분석 요약해줘" 요청 시
 * tool.execute 가 이 함수를 호출. 학생 해결 → 파이프라인 상태 조회 →
 * 최종 진단 요약을 구조화된 결과로 반환한다.
 *
 * 재실행 트리거는 포함하지 않는다 (5+분 LLM 체인 + rate limit). 분석 시작이
 * 필요하면 결과에 담긴 detailPath 로 admin 페이지 이동 후 수행.
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { fetchGradeAwarePipelineStatus } from "@/lib/domains/student-record/actions/pipeline-orchestrator-status";
import { findDiagnosisByScope } from "@/lib/domains/student-record/repository/diagnosis-repository";
import {
  resolveStudentTarget,
  type StudentTargetCandidate,
} from "@/lib/mcp/tools/_shared/resolveStudent";

/** 후방 호환 alias. 신규 코드는 StudentTargetCandidate 사용. */
export type AnalyzeRecordCandidate = StudentTargetCandidate;

export type AnalyzeRecordStatus =
  | "no_analysis"
  | "running"
  | "partial"
  | "completed";

export type AnalyzeRecordSummary = {
  schoolYear: number;
  overallGrade: string;
  recordDirection: string | null;
  strengths: string[];
  weaknesses: string[];
  recommendedMajors: string[];
};

export type AnalyzeRecordOutput =
  | {
      ok: true;
      studentId: string;
      studentName: string | null;
      status: AnalyzeRecordStatus;
      progress: {
        completedGrades: number[];
        runningGrades: number[];
        synthesisStatus: "none" | "running" | "completed" | "other";
      };
      summary: AnalyzeRecordSummary | null;
      detailPath: string;
    }
  | { ok: false; reason: string; candidates?: AnalyzeRecordCandidate[] };

/**
 * analyzeRecord 는 **admin/consultant/superadmin 전용** — 학생 본인 조회 금지.
 * 공통 resolveStudentTarget 은 student 도 허용하므로 role 게이트를 명시적으로 선행.
 */
async function resolveAnalyzeRecordTarget(
  studentName: string,
): Promise<
  | { ok: true; studentId: string; tenantId: string; studentName: string | null }
  | { ok: false; reason: string; candidates?: AnalyzeRecordCandidate[] }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "로그인이 필요합니다." };
  if (
    user.role !== "admin" &&
    user.role !== "consultant" &&
    user.role !== "superadmin"
  ) {
    return {
      ok: false,
      reason: "생기부 분석 요약은 관리자/컨설턴트만 이용할 수 있어요.",
    };
  }
  return resolveStudentTarget({ studentName });
}

function normalizeSynthesisStatus(
  raw: string | null | undefined,
): "none" | "running" | "completed" | "other" {
  if (!raw) return "none";
  if (raw === "running") return "running";
  if (raw === "completed") return "completed";
  return "other";
}

function deriveOverallStatus(args: {
  completedGrades: number[];
  runningGrades: number[];
  synthesisStatus: "none" | "running" | "completed" | "other";
  hasDiagnosis: boolean;
}): AnalyzeRecordStatus {
  if (args.hasDiagnosis && args.synthesisStatus === "completed") {
    return "completed";
  }
  if (args.runningGrades.length > 0 || args.synthesisStatus === "running") {
    return "running";
  }
  if (args.completedGrades.length > 0 || args.hasDiagnosis) {
    return "partial";
  }
  return "no_analysis";
}

function pickLatestDiagnosis(
  rows: Awaited<ReturnType<typeof findDiagnosisByScope>>,
): AnalyzeRecordSummary | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    if (a.school_year !== b.school_year) return b.school_year - a.school_year;
    // AI 우선 (분석 자동 산출물 기준), 동률이면 updated_at desc
    if (a.source !== b.source) return a.source === "ai" ? -1 : 1;
    return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
  });
  const picked = sorted[0];
  return {
    schoolYear: picked.school_year,
    overallGrade: picked.overall_grade,
    recordDirection: picked.record_direction ?? null,
    strengths: (picked.strengths ?? []).slice(0, 6),
    weaknesses: (picked.weaknesses ?? []).slice(0, 6),
    recommendedMajors: (picked.recommended_majors ?? []).slice(0, 5),
  };
}

export async function lookupRecordAnalysis(
  studentName: string,
): Promise<AnalyzeRecordOutput> {
  const target = await resolveAnalyzeRecordTarget(studentName);
  if (!target.ok) {
    return {
      ok: false,
      reason: target.reason,
      candidates: target.candidates,
    };
  }

  const statusRes = await fetchGradeAwarePipelineStatus(target.studentId);
  const completedGrades: number[] = [];
  const runningGrades: number[] = [];
  let synthesisStatus: "none" | "running" | "completed" | "other" = "none";

  if (statusRes.success && statusRes.data) {
    for (const [gradeStr, p] of Object.entries(statusRes.data.gradePipelines)) {
      const grade = Number(gradeStr);
      if (p.status === "completed") completedGrades.push(grade);
      else if (p.status === "running") runningGrades.push(grade);
    }
    synthesisStatus = normalizeSynthesisStatus(
      statusRes.data.synthesisPipeline?.status,
    );
  }

  let summary: AnalyzeRecordSummary | null = null;
  try {
    const rows = await findDiagnosisByScope(
      target.studentId,
      target.tenantId,
      "final",
    );
    summary = pickLatestDiagnosis(rows);
  } catch {
    summary = null;
  }

  const overall = deriveOverallStatus({
    completedGrades: completedGrades.sort(),
    runningGrades: runningGrades.sort(),
    synthesisStatus,
    hasDiagnosis: summary !== null,
  });

  return {
    ok: true,
    studentId: target.studentId,
    studentName: target.studentName,
    status: overall,
    progress: {
      completedGrades: completedGrades.sort(),
      runningGrades: runningGrades.sort(),
      synthesisStatus,
    },
    summary,
    detailPath: `/admin/students/${target.studentId}`,
  };
}
