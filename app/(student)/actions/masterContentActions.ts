"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createMasterBook,
  updateMasterBook,
  createMasterLecture,
  updateMasterLecture,
  createBookDetail,
  updateBookDetail,
  deleteBookDetail,
  createLectureEpisode,
  deleteAllLectureEpisodes,
} from "@/lib/data/contentMasters";
import { MasterBook, MasterLecture, BookDetail, LectureEpisode } from "@/lib/types/plan";

/**
 * 서비스 마스터 교재 생성
 */
export async function addMasterBook(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  // tenant_id 조회
  const { data: student } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  const bookData: Omit<MasterBook, "id" | "created_at" | "updated_at"> = {
    tenant_id: student?.tenant_id || null,
    revision: formData.get("revision")?.toString() || null,
    content_category: formData.get("content_category")?.toString() || null,
    semester: formData.get("semester")?.toString() || null,
    subject_category: formData.get("subject_category")?.toString() || null,
    subject: formData.get("subject")?.toString() || null,
    title: formData.get("title")?.toString() || "",
    publisher: formData.get("publisher")?.toString() || null,
    total_pages: parseInt(formData.get("total_pages")?.toString() || "0"),
    difficulty_level: formData.get("difficulty_level")?.toString() || null,
    notes: formData.get("notes")?.toString() || null,
  };

  if (!bookData.title || !bookData.total_pages) {
    throw new Error("교재명과 총 페이지는 필수입니다.");
  }

  const book = await createMasterBook(bookData);

  // 상세 정보 추가 (있는 경우)
  const detailsJson = formData.get("details")?.toString();
  if (detailsJson) {
    try {
      const details = JSON.parse(detailsJson) as Array<{
        major_unit?: string;
        minor_unit?: string;
        page_number: number;
        display_order: number;
      }>;

      for (const detail of details) {
        await createBookDetail({
          book_id: book.id,
          major_unit: detail.major_unit || null,
          minor_unit: detail.minor_unit || null,
          page_number: detail.page_number,
          display_order: detail.display_order,
        });
      }
    } catch (error) {
      console.error("상세 정보 추가 실패:", error);
      // 상세 정보 추가 실패해도 교재는 생성됨
    }
  }

  redirect(`/admin/master-books/${book.id}`);
}

/**
 * 서비스 마스터 교재 수정
 */
export async function updateMasterBookAction(
  bookId: string,
  formData: FormData
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const updateData: Partial<
    Omit<MasterBook, "id" | "created_at" | "updated_at">
  > = {
    revision: formData.get("revision")?.toString() || null,
    content_category: formData.get("content_category")?.toString() || null,
    semester: formData.get("semester")?.toString() || null,
    subject_category: formData.get("subject_category")?.toString() || null,
    subject: formData.get("subject")?.toString() || null,
    title: formData.get("title")?.toString(),
    publisher: formData.get("publisher")?.toString() || null,
    total_pages: formData.get("total_pages")
      ? parseInt(formData.get("total_pages")!.toString())
      : undefined,
    difficulty_level: formData.get("difficulty_level")?.toString() || null,
    notes: formData.get("notes")?.toString() || null,
  };

  await updateMasterBook(bookId, updateData);

  // 상세 정보 업데이트
  const detailsJson = formData.get("details")?.toString();
  if (detailsJson) {
    try {
      const newDetails = JSON.parse(detailsJson) as Array<{
        major_unit?: string | null;
        minor_unit?: string | null;
        page_number: number;
        display_order: number;
      }>;

      // 기존 상세 정보 삭제 후 새로 추가
      const { deleteAllBookDetails } = await import("@/lib/data/contentMasters");
      await deleteAllBookDetails(bookId);

      // 새 상세 정보 추가
      for (const detail of newDetails) {
        await createBookDetail({
          book_id: bookId,
          major_unit: detail.major_unit || null,
          minor_unit: detail.minor_unit || null,
          page_number: detail.page_number,
          display_order: detail.display_order,
        });
      }
    } catch (error) {
      console.error("상세 정보 업데이트 실패:", error);
      // 상세 정보 업데이트 실패해도 교재는 수정됨
    }
  }

  redirect(`/admin/master-books/${bookId}`);
}

/**
 * 서비스 마스터 강의 생성
 */
