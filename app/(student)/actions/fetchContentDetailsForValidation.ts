"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 콘텐츠 상세 정보 조회 (검증용)
 * 
 * @param contents - 콘텐츠 목록 (content_type, content_id 포함)
 * @returns 콘텐츠 상세 정보 (subject_category, subject 포함)
 */
export async function fetchContentDetailsForValidation(
  contents: Array<{ content_type: string; content_id: string }>
): Promise<Array<{
  id: string;
  content_type: string;
  subject_category: string | null;
  subject: string | null;
}>> {
  try {
    const supabase = await createSupabaseServerClient();
    
    const books = contents.filter(c => c.content_type === "book");
    const lectures = contents.filter(c => c.content_type === "lecture");
    
    const results: Array<{
      id: string;
      content_type: string;
      subject_category: string | null;
      subject: string | null;
    }> = [];
    
    // 책 정보 조회
    if (books.length > 0) {
      const { data: bookDetails, error: bookError } = await supabase
        .from("master_books")
        .select("id, subject_category, subject")
        .in("id", books.map(b => b.content_id));
      
      if (bookError) {
        console.error("Error fetching book details:", bookError);
      } else if (bookDetails) {
        results.push(
          ...bookDetails.map(b => ({
            id: b.id,
            content_type: "book",
            subject_category: b.subject_category,
            subject: b.subject,
          }))
        );
      }
    }
    
    // 강의 정보 조회
    if (lectures.length > 0) {
      const { data: lectureDetails, error: lectureError } = await supabase
        .from("master_lectures")
        .select("id, subject_category, subject")
        .in("id", lectures.map(l => l.content_id));
      
      if (lectureError) {
        console.error("Error fetching lecture details:", lectureError);
      } else if (lectureDetails) {
        results.push(
          ...lectureDetails.map(l => ({
            id: l.id,
            content_type: "lecture",
            subject_category: l.subject_category,
            subject: l.subject,
          }))
        );
      }
    }
    
    return results;
  } catch (error) {
    console.error("Error in fetchContentDetailsForValidation:", error);
    return [];
  }
}

