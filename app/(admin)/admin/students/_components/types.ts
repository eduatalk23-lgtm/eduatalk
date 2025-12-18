/**
 * 학생 목록 관련 타입 정의
 */

export type StudentListRow = {
  id: string;
  name: string | null;
  grade: string | null;
  class: string | null;
  schoolName: string;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
  is_active: boolean | null;
};

