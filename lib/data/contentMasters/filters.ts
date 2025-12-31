/**
 * 필터 옵션 조회 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClientForRLSBypass } from "@/lib/supabase/clientSelector";
import {
  getSubjectGroups,
  getSubjectsByGroup,
  type SubjectGroup,
  type Subject,
} from "@/lib/data/subjects";
import { logActionError } from "@/lib/logging/actionLogger";
import { createTypedQuery } from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";

/**
 * 개정교육과정 목록 조회 (필터 옵션용)
 */
export async function getCurriculumRevisions(): Promise<
  Array<{ id: string; name: string }>
> {
  // Admin 클라이언트 우선 사용 (RLS 우회), 없으면 일반 서버 클라이언트 사용
  const supabase = await getClientForRLSBypass();

  if (!supabase) {
    handleQueryError(null, {
      context: "[data/contentMasters] getCurriculumRevisions",
      logError: true,
    });
    return [];
  }

  const result = await createTypedQuery<Array<{ id: string; name: string }>>(
    async () => {
      return await supabase
        .from("curriculum_revisions")
        .select("id, name")
        .order("name", { ascending: true });
    },
    {
      context: "[data/contentMasters] getCurriculumRevisions",
      defaultValue: [],
    }
  );

  return result ?? [];
}

/**
 * 교과 목록 조회 (필터 옵션용)
 * @param curriculumRevisionId 개정교육과정 ID (선택사항)
 */
export async function getSubjectGroupsForFilter(
  curriculumRevisionId?: string
): Promise<SubjectGroup[]> {
  return await getSubjectGroups(curriculumRevisionId);
}

/**
 * 과목 목록 조회 (필터 옵션용)
 * @param subjectGroupId 교과 그룹 ID (선택사항, 없으면 모든 과목 조회)
 */
export async function getSubjectsForFilter(
  subjectGroupId?: string
): Promise<Subject[]> {
  if (!subjectGroupId) {
    // 모든 과목 조회 (성능 고려하여 제한)
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .order("name", { ascending: true })
      .limit(500); // 최대 500개 제한

    if (error) {
      logActionError(
        { domain: "data", action: "getSubjectsForFilter" },
        error
      );
      return [];
    }

    return (data as Subject[] | null) ?? [];
  }

  return await getSubjectsByGroup(subjectGroupId);
}

/**
 * 과목 목록 조회 (교재)
 */
export async function getBookSubjectList(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("master_books")
    .select("subject")
    .not("subject", "is", null);

  if (error) {
    logActionError({ domain: "data", action: "getBookSubjectList" }, error);
    return [];
  }

  const subjects = Array.from(
    new Set((data || []).map((item) => item.subject).filter(Boolean))
  ).sort();

  return subjects as string[];
}

/**
 * 과목 목록 조회 (강의)
 */
export async function getLectureSubjectList(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("master_lectures")
    .select("subject")
    .not("subject", "is", null);

  if (error) {
    logActionError({ domain: "data", action: "getLectureSubjectList" }, error);
    return [];
  }

  const subjects = Array.from(
    new Set((data || []).map((item) => item.subject).filter(Boolean))
  ).sort();

  return subjects as string[];
}

/**
 * 과목 목록 조회 (하위 호환성)
 * @deprecated getBookSubjectList 또는 getLectureSubjectList 사용 권장
 */
export async function getSubjectList(
  content_type?: "book" | "lecture"
): Promise<string[]> {
  if (content_type === "book") {
    return getBookSubjectList();
  } else if (content_type === "lecture") {
    return getLectureSubjectList();
  } else {
    // 둘 다 조회
    const [books, lectures] = await Promise.all([
      getBookSubjectList(),
      getLectureSubjectList(),
    ]);
    return Array.from(new Set([...books, ...lectures])).sort();
  }
}

/**
 * 학기 목록 조회 (학생 콘텐츠용)
 * @deprecated 마스터 콘텐츠에서 semester 필드가 제거됨 (2025-02-04)
 * 학생 콘텐츠(books, lectures)에서만 사용 가능
 */
export async function getSemesterList(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  // 마스터 콘텐츠에서 semester 필드 제거됨
  // 학생 콘텐츠(books, lectures)에서만 조회
  const [booksResult, lecturesResult] = await Promise.all([
    supabase.from("books").select("semester").not("semester", "is", null),
    supabase.from("lectures").select("semester").not("semester", "is", null),
  ]);

  const allSemesters = [
    ...(booksResult.data || []).map(
      (item: { semester: string }) => item.semester
    ),
    ...(lecturesResult.data || []).map(
      (item: { semester: string }) => item.semester
    ),
  ];

  const semesters = Array.from(new Set(allSemesters.filter(Boolean))).sort();

  return semesters as string[];
}

/**
 * 출판사 목록 조회 (필터 옵션용)
 * master_books 테이블에서 실제로 사용된 publisher_id를 기반으로 조회
 * @param tenantId 테넌트 ID (선택적, 없으면 공개 콘텐츠만)
 */
