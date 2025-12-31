/**
 * 마스터 콘텐츠 복사 관련 함수
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { getMasterBookById } from "./books";
import { getMasterLectureById } from "./lectures";
import { copyMasterCustomContentToStudent } from "./custom";

/**
 * 마스터 교재를 학생 교재로 복사
 * 주의: Admin 클라이언트를 사용하여 RLS 정책을 우회합니다.
 */
export async function copyMasterBookToStudent(
  bookId: string,
  studentId: string,
  tenantId: string
): Promise<{
  bookId: string;
  detailIdMap?: Map<string, string>; // masterDetailId -> studentDetailId
}> {
  // Admin 클라이언트 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error(
      "Admin 클라이언트를 생성할 수 없습니다. SUPABASE_SERVICE_ROLE_KEY 환경 변수를 확인해주세요."
    );
  }

  const { book } = await getMasterBookById(bookId);
  if (!book) {
    throw new Error("교재를 찾을 수 없습니다.");
  }

  // 중복 체크: 같은 master_content_id를 가진 학생 교재가 이미 있는지 확인
  const { data: existingBook } = await supabase
    .from("books")
    .select("id")
    .eq("student_id", studentId)
    .eq("master_content_id", bookId) // books 테이블은 아직 master_content_id 사용 (교재용)
    .maybeSingle();

  if (existingBook) {
    // 이미 복사된 교재가 있으면 기존 ID와 함께 detail ID 매핑도 조회
    const { details: masterDetails } = await getMasterBookById(bookId);
    let detailIdMap: Map<string, string> | undefined;

    if (masterDetails.length > 0) {
      // display_order -> master detail id 매핑
      const displayOrderToMasterId = new Map(
        masterDetails.map((d) => [d.display_order, d.id])
      );

      // 기존 학생 교재의 details 조회
      const { data: existingDetails } = await supabase
        .from("student_book_details")
        .select("id, display_order")
        .eq("book_id", existingBook.id);

      if (existingDetails && existingDetails.length > 0) {
        detailIdMap = new Map();
        existingDetails.forEach((studentDetail) => {
          const masterDetailId = displayOrderToMasterId.get(
            studentDetail.display_order
          );
          if (masterDetailId) {
            detailIdMap!.set(masterDetailId, studentDetail.id);
          }
        });
      }
    }

    return { bookId: existingBook.id, detailIdMap };
  }

  if (!supabase) throw new Error("Supabase client uninitialized");

  const { data: studentBook, error } = await supabase
    .from("books")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      title: book.title,
      revision: book.revision,
      semester: null, // 마스터 콘텐츠에서 semester 필드 제거됨
      subject_category: book.subject_category,
      subject: book.subject,
      publisher: book.publisher,
      difficulty_level: book.difficulty_level,
      total_pages: book.total_pages,
      notes: book.notes,
      master_content_id: bookId, // books 테이블은 아직 master_content_id 사용 (교재용)
    })
    .select("id")
    .single();

  if (error) {
    logActionError(
      { domain: "data", action: "copyMasterBookToStudent" },
      error,
      { bookId, studentId, tenantId, code: error.code, hint: error.hint }
    );
    throw new Error(
      error.code === "42501"
        ? "RLS 정책 위반: 교재 복사 권한이 없습니다. Admin 클라이언트를 확인해주세요."
        : error.message || "교재 복사에 실패했습니다."
    );
  }

  // book_details도 함께 복사 (ID 매핑 생성)
  const { details } = await getMasterBookById(bookId);
  let detailIdMap: Map<string, string> | undefined;

  if (details.length > 0) {
    // display_order -> master detail id 매핑 (나중에 역매핑용)
    const displayOrderToMasterId = new Map(
      details.map((d) => [d.display_order, d.id])
    );

    const studentBookDetails = details.map((detail) => ({
      book_id: studentBook.id,
      major_unit: detail.major_unit,
      minor_unit: detail.minor_unit,
      page_number: detail.page_number,
      display_order: detail.display_order,
    }));

    if (!supabase) throw new Error("Supabase client uninitialized");

    const { data: insertedDetails, error: detailsError } = await supabase
      .from("student_book_details")
      .insert(studentBookDetails)
      .select("id, display_order");

    if (detailsError) {
      logActionError(
        { domain: "data", action: "copyMasterBookToStudent" },
        detailsError,
        { bookId: studentBook.id, code: detailsError.code, step: "book_details" }
      );
      // 상세 정보 복사 실패해도 교재는 복사됨
    } else if (insertedDetails && insertedDetails.length > 0) {
      // master detail id -> student detail id 매핑 생성
      detailIdMap = new Map();
      insertedDetails.forEach((studentDetail) => {
        const masterDetailId = displayOrderToMasterId.get(
          studentDetail.display_order
        );
        if (masterDetailId) {
          detailIdMap!.set(masterDetailId, studentDetail.id);
        }
      });
    }
  }

  return { bookId: studentBook.id, detailIdMap };
}

