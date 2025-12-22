"use server";

/**
 * Content Fetch Actions
 *
 * 콘텐츠 메타데이터 및 상세 정보 조회
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchContentMetadata, fetchContentMetadataBatch } from "@/lib/data/contentMetadata";
import { toPlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getSubjectsByGroupName } from "@/lib/data/subjects";

/**
 * 단일 콘텐츠 메타데이터 조회
 */
export async function fetchContentMetadataAction(
  contentId: string,
  contentType: "book" | "lecture"
) {
  try {
    const user = await getCurrentUser();
    const studentId = user?.userId;

    const metadata = await fetchContentMetadata(
      contentId,
      contentType,
      studentId
    );

    return { success: true, data: metadata };
  } catch (error) {
    const planGroupError = toPlanGroupError(
      error,
      PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
    );
    return {
      success: false,
      error: planGroupError.userMessage,
      code: planGroupError.code,
    };
  }
}

/**
 * 여러 콘텐츠 메타데이터 배치 조회
 */
export async function fetchContentMetadataBatchAction(
  contents: Array<{
    content_id: string;
    content_type: "book" | "lecture";
  }>
) {
  try {
    const user = await getCurrentUser();
    const studentId = user?.userId;

    const metadataMap = await fetchContentMetadataBatch(contents, studentId);

    return {
      success: true,
      data: Object.fromEntries(metadataMap),
    };
  } catch (error) {
    const planGroupError = toPlanGroupError(
      error,
      PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
    );
    return {
      success: false,
      error: planGroupError.userMessage,
      code: planGroupError.code,
    };
  }
}

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
