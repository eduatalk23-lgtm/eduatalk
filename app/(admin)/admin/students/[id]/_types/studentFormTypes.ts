/**
 * 관리자용 학생 정보 편집 폼 타입 정의
 * 학생 설정 페이지의 타입을 확장하여 관리자 전용 필드 추가
 */

import type { StudentFormData as BaseStudentFormData } from "@/app/(student)/settings/types";

/**
 * 관리자용 학생 정보 폼 데이터 타입
 * 기본 StudentFormData에 관리자 전용 필드 추가
 */
export type AdminStudentFormData = BaseStudentFormData & {
  // 관리자 전용 필드
  class?: string; // 반 정보
  division?: "고등부" | "중등부" | "기타" | "";
  memo?: string;
  status?: "enrolled" | "on_leave" | "graduated" | "transferred" | "";
  is_active?: boolean;
  // 프로필 확장 필드
  address?: string;
  emergency_contact?: string;
  emergency_contact_phone?: string;
  medical_info?: string;
};

/**
 * 학생 정보 조회용 통합 데이터 타입
 */
export type StudentInfoData = {
  // students 테이블
  id: string;
  name?: string | null;
  grade?: string | null;
  class?: string | null;
  birth_date?: string | null;
  school_id?: string | null;
  school_name?: string | null;
  school_type?: "MIDDLE" | "HIGH" | "UNIVERSITY" | null;
  division?: "고등부" | "중등부" | "기타" | null;
  memo?: string | null;
  status?: "enrolled" | "on_leave" | "graduated" | "transferred" | null;
  is_active?: boolean | null;
  tenant_id?: string | null;
  // student_profiles 테이블
  gender?: "남" | "여" | null;
  phone?: string | null;
  mother_phone?: string | null;
  father_phone?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  emergency_contact_phone?: string | null;
  medical_info?: string | null;
  // student_career_goals 테이블
  exam_year?: number | null;
  curriculum_revision?: "2009 개정" | "2015 개정" | "2022 개정" | null;
  desired_university_ids?: string[] | null;
  desired_career_field?: string | null;
};