/**
 * 마스터 강의를 학생 강의로 복사
 * 주의: Admin 클라이언트를 사용하여 RLS 정책을 우회합니다.
 */
export async function copyMasterLectureToStudent(
  lectureId: string,
  studentId: string,
  tenantId: string
): Promise<{
  lectureId: string;
  episodeIdMap?: Map<string, string>; // masterEpisodeId -> studentEpisodeId
}> {
  // Admin 클라이언트 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error(
      "Admin 클라이언트를 생성할 수 없습니다. SUPABASE_SERVICE_ROLE_KEY 환경 변수를 확인해주세요."
    );
  }

  const { lecture } = await getMasterLectureById(lectureId);
  if (!lecture) {
    throw new Error("강의를 찾을 수 없습니다.");
  }

  if (!supabase) throw new Error("Supabase client uninitialized");

  // 중복 체크: 같은 master_lecture_id를 가진 학생 강의가 이미 있는지 확인
  const { data: existingLecture } = await supabase
    .from("lectures")
    .select("id")
    .eq("student_id", studentId)
    .eq("master_lecture_id", lectureId) // 변경: master_content_id → master_lecture_id
    .maybeSingle();

  if (existingLecture) {
    // 이미 복사된 강의가 있으면 기존 ID와 함께 episode ID 매핑도 조회
    const { episodes: masterEpisodes } = await getMasterLectureById(lectureId);
    let episodeIdMap: Map<string, string> | undefined;

    if (masterEpisodes.length > 0) {
      // episode_number -> master episode id 매핑
      const episodeNumberToMasterId = new Map(
        masterEpisodes.map((ep) => [ep.episode_number, ep.id])
      );

      // 기존 학생 강의의 episodes 조회
      const { data: existingEpisodes } = await supabase
        .from("student_lecture_episodes")
        .select("id, episode_number")
        .eq("lecture_id", existingLecture.id);

      if (existingEpisodes && existingEpisodes.length > 0) {
        episodeIdMap = new Map();
        existingEpisodes.forEach((studentEp) => {
          const masterEpisodeId = episodeNumberToMasterId.get(
            studentEp.episode_number
          );
          if (masterEpisodeId) {
            episodeIdMap!.set(masterEpisodeId, studentEp.id);
          }
        });
      }
    }

    return { lectureId: existingLecture.id, episodeIdMap };
  }

  if (!supabase) throw new Error("Supabase client uninitialized");

  const { data: studentLecture, error } = await supabase
    .from("lectures")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      title: lecture.title,
      revision: lecture.revision,
      semester: null, // 마스터 콘텐츠에서 semester 필드 제거됨
      subject_category: lecture.subject_category,
      subject: lecture.subject,
      platform: lecture.platform_name, // 변경: platform → platform_name
      difficulty_level: lecture.difficulty_level,
      total_episodes: lecture.total_episodes, // 추가: 총 회차
      notes: lecture.notes,
      master_lecture_id: lectureId, // 변경: master_content_id → master_lecture_id
    })
    .select("id")
    .single();

  if (error) {
    logActionError(
      { domain: "data", action: "copyMasterLectureToStudent" },
      error,
      { lectureId, studentId, tenantId, code: error.code, hint: error.hint }
    );
    throw new Error(
      error.code === "42501"
        ? "RLS 정책 위반: 강의 복사 권한이 없습니다. Admin 클라이언트를 확인해주세요."
        : error.message || "강의 복사에 실패했습니다."
    );
  }

  // episodes도 함께 복사 (ID 매핑 생성)
  const { episodes } = await getMasterLectureById(lectureId);
  let episodeIdMap: Map<string, string> | undefined;

  if (episodes.length > 0) {
    // episode_number -> master episode id 매핑 (나중에 역매핑용)
    const episodeNumberToMasterId = new Map(
      episodes.map((ep) => [ep.episode_number, ep.id])
    );

    const studentEpisodes = episodes.map((episode) => ({
      lecture_id: studentLecture.id,
      episode_number: episode.episode_number,
      episode_title: episode.episode_title, // DB 컬럼명과 일치
      duration: episode.duration,
      display_order: episode.display_order,
    }));

    const { data: insertedEpisodes, error: episodesError } = await supabase
      .from("student_lecture_episodes")
      .insert(studentEpisodes)
      .select("id, episode_number");

    if (episodesError) {
      logActionError(
        { domain: "data", action: "copyMasterLectureToStudent" },
        episodesError,
        { lectureId: studentLecture.id, code: episodesError.code, step: "episodes" }
      );
      // episode 복사 실패해도 강의는 복사됨
    } else if (insertedEpisodes && insertedEpisodes.length > 0) {
      // master episode id -> student episode id 매핑 생성
      episodeIdMap = new Map();
      insertedEpisodes.forEach((studentEp) => {
        const masterEpisodeId = episodeNumberToMasterId.get(
          studentEp.episode_number
        );
        if (masterEpisodeId) {
          episodeIdMap!.set(masterEpisodeId, studentEp.id);
        }
      });
    }
  }

  // 마스터 강의에 연결된 교재가 있으면 복사하고 연결
  if (lecture.linked_book_id) {
    try {
      // 마스터 교재를 학생 교재로 복사
      const { bookId: studentBookId } = await copyMasterBookToStudent(
        lecture.linked_book_id,
        studentId,
        tenantId
      );

      // 학생 강의의 linked_book_id 업데이트
      const { error: updateError } = await supabase
        .from("lectures")
        .update({ linked_book_id: studentBookId })
        .eq("id", studentLecture.id);

      if (updateError) {
        logActionError(
          { domain: "data", action: "copyMasterLectureToStudent" },
          updateError,
          {
            lectureId: studentLecture.id,
            bookId: studentBookId,
            step: "link_book",
          }
        );
        // 교재 연결 실패해도 강의는 복사됨
      }
    } catch (error) {
      logActionError(
        { domain: "data", action: "copyMasterLectureToStudent" },
        error,
        {
          masterBookId: lecture.linked_book_id,
          lectureId: studentLecture.id,
          step: "copy_linked_book",
        }
      );
      // 교재 복사 실패해도 강의는 복사됨
    }
  }

  return { lectureId: studentLecture.id, episodeIdMap };
}

