"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSubjectsByGroupName } from "@/lib/data/subjects";

/**
 * 특정 교과의 세부 과목 목록 조회
 * 
 * @param subjectCategory - 교과명 (예: "국어", "수학", "영어")
 * @param curriculumRevisionId - 개정교육과정 ID (선택사항, 있으면 subjects 테이블에서 조회)
 * @returns 세부 과목 목록 (중복 제거 및 정렬됨)
 */
export async function fetchDetailSubjects(
  subjectCategory: string,
  curriculumRevisionId?: string
): Promise<string[]> {
  try {
    // 개정교육과정 ID가 있으면 subjects 테이블에서 조회 (정규화된 구조)
    if (curriculumRevisionId) {
      const subjects = await getSubjectsByGroupName(
        subjectCategory,
        curriculumRevisionId
      );
      return subjects.map((s) => s.name).sort();
    }

    // 개정교육과정 ID가 없으면 기존 방식 (master_books, master_lectures에서 조회)
    // 하위 호환성을 위해 유지
    const supabase = await createSupabaseServerClient();
    
    // master_books에서 조회
    const { data: bookSubjects, error: bookError } = await supabase
      .from("master_books")
      .select("subject")
      .eq("subject_category", subjectCategory)
      .not("subject", "is", null);
    
    if (bookError) {
      console.error("Error fetching book subjects:", bookError);
    }
    
    // master_lectures에서 조회
    const { data: lectureSubjects, error: lectureError } = await supabase
      .from("master_lectures")
      .select("subject")
      .eq("subject_category", subjectCategory)
      .not("subject", "is", null);
    
    if (lectureError) {
      console.error("Error fetching lecture subjects:", lectureError);
    }
    
    // 중복 제거 및 정렬
    const allSubjects = new Set<string>();
    
    bookSubjects?.forEach((item) => {
      if (item.subject) {
        allSubjects.add(item.subject);
      }
    });
    
    lectureSubjects?.forEach((item) => {
      if (item.subject) {
        allSubjects.add(item.subject);
      }
    });
    
    return Array.from(allSubjects).sort();
  } catch (error) {
    console.error("Error in fetchDetailSubjects:", error);
    return [];
  }
}

