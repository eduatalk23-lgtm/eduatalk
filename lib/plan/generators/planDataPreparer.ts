/**
 * 플랜 생성에 필요한 데이터 준비
 * 플랜 생성 전에 필요한 모든 데이터를 수집하고 준비하는 유틸리티
 */

import type { SupabaseServerClient } from "@/lib/data/core/types";
import type {
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
} from "@/lib/types/plan";
import {
  copyMasterBookToStudent,
  copyMasterLectureToStudent,
} from "@/lib/data/contentMasters";
import {
  DUMMY_NON_LEARNING_CONTENT_ID,
  DUMMY_SELF_STUDY_CONTENT_ID,
} from "@/lib/constants/plan";

/**
 * 블록 정보 타입
 */
export type BlockInfo = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

/**
 * 콘텐츠 메타데이터 타입
 */
export type ContentMetadata = {
  title?: string | null;
  subject?: string | null;
  subject_category?: string | null;
  category?: string | null;
};

/**
 * 콘텐츠 소요시간 정보 타입
 */
export type ContentDurationInfo = {
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  total_pages?: number | null;
  duration?: number | null; // 전체 강의 시간 (fallback용)
  total_page_or_time?: number | null;
  episodes?: Array<{
    episode_number: number;
    duration: number | null; // 회차별 소요시간 (분)
  }> | null; // 강의 episode별 duration 정보
};

/**
 * 플랜 생성에 필요한 데이터
 */
