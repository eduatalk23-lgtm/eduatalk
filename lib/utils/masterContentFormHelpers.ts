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
    difficulty_level_id: getFormUuid(formData, "difficulty_level_id"),
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
  // UUID 필드 전용 헬퍼: 폼 필드가 있으면 값을 반환하고, 없으면 undefined 반환
  // 빈 문자열이면 null 반환 (명시적으로 삭제), 값이 있으면 그대로 반환
  const getFormUuidValue = (key: string): string | null | undefined => {
    const value = formData.get(key);
    if (value === null) return undefined; // 폼에 필드가 없음 → 업데이트하지 않음
    const str = value.toString().trim();
    return str === "" ? null : str; // 빈 문자열 → null로 설정 (삭제), 값 있음 → 그대로
  };

  // 헬퍼 함수: 폼 필드가 있으면 값을 반환하고, 없으면 undefined 반환
  // 빈 문자열이면 null 반환 (명시적으로 삭제)
  const getFormValue = (key: string): string | null | undefined => {
    const value = formData.get(key);
    if (value === null) return undefined; // 폼에 필드가 없음 → 업데이트하지 않음
    const str = value.toString();
    return str.trim() === "" ? null : str.trim(); // 빈 문자열 → null로 설정 (삭제)
  };

  const contentUrl = getFormString(formData, "content_url");
  const updateData: Partial<
    Omit<MasterCustomContent, "id" | "created_at" | "updated_at">
  > = {
    revision: getFormValue("revision") || undefined,
    content_category: getFormValue("content_category") || undefined,
    title: formData.get("title")?.toString() || "",
    difficulty_level_id: getFormUuidValue("difficulty_level_id"),
    notes: getFormValue("notes"),
    content_type: getFormValue("content_type") || undefined,
    total_page_or_time: getFormInt(formData, "total_page_or_time") ?? undefined,
    subject: getFormValue("subject") || undefined,
    subject_category: getFormValue("subject_category") || undefined,
    curriculum_revision_id: getFormUuidValue("curriculum_revision_id"),
    subject_id: getFormUuidValue("subject_id"),
    subject_group_id: getFormUuidValue("subject_group_id"),
    content_url: contentUrl === "" ? null : contentUrl,
  };

  // undefined 값 제거 (null은 유지 - 명시적 삭제를 위해)
  return Object.fromEntries(
    Object.entries(updateData).filter(([_, v]) => v !== undefined)
  ) as Partial<Omit<MasterCustomContent, "id" | "created_at" | "updated_at">>;
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
    difficulty_level_id: getFormUuid(formData, "difficulty_level_id"),
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

  // UUID 필드 전용 헬퍼: 폼 필드가 있으면 값을 반환하고, 없으면 undefined 반환
  // 빈 문자열이면 null 반환 (명시적으로 삭제), 값이 있으면 그대로 반환
  const getFormUuidValue = (key: string): string | null | undefined => {
    const value = formData.get(key);
    if (value === null) return undefined; // 폼에 필드가 없음 → 업데이트하지 않음
    const str = value.toString().trim();
    return str === "" ? null : str; // 빈 문자열 → null로 설정 (삭제), 값 있음 → 그대로
  };

  // school_type 전용 헬퍼: 빈 문자열을 null로 변환하고, 유효하지 않은 값도 null로 처리
  const getSchoolTypeValue = (): string | null | undefined => {
    const value = formData.get("school_type");
    if (value === null) return undefined; // 폼에 필드가 없음 → 업데이트하지 않음
    const str = value.toString().trim();
    if (str === "") return null; // 빈 문자열 → null로 설정 (삭제)
    // 유효한 enum 값인지 확인
    if (str === "MIDDLE" || str === "HIGH" || str === "OTHER") {
      return str;
    }
    // 유효하지 않은 값이면 null로 처리
    return null;
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
    curriculum_revision_id: getFormUuidValue("curriculum_revision_id"),
    subject_id: getFormUuidValue("subject_id"),
    subject_group_id: getFormUuidValue("subject_group_id"),
    subject_category: getFormValue("subject_category") || undefined,
    subject: getFormValue("subject") || undefined,
    grade_min: getFormInt(formData, "grade_min") ?? undefined,
    grade_max: getFormInt(formData, "grade_max") ?? undefined,
    school_type: getSchoolTypeValue(), // 수정: 전용 헬퍼 사용 (빈 문자열 → null 처리)
    revision: getFormValue("revision") || undefined,
    content_category: getFormValue("content_category") || undefined,
    subtitle: getFormValue("subtitle"),
    series_name: getFormValue("series_name"),
    author: getFormValue("author"),
    publisher_id: getFormUuidValue("publisher_id"),
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
    difficulty_level_id: getFormUuidValue("difficulty_level_id"),
    notes: getFormValue("notes"),
  };

  // undefined 값 제거 (null은 유지 - 명시적 삭제를 위해)
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
    is_active: true, // 필수 필드
    revision: getFormString(formData, "revision"),
    content_category: getFormString(formData, "content_category"),
    subject_category: getFormString(formData, "subject_category"),
    subject: getFormString(formData, "subject"),
    title: getFormString(formData, "title") || "",
    platform_name: getFormString(formData, "platform_name") || getFormString(formData, "platform"),
    platform: getFormString(formData, "platform"),
    total_episodes: getFormInt(formData, "total_episodes") || 0,
    total_duration: totalDuration,
    difficulty_level_id: getFormUuid(formData, "difficulty_level_id"),
    notes: getFormString(formData, "notes"),
    linked_book_id: getFormUuid(formData, "linked_book_id"),
    instructor_name: getFormString(formData, "instructor_name"),
    grade_level: getFormString(formData, "grade_level"),
    grade_min: getFormInt(formData, "grade_min") || null,
    grade_max: getFormInt(formData, "grade_max") || null,
    lecture_type: getFormString(formData, "lecture_type"),
    lecture_source_url: getFormString(formData, "lecture_source_url"),
    source_url: getFormString(formData, "source_url"),
    video_url: getFormString(formData, "video_url"),
    cover_image_url: getFormString(formData, "cover_image_url"),
    // 선택적 필드들 (타입에 정의되어 있지만 폼에서 제공하지 않는 경우)
    curriculum_revision_id: getFormUuid(formData, "curriculum_revision_id") || null,
    subject_id: getFormUuid(formData, "subject_id") || null,
    subject_group_id: getFormUuid(formData, "subject_group_id") || null,
  } as Omit<MasterLecture, "id" | "created_at" | "updated_at">;
}

