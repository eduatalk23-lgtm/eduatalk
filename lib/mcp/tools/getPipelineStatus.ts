/**
 * Phase F-3: getPipelineStatus tool 공유 정의.
 *
 * 학생의 AI 분석 파이프라인(12 태스크) 현재 상태를 조회한다 — read-only.
 * 기존 Agent tool(`record-tools.ts`) 을 MCP 로 승격해 Chat Shell 도 호출 가능.
 */

import { z } from "zod";
import { fetchPipelineStatus } from "@/lib/domains/student-record/actions/pipeline";
import { resolveStudentTarget } from "@/lib/mcp/tools/_shared/resolveStudent";

export type PipelineTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type PipelineStatusOutput =
  | {
      ok: true;
      studentId: string;
      studentName: string | null;
      status: string | null;
      tasks: Record<string, PipelineTaskStatus> | null;
      startedAt: string | null;
      completedAt: string | null;
      /** 파이프라인이 한 번도 실행되지 않았을 때만 true. */
      notStarted: boolean;
    }
  | { ok: false; reason: string };

export const getPipelineStatusDescription =
  "학생의 AI 분석 파이프라인(생기부 분석 12 태스크) 현재 상태를 조회합니다. '분석 어디까지 됐어', '파이프라인 상태' 등 진행 상황 확인 질문 시 호출. 관리자/컨설턴트는 studentName 을 반드시 제공. 학생 본인은 생략.";

export const getPipelineStatusInputShape = {
  studentName: z
    .string()
    .nullable()
    .optional()
    .describe(
      "조회할 학생의 이름. admin/consultant 는 반드시 제공. 학생 본인은 생략.",
    ),
} as const;

export const getPipelineStatusInputSchema = z.object(getPipelineStatusInputShape);

export type GetPipelineStatusInput = z.infer<typeof getPipelineStatusInputSchema>;

export async function getPipelineStatusExecute({
  studentName,
}: GetPipelineStatusInput): Promise<PipelineStatusOutput> {
  const target = await resolveStudentTarget({
    studentName: studentName ?? undefined,
  });
  if (!target.ok) return { ok: false, reason: target.reason };

  const result = await fetchPipelineStatus(target.studentId);
  if (!result.success || !result.data) {
    return {
      ok: true,
      studentId: target.studentId,
      studentName: target.studentName,
      status: null,
      tasks: null,
      startedAt: null,
      completedAt: null,
      notStarted: true,
    };
  }
  const p = result.data;
  return {
    ok: true,
    studentId: target.studentId,
    studentName: target.studentName,
    status: p.status ?? null,
    tasks: (p.tasks ?? null) as Record<string, PipelineTaskStatus> | null,
    startedAt: p.startedAt ?? null,
    completedAt: p.completedAt ?? null,
    notStarted: false,
  };
}
