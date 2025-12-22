"use server";

/**
 * Student Plan Actions (FormData 기반)
 *
 * 학생이 직접 플랜을 관리하기 위한 FormData 기반 Server Actions.
 * 폼 제출과 리다이렉트를 처리합니다.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createPlan, updatePlan, deletePlan, getPlanById } from "@/lib/data/studentPlans";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { validateFormData, planSchema } from "@/lib/validation/schemas";

const VALID_CONTENT_TYPES = ["book", "lecture", "custom"] as const;
type ContentType = (typeof VALID_CONTENT_TYPES)[number];

/**
 * 학생 플랜 생성 (FormData)
 */
async function _createStudentPlanForm(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 입력 검증
  const validation = validateFormData(formData, planSchema);
  if (!validation.success) {
    const firstError = validation.errors.issues[0];
    throw new AppError(
      firstError?.message ?? "입력값을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const {
    planDate,
    contentType,
    contentId,
    blockIndex,
    plannedStartPageOrTime,
    plannedEndPageOrTime,
  } = validation.data;

  // 추가 검증
  if (!VALID_CONTENT_TYPES.includes(contentType as ContentType)) {
    throw new AppError("콘텐츠 종류를 선택해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const chapterInput = String(formData.get("chapter") ?? "").trim();
  const dayOfWeekInput = Number(formData.get("day_of_week") ?? "");
  const isReschedulableInput =
    String(formData.get("is_reschedulable") ?? "off") === "on";

  const parsedPlanDate = new Date(`${planDate}T00:00:00Z`);
  if (Number.isNaN(parsedPlanDate.getTime())) {
    throw new AppError("올바른 날짜 형식을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (parsedPlanDate.getUTCDay() !== dayOfWeekInput) {
    throw new AppError("선택한 날짜와 요일이 일치하지 않습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const result = await createPlan({
    tenant_id: tenantContext.tenantId,
    student_id: user.userId,
    plan_date: planDate,
    block_index: blockIndex,
    content_type: contentType as ContentType,
    content_id: contentId,
    chapter: chapterInput || null,
    planned_start_page_or_time: plannedStartPageOrTime ?? null,
    planned_end_page_or_time: plannedEndPageOrTime ?? null,
    is_reschedulable: isReschedulableInput,
  });

  if (!result.success) {
    throw new AppError(
      result.error || "플랜 생성에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/plan");
  redirect("/plan");
}

export const createStudentPlanForm = withErrorHandling(_createStudentPlanForm);

/**
 * 학생 플랜 수정 (FormData)
 */
async function _updateStudentPlanForm(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const planIdInput = String(formData.get("plan_id") ?? "").trim();
  if (!planIdInput) {
    throw new AppError("플랜 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 입력 검증
  const validation = validateFormData(formData, planSchema);
  if (!validation.success) {
    const firstError = validation.errors.issues[0];
    throw new AppError(
      firstError?.message ?? "입력값을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const {
    planDate,
    contentType,
    contentId,
    blockIndex,
    plannedStartPageOrTime,
    plannedEndPageOrTime,
  } = validation.data;

  // 추가 검증
  if (!VALID_CONTENT_TYPES.includes(contentType as ContentType)) {
    throw new AppError("콘텐츠 종류를 선택해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const chapterInput = String(formData.get("chapter") ?? "").trim();
  const dayOfWeekInput = Number(formData.get("day_of_week") ?? "");
  const isReschedulableInput =
    String(formData.get("is_reschedulable") ?? "off") === "on";

  const parsedPlanDate = new Date(`${planDate}T00:00:00Z`);
  if (Number.isNaN(parsedPlanDate.getTime())) {
    throw new AppError("올바른 날짜 형식을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (parsedPlanDate.getUTCDay() !== dayOfWeekInput) {
    throw new AppError("선택한 날짜와 요일이 일치하지 않습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const result = await updatePlan(planIdInput, user.userId, {
    plan_date: planDate,
    block_index: blockIndex,
    content_type: contentType as ContentType,
    content_id: contentId,
    chapter: chapterInput || null,
    planned_start_page_or_time: plannedStartPageOrTime ?? null,
    planned_end_page_or_time: plannedEndPageOrTime ?? null,
    is_reschedulable: isReschedulableInput,
  });

  if (!result.success) {
    throw new AppError(
      result.error || "플랜 업데이트에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/plan");
  revalidatePath(`/plan/${planIdInput}`);
  redirect(`/plan/${planIdInput}`);
}

export const updateStudentPlanForm = withErrorHandling(_updateStudentPlanForm);

/**
 * 학생 플랜 삭제 (FormData)
 */
async function _deleteStudentPlanForm(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  if (!id) {
    throw new AppError("플랜 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const result = await deletePlan(id, user.userId);

  if (!result.success) {
    throw new AppError(
      result.error || "플랜 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/plan");
  redirect("/plan");
}

export const deleteStudentPlanForm = withErrorHandling(_deleteStudentPlanForm);
