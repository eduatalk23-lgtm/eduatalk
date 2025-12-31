/**
 * 캠프 학습 데이터 레이어
 * 캠프 템플릿별 학습 기록 조회 및 데이터 제공
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCampTemplate } from "./campTemplates";
import { getCampInvitationsForTemplate } from "./campTemplates";
import type { Plan } from "@/lib/types/plan/domain";
import type { PlanWithStudent, DatePlanDetail } from "@/lib/types/camp/learning";
import { getMasterContentId } from "@/lib/plan/content";

// Supabase JOIN 결과 타입 (students 관계 포함)
type PlanWithStudentJoin = Plan & {
  students: { name: string } | Array<{ name: string }> | null;
};

/**
 * 캠프 기간 학습 기록 조회 (학생 정보 포함)
 * 템플릿에 초대된 모든 학생의 플랜을 조회합니다.
 */
export async function getCampLearningRecords(
  templateId: string,
  startDate: string,
  endDate: string
): Promise<PlanWithStudent[]> {
  const supabase = await createSupabaseServerClient();

  // 템플릿 정보 조회
  const template = await getCampTemplate(templateId);
  if (!template) {
    return [];
  }

  // 캠프 초대 목록 조회 (참여자 확인)
  const invitations = await getCampInvitationsForTemplate(templateId);
  const participantStudentIds = invitations
    .filter((inv) => inv.status === "accepted")
    .map((inv) => inv.student_id);

  if (participantStudentIds.length === 0) {
    return [];
  }

  // 플랜 그룹 조회 (캠프 관련)
  const { data: planGroups, error: planGroupsError } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_template_id", templateId)
    .eq("plan_type", "camp")
    .in("student_id", participantStudentIds)
    .is("deleted_at", null);

  if (planGroupsError || !planGroups || planGroups.length === 0) {
    return [];
  }

  const planGroupIds = planGroups.map((pg) => pg.id);

  // 플랜 조회 (학생 정보 JOIN)
  const { data: plans, error: plansError } = await supabase
    .from("student_plan")
    .select(
      `
      *,
      students:student_id (
        name
      )
    `
    )
    .in("plan_group_id", planGroupIds)
    .gte("plan_date", startDate)
    .lte("plan_date", endDate)
    .order("plan_date", { ascending: true })
    .order("block_index", { ascending: true });

  if (plansError) {
    console.error("[data/campLearning] 플랜 조회 실패", {
      templateId,
      startDate,
      endDate,
      error: plansError.message,
      errorCode: plansError.code,
    });
    return [];
  }

  // 데이터 변환 (JOIN 결과를 평탄화)
  const records: PlanWithStudent[] = ((plans || []) as PlanWithStudentJoin[]).map(
    (plan) => {
      const studentInfo = Array.isArray(plan.students)
        ? plan.students[0]
        : plan.students;

      return {
        ...plan,
        student_name: studentInfo?.name || null,
      } as PlanWithStudent;
    }
  );

  return records;
}

/**
 * 특정 날짜의 플랜 상세 조회
 * @param templateId 캠프 템플릿 ID
 * @param date 날짜 (YYYY-MM-DD)
 * @param studentIds 선택적 학생 ID 필터 (없으면 모든 참여자)
 */
