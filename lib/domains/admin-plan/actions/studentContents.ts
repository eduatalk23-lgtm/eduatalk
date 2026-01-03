'use server';

import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { getBooks, getLectures } from '@/lib/data/studentContents';
import type { Book, Lecture } from '@/lib/data/studentContents';
import { getPlanGroupWithDetailsForAdmin } from '@/lib/data/planGroups/admin';
import { withErrorHandlingSafe } from '@/lib/errors';

export interface StudentContentItem {
  id: string;
  type: 'book' | 'lecture';
  title: string;
  subject?: string | null;
  totalRange: number;
}

/**
 * 관리자용 학생 콘텐츠 목록 조회
 * 특정 학생의 books와 lectures를 조회합니다.
 */
async function _getStudentContentsForAdmin(
  studentId: string,
  tenantId: string
): Promise<{ contents: StudentContentItem[] }> {
  await requireAdminOrConsultant();

  const [books, lectures] = await Promise.all([
    getBooks(studentId, tenantId),
    getLectures(studentId, tenantId),
  ]);

  const contents: StudentContentItem[] = [
    ...books.map((b: Book) => ({
      id: b.id,
      type: 'book' as const,
      title: b.title,
      subject: b.subject,
      totalRange: b.total_pages ?? 100,
    })),
    ...lectures.map((l: Lecture) => ({
      id: l.id,
      type: 'lecture' as const,
      title: l.title,
      subject: l.subject,
      totalRange: l.total_episodes ?? 20,
    })),
  ];

  return { contents };
}

export const getStudentContentsForAdmin = withErrorHandlingSafe(_getStudentContentsForAdmin);

/**
 * 관리자용 플랜 그룹 상세 정보 조회 서버 액션
 */
async function _getPlanGroupDetailsForAdmin(
  groupId: string,
  tenantId: string
) {
  await requireAdminOrConsultant();
  return getPlanGroupWithDetailsForAdmin(groupId, tenantId);
}

export const getPlanGroupDetailsForAdminAction = withErrorHandlingSafe(_getPlanGroupDetailsForAdmin);

// ============================================
// AI 플랜 생성용 학생/콘텐츠 데이터 조회
// ============================================

import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface AIPlanStudentData {
  id: string;
  name: string;
  grade: string;
}

export interface AIPlanContentData {
  id: string;
  title: string;
  subject: string;
  subjectCategory: string;
  contentType: 'book' | 'lecture' | 'custom';
  estimatedHours: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface AIPlanScoreData {
  subject: string;
  subjectCategory: string;
  score: number;
}

export interface GetStudentContentsForAIPlanInput {
  studentId: string;
  tenantId: string;
  contentIds: string[];
}

export interface GetStudentContentsForAIPlanResult {
  student: AIPlanStudentData;
  contents: AIPlanContentData[];
  scores: AIPlanScoreData[];
}

/**
 * AI 플랜 생성용 학생/콘텐츠/성적 데이터 조회
 *
 * 하이브리드 플랜 생성에 필요한 데이터를 한 번에 조회합니다.
 */
async function _getStudentContentsForAIPlan(
  input: GetStudentContentsForAIPlanInput
): Promise<GetStudentContentsForAIPlanResult> {
  await requireAdminOrConsultant();

  const supabase = await createSupabaseServerClient();
  const { studentId, tenantId, contentIds } = input;

  // 1. 학생 정보 조회
  const { data: studentRow, error: studentError } = await supabase
    .from('students')
    .select('id, name, grade')
    .eq('id', studentId)
    .eq('tenant_id', tenantId)
    .single();

  if (studentError || !studentRow) {
    throw new Error('학생 정보를 찾을 수 없습니다.');
  }

  const student: AIPlanStudentData = {
    id: studentRow.id,
    name: studentRow.name || '학생',
    grade: studentRow.grade || '고1',
  };

  // 2. 콘텐츠 정보 조회 (books + lectures)
  const [booksResult, lecturesResult] = await Promise.all([
    supabase
      .from('student_books')
      .select(`
        id,
        book:books(
          id,
          title,
          subject,
          subject_category,
          total_pages,
          difficulty
        )
      `)
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .in('book_id', contentIds),
    supabase
      .from('student_lectures')
      .select(`
        id,
        lecture:lectures(
          id,
          title,
          subject,
          subject_category,
          total_episodes,
          average_duration,
          difficulty
        )
      `)
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .in('lecture_id', contentIds),
  ]);

  const contents: AIPlanContentData[] = [];

  // Books 처리
  if (booksResult.data) {
    for (const row of booksResult.data) {
      // Supabase의 단일 관계는 객체로 반환됨
      const book = row.book as unknown as {
        id: string;
        title: string;
        subject: string | null;
        subject_category: string | null;
        total_pages: number | null;
        difficulty: string | null;
      } | null;
      if (book) {
        contents.push({
          id: book.id,
          title: book.title || '교재',
          subject: book.subject || '기타',
          subjectCategory: book.subject_category || book.subject || '기타',
          contentType: 'book',
          estimatedHours: Math.ceil((book.total_pages || 100) / 20), // ~20페이지/시간
          difficulty: (book.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
        });
      }
    }
  }

  // Lectures 처리
  if (lecturesResult.data) {
    for (const row of lecturesResult.data) {
      // Supabase의 단일 관계는 객체로 반환됨
      const lecture = row.lecture as unknown as {
        id: string;
        title: string;
        subject: string | null;
        subject_category: string | null;
        total_episodes: number | null;
        average_duration: number | null;
        difficulty: string | null;
      } | null;
      if (lecture) {
        const avgDuration = lecture.average_duration || 30;
        const totalEpisodes = lecture.total_episodes || 20;
        contents.push({
          id: lecture.id,
          title: lecture.title || '강의',
          subject: lecture.subject || '기타',
          subjectCategory: lecture.subject_category || lecture.subject || '기타',
          contentType: 'lecture',
          estimatedHours: Math.ceil((totalEpisodes * avgDuration) / 60),
          difficulty: (lecture.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
        });
      }
    }
  }

  // 3. 최근 성적 조회
  const { data: scoresRows } = await supabase
    .from('scores')
    .select('subject, subject_category, score')
    .eq('student_id', studentId)
    .eq('tenant_id', tenantId)
    .order('exam_date', { ascending: false })
    .limit(20);

  // 과목별 최신 성적만 사용
  const scoreMap = new Map<string, AIPlanScoreData>();
  if (scoresRows) {
    for (const row of scoresRows) {
      const key = row.subject_category || row.subject;
      if (key && !scoreMap.has(key)) {
        scoreMap.set(key, {
          subject: row.subject || '기타',
          subjectCategory: row.subject_category || row.subject || '기타',
          score: row.score || 0,
        });
      }
    }
  }

  return {
    student,
    contents,
    scores: Array.from(scoreMap.values()),
  };
}

export const getStudentContentsForAIPlanAction = withErrorHandlingSafe(_getStudentContentsForAIPlan);
