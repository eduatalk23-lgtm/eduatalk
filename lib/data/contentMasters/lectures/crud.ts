/**
 * 마스터 강의 CRUD 함수
 */

import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import type {
  MasterLecture,
  LectureEpisode,
  MasterLectureWithJoins,
} from "@/lib/types/plan";
import { logActionError } from "@/lib/logging/actionLogger";
import { extractJoinedData } from "@/lib/utils/supabaseHelpers";
import { createTypedParallelQueries } from "@/lib/data/core/typedQueryBuilder";

/**
 * 강의 상세 조회
 *
 * @param lectureId - 조회할 강의 ID
 * @param supabase - 선택적 Supabase 클라이언트 (관리자/컨설턴트가 다른 테넌트의 콘텐츠를 조회할 때 Admin 클라이언트 전달)
 */
export async function getMasterLectureById(
  lectureId: string,
  supabase?:
    | Awaited<ReturnType<typeof createSupabaseServerClient>>
    | ReturnType<typeof createSupabaseAdminClient>
): Promise<{ lecture: MasterLecture | null; episodes: LectureEpisode[] }> {
  const queryClient = supabase || (await createSupabaseServerClient());

  // 병렬 쿼리 실행
  const [lectureResult, episodesResult] = await createTypedParallelQueries(
    [
      async () => {
        return await queryClient
          .from("master_lectures")
          .select(
            `
        *,
        difficulty_levels:difficulty_level_id (
          id,
          name
        )
      `
          )
          .eq("id", lectureId)
          .maybeSingle<MasterLecture>();
      },
      async () => {
        return await queryClient
          .from("lecture_episodes")
          .select(
            "id, lecture_id, episode_number, episode_title, duration, display_order, created_at, lecture_source_url"
          )
          .eq("lecture_id", lectureId)
          .order("display_order", { ascending: true })
          .order("episode_number", { ascending: true });
      },
    ],
    {
      context: "[data/contentMasters] getMasterLectureById",
      defaultValue: null,
    }
  );

  // lectureResult는 단일 객체이므로 타입 처리
  const lectureData = lectureResult as MasterLectureWithJoins | null;
  if (!lectureData) {
    return {
      lecture: null,
      episodes: (episodesResult as LectureEpisode[] | null) ?? [],
    };
  }

  // JOIN된 데이터 처리
  const difficultyLevel = extractJoinedData<{ id: string; name: string }>(
    lectureData.difficulty_levels
  );

  // difficulty_level을 JOIN된 name으로 덮어쓰기 (fallback: 기존 값)
  const lecture = {
    ...lectureData,
    difficulty_level:
      difficultyLevel?.name || lectureData.difficulty_level || null,
  } as MasterLecture;

  return {
    lecture,
    episodes: (episodesResult as LectureEpisode[] | null) ?? [],
  };
}

/**
 * 강의 생성
 */
export async function createMasterLecture(
  data: Omit<MasterLecture, "id" | "created_at" | "updated_at">
): Promise<MasterLecture> {
  const supabase = await createSupabaseServerClient();

  const { data: lecture, error } = await supabase
    .from("master_lectures")
    .insert({
      tenant_id: data.tenant_id,
      revision: data.revision,
      content_category: data.content_category,
      subject_category: data.subject_category,
      subject: data.subject,
      title: data.title,
      platform: data.platform,
      total_episodes: data.total_episodes,
      total_duration: data.total_duration,
      difficulty_level: data.difficulty_level,
      difficulty_level_id: data.difficulty_level_id ?? null,
      notes: data.notes,
      linked_book_id: data.linked_book_id,
      video_url: data.video_url,
      lecture_source_url: data.lecture_source_url,
      transcript: data.transcript,
      episode_analysis: data.episode_analysis,
      overall_difficulty: data.overall_difficulty,
    })
    .select()
    .single();

  if (error) {
    logActionError({ domain: "data", action: "createMasterLecture" }, error);
    throw new Error(error.message || "강의 생성에 실패했습니다.");
  }

  return lecture as MasterLecture;
}

