/**
 * 마스터 커스텀 콘텐츠 FormData 파싱 헬퍼
 */

import { getFormString, getFormInt, getFormUuid } from "./formDataHelpers";
import { MasterCustomContent } from "@/lib/types/plan";

/**
 * FormData에서 MasterCustomContent 생성 데이터 추출
 * @param formData FormData 객체
 * @param tenantId 테넌트 ID
 * @returns MasterCustomContent 생성 데이터
 */
export function parseMasterCustomContentFormData(
  formData: FormData,
  tenantId: string | null
): Omit<MasterCustomContent, "id" | "created_at" | "updated_at"> {
  const contentUrl = getFormString(formData, "content_url");
  return {
    tenant_id: tenantId,
    revision: getFormString(formData, "revision"),
    content_category: getFormString(formData, "content_category"),
    title: getFormString(formData, "title") || "",
    difficulty_level: getFormString(formData, "difficulty_level"),
    notes: getFormString(formData, "notes"),
    content_type: getFormString(formData, "content_type"),
    total_page_or_time: getFormInt(formData, "total_page_or_time"),
    subject: getFormString(formData, "subject"),
    subject_category: getFormString(formData, "subject_category"),
    curriculum_revision_id: getFormUuid(formData, "curriculum_revision_id"),
    subject_id: getFormUuid(formData, "subject_id"),
    subject_group_id: getFormUuid(formData, "subject_group_id"),
    content_url: contentUrl === "" ? null : contentUrl,
  };
}

/**
 * FormData에서 MasterCustomContent 업데이트 데이터 추출
 * @param formData FormData 객체
 * @returns MasterCustomContent 업데이트 데이터
 */
export function parseMasterCustomContentUpdateFormData(
  formData: FormData
): Partial<Omit<MasterCustomContent, "id" | "created_at" | "updated_at">> {
  const contentUrl = getFormString(formData, "content_url");
  return {
    revision: getFormString(formData, "revision"),
    content_category: getFormString(formData, "content_category"),
    title: getFormString(formData, "title") || "",
    difficulty_level: getFormString(formData, "difficulty_level"),
    notes: getFormString(formData, "notes"),
    content_type: getFormString(formData, "content_type"),
    total_page_or_time: getFormInt(formData, "total_page_or_time"),
    subject: getFormString(formData, "subject"),
    subject_category: getFormString(formData, "subject_category"),
    curriculum_revision_id: getFormUuid(formData, "curriculum_revision_id"),
    subject_id: getFormUuid(formData, "subject_id"),
    subject_group_id: getFormUuid(formData, "subject_group_id"),
    content_url: contentUrl === "" ? null : contentUrl,
  };
}

