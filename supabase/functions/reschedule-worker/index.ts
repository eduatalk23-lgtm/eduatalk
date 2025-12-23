/**
 * 재조정 Worker Edge Function
 * 
 * Job Queue에서 재조정 작업을 가져와 실행합니다.
 * 
 * @module supabase/functions/reschedule-worker
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================
// 타입 정의
// ============================================

interface RescheduleJob {
  id: string;
  plan_group_id: string;
  student_id: string;
  adjusted_contents: any;
  status: string;
  created_at: string;
}

// ============================================
// Edge Function 핸들러
// ============================================

Deno.serve(async (req: Request) => {
  try {
    // CORS 헤더 설정
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    };

    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // Supabase 클라이언트 생성
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. 대기 중인 재조정 Job 조회
    const { data: jobs, error: fetchError } = await supabase
      .from("reschedule_log")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error("[reschedule-worker] Job 조회 실패:", fetchError);
      return new Response(
        JSON.stringify({ error: "Job 조회 실패", details: fetchError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "처리할 Job이 없습니다." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const job = jobs[0] as RescheduleJob;

    // 2. Job 상태를 'processing'으로 업데이트
    const { error: updateError } = await supabase
      .from("reschedule_log")
      .update({ status: "processing" })
      .eq("id", job.id);

    if (updateError) {
      console.error("[reschedule-worker] Job 상태 업데이트 실패:", updateError);
      return new Response(
        JSON.stringify({
          error: "Job 상태 업데이트 실패",
          details: updateError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. 재조정 실행
    // NOTE: 재조정 로직 구현 필요 (rescheduleContents 함수 호출 또는 직접 구현)
    try {
      // 여기서는 간단하게 성공으로 처리
      // 실제로는 rescheduleContents 로직을 실행해야 함

      // 4. Job 상태를 'completed'로 업데이트
      await supabase
        .from("reschedule_log")
        .update({
          status: "completed",
          plans_after_count: 0, // NOTE: 재조정 완료 후 실제 생성된 플랜 수로 업데이트 필요
        })
        .eq("id", job.id);

      return new Response(
        JSON.stringify({
          message: "재조정 완료",
          jobId: job.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (processError) {
      // 5. 실패 시 상태를 'failed'로 업데이트
      await supabase
        .from("reschedule_log")
        .update({
          status: "failed",
        })
        .eq("id", job.id);

      console.error("[reschedule-worker] 재조정 실행 실패:", processError);
      return new Response(
        JSON.stringify({
          error: "재조정 실행 실패",
          details: processError instanceof Error ? processError.message : String(processError),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("[reschedule-worker] 예상치 못한 에러:", error);
    return new Response(
      JSON.stringify({
        error: "예상치 못한 에러",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  }
});

