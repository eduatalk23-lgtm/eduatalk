"use server";

/**
 * Student Content Master IDs Action
 *
 * 학생 콘텐츠의 master_content_id 조회 (중복 방지용)
 * Admin/Consultant도 다른 학생의 콘텐츠를 조회할 수 있도록 지원
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  logActionError,
  logActionWarn,
} from "@/lib/logging/actionLogger";

export async function getStudentContentMasterIdsAction(
  contents: Array<{
    content_id: string;
    content_type: "book" | "lecture";
  }>,
  studentIdParam?: string // Admin/Consultant가 다른 학생의 콘텐츠를 조회할 때 사용
): Promise<{
  success: boolean;
  data?: Map<string, string | null>; // content_id -> master_content_id
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    const { role } = await getCurrentUserRole();
    const isAdminOrConsultant = role === "admin" || role === "consultant";

    // 학생 ID 결정: 관리자/컨설턴트인 경우 studentIdParam 사용, 학생인 경우 자신의 ID 사용
    let targetStudentId: string;
    if (isAdminOrConsultant) {
      if (!studentIdParam) {
        return {
          success: false,
          error: "관리자/컨설턴트의 경우 student_id가 필요합니다.",
        };
      }
      targetStudentId = studentIdParam;
    } else {
      targetStudentId = user.userId;
    }

    // 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때는 Admin 클라이언트 사용 (RLS 우회)
    let supabase;
    if (isAdminOrConsultant && studentIdParam) {
      const adminClient = createSupabaseAdminClient();
      if (!adminClient) {
        logActionWarn(
          { domain: "content", action: "getStudentContentMasterIdsAction" },
          "Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용"
        );
        supabase = await createSupabaseServerClient();
      } else {
        supabase = adminClient;
      }
    } else {
      supabase = await createSupabaseServerClient();
    }

    const studentId = targetStudentId;

    const masterIdMap = new Map<string, string | null>();

    // book과 lecture를 분리
    const books = contents.filter((c) => c.content_type === "book");
    const lectures = contents.filter((c) => c.content_type === "lecture");

    // 교재의 master_content_id 조회
    if (books.length > 0) {
      const bookIds = books.map((b) => b.content_id);
      const { data: studentBooks, error: booksError } = await supabase
        .from("books")
        .select("id, master_content_id")
        .in("id", bookIds)
        .eq("student_id", studentId);

      if (booksError) {
        logActionError(
          { domain: "content", action: "getStudentContentMasterIdsAction" },
          booksError,
          { studentId, bookIds }
        );
      } else {
        (studentBooks || []).forEach((book) => {
          masterIdMap.set(book.id, book.master_content_id || null);
        });
      }
    }

    // 강의의 master_content_id 조회
    if (lectures.length > 0) {
      const lectureIds = lectures.map((l) => l.content_id);
      const { data: studentLectures, error: lecturesError } = await supabase
        .from("lectures")
        .select("id, master_content_id")
        .in("id", lectureIds)
        .eq("student_id", studentId);

      if (lecturesError) {
        logActionError(
          { domain: "content", action: "getStudentContentMasterIdsAction" },
          lecturesError,
          { studentId, lectureIds }
        );
      } else {
        (studentLectures || []).forEach((lecture) => {
          masterIdMap.set(lecture.id, lecture.master_content_id || null);
        });
      }
    }

    // 조회되지 않은 콘텐츠는 null로 설정
    contents.forEach((content) => {
      if (!masterIdMap.has(content.content_id)) {
        masterIdMap.set(content.content_id, null);
      }
    });

    return {
      success: true,
      data: masterIdMap,
    };
  } catch (error) {
    logActionError(
      { domain: "content", action: "getStudentContentMasterIdsAction" },
      error
    );
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "master_content_id 조회 실패",
    };
  }
}