export async function getPublishersForFilter(
  tenantId?: string | null
): Promise<Array<{ id: string; name: string }>> {
  const supabase = await getClientForRLSBypass();
  if (!supabase) return [];

  // master_books에서 실제로 사용된 publisher_id 조회
  let publisherQuery = supabase
    .from("master_books")
    .select("publisher_id")
    .not("publisher_id", "is", null);

  // tenantId가 있으면 해당 테넌트 + 공개 콘텐츠만, 없으면 공개 콘텐츠만
  if (tenantId) {
    publisherQuery = publisherQuery.or(
      `tenant_id.is.null,tenant_id.eq.${tenantId}`
    );
  } else {
    publisherQuery = publisherQuery.is("tenant_id", null);
  }

  const { data: booksData, error: booksError } = await publisherQuery;

  if (booksError) {
    logActionError(
      { domain: "data", action: "getPublishersForFilter" },
      booksError,
      { step: "getPublisherIds" }
    );
    return [];
  }

  // 사용된 publisher_id 추출 (중복 제거)
  const publisherIds = Array.from(
    new Set(
      (booksData || [])
        .map((book: { publisher_id: string | null }) => book.publisher_id)
        .filter((id): id is string => id !== null)
    )
  );

  if (publisherIds.length === 0) {
    return [];
  }

  // publishers 테이블에서 해당 출판사 정보 조회
  const { data, error } = await supabase
    .from("publishers")
    .select("id, name")
    .in("id", publisherIds)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    logActionError(
      { domain: "data", action: "getPublishersForFilter" },
      error,
      { step: "getPublisherDetails" }
    );
    return [];
  }

  return (data as Array<{ id: string; name: string }> | null) ?? [];
}

/**
 * 플랫폼 목록 조회 (필터 옵션용)
 * master_lectures 테이블에서 실제로 사용된 platform_id를 기반으로 조회
 * @param tenantId 테넌트 ID (선택적, 없으면 공개 콘텐츠만)
 */
export async function getPlatformsForFilter(
  tenantId?: string | null
): Promise<Array<{ id: string; name: string }>> {
  const supabase = await getClientForRLSBypass();
  if (!supabase) return [];

  // master_lectures에서 실제로 사용된 platform_id 조회
  let platformQuery = supabase
    .from("master_lectures")
    .select("platform_id")
    .not("platform_id", "is", null);

  // tenantId가 있으면 해당 테넌트 + 공개 콘텐츠만, 없으면 공개 콘텐츠만
  if (tenantId) {
    platformQuery = platformQuery.or(
      `tenant_id.is.null,tenant_id.eq.${tenantId}`
    );
  } else {
    platformQuery = platformQuery.is("tenant_id", null);
  }

  const { data: lecturesData, error: lecturesError } = await platformQuery;

  if (lecturesError) {
    logActionError(
      { domain: "data", action: "getPlatformsForFilter" },
      lecturesError,
      { step: "getPlatformIds" }
    );
    return [];
  }

  // 사용된 platform_id 추출 (중복 제거)
  const platformIds = Array.from(
    new Set(
      (lecturesData || [])
        .map((lecture: { platform_id: string | null }) => lecture.platform_id)
        .filter((id): id is string => id !== null)
    )
  );

  if (platformIds.length === 0) {
    return [];
  }

  // platforms 테이블에서 해당 플랫폼 정보 조회
  const { data, error } = await supabase
    .from("platforms")
    .select("id, name")
    .in("id", platformIds)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    logActionError(
      { domain: "data", action: "getPlatformsForFilter" },
      error,
      { step: "getPlatformDetails" }
    );
    return [];
  }

  return (data as Array<{ id: string; name: string }> | null) ?? [];
}

/**
 * 마스터 교재 난이도 목록 조회 (필터 옵션용)
 */
export async function getDifficultiesForMasterBooks(
  tenantId?: string | null
): Promise<string[]> {
  const supabase = await getClientForRLSBypass();

  if (!supabase) return [];
  let query = supabase
    .from("master_books")
    .select("difficulty_level")
    .not("difficulty_level", "is", null);

  // tenantId가 있으면 해당 테넌트 + 공개 콘텐츠만, 없으면 공개 콘텐츠만
  if (tenantId) {
    query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
  } else {
    query = query.is("tenant_id", null);
  }

  const { data, error } = await query;

  if (error) {
    logActionError(
      { domain: "data", action: "getDifficultiesForMasterBooks" },
      error
    );
    return [];
  }

  const difficulties = new Set<string>();
  (data ?? []).forEach((item: { difficulty_level: string | null }) => {
    if (item.difficulty_level) {
      difficulties.add(item.difficulty_level);
    }
  });

  return Array.from(difficulties).sort();
}

/**
 * 마스터 강의 난이도 목록 조회 (필터 옵션용)
 */
export async function getDifficultiesForMasterLectures(
  tenantId?: string | null
): Promise<string[]> {
  const supabase = await getClientForRLSBypass();

  if (!supabase) return [];
  let query = supabase
    .from("master_lectures")
    .select("difficulty_level")
    .not("difficulty_level", "is", null);

  // tenantId가 있으면 해당 테넌트 + 공개 콘텐츠만, 없으면 공개 콘텐츠만
  if (tenantId) {
    query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
  } else {
    query = query.is("tenant_id", null);
  }

  const { data, error } = await query;

  if (error) {
    logActionError(
      { domain: "data", action: "getDifficultiesForMasterLectures" },
      error
    );
    return [];
  }

  const difficulties = new Set<string>();
  (data ?? []).forEach((item: { difficulty_level: string | null }) => {
    if (item.difficulty_level) {
      difficulties.add(item.difficulty_level);
    }
  });

  return Array.from(difficulties).sort();
}
