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