/**
 * FormData에서 MasterLecture 업데이트 데이터 추출
 * @param formData FormData 객체
 * @returns MasterLecture 업데이트 데이터
 */
export function parseMasterLectureUpdateFormData(
  formData: FormData
): Partial<Omit<MasterLecture, "id" | "created_at" | "updated_at">> {
  // UUID 필드 전용 헬퍼: 폼 필드가 있으면 값을 반환하고, 없으면 undefined 반환
  // 빈 문자열이면 null 반환 (명시적으로 삭제), 값이 있으면 그대로 반환
  const getFormUuidValue = (key: string): string | null | undefined => {
    const value = formData.get(key);
    if (value === null) return undefined; // 폼에 필드가 없음 → 업데이트하지 않음
    const str = value.toString().trim();
    return str === "" ? null : str; // 빈 문자열 → null로 설정 (삭제), 값 있음 → 그대로
  };

  // 헬퍼 함수: 폼 필드가 있으면 값을 반환하고, 없으면 undefined 반환
  // 빈 문자열이면 null 반환 (명시적으로 삭제)
  const getFormValue = (key: string): string | null | undefined => {
    const value = formData.get(key);
    if (value === null) return undefined; // 폼에 필드가 없음 → 업데이트하지 않음
    const str = value.toString();
    return str.trim() === "" ? null : str.trim(); // 빈 문자열 → null로 설정 (삭제)
  };

  const totalDurationMinutes = getFormInt(formData, "total_duration");
  const totalDuration = totalDurationMinutes
    ? minutesToSeconds(totalDurationMinutes)
    : null;

  const updateData: Partial<
    Omit<MasterLecture, "id" | "created_at" | "updated_at">
  > = {
    revision: getFormValue("revision") || undefined,
    content_category: getFormValue("content_category") || undefined,
    subject_category: getFormValue("subject_category") || undefined,
    subject: getFormValue("subject") || undefined,
    title: formData.get("title")?.toString(),
    platform: getFormValue("platform") || undefined,
    total_episodes: getFormInt(formData, "total_episodes") ?? undefined,
    total_duration: totalDuration,
    difficulty_level_id: getFormUuidValue("difficulty_level_id"),
    notes: getFormValue("notes"),
    linked_book_id: getFormUuidValue("linked_book_id"),
    video_url: getFormValue("video_url") || undefined,
    lecture_source_url: getFormValue("lecture_source_url") || undefined,
    cover_image_url: getFormValue("cover_image_url") || undefined,
    // UUID 필드들도 일관된 처리
    curriculum_revision_id: getFormUuidValue("curriculum_revision_id"),
    subject_id: getFormUuidValue("subject_id"),
    subject_group_id: getFormUuidValue("subject_group_id"),
  };

  // undefined 값 제거 (null은 유지 - 명시적 삭제를 위해)
  return Object.fromEntries(
    Object.entries(updateData).filter(([_, v]) => v !== undefined)
  ) as Partial<Omit<MasterLecture, "id" | "created_at" | "updated_at">>;
}

