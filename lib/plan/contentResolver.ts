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

  // 콘텐츠 타입별로 분류
  const bookContents = contents.filter((c) => c.content_type === "book");
  const lectureContents = contents.filter((c) => c.content_type === "lecture");
  const customContents = contents.filter((c) => c.content_type === "custom");

  // 마스터 콘텐츠 확인 (병렬)
  type MasterCheckResult = { content: PlanContent; isMaster: boolean };

  const masterBookQueries = bookContents.map(async (content): Promise<MasterCheckResult> => {
    try {
      const result = await masterQueryClient
        .from("master_books")
        .select("id")
        .eq("id", content.content_id)
        .maybeSingle();
      return { content, isMaster: !!result.data };
    } catch {
      return { content, isMaster: false };
    }
  });

  const masterLectureQueries = lectureContents.map(async (content): Promise<MasterCheckResult> => {
    try {
      const result = await masterQueryClient
        .from("master_lectures")
        .select("id")
        .eq("id", content.content_id)
        .maybeSingle();
      return { content, isMaster: !!result.data };
    } catch {
      return { content, isMaster: false };
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
    .map(async ({ content }): Promise<StudentContentResult> => {
      try {
        const result = await queryClient
          .from("books")
          .select("id")
          .eq("student_id", studentId)
          .eq("master_content_id", content.content_id)
          .maybeSingle();
        return {
          content,
          studentContentId: result.data?.id || content.content_id,
        };
      } catch {
        return { content, studentContentId: content.content_id };
      }
    });

  const studentLectureQueries = masterLectureResults
    .filter((r) => r.isMaster)
    .map(async ({ content }): Promise<StudentContentResult> => {
      try {
        const result = await queryClient
          .from("lectures")
          .select("id")
          .eq("student_id", studentId)
          .eq("master_content_id", content.content_id)
          .maybeSingle();
        return {
          content,
          studentContentId: result.data?.id || content.content_id,
        };
      } catch {
        return { content, studentContentId: content.content_id };
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
    .select("title, subject, subject_category, master_content_id")
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

  // 마스터 콘텐츠 ID로 학생 강의 찾기
  const actualMasterContentId = masterContentId || contentId;
  const { data: lectureByMaster } = await queryClient
    .from("lectures")
    .select("title, subject, subject_category")
    .eq("student_id", studentId)
    .eq("master_content_id", actualMasterContentId)
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
    studentBook: { id: string; total_pages: number | null; master_content_id: string | null } | null;
  };
  type LectureDurationResult = {
    content: PlanContent;
    studentLecture: { id: string; duration: number | null; master_content_id: string | null } | null;
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
        .select("id, total_pages, master_content_id")
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
        .select("id, duration, master_content_id")
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
  type MasterBookResult = { content: PlanContent; masterBook: { id: string; total_pages: number | null } | null };
  type MasterLectureResult = { content: PlanContent; masterLecture: { id: string; total_duration: number | null } | null };

  const masterBookQueries: Promise<MasterBookResult>[] = [];
  const masterLectureQueries: Promise<MasterLectureResult>[] = [];

  // 학생 교재 결과 처리
  for (const { content, studentBook } of bookResults) {
    if (studentBook?.total_pages) {
      contentDurationMap.set(content.content_id, {
        content_type: "book",
        content_id: content.content_id,
        total_pages: studentBook.total_pages,
      });
    } else if (studentBook?.master_content_id) {
      const masterId = studentBook.master_content_id;
      masterBookQueries.push(
        (async (): Promise<MasterBookResult> => {
          try {
            const result = await masterQueryClient
              .from("master_books")
              .select("id, total_pages")
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

  // 학생 강의 결과 처리
  for (const { content, studentLecture } of lectureResults) {
    if (studentLecture?.duration) {
      contentDurationMap.set(content.content_id, {
        content_type: "lecture",
        content_id: content.content_id,
        duration: studentLecture.duration,
      });
    } else if (studentLecture?.master_content_id) {
      const masterId = studentLecture.master_content_id;
      masterLectureQueries.push(
        (async (): Promise<MasterLectureResult> => {
          try {
            const result = await masterQueryClient
              .from("master_lectures")
              .select("id, total_duration")
              .eq("id", masterId)
              .maybeSingle();
            return { content, masterLecture: result.data };
          } catch {
            return { content, masterLecture: null };
          }
        })()
      );
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

    for (const { content, masterBook } of masterBookResults) {
      if (masterBook?.total_pages) {
        contentDurationMap.set(content.content_id, {
          content_type: "book",
          content_id: content.content_id,
          total_pages: masterBook.total_pages,
        });
      }
    }

    for (const { content, masterLecture } of masterLectureResults) {
      if (masterLecture?.total_duration) {
        contentDurationMap.set(content.content_id, {
          content_type: "lecture",
          content_id: content.content_id,
          duration: masterLecture.total_duration,
        });
      }
    }
  }

  return contentDurationMap;
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
