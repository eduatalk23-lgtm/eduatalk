// ============================================
// 교정 피드백 API
// POST /api/agent/corrections
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/utils/serverActionLogger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();

    if (!tenantId) {
      return Response.json({ error: "테넌트 정보가 필요합니다." }, { status: 403 });
    }

    const body = await req.json();
    const { sessionId, messageIndex, originalResponse, correctionText, correctionType, contextSummary } = body;

    if (!sessionId || messageIndex == null || !originalResponse || !correctionText) {
      return Response.json({ error: "필수 필드가 누락되었습니다." }, { status: 400 });
    }

    const validTypes = ["factual", "strategic", "nuance", "missing"];
    const type = validTypes.includes(correctionType) ? correctionType : "strategic";

    // 세션 소유권 검증
    const supabase = await createSupabaseServerClient();
    const { data: session } = await supabase
      .from("agent_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!session) {
      return Response.json({ error: "해당 세션에 접근 권한이 없습니다." }, { status: 403 });
    }

    // 교정 저장
    const { error } = await supabase
      .from("agent_corrections")
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        message_index: messageIndex,
        original_response: originalResponse.slice(0, 4000),
        correction_text: correctionText.slice(0, 4000),
        correction_type: type,
        context_summary: contextSummary?.slice(0, 1000) ?? null,
        created_by: userId,
      });

    if (error) {
      logActionError("agent.correction", error.message);
      return Response.json({ error: "교정 저장에 실패했습니다." }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    logActionError("agent.correction", error instanceof Error ? error.message : String(error));
    return Response.json({ error: "에러가 발생했습니다." }, { status: 500 });
  }
}