export type PlanGenerationData = {
  group: PlanGroup;
  contents: PlanContent[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  baseBlocks: BlockInfo[];
  contentIdMap: Map<string, string>; // 마스터 콘텐츠 ID -> 학생 콘텐츠 ID
  contentMetadataMap: Map<string, ContentMetadata>;
  contentDurationMap: Map<string, ContentDurationInfo>;
  dateAvailableTimeRanges: Map<string, Array<{ start: string; end: string }>>;
  dateTimeSlots: Map<
    string,
    Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>
  >;
  dateMetadataMap: Map<
    string,
    {
      day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
      week_number: number | null;
    }
  >;
  weekDatesMap: Map<number, string[]>;
  riskIndexMap?: Map<string, { riskScore: number }>;
  contentSubjects: Map<string, { subject?: string | null; subject_category?: string | null }>;
};

/**
 * 블록 정보 조회
 * 
 * @deprecated 이 함수는 제거되었습니다. 대신 `getBlockSetForPlanGroup`를 직접 사용하세요.
 * 
 * @see lib/plan/blocks.ts - getBlockSetForPlanGroup
 */

/**
 * 마스터 콘텐츠를 학생 콘텐츠로 복사하고 ID 매핑 생성
 */
export async function prepareContentIdMap(
  supabase: SupabaseServerClient,
  contents: PlanContent[],
  studentId: string,
  tenantId: string
): Promise<Map<string, string>> {
  const contentIdMap = new Map<string, string>();

  for (const content of contents) {
    let studentContentId = content.content_id;

    // 먼저 이미 학생 콘텐츠로 등록되어 있는지 확인
    if (content.content_type === "book") {
      const { data: existingStudentBook } = await supabase
        .from("books")
        .select("id")
        .eq("student_id", studentId)
        .eq("master_content_id", content.content_id)
        .maybeSingle();

      if (existingStudentBook) {
        studentContentId = existingStudentBook.id;
        contentIdMap.set(content.content_id, studentContentId);
        continue;
      }

      // 마스터 콘텐츠인지 확인
      const { data: masterBook } = await supabase
        .from("master_books")
        .select("id")
        .eq("id", content.content_id)
        .maybeSingle();

      if (masterBook) {
        try {
          const { bookId } = await copyMasterBookToStudent(
            content.content_id,
            studentId,
            tenantId
          );
          studentContentId = bookId;
          contentIdMap.set(content.content_id, studentContentId);
        } catch (error) {
          console.error(
            `[planDataPreparer] 마스터 교재 복사 실패: ${content.content_id}`,
            error
          );
        }
      }
    } else if (content.content_type === "lecture") {
      const { data: existingStudentLecture } = await supabase
        .from("lectures")
        .select("id")
        .eq("student_id", studentId)
        .eq("master_content_id", content.content_id)
        .maybeSingle();

      if (existingStudentLecture) {
        studentContentId = existingStudentLecture.id;
        contentIdMap.set(content.content_id, studentContentId);
        continue;
      }

      // 마스터 콘텐츠인지 확인
      const { data: masterLecture } = await supabase
        .from("master_lectures")
        .select("id")
        .eq("id", content.content_id)
        .maybeSingle();

      if (masterLecture) {
        try {
          const { lectureId } = await copyMasterLectureToStudent(
            content.content_id,
            studentId,
            tenantId
          );
          studentContentId = lectureId;
          contentIdMap.set(content.content_id, studentContentId);
        } catch (error) {
          console.error(
            `[planDataPreparer] 마스터 강의 복사 실패: ${content.content_id}`,
            error
          );
        }
      }
    }
  }

  return contentIdMap;
}

/**
 * 콘텐츠 메타데이터 조회
 */
export async function prepareContentMetadata(
  supabase: SupabaseServerClient,
  contents: PlanContent[],
  contentIdMap: Map<string, string>,
  studentId: string
): Promise<Map<string, ContentMetadata>> {
  const contentMetadataMap = new Map<string, ContentMetadata>();

  for (const content of contents) {
    const finalContentId =
      contentIdMap.get(content.content_id) || content.content_id;

    if (content.content_type === "book") {
      const { data: book } = await supabase
        .from("books")
        .select("title, subject, subject_category, content_category")
        .eq("id", finalContentId)
        .eq("student_id", studentId)
        .maybeSingle();

      if (book) {
        contentMetadataMap.set(content.content_id, {
          title: book.title || null,
          subject: book.subject || null,
          subject_category: book.subject_category || null,
          category: book.content_category || null,
        });
      } else {
        // 마스터 교재 조회
        const { data: masterBook } = await supabase
          .from("master_books")
          .select("title, subject, subject_category, content_category")
          .eq("id", content.content_id)
          .maybeSingle();

        if (masterBook) {
          contentMetadataMap.set(content.content_id, {
            title: masterBook.title || null,
            subject: masterBook.subject || null,
            subject_category: masterBook.subject_category || null,
            category: masterBook.content_category || null,
          });
        }
      }
    } else if (content.content_type === "lecture") {
      const { data: lecture } = await supabase
        .from("lectures")
        .select("title, subject, subject_category, content_category")
        .eq("id", finalContentId)
        .eq("student_id", studentId)
        .maybeSingle();

      if (lecture) {
        contentMetadataMap.set(content.content_id, {
          title: lecture.title || null,
          subject: lecture.subject || null,
          subject_category: lecture.subject_category || null,
          category: lecture.content_category || null,
        });
      } else {
        // 마스터 강의 조회
        const { data: masterLecture } = await supabase
          .from("master_lectures")
          .select("title, subject, subject_category, content_category")
          .eq("id", content.content_id)
          .maybeSingle();

        if (masterLecture) {
          contentMetadataMap.set(content.content_id, {
            title: masterLecture.title || null,
            subject: masterLecture.subject || null,
            subject_category: masterLecture.subject_category || null,
            category: masterLecture.content_category || null,
          });
        }
      }
    } else if (content.content_type === "custom") {
      const { data: customContent } = await supabase
        .from("student_custom_contents")
        .select("title, subject, subject_category, content_category")
        .eq("id", finalContentId)
        .eq("student_id", studentId)
        .maybeSingle();

      if (customContent) {
        contentMetadataMap.set(content.content_id, {
          title: customContent.title || null,
          subject: customContent.subject || null,
          subject_category: customContent.subject_category || null,
          category: customContent.content_category || null,
        });
      }
    }
  }

  return contentMetadataMap;
}

/**
 * 콘텐츠 소요시간 정보 조회
 */
export async function prepareContentDuration(
  supabase: SupabaseServerClient,
  contents: PlanContent[],
  contentIdMap: Map<string, string>,
  studentId: string
): Promise<Map<string, ContentDurationInfo>> {
  const contentDurationMap = new Map<string, ContentDurationInfo>();

  // 더미 UUID에 대한 기본값 추가 (비학습 항목 및 자율학습용)
  // 상수는 lib/constants/plan.ts에서 import
  contentDurationMap.set(DUMMY_NON_LEARNING_CONTENT_ID, {
    content_type: "custom",
    content_id: DUMMY_NON_LEARNING_CONTENT_ID,
    total_page_or_time: 0,
  });

  contentDurationMap.set(DUMMY_SELF_STUDY_CONTENT_ID, {
    content_type: "custom",
    content_id: DUMMY_SELF_STUDY_CONTENT_ID,
    total_page_or_time: 0,
  });

  for (const content of contents) {
    const finalContentId =
      contentIdMap.get(content.content_id) || content.content_id;

    if (content.content_type === "book") {
      // 학생 교재 조회
      let studentBook = await supabase
        .from("books")
        .select("id, total_pages, master_content_id")
        .eq("id", finalContentId)
        .eq("student_id", studentId)
        .maybeSingle();

      // finalContentId로 찾지 못한 경우, 마스터 콘텐츠 ID인지 확인하고 학생 교재 찾기
      if (!studentBook.data) {
        const { data: masterBook } = await supabase
          .from("master_books")
          .select("id")
          .eq("id", finalContentId)
          .maybeSingle();

        if (masterBook) {
          const { data: studentBookByMaster } = await supabase
            .from("books")
            .select("id, total_pages, master_content_id")
            .eq("student_id", studentId)
            .eq("master_content_id", finalContentId)
            .maybeSingle();

          if (studentBookByMaster) {
            studentBook = { data: studentBookByMaster, error: null } as typeof studentBook;
          }
        }
      }

      if (studentBook.data) {
        const bookData = studentBook.data;

        if (bookData.total_pages) {
          contentDurationMap.set(content.content_id, {
            content_type: "book",
            content_id: content.content_id,
            total_pages: bookData.total_pages,
          });
        } else if (bookData.master_content_id) {
          // 마스터 교재 조회
          const { data: masterBook } = await supabase
            .from("master_books")
            .select("id, total_pages")
            .eq("id", bookData.master_content_id)
            .maybeSingle();

          if (masterBook?.total_pages) {
            contentDurationMap.set(content.content_id, {
              content_type: "book",
              content_id: content.content_id,
              total_pages: masterBook.total_pages,
            });
          }
        }
      }
    } else if (content.content_type === "lecture") {
      // 학생 강의 조회
      let studentLecture = await supabase
        .from("lectures")
        .select("id, duration, master_content_id")
        .eq("id", finalContentId)
        .eq("student_id", studentId)
        .maybeSingle();

      // finalContentId로 찾지 못한 경우, 마스터 콘텐츠 ID인지 확인하고 학생 강의 찾기
      if (!studentLecture.data) {
        const { data: masterLecture } = await supabase
          .from("master_lectures")
          .select("id")
          .eq("id", finalContentId)
          .maybeSingle();

        if (masterLecture) {
          const { data: studentLectureByMaster } = await supabase
            .from("lectures")
            .select("id, duration, master_content_id")
            .eq("student_id", studentId)
            .eq("master_content_id", finalContentId)
            .maybeSingle();

          if (studentLectureByMaster) {
            studentLecture = { data: studentLectureByMaster, error: null } as typeof studentLecture;
          }
        }
      }

      if (studentLecture.data) {
        const lectureData = studentLecture.data;

        // Episode 정보 조회 (학생 강의 episode 우선)
        let episodes: Array<{ episode_number: number; duration: number | null }> | null = null;
        try {
          const episodeResult = await supabase
            .from("student_lecture_episodes")
            .select("episode_number, duration")
            .eq("lecture_id", finalContentId)
            .order("episode_number", { ascending: true });
          
          if (episodeResult.data && episodeResult.data.length > 0) {
            episodes = episodeResult.data.map((ep) => ({
              episode_number: ep.episode_number,
              duration: ep.duration ? Math.ceil(ep.duration / 60) : null, // Convert seconds to minutes
            }));
          }
        } catch {
          // Episode 조회 실패 시 무시 (fallback 사용)
        }
        
        // 마스터 강의 episode 조회 (fallback)
        if (!episodes && lectureData.master_content_id) {
          try {
            const masterEpisodeResult = await supabase
              .from("lecture_episodes")
              .select("episode_number, duration")
              .eq("lecture_id", lectureData.master_content_id)
              .order("episode_number", { ascending: true });
            
            if (masterEpisodeResult.data && masterEpisodeResult.data.length > 0) {
              episodes = masterEpisodeResult.data.map((ep) => ({
                episode_number: ep.episode_number,
                duration: ep.duration ? Math.ceil(ep.duration / 60) : null, // Convert seconds to minutes
              }));
            }
          } catch {
            // 마스터 episode 조회 실패 시 무시
          }
        }

        if (lectureData.duration) {
          contentDurationMap.set(content.content_id, {
            content_type: "lecture",
            content_id: content.content_id,
            duration: lectureData.duration ? Math.ceil(lectureData.duration / 60) : null, // Convert seconds to minutes
            episodes: episodes,
          });
        } else if (lectureData.master_content_id) {
          // 마스터 강의 조회
          const { data: masterLecture } = await supabase
            .from("master_lectures")
            .select("id, total_duration")
            .eq("id", lectureData.master_content_id)
            .maybeSingle();

          if (masterLecture?.total_duration) {
            contentDurationMap.set(content.content_id, {
              content_type: "lecture",
              content_id: content.content_id,
              duration: masterLecture.total_duration ? Math.ceil(masterLecture.total_duration / 60) : null, // Convert seconds to minutes
              episodes: episodes,
            });
          } else if (episodes) {
            // Episode 정보만 있는 경우
            contentDurationMap.set(content.content_id, {
              content_type: "lecture",
              content_id: content.content_id,
              episodes: episodes,
            });
          }
        } else if (episodes) {
          // Episode 정보만 있는 경우
          contentDurationMap.set(content.content_id, {
            content_type: "lecture",
            content_id: content.content_id,
            episodes: episodes,
          });
        }
      }
    } else if (content.content_type === "custom") {
      // 커스텀 콘텐츠 조회
      const { data: customContent } = await supabase
        .from("student_custom_contents")
        .select("id, total_page_or_time")
        .eq("id", finalContentId)
        .eq("student_id", studentId)
        .maybeSingle();

      if (customContent?.total_page_or_time !== undefined) {
        contentDurationMap.set(content.content_id, {
          content_type: "custom",
          content_id: content.content_id,
          total_page_or_time: customContent.total_page_or_time,
        });
      }
    }
  }

  return contentDurationMap;
}

/**
 * 스케줄 결과에서 날짜별 정보 추출
 */
export function extractScheduleData(
  scheduleResult: {
    daily_schedule: Array<{
      date: string;
      day_type?: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
      week_number?: number | null;
      available_time_ranges: Array<{ start: string; end: string }>;
      time_slots?: Array<{
        type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
        start: string;
        end: string;
        label?: string;
      }>;
    }>;
  }
): {
  dateAvailableTimeRanges: Map<string, Array<{ start: string; end: string }>>;
  dateTimeSlots: Map<
    string,
    Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>
  >;
  dateMetadataMap: Map<
    string,
    {
      day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
      week_number: number | null;
    }
  >;
  weekDatesMap: Map<number, string[]>;
} {
  const dateAvailableTimeRanges = new Map<
    string,
    Array<{ start: string; end: string }>
  >();
  const dateTimeSlots = new Map<
    string,
    Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>
  >();
  const dateMetadataMap = new Map<
    string,
    {
      day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
      week_number: number | null;
    }
  >();
  const weekDatesMap = new Map<number, string[]>();

  scheduleResult.daily_schedule.forEach((daily) => {
    if (daily.day_type === "학습일" && daily.available_time_ranges.length > 0) {
      dateAvailableTimeRanges.set(
        daily.date,
        daily.available_time_ranges.map((range) => ({
          start: range.start,
          end: range.end,
        }))
      );
    }

    // time_slots 정보도 저장
    if (daily.time_slots && daily.time_slots.length > 0) {
      dateTimeSlots.set(
        daily.date,
        daily.time_slots.map((slot) => ({
          type: slot.type,
          start: slot.start,
          end: slot.end,
          label: slot.label,
        }))
      );
    }

    // 날짜별 메타데이터 저장
    dateMetadataMap.set(daily.date, {
      day_type: daily.day_type || null,
      week_number: daily.week_number || null,
    });

    // 주차별 날짜 목록 구성
    if (daily.week_number) {
      if (!weekDatesMap.has(daily.week_number)) {
        weekDatesMap.set(daily.week_number, []);
      }
      // 제외일이 아닌 날짜만 주차에 포함
      if (
        daily.day_type &&
        daily.day_type !== "휴가" &&
        daily.day_type !== "개인일정" &&
        daily.day_type !== "지정휴일"
      ) {
        weekDatesMap.get(daily.week_number)!.push(daily.date);
      }
    }
  });

  // 주차별 날짜 목록 정렬 (날짜 순)
  weekDatesMap.forEach((dates) => {
    dates.sort();
  });

  return {
    dateAvailableTimeRanges,
    dateTimeSlots,
    dateMetadataMap,
    weekDatesMap,
  };
}

