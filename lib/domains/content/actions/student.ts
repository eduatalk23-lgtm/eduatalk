"use server";

/**
 * Student Content Actions
 *
 * 학생 콘텐츠(교재, 강의, 커스텀) CRUD 작업
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  createBook as createBookData,
  updateBook as updateBookData,
  deleteBook as deleteBookData,
  createLecture as createLectureData,
  updateLecture as updateLectureData,
  deleteLecture as deleteLectureData,
  createCustomContent as createCustomContentData,
  updateCustomContent as updateCustomContentData,
  deleteCustomContent as deleteCustomContentData,
} from "@/lib/data/studentContents";
import { getPlansForStudent } from "@/lib/data/studentPlans";
import { getNumberFromFormData } from "@/lib/utils/formDataHelpers";

// 책 등록
export async function addBook(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new Error("기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }

  const title = String(formData.get("title"));
  const revision = String(formData.get("revision") || "");
  const semester = String(formData.get("semester") || "");
  const subjectCategory = String(formData.get("subject_category") || "");
  const subject = String(formData.get("subject") || "");
  const publisher = String(formData.get("publisher") || "");
  const difficulty = String(formData.get("difficulty") || "");
  const totalPages = Number(formData.get("total_pages") || 0);
  const notes = String(formData.get("notes") || "");
  const coverImageUrl = String(formData.get("cover_image_url") || "");

  const result = await createBookData({
    tenant_id: tenantContext.tenantId,
    student_id: user.userId,
    title,
    revision: revision || null,
    semester: semester || null,
    subject_category: subjectCategory || null,
    subject: subject || null,
    publisher: publisher || null,
    difficulty_level: difficulty || null,
    total_pages: totalPages || null,
    notes: notes || null,
    cover_image_url: coverImageUrl || null,
  });

  if (!result.success) {
    throw new Error(result.error || "책 등록에 실패했습니다.");
  }

  // 교재 상세 정보 추가 (있는 경우)
  const detailsJson = formData.get("details")?.toString();
  if (detailsJson && result.bookId) {
    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();

      const details = JSON.parse(detailsJson) as Array<{
        major_unit?: string | null;
        minor_unit?: string | null;
        page_number: number;
        display_order: number;
      }>;

      const studentDetails = details.map((detail) => ({
        book_id: result.bookId!,
        major_unit: detail.major_unit || null,
        minor_unit: detail.minor_unit || null,
        page_number: detail.page_number || 0,
        display_order: detail.display_order || 0,
      }));

      const { error: detailsError } = await supabase
        .from("student_book_details")
        .insert(studentDetails);

      if (detailsError) {
        console.error("교재 상세 정보 추가 실패:", detailsError);
        // 상세 정보 추가 실패해도 교재는 생성됨
      }
    } catch (error) {
      console.error("교재 상세 정보 파싱 실패:", error);
      // 상세 정보 파싱 실패해도 교재는 생성됨
    }
  }

  redirect("/contents");
}

// 책 등록 (redirect 없이 bookId 반환)
export async function createBookWithoutRedirect(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false as const, error: "로그인이 필요합니다.", bookId: null };
  }

  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    return { success: false as const, error: "기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.", bookId: null };
  }

  const title = String(formData.get("title"));
  const revision = String(formData.get("revision") || "");
  const semester = String(formData.get("semester") || "");
  const subjectCategory = String(formData.get("subject_category") || "");
  const subject = String(formData.get("subject") || "");
  const publisher = String(formData.get("publisher") || "");
  const difficulty = String(formData.get("difficulty") || "");

  let totalPages: number | null;
  try {
    totalPages = getNumberFromFormData(formData, "total_pages", { min: 1 });
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "총 페이지는 1 이상의 숫자여야 합니다.",
      bookId: null
    };
  }

  const notes = String(formData.get("notes") || "");
  const coverImageUrl = String(formData.get("cover_image_url") || "");

  const result = await createBookData({
    tenant_id: tenantContext.tenantId,
    student_id: user.userId,
    title,
    revision: revision || null,
    semester: semester || null,
    subject_category: subjectCategory || null,
    subject: subject || null,
    publisher: publisher || null,
    difficulty_level: difficulty || null,
    total_pages: totalPages,
    notes: notes || null,
    cover_image_url: coverImageUrl || null,
  });

  if (!result.success) {
    return { success: false as const, error: result.error || "책 등록에 실패했습니다.", bookId: null };
  }

  if (!result.bookId) {
    return { success: false as const, error: "책 ID를 가져올 수 없습니다.", bookId: null };
  }

  // 교재 상세 정보 추가 (있는 경우)
  const detailsJson = formData.get("details")?.toString();
  if (detailsJson && result.bookId) {
    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();

      const details = JSON.parse(detailsJson) as Array<{
        major_unit?: string | null;
        minor_unit?: string | null;
        page_number: number;
        display_order: number;
      }>;

      const studentDetails = details.map((detail) => ({
        book_id: result.bookId!,
        major_unit: detail.major_unit || null,
        minor_unit: detail.minor_unit || null,
        page_number: detail.page_number || 0,
        display_order: detail.display_order || 0,
      }));

      const { error: detailsError } = await supabase
        .from("student_book_details")
        .insert(studentDetails);

      if (detailsError) {
        console.error("교재 상세 정보 추가 실패:", detailsError);
        // 상세 정보 추가 실패해도 교재는 생성됨
      }
    } catch (error) {
      console.error("교재 상세 정보 파싱 실패:", error);
      // 상세 정보 파싱 실패해도 교재는 생성됨
    }
  }

  return { success: true as const, bookId: result.bookId, error: null };
}

// 책 수정
export async function updateBook(id: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const title = String(formData.get("title"));
  const revision = String(formData.get("revision") || "");
  const semester = String(formData.get("semester") || "");
  const subjectCategory = String(formData.get("subject_category") || "");
  const subject = String(formData.get("subject") || "");
  const publisher = String(formData.get("publisher") || "");
  const difficultyLevelId = String(formData.get("difficulty_level_id") || "");
  const totalPages = getNumberFromFormData(formData, "total_pages", { min: 1 });
  const notes = String(formData.get("notes") || "");
  const coverImageUrl = String(formData.get("cover_image_url") || "");

  const result = await updateBookData(id, user.userId, {
    title,
    revision: revision || null,
    semester: semester || null,
    subject_category: subjectCategory || null,
    subject: subject || null,
    publisher: publisher || null,
    difficulty_level_id: difficultyLevelId || null,
    total_pages: totalPages,
    notes: notes || null,
    cover_image_url: coverImageUrl || null,
  });

  if (!result.success) {
    throw new Error(result.error || "책 수정에 실패했습니다.");
  }

  revalidatePath("/contents");
  revalidatePath(`/contents/books/${id}`);

  // redirect는 클라이언트 컴포넌트에서 처리
  // form action으로 직접 사용하는 경우를 위해 남겨둠
  return { success: true };
}

// 책 삭제
export async function deleteBook(id: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const tenantContext = await getTenantContext();

  // plan 참조 확인
  const plans = await getPlansForStudent({
    studentId: user.userId,
    tenantId: tenantContext?.tenantId || null,
    contentType: "book",
  });

  const hasPlanReference = plans.some((plan) => plan.content_id === id);

  if (hasPlanReference) {
    throw new Error(
      "이 책은 학습 플랜에서 사용 중이어서 삭제할 수 없습니다. 먼저 관련 플랜을 삭제해주세요."
    );
  }

  const result = await deleteBookData(id, user.userId);

  if (!result.success) {
    throw new Error(result.error || "책 삭제에 실패했습니다.");
  }

  revalidatePath("/contents");
  redirect("/contents?tab=books");
}

// 강의 등록
export async function addLecture(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new Error("기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }

  const title = String(formData.get("title"));
  const revision = String(formData.get("revision") || "");
  const semester = String(formData.get("semester") || "");
  const subjectCategory = String(formData.get("subject_category") || "");
  const subject = String(formData.get("subject") || "");
  const platform = String(formData.get("platform") || "");
  const difficultyLevelId = String(formData.get("difficulty_level_id") || "");
  const duration = getNumberFromFormData(formData, "duration", { min: 0 });
  const notes = String(formData.get("notes") || "");

  const linkedBookId = String(formData.get("linked_book_id") || "");

  const result = await createLectureData({
    tenant_id: tenantContext.tenantId,
    student_id: user.userId,
    title,
    revision: revision || null,
    semester: semester || null,
    subject_category: subjectCategory || null,
    subject: subject || null,
    platform: platform || null,
    difficulty_level: difficultyLevelId || null,
    duration: duration,
    linked_book_id: linkedBookId || null,
    notes: notes || null,
  });

  if (!result.success) {
    throw new Error(result.error || "강의 등록에 실패했습니다.");
  }

  // 강의 episode 정보 추가 (있는 경우)
  const episodesJson = formData.get("episodes")?.toString();
  if (episodesJson && result.lectureId) {
    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();

      const episodes = JSON.parse(episodesJson) as Array<{
        episode_number: number;
        episode_title?: string | null;
        duration?: number | null;
        display_order: number;
      }>;

      const studentEpisodes = episodes.map((episode) => ({
        lecture_id: result.lectureId!,
        episode_number: episode.episode_number || 0,
        episode_title: episode.episode_title || null,
        duration: episode.duration || null,
        display_order: episode.display_order || 0,
      }));

      const { error: episodesError } = await supabase
        .from("student_lecture_episodes")
        .insert(studentEpisodes);

      if (episodesError) {
        console.error("강의 episode 정보 추가 실패:", episodesError);
        // episode 추가 실패해도 강의는 생성됨
      }
    } catch (error) {
      console.error("강의 episode 정보 파싱 실패:", error);
      // episode 파싱 실패해도 강의는 생성됨
    }
  }

  redirect("/contents");
}

// 강의 수정
export async function updateLecture(id: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const title = String(formData.get("title"));
  const revision = String(formData.get("revision") || "");
  const semester = String(formData.get("semester") || "");
  const subjectCategory = String(formData.get("subject_category") || "");
  const subject = String(formData.get("subject") || "");
  const platform = String(formData.get("platform") || "");
  const difficultyLevelId = String(formData.get("difficulty_level_id") || "");
  const duration = getNumberFromFormData(formData, "duration", { min: 0 });
  const linkedBookId = String(formData.get("linked_book_id") || "");
  const notes = String(formData.get("notes") || "");

  const result = await updateLectureData(id, user.userId, {
    title: title || undefined,
    revision: revision || undefined,
    semester: semester || undefined,
    subject_category: subjectCategory || undefined,
    subject: subject || undefined,
    platform: platform || undefined,
    difficulty_level_id: difficultyLevelId || undefined,
    duration: duration,
    linked_book_id: linkedBookId || undefined,
    notes: notes || undefined,
  });

  if (!result.success) {
    throw new Error(result.error || "강의 수정에 실패했습니다.");
  }

  revalidatePath("/contents");
  revalidatePath(`/contents/lectures/${id}`);

  // redirect는 클라이언트 컴포넌트에서 처리
  return { success: true };
}

// 강의 삭제
export async function deleteLecture(id: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const tenantContext = await getTenantContext();

  // plan 참조 확인
  const plans = await getPlansForStudent({
    studentId: user.userId,
    tenantId: tenantContext?.tenantId || null,
    contentType: "lecture",
  });

  const hasPlanReference = plans.some((plan) => plan.content_id === id);

  if (hasPlanReference) {
    throw new Error(
      "이 강의는 학습 플랜에서 사용 중이어서 삭제할 수 없습니다. 먼저 관련 플랜을 삭제해주세요."
    );
  }

  const result = await deleteLectureData(id, user.userId);

  if (!result.success) {
    throw new Error(result.error || "강의 삭제에 실패했습니다.");
  }

  revalidatePath("/contents");
  redirect("/contents?tab=lectures");
}

// 커스텀 콘텐츠 등록
export async function addCustomContent(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new Error("기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }

  const title = String(formData.get("title"));
  const type = String(formData.get("content_type"));
  const total = getNumberFromFormData(formData, "total", { min: 0 });
  const subject = String(formData.get("subject") || "");

  const result = await createCustomContentData({
    tenant_id: tenantContext.tenantId,
    student_id: user.userId,
    title,
    content_type: type || null,
    total_page_or_time: total,
    subject: subject || null,
  });

  if (!result.success) {
    throw new Error(result.error || "커스텀 콘텐츠 등록에 실패했습니다.");
  }

  redirect("/contents");
}

// 커스텀 콘텐츠 수정
export async function updateCustomContent(id: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const title = String(formData.get("title"));
  const type = String(formData.get("content_type"));
  const total = getNumberFromFormData(formData, "total", { min: 0 });
  const subject = String(formData.get("subject") || "");

  const result = await updateCustomContentData(id, user.userId, {
    title,
    content_type: type || null,
    total_page_or_time: total,
    subject: subject || null,
  });

  if (!result.success) {
    throw new Error(result.error || "커스텀 콘텐츠 수정에 실패했습니다.");
  }

  revalidatePath("/contents");
  revalidatePath(`/contents/custom/${id}`);

  // redirect는 클라이언트 컴포넌트에서 처리
  return { success: true };
}

// 커스텀 콘텐츠 삭제
export async function deleteCustomContent(id: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const tenantContext = await getTenantContext();

  // plan 참조 확인
  const plans = await getPlansForStudent({
    studentId: user.userId,
    tenantId: tenantContext?.tenantId || null,
    contentType: "custom",
  });

  const hasPlanReference = plans.some((plan) => plan.content_id === id);

  if (hasPlanReference) {
    throw new Error(
      "이 커스텀 콘텐츠는 학습 플랜에서 사용 중이어서 삭제할 수 없습니다. 먼저 관련 플랜을 삭제해주세요."
    );
  }

  const result = await deleteCustomContentData(id, user.userId);

  if (!result.success) {
    throw new Error(result.error || "커스텀 콘텐츠 삭제에 실패했습니다.");
  }

  revalidatePath("/contents");
  redirect("/contents?tab=custom");
}

// 일괄 삭제 - 교재
export async function deleteBooks(ids: string[]) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const tenantContext = await getTenantContext();

  // plan 참조 확인
  const plans = await getPlansForStudent({
    studentId: user.userId,
    tenantId: tenantContext?.tenantId || null,
    contentType: "book",
  });

  const hasPlanReference = ids.some((id) => plans.some((plan) => plan.content_id === id));

  if (hasPlanReference) {
    throw new Error(
      "일부 책은 학습 플랜에서 사용 중이어서 삭제할 수 없습니다. 먼저 관련 플랜을 삭제해주세요."
    );
  }

  // 일괄 삭제
  const results = await Promise.allSettled(
    ids.map((id) => deleteBookData(id, user.userId))
  );

  const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success));

  if (failed.length > 0) {
    throw new Error(`${failed.length}개의 책 삭제에 실패했습니다.`);
  }

  revalidatePath("/contents");
}

// 일괄 삭제 - 강의
export async function deleteLectures(ids: string[]) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const tenantContext = await getTenantContext();

  // plan 참조 확인
  const plans = await getPlansForStudent({
    studentId: user.userId,
    tenantId: tenantContext?.tenantId || null,
    contentType: "lecture",
  });

  const hasPlanReference = ids.some((id) => plans.some((plan) => plan.content_id === id));

  if (hasPlanReference) {
    throw new Error(
      "일부 강의는 학습 플랜에서 사용 중이어서 삭제할 수 없습니다. 먼저 관련 플랜을 삭제해주세요."
    );
  }

  // 일괄 삭제
  const results = await Promise.allSettled(
    ids.map((id) => deleteLectureData(id, user.userId))
  );

  const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success));

  if (failed.length > 0) {
    throw new Error(`${failed.length}개의 강의 삭제에 실패했습니다.`);
  }

  revalidatePath("/contents");
}
