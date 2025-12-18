/**
 * 학생 학교 정보 배치 조회 함수
 * 
 * 여러 학생의 학교 정보를 한 번에 조회하여 N+1 문제를 해결합니다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UniversityWithCampus } from "@/lib/domains/school/types";

type SupabaseServerClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>
>;

/**
 * 여러 학생의 학교명을 배치로 조회
 * 
 * @param supabase Supabase 서버 클라이언트
 * @param students 학생 데이터 배열 (id, school_id, school_type 포함)
 * @returns Map<studentId, schoolName>
 */
export async function getStudentSchoolsBatch(
  supabase: SupabaseServerClient,
  students: Array<{
    id: string;
    school_id: string | null;
    school_type: "MIDDLE" | "HIGH" | "UNIVERSITY" | null;
  }>
): Promise<Map<string, string>> {
  const schoolMap = new Map<string, string>();

  if (students.length === 0) {
    return schoolMap;
  }

  // school_id가 있는 학생들만 필터링
  const studentsWithSchool = students.filter(
    (s) => s.school_id && s.school_id.trim() !== ""
  );

  if (studentsWithSchool.length === 0) {
    // 학교 정보가 없는 학생들은 "-"로 설정
    students.forEach((s) => schoolMap.set(s.id, "-"));
    return schoolMap;
  }

  // school_id를 타입별로 분류
  const schoolInfoIds: number[] = [];
  const universityCampusIds: number[] = [];
  const studentIdToSchoolId = new Map<string, string>();

  for (const student of studentsWithSchool) {
    const schoolId = student.school_id!;
    studentIdToSchoolId.set(student.id, schoolId);

    if (schoolId.startsWith("SCHOOL_")) {
      const sourceId = parseInt(schoolId.replace("SCHOOL_", ""), 10);
      if (!isNaN(sourceId)) {
        schoolInfoIds.push(sourceId);
      }
    } else if (schoolId.startsWith("UNIV_")) {
      const sourceId = parseInt(schoolId.replace("UNIV_", ""), 10);
      if (!isNaN(sourceId)) {
        universityCampusIds.push(sourceId);
      }
    }
  }

  // 중복 제거
  const uniqueSchoolInfoIds = [...new Set(schoolInfoIds)];
  const uniqueUniversityCampusIds = [...new Set(universityCampusIds)];

  // 병렬로 두 타입의 학교 정보 조회
  const [schoolInfoResults, universityCampusResults] = await Promise.all([
    // 중·고등학교 조회
    uniqueSchoolInfoIds.length > 0
      ? supabase
          .from("school_info")
          .select("id, school_name")
          .in("id", uniqueSchoolInfoIds)
          .eq("closed_flag", "N")
      : Promise.resolve({ data: null, error: null }),

    // 대학교 조회
    uniqueUniversityCampusIds.length > 0
      ? supabase
          .from("university_campuses")
          .select(`
            id,
            campus_name,
            university:universities(name_kor)
          `)
          .in("id", uniqueUniversityCampusIds)
          .eq("campus_status", "기존")
      : Promise.resolve({ data: null, error: null }),
  ]);

  // 중·고등학교 결과 처리
  const schoolInfoMap = new Map<number, string>();
  if (schoolInfoResults.data && !schoolInfoResults.error) {
    for (const school of schoolInfoResults.data) {
      schoolInfoMap.set(school.id, school.school_name);
    }
  }

  // 대학교 결과 처리
  const universityCampusMap = new Map<number, string>();
  if (universityCampusResults.data && !universityCampusResults.error) {
    for (const campus of universityCampusResults.data) {
      const universityCampus = campus as unknown as UniversityWithCampus;
      const university = Array.isArray(universityCampus.university)
        ? universityCampus.university[0]
        : universityCampus.university;
      const campusName = universityCampus.campus_name;
      const universityName = university?.name_kor || campusName;

      // 캠퍼스명이 대학명과 같으면 대학명만, 다르면 "대학명 (캠퍼스명)" 형식
      const displayName =
        campusName === universityName
          ? universityName
          : `${universityName} (${universityCampus.campus_type || ""})`;

      universityCampusMap.set(universityCampus.id, displayName);
    }
  }

  // 학생 ID와 학교명 매핑
  for (const student of students) {
    const schoolId = student.school_id;

    if (!schoolId || schoolId.trim() === "") {
      schoolMap.set(student.id, "-");
      continue;
    }

    if (schoolId.startsWith("SCHOOL_")) {
      const sourceId = parseInt(schoolId.replace("SCHOOL_", ""), 10);
      if (!isNaN(sourceId)) {
        const schoolName = schoolInfoMap.get(sourceId) || "-";
        schoolMap.set(student.id, schoolName);
      } else {
        schoolMap.set(student.id, "-");
      }
    } else if (schoolId.startsWith("UNIV_")) {
      const sourceId = parseInt(schoolId.replace("UNIV_", ""), 10);
      if (!isNaN(sourceId)) {
        const schoolName = universityCampusMap.get(sourceId) || "-";
        schoolMap.set(student.id, schoolName);
      } else {
        schoolMap.set(student.id, "-");
      }
    } else {
      schoolMap.set(student.id, "-");
    }
  }

  return schoolMap;
}

