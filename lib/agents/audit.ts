// ============================================
// 에이전트 감사 로그 — fire-and-forget DB 저장
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

interface AgentAuditParams {
  tenantId: string;
  userId: string;
  studentId: string;
  messageCount: number;
  durationMs: number;
  error?: string;
}

const LOG_CTX = { domain: "agent", action: "audit" };

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

/**
 * 에이전트 감사 로그 저장 (재시도 포함).
 * Supabase REST API로 직접 INSERT — 타입 생성 불필요.
 * 최대 3회(초기 + 재시도 2회) 시도 후 실패 시 경고 로그.
 */
export async function logAgentAudit(params: AgentAuditParams): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    logActionDebug(LOG_CTX, "Supabase 환경변수 미설정, 감사 로그 건너뜀");
    return;
  }

  const payload = JSON.stringify({
    tenant_id: params.tenantId,
    user_id: params.userId,
    student_id: params.studentId,
    message_count: params.messageCount,
    duration_ms: params.durationMs,
    error: params.error ?? null,
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${url}/rest/v1/agent_audit_logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${key}`,
          Prefer: "return=minimal",
        },
        body: payload,
      });
      if (res.ok) return;

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_MS * (attempt + 1)));
        continue;
      }
      logActionDebug(LOG_CTX, `감사 로그 저장 실패 (${attempt + 1}회 시도): ${res.status}`);
    } catch (e) {
      if (attempt >= MAX_RETRIES) {
        logActionError(LOG_CTX, e instanceof Error ? e : new Error(String(e)));
      }
    }
  }
}
