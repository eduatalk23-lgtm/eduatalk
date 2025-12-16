/**
 * 마스터 콘텐츠 FormData 파싱 헬퍼
 * 교재, 강의, 커스텀 콘텐츠의 FormData 파싱을 담당합니다.
 */

import {
  getFormString,
  getFormInt,
  getFormUuid,
  getFormArray,
  getFormTags,
} from "./formDataHelpers";
import { MasterCustomContent, MasterBook, MasterLecture } from "@/lib/types/plan";
import { minutesToSeconds } from "./duration";

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

// ============================================
// 마스터 교재 FormData 파싱
// ============================================

/**
 * FormData에서 MasterBook 생성 데이터 추출
 * @param formData FormData 객체
 * @param tenantId 테넌트 ID
 * @returns MasterBook 생성 데이터
 */
export function parseMasterBookFormData(
  formData: FormData,
  tenantId: string | null
): Omit<MasterBook, "id" | "created_at" | "updated_at"> {
  // 배열 필드 처리
  const targetExamTypes = getFormArray(formData, "target_exam_type");
  const tags = getFormTags(formData, "tags");

  return {
    tenant_id: tenantId,
    is_active: true,
    curriculum_revision_id: getFormUuid(formData, "curriculum_revision_id"),
    subject_id: getFormUuid(formData, "subject_id"),
    subject_group_id: getFormUuid(formData, "subject_group_id"),
    subject_category: getFormString(formData, "subject_category"),
    subject: getFormString(formData, "subject"),
    grade_min: getFormInt(formData, "grade_min"),
    grade_max: getFormInt(formData, "grade_max"),
    school_type: getFormString(formData, "school_type"),
    revision: getFormString(formData, "revision"),
    content_category: getFormString(formData, "content_category"),
    title: getFormString(formData, "title") || "",
    subtitle: getFormString(formData, "subtitle"),
    series_name: getFormString(formData, "series_name"),
    author: getFormString(formData, "author"),
    publisher_id: getFormUuid(formData, "publisher_id"),
    publisher_name: getFormString(formData, "publisher_name"),
    isbn_10: getFormString(formData, "isbn_10"),
    isbn_13: getFormString(formData, "isbn_13"),
    edition: getFormString(formData, "edition"),
    published_date: getFormString(formData, "published_date"),
    total_pages: getFormInt(formData, "total_pages"),
    target_exam_type: targetExamTypes.length > 0 ? targetExamTypes : null,
    description: getFormString(formData, "description"),
    toc: getFormString(formData, "toc"),
    publisher_review: getFormString(formData, "publisher_review"),
    tags: tags,
    source: getFormString(formData, "source"),
    source_product_code: getFormString(formData, "source_product_code"),
    source_url: getFormString(formData, "source_url"),
    cover_image_url: getFormString(formData, "cover_image_url"),
    difficulty_level: getFormString(formData, "difficulty_level"),
    notes: getFormString(formData, "notes"),
    pdf_url: getFormString(formData, "pdf_url"),
    ocr_data: null,
    page_analysis: null,
    overall_difficulty: null,
  };
}

/**
 * FormData에서 MasterBook 업데이트 데이터 추출
 * @param formData FormData 객체
 * @returns MasterBook 업데이트 데이터
 */
export function parseMasterBookUpdateFormData(
  formData: FormData
): Partial<Omit<MasterBook, "id" | "created_at" | "updated_at">> {
  // 헬퍼 함수: 폼 필드가 있으면 값을 반환하고, 없으면 undefined 반환
  // 빈 문자열이면 null 반환 (명시적으로 삭제)
  const getFormValue = (key: string): string | null | undefined => {
    const value = formData.get(key);
    if (value === null) return undefined; // 폼에 필드가 없음 → 업데이트하지 않음
    const str = value.toString();
    return str.trim() === "" ? null : str.trim(); // 빈 문자열 → null로 설정 (삭제)
  };

  // 배열 필드 처리
  const targetExamTypes = getFormArray(formData, "target_exam_type");

  // tags 처리: 폼에 필드가 있으면 처리하고, 없으면 undefined
  const tagsValue = getFormValue("tags");
  const tags =
    tagsValue === undefined
      ? undefined
      : tagsValue === null
      ? null
      : tagsValue
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean);

  const updateData: Partial<
    Omit<MasterBook, "id" | "created_at" | "updated_at">
  > = {
    // 필수 필드 또는 폼에 항상 있는 필드
    title: formData.get("title")?.toString(),

    // 폼에 필드가 있을 때만 업데이트하는 필드들
    curriculum_revision_id: getFormValue("curriculum_revision_id") || undefined,
    subject_id: getFormUuid(formData, "subject_id") || undefined,
    subject_group_id: getFormValue("subject_group_id") || undefined,
    subject_category: getFormValue("subject_category") || undefined,
    subject: getFormValue("subject") || undefined,
    grade_min: getFormInt(formData, "grade_min") ?? undefined,
    grade_max: getFormInt(formData, "grade_max") ?? undefined,
    school_type: getFormValue("school_type") || undefined,
    revision: getFormValue("revision") || undefined,
    content_category: getFormValue("content_category") || undefined,
    subtitle: getFormValue("subtitle"),
    series_name: getFormValue("series_name"),
    author: getFormValue("author"),
    publisher_id: getFormValue("publisher_id") || undefined,
    publisher_name: getFormValue("publisher_name"),
    isbn_10: getFormValue("isbn_10"),
    isbn_13: getFormValue("isbn_13"),
    edition: getFormValue("edition"),
    published_date: getFormValue("published_date"),
    total_pages: getFormInt(formData, "total_pages") ?? undefined,
    target_exam_type: targetExamTypes.length > 0 ? targetExamTypes : undefined,
    description: getFormValue("description"),
    toc: getFormValue("toc"),
    publisher_review: getFormValue("publisher_review"),
    tags: tags,
    source: getFormValue("source"),
    source_product_code: getFormValue("source_product_code"),
    source_url: getFormValue("source_url"),
    cover_image_url: getFormValue("cover_image_url"),
    pdf_url: getFormValue("pdf_url"),
    difficulty_level: getFormValue("difficulty_level"),
    notes: getFormValue("notes"),
  };

  // undefined 값 제거
  return Object.fromEntries(
    Object.entries(updateData).filter(([_, v]) => v !== undefined)
  ) as Partial<Omit<MasterBook, "id" | "created_at" | "updated_at">>;
}

