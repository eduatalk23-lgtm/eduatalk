/**
 * 강의 Episode 관련 함수
 */

import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LectureEpisode } from "@/lib/types/plan";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import {
  createMasterToStudentMap,
  extractMasterIds,
} from "@/lib/plan/content";
import { getMasterLectureById } from "./crud";

/**
 * 강의 episode 생성
 */
export async function createLectureEpisode(
  data: Omit<LectureEpisode, "id" | "created_at">
): Promise<LectureEpisode> {
  const supabase = await createSupabaseServerClient();

  const { data: episode, error } = await supabase
    .from("lecture_episodes")
    .insert({
      lecture_id: data.lecture_id,
      episode_number: data.episode_number,
      episode_title: data.episode_title || null,
      duration: data.duration || null,
      display_order: data.display_order,
    })
    .select()
    .single();

  if (error) {
    logActionError(
      { domain: "data", action: "createLectureEpisode" },
      error,
      { lectureId: data.lecture_id }
    );
    throw new Error(error.message || "강의 episode 추가에 실패했습니다.");
  }

  return episode as LectureEpisode;
}

/**
 * 강의 episode 수정
 */
export async function updateLectureEpisode(
  episodeId: string,
  data: Partial<Omit<LectureEpisode, "id" | "created_at">>
): Promise<LectureEpisode> {
  const supabase = await createSupabaseServerClient();

  const updateFields: Record<string, unknown> = {};
  if (data.episode_number !== undefined)
    updateFields.episode_number = data.episode_number;
  if (data.episode_title !== undefined)
    updateFields.episode_title = data.episode_title;
  if (data.duration !== undefined) updateFields.duration = data.duration;
  if (data.display_order !== undefined)
    updateFields.display_order = data.display_order;

  const { data: episode, error } = await supabase
    .from("lecture_episodes")
    .update(updateFields)
    .eq("id", episodeId)
    .select()
    .single();

  if (error) {
    logActionError(
      { domain: "data", action: "updateLectureEpisode" },
      error,
      { episodeId }
    );
    throw new Error(error.message || "강의 episode 수정에 실패했습니다.");
  }

  return episode as LectureEpisode;
}

/**
 * 강의 episode 삭제
 */
export async function deleteLectureEpisode(episodeId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("lecture_episodes")
    .delete()
    .eq("id", episodeId);

  if (error) {
    logActionError(
      { domain: "data", action: "deleteLectureEpisode" },
      error,
      { episodeId }
    );
    throw new Error(error.message || "강의 episode 삭제에 실패했습니다.");
  }
}

/**
 * 강의 episode 일괄 삭제
 */
export async function deleteAllLectureEpisodes(
  lectureId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("lecture_episodes")
    .delete()
    .eq("lecture_id", lectureId);

  if (error) {
    logActionError(
      { domain: "data", action: "deleteAllLectureEpisodes" },
      error,
      { lectureId }
    );
    throw new Error(error.message || "강의 episode 일괄 삭제에 실패했습니다.");
  }
}

/**
 * 학생 강의의 episode 정보 조회 (student_lecture_episodes)
 * @param lectureId 강의 ID
 * @param studentId 학생 ID (현재는 사용되지 않음)
 * @param supabaseClient 선택적 Supabase 클라이언트 (관리자/컨설턴트의 경우 Admin 클라이언트 전달 가능)
 * @returns Episode 정보 배열 (episode_title 필드 사용)
 */
export async function getStudentLectureEpisodes(
  lectureId: string,
  studentId: string,
  supabaseClient?: SupabaseClient
): Promise<
  Array<{ id: string; episode_number: number; episode_title: string | null }>
> {
  const supabase = supabaseClient || (await createSupabaseServerClient());

  const { data, error } = await supabase
    .from("student_lecture_episodes")
    .select("id, episode_number, episode_title")
    .eq("lecture_id", lectureId)
    .order("episode_number", { ascending: true });

  if (error) {
    logActionError(
      { domain: "data", action: "getStudentLectureEpisodes" },
      error,
      { lectureId, studentId }
    );
    return [];
  }

  return (
    (data as Array<{
      id: string;
      episode_number: number;
      episode_title: string | null;
    }> | null) ?? []
  );
}

/**
 * 여러 강의의 episode 정보를 배치로 조회 (성능 최적화)
 * @param lectureIds 조회할 강의 ID 배열
 * @param studentId 학생 ID
 * @returns Map<lectureId, Episode[]> 형태로 반환
 */
