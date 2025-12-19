/**
 * 학생 목록 관련 타입 정의
 */

import type { StudentDivision } from "@/lib/constants/students";

export type StudentListRow = {
  id: string;
  name: string | null;
  grade: string | null;
  class: string | null;
  division: StudentDivision | null;
  schoolName: string;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
  is_active: boolean | null;
  gender: "남" | "여" | null;
  email: string | null;
};

