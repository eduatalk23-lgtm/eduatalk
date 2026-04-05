"use server";

/**
 * F3-3: 리포트 공유 액션
 *
 * 가이드 공유(lib/domains/guide/actions/share.ts) 패턴을 복제.
 * 공유 생성 시 ReportExportData 스냅샷을 JSONB로 저장하여
 * 조회 시 복잡한 DB 쿼리 없이 즉시 반환.
 */

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError, logActionSuccess } from "@/lib/logging/actionLogger";
import type { ActionResponse } from "@/lib/types/actions";
import { fetchReportData } from "./report";
import { buildReportExportData, type ReportExportData } from "../export/report-export";

const LOG_CTX = { domain: "student-record", module: "report-share" };

// ============================================
// Types
// ============================================

export interface ReportShare {
  id: string;
  student_id: string;
  share_token: string;
  visible_sections: string[];
  is_active: boolean;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SharedReportData {
  share: ReportShare;
  report: ReportExportData;
  visibleSections: string[];
}

// ============================================
// Actions
// ============================================

/**
 * 리포트 공유 링크 생성 (admin/consultant 전용).
 * 현재 시점의 리포트 데이터를 스냅샷으로 저장.
 */
export async function createReportShareAction(
  studentId: string,
  visibleSections: string[],
  options?: { expiresInDays?: number },
): Promise<ActionResponse<{ shareToken: string; shareUrl: string }>> {
  try {
    await requireAdminOrConsultant();
    const user = await getCachedAuthUser();
    if (!user) return { success: false, error: "인증 정보 없음" };

    // 1. 리포트 데이터 수집 + 변환
    const reportResult = await fetchReportData(studentId);
    if (!reportResult.success || !reportResult.data) {
      return { success: false, error: reportResult.error ?? "리포트 데이터를 조회할 수 없습니다." };
    }

    const exportData = buildReportExportData(reportResult.data);

    // 2. DB에 공유 레코드 생성
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "서버 설정 오류" };
    }

    const expiresAt = options?.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 86_400_000).toISOString()
      : null;

    const { data: share, error } = await adminClient
      .from("report_shares")
      .insert({
        student_id: studentId,
        visible_sections: visibleSections,
        report_data: exportData as unknown as Record<string, unknown>,
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select("share_token")
      .single();

    if (error || !share) {
      logActionError({ ...LOG_CTX, action: "createReportShare" }, error);
      return { success: false, error: "공유 링크 생성에 실패했습니다." };
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://timelevelup.com";
    const shareUrl = `${baseUrl}/shared/report/${share.share_token}`;

    logActionSuccess(
      { ...LOG_CTX, action: "createReportShare", userId: user.id },
      { studentId, shareToken: share.share_token },
    );

    return {
      success: true,
      data: { shareToken: share.share_token, shareUrl },
    };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "createReportShare" }, error);
    return { success: false, error: "공유 링크 생성에 실패했습니다." };
  }
}

/**
 * 공유 토큰으로 리포트 조회 (인증 불필요).
 * 저장된 스냅샷을 그대로 반환.
 */
export async function fetchSharedReportAction(
  token: string,
): Promise<ActionResponse<SharedReportData>> {
  try {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "서버 설정 오류" };
    }

    const { data: share, error } = await adminClient
      .from("report_shares")
      .select("id, student_id, share_token, visible_sections, report_data, is_active, expires_at, created_by, created_at")
      .eq("share_token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !share) {
      return { success: false, error: "유효하지 않은 공유 링크입니다." };
    }

    // 만료 체크
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return { success: false, error: "만료된 공유 링크입니다." };
    }

    const report = share.report_data as unknown as ReportExportData;
    const visibleSections = share.visible_sections as string[];

    // visible_sections 필터 적용: 빈 배열이면 전체 노출
    const filteredReport: ReportExportData =
      visibleSections.length > 0
        ? filterReportSections(report, visibleSections)
        : report;

    return {
      success: true,
      data: {
        share: {
          id: share.id,
          student_id: share.student_id,
          share_token: share.share_token,
          visible_sections: visibleSections,
          is_active: share.is_active,
          expires_at: share.expires_at,
          created_by: share.created_by,
          created_at: share.created_at,
        },
        report: filteredReport,
        visibleSections,
      },
    };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchSharedReport" }, error);
    return { success: false, error: "공유 리포트 조회에 실패했습니다." };
  }
}

/**
 * 공유 비활성화 (admin/consultant 전용).
 */
export async function deactivateReportShareAction(
  shareId: string,
): Promise<ActionResponse<null>> {
  try {
    await requireAdminOrConsultant();

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "서버 설정 오류" };
    }

    const { error } = await adminClient
      .from("report_shares")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", shareId);

    if (error) {
      return { success: false, error: "공유 비활성화에 실패했습니다." };
    }

    return { success: true, data: null };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deactivateReportShare" }, error);
    return { success: false, error: "공유 비활성화에 실패했습니다." };
  }
}

// ============================================
// Helpers
// ============================================

/** visible_sections에 포함된 필드만 남기고 나머지 null 처리 */
function filterReportSections(
  report: ReportExportData,
  visibleSections: string[],
): ReportExportData {
  const set = new Set(visibleSections);

  return {
    // 항상 노출되는 기본 필드
    title: report.title,
    studentName: report.studentName,
    targetGrades: report.targetGrades,
    createdAt: report.createdAt,
    mode: report.mode,

    // 필터 대상 필드
    sections: set.has("sections") ? report.sections : [],
    editedText: set.has("editedText") ? report.editedText : null,
    diagnosis: set.has("diagnosis") ? report.diagnosis : null,
    competencyScores: set.has("competencyScores") ? report.competencyScores : null,
    courseAdequacy: set.has("courseAdequacy") ? report.courseAdequacy : null,
    strategies: set.has("strategies") ? report.strategies : null,
    mockAnalysis: set.has("mockAnalysis") ? report.mockAnalysis : null,
    edgeSummary: set.has("edgeSummary") ? report.edgeSummary : null,
    roadmapItems: set.has("roadmapItems") ? report.roadmapItems : null,
    interviewQuestions: set.has("interviewQuestions") ? report.interviewQuestions : null,
    changcheGuides: set.has("changcheGuides") ? report.changcheGuides : null,
    haengteukGuide: set.has("haengteukGuide") ? report.haengteukGuide : null,
    coursePlansByGrade: set.has("coursePlansByGrade") ? report.coursePlansByGrade : null,
    actionItems: set.has("actionItems") ? report.actionItems : null,
    univStrategies: set.has("univStrategies") ? report.univStrategies : null,
  };
}
