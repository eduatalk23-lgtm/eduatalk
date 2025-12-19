/**
 * revalidatePath 최적화 헬퍼
 */

import { revalidatePath } from "next/cache";

/**
 * 캠프 템플릿 관련 경로 재검증
 */
export function revalidateCampTemplatePaths(templateId?: string) {
  // 목록 페이지 재검증
  revalidatePath("/admin/camp-templates", "layout");
  revalidatePath("/admin/camp-templates");

  // 대시보드 재검증 (통계 포함)
  revalidatePath("/admin/dashboard", "layout");

  // 상세 페이지 재검증 (템플릿 ID가 있는 경우)
  if (templateId) {
    revalidatePath(`/admin/camp-templates/${templateId}`, "layout");
    revalidatePath(`/admin/camp-templates/${templateId}`);
  }
}