// ============================================
// 마스터 강의 FormData 파싱
// ============================================

/**
 * FormData에서 MasterLecture 생성 데이터 추출
 * @param formData FormData 객체
 * @param tenantId 테넌트 ID
 * @returns MasterLecture 생성 데이터
 */
export function parseMasterLectureFormData(
  formData: FormData,
  tenantId: string | null
): Omit<MasterLecture, "id" | "created_at" | "updated_at"> {
  const totalDurationMinutes = getFormInt(formData, "total_duration");
  const totalDuration = totalDurationMinutes
    ? minutesToSeconds(totalDurationMinutes)
    : null;

  return {
    tenant_id: tenantId,
    revision: getFormString(formData, "revision"),
    content_category: getFormString(formData, "content_category"),
    subject_category: getFormString(formData, "subject_category"),
    subject: getFormString(formData, "subject"),
    title: getFormString(formData, "title") || "",
    platform_name: getFormString(formData, "platform_name") || getFormString(formData, "platform"),
    platform: getFormString(formData, "platform"),
    total_episodes: getFormInt(formData, "total_episodes") || 0,
    total_duration: totalDuration,
    difficulty_level: getFormString(formData, "difficulty_level"),
    notes: getFormString(formData, "notes"),
    linked_book_id: getFormUuid(formData, "linked_book_id"),
    instructor_name: getFormString(formData, "instructor_name"),
    grade_level: getFormString(formData, "grade_level"),
    grade_min: getFormInt(formData, "grade_min"),
    grade_max: getFormInt(formData, "grade_max"),
    lecture_type: getFormString(formData, "lecture_type"),
    lecture_source_url: getFormString(formData, "lecture_source_url"),
    source_url: getFormString(formData, "source_url"),
    video_url: getFormString(formData, "video_url"),
    cover_image_url: getFormString(formData, "cover_image_url"),
  };
}

/**
 * FormData에서 MasterLecture 업데이트 데이터 추출
 * @param formData FormData 객체
 * @returns MasterLecture 업데이트 데이터
 */
export function parseMasterLectureUpdateFormData(
  formData: FormData
): Partial<Omit<MasterLecture, "id" | "created_at" | "updated_at">> {
  const totalDurationMinutes = getFormInt(formData, "total_duration");
  const totalDuration = totalDurationMinutes
    ? minutesToSeconds(totalDurationMinutes)
    : null;

  const updateData: Partial<
    Omit<MasterLecture, "id" | "created_at" | "updated_at">
  > = {
    revision: getFormString(formData, "revision"),
    content_category: getFormString(formData, "content_category"),
    subject_category: getFormString(formData, "subject_category"),
    subject: getFormString(formData, "subject"),
    title: formData.get("title")?.toString(),
    platform: getFormString(formData, "platform"),
    total_episodes: getFormInt(formData, "total_episodes") ?? undefined,
    total_duration: totalDuration,
    difficulty_level: getFormString(formData, "difficulty_level"),
    notes: getFormString(formData, "notes"),
    linked_book_id: getFormUuid(formData, "linked_book_id"),
    video_url: getFormString(formData, "video_url"),
    lecture_source_url: getFormString(formData, "lecture_source_url"),
    cover_image_url: getFormString(formData, "cover_image_url"),
  };

  // undefined 값 제거
  return Object.fromEntries(
    Object.entries(updateData).filter(([_, v]) => v !== undefined)
  ) as Partial<Omit<MasterLecture, "id" | "created_at" | "updated_at">>;
}