export async function getStudentLectureEpisodesBatch(
  lectureIds: string[],
  studentId: string
): Promise<
  Map<
    string,
    Array<{
      id: string;
      episode_number: number;
      episode_title: string | null;
      duration: number | null;
    }>
  >
> {
  if (lectureIds.length === 0) {
    return new Map();
  }

  // RLS 정책 우회를 위해 admin 클라이언트 사용
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    logActionError(
      { domain: "data", action: "getStudentLectureEpisodesBatch" },
      new Error("admin 클라이언트 생성 실패")
    );
    return new Map();
  }

  // 성능 측정 시작
  const queryStart = performance.now();

  const { data, error } = await supabase
    .from("student_lecture_episodes")
    .select("id, lecture_id, episode_number, episode_title, duration")
    .in("lecture_id", lectureIds)
    .order("lecture_id", { ascending: true })
    .order("episode_number", { ascending: true });

  const queryTime = performance.now() - queryStart;

  if (error) {
    logActionError(
      { domain: "data", action: "getStudentLectureEpisodesBatch" },
      error,
      { lectureIds, studentId }
    );
    return new Map();
  }

  // 결과를 lectureId별로 그룹화하여 Map으로 반환
  const resultMap = new Map<
    string,
    Array<{
      id: string;
      episode_number: number;
      episode_title: string | null;
      duration: number | null;
    }>
  >();

  (data || []).forEach(
    (episode: {
      id: string;
      lecture_id: string;
      episode_number: number;
      episode_title: string | null;
      duration: number | null;
    }) => {
      if (!resultMap.has(episode.lecture_id)) {
        resultMap.set(episode.lecture_id, []);
      }
      resultMap.get(episode.lecture_id)!.push({
        id: episode.id,
        episode_number: episode.episode_number,
        episode_title: episode.episode_title,
        duration: episode.duration,
      });
    }
  );

  // 조회 결과가 없는 lectureId들 확인
  const emptyLectureIds = lectureIds.filter(
    (lectureId) =>
      !resultMap.has(lectureId) || resultMap.get(lectureId)!.length === 0
  );

  // 마스터 콘텐츠 fallback: student_lecture_episodes에 없는 경우 마스터 강의에서 조회
  if (emptyLectureIds.length > 0) {
    // 학생 강의의 master_lecture_id 및 master_content_id 조회
    const { data: studentLectures } = await supabase
      .from("lectures")
      .select("id, master_lecture_id, master_content_id")
      .in("id", emptyLectureIds)
      .eq("student_id", studentId);

    // ContentResolverService를 사용하여 마스터 ID 추출 (중복 제거됨)
    const masterLectureIds = extractMasterIds(studentLectures || [], "lecture");

    if (masterLectureIds.length > 0) {
      // 마스터 강의의 episodes 조회
      const { data: masterEpisodesData, error: masterError } = await supabase
        .from("lecture_episodes")
        .select("id, lecture_id, episode_number, episode_title, duration")
        .in("lecture_id", masterLectureIds)
        .order("lecture_id", { ascending: true })
        .order("episode_number", { ascending: true });

      if (masterError) {
        logActionError(
          { domain: "data", action: "getStudentLectureEpisodesBatch" },
          masterError,
          { step: "masterFallback", masterLectureIds }
        );
      } else if (masterEpisodesData && masterEpisodesData.length > 0) {
        // ContentResolverService를 사용하여 마스터 → 학생 ID 매핑 생성
        const masterToStudentMap = createMasterToStudentMap(
          studentLectures || [],
          "lecture"
        );

        // 마스터 episodes를 학생 강의 ID로 매핑하여 resultMap에 추가
        masterEpisodesData.forEach((ep) => {
          const studentLectureIdsList =
            masterToStudentMap.get(ep.lecture_id) || [];
          studentLectureIdsList.forEach((studentLectureId) => {
            if (!resultMap.has(studentLectureId)) {
              resultMap.set(studentLectureId, []);
            }
            resultMap.get(studentLectureId)!.push({
              id: ep.id,
              episode_number: ep.episode_number,
              episode_title: ep.episode_title,
              duration: ep.duration,
            });
          });
        });
      }
    }

    // 캠프 모드 직접 마스터 fallback: lectureIds가 이미 마스터 강의 ID인 경우
    const stillEmptyLectureIds = lectureIds.filter(
      (lectureId) =>
        !resultMap.has(lectureId) || resultMap.get(lectureId)!.length === 0
    );

    if (stillEmptyLectureIds.length > 0) {
      // lecture_episodes 테이블에서 직접 조회 (lectureIds가 마스터 강의 ID인 경우)
      const { data: directMasterData, error: directMasterError } =
        await supabase
          .from("lecture_episodes")
          .select("id, lecture_id, episode_number, episode_title, duration")
          .in("lecture_id", stillEmptyLectureIds)
          .order("lecture_id", { ascending: true })
          .order("episode_number", { ascending: true });

      if (directMasterError) {
        logActionError(
          { domain: "data", action: "getStudentLectureEpisodesBatch" },
          directMasterError,
          { step: "campModeFallback", stillEmptyLectureIds }
        );
      } else if (directMasterData && directMasterData.length > 0) {
        // 마스터 강의 ID를 그대로 키로 사용하여 resultMap에 추가
        directMasterData.forEach((ep) => {
          if (!resultMap.has(ep.lecture_id)) {
            resultMap.set(ep.lecture_id, []);
          }
          resultMap.get(ep.lecture_id)!.push({
            id: ep.id,
            episode_number: ep.episode_number,
            episode_title: ep.episode_title,
            duration: ep.duration,
          });
        });

        if (process.env.NODE_ENV === "development") {
          logActionDebug(
            { domain: "data", action: "getStudentLectureEpisodesBatch" },
            "캠프 모드 직접 마스터 fallback 성공",
            {
              requestedIds: stillEmptyLectureIds,
              foundCount: directMasterData.length,
            }
          );
        }
      }
    }

    // 여전히 조회 결과가 없는 lectureId들은 빈 배열로 초기화
    lectureIds.forEach((lectureId) => {
      if (!resultMap.has(lectureId)) {
        resultMap.set(lectureId, []);
      }
    });
  }

  // 성능 로깅 (개발 환경에서만)
  if (process.env.NODE_ENV === "development") {
    const resultCount = data?.length || 0;
    const finalEmptyLectureIds = lectureIds.filter(
      (lectureId) =>
        !resultMap.has(lectureId) || resultMap.get(lectureId)!.length === 0
    );

    logActionDebug(
      { domain: "data", action: "getStudentLectureEpisodesBatch" },
      "쿼리 성능",
      {
        lectureCount: lectureIds.length,
        resultCount,
        queryTime: `${queryTime.toFixed(2)}ms`,
        avgTimePerLecture:
          lectureIds.length > 0
            ? `${(queryTime / lectureIds.length).toFixed(2)}ms`
            : "N/A",
        emptyLectureCount: finalEmptyLectureIds.length,
        emptyLectureIds:
          finalEmptyLectureIds.length > 0 ? finalEmptyLectureIds : undefined,
        fallbackUsed: emptyLectureIds.length > 0,
      }
    );

    if (finalEmptyLectureIds.length > 0) {
      logActionDebug(
        { domain: "data", action: "getStudentLectureEpisodesBatch" },
        "회차가 없는 강의",
        {
          count: finalEmptyLectureIds.length,
          lectureIds: finalEmptyLectureIds,
          reason:
            "student_lecture_episodes 및 lecture_episodes 테이블 모두에 해당 강의의 회차 정보가 없습니다.",
        }
      );
    }
  }

  return resultMap;
}