/**
 * 마스터 콘텐츠를 학생 콘텐츠로 복사 (하위 호환성)
 * @deprecated copyMasterBookToStudent, copyMasterLectureToStudent, copyMasterCustomContentToStudent 사용 권장
 * @param content_type 콘텐츠 타입 (선택사항, 없으면 자동 감지)
 */
export async function copyMasterToStudentContent(
  masterId: string,
  studentId: string,
  tenantId: string,
  content_type?: "book" | "lecture" | "custom"
): Promise<{ bookId?: string; lectureId?: string; contentId?: string }> {
  // content_type이 명시되어 있으면 해당 타입으로 직접 복사
  if (content_type === "book") {
    const result = await copyMasterBookToStudent(masterId, studentId, tenantId);
    return { bookId: result.bookId };
  } else if (content_type === "lecture") {
    const result = await copyMasterLectureToStudent(
      masterId,
      studentId,
      tenantId
    );
    return { lectureId: result.lectureId };
  } else if (content_type === "custom") {
    const result = await copyMasterCustomContentToStudent(
      masterId,
      studentId,
      tenantId
    );
    return { contentId: result.contentId };
  }

  // content_type이 없으면 자동 감지 (하위 호환성)
  // 먼저 교재에서 찾기
  try {
    const result = await copyMasterBookToStudent(masterId, studentId, tenantId);
    return { bookId: result.bookId };
  } catch {
    // 교재가 아니면 강의로 시도
    try {
      const result = await copyMasterLectureToStudent(
        masterId,
        studentId,
        tenantId
      );
      return { lectureId: result.lectureId };
    } catch {
      // 강의도 아니면 커스텀 콘텐츠로 시도
      const result = await copyMasterCustomContentToStudent(
        masterId,
        studentId,
        tenantId
      );
      return { contentId: result.contentId };
    }
  }
}
