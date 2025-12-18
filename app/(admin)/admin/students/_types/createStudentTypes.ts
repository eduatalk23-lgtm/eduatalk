/**
 * 신규 학생 등록 폼 타입 정의
 */

export type CreateStudentFormData = {
  // 기본 정보
  name: string;
  grade: string;
  class: string;
  birth_date: string;
  school_id: string;
  school_type?: "MIDDLE" | "HIGH" | "UNIVERSITY" | undefined;
  division?: "고등부" | "중등부" | "기타" | undefined;
  student_number: string;
  enrolled_at: string;
  status: "enrolled" | "on_leave" | "graduated" | "transferred";
  // 프로필 정보
  gender?: "남" | "여" | undefined;
  phone: string;
  mother_phone: string;
  father_phone: string;
  address: string;
  address_detail: string;
  postal_code: string;
  emergency_contact: string;
  emergency_contact_phone: string;
  medical_info: string;
  bio: string;
  interests: string[];
  // 진로 정보
  exam_year?: number | undefined;
  curriculum_revision?: "2009 개정" | "2015 개정" | "2022 개정" | undefined;
  desired_university_ids: string[];
  desired_career_field: string;
  target_major: string;
  target_major_2: string;
  target_score?: Record<string, number> | undefined;
  target_university_type: string;
  notes: string;
};

