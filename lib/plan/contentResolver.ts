/**
 * 콘텐츠 리졸버
 *
 * 플랜 생성/미리보기에서 공통으로 사용하는 콘텐츠 관련 기능을 제공합니다.
 * - 마스터 콘텐츠 → 학생 콘텐츠 ID 매핑
 * - 콘텐츠 메타데이터 조회 (제목, 과목, 카테고리)
 * - 콘텐츠 소요시간 조회
 *
 * @module lib/plan/contentResolver
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanContent } from "@/lib/types/plan";
import type {
  ContentIdMap,
  ContentMetadataMap,
  ContentDurationMap,
  ContentSubjectsMap,
  ContentResolutionResult,
} from "@/lib/types/plan-generation";
import {
  getStudentLectureEpisodesBatch,
  getMasterLectureEpisodesBatch,
} from "@/lib/data/contentMasters";
import {
  getMasterContentId,
  isFromMaster,
} from "@/lib/plan/content";

/**
 * Chapter 정보 맵 타입
 * key: content_id (원본 PlanContent의 content_id)
 * value: chapter 문자열 (book: major_unit/minor_unit, lecture: episode_title)
 */
export type ContentChapterMap = Map<string, string | null>;

// ============================================
// 타입 정의
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAnyClient = SupabaseClient<any>;

// ============================================
// 콘텐츠 ID 매핑 함수
// ============================================

/**
 * 마스터 콘텐츠 ID를 학생 콘텐츠 ID로 매핑합니다.
 *
 * @param contents 플랜 콘텐츠 배열
 * @param studentId 학생 ID
 * @param queryClient 학생용 Supabase 클라이언트
 * @param masterQueryClient 마스터 조회용 Supabase 클라이언트
 * @returns 콘텐츠 ID 매핑
 */
