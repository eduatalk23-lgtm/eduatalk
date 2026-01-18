/**
 * 콘텐츠 관련 데이터 로더
 *
 * - loadOwnedContents: 보유 콘텐츠 (책 + 강의)
 * - loadCandidateContents: 추천 후보 콘텐츠
 *
 * @module loaders/contentLoader
 */

import type { SupabaseClient } from "./types";
import type { OwnedContentInfo, ContentCandidate } from "../prompts/contentRecommendation";

/**
 * 학생의 보유 콘텐츠 조회 (책 + 강의)
 */
export async function loadOwnedContents(
  supabase: SupabaseClient,
  studentId: string
): Promise<OwnedContentInfo[]> {
  // 학생의 보유 콘텐츠 조회 (책 + 강의)
  const { data: books } = await supabase
    .from("student_books")
    .select(`
      id,
      title,
      subject,
      subject_group_name,
      completed_pages,
      total_pages
    `)
    .eq("student_id", studentId);

  const { data: lectures } = await supabase
    .from("student_lectures")
    .select(`
      id,
      title,
      subject,
      subject_group_name,
      completed_episodes,
      total_episodes
    `)
    .eq("student_id", studentId);

  const contents: OwnedContentInfo[] = [];

  if (books) {
    books.forEach((b) => {
      const completedPercentage = b.total_pages && b.completed_pages
        ? Math.round((b.completed_pages / b.total_pages) * 100)
        : undefined;

      contents.push({
        id: b.id,
        title: b.title,
        subject: b.subject ?? "",
        subjectCategory: b.subject_group_name ?? "",
        contentType: "book",
        completedPercentage,
      });
    });
  }

  if (lectures) {
    lectures.forEach((l) => {
      const completedPercentage = l.total_episodes && l.completed_episodes
        ? Math.round((l.completed_episodes / l.total_episodes) * 100)
        : undefined;

      contents.push({
        id: l.id,
        title: l.title,
        subject: l.subject ?? "",
        subjectCategory: l.subject_group_name ?? "",
        contentType: "lecture",
        completedPercentage,
      });
    });
  }

  return contents;
}

/**
 * 추천 후보 콘텐츠 조회 (master_books + master_lectures)
 */
export async function loadCandidateContents(
  supabase: SupabaseClient,
  subjectCategories?: string[],
  limit: number = 50
): Promise<ContentCandidate[]> {
  // master_books와 master_lectures에서 각각 조회 후 병합
  const halfLimit = Math.ceil(limit / 2);

  // 책 조회
  let booksQuery = supabase
    .from("master_books")
    .select(`
      id,
      title,
      subject,
      subject_category,
      difficulty_level,
      publisher_name,
      total_pages,
      description
    `)
    .eq("is_active", true)
    .limit(halfLimit);

  if (subjectCategories && subjectCategories.length > 0) {
    booksQuery = booksQuery.in("subject_category", subjectCategories);
  }

  // 강의 조회
  let lecturesQuery = supabase
    .from("master_lectures")
    .select(`
      id,
      title,
      subject,
      subject_category,
      difficulty_level,
      platform,
      total_episodes,
      notes
    `)
    .eq("is_active", true)
    .limit(halfLimit);

  if (subjectCategories && subjectCategories.length > 0) {
    lecturesQuery = lecturesQuery.in("subject_category", subjectCategories);
  }

  const [{ data: books }, { data: lectures }] = await Promise.all([
    booksQuery,
    lecturesQuery,
  ]);

  const bookContents: ContentCandidate[] = (books || []).map((b) => ({
    id: b.id,
    title: b.title,
    subject: b.subject ?? "",
    subjectCategory: b.subject_category ?? "",
    contentType: "book" as const,
    difficulty: b.difficulty_level as "easy" | "medium" | "hard" | undefined,
    publisher: b.publisher_name ?? undefined,
    description: b.description ?? undefined,
    totalPages: b.total_pages ?? undefined,
  }));

  const lectureContents: ContentCandidate[] = (lectures || []).map((l) => ({
    id: l.id,
    title: l.title,
    subject: l.subject ?? "",
    subjectCategory: l.subject_category ?? "",
    contentType: "lecture" as const,
    difficulty: l.difficulty_level as "easy" | "medium" | "hard" | undefined,
    platform: l.platform ?? undefined,
    description: l.notes ?? undefined,
    totalLectures: l.total_episodes ?? undefined,
  }));

  return [...bookContents, ...lectureContents];
}
