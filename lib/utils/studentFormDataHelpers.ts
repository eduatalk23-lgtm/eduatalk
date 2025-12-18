/**
 * 학생 FormData 필드 분리 헬퍼 함수
 * 
 * FormData에서 학생 정보를 기본정보, 프로필, 진로정보로 분리하여 반환
 */

/**
 * 학생 FormData 필드를 기본정보, 프로필, 진로정보로 분리
 * 
 * @param formData - 학생 정보 FormData
 * @returns 분리된 필드 객체 (각 그룹은 FormData로 반환)
 */
export function separateStudentFormFields(formData: FormData): {
  basic: FormData;
  profile: FormData;
  career: FormData;
} {
  // 기본 정보 필드
  const basicFields = [
    "name",
    "grade",
    "class",
    "birth_date",
    "school_id",
    "school_type",
    "division",
    "student_number",
    "enrolled_at",
    "status",
  ];

  // 프로필 정보 필드
  const profileFields = [
    "gender",
    "phone",
    "mother_phone",
    "father_phone",
    "address",
    "address_detail",
    "postal_code",
    "emergency_contact",
    "emergency_contact_phone",
    "medical_info",
    "bio",
    "interests",
  ];

  // 진로 정보 필드
  const careerFields = [
    "exam_year",
    "curriculum_revision",
    "desired_university_ids",
    "desired_career_field",
    "target_major",
    "target_major_2",
    "target_score",
    "target_university_type",
    "notes",
  ];

  const basic = new FormData();
  const profile = new FormData();
  const career = new FormData();

  // 기본 정보 추출
  for (const field of basicFields) {
    const value = formData.get(field);
    if (value !== null) {
      basic.append(field, value);
    }
  }

  // 프로필 정보 추출
  for (const field of profileFields) {
    if (field === "interests") {
      // interests는 배열로 처리
      const values = formData.getAll(field);
      values.forEach((value) => {
        if (value !== null) {
          profile.append(field, value);
        }
      });
    } else {
      const value = formData.get(field);
      if (value !== null) {
        profile.append(field, value);
      }
    }
  }

  // 진로 정보 추출
  for (const field of careerFields) {
    if (field === "desired_university_ids") {
      // desired_university_ids는 배열로 처리
      const values = formData.getAll(field);
      values.forEach((value) => {
        if (value !== null) {
          career.append(field, value);
        }
      });
    } else {
      const value = formData.get(field);
      if (value !== null) {
        career.append(field, value);
      }
    }
  }

  return { basic, profile, career };
}

