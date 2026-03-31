"use server";

// ============================================
// H3: 학년 자동 진급 + 신학년 수강 계획 추천
// Admin이 수동 트리거하거나 Cron으로 매년 3월 실행
// ============================================

import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import { syncAuthBanStatus } from "@/lib/auth/syncAuthBanStatus";

const LOG_CTX = { domain: "student", action: "gradePromotion" };

export interface PromotionResult {
  promoted: number;
  graduated: number;
  skipped: number;
  recommendedCoursePlans: number;
}

/**
 * 테넌트 내 전체 학생 학년 진급 (1→2, 2→3, 3→졸업)
 * + 진급된 학생에게 신학년 수강 계획 자동 추천
 */
export async function promoteAllStudentsAction(): Promise<ActionResponse<PromotionResult>> {
  try {
    const { tenantId } = await requireAdmin();
    if (!tenantId) return createErrorResponse("테넌트 정보가 없습니다.");

    const supabase = await createSupabaseServerClient();
    const adminClient = createSupabaseAdminClient();
    let promoted = 0;
    let graduated = 0;
    let skipped = 0;
    let recommendedCoursePlans = 0;

    // 활성 재원 학생 조회 (is_active는 user_profiles에서 JOIN)
    const { data: students, error } = await supabase
      .from("students")
      .select("id, grade, status, target_major, user_profiles!inner(is_active)")
      .eq("tenant_id", tenantId)
      .eq("user_profiles.is_active", true)
      .eq("status", "enrolled");

    if (error) throw error;
    if (!students || students.length === 0) {
      return createSuccessResponse({ promoted: 0, graduated: 0, skipped: 0, recommendedCoursePlans: 0 });
    }

    for (const student of students) {
      const currentGrade = student.grade as number;
      if (!currentGrade || currentGrade < 1 || currentGrade > 3) {
        skipped++;
        continue;
      }

      if (currentGrade === 3) {
        // 3학년 → 졸업 (비재원 전환)
        const { error: gradError } = await supabase
          .from("students")
          .update({
            grade: 3,
            status: "not_enrolled",
            withdrawn_at: new Date().toISOString(),
            withdrawn_reason: "졸업",
          })
          .eq("id", student.id);

        if (!gradError) {
          graduated++;
          // user_profiles.is_active=false + Auth ban
          if (adminClient) {
            await adminClient.from("user_profiles").update({ is_active: false }).eq("id", student.id);
          }
          await syncAuthBanStatus(student.id, false);
        } else {
          logActionError(LOG_CTX, gradError, { studentId: student.id });
          skipped++;
        }
        continue;
      }

      // 1→2, 2→3 진급
      const newGrade = currentGrade + 1;
      const { error: promoError } = await supabase
        .from("students")
        .update({ grade: newGrade })
        .eq("id", student.id);

      if (promoError) {
        logActionError(LOG_CTX, promoError, { studentId: student.id });
        skipped++;
        continue;
      }

      promoted++;

      // 진급 후 신학년 수강 계획 자동 추천 (target_major가 있는 경우)
      if (student.target_major) {
        try {
          const { generateRecommendationsAction } = await import(
            "@/lib/domains/student-record/actions/coursePlan"
          );
          const recResult = await generateRecommendationsAction(student.id, tenantId);
          if (recResult.success && recResult.data) {
            recommendedCoursePlans += recResult.data.length;
          }
        } catch (err) {
          logActionError({ ...LOG_CTX, action: "gradePromotion.courseRecommendation" }, err, {
            studentId: student.id,
          });
        }
      }
    }

    logActionDebug(LOG_CTX, `학년 진급 완료: ${promoted}명 진급, ${graduated}명 졸업, ${skipped}명 건너뜀, ${recommendedCoursePlans}건 수강 추천`);

    return createSuccessResponse({ promoted, graduated, skipped, recommendedCoursePlans });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return createErrorResponse("학년 진급 처리 중 오류가 발생했습니다.");
  }
}