export async function resolveContentIds(
  contents: PlanContent[],
  studentId: string,
  queryClient: SupabaseAnyClient,
  masterQueryClient: SupabaseAnyClient
): Promise<ContentIdMap> {
  const contentIdMap: ContentIdMap = new Map();

  // plan_contents의 content_id 해석: master_content_id가 있으면 우선 사용
  // - master_content_id가 있으면: 마스터 콘텐츠 ID (학생이 저장한 경우)
  // - 없으면: content_id 사용 (이미 학생 콘텐츠 ID이거나 관리자가 변환한 경우)
  const getResolvedContentId = (content: PlanContent): string => {
    return content.master_content_id || content.content_id;
  };

  // 콘텐츠 타입별로 분류
  const bookContents = contents
    .filter((c) => c.content_type === "book")
    .map((c) => ({
      ...c,
      resolvedContentId: getResolvedContentId(c),
    }));
  const lectureContents = contents
    .filter((c) => c.content_type === "lecture")
    .map((c) => ({
      ...c,
      resolvedContentId: getResolvedContentId(c),
    }));
  const customContents = contents.filter((c) => c.content_type === "custom");

  // 마스터 콘텐츠 확인 (병렬)
  // resolvedContentId를 사용하여 마스터 콘텐츠인지 확인
  type MasterCheckResult = { content: PlanContent; isMaster: boolean; resolvedContentId: string };

  const masterBookQueries = bookContents.map(async (content): Promise<MasterCheckResult> => {
    try {
      const result = await masterQueryClient
        .from("master_books")
        .select("id")
        .eq("id", content.resolvedContentId)
        .maybeSingle();
      return { content, isMaster: !!result.data, resolvedContentId: content.resolvedContentId };
    } catch {
      return { content, isMaster: false, resolvedContentId: content.resolvedContentId };
    }
  });

  const masterLectureQueries = lectureContents.map(async (content): Promise<MasterCheckResult> => {
    try {
      const result = await masterQueryClient
        .from("master_lectures")
        .select("id")
        .eq("id", content.resolvedContentId)
        .maybeSingle();
      return { content, isMaster: !!result.data, resolvedContentId: content.resolvedContentId };
    } catch {
      return { content, isMaster: false, resolvedContentId: content.resolvedContentId };
    }
  });

  const [masterBookResults, masterLectureResults] = await Promise.all([
    Promise.all(masterBookQueries),
    Promise.all(masterLectureQueries),
  ]);

  // 학생 콘텐츠 확인 (병렬)
  type StudentContentResult = { content: PlanContent; studentContentId: string };

  const studentBookQueries = masterBookResults
    .filter((r) => r.isMaster)
    .map(async ({ content, resolvedContentId }): Promise<StudentContentResult> => {
      try {
        const result = await queryClient
          .from("books")
          .select("id")
          .eq("student_id", studentId)
          .eq("master_content_id", resolvedContentId)
          .maybeSingle();
        return {
          content,
          studentContentId: result.data?.id || resolvedContentId,
        };
      } catch {
        return { content, studentContentId: resolvedContentId };
      }
    });

  const studentLectureQueries = masterLectureResults
    .filter((r) => r.isMaster)
    .map(async ({ content, resolvedContentId }): Promise<StudentContentResult> => {
      try {
        const result = await queryClient
          .from("lectures")
          .select("id")
          .eq("student_id", studentId)
          .eq("master_content_id", resolvedContentId)
          .maybeSingle();
        return {
          content,
          studentContentId: result.data?.id || resolvedContentId,
        };
      } catch {
        return { content, studentContentId: resolvedContentId };
      }
    });

  const [studentBookResults, studentLectureResults] = await Promise.all([
    Promise.all(studentBookQueries),
    Promise.all(studentLectureQueries),
  ]);

  // contentIdMap 구성
  masterBookResults
    .filter((r) => !r.isMaster)
    .forEach(({ content }) => {
      contentIdMap.set(content.content_id, content.content_id);
    });

  masterLectureResults
    .filter((r) => !r.isMaster)
    .forEach(({ content }) => {
      contentIdMap.set(content.content_id, content.content_id);
    });

  studentBookResults.forEach(({ content, studentContentId }) => {
    contentIdMap.set(content.content_id, studentContentId);
  });

  studentLectureResults.forEach(({ content, studentContentId }) => {
    contentIdMap.set(content.content_id, studentContentId);
  });

  customContents.forEach((content) => {
    contentIdMap.set(content.content_id, content.content_id);
  });

  return contentIdMap;
}

// ============================================
// 콘텐츠 메타데이터 로딩 함수
// ============================================

type ContentMetadataResult = {
  title?: string | null;
  subject?: string | null;
  subject_category?: string | null;
  category?: string | null;
};

/**
 * 콘텐츠 메타데이터를 로드합니다 (제목, 과목, 카테고리).
 */
export async function loadContentMetadata(
  contents: PlanContent[],
  contentIdMap: ContentIdMap,
  studentId: string,
  queryClient: SupabaseAnyClient,
  masterQueryClient: SupabaseAnyClient
): Promise<ContentMetadataMap> {
  const contentMetadataMap: ContentMetadataMap = new Map();

  for (const content of contents) {
    const finalContentId =
      contentIdMap.get(content.content_id) || content.content_id;

    let metadata: ContentMetadataResult | null = null;

    if (content.content_type === "book") {
      metadata = await loadBookMetadata(
        content.content_id,
        finalContentId,
        content.master_content_id,
        studentId,
        queryClient,
        masterQueryClient
      );
    } else if (content.content_type === "lecture") {
      metadata = await loadLectureMetadata(
        content.content_id,
        finalContentId,
        content.master_content_id,
        studentId,
        queryClient,
        masterQueryClient
      );
    } else if (content.content_type === "custom") {
      metadata = await loadCustomContentMetadata(
        finalContentId,
        studentId,
        queryClient
      );
    }

    if (metadata) {
      contentMetadataMap.set(content.content_id, metadata);
    }
  }

  return contentMetadataMap;
}

