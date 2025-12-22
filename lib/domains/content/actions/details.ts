"use server";

/**
 * Content Details Actions
 *
 * 교재 세부정보/강의 회차 정보 저장
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

/**
 * 교재 세부정보 저장
 */
async function _saveBookDetails(
  bookId: string,
  details: Array<{
    major_unit?: string | null;
    minor_unit?: string | null;
    page_number: number;
    display_order: number;
  }>
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const supabase = await createSupabaseServerClient();

  // 교재 소유권 확인
  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, student_id")
    .eq("id", bookId)
    .eq("student_id", user.userId)
    .maybeSingle();

  if (bookError || !book) {
    throw new AppError("교재를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 기존 세부정보 삭제
  const { error: deleteError } = await supabase
    .from("student_book_details")
    .delete()
    .eq("book_id", bookId);

  if (deleteError) {
    console.error("[contentDetails] 기존 세부정보 삭제 실패", deleteError);
    throw new AppError("세부정보 저장에 실패했습니다.", ErrorCode.DATABASE_ERROR, 500, true);
  }

  // 새 세부정보 삽입
  if (details.length > 0) {
    const detailsToInsert = details.map((detail) => ({
      book_id: bookId,
      major_unit: detail.major_unit || null,
      minor_unit: detail.minor_unit || null,
      page_number: detail.page_number || 0,
      display_order: detail.display_order || 0,
    }));

    const { error: insertError } = await supabase
      .from("student_book_details")
      .insert(detailsToInsert);

    if (insertError) {
      console.error("[contentDetails] 세부정보 삽입 실패", insertError);
      throw new AppError("세부정보 저장에 실패했습니다.", ErrorCode.DATABASE_ERROR, 500, true);
    }
  }

  revalidatePath(`/contents/books/${bookId}`);
  return { success: true };
}

export const saveBookDetailsAction = withErrorHandling(_saveBookDetails);

/**
 * 강의 회차 정보 저장
 */
async function _saveLectureEpisodes(
  lectureId: string,
  episodes: Array<{
    episode_number: number;
    episode_title?: string | null;
    duration?: number | null;
    display_order: number;
  }>
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const supabase = await createSupabaseServerClient();

  // 강의 소유권 확인
  const { data: lecture, error: lectureError } = await supabase
    .from("lectures")
    .select("id, student_id")
    .eq("id", lectureId)
    .eq("student_id", user.userId)
    .maybeSingle();

  if (lectureError || !lecture) {
    throw new AppError("강의를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 기존 회차 정보 삭제
  const { error: deleteError } = await supabase
    .from("student_lecture_episodes")
    .delete()
    .eq("lecture_id", lectureId);

  if (deleteError) {
    console.error("[contentDetails] 기존 회차 정보 삭제 실패", deleteError);
    throw new AppError("회차 정보 저장에 실패했습니다.", ErrorCode.DATABASE_ERROR, 500, true);
  }

  // 새 회차 정보 삽입
  let maxEpisodeNumber = 0;
  if (episodes.length > 0) {
    const episodesToInsert = episodes.map((episode) => {
      const episodeNumber = episode.episode_number || 0;
      if (episodeNumber > maxEpisodeNumber) {
        maxEpisodeNumber = episodeNumber;
      }
      return {
        lecture_id: lectureId,
        episode_number: episodeNumber,
        episode_title: episode.episode_title || null,
        duration: episode.duration || null,
        display_order: episode.display_order || 0,
      };
    });

    const { error: insertError } = await supabase
      .from("student_lecture_episodes")
      .insert(episodesToInsert);

    if (insertError) {
      console.error("[contentDetails] 회차 정보 삽입 실패", insertError);
      throw new AppError("회차 정보 저장에 실패했습니다.", ErrorCode.DATABASE_ERROR, 500, true);
    }

    // 총 회차 자동 업데이트 (가장 큰 episode_number)
    if (maxEpisodeNumber > 0) {
      const { error: updateError } = await supabase
        .from("lectures")
        .update({ total_episodes: maxEpisodeNumber })
        .eq("id", lectureId);

      if (updateError) {
        console.error("[contentDetails] 총 회차 업데이트 실패", updateError);
        // 에러를 던지지 않고 로그만 남김 (회차 정보는 저장되었으므로)
      }
    }
  } else {
    // 회차 정보가 없으면 총 회차를 0으로 설정
    const { error: updateError } = await supabase
      .from("lectures")
      .update({ total_episodes: null })
      .eq("id", lectureId);

    if (updateError) {
      console.error("[contentDetails] 총 회차 초기화 실패", updateError);
    }
  }

  revalidatePath(`/contents/lectures/${lectureId}`);
  return { success: true };
}

export const saveLectureEpisodesAction = withErrorHandling(_saveLectureEpisodes);