/**
 * 여러 마스터 강의의 episode 정보를 배치로 조회 (성능 최적화)
 * @param masterLectureIds 조회할 마스터 강의 ID 배열
 * @returns Map<masterLectureId, Episode[]> 형태로 반환
 */
export async function getMasterLectureEpisodesBatch(
  masterLectureIds: string[]
): Promise<
  Map<
    string,
    Array<{
      id: string;
      episode_number: number;
      episode_title: string | null;
      duration: number | null;
    }>
  >
> {
  if (masterLectureIds.length === 0) {
    return new Map();
  }

  const supabase = await createSupabaseServerClient();

  // 성능 측정 시작
  const queryStart = performance.now();

  const { data, error } = await supabase
    .from("lecture_episodes")
    .select("id, lecture_id, episode_number, episode_title, duration")
    .in("lecture_id", masterLectureIds)
    .order("lecture_id", { ascending: true })
    .order("episode_number", { ascending: true });

  const queryTime = performance.now() - queryStart;

  if (error) {
    logActionError(
      { domain: "data", action: "getMasterLectureEpisodesBatch" },
      error,
      { masterLectureIds }
    );
    return new Map();
  }

  // 결과를 lectureId별로 그룹화하여 Map으로 반환
  const resultMap = new Map<
    string,
    Array<{
      id: string;
      episode_number: number;
      episode_title: string | null;
      duration: number | null;
    }>
  >();

  (data || []).forEach(
    (episode: {
      id: string;
      lecture_id: string;
      episode_number: number;
      episode_title: string | null;
      duration: number | null;
    }) => {
      if (!resultMap.has(episode.lecture_id)) {
        resultMap.set(episode.lecture_id, []);
      }
      resultMap.get(episode.lecture_id)!.push({
        id: episode.id,
        episode_number: episode.episode_number,
        episode_title: episode.episode_title,
        duration: episode.duration,
      });
    }
  );

  // 조회 결과가 없는 lectureId들도 빈 배열로 초기화
  masterLectureIds.forEach((lectureId) => {
    if (!resultMap.has(lectureId)) {
      resultMap.set(lectureId, []);
    }
  });

  // 성능 로깅 (개발 환경에서만)
  if (process.env.NODE_ENV === "development") {
    const resultCount = data?.length || 0;
    const emptyLectureIds = masterLectureIds.filter(
      (lectureId) =>
        !resultMap.has(lectureId) || resultMap.get(lectureId)!.length === 0
    );

    logActionDebug(
      { domain: "data", action: "getMasterLectureEpisodesBatch" },
      "쿼리 성능",
      {
        lectureCount: masterLectureIds.length,
        resultCount,
        queryTime: `${queryTime.toFixed(2)}ms`,
        avgTimePerLecture:
          masterLectureIds.length > 0
            ? `${(queryTime / masterLectureIds.length).toFixed(2)}ms`
            : "N/A",
        emptyLectureCount: emptyLectureIds.length,
        emptyLectureIds: emptyLectureIds.length > 0 ? emptyLectureIds : undefined,
      }
    );
  }

  return resultMap;
}

