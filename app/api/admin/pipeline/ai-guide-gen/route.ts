import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { verifyGuideTenantAccess } from "@/lib/auth/verifyTenantAccess";
import { logActionDebug, logActionError, withActionTiming } from "@/lib/logging/actionLogger";
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
 * 비동기 모델: 메타 검증 + ai_generating 플립까지만 동기 처리하고,
 * 본문 생성(`executeGuideGeneration`) 은 `after()` 콜백으로 background 위임.
 * 즉시 202 를 반환하므로 호출자는 응답을 기다리지 않고 guide row status 폴링으로
 * 완료(`pending_approval`/`ai_failed`) 를 판정해야 한다 — ECONNRESET / fetch
 * abort 가 와도 서버 작업은 영향받지 않음.
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await requireAdminOrConsultant();

    const { guideId } = (await request.json()) as { guideId?: string };

    if (guideId) {
      await verifyGuideTenantAccess(guideId, caller);
    }

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

    logActionDebug(LOG_CTX, `D6 2단계 시작 (background): ${meta.title}`, { guideId: targetId });

    // 응답 직후 background 에서 본문 생성 — 응답 connection 과 분리
    // P1-3: 4분 초과 시 logActionWarn 으로 SLA 경고 (Vercel 5분 마진 인지).
    after(async () => {
      await withActionTiming(
        { ...LOG_CTX, action: "aiGuideGen.background" },
        async () => {
          try {
            await executeGuideGeneration(targetId, input);

            // P1-2: executeGuideGeneration 은 내부적으로
            //   - 성공 → status='draft' 마킹
            //   - 검증/생성 실패(throw 없음) → status='ai_failed' 마킹
            // 따라서 무조건 pending_approval 로 덮어쓰면 ai_failed 가 잠식됨.
            // post-generation status 를 확인해서 'draft' 일 때만 pending_approval 승격.
            const { data: post } = await admin
              .from("exploration_guides")
              .select("status, ai_model_version")
              .eq("id", targetId)
              .single();

            if (post?.status === "draft") {
              await admin
                .from("exploration_guides")
                .update({ status: "pending_approval" })
                .eq("id", targetId);
              logActionDebug(LOG_CTX, `D6 2단계 완료: ${meta.title}`, { guideId: targetId });
            } else if (post?.status === "ai_failed") {
              logActionError(
                LOG_CTX,
                new Error(`generation failed: ${post.ai_model_version ?? "unknown"}`),
                { guideId: targetId, finalStatus: "ai_failed" },
              );
            } else if (post?.status === "ai_partial") {
              // B1: 5분 타임아웃 + streaming_progress 보존. 회수 가능 상태로 보존.
              logActionError(
                LOG_CTX,
                new Error(
                  `generation timed out with partial body: ${post.ai_model_version ?? "unknown"}`,
                ),
                { guideId: targetId, finalStatus: "ai_partial" },
              );
            } else {
              // 예상 외 상태 — 진단을 위해 로깅 후 ai_failed 로 안전하게 강등.
              logActionError(
                LOG_CTX,
                new Error(`unexpected post-generation status: ${post?.status ?? "null"}`),
                { guideId: targetId },
              );
              await admin
                .from("exploration_guides")
                .update({
                  status: "ai_failed",
                  ai_model_version: `unexpected post-status: ${post?.status ?? "null"}`,
                })
                .eq("id", targetId);
            }
          } catch (genError) {
            const msg = genError instanceof Error ? genError.message : String(genError);
            logActionError(LOG_CTX, genError, { guideId: targetId });

            // B1: executeGuideGeneration 이 modelIndex= 타임아웃을 throw 하면서
            //     자체적으로 ai_partial 마킹을 해두었을 수 있다. 그 경우는 보존.
            const { data: cur } = await admin
              .from("exploration_guides")
              .select("status")
              .eq("id", targetId)
              .single();
            if (cur?.status === "ai_partial") {
              logActionError(
                LOG_CTX,
                new Error(`generation timed out with partial body (preserved)`),
                { guideId: targetId, finalStatus: "ai_partial" },
              );
            } else {
              await admin
                .from("exploration_guides")
                .update({ status: "ai_failed", ai_model_version: msg.slice(0, 500) })
                .eq("id", targetId);
            }
          }
        },
        { warnThresholdMs: 240_000 }, // 4분 — Vercel 300s 마진 60s
      );
    });

    // 남은 queued_generation 수(현재 타깃 제외 — 이미 ai_generating 으로 플립됨)
    const { count } = await admin
      .from("exploration_guides")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued_generation")
      .eq("is_latest", true);

    // 202 Accepted — 클라이언트는 이 응답을 받자마자 다음 작업 진행 가능.
    // 본문 생성 완료 여부는 guide row status 폴링으로 판정.
    return NextResponse.json(
      {
        accepted: true,
        guideId: targetId,
        status: "ai_generating",
        remainingQueued: count ?? 0,
      },
      { status: 202 },
    );
  } catch (error) {
    logActionError(LOG_CTX, error, {});
    return NextResponse.json(
      { error: "AI 가이드 생성에 실패했습니다." },
      { status: 500 },
    );
  }
}
