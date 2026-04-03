// ============================================
// 케이스 자동 추출기
// 세션 트레이스에서 진단/전략 도구 결과 감지 → consulting_cases INSERT
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import type { StepTrace } from "../session-logger";
import type { CaseInsertParams } from "./types";
import { maskCaseFields } from "../utils/pii-mask";

const LOG_CTX = { domain: "agent", action: "case-extract" };

/** 케이스 추출 대상 도구 */
const DIAGNOSIS_TOOLS = ["generateDiagnosis", "analyzeCompetency"];
const STRATEGY_TOOLS = ["suggestStrategies"];

interface ExtractedCase {
  diagnosisSummary: string;
  strategySummary: string;
  keyInsights: string[];
}

/**
 * 스텝 트레이스에서 진단+전략 결과를 추출하여 케이스 생성.
 * 진단 또는 전략 도구가 하나라도 성공적으로 호출된 세션에서만 생성.
 */
export function extractCaseFromTraces(traces: StepTrace[]): ExtractedCase | null {
  let diagnosisSummary = "";
  let strategySummary = "";
  const keyInsights: string[] = [];

  for (const trace of traces) {
    if (trace.stepType !== "tool-call" || !trace.toolName) continue;

    const output = trace.toolOutput as Record<string, unknown> | undefined;
    if (!output || output.success !== true) continue;

    const data = output.data as Record<string, unknown> | undefined;
    if (!data) continue;

    // 진단 도구 결과
    if (DIAGNOSIS_TOOLS.includes(trace.toolName)) {
      if (typeof data.summary === "string") {
        diagnosisSummary = data.summary;
      } else if (typeof data.overall === "string") {
        diagnosisSummary = data.overall;
      }

      // 강점/약점 추출
      if (Array.isArray(data.strengths)) {
        keyInsights.push(...data.strengths.filter((s): s is string => typeof s === "string").slice(0, 3));
      }
      if (Array.isArray(data.weaknesses)) {
        keyInsights.push(...data.weaknesses.filter((s): s is string => typeof s === "string").slice(0, 3));
      }
    }

    // 전략 도구 결과
    if (STRATEGY_TOOLS.includes(trace.toolName)) {
      if (typeof data.summary === "string") {
        strategySummary = data.summary;
      } else if (Array.isArray(data.strategies)) {
        strategySummary = data.strategies
          .slice(0, 5)
          .map((s: unknown) => (typeof s === "string" ? s : typeof s === "object" && s && "title" in s ? (s as { title: string }).title : ""))
          .filter(Boolean)
          .join("; ");
      }
    }
  }

  // 최소한 진단 요약이 있어야 케이스 생성
  if (!diagnosisSummary || diagnosisSummary.length < 20) return null;

  // 전략이 없으면 진단만으로 케이스 생성
  if (!strategySummary) strategySummary = "(전략 미생성)";

  return {
    diagnosisSummary: diagnosisSummary.slice(0, 2000),
    strategySummary: strategySummary.slice(0, 2000),
    keyInsights: keyInsights.slice(0, 10),
  };
}

/**
 * 추출된 케이스를 DB에 저장 (fire-and-forget).
 * 임베딩은 pending 상태로 저장 — 배치 스크립트에서 처리.
 */
export async function saveCaseToDb(params: CaseInsertParams): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    // PII 마스킹: 벡터 DB에 저장되는 텍스트에서 민감정보 제거
    const masked = maskCaseFields({
      diagnosisSummary: params.diagnosisSummary,
      strategySummary: params.strategySummary,
      keyInsights: params.keyInsights ?? [],
    });

    const res = await fetch(`${url}/rest/v1/consulting_cases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        tenant_id: params.tenantId,
        session_id: params.sessionId ?? null,
        student_grade: params.studentGrade ?? null,
        school_category: params.schoolCategory ?? null,
        target_major: params.targetMajor ?? null,
        curriculum_revision: params.curriculumRevision ?? null,
        diagnosis_summary: masked.diagnosisSummary,
        strategy_summary: masked.strategySummary,
        key_insights: masked.keyInsights,
      }),
    });
    if (res.ok) {
      logActionDebug(LOG_CTX, "케이스 자동 저장 완료");

      // 실시간 임베딩 생성 (fire-and-forget)
      const rows = (await res.json()) as Array<{ id: string }>;
      if (rows[0]?.id) {
        import("./embedding-service")
          .then(({ embedSingleCase }) => embedSingleCase(rows[0].id))
          .then((ok) => {
            if (ok) logActionDebug(LOG_CTX, `실시간 임베딩 완료: ${rows[0].id}`);
          })
          .catch(() => {
            // 임베딩 실패해도 케이스는 이미 저장됨 — 배치 잡에서 재처리
          });
      }
    } else {
      logActionDebug(LOG_CTX, `케이스 저장 실패: ${res.status}`);
    }
  } catch (e) {
    logActionError(LOG_CTX, e instanceof Error ? e : new Error(String(e)));
  }
}
