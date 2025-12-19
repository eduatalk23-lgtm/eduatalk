/**
 * 학생 필터링 관련 공통 유틸리티 함수
 * 
 * 여러 컴포넌트에서 중복 사용되는 학생 필터링 로직을 통합하여
 * 코드 중복을 제거하고 일관성을 유지합니다.
 */

export type RecipientType = "student" | "mother" | "father";

export type Student = {
  id: string;
  name: string | null;
  grade?: string | null;
  class?: string | null;
  division?: string | null;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
  is_active?: boolean | null;
};

export type StudentFilter = {
  search?: string;
  grade?: string;
  class?: string;
  division?: string;
  isActive?: "all" | "active" | "inactive";
};

/**
 * 학생 목록을 필터링합니다.
 * 
 * @param students - 필터링할 학생 목록
 * @param filters - 필터 조건
 * @returns 필터링된 학생 목록
 */
export function filterStudents(
  students: Student[],
  filters: StudentFilter
): Student[] {
  return students.filter((student) => {
    // 검색 필터
    if (filters.search) {
      const searchLower = filters.search.toLowerCase().trim();
      const nameMatch = student.name?.toLowerCase().includes(searchLower) ?? false;
      const phoneMatch = student.phone?.includes(filters.search) ?? false;
      const motherPhoneMatch = student.mother_phone?.includes(filters.search) ?? false;
      const fatherPhoneMatch = student.father_phone?.includes(filters.search) ?? false;
      
      // grade와 class는 문자열이 아닐 수 있으므로 String()으로 변환
      const gradeMatch = student.grade
        ? String(student.grade).toLowerCase().includes(searchLower)
        : false;
      const classMatch = student.class
        ? String(student.class).toLowerCase().includes(searchLower)
        : false;
      
      if (!nameMatch && !phoneMatch && !motherPhoneMatch && !fatherPhoneMatch && !gradeMatch && !classMatch) {
        return false;
      }
    }

    // 학년 필터
    if (filters.grade && student.grade !== filters.grade) {
      return false;
    }

    // 반 필터
    if (filters.class && student.class !== filters.class) {
      return false;
    }

    // 분반 필터
    if (filters.division && student.division !== filters.division) {
      return false;
    }

    // 활성 상태 필터
    if (filters.isActive === "active" && student.is_active !== true) {
      return false;
    }
    if (filters.isActive === "inactive" && student.is_active !== false) {
      return false;
    }

    return true;
  });
}

/**
 * 전송 대상자 타입에 따라 학생의 전화번호를 반환합니다.
 * 
 * @param student - 학생 정보
 * @param type - 전송 대상자 타입
 * @returns 전화번호 또는 null
 */
export function getPhoneByRecipientType(
  student: Student,
  type: RecipientType
): string | null {
  switch (type) {
    case "student":
      return student.phone;
    case "mother":
      return student.mother_phone;
    case "father":
      return student.father_phone;
    default:
      return student.mother_phone ?? student.father_phone ?? student.phone;
  }
}

/**
 * 학생 목록에서 고유한 학년 목록을 추출합니다.
 * 
 * @param students - 학생 목록
 * @returns 고유한 학년 목록 (정렬됨)
 */
export function extractUniqueGrades(students: Student[]): string[] {
  const grades = new Set<string>();
  students.forEach((student) => {
    if (student.grade) {
      grades.add(String(student.grade));
    }
  });
  return Array.from(grades).sort();
}

/**
 * 학생 목록에서 고유한 반 목록을 추출합니다.
 * 
 * @param students - 학생 목록
 * @returns 고유한 반 목록 (정렬됨)
 */
export function extractUniqueClasses(students: Student[]): string[] {
  const classes = new Set<string>();
  students.forEach((student) => {
    if (student.class) {
      classes.add(String(student.class));
    }
  });
  return Array.from(classes).sort();
}

/**
 * 학생 목록에서 고유한 분반 목록을 추출합니다.
 * 
 * @param students - 학생 목록
 * @returns 고유한 분반 목록 (정렬됨)
 */
export function extractUniqueDivisions(students: Student[]): string[] {
  const divisions = new Set<string>();
  students.forEach((student) => {
    if (student.division) {
      divisions.add(String(student.division));
    }
  });
  return Array.from(divisions).sort();
}