export async function getCampDatePlans(
  templateId: string,
  date: string,
  studentIds?: string[]
): Promise<DatePlanDetail> {
  const supabase = await createSupabaseServerClient();

  // 템플릿 정보 조회
  const template = await getCampTemplate(templateId);
  if (!template) {
    return { date, plans: [] };
  }

  // 캠프 초대 목록 조회 (참여자 확인)
  const invitations = await getCampInvitationsForTemplate(templateId);
  let participantStudentIds = invitations
    .filter((inv) => inv.status === "accepted")
    .map((inv) => inv.student_id);

  // 학생 필터 적용
  if (studentIds && studentIds.length > 0) {
    participantStudentIds = participantStudentIds.filter((id) =>
      studentIds.includes(id)
    );
  }

  if (participantStudentIds.length === 0) {
    return { date, plans: [] };
  }

  // 플랜 그룹 조회
  const { data: planGroups, error: planGroupsError } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_template_id", templateId)
    .eq("plan_type", "camp")
    .in("student_id", participantStudentIds)
    .is("deleted_at", null);

  if (planGroupsError || !planGroups || planGroups.length === 0) {
    return { date, plans: [] };
  }

  const planGroupIds = planGroups.map((pg) => pg.id);
  const studentIdMap = new Map(
    planGroups.map((pg) => [pg.id, pg.student_id])
  );

  // 플랜 조회 (학생 정보 및 콘텐츠 정보 JOIN)
  const { data: plans, error: plansError } = await supabase
    .from("student_plan")
    .select(
      `
      id,
      student_id,
      plan_date,
      block_index,
      content_type,
      content_id,
      planned_start_page_or_time,
      planned_end_page_or_time,
      completed_amount,
      progress,
      students:student_id (
        name
      )
    `
    )
    .in("plan_group_id", planGroupIds)
    .eq("plan_date", date)
    .order("block_index", { ascending: true });

  if (plansError) {
    console.error("[data/campLearning] 날짜별 플랜 조회 실패", {
      templateId,
      date,
      error: plansError.message,
    });
    return { date, plans: [] };
  }

  // 학습 세션 조회 (학습 시간 계산용)
  const planIds = (plans || []).map((p) => p.id);
  let studySessions: Array<{
    plan_id: string;
    duration_seconds: number | null;
  }> = [];

  if (planIds.length > 0) {
    const { data: sessions, error: sessionsError } = await supabase
      .from("student_study_sessions")
      .select("plan_id, duration_seconds")
      .in("plan_id", planIds);

    if (!sessionsError && sessions) {
      studySessions = sessions as Array<{
        plan_id: string;
        duration_seconds: number | null;
      }>;
    }
  }

  // 플랜별 학습 시간 계산
  const planStudyTimeMap = new Map<string, number>();
  studySessions.forEach((session) => {
    if (session.plan_id && session.duration_seconds) {
      const current = planStudyTimeMap.get(session.plan_id) || 0;
      planStudyTimeMap.set(
        session.plan_id,
        current + Math.floor(session.duration_seconds / 60)
      );
    }
  });

  // 콘텐츠 정보 조회 (배치 조회로 N+1 문제 방지)
  // 학생별로 그룹화하여 콘텐츠 상세 정보 조회
  const contentMap = new Map<string, { title: string | null; subject: string | null }>();
  
  const bookIds: string[] = [];
  const lectureIds: string[] = [];
  const customIds: string[] = [];
  const studentBookMap = new Map<string, string[]>(); // studentId -> bookIds
  const studentLectureMap = new Map<string, string[]>(); // studentId -> lectureIds

  (plans || []).forEach((plan) => {
    const studentId = plan.student_id;

    if (plan.content_type === "book" && plan.content_id) {
      bookIds.push(plan.content_id);
      if (!studentBookMap.has(studentId)) {
        studentBookMap.set(studentId, []);
      }
      studentBookMap.get(studentId)!.push(plan.content_id);
    } else if (plan.content_type === "lecture" && plan.content_id) {
      lectureIds.push(plan.content_id);
      if (!studentLectureMap.has(studentId)) {
        studentLectureMap.set(studentId, []);
      }
      studentLectureMap.get(studentId)!.push(plan.content_id);
    } else if (plan.content_type === "custom" && plan.content_id) {
      customIds.push(plan.content_id);
    }
  });

  // ===== 병렬화된 배치 조회 (성능 최적화) =====
  // Phase 1: 초기 콘텐츠 조회 (books, lectures, customs 병렬 실행)
  const [booksResult, lecturesResult, customsResult] = await Promise.all([
    bookIds.length > 0
      ? supabase.from("books").select("id, title, subject, master_content_id").in("id", bookIds)
      : Promise.resolve({ data: null }),
    lectureIds.length > 0
      ? supabase.from("lectures").select("id, title, subject, master_content_id, master_lecture_id").in("id", lectureIds)
      : Promise.resolve({ data: null }),
    customIds.length > 0
      ? supabase.from("student_custom_contents").select("id, title, subject").in("id", customIds)
      : Promise.resolve({ data: null }),
  ]);

  const books = booksResult.data;
  const lectures = lecturesResult.data;
  const customs = customsResult.data;

  // Books 매핑
  books?.forEach((book) => {
    contentMap.set(`book:${book.id}`, {
      title: book.title || null,
      subject: book.subject || null,
    });
  });

  // Lectures 매핑
  const contentIdMap = new Map<string, string>(); // originalContentId -> studentContentId
  lectures?.forEach((lecture) => {
    contentMap.set(`lecture:${lecture.id}`, {
      title: lecture.title || null,
      subject: lecture.subject || null,
    });
    contentIdMap.set(lecture.id, lecture.id);
  });

  // Customs 매핑
  customs?.forEach((custom) => {
    contentMap.set(`custom:${custom.id}`, {
      title: custom.title || null,
      subject: custom.subject || null,
    });
  });

  // Phase 2: 마스터 콘텐츠 fallback 조회 (병렬 실행)
  const booksWithoutTitle = books?.filter((b) => !b.title && b.master_content_id) || [];
  const masterBookIds = booksWithoutTitle.map((b) => b.master_content_id).filter((id): id is string => !!id);

  const foundLectureIds = new Set(lectures?.map((l) => l.id) || []);
  const notFoundLectureIds = lectureIds.filter((id) => !foundLectureIds.has(id));

  const lecturesWithoutTitle = lectures?.filter((l) => !l.title && l.master_content_id) || [];
  const masterLectureIdsForTitle = lecturesWithoutTitle.map((l) => l.master_content_id).filter((id): id is string => !!id);

  // 모든 fallback 쿼리를 병렬 실행
  const [masterBooksResult, masterLecturesResult, masterLecturesForTitleResult] = await Promise.all([
    masterBookIds.length > 0
      ? supabase.from("master_books").select("id, title, subject").in("id", masterBookIds)
      : Promise.resolve({ data: null }),
    notFoundLectureIds.length > 0
      ? supabase.from("master_lectures").select("id, title, subject").in("id", notFoundLectureIds)
      : Promise.resolve({ data: null }),
    masterLectureIdsForTitle.length > 0
      ? supabase.from("master_lectures").select("id, title, subject").in("id", masterLectureIdsForTitle)
      : Promise.resolve({ data: null }),
  ]);

  // Master Books fallback 처리
  masterBooksResult.data?.forEach((masterBook) => {
    booksWithoutTitle.forEach((book) => {
      if (book.master_content_id === masterBook.id) {
        contentMap.set(`book:${book.id}`, {
          title: masterBook.title || null,
          subject: masterBook.subject || null,
        });
      }
    });
  });

  // Master Lectures (not found) fallback 처리
  const masterLectures = masterLecturesResult.data;
  if (masterLectures && masterLectures.length > 0) {
    masterLectures.forEach((masterLecture) => {
      contentMap.set(`lecture:${masterLecture.id}`, {
        title: masterLecture.title || null,
        subject: masterLecture.subject || null,
      });
    });

    // 배치 쿼리: 모든 학생의 강의를 한번에 조회 (N+1 → 1)
    const allStudentIds = Array.from(studentLectureMap.keys());
    if (allStudentIds.length > 0 && notFoundLectureIds.length > 0) {
      const { data: allStudentLecturesByMaster } = await supabase
        .from("lectures")
        .select("id, student_id, master_content_id, master_lecture_id")
        .in("student_id", allStudentIds)
        .or(
          `master_content_id.in.(${notFoundLectureIds.join(",")}),master_lecture_id.in.(${notFoundLectureIds.join(",")})`
        );

      allStudentLecturesByMaster?.forEach((studentLecture) => {
        const masterId = getMasterContentId(studentLecture, "lecture");
        const studentMasterIds = studentLectureMap.get(studentLecture.student_id) || [];
        if (masterId && studentMasterIds.some(id => notFoundLectureIds.includes(id))) {
          contentIdMap.set(masterId, studentLecture.id);
        }
      });
    }
  }

  // Master Lectures (for title) fallback 처리
  masterLecturesForTitleResult.data?.forEach((masterLecture) => {
    lecturesWithoutTitle.forEach((lecture) => {
      if (lecture.master_content_id === masterLecture.id) {
        contentMap.set(`lecture:${lecture.id}`, {
          title: masterLecture.title || null,
          subject: masterLecture.subject || null,
        });
      }
    });
  });

  // 학생별 콘텐츠 상세 정보 조회 (교재 목차, 강의 회차)
  const { getStudentBookDetailsBatch, getStudentLectureEpisodesBatch } = await import("@/lib/data/contentMasters");
  
  const bookDetailsMap = new Map<string, Map<string, Array<{
    id: string;
    page_number: number;
    major_unit: string | null;
    minor_unit: string | null;
  }>>>();
  const lectureEpisodesMap = new Map<string, Map<string, Array<{
    id: string;
    episode_number: number;
    episode_title: string | null;
    duration: number | null;
  }>>>();
  
  // 배치 조회 최적화: 모든 bookId/lectureId를 한번에 조회 (N+1 → 1)

  // 1. 모든 bookId 수집 및 단일 배치 조회
  const allBookIds = [...new Set(Array.from(studentBookMap.values()).flat())];
  let allBookDetails = new Map<string, Array<{
    id: string;
    page_number: number;
    major_unit: string | null;
    minor_unit: string | null;
  }>>();

  if (allBookIds.length > 0) {
    allBookDetails = await getStudentBookDetailsBatch(allBookIds, "");
  }

  // 학생별로 필요한 bookId만 매핑
  for (const [studentId, studentBookIds] of studentBookMap.entries()) {
    const studentDetails = new Map<string, Array<{
      id: string;
      page_number: number;
      major_unit: string | null;
      minor_unit: string | null;
    }>>();
    studentBookIds.forEach(bookId => {
      studentDetails.set(bookId, allBookDetails.get(bookId) || []);
    });
    bookDetailsMap.set(studentId, studentDetails);
  }

  // 2. 모든 lectureId 수집 및 단일 배치 조회
  const allResolvedLectureIds = new Set<string>();
  const studentResolvedMap = new Map<string, string[]>(); // studentId -> resolvedIds

  for (const [studentId, studentLectureIds] of studentLectureMap.entries()) {
    const resolvedIds = studentLectureIds.map(id => contentIdMap.get(id) || id);
    studentResolvedMap.set(studentId, resolvedIds);
    resolvedIds.forEach(id => allResolvedLectureIds.add(id));
  }

  let allLectureEpisodes = new Map<string, Array<{
    id: string;
    episode_number: number;
    episode_title: string | null;
    duration: number | null;
  }>>();

  if (allResolvedLectureIds.size > 0) {
    // 첫 번째 학생 ID를 fallback용으로 사용 (student_lecture_episodes 조회 시)
    const firstStudentId = Array.from(studentLectureMap.keys())[0] || "";
    allLectureEpisodes = await getStudentLectureEpisodesBatch(
      [...allResolvedLectureIds],
      firstStudentId
    );
  }

  // 학생별로 필요한 lectureId만 매핑
  for (const [studentId, studentLectureIds] of studentLectureMap.entries()) {
    const resolvedIds = studentResolvedMap.get(studentId) || [];
    const episodesWithOriginalId = new Map<string, Array<{
      id: string;
      episode_number: number;
      episode_title: string | null;
      duration: number | null;
    }>>();

    studentLectureIds.forEach((originalId, index) => {
      const resolvedId = resolvedIds[index];
      episodesWithOriginalId.set(originalId, allLectureEpisodes.get(resolvedId) || []);
    });

    lectureEpisodesMap.set(studentId, episodesWithOriginalId);
  }
  
  // 계획 범위 포맷팅 헬퍼 함수
  const formatBookRange = (
    bookDetails: Array<{ id: string; page_number: number; major_unit: string | null; minor_unit: string | null }>,
    startPage: number,
    endPage: number
  ): string => {
    if (bookDetails.length === 0) {
      return `${startPage}페이지${startPage !== endPage ? ` ~ ${endPage}페이지` : ""}`;
    }
    
    // page_number <= startPage인 가장 큰 book_detail 찾기
    let startDetail: typeof bookDetails[0] | null = null;
    for (let i = bookDetails.length - 1; i >= 0; i--) {
      if (bookDetails[i].page_number <= startPage) {
        startDetail = bookDetails[i];
        break;
      }
    }
    
    // page_number <= endPage인 가장 큰 book_detail 찾기
    let endDetail: typeof bookDetails[0] | null = null;
    for (let i = bookDetails.length - 1; i >= 0; i--) {
      if (bookDetails[i].page_number <= endPage) {
        endDetail = bookDetails[i];
        break;
      }
    }
    
    // 단일 범위
    if (startDetail && endDetail && startDetail === endDetail) {
      const unit = startDetail.major_unit || startDetail.minor_unit;
      if (unit) {
        return unit;
      }
      return `${startPage}페이지${startPage !== endPage ? ` ~ ${endPage}페이지` : ""}`;
    }
    
    // 범위
    if (startDetail && endDetail) {
      const startUnit = startDetail.major_unit || startDetail.minor_unit;
      const endUnit = endDetail.major_unit || endDetail.minor_unit;
      
      if (startUnit && endUnit) {
        if (startUnit === endUnit) {
          return startUnit;
        }
        return `${startUnit} ~ ${endUnit}`;
      }
      
      return `${startPage}페이지 ~ ${endPage}페이지`;
    }
    
    return `${startPage}페이지${startPage !== endPage ? ` ~ ${endPage}페이지` : ""}`;
  };
  
  const formatLectureRange = (
    episodes: Array<{ id: string; episode_number: number; episode_title: string | null; duration: number | null }>,
    startEpisodeNumber: number,
    endEpisodeNumber: number
  ): string => {
    if (episodes.length === 0) {
      return `${startEpisodeNumber}강${startEpisodeNumber !== endEpisodeNumber ? ` ~ ${endEpisodeNumber}강` : ""}`;
    }
    
    const startEpisode = episodes.find((ep) => ep.episode_number === startEpisodeNumber);
    const endEpisode = startEpisodeNumber === endEpisodeNumber
      ? startEpisode
      : episodes.find((ep) => ep.episode_number === endEpisodeNumber);
    
    if (!startEpisode) {
      return `${startEpisodeNumber}강${startEpisodeNumber !== endEpisodeNumber ? ` ~ ${endEpisodeNumber}강` : ""}`;
    }
    
    // 단일 episode
    if (startEpisodeNumber === endEpisodeNumber || !endEpisode) {
      if (startEpisode.episode_title) {
        return startEpisode.episode_title;
      }
      return `${startEpisode.episode_number}강`;
    }
    
    // 범위 episode
    const startTitle = startEpisode.episode_title
      ? startEpisode.episode_title
      : `${startEpisode.episode_number}강`;
    const endTitle = endEpisode.episode_title
      ? endEpisode.episode_title
      : `${endEpisode.episode_number}강`;
    
    return `${startTitle} ~ ${endTitle}`;
  };

  // 데이터 변환
  const planDetails = ((plans || []) as PlanWithStudentJoin[]).map((plan) => {
    const studentInfo = Array.isArray(plan.students)
      ? plan.students[0]
      : plan.students;

    const contentKey = plan.content_type && plan.content_id
      ? `${plan.content_type}:${plan.content_id}`
      : null;
    const contentInfo = contentKey ? contentMap.get(contentKey) : null;

    // 계획 범위 포맷팅
    let plannedRange = "-";
    const plannedStart = plan.planned_start_page_or_time;
    const plannedEnd = plan.planned_end_page_or_time;
    if (
      plannedStart !== null &&
      plannedStart !== undefined &&
      plannedEnd !== null &&
      plannedEnd !== undefined
    ) {
      if (plan.content_type === "book" && plan.content_id) {
        const studentBookDetails = bookDetailsMap.get(plan.student_id);
        const bookDetails = studentBookDetails?.get(plan.content_id) || [];
        plannedRange = formatBookRange(bookDetails, plannedStart, plannedEnd);
      } else if (plan.content_type === "lecture" && plan.content_id) {
        const studentLectureEpisodes = lectureEpisodesMap.get(plan.student_id);
        const episodes = studentLectureEpisodes?.get(plan.content_id) || [];
        plannedRange = formatLectureRange(episodes, plannedStart, plannedEnd);
      } else if (plan.content_type === "custom") {
        // 커스텀 콘텐츠는 시간 형식으로 표시
        const startMin = Math.floor(plannedStart / 60);
        const startSec = plannedStart % 60;
        const endMin = Math.floor(plannedEnd / 60);
        const endSec = plannedEnd % 60;
        plannedRange = `${String(startMin).padStart(2, "0")}:${String(startSec).padStart(2, "0")}-${String(endMin).padStart(2, "0")}:${String(endSec).padStart(2, "0")}`;
      }
    }

    // 상태 판단
    let status: "completed" | "in_progress" | "not_started" = "not_started";
    const completedAmount = plan.completed_amount ?? 0;
    const progress = plan.progress ?? 0;
    if (completedAmount > 0) {
      if (progress >= 100) {
        status = "completed";
      } else {
        status = "in_progress";
      }
    }

    return {
      student_id: plan.student_id,
      student_name: studentInfo?.name || "이름 없음",
      plan_id: plan.id,
      content_type: plan.content_type as "book" | "lecture" | "custom",
      content_title: contentInfo?.title || null,
      content_subject: contentInfo?.subject || null,
      block_index: plan.block_index ?? 0,
      planned_range: plannedRange,
      completed_amount: completedAmount,
      progress,
      study_minutes: planStudyTimeMap.get(plan.id) || 0,
      status,
    };
  });

  return {
    date,
    plans: planDetails,
  };
}

/**
 * 학생별 학습 플랜 조회
 */
export async function getCampStudentPlans(
  templateId: string,
  studentId: string,
  startDate: string,
  endDate: string
): Promise<Plan[]> {
  const supabase = await createSupabaseServerClient();

  // 템플릿 정보 조회
  const template = await getCampTemplate(templateId);
  if (!template) {
    return [];
  }

  // 플랜 그룹 조회
  const { data: planGroup, error: planGroupError } = await supabase
    .from("plan_groups")
    .select("id")
    .eq("camp_template_id", templateId)
    .eq("plan_type", "camp")
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (planGroupError || !planGroup) {
    return [];
  }

  // 플랜 조회
  const { data: plans, error: plansError } = await supabase
    .from("student_plan")
    .select("*")
    .eq("plan_group_id", planGroup.id)
    .gte("plan_date", startDate)
    .lte("plan_date", endDate)
    .order("plan_date", { ascending: true })
    .order("block_index", { ascending: true });

  if (plansError) {
    console.error("[data/campLearning] 학생별 플랜 조회 실패", {
      templateId,
      studentId,
      startDate,
      endDate,
      error: plansError.message,
    });
    return [];
  }

  return (plans || []) as Plan[];
}