async function loadBookMetadata(
  contentId: string,
  finalContentId: string,
  masterContentId: string | null | undefined,
  studentId: string,
  queryClient: SupabaseAnyClient,
  masterQueryClient: SupabaseAnyClient
): Promise<ContentMetadataResult | null> {
  // 학생 교재 조회
  const { data: book } = await queryClient
    .from("books")
    .select("title, subject, subject_category, master_content_id")
    .eq("id", finalContentId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (book) {
    return {
      title: book.title || null,
      subject: book.subject || null,
      subject_category: book.subject_category || null,
      category: null,
    };
  }

  // 마스터 콘텐츠 ID로 학생 교재 찾기
  const actualMasterContentId = masterContentId || contentId;
  const { data: bookByMaster } = await queryClient
    .from("books")
    .select("title, subject, subject_category")
    .eq("student_id", studentId)
    .eq("master_content_id", actualMasterContentId)
    .maybeSingle();

  if (bookByMaster) {
    return {
      title: bookByMaster.title || null,
      subject: bookByMaster.subject || null,
      subject_category: bookByMaster.subject_category || null,
      category: null,
    };
  }

  // 마스터 교재 조회
  const { data: masterBook } = await masterQueryClient
    .from("master_books")
    .select("title, subject, subject_category, content_category")
    .eq("id", actualMasterContentId)
    .maybeSingle();

  if (masterBook) {
    return {
      title: masterBook.title || null,
      subject: masterBook.subject || null,
      subject_category: masterBook.subject_category || null,
      category: masterBook.content_category || null,
    };
  }

  return null;
}

async function loadLectureMetadata(
  contentId: string,
  finalContentId: string,
  masterContentId: string | null | undefined,
  studentId: string,
  queryClient: SupabaseAnyClient,
  masterQueryClient: SupabaseAnyClient
): Promise<ContentMetadataResult | null> {
  // 학생 강의 조회
  const { data: lecture } = await queryClient
    .from("lectures")
    .select("title, subject, subject_category, master_content_id, master_lecture_id")
    .eq("id", finalContentId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (lecture) {
    return {
      title: lecture.title || null,
      subject: lecture.subject || null,
      subject_category: lecture.subject_category || null,
      category: null,
    };
  }

  // 마스터 콘텐츠 ID로 학생 강의 찾기 (master_content_id 또는 master_lecture_id로 조회)
  const actualMasterContentId = masterContentId || contentId;
  const { data: lectureByMaster } = await queryClient
    .from("lectures")
    .select("title, subject, subject_category")
    .eq("student_id", studentId)
    .or(`master_content_id.eq.${actualMasterContentId},master_lecture_id.eq.${actualMasterContentId}`)
    .maybeSingle();

  if (lectureByMaster) {
    return {
      title: lectureByMaster.title || null,
      subject: lectureByMaster.subject || null,
      subject_category: lectureByMaster.subject_category || null,
      category: null,
    };
  }

  // 마스터 강의 조회
  const { data: masterLecture } = await masterQueryClient
    .from("master_lectures")
    .select("title, subject, subject_category, content_category")
    .eq("id", actualMasterContentId)
    .maybeSingle();

  if (masterLecture) {
    return {
      title: masterLecture.title || null,
      subject: masterLecture.subject || null,
      subject_category: masterLecture.subject_category || null,
      category: masterLecture.content_category || null,
    };
  }

  return null;
}

async function loadCustomContentMetadata(
  finalContentId: string,
  studentId: string,
  queryClient: SupabaseAnyClient
): Promise<ContentMetadataResult | null> {
  const { data: customContent } = await queryClient
    .from("student_custom_contents")
    .select("title, subject, subject_category, content_category")
    .eq("id", finalContentId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (customContent) {
    return {
      title: customContent.title || null,
      subject: customContent.subject || null,
      subject_category: customContent.subject_category || null,
      category: customContent.content_category || null,
    };
  }

  return null;
}

// ============================================
// 콘텐츠 소요시간 로딩 함수
// ============================================

/**
 * 콘텐츠 소요시간 정보를 로드합니다.
 */
export async function loadContentDurations(
  contents: PlanContent[],
  contentIdMap: ContentIdMap,
  studentId: string,
  queryClient: SupabaseAnyClient,
  masterQueryClient: SupabaseAnyClient
): Promise<ContentDurationMap> {
  const contentDurationMap: ContentDurationMap = new Map();

  // 콘텐츠 타입별로 분류
  const bookContents = contents.filter((c) => c.content_type === "book");
  const lectureContents = contents.filter((c) => c.content_type === "lecture");
  const customContents = contents.filter((c) => c.content_type === "custom");

  // 학생 콘텐츠 조회 (병렬)
  type BookDurationResult = {
    content: PlanContent;
    studentBook: { id: string; total_pages: number | null; master_content_id: string | null; difficulty_level: string | null; difficulty_level_id: string | null } | null;
  };
  type LectureDurationResult = {
    content: PlanContent;
    studentLecture: { id: string; duration: number | null; master_content_id: string | null; master_lecture_id: string | null; total_episodes: number | null } | null;
  };
  type CustomDurationResult = {
    content: PlanContent;
    customContent: { id: string; total_page_or_time: number | null } | null;
  };

  const bookDurationQueries = bookContents.map(async (content): Promise<BookDurationResult> => {
    const finalContentId = contentIdMap.get(content.content_id) || content.content_id;
    try {
      const result = await queryClient
        .from("books")
        .select("id, total_pages, master_content_id, difficulty_level, difficulty_level_id")
        .eq("id", finalContentId)
        .eq("student_id", studentId)
        .maybeSingle();
      return { content, studentBook: result.data };
    } catch {
      return { content, studentBook: null };
    }
  });

  const lectureDurationQueries = lectureContents.map(async (content): Promise<LectureDurationResult> => {
    const finalContentId = contentIdMap.get(content.content_id) || content.content_id;
    try {
      const result = await queryClient
        .from("lectures")
        .select("id, duration, master_content_id, master_lecture_id, total_episodes")
        .eq("id", finalContentId)
        .eq("student_id", studentId)
        .maybeSingle();
      return { content, studentLecture: result.data };
    } catch {
      return { content, studentLecture: null };
    }
  });

  const customDurationQueries = customContents.map(async (content): Promise<CustomDurationResult> => {
    const finalContentId = contentIdMap.get(content.content_id) || content.content_id;
    try {
      const result = await queryClient
        .from("student_custom_contents")
        .select("id, total_page_or_time")
        .eq("id", finalContentId)
        .eq("student_id", studentId)
        .maybeSingle();
      return { content, customContent: result.data };
    } catch {
      return { content, customContent: null };
    }
  });

  const [bookResults, lectureResults, customResults] = await Promise.all([
    Promise.all(bookDurationQueries),
    Promise.all(lectureDurationQueries),
    Promise.all(customDurationQueries),
  ]);

  // 마스터 콘텐츠 조회가 필요한 항목 수집
  type MasterBookResult = { content: PlanContent; masterBook: { id: string; total_pages: number | null; difficulty_level: string | null; difficulty_level_id: string | null } | null };
  type MasterLectureResult = { content: PlanContent; masterLecture: { id: string; total_duration: number | null; total_episodes: number | null } | null };

  const masterBookQueries: Promise<MasterBookResult>[] = [];
  const masterLectureQueries: Promise<MasterLectureResult>[] = [];

  // difficulty_level_id → difficulty_level 변환을 위한 배치 조회
  const difficultyLevelIds = new Set<string>();
  for (const { studentBook } of bookResults) {
    if (studentBook?.difficulty_level_id) {
      difficultyLevelIds.add(studentBook.difficulty_level_id);
    }
  }

  // difficulty_levels 테이블에서 배치 조회
  const difficultyLevelMap = new Map<string, string>();
  if (difficultyLevelIds.size > 0) {
    try {
      const { data: difficultyLevels } = await queryClient
        .from("difficulty_levels")
        .select("id, name")
        .in("id", Array.from(difficultyLevelIds));
      
      (difficultyLevels || []).forEach((level) => {
        difficultyLevelMap.set(level.id, level.name);
      });
    } catch (error) {
      console.error("[contentResolver] difficulty_levels 조회 실패:", error);
    }
  }

  // 학생 교재 결과 처리
  for (const { content, studentBook } of bookResults) {
    if (studentBook?.total_pages) {
      // difficulty_level_id가 있으면 변환, 없으면 기존 difficulty_level 사용
      const difficultyLevel = studentBook.difficulty_level_id
        ? difficultyLevelMap.get(studentBook.difficulty_level_id) ?? studentBook.difficulty_level ?? null
        : studentBook.difficulty_level ?? null;

      contentDurationMap.set(content.content_id, {
        content_type: "book",
        content_id: content.content_id,
        total_pages: studentBook.total_pages,
        difficulty_level: difficultyLevel,
      });
    } else if (studentBook?.master_content_id) {
      const masterId = studentBook.master_content_id;
      masterBookQueries.push(
        (async (): Promise<MasterBookResult> => {
          try {
            const result = await masterQueryClient
              .from("master_books")
              .select("id, total_pages, difficulty_level, difficulty_level_id")
              .eq("id", masterId)
              .maybeSingle();
            return { content, masterBook: result.data };
          } catch {
            return { content, masterBook: null };
          }
        })()
      );
    }
  }

  // 학생 강의 episode 배치 조회 (N+1 쿼리 문제 해결)
  const studentLectureIds: string[] = [];
  const studentLectureMap = new Map<
    string,
    { content: PlanContent; studentLecture: { id: string; duration: number | null; master_content_id: string | null; master_lecture_id: string | null; total_episodes: number | null } | null }
  >();

  for (const { content, studentLecture } of lectureResults) {
    const finalContentId = contentIdMap.get(content.content_id) || content.content_id;
    studentLectureIds.push(finalContentId);
    studentLectureMap.set(finalContentId, { content, studentLecture });
  }

  // 모든 학생 강의 episode를 한 번에 조회
  const studentEpisodesMap =
    studentLectureIds.length > 0
      ? await getStudentLectureEpisodesBatch(studentLectureIds, studentId)
      : new Map();

  // 학생 강의 결과 처리
  for (const [finalContentId, { content, studentLecture }] of studentLectureMap) {
    // 배치 조회한 episode 정보 사용 (타입 안전성 개선)
    const studentEpisodes = studentEpisodesMap.get(finalContentId) ?? [];
    let episodes: Array<{ episode_number: number; duration: number | null }> | null = null;

    if (studentEpisodes.length > 0) {
      // Episode 정보 변환 (타입 안전성 강화)
      type EpisodeItem = { id: string; episode_number: number; episode_title: string | null; duration: number | null };
      episodes = studentEpisodes
        .filter(
          (ep: EpisodeItem): ep is EpisodeItem & { episode_number: number } =>
            ep.episode_number !== null &&
            ep.episode_number !== undefined &&
            ep.episode_number > 0
        )
        .map((ep: EpisodeItem) => ({
          episode_number: ep.episode_number,
          duration: ep.duration ? Math.ceil(ep.duration / 60) : null, // Convert seconds to minutes
        }));
    }

    // 마스터 강의 episode 조회는 나중에 배치로 처리 (masterLectureQueries에 추가)
    if (studentLecture?.duration) {
      contentDurationMap.set(content.content_id, {
        content_type: "lecture",
        content_id: content.content_id,
        duration: studentLecture.duration ? Math.ceil(studentLecture.duration / 60) : null, // Convert seconds to minutes
        total_episodes: studentLecture.total_episodes ?? null,
        episodes: episodes,
      });
    } else if (studentLecture && isFromMaster(studentLecture)) {
      // ContentResolverService를 사용하여 마스터 ID 추출
      const masterId = getMasterContentId(studentLecture, "lecture");
      masterLectureQueries.push(
        (async (): Promise<MasterLectureResult> => {
          try {
            const result = await masterQueryClient
              .from("master_lectures")
              .select("id, total_duration, total_episodes")
              .eq("id", masterId!)
              .maybeSingle();
            return { content, masterLecture: result.data };
          } catch {
            return { content, masterLecture: null };
          }
        })()
      );
    } else if (episodes) {
      // Episode 정보만 있는 경우 (duration이 없어도 episode 정보는 저장)
      contentDurationMap.set(content.content_id, {
        content_type: "lecture",
        content_id: content.content_id,
        total_episodes: studentLecture?.total_episodes ?? null,
        episodes: episodes,
      });
    }
  }

  // 커스텀 콘텐츠 결과 처리
  for (const { content, customContent } of customResults) {
    if (customContent?.total_page_or_time) {
      contentDurationMap.set(content.content_id, {
        content_type: "custom",
        content_id: content.content_id,
        total_page_or_time: customContent.total_page_or_time,
      });
    }
  }

  // 마스터 콘텐츠 조회 (병렬)
  if (masterBookQueries.length > 0 || masterLectureQueries.length > 0) {
    const [masterBookResults, masterLectureResults] = await Promise.all([
      Promise.all(masterBookQueries),
      Promise.all(masterLectureQueries),
    ]);

    // 마스터 교재의 difficulty_level_id도 변환을 위해 수집
    const masterDifficultyLevelIds = new Set<string>();
    for (const { masterBook } of masterBookResults) {
      if (masterBook?.difficulty_level_id) {
        masterDifficultyLevelIds.add(masterBook.difficulty_level_id);
      }
    }

    // 마스터 교재의 difficulty_levels 배치 조회
    const masterDifficultyLevelMap = new Map<string, string>();
    if (masterDifficultyLevelIds.size > 0) {
      try {
        const { data: masterDifficultyLevels } = await masterQueryClient
          .from("difficulty_levels")
          .select("id, name")
          .in("id", Array.from(masterDifficultyLevelIds));
        
        (masterDifficultyLevels || []).forEach((level) => {
          masterDifficultyLevelMap.set(level.id, level.name);
        });
      } catch (error) {
        console.error("[contentResolver] 마스터 difficulty_levels 조회 실패:", error);
      }
    }

    for (const { content, masterBook } of masterBookResults) {
      if (masterBook?.total_pages) {
        // difficulty_level_id가 있으면 변환, 없으면 기존 difficulty_level 사용
        const difficultyLevel = masterBook.difficulty_level_id
          ? masterDifficultyLevelMap.get(masterBook.difficulty_level_id) ?? masterBook.difficulty_level ?? null
          : masterBook.difficulty_level ?? null;

        contentDurationMap.set(content.content_id, {
          content_type: "book",
          content_id: content.content_id,
          total_pages: masterBook.total_pages,
          difficulty_level: difficultyLevel,
        });
      }
    }

    // 마스터 강의 episode 배치 조회 (N+1 쿼리 문제 해결)
    const masterLectureIds: string[] = [];
    const masterLectureMap = new Map<
      string,
      { content: PlanContent; masterLecture: { id: string; total_duration: number | null; total_episodes: number | null } | null }
    >();

    for (const { content, masterLecture } of masterLectureResults) {
      if (masterLecture?.id) {
        masterLectureIds.push(masterLecture.id);
        masterLectureMap.set(masterLecture.id, { content, masterLecture });
      }
    }

    // 모든 마스터 강의 episode를 한 번에 조회
    const masterEpisodesMap =
      masterLectureIds.length > 0
        ? await getMasterLectureEpisodesBatch(masterLectureIds)
        : new Map();

    // 마스터 강의 결과 처리
    for (const [masterId, { content, masterLecture }] of masterLectureMap) {
      // 배치 조회한 episode 정보 사용 (타입 안전성 개선)
      const masterEpisodes = masterEpisodesMap.get(masterId) ?? [];
      type MasterEpisodeItem = { id: string; episode_number: number; episode_title: string | null; duration: number | null };
      const episodes: Array<{ episode_number: number; duration: number | null }> | null =
        masterEpisodes.length > 0
          ? masterEpisodes
              .filter(
                (ep: MasterEpisodeItem): ep is MasterEpisodeItem & { episode_number: number } =>
                  ep.episode_number !== null &&
                  ep.episode_number !== undefined &&
                  ep.episode_number > 0
              )
              .map((ep: MasterEpisodeItem) => ({
                episode_number: ep.episode_number,
                duration: ep.duration ? Math.ceil(ep.duration / 60) : null, // Convert seconds to minutes
              }))
          : null;

      if (masterLecture?.total_duration) {
        contentDurationMap.set(content.content_id, {
          content_type: "lecture",
          content_id: content.content_id,
          duration: masterLecture.total_duration ? Math.ceil(masterLecture.total_duration / 60) : null, // Convert seconds to minutes
          total_episodes: masterLecture.total_episodes ?? null,
          episodes: episodes,
        });
      } else if (episodes) {
        // Episode 정보만 있는 경우
        contentDurationMap.set(content.content_id, {
          content_type: "lecture",
          content_id: content.content_id,
          total_episodes: masterLecture?.total_episodes ?? null,
          episodes: episodes,
        });
      }
    }
  }

  return contentDurationMap;
}

// ============================================
// Chapter 정보 조회 함수
// ============================================

/**
 * PlanContent의 start_detail_id와 end_detail_id를 사용하여 chapter 정보를 조회합니다.
 * 
 * @param contents PlanContent 배열
 * @param contentIdMap 콘텐츠 ID 매핑 (원본 content_id -> 최종 content_id)
 * @param studentId 학생 ID
 * @param queryClient 학생용 Supabase 클라이언트
 * @returns Chapter 정보 맵 (원본 content_id -> chapter 문자열)
 */
export async function loadContentChapters(
  contents: PlanContent[],
  contentIdMap: ContentIdMap,
  studentId: string,
  queryClient: SupabaseAnyClient
): Promise<ContentChapterMap> {
  const chapterMap: ContentChapterMap = new Map();

  // start_detail_id와 end_detail_id가 있는 콘텐츠만 처리
  const contentsWithDetailIds = contents.filter(
    (c) => c.start_detail_id || c.end_detail_id
  );

  if (contentsWithDetailIds.length === 0) {
    return chapterMap;
  }

  // book과 lecture를 분리
  const bookContents = contentsWithDetailIds.filter(
    (c) => c.content_type === "book"
  );
  const lectureContents = contentsWithDetailIds.filter(
    (c) => c.content_type === "lecture"
  );

  // book_details 조회 (start_detail_id와 end_detail_id 사용)
  if (bookContents.length > 0) {
    const bookDetailIds = new Set<string>();
    bookContents.forEach((c) => {
      if (c.start_detail_id) bookDetailIds.add(c.start_detail_id);
      if (c.end_detail_id) bookDetailIds.add(c.end_detail_id);
    });

    if (bookDetailIds.size > 0) {
      const { data: bookDetails } = await queryClient
        .from("student_book_details")
        .select("id, major_unit, minor_unit")
        .in("id", Array.from(bookDetailIds))
        .eq("student_id", studentId);

      // book_detail_id -> chapter 정보 매핑
      const bookDetailMap = new Map(
        (bookDetails || []).map((d) => [
          d.id,
          d.major_unit || d.minor_unit || null,
        ])
      );

      // 각 콘텐츠의 chapter 정보 설정
      bookContents.forEach((c) => {
        const startChapter = c.start_detail_id
          ? bookDetailMap.get(c.start_detail_id) || null
          : null;
        const endChapter = c.end_detail_id
          ? bookDetailMap.get(c.end_detail_id) || null
          : null;

        // 단일 범위인 경우
        if (startChapter && endChapter && startChapter === endChapter) {
          chapterMap.set(c.content_id, startChapter);
        } else if (startChapter && endChapter) {
          // 범위인 경우
          chapterMap.set(c.content_id, `${startChapter} ~ ${endChapter}`);
        } else if (startChapter) {
          chapterMap.set(c.content_id, startChapter);
        } else if (endChapter) {
          chapterMap.set(c.content_id, endChapter);
        }
      });
    }
  }

  // lecture_episodes 조회 (start_detail_id와 end_detail_id 사용)
  if (lectureContents.length > 0) {
    const lectureEpisodeIds = new Set<string>();
    lectureContents.forEach((c) => {
      if (c.start_detail_id) lectureEpisodeIds.add(c.start_detail_id);
      if (c.end_detail_id) lectureEpisodeIds.add(c.end_detail_id);
    });

    if (lectureEpisodeIds.size > 0) {
      const { data: lectureEpisodes } = await queryClient
        .from("student_lecture_episodes")
        .select("id, episode_title, episode_number")
        .in("id", Array.from(lectureEpisodeIds))
        .eq("student_id", studentId);

      // lecture_episode_id -> chapter 정보 매핑
      const lectureEpisodeMap = new Map(
        (lectureEpisodes || []).map((e) => [
          e.id,
          e.episode_title || `${e.episode_number}강`,
        ])
      );

      // 각 콘텐츠의 chapter 정보 설정
      lectureContents.forEach((c) => {
        const startChapter = c.start_detail_id
          ? lectureEpisodeMap.get(c.start_detail_id) || null
          : null;
        const endChapter = c.end_detail_id
          ? lectureEpisodeMap.get(c.end_detail_id) || null
          : null;

        // 단일 범위인 경우
        if (startChapter && endChapter && startChapter === endChapter) {
          chapterMap.set(c.content_id, startChapter);
        } else if (startChapter && endChapter) {
          // 범위인 경우
          chapterMap.set(c.content_id, `${startChapter} ~ ${endChapter}`);
        } else if (startChapter) {
          chapterMap.set(c.content_id, startChapter);
        } else if (endChapter) {
          chapterMap.set(c.content_id, endChapter);
        }
      });
    }
  }

  return chapterMap;
}

// ============================================
// 통합 함수
// ============================================

/**
 * 콘텐츠 관련 모든 데이터를 해석합니다.
 */
export async function resolveAllContentData(
  contents: PlanContent[],
  studentId: string,
  queryClient: SupabaseAnyClient,
  masterQueryClient: SupabaseAnyClient
): Promise<ContentResolutionResult> {
  // 1. 콘텐츠 ID 매핑
  const contentIdMap = await resolveContentIds(
    contents,
    studentId,
    queryClient,
    masterQueryClient
  );

  // 2. 메타데이터 및 소요시간 로드 (병렬)
  const [contentMetadataMap, contentDurationMap] = await Promise.all([
    loadContentMetadata(
      contents,
      contentIdMap,
      studentId,
      queryClient,
      masterQueryClient
    ),
    loadContentDurations(
      contents,
      contentIdMap,
      studentId,
      queryClient,
      masterQueryClient
    ),
  ]);

  // 3. 콘텐츠 과목 맵 생성 (메타데이터에서 추출)
  const contentSubjects: ContentSubjectsMap = new Map();
  contentMetadataMap.forEach((metadata, contentId) => {
    contentSubjects.set(contentId, {
      subject: metadata.subject,
      subject_category: metadata.subject_category,
    });
  });

  return {
    contentIdMap,
    contentMetadataMap,
    contentDurationMap,
    contentSubjects,
  };
}