/**
 * 통합 Episode 조회 함수
 * 학생 강의 episode를 우선 조회하고, 없으면 마스터 강의 episode를 사용합니다.
 *
 * @param lectureId 학생 강의 ID
 * @param masterLectureId 마스터 강의 ID (선택사항, fallback용)
 * @param studentId 학생 ID (선택사항, 현재는 사용하지 않지만 향후 확장 가능)
 * @returns Episode 정보 배열 (episode_title 필드 사용)
 */
export async function getLectureEpisodesWithFallback(
  lectureId: string,
  masterLectureId: string | null | undefined,
  _studentId?: string
): Promise<
  Array<{
    id: string;
    lecture_id: string;
    episode_number: number;
    episode_title: string | null;
    duration: number | null;
    display_order: number;
    created_at: string;
  }>
> {
  const supabase = await createSupabaseServerClient();

  // 먼저 학생 강의 episode 조회
  const { data: studentEpisodes, error: studentError } = await supabase
    .from("student_lecture_episodes")
    .select(
      "id, episode_number, episode_title, duration, display_order, created_at"
    )
    .eq("lecture_id", lectureId)
    .order("display_order", { ascending: true })
    .order("episode_number", { ascending: true });

  if (studentError) {
    logActionError(
      { domain: "data", action: "getLectureEpisodesWithFallback" },
      studentError,
      { lectureId, masterLectureId, step: "studentEpisodes" }
    );
  }

  // 학생 강의 episode가 있으면 반환
  if (studentEpisodes && studentEpisodes.length > 0) {
    return studentEpisodes.map((e) => ({
      id: e.id,
      lecture_id: lectureId,
      episode_number: e.episode_number,
      episode_title: e.episode_title,
      duration: e.duration,
      display_order: e.display_order,
      created_at: e.created_at || "",
    }));
  }

  // 학생 강의 episode가 없고 마스터 강의 ID가 있으면 마스터에서 조회
  if (masterLectureId) {
    try {
      const { episodes } = await getMasterLectureById(masterLectureId);
      return episodes.map((e) => ({
        id: e.id,
        lecture_id: lectureId,
        episode_number: e.episode_number,
        episode_title: e.episode_title,
        duration: e.duration,
        display_order: e.display_order,
        created_at: e.created_at || "",
      }));
    } catch (err) {
      logActionError(
        { domain: "data", action: "getLectureEpisodesWithFallback" },
        err,
        { lectureId, masterLectureId, step: "masterFallback" }
      );
    }
  }

  // 둘 다 없으면 빈 배열 반환
  return [];
}