/**
 * 강의 수정
 */
export async function updateMasterLecture(
  lectureId: string,
  data: Partial<Omit<MasterLecture, "id" | "created_at" | "updated_at">>
): Promise<MasterLecture> {
  const supabase = await createSupabaseServerClient();

  // undefined 필드는 제외하고 실제 존재하는 필드만 업데이트
  const updateFields: Record<string, unknown> = {};

  if (data.tenant_id !== undefined) updateFields.tenant_id = data.tenant_id;
  if (data.curriculum_revision_id !== undefined)
    updateFields.curriculum_revision_id = data.curriculum_revision_id;
  if (data.subject_id !== undefined) updateFields.subject_id = data.subject_id;
  if (data.subject_group_id !== undefined)
    updateFields.subject_group_id = data.subject_group_id;
  if ("is_active" in data && data.is_active !== undefined)
    updateFields.is_active = data.is_active as boolean;
  if (data.revision !== undefined) updateFields.revision = data.revision;
  if (data.content_category !== undefined)
    updateFields.content_category = data.content_category;
  if (data.subject_category !== undefined)
    updateFields.subject_category = data.subject_category;
  if (data.subject !== undefined) updateFields.subject = data.subject;
  if (data.title !== undefined) updateFields.title = data.title;
  if (data.platform !== undefined) updateFields.platform = data.platform;
  if (data.platform_name !== undefined)
    updateFields.platform_name = data.platform_name;
  if (data.platform_id !== undefined)
    updateFields.platform_id = data.platform_id;
  if (data.total_episodes !== undefined)
    updateFields.total_episodes = data.total_episodes;
  if (data.total_duration !== undefined)
    updateFields.total_duration = data.total_duration;
  if (data.difficulty_level !== undefined)
    updateFields.difficulty_level = data.difficulty_level;
  if (data.difficulty_level_id !== undefined)
    updateFields.difficulty_level_id = data.difficulty_level_id;
  if (data.notes !== undefined) updateFields.notes = data.notes;
  if (data.linked_book_id !== undefined)
    updateFields.linked_book_id = data.linked_book_id;
  if (data.video_url !== undefined) updateFields.video_url = data.video_url;
  if (data.lecture_source_url !== undefined)
    updateFields.lecture_source_url = data.lecture_source_url;
  if (data.transcript !== undefined) updateFields.transcript = data.transcript;
  if (data.episode_analysis !== undefined)
    updateFields.episode_analysis = data.episode_analysis;
  if (data.overall_difficulty !== undefined)
    updateFields.overall_difficulty = data.overall_difficulty;
  if (data.instructor_name !== undefined)
    updateFields.instructor_name = data.instructor_name;
  if (data.grade_level !== undefined)
    updateFields.grade_level = data.grade_level;
  if (data.grade_min !== undefined) updateFields.grade_min = data.grade_min;
  if (data.grade_max !== undefined) updateFields.grade_max = data.grade_max;
  if (data.lecture_type !== undefined)
    updateFields.lecture_type = data.lecture_type;

  const { data: lecture, error } = await supabase
    .from("master_lectures")
    .update(updateFields)
    .eq("id", lectureId)
    .select()
    .single();

  if (error) {
    logActionError(
      { domain: "data", action: "updateMasterLecture" },
      error,
      { lectureId }
    );
    throw new Error(error.message || "강의 수정에 실패했습니다.");
  }

  return lecture as MasterLecture;
}

/**
 * 강의 삭제
 */
export async function deleteMasterLecture(lectureId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("master_lectures")
    .delete()
    .eq("id", lectureId);

  if (error) {
    logActionError(
      { domain: "data", action: "deleteMasterLecture" },
      error,
      { lectureId }
    );
    throw new Error(error.message || "강의 삭제에 실패했습니다.");
  }
}