export async function addMasterLecture(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  // tenant_id 조회
  const { data: student } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  const lectureData: Omit<MasterLecture, "id" | "created_at" | "updated_at"> =
    {
      tenant_id: student?.tenant_id || null,
      revision: formData.get("revision")?.toString() || null,
      content_category: formData.get("content_category")?.toString() || null,
      semester: formData.get("semester")?.toString() || null,
      subject_category: formData.get("subject_category")?.toString() || null,
      subject: formData.get("subject")?.toString() || null,
      title: formData.get("title")?.toString() || "",
      platform: formData.get("platform")?.toString() || null,
      total_episodes: parseInt(formData.get("total_episodes")?.toString() || "0"),
      total_duration: formData.get("total_duration")
        ? parseInt(formData.get("total_duration")!.toString())
        : null,
      difficulty_level: formData.get("difficulty_level")?.toString() || null,
      notes: formData.get("notes")?.toString() || null,
      linked_book_id: formData.get("linked_book_id")?.toString() || null,
    };

  if (!lectureData.title || !lectureData.total_episodes) {
    throw new Error("강의명과 총 회차는 필수입니다.");
  }

  const lecture = await createMasterLecture(lectureData);

  // 연결된 교재 생성 (있는 경우)
  const bookTitle = formData.get("book_title")?.toString();
  let linkedBookId: string | null = null;

  if (bookTitle) {
    try {
      const bookData: Omit<MasterBook, "id" | "created_at" | "updated_at"> = {
        tenant_id: student?.tenant_id || null,
        revision: formData.get("book_revision")?.toString() || null,
        content_category: null,
        semester: formData.get("book_semester")?.toString() || null,
        subject_category: formData.get("book_subject_category")?.toString() || null,
        subject: formData.get("book_subject")?.toString() || null,
        title: bookTitle,
        publisher: formData.get("book_publisher")?.toString() || null,
        total_pages: formData.get("book_total_pages")
          ? parseInt(formData.get("book_total_pages")!.toString())
          : 0,
        difficulty_level: formData.get("book_difficulty_level")?.toString() || null,
        notes: formData.get("book_notes")?.toString() || null,
      };

      if (!bookData.title || !bookData.total_pages) {
        throw new Error("교재명과 총 페이지는 필수입니다.");
      }

      const book = await createMasterBook(bookData);
      linkedBookId = book.id;

      // 교재 상세 정보 추가 (있는 경우)
      const bookDetailsJson = formData.get("details")?.toString();
      if (bookDetailsJson) {
        try {
          const details = JSON.parse(bookDetailsJson) as Array<{
            major_unit?: string | null;
            minor_unit?: string | null;
            page_number: number;
            display_order: number;
          }>;

          for (const detail of details) {
            await createBookDetail({
              book_id: book.id,
              major_unit: detail.major_unit || null,
              minor_unit: detail.minor_unit || null,
              page_number: detail.page_number,
              display_order: detail.display_order,
            });
          }
        } catch (error) {
          console.error("교재 상세 정보 추가 실패:", error);
          // 상세 정보 추가 실패해도 교재는 생성됨
        }
      }

      // 강의에 교재 연결
      if (linkedBookId) {
        await updateMasterLecture(lecture.id, { linked_book_id: linkedBookId });
      }
    } catch (error) {
      console.error("교재 생성 실패:", error);
      // 교재 생성 실패해도 강의는 생성됨
    }
  }

  // episode 정보 추가 (있는 경우)
  const episodesJson = formData.get("episodes")?.toString();
  if (episodesJson) {
    try {
      const episodes = JSON.parse(episodesJson) as Array<{
        episode_number: number;
        episode_title?: string | null;
        duration?: number | null;
        display_order: number;
      }>;

      for (const episode of episodes) {
        await createLectureEpisode({
          lecture_id: lecture.id,
          episode_number: episode.episode_number,
          episode_title: episode.episode_title || null,
          duration: episode.duration || null,
          display_order: episode.display_order,
        });
      }
    } catch (error) {
      console.error("episode 정보 추가 실패:", error);
      // episode 추가 실패해도 강의는 생성됨
    }
  }

  redirect(`/admin/master-lectures/${lecture.id}`);
}

/**
 * 서비스 마스터 강의 수정
 */
export async function updateMasterLectureAction(
  lectureId: string,
  formData: FormData
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const updateData: Partial<
    Omit<MasterLecture, "id" | "created_at" | "updated_at">
  > = {
    revision: formData.get("revision")?.toString() || null,
    content_category: formData.get("content_category")?.toString() || null,
    semester: formData.get("semester")?.toString() || null,
    subject_category: formData.get("subject_category")?.toString() || null,
    subject: formData.get("subject")?.toString() || null,
    title: formData.get("title")?.toString(),
    platform: formData.get("platform")?.toString() || null,
    total_episodes: formData.get("total_episodes")
      ? parseInt(formData.get("total_episodes")!.toString())
      : undefined,
    total_duration: formData.get("total_duration")
      ? parseInt(formData.get("total_duration")!.toString())
      : null,
    difficulty_level: formData.get("difficulty_level")?.toString() || null,
    notes: formData.get("notes")?.toString() || null,
    linked_book_id: formData.get("linked_book_id")?.toString() || null,
  };

  await updateMasterLecture(lectureId, updateData);

  // episode 정보 업데이트
  const episodesJson = formData.get("episodes")?.toString();
  if (episodesJson) {
    try {
      const newEpisodes = JSON.parse(episodesJson) as Array<{
        episode_number: number;
        episode_title?: string | null;
        duration?: number | null;
        display_order: number;
      }>;

      // 기존 episode 삭제 후 새로 추가
      await deleteAllLectureEpisodes(lectureId);

      // 새 episode 추가
      for (const episode of newEpisodes) {
        await createLectureEpisode({
          lecture_id: lectureId,
          episode_number: episode.episode_number,
          episode_title: episode.episode_title || null,
          duration: episode.duration || null,
          display_order: episode.display_order,
        });
      }
    } catch (error) {
      console.error("episode 정보 업데이트 실패:", error);
      // episode 업데이트 실패해도 강의는 수정됨
    }
  }

  redirect(`/admin/master-lectures/${lectureId}`);
}

