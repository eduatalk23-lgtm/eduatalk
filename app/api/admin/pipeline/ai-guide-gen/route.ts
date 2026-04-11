import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executeGuideGeneration } from "@/lib/domains/guide/llm/actions/executeGuideGeneration";
import type { GuideGenerationInput } from "@/lib/domains/guide/llm/types";
import type { GuideType } from "@/lib/domains/guide/types";

export const maxDuration = 300; // 5분 — Vercel Hobby 최대

const LOG_CTX = { domain: "guide", action: "aiGuideGen" };

/**
 * D6(M7) 2단계: queued_generation 셸의 전문 생성
 *
 * 1단계(S2 phase)에서 AI가 설계한 메타 정보를 기반으로
 * generateGuideCore → executeGuideGeneration으로 가이드 전문을 생성합니다.
 *
 * 클라이언트가 S2 완료 후 폴링하여 queued_generation 감지 시 호출.
 * 1건씩 처리 (각 호출이 독립 300초 타임아웃).
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminOrConsultant();

    const { guideId } = (await request.json()) as { guideId?: string };

    const admin = createSupabaseAdminClient()!;

    // guideId 미지정 시 가장 오래된 queued_generation 1건 pop
    let targetId = guideId ?? "";

    if (!guideId) {
      const { data: queued } = await admin
        .from("exploration_guides")
        .select("id, title")
        .eq("status", "queued_generation")
        .eq("is_latest", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (!queued) {
        return NextResponse.json({ completed: true, message: "대기 중인 가이드 없음" });
      }
      targetId = queued.id;
    }

    // ai_generation_meta 읽기
    const { data: guideRow } = await admin
      .from("exploration_guides")
      .select("ai_generation_meta")
      .eq("id", targetId)
      .single();
    const meta = guideRow?.ai_generation_meta as Record<string, unknown> | null;

    if (!targetId || !meta) {
      if (targetId) {
        await admin
          .from("exploration_guides")
          .update({ status: "ai_failed", ai_model_version: "메타 설계도 없음" })
          .eq("id", targetId);
      }
      return NextResponse.json({ error: "ai_generation_meta가 없습니다." }, { status: 400 });
    }

    // 상태를 ai_generating으로 전환 (중복 실행 방지)
    await admin
      .from("exploration_guides")
      .update({ status: "ai_generating" })
      .eq("id", targetId);

    // 메타에서 GuideGenerationInput 조립
    const input: GuideGenerationInput = {
      source: "keyword",
      keyword: {
        keyword: (meta.title as string) ?? "",
        guideType: ((meta.guideType as string) ?? "topic_exploration") as GuideType,
        targetSubject: (meta.subjectConnect as string)?.split(" > ")[0],
        targetCareerField: meta.desiredCareerField as string | undefined,
        additionalContext: [
          meta.storylineConnect ? `이전 탐구와의 연결: ${meta.storylineConnect}` : "",
          meta.directionGuideRef ? `방향 가이드 참조: ${meta.directionGuideRef}` : "",
          Array.isArray(meta.keyTopics) ? `핵심 토픽: ${(meta.keyTopics as string[]).join(", ")}` : "",
          meta.rationale ? `설계 의도: ${meta.rationale}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
      studentId: meta.studentId as string | undefined,
      difficultyLevel: meta.difficultyLevel as string | undefined,
    };

    logActionDebug(LOG_CTX, `D6 2단계 시작: ${meta.title}`, { guideId: targetId });

    try {
      await executeGuideGeneration(targetId, input);

      // 성공 시 pending_approval로 승격
      await admin
        .from("exploration_guides")
        .update({ status: "pending_approval" })
        .eq("id", targetId);

      logActionDebug(LOG_CTX, `D6 2단계 완료: ${meta.title}`, { guideId: targetId });

      // 남은 queued_generation 수 반환
      const { count } = await admin
        .from("exploration_guides")
        .select("id", { count: "exact", head: true })
        .eq("status", "queued_generation")
        .eq("is_latest", true);

      return NextResponse.json({
        completed: true,
        guideId: targetId,
        remainingQueued: count ?? 0,
      });
    } catch (genError) {
      const msg = genError instanceof Error ? genError.message : String(genError);
      logActionError(LOG_CTX, genError, { guideId: targetId });

      await admin
        .from("exploration_guides")
        .update({ status: "ai_failed", ai_model_version: msg.slice(0, 500) })
        .eq("id", targetId);

      return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
    }
  } catch (error) {
    logActionError(LOG_CTX, error, {});
    return NextResponse.json(
      { error: "AI 가이드 생성에 실패했습니다." },
      { status: 500 },
    );
  }
}
