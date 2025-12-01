"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 특정 교과의 세부 과목 목록 조회
 * 
 * @param subjectCategory - 교과명 (예: "국어", "수학", "영어")
 * @returns 세부 과목 목록 (중복 제거 및 정렬됨)
 */
export async function fetchDetailSubjects(subjectCategory: string): Promise<string[]> {
  try {
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

