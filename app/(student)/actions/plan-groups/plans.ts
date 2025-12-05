"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { PlanStatus } from "@/lib/types/plan";
import {
  copyMasterBookToStudent,
  copyMasterLectureToStudent,
} from "@/lib/data/contentMasters";
import { assignPlanTimes } from "@/lib/plan/assignPlanTimes";
import { updatePlanGroupStatus } from "./status";
import { timeToMinutes } from "./utils";
import {
  getPlanGroupWithDetailsByRole,
  getStudentIdForPlanGroup,
  getSupabaseClientForStudent,
  shouldBypassStatusCheck,
  verifyPlanGroupAccess,
} from "@/lib/auth/planGroupAuth";
import { ensureAdminClient } from "@/lib/supabase/clientSelector";
import {
  getBlockSetForPlanGroup,
  getBlockSetErrorMessage,
} from "@/lib/plan/blocks";

async function _generatePlansFromGroup(
  groupId: string
): Promise<{ count: number }> {
  const access = await verifyPlanGroupAccess();
  const tenantContext = await requireTenantContext();

  const supabase = await createSupabaseServerClient();

  // 1. 플랜 그룹 및 관련 데이터 조회
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetailsByRole(
      groupId,
      access.user.userId,
      access.role,
      tenantContext.tenantId
    );

  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  const studentId = getStudentIdForPlanGroup(
    group,
    access.user.userId,
    access.role
  );

  const bypassStatusCheck = shouldBypassStatusCheck(
    access.role,
    group.plan_type ?? null
  );

  if (!bypassStatusCheck) {
    // 일반 학생 모드에서만 상태 체크
    if (group.status !== "saved" && group.status !== "active") {
      throw new AppError(
        "플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 생성할 수 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
  }

  // 3. Step 2.5에서 계산된 스케줄 결과 사용 (블록 세트 대신)
  // calculateAvailableDates를 호출하여 각 날짜별 available_time_ranges를 블록으로 사용
  const { calculateAvailableDates } = await import(
    "@/lib/scheduler/calculateAvailableDates"
  );

  // 블록 세트에서 기본 블록 정보 가져오기 (calculateAvailableDates에 전달하기 위해)
  const baseBlocks = await getBlockSetForPlanGroup(
    group,
    studentId,
    access.user.userId,
    access.role,
    tenantContext.tenantId
  );

  if (baseBlocks.length === 0) {
    const errorMessage = getBlockSetErrorMessage(group, false);
    throw new AppError(errorMessage, ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 병합된 스케줄러 설정 사용 (전역 → 템플릿 → 플랜그룹)
  const { getMergedSchedulerSettings } = await import(
    "@/lib/data/schedulerSettings"
  );
  const mergedSettings = await getMergedSchedulerSettings(
    group.tenant_id,
    group.camp_template_id,
    group.scheduler_options as Record<string, unknown>
  );

  // 기존 scheduler_options 형식으로 변환 (하위 호환성)
  const schedulerOptions = {
    study_days: mergedSettings.study_review_ratio.study_days,
    review_days: mergedSettings.study_review_ratio.review_days,
    weak_subject_focus: mergedSettings.weak_subject_focus,
    review_scope: mergedSettings.review_scope,
    lunch_time: mergedSettings.lunch_time,
    camp_study_hours: mergedSettings.study_hours,
    self_study_hours: mergedSettings.self_study_hours,
  };

  // calculateAvailableDates 호출하여 Step 2.5 스케줄 결과 가져오기
  const scheduleResult = calculateAvailableDates(
    group.period_start,
    group.period_end,
    baseBlocks.map((b) => ({
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
    })),
    exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as
        | "휴가"
        | "개인사정"
        | "휴일지정"
        | "기타",
      reason: e.reason || undefined,
    })),
    academySchedules.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name || undefined,
      subject: a.subject || undefined,
      travel_time: a.travel_time || undefined,
    })),
    {
      scheduler_type: "1730_timetable",
      scheduler_options: schedulerOptions || null,
      use_self_study_with_blocks: true, // 블록이 있어도 자율학습 시간 포함
      enable_self_study_for_holidays:
        (group.scheduler_options as any)?.enable_self_study_for_holidays === true,
      enable_self_study_for_study_days:
        (group.scheduler_options as any)?.enable_self_study_for_study_days === true,
      lunch_time: schedulerOptions.lunch_time,
      camp_study_hours: schedulerOptions.camp_study_hours,
      camp_self_study_hours: schedulerOptions.camp_self_study_hours,
      designated_holiday_hours: (group.scheduler_options as any)?.designated_holiday_hours,
      non_study_time_blocks: (group as any).non_study_time_blocks || undefined,
    }
  );

  // Step 2.5 스케줄 결과에서 날짜별 사용 가능 시간 범위 및 타임라인 추출
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

  // 날짜별 메타데이터 매핑 (day_type, week_number)
  const dateMetadataMap = new Map<
    string,
    {
      day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
      week_number: number | null;
    }
  >();

  // 주차별 날짜 목록 (일차 계산용)
  const weekDatesMap = new Map<number, string[]>();

  scheduleResult.daily_schedule.forEach((daily) => {
    // 학습일과 복습일 모두 포함 (1730_timetable의 경우 복습일에도 플랜 생성 필요)
    if (
      (daily.day_type === "학습일" || daily.day_type === "복습일") &&
      daily.available_time_ranges.length > 0
    ) {
      dateAvailableTimeRanges.set(
        daily.date,
        daily.available_time_ranges.map((range) => ({
          start: range.start,
          end: range.end,
        }))
      );
    }

    // time_slots 정보도 저장 (Step 7에서 타임라인 표시용)
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

    // 주차별 날짜 목록 구성 (일차 계산용)
    if (daily.week_number) {
      if (!weekDatesMap.has(daily.week_number)) {
        weekDatesMap.set(daily.week_number, []);
      }
      // 제외일이 아닌 날짜만 주차에 포함 (1730 Timetable의 경우)
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
  weekDatesMap.forEach((dates, week) => {
    dates.sort();
  });

  if (dateAvailableTimeRanges.size === 0) {
    throw new AppError(
      "학습 가능한 날짜가 없습니다. 기간, 제외일, 학원일정을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 기존 방식 호환성을 위한 빈 블록 배열 (실제로는 사용하지 않음, dateAvailableTimeRanges 사용)
  const blockInfos: Array<{
    id: string;
    day_of_week: number;
    block_index: number;
    start_time: string;
    end_time: string;
    duration_minutes: number;
  }> = [];

  // 5. 마스터 콘텐츠를 학생 콘텐츠로 복사 (플랜 생성 시점에만 수행)
  // content_id 매핑: 마스터 콘텐츠 ID -> 학생 콘텐츠 ID
  const contentIdMap = new Map<string, string>();

  for (const content of contents) {
    let studentContentId = content.content_id;

    // 먼저 이미 학생 콘텐츠로 등록되어 있는지 확인
    if (content.content_type === "book") {
      // 이미 학생 교재로 등록되어 있는지 확인 (master_content_id로)
      const { data: existingStudentBook } = await supabase
        .from("books")
        .select("id")
        .eq("student_id", studentId)
        .eq("master_content_id", content.content_id)
        .maybeSingle();

      if (existingStudentBook) {
        // 이미 복사된 교재가 있으면 기존 ID 사용
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
        // 마스터 교재를 학생 교재로 복사
        try {
          const { bookId } = await copyMasterBookToStudent(
            content.content_id,
            studentId,
            tenantContext.tenantId
          );
          studentContentId = bookId;
          contentIdMap.set(content.content_id, studentContentId);
        } catch (error) {
          console.error(
            `[planGroupActions] 마스터 교재 복사 실패: ${content.content_id}`,
            error
          );
          // 복사 실패 시 원본 ID 사용
        }
      }
    } else if (content.content_type === "lecture") {
      // 이미 학생 강의로 등록되어 있는지 확인 (master_content_id로)
      const { data: existingStudentLecture } = await supabase
        .from("lectures")
        .select("id")
        .eq("student_id", studentId)
        .eq("master_content_id", content.content_id)
        .maybeSingle();

      if (existingStudentLecture) {
        // 이미 복사된 강의가 있으면 기존 ID 사용
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
        // 마스터 강의를 학생 강의로 복사
        try {
          const { lectureId } = await copyMasterLectureToStudent(
            content.content_id,
            studentId,
            tenantContext.tenantId
          );
          studentContentId = lectureId;
          contentIdMap.set(content.content_id, studentContentId);
        } catch (error) {
          console.error(
            `[planGroupActions] 마스터 강의 복사 실패: ${content.content_id}`,
            error
          );
          // 복사 실패 시 원본 ID 사용
        }
      }
    }
  }

  // 6. 교과 제약 조건 검증 (플랜 생성 전)
  const subjectConstraints = (group as any).subject_constraints as
    | {
        required_subjects?: string[];
        excluded_subjects?: string[];
        constraint_handling?: "strict" | "warning" | "auto_fix";
      }
    | null
    | undefined;

  if (subjectConstraints) {
    // 콘텐츠의 교과 정보를 먼저 조회해야 함 (아래에서 조회하므로 여기서는 검증만)
    // 실제 검증은 콘텐츠 메타데이터 조회 후에 수행
  }

  // 7. 콘텐츠 메타데이터 정보 조회 (전략과목/취약과목 로직용 + denormalization용)
  const contentMetadataMap = new Map<
    string,
    {
      title?: string | null;
      subject?: string | null;
      subject_category?: string | null;
      category?: string | null;
    }
  >();

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
      // 커스텀 콘텐츠 조회
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

  // 하위 호환성을 위한 contentSubjects Map (기존 코드에서 사용 중)
  const contentSubjects = new Map<
    string,
    { subject?: string | null; subject_category?: string | null }
  >();
  contentMetadataMap.forEach((metadata, contentId) => {
    contentSubjects.set(contentId, {
      subject: metadata.subject,
      subject_category: metadata.subject_category,
    });
  });

  // 6-1. 교과 제약 조건 검증 (콘텐츠 메타데이터 조회 후)
  if (subjectConstraints) {
    const selectedSubjectCategories = new Set<string>();
    contentMetadataMap.forEach((metadata) => {
      if (metadata.subject_category) {
        selectedSubjectCategories.add(metadata.subject_category);
      }
    });

    const constraintHandling =
      subjectConstraints.constraint_handling || "strict";
    const errors: string[] = [];
    const warnings: string[] = [];

    // 필수 교과 검증
    if (
      subjectConstraints.required_subjects &&
      subjectConstraints.required_subjects.length > 0
    ) {
      const missingSubjects = subjectConstraints.required_subjects.filter(
        (subject) => !selectedSubjectCategories.has(subject)
      );
      if (missingSubjects.length > 0) {
        const message = `다음 필수 교과가 플랜에 포함되지 않았습니다: ${missingSubjects.join(
          ", "
        )}`;
        if (constraintHandling === "strict") {
          errors.push(message);
        } else if (constraintHandling === "warning") {
          warnings.push(message);
        }
        // auto_fix는 나중에 자동으로 추가하는 로직 구현 필요
      }
    }

    // 제외 교과 검증
    if (
      subjectConstraints.excluded_subjects &&
      subjectConstraints.excluded_subjects.length > 0
    ) {
      const includedExcludedSubjects =
        subjectConstraints.excluded_subjects.filter((subject) =>
          selectedSubjectCategories.has(subject)
        );
      if (includedExcludedSubjects.length > 0) {
        const message = `다음 제외 교과가 플랜에 포함되어 있습니다: ${includedExcludedSubjects.join(
          ", "
        )}`;
        if (constraintHandling === "strict") {
          errors.push(message);
        } else if (constraintHandling === "warning") {
          warnings.push(message);
        }
        // auto_fix는 나중에 자동으로 제거하는 로직 구현 필요
      }
    }

    // 에러가 있으면 플랜 생성 중단
    if (errors.length > 0) {
      throw new AppError(
        `교과 제약 조건 검증 실패: ${errors.join("; ")}`,
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 경고가 있으면 로그만 출력
    if (warnings.length > 0) {
      console.warn(
        "[planGroupActions] 교과 제약 조건 경고:",
        warnings.join("; ")
      );
    }
  }

  // 8. Risk Index 조회 (취약과목 로직용)
  let riskIndexMap: Map<string, { riskScore: number }> | undefined;
  // schedulerOptions는 위에서 이미 선언되었으므로 재사용
  const weakSubjectFocus =
    schedulerOptions?.weak_subject_focus === "high" ||
    schedulerOptions?.weak_subject_focus === true;

  if (weakSubjectFocus) {
    try {
      const { getRiskIndexBySubject } = await import(
        "@/lib/scheduler/scoreLoader"
      );
      const riskMap = await getRiskIndexBySubject(studentId);

      // Map<string, RiskIndex> -> Map<string, { riskScore: number }> 변환
      riskIndexMap = new Map();
      riskMap.forEach((riskIndex, subject) => {
        riskIndexMap!.set(subject.toLowerCase().trim(), {
          riskScore: riskIndex.riskScore || 0,
        });
      });
    } catch (error) {
      console.error("[planGroupActions] Risk Index 조회 실패", error);
      // Risk Index 조회 실패해도 계속 진행
    }
  }

  // 8. 콘텐츠 소요시간 정보 조회
  const contentDurationMap = new Map<
    string,
    {
      content_type: "book" | "lecture" | "custom";
      content_id: string;
      total_pages?: number | null;
      duration?: number | null;
      total_page_or_time?: number | null;
    }
  >();

  // 더미 UUID에 대한 기본값 추가 (비학습 항목 및 자율학습용)
  const DUMMY_NON_LEARNING_CONTENT_ID = "00000000-0000-0000-0000-000000000000";
  const DUMMY_SELF_STUDY_CONTENT_ID = "00000000-0000-0000-0000-000000000001";

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

  const studentContentClient = await getSupabaseClientForStudent(
    studentId,
    access.user.userId,
    access.role
  );

  for (const content of contents) {
    const finalContentId =
      contentIdMap.get(content.content_id) || content.content_id;

    if (content.content_type === "book") {
      // 학생 교재 조회 (관리자 모드에서는 플랜 그룹의 student_id 사용)
      // Admin/Consultant가 다른 학생의 교재를 조회할 때는 Admin 클라이언트 사용
      let studentBook = await studentContentClient
        .from("books")
        .select("id, total_pages, master_content_id")
        .eq("id", finalContentId)
        .eq("student_id", studentId)
        .maybeSingle();

      // finalContentId로 찾지 못한 경우, 마스터 콘텐츠 ID인지 확인하고 학생 교재 찾기
      if (!studentBook.data) {
        // 마스터 교재인지 확인
        const { data: masterBook } = await supabase
          .from("master_books")
          .select("id")
          .eq("id", finalContentId)
          .maybeSingle();

        if (masterBook) {
          // 마스터 교재인 경우, 해당 학생의 교재를 master_content_id로 찾기
          const { data: studentBookByMaster } = await studentContentClient
            .from("books")
            .select("id, total_pages, master_content_id")
            .eq("student_id", studentId)
            .eq("master_content_id", finalContentId)
            .maybeSingle();

          if (studentBookByMaster) {
            studentBook = { data: studentBookByMaster, error: null };
          } else {
            // 마스터 교재를 학생 교재로 복사 (캠프 모드에서 자동 복사)
            try {
              const { copyMasterBookToStudent } = await import(
                "@/lib/data/contentMasters"
              );
              const { bookId } = await copyMasterBookToStudent(
                finalContentId,
                studentId,
                tenantContext.tenantId
              );

              // 복사된 교재 조회 (Admin 클라이언트 사용)
              const { data: copiedBook } = await studentContentClient
                .from("books")
                .select("id, total_pages, master_content_id")
                .eq("id", bookId)
                .eq("student_id", studentId)
                .maybeSingle();

              if (copiedBook) {
                studentBook = { data: copiedBook, error: null };
                console.log(
                  `[planGroupActions] 마스터 교재(${finalContentId})를 학생 교재(${bookId})로 복사했습니다.`
                );
              }
            } catch (copyError) {
              console.error(
                `[planGroupActions] 마스터 교재 복사 실패: ${finalContentId}`,
                copyError
              );
              // 복사 실패 시 에러 발생
            }
          }
        }
      }

      if (!studentBook.data) {
        // 책이 존재하지 않는 경우 에러 발생
        // 마스터 콘텐츠 ID인지 확인하여 더 명확한 에러 메시지 제공
        const { data: masterBookCheck } = await supabase
          .from("master_books")
          .select("id")
          .eq("id", finalContentId)
          .maybeSingle();

        if (masterBookCheck) {
          throw new AppError(
            `Referenced master book (${finalContentId}) does not exist for student (${studentId}). Please ensure the student has this book in their content library.`,
            ErrorCode.VALIDATION_ERROR,
            400,
            true
          );
        } else {
          throw new AppError(
            `Referenced book (${finalContentId}) does not exist for student (${studentId})`,
            ErrorCode.VALIDATION_ERROR,
            400,
            true
          );
        }
      }

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
        } else {
          // 마스터 책이 존재하지 않는 경우 에러 발생
          throw new AppError(
            `Referenced master book (${bookData.master_content_id}) for book (${bookData.id}) does not exist`,
            ErrorCode.VALIDATION_ERROR,
            400,
            true
          );
        }
      } else {
        // 책이 존재하지만 total_pages와 master_content_id가 모두 없는 경우 에러 발생
        throw new AppError(
          `Referenced book (${bookData.id}) does not have valid page information`,
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
    } else if (content.content_type === "lecture") {
      // 학생 강의 조회 (관리자 모드에서는 플랜 그룹의 student_id 사용)
      // Admin/Consultant가 다른 학생의 강의를 조회할 때는 Admin 클라이언트 사용
      let studentLecture = await studentContentClient
        .from("lectures")
        .select("id, duration, master_content_id")
        .eq("id", finalContentId)
        .eq("student_id", studentId)
        .maybeSingle();

      // finalContentId로 찾지 못한 경우, 마스터 콘텐츠 ID인지 확인하고 학생 강의 찾기
      if (!studentLecture.data) {
        // 마스터 강의인지 확인
        const { data: masterLecture } = await supabase
          .from("master_lectures")
          .select("id")
          .eq("id", finalContentId)
          .maybeSingle();

        if (masterLecture) {
          // 마스터 강의인 경우, 해당 학생의 강의를 master_content_id로 찾기
          const { data: studentLectureByMaster } = await studentContentClient
            .from("lectures")
            .select("id, duration, master_content_id")
            .eq("student_id", studentId)
            .eq("master_content_id", finalContentId)
            .maybeSingle();

          if (studentLectureByMaster) {
            studentLecture = { data: studentLectureByMaster, error: null };
          } else {
            // 마스터 강의를 학생 강의로 복사 (캠프 모드에서 자동 복사)
            try {
              const { copyMasterLectureToStudent } = await import(
                "@/lib/data/contentMasters"
              );
              const { lectureId } = await copyMasterLectureToStudent(
                finalContentId,
                studentId,
                tenantContext.tenantId
              );

              // 복사된 강의 조회 (Admin 클라이언트 사용)
              const { data: copiedLecture } = await studentContentClient
                .from("lectures")
                .select("id, duration, master_content_id")
                .eq("id", lectureId)
                .eq("student_id", studentId)
                .maybeSingle();

              if (copiedLecture) {
                studentLecture = { data: copiedLecture, error: null };
                console.log(
                  `[planGroupActions] 마스터 강의(${finalContentId})를 학생 강의(${lectureId})로 복사했습니다.`
                );
              }
            } catch (copyError) {
              console.error(
                `[planGroupActions] 마스터 강의 복사 실패: ${finalContentId}`,
                copyError
              );
              // 복사 실패 시 에러 발생
            }
          }
        }
      }

      if (!studentLecture.data) {
        // 강의가 존재하지 않는 경우 에러 발생
        // 마스터 콘텐츠 ID인지 확인하여 더 명확한 에러 메시지 제공
        const { data: masterLectureCheck } = await supabase
          .from("master_lectures")
          .select("id")
          .eq("id", finalContentId)
          .maybeSingle();

        if (masterLectureCheck) {
          throw new AppError(
            `Referenced master lecture (${finalContentId}) does not exist for student (${studentId}). Please ensure the student has this lecture in their content library.`,
            ErrorCode.VALIDATION_ERROR,
            400,
            true
          );
        } else {
          throw new AppError(
            `Referenced lecture (${finalContentId}) does not exist for student (${studentId})`,
            ErrorCode.VALIDATION_ERROR,
            400,
            true
          );
        }
      }

      const lectureData = studentLecture.data;

      if (lectureData.duration) {
        contentDurationMap.set(content.content_id, {
          content_type: "lecture",
          content_id: content.content_id,
          duration: lectureData.duration,
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
            duration: masterLecture.total_duration,
          });
        } else {
          // 마스터 강의가 존재하지 않는 경우 에러 발생
          throw new AppError(
            `Referenced master lecture (${lectureData.master_content_id}) for lecture (${lectureData.id}) does not exist`,
            ErrorCode.VALIDATION_ERROR,
            400,
            true
          );
        }
      } else {
        // 강의가 존재하지만 duration과 master_content_id가 모두 없는 경우 에러 발생
        throw new AppError(
          `Referenced lecture (${finalContentId}) does not have valid duration information`,
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
    } else if (content.content_type === "custom") {
      // 더미 UUID는 이미 처리했으므로 스킵
      if (
        finalContentId === DUMMY_NON_LEARNING_CONTENT_ID ||
        finalContentId === DUMMY_SELF_STUDY_CONTENT_ID ||
        content.content_id === DUMMY_NON_LEARNING_CONTENT_ID ||
        content.content_id === DUMMY_SELF_STUDY_CONTENT_ID
      ) {
        continue;
      }

      // 커스텀 콘텐츠 조회 (관리자 모드에서는 플랜 그룹의 student_id 사용)
      const { data: customContent } = await supabase
        .from("student_custom_contents")
        .select("id, total_page_or_time")
        .eq("id", finalContentId)
        .eq("student_id", studentId)
        .maybeSingle();

      if (customContent?.total_page_or_time) {
        contentDurationMap.set(content.content_id, {
          content_type: "custom",
          content_id: content.content_id,
          total_page_or_time: customContent.total_page_or_time,
        });
      } else if (!customContent) {
        // 더미 UUID인 경우는 에러 발생하지 않음 (더미 content 생성 실패해도 계속 진행)
        // 일반 custom content가 존재하지 않으면 에러 발생
        if (
          finalContentId !== DUMMY_NON_LEARNING_CONTENT_ID &&
          finalContentId !== DUMMY_SELF_STUDY_CONTENT_ID &&
          content.content_id !== DUMMY_NON_LEARNING_CONTENT_ID &&
          content.content_id !== DUMMY_SELF_STUDY_CONTENT_ID
        ) {
          throw new AppError(
            `Referenced custom content (${finalContentId}) does not exist`,
            ErrorCode.VALIDATION_ERROR,
            400,
            true
          );
        }
        // 더미 UUID인 경우는 contentDurationMap에 이미 기본값이 있으므로 스킵
      }
    }
  }

  // 9. 스케줄러로 플랜 생성 (Step 2.5 스케줄 결과 및 콘텐츠 소요시간 정보 전달)
  const { generatePlansFromGroup } = await import("@/lib/plan/scheduler");

  // 디버깅을 위한 로그 추가
  console.log("[planGroupActions] 플랜 생성 시작:", {
    groupId,
    contentsCount: contents.length,
    dateAvailableTimeRangesCount: dateAvailableTimeRanges.size,
    dateTimeSlotsCount: dateTimeSlots.size,
    contentDurationMapCount: contentDurationMap.size,
    schedulerType: group.scheduler_type,
    periodStart: group.period_start,
    periodEnd: group.period_end,
    exclusionsCount: exclusions.length,
    academySchedulesCount: academySchedules.length,
  });

  const scheduledPlans = generatePlansFromGroup(
    group,
    contents,
    exclusions,
    academySchedules,
    blockInfos,
    contentSubjects,
    riskIndexMap,
    dateAvailableTimeRanges,
    dateTimeSlots,
    contentDurationMap
  );

  console.log("[planGroupActions] 플랜 생성 완료:", {
    scheduledPlansCount: scheduledPlans.length,
    firstPlan: scheduledPlans[0] || null,
  });

  if (scheduledPlans.length === 0) {
    // 더 자세한 에러 메시지 제공
    const errorDetails = [
      `콘텐츠 개수: ${contents.length}개`,
      `사용 가능한 날짜: ${dateAvailableTimeRanges.size}일`,
      `제외일: ${exclusions.length}개`,
      `학원 일정: ${academySchedules.length}개`,
    ].join(", ");

    throw new AppError(
      `생성된 플랜이 없습니다. 기간, 제외일, 블록 설정을 확인해주세요. (${errorDetails})`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 7. 기존 플랜 삭제 (해당 플랜 그룹의 기존 플랜)
  // 삭제 전에 해당 플랜 그룹의 플랜이 있는지 확인
  const { data: existingPlans, error: checkError } = await supabase
    .from("student_plan")
    .select("id, plan_date, block_index")
    .eq("plan_group_id", groupId)
    .eq("student_id", studentId);

  if (checkError) {
    console.error("[planGroupActions] 기존 플랜 조회 실패", checkError);
  }

  // 기존 플랜 삭제
  const { error: deleteError } = await supabase
    .from("student_plan")
    .delete()
    .eq("plan_group_id", groupId)
    .eq("student_id", studentId);

  if (deleteError) {
    throw new AppError(
      `기존 플랜 삭제 중 오류가 발생했습니다: ${deleteError.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: deleteError }
    );
  }

  // 삭제 확인
  if (existingPlans && existingPlans.length > 0) {
    // 삭제 확인: 실제로 삭제되었는지 재확인
    const { data: verifyPlans, error: verifyError } = await supabase
      .from("student_plan")
      .select("id")
      .eq("plan_group_id", groupId)
      .eq("student_id", studentId)
      .limit(1);

    if (verifyError) {
      console.error("[planGroupActions] 삭제 확인 실패", verifyError);
    } else if (verifyPlans && verifyPlans.length > 0) {
      console.warn(
        `[planGroupActions] 경고: ${verifyPlans.length}개의 플랜이 아직 남아있습니다. 재삭제 시도...`
      );
      // 재삭제 시도
      await supabase
        .from("student_plan")
        .delete()
        .eq("plan_group_id", groupId)
        .eq("student_id", studentId);
    }
  }

  // 8. 콘텐츠 메타데이터 조회 함수 (단원명, 강의명 등)
  const getContentChapter = async (
    contentType: string,
    contentId: string,
    pageOrTime: number
  ): Promise<string | null> => {
    // 더미 UUID는 chapter 조회 스킵
    if (
      contentId === DUMMY_NON_LEARNING_CONTENT_ID ||
      contentId === DUMMY_SELF_STUDY_CONTENT_ID
    ) {
      return null;
    }

    try {
      if (contentType === "book") {
        // 학생 교재 상세 정보 조회
        const { data: studentBookDetail } = await supabase
          .from("student_book_details")
          .select("major_unit, minor_unit")
          .eq("book_id", contentId)
          .lte("page_number", pageOrTime)
          .order("page_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (studentBookDetail?.major_unit || studentBookDetail?.minor_unit) {
          if (studentBookDetail.major_unit && studentBookDetail.minor_unit) {
            return `${studentBookDetail.major_unit} - ${studentBookDetail.minor_unit}`;
          }
          return (
            studentBookDetail.major_unit || studentBookDetail.minor_unit || null
          );
        }

        // 마스터 교재 상세 정보 조회 (학생 교재에 없을 경우)
        const { data: book } = await supabase
          .from("books")
          .select("master_content_id")
          .eq("id", contentId)
          .eq("student_id", studentId)
          .maybeSingle();

        if (book?.master_content_id) {
          const { data: masterBookDetail } = await supabase
            .from("book_details")
            .select("major_unit, minor_unit")
            .eq("book_id", book.master_content_id)
            .lte("page_number", pageOrTime)
            .order("page_number", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (masterBookDetail?.major_unit || masterBookDetail?.minor_unit) {
            if (masterBookDetail.major_unit && masterBookDetail.minor_unit) {
              return `${masterBookDetail.major_unit} - ${masterBookDetail.minor_unit}`;
            }
            return (
              masterBookDetail.major_unit || masterBookDetail.minor_unit || null
            );
          }
        }
      } else if (contentType === "lecture") {
        // 강의의 경우 회차 정보 표시
        return `${pageOrTime}강`;
      }
    } catch (error) {
      console.error(
        `[planGroupActions] 콘텐츠 메타데이터 조회 실패: ${contentId}`,
        error
      );
    }
    return null;
  };

  // 9. 기존 플랜 조회 (다른 플랜 그룹 포함) - block_index 조정을 위해
  const planDates = Array.from(new Set(scheduledPlans.map((p) => p.plan_date)));

  const { data: existingPlansForDates, error: existingPlansError } =
    await supabase
      .from("student_plan")
      .select("plan_date, block_index")
      .eq("student_id", studentId)
      .in("plan_date", planDates);

  if (existingPlansError) {
    console.error("[planGroupActions] 기존 플랜 조회 실패", existingPlansError);
  }

  // 날짜별로 사용 중인 block_index 집합 생성 (O(n) 한 번만)
  const usedBlockIndicesByDate = new Map<string, Set<number>>();
  if (existingPlansForDates) {
    existingPlansForDates.forEach((plan) => {
      if (
        plan.plan_date &&
        plan.block_index !== null &&
        plan.block_index !== undefined
      ) {
        if (!usedBlockIndicesByDate.has(plan.plan_date)) {
          usedBlockIndicesByDate.set(plan.plan_date, new Set());
        }
        usedBlockIndicesByDate.get(plan.plan_date)!.add(plan.block_index);
      }
    });
  }

  // 10. 날짜별로 플랜 그룹화 (효율적인 block_index 조정을 위해)
  const plansByDate = new Map<string, typeof scheduledPlans>();
  scheduledPlans.forEach((plan) => {
    if (!plansByDate.has(plan.plan_date)) {
      plansByDate.set(plan.plan_date, []);
    }
    plansByDate.get(plan.plan_date)!.push(plan);
  });

  // 11. 날짜별로 block_index 조정 및 chapter 조회 배치 처리
  const planPayloads: Array<{
    tenant_id: string;
    student_id: string;
    plan_group_id: string;
    plan_date: string;
    block_index: number;
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    chapter: string | null;
    planned_start_page_or_time: number;
    planned_end_page_or_time: number;
    is_reschedulable: boolean;
    // Denormalized 필드 (조회 성능 향상)
    content_title: string | null;
    content_subject: string | null;
    content_subject_category: string | null;
    content_category: string | null;
    // 시간 정보 (플랜 생성 시 계산된 시간)
    start_time: string | null;
    end_time: string | null;
    // 날짜 유형 및 주차 정보
    day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
    week: number | null;
    day: number | null;
    // 상태뱃지 정보
    is_partial: boolean;
    is_continued: boolean;
    // 플랜 번호 (같은 논리적 플랜은 같은 번호)
    plan_number: number | null;
    // 회차 (나중에 계산하여 업데이트)
    sequence: number | null;
  }> = [];

  // 플랜 번호 부여를 위한 매핑 (논리적 플랜 키 -> 플랜 번호)
  // 같은 논리적 플랜 식별 키: plan_date + content_id + planned_start_page_or_time + planned_end_page_or_time
  const planNumberMap = new Map<string, number>();
  let nextPlanNumber = 1;

  // 날짜별로 순차 처리 (assignPlanTimes를 사용하여 정확한 시간 계산)
  for (const [date, datePlans] of plansByDate.entries()) {
    const usedIndices = usedBlockIndicesByDate.get(date) || new Set<number>();
    let nextBlockIndex = 1; // 날짜별로 시작 block_index

    // 해당 날짜의 time_slots에서 "학습시간" 슬롯만 필터링 및 정렬
    const timeSlotsForDate = dateTimeSlots.get(date) || [];
    const studyTimeSlots = timeSlotsForDate
      .filter((slot) => slot.type === "학습시간")
      .map((slot) => ({ start: slot.start, end: slot.end }))
      .sort((a, b) => {
        // 시간 순으로 정렬
        const aStart = a.start.split(":").map(Number);
        const bStart = b.start.split(":").map(Number);
        const aMinutes = aStart[0] * 60 + aStart[1];
        const bMinutes = bStart[0] * 60 + bStart[1];
        return aMinutes - bMinutes;
      });

    // 날짜별 메타데이터 가져오기
    const dateMetadata = dateMetadataMap.get(date) || {
      day_type: null,
      week_number: null,
    };
    const dayType = dateMetadata.day_type || "학습일";

    // 해당 날짜의 총 학습시간 계산 (scheduleResult에서 가져오기)
    const dailySchedule = scheduleResult.daily_schedule.find(
      (d) => d.date === date
    );
    const totalStudyHours = dailySchedule?.study_hours || 0;

    // assignPlanTimes를 사용하여 플랜 시간 배치 (쪼개진 플랜 처리 포함)
    // 먼저 플랜을 준비 (마스터 콘텐츠 ID를 학생 콘텐츠 ID로 변환)
    const plansForAssign = datePlans.map((plan) => {
      const finalContentId =
        contentIdMap.get(plan.content_id) || plan.content_id;
      return {
        content_id: finalContentId,
        content_type: plan.content_type,
        planned_start_page_or_time: plan.planned_start_page_or_time,
        planned_end_page_or_time: plan.planned_end_page_or_time,
        chapter: plan.chapter || null,
        block_index: plan.block_index,
      };
    });

    // assignPlanTimes 호출하여 시간 세그먼트 계산
    const timeSegments = assignPlanTimes(
      plansForAssign,
      studyTimeSlots,
      contentDurationMap,
      dayType,
      totalStudyHours
    );

    // 각 세그먼트마다 별도의 레코드 생성
    for (const segment of timeSegments) {
      // 기존 플랜과 겹치지 않는 block_index 찾기
      while (usedIndices.has(nextBlockIndex)) {
        nextBlockIndex++;
      }

      // 조정된 block_index를 사용 중인 목록에 추가
      usedIndices.add(nextBlockIndex);
      usedBlockIndicesByDate.set(date, usedIndices);

      // 콘텐츠 메타데이터 조회 (denormalized 필드용)
      const originalContentId =
        datePlans.find(
          (p) =>
            p.content_id === segment.plan.content_id ||
            contentIdMap.get(p.content_id) === segment.plan.content_id
        )?.content_id || segment.plan.content_id;
      const metadata = contentMetadataMap.get(originalContentId) || {};

      // 주차별 일차(day) 계산
      let weekDay: number | null = null;
      if (dateMetadata.week_number) {
        // 기본적으로 같은 주차의 날짜 목록에서 순서를 계산하고,
        // 데이터가 없으면 기간 기준 단순 계산을 사용한다.
        const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
        const dayIndex = weekDates.indexOf(date);
        if (dayIndex >= 0) {
          weekDay = dayIndex + 1;
        } else {
          const start = new Date(group.period_start);
          const current = new Date(date);
          start.setHours(0, 0, 0, 0);
          current.setHours(0, 0, 0, 0);
          const diffTime = current.getTime() - start.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          weekDay = (diffDays % 7) + 1;
        }
      }

      // 플랜 번호 부여 (같은 논리적 플랜은 같은 번호)
      // 논리적 플랜 식별 키: date + content_id + planned_start_page_or_time + planned_end_page_or_time
      const planKey = `${date}:${segment.plan.content_id}:${segment.plan.planned_start_page_or_time}:${segment.plan.planned_end_page_or_time}`;
      let planNumber: number | null = null;

      if (planNumberMap.has(planKey)) {
        // 이미 존재하는 논리적 플랜이면 같은 번호 사용
        planNumber = planNumberMap.get(planKey)!;
      } else {
        // 새로운 논리적 플랜이면 새 번호 부여
        planNumber = nextPlanNumber;
        planNumberMap.set(planKey, planNumber);
        nextPlanNumber++;
      }

      // 원본 플랜에서 is_reschedulable 가져오기
      const originalPlan = datePlans.find(
        (p) =>
          p.content_id === segment.plan.content_id ||
          contentIdMap.get(p.content_id) === segment.plan.content_id
      );

      // chapter 정보가 없으면 나중에 배치로 조회 (지금은 null로 설정)
      planPayloads.push({
        tenant_id: tenantContext.tenantId,
        student_id: studentId,
        plan_group_id: groupId,
        plan_date: date,
        block_index: nextBlockIndex,
        content_type: segment.plan.content_type,
        content_id: segment.plan.content_id,
        chapter: segment.plan.chapter || null, // 나중에 배치로 채움
        planned_start_page_or_time: segment.plan.planned_start_page_or_time,
        planned_end_page_or_time: segment.plan.planned_end_page_or_time,
        is_reschedulable: originalPlan?.is_reschedulable ?? true,
        // Denormalized 필드
        content_title: metadata.title || null,
        content_subject: metadata.subject || null,
        content_subject_category: metadata.subject_category || null,
        content_category: metadata.category || null,
        // 시간 정보 (assignPlanTimes에서 계산된 정확한 시간)
        start_time: segment.start,
        end_time: segment.end,
        // 날짜 유형 및 주차 정보
        day_type: dateMetadata.day_type,
        week: dateMetadata.week_number,
        day: weekDay,
        // 상태뱃지 정보 (assignPlanTimes에서 계산)
        is_partial: segment.isPartial,
        is_continued: segment.isContinued,
        // 플랜 번호
        plan_number: planNumber,
        // 회차 (나중에 계산하여 업데이트)
        sequence: null,
      });

      nextBlockIndex++;
    }

    // 비학습 항목 저장 (학원일정, 이동시간, 점심시간)
    // time_slots에서 "학습시간"이 아닌 슬롯들을 플랜으로 저장
    const nonStudySlots = timeSlotsForDate.filter(
      (slot) => slot.type !== "학습시간"
    );

    for (const slot of nonStudySlots) {
      // 기존 플랜과 겹치지 않는 block_index 찾기
      while (usedIndices.has(nextBlockIndex)) {
        nextBlockIndex++;
      }

      // 조정된 block_index를 사용 중인 목록에 추가
      usedIndices.add(nextBlockIndex);
      usedBlockIndicesByDate.set(date, usedIndices);

      // content_type 결정
      let contentType: "book" | "lecture" | "custom" = "custom";
      let contentTitle: string;
      let contentSubject: string | null = null;
      let contentSubjectCategory: string | null = null;

      // 비학습 항목을 위한 더미 custom content ID (모든 비학습 항목이 공유)
      const DUMMY_NON_LEARNING_CONTENT_ID =
        "00000000-0000-0000-0000-000000000000";

      // 더미 custom content가 존재하는지 확인하고, 없으면 생성 (첫 번째 슬롯에서만)
      // 주의: content_type은 스키마 제약 조건에 따라 'book', 'lecture', 'custom' 중 하나여야 함
      if (nonStudySlots.indexOf(slot) === 0) {
        const { data: existingDummyContent } = await supabase
          .from("student_custom_contents")
          .select("id")
          .eq("id", DUMMY_NON_LEARNING_CONTENT_ID)
          .eq("student_id", studentId)
          .maybeSingle();

        if (!existingDummyContent) {
          // 더미 custom content 생성 시도
          // content_type을 'custom'으로 설정 (스키마에서 허용하는 값)
          const { error: createError } = await supabase
            .from("student_custom_contents")
            .insert({
              id: DUMMY_NON_LEARNING_CONTENT_ID,
              tenant_id: tenantContext.tenantId,
              student_id: studentId,
              title: "비학습 항목",
              total_page_or_time: 0,
              content_type: "custom",
            });

          if (createError) {
            // 생성 실패 시 경고만 출력 (더미 content는 선택사항)
            // contentDurationMap에 이미 기본값이 있으므로 플랜 생성은 계속 진행
            console.warn(
              "[planGroupActions] 더미 custom content 생성 실패 (무시됨):",
              createError.message
            );
          }
        }
      }

      if (slot.type === "학원일정") {
        contentTitle = slot.label || "학원일정";
        // 학원일정 정보에서 과목 정보 가져오기
        const dailySchedule = scheduleResult.daily_schedule.find(
          (d) => d.date === date
        );
        if (
          dailySchedule?.academy_schedules &&
          dailySchedule.academy_schedules.length > 0
        ) {
          // 같은 시간대의 학원일정 찾기
          const matchingAcademy = dailySchedule.academy_schedules.find(
            (academy) =>
              academy.start_time === slot.start && academy.end_time === slot.end
          );
          if (matchingAcademy) {
            contentTitle = matchingAcademy.academy_name || "학원일정";
            if (matchingAcademy.subject) {
              contentSubject = matchingAcademy.subject;
            }
          }
        }
      } else if (slot.type === "이동시간") {
        contentTitle = "이동시간";
      } else if (slot.type === "점심시간") {
        contentTitle = "점심시간";
      } else {
        contentTitle = slot.label || slot.type;
      }

      // 주차별 일차(day) 계산 (위에서 이미 계산된 값 재사용)
      let weekDay: number | null = null;
      if (dateMetadata.week_number) {
        if (group.scheduler_type === "1730_timetable") {
          const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
          const dayIndex = weekDates.indexOf(date);
          if (dayIndex >= 0) {
            weekDay = dayIndex + 1;
          }
        } else {
          const start = new Date(group.period_start);
          const current = new Date(date);
          start.setHours(0, 0, 0, 0);
          current.setHours(0, 0, 0, 0);
          const diffTime = current.getTime() - start.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          weekDay = (diffDays % 7) + 1;
        }
      }

      planPayloads.push({
        tenant_id: tenantContext.tenantId,
        student_id: studentId,
        plan_group_id: groupId,
        plan_date: date,
        block_index: nextBlockIndex,
        content_type: contentType,
        content_id: DUMMY_NON_LEARNING_CONTENT_ID, // 비학습 항목은 더미 UUID 사용
        chapter: null,
        planned_start_page_or_time: 0, // 비학습 항목은 페이지/시간 없음
        planned_end_page_or_time: 0,
        is_reschedulable: false, // 비학습 항목은 재조정 불가
        // Denormalized 필드
        content_title: contentTitle,
        content_subject: contentSubject,
        content_subject_category: contentSubjectCategory,
        content_category: slot.type, // 슬롯 타입을 category로 저장
        // 시간 정보
        start_time: slot.start,
        end_time: slot.end,
        // 날짜 유형 및 주차 정보
        day_type: dateMetadata.day_type,
        week: dateMetadata.week_number,
        day: weekDay,
        // 상태뱃지 정보 (비학습 항목은 없음)
        is_partial: false,
        is_continued: false,
        // 플랜 번호 (비학습 항목은 null)
        plan_number: null,
        // 회차 (비학습 항목은 null)
        sequence: null,
      });

      nextBlockIndex++;
    }

    // 지정휴일의 경우 배정된 학습시간을 자율학습으로 저장
    // enable_self_study_for_holidays가 true일 때만 자율학습 시간 배정
    const enableSelfStudyForHolidays =
      schedulerOptions.enable_self_study_for_holidays === true;
    if (
      dateMetadata.day_type === "지정휴일" &&
      studyTimeSlots.length > 0 &&
      enableSelfStudyForHolidays
    ) {
      // 자율학습을 위한 더미 custom content ID
      const DUMMY_SELF_STUDY_CONTENT_ID =
        "00000000-0000-0000-0000-000000000001";

      // 더미 custom content가 존재하는지 확인하고, 없으면 생성
      const { data: existingSelfStudyContent } = await supabase
        .from("student_custom_contents")
        .select("id")
        .eq("id", DUMMY_SELF_STUDY_CONTENT_ID)
        .eq("student_id", studentId)
        .maybeSingle();

      if (!existingSelfStudyContent) {
        // 더미 custom content 생성 시도
        // content_type을 'custom'으로 설정 (스키마에서 허용하는 값)
        const { error: createError } = await supabase
          .from("student_custom_contents")
          .insert({
            id: DUMMY_SELF_STUDY_CONTENT_ID,
            tenant_id: tenantContext.tenantId,
            student_id: studentId,
            title: "자율학습",
            total_page_or_time: 0,
            content_type: "custom",
          });

        if (createError) {
          // 생성 실패 시 경고만 출력 (더미 content는 선택사항)
          // contentDurationMap에 이미 기본값이 있으므로 플랜 생성은 계속 진행
          console.warn(
            "[planGroupActions] 더미 자율학습 custom content 생성 실패 (무시됨):",
            createError.message
          );
        }
      }

      // 지정휴일의 모든 학습시간 슬롯을 자율학습으로 저장
      for (const studySlot of studyTimeSlots) {
        // 기존 플랜과 겹치지 않는 block_index 찾기
        while (usedIndices.has(nextBlockIndex)) {
          nextBlockIndex++;
        }

        // 조정된 block_index를 사용 중인 목록에 추가
        usedIndices.add(nextBlockIndex);
        usedBlockIndicesByDate.set(date, usedIndices);

        // 주차별 일차(day) 계산
        let weekDay: number | null = null;
        if (dateMetadata.week_number) {
          if (group.scheduler_type === "1730_timetable") {
            const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
            const dayIndex = weekDates.indexOf(date);
            if (dayIndex >= 0) {
              weekDay = dayIndex + 1;
            }
          } else {
            const start = new Date(group.period_start);
            const current = new Date(date);
            start.setHours(0, 0, 0, 0);
            current.setHours(0, 0, 0, 0);
            const diffTime = current.getTime() - start.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            weekDay = (diffDays % 7) + 1;
          }
        }

        planPayloads.push({
          tenant_id: tenantContext.tenantId,
          student_id: studentId,
          plan_group_id: groupId,
          plan_date: date,
          block_index: nextBlockIndex,
          content_type: "custom", // 자율학습은 custom 타입
          content_id: DUMMY_SELF_STUDY_CONTENT_ID, // 자율학습은 더미 UUID 사용
          chapter: null,
          planned_start_page_or_time: 0, // 자율학습은 페이지/시간 없음
          planned_end_page_or_time: 0,
          is_reschedulable: false, // 자율학습은 재조정 불가
          // Denormalized 필드
          content_title: "자율학습",
          content_subject: null,
          content_subject_category: null,
          content_category: "자율학습",
          // 시간 정보 (배정된 학습시간)
          start_time: studySlot.start,
          end_time: studySlot.end,
          // 날짜 유형 및 주차 정보
          day_type: dateMetadata.day_type,
          week: dateMetadata.week_number,
          day: weekDay,
          // 상태뱃지 정보 (자율학습은 없음)
          is_partial: false,
          is_continued: false,
          // 플랜 번호 (자율학습은 null)
          plan_number: null,
          // 회차 (자율학습은 null)
          sequence: null,
        });

        nextBlockIndex++;
      }
    }
  }

  // 12. chapter 정보가 없는 플랜들에 대해 배치로 조회 (중복 제거)
  // 더미 UUID는 chapter 조회 스킵 (비학습 항목 및 자율학습)
  const plansNeedingChapter = planPayloads.filter(
    (p) =>
      !p.chapter &&
      p.content_id !== DUMMY_NON_LEARNING_CONTENT_ID &&
      p.content_id !== DUMMY_SELF_STUDY_CONTENT_ID
  );
  if (plansNeedingChapter.length > 0) {
    // 같은 content_id + page_or_time 조합에 대해 중복 조회 방지
    const chapterCache = new Map<string, string | null>();

    await Promise.all(
      plansNeedingChapter.map(async (planPayload) => {
        const cacheKey = `${planPayload.content_type}:${planPayload.content_id}:${planPayload.planned_start_page_or_time}`;

        if (chapterCache.has(cacheKey)) {
          planPayload.chapter = chapterCache.get(cacheKey) ?? null;
          return;
        }

        const chapter = await getContentChapter(
          planPayload.content_type,
          planPayload.content_id,
          planPayload.planned_start_page_or_time
        );

        chapterCache.set(cacheKey, chapter);
        planPayload.chapter = chapter;
      })
    );
  }

  // 13. 최종 중복 체크 (안전장치)
  const planKeys = new Set<string>();
  const duplicatePlans: Array<{ plan_date: string; block_index: number }> = [];

  planPayloads.forEach((plan) => {
    const key = `${plan.student_id}:${plan.plan_date}:${plan.block_index}`;
    if (planKeys.has(key)) {
      duplicatePlans.push({
        plan_date: plan.plan_date,
        block_index: plan.block_index,
      });
    } else {
      planKeys.add(key);
    }
  });

  if (duplicatePlans.length > 0) {
    console.error(
      "[planGroupActions] 생성하려는 플랜 중 중복 발견:",
      duplicatePlans
    );
    throw new AppError(
      `플랜 생성 중 중복이 발견되었습니다. 같은 날짜와 블록에 여러 플랜이 배정되었습니다. (${duplicatePlans.length}개 중복)`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 플랜 일괄 생성
  // 더미 UUID를 사용하는 플랜과 일반 플랜을 분리하여 처리
  const regularPlans = planPayloads.filter(
    (p) =>
      p.content_id !== DUMMY_NON_LEARNING_CONTENT_ID &&
      p.content_id !== DUMMY_SELF_STUDY_CONTENT_ID
  );
  const dummyPlans = planPayloads.filter(
    (p) =>
      p.content_id === DUMMY_NON_LEARNING_CONTENT_ID ||
      p.content_id === DUMMY_SELF_STUDY_CONTENT_ID
  );

  // 일반 플랜 먼저 저장
  if (regularPlans.length > 0) {
    const { error: insertError } = await studentContentClient
      .from("student_plan")
      .insert(regularPlans);

    if (insertError) {
      console.error("[planGroupActions] 일반 플랜 생성 실패", insertError);

      // 중복 키 에러인 경우 더 자세한 정보 제공
      if (insertError.code === "23505") {
        // 중복된 플랜 찾기
        const duplicateKey = insertError.message.match(/Key \(([^)]+)\)/)?.[1];
        console.error("[planGroupActions] 중복 키:", duplicateKey);

        // 중복된 플랜 조회 (Admin 클라이언트 사용)
        const { data: duplicatePlanData } = await studentContentClient
          .from("student_plan")
          .select("id, plan_date, block_index, plan_group_id")
          .eq("student_id", studentId)
          .limit(10);

        if (duplicatePlanData) {
          console.error(
            "[planGroupActions] 현재 존재하는 플랜 (일부):",
            duplicatePlanData
          );
        }

        throw new AppError(
          `플랜 생성 중 중복 키 오류가 발생했습니다. 같은 날짜와 블록에 이미 플랜이 존재합니다. (키: ${duplicateKey}) 다른 플랜 그룹의 플랜과 충돌할 수 있습니다.`,
          ErrorCode.DATABASE_ERROR,
          500,
          true,
          {
            supabaseError: insertError,
            duplicateKey,
            existingPlans: duplicatePlanData,
          }
        );
      }

      throw new AppError(
        insertError.message || "플랜 생성에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { supabaseError: insertError }
      );
    }
  }

  // 더미 UUID를 사용하는 플랜 저장 (에러 발생해도 무시)
  if (dummyPlans.length > 0) {
    const { error: dummyInsertError } = await studentContentClient
      .from("student_plan")
      .insert(dummyPlans);

    if (dummyInsertError) {
      // 더미 UUID 관련 에러는 무시 (데이터베이스 트리거/함수에서 검증 실패해도 계속 진행)
      if (
        dummyInsertError.code === "P0001" &&
        dummyInsertError.message?.includes("Referenced custom content")
      ) {
        console.warn(
          "[planGroupActions] 더미 UUID 플랜 저장 실패 (무시됨):",
          dummyInsertError.message
        );
        // 더미 content 생성이 실패했어도 플랜은 저장 시도 (외래 키 제약 조건이 없을 수 있음)
      } else {
        // 다른 에러는 로그만 남기고 계속 진행 (비학습 항목은 선택사항)
        console.warn(
          "[planGroupActions] 더미 UUID 플랜 저장 실패 (무시됨):",
          dummyInsertError.message
        );
      }
    }
  }

  // 14. dailySchedule을 plan_groups에 저장 (캐싱)
  // scheduleResult.daily_schedule을 JSONB로 저장하여 매번 계산하지 않도록 개선
  const dailyScheduleForStorage = scheduleResult.daily_schedule.map(
    (daily) => ({
      date: daily.date,
      day_type: daily.day_type,
      study_hours: daily.study_hours,
      time_slots: daily.time_slots,
      exclusion: daily.exclusion,
      academy_schedules: daily.academy_schedules,
    })
  );

  const { error: updateScheduleError } = await supabase
    .from("plan_groups")
    .update({ daily_schedule: dailyScheduleForStorage })
    .eq("id", groupId)
    .eq("student_id", studentId);

  if (updateScheduleError) {
    console.error(
      "[planGroupActions] dailySchedule 저장 실패",
      updateScheduleError
    );
    // 저장 실패해도 플랜 생성은 성공했으므로 계속 진행
  }

  // 15. 회차 계산 및 저장
  // 플랜 생성 후 같은 content_id를 가진 플랜들에 대해 회차 계산
  try {
    // 생성된 플랜 조회 (일반 플랜만, 더미 플랜 제외)
    const { data: createdPlans, error: fetchError } = await supabase
      .from("student_plan")
      .select("id, plan_date, content_id, plan_number, block_index")
      .eq("plan_group_id", groupId)
      .eq("student_id", studentId)
      .not("content_id", "eq", DUMMY_NON_LEARNING_CONTENT_ID)
      .not("content_id", "eq", DUMMY_SELF_STUDY_CONTENT_ID)
      .order("plan_date", { ascending: true })
      .order("block_index", { ascending: true });

    if (!fetchError && createdPlans && createdPlans.length > 0) {
      // content_id별로 그룹화
      const plansByContent = new Map<string, typeof createdPlans>();
      createdPlans.forEach((plan) => {
        if (!plansByContent.has(plan.content_id)) {
          plansByContent.set(plan.content_id, []);
        }
        plansByContent.get(plan.content_id)!.push(plan);
      });

      // 각 content_id별로 회차 계산
      const sequenceUpdates: Array<{ id: string; sequence: number }> = [];

      for (const [contentId, contentPlans] of plansByContent.entries()) {
        // 날짜와 block_index 순으로 정렬
        const sortedPlans = [...contentPlans].sort((a, b) => {
          if (a.plan_date !== b.plan_date) {
            return a.plan_date.localeCompare(b.plan_date);
          }
          return (a.block_index || 0) - (b.block_index || 0);
        });

        // 회차 계산 (plan_number 고려)
        const seenPlanNumbers = new Set<number | null>();
        let currentSequence = 1;
        const planSequenceMap = new Map<string, number>();

        for (const plan of sortedPlans) {
          const pn = plan.plan_number;

          if (pn === null) {
            // plan_number가 null이면 개별 카운트
            planSequenceMap.set(plan.id, currentSequence);
            currentSequence++;
          } else {
            // plan_number가 있으면 같은 번호를 가진 그룹은 한 번만 카운트
            if (!seenPlanNumbers.has(pn)) {
              seenPlanNumbers.add(pn);
              // 같은 plan_number를 가진 모든 플랜에 같은 회차 부여
              const plansWithSameNumber = sortedPlans.filter(
                (p) => p.plan_number === pn
              );
              const sequence = currentSequence;
              plansWithSameNumber.forEach((p) => {
                planSequenceMap.set(p.id, sequence);
              });
              currentSequence++;
            }
          }
        }

        // 회차 업데이트 목록에 추가
        planSequenceMap.forEach((sequence, planId) => {
          sequenceUpdates.push({ id: planId, sequence });
        });
      }

      // 배치로 회차 업데이트
      if (sequenceUpdates.length > 0) {
        // Supabase는 배치 업데이트를 직접 지원하지 않으므로 Promise.all 사용
        await Promise.all(
          sequenceUpdates.map((update) =>
            supabase
              .from("student_plan")
              .update({ sequence: update.sequence })
              .eq("id", update.id)
              .eq("student_id", studentId)
          )
        );
      }
    }
  } catch (error) {
    // 회차 계산 실패는 경고만 (플랜 생성은 성공했으므로)
    console.warn("[planGroupActions] 회차 계산 및 저장 실패:", error);
  }

  // 16. 플랜 생성 완료 시 자동으로 saved 상태로 변경
  // draft 상태에서 플랜이 생성되면 saved 상태로 변경
  if ((group.status as PlanStatus) === "draft") {
    try {
      await updatePlanGroupStatus(groupId, "saved");
    } catch (error) {
      // 상태 변경 실패는 경고만 (이미 saved 상태일 수 있음)
      console.warn("[planGroupActions] 플랜 그룹 상태 변경 실패:", error);
    }
  }

  // revalidatePath는 Step 7에서 결과를 확인한 후에 실행되도록 제거
  // Step 7에서 완료 버튼을 눌렀을 때만 리다이렉트하도록 함
  // revalidatePath("/plan");
  // revalidatePath(`/plan/group/${groupId}`);

  return { count: scheduledPlans.length };
}

export const generatePlansFromGroupAction = withErrorHandling(
  _generatePlansFromGroup
);

async function _previewPlansFromGroup(groupId: string): Promise<{
  plans: Array<{
    plan_date: string;
    block_index: number;
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    content_title: string | null;
    content_subject: string | null;
    content_subject_category: string | null;
    content_category: string | null;
    planned_start_page_or_time: number;
    planned_end_page_or_time: number;
    chapter: string | null;
    start_time: string | null;
    end_time: string | null;
    day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
    week: number | null;
    day: number | null;
    is_partial: boolean;
    is_continued: boolean;
    plan_number: number | null;
  }>;
}> {
  try {
    const access = await verifyPlanGroupAccess();
    const tenantContext = await requireTenantContext();

    const supabase = await createSupabaseServerClient();

    const { group, contents, exclusions, academySchedules } =
      await getPlanGroupWithDetailsByRole(
        groupId,
        access.user.userId,
        access.role,
        tenantContext.tenantId
      );

    if (!group) {
      throw new AppError(
        "플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const studentId = getStudentIdForPlanGroup(
      group,
      access.user.userId,
      access.role
    );

    const viewingOtherStudent = studentId !== access.user.userId;
    const isAdminOrConsultant =
      access.role === "admin" || access.role === "consultant";
    const queryClient = await getSupabaseClientForStudent(
      studentId,
      access.user.userId,
      access.role
    );
    const masterQueryClient = isAdminOrConsultant
      ? ensureAdminClient()
      : supabase;

    const bypassStatusCheck = shouldBypassStatusCheck(
      access.role,
      group.plan_type
    );

    if (!bypassStatusCheck) {
      // 일반 학생 모드에서만 상태 체크
      if (group.status !== "saved" && group.status !== "active") {
        throw new AppError(
          "플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 미리볼 수 있습니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
    }

    // exclusions와 academySchedules가 배열인지 확인 (이중 체크)
    const safeExclusions = Array.isArray(exclusions) ? exclusions : [];
    const safeAcademySchedules = Array.isArray(academySchedules)
      ? academySchedules
      : [];

    // 3. Step 2.5에서 계산된 스케줄 결과 사용
    const { calculateAvailableDates } = await import(
      "@/lib/scheduler/calculateAvailableDates"
    );

    // 블록 세트에서 기본 블록 정보 가져오기
    let baseBlocks: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }> = [];

    if (group.block_set_id) {
      const { data: blockSet } = await supabase
        .from("student_block_sets")
        .select("id, name, student_id")
        .eq("id", group.block_set_id)
        .maybeSingle();

      if (blockSet) {
        const blockSetOwnerId = blockSet.student_id;
        const { data: blockRows } = await supabase
          .from("student_block_schedule")
          .select("day_of_week, start_time, end_time")
          .eq("block_set_id", group.block_set_id)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

        if (blockRows && blockRows.length > 0) {
          baseBlocks = blockRows.map((row) => ({
            day_of_week: row.day_of_week,
            start_time: row.start_time,
            end_time: row.end_time,
          }));
        }
      }
    }

    // Step 2.5 스케줄 결과 가져오기
    const scheduleResult = calculateAvailableDates(
      group.period_start,
      group.period_end,
      baseBlocks.map((b) => ({
        day_of_week: b.day_of_week,
        start_time: b.start_time,
        end_time: b.end_time,
      })),
      safeExclusions.map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type as
          | "휴가"
          | "개인사정"
          | "휴일지정"
          | "기타",
        reason: e.reason || undefined,
      })),
      safeAcademySchedules.map((a) => ({
        day_of_week: a.day_of_week,
        start_time: a.start_time,
        end_time: a.end_time,
        academy_name: a.academy_name || undefined,
        subject: a.subject || undefined,
        travel_time: a.travel_time || undefined,
      })),
      {
        scheduler_type: group.scheduler_type || "1730_timetable",
        scheduler_options: (group.scheduler_options as any) || null,
        use_self_study_with_blocks: true, // 블록이 있어도 자율학습 시간 포함
        enable_self_study_for_holidays:
          (group.scheduler_options as any)?.enable_self_study_for_holidays ===
          true,
        enable_self_study_for_study_days:
          (group.scheduler_options as any)?.enable_self_study_for_study_days ===
          true,
        lunch_time: (group.scheduler_options as any)?.lunch_time,
        camp_study_hours: (group.scheduler_options as any)?.camp_study_hours,
        camp_self_study_hours: (group.scheduler_options as any)
          ?.camp_self_study_hours,
        designated_holiday_hours: (group.scheduler_options as any)
          ?.designated_holiday_hours,
      }
    );

    // dateTimeSlots, dateMetadataMap, weekDatesMap 추출
    const dateTimeSlots = new Map<
      string,
      Array<{
        type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
        start: string;
        end: string;
        label?: string;
      }>
    >();

    // 날짜별 메타데이터 매핑 (day_type, week_number)
    const dateMetadataMap = new Map<
      string,
      {
        day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
        week_number: number | null;
      }
    >();

    // 주차별 날짜 목록 (일차 계산용)
    const weekDatesMap = new Map<number, string[]>();

    scheduleResult.daily_schedule.forEach((daily) => {
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

      // 주차별 날짜 목록 구성 (일차 계산용)
      if (daily.week_number) {
        if (!weekDatesMap.has(daily.week_number)) {
          weekDatesMap.set(daily.week_number, []);
        }
        // 제외일이 아닌 날짜만 주차에 포함 (1730 Timetable의 경우)
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
    weekDatesMap.forEach((dates, week) => {
      dates.sort();
    });

    // 4. 마스터 콘텐츠를 학생 콘텐츠로 매핑 (미리보기에서는 기존 복사본 확인만)
    // content_id 매핑: 마스터 콘텐츠 ID -> 학생 콘텐츠 ID
    const contentIdMap = new Map<string, string>();

    for (const content of contents) {
      let studentContentId = content.content_id;

      try {
        // 마스터 콘텐츠인지 확인하고 기존 복사본이 있는지 확인
        if (content.content_type === "book") {
          const { data: masterBook } = await masterQueryClient
            .from("master_books")
            .select("id")
            .eq("id", content.content_id)
            .maybeSingle();

          if (masterBook) {
            // 이미 복사된 학생 교재가 있는지 확인
            const { data: existingBook } = await queryClient
              .from("books")
              .select("id")
              .eq("student_id", studentId)
              .eq("master_content_id", content.content_id)
              .maybeSingle();

            if (existingBook) {
              studentContentId = existingBook.id;
            }
            // 미리보기에서는 복사하지 않고 기존 ID 사용
            contentIdMap.set(content.content_id, studentContentId);
          } else {
            contentIdMap.set(content.content_id, content.content_id);
          }
        } else if (content.content_type === "lecture") {
          const { data: masterLecture } = await masterQueryClient
            .from("master_lectures")
            .select("id")
            .eq("id", content.content_id)
            .maybeSingle();

          if (masterLecture) {
            // 이미 복사된 학생 강의가 있는지 확인
            const { data: existingLecture } = await queryClient
              .from("lectures")
              .select("id")
              .eq("student_id", studentId)
              .eq("master_content_id", content.content_id)
              .maybeSingle();

            if (existingLecture) {
              studentContentId = existingLecture.id;
            }
            contentIdMap.set(content.content_id, studentContentId);
          } else {
            contentIdMap.set(content.content_id, content.content_id);
          }
        } else {
          contentIdMap.set(content.content_id, content.content_id);
        }
      } catch (error) {
        console.error(
          `[planGroupActions] 마스터 콘텐츠 확인 실패: ${content.content_id}`,
          error
        );
        // 에러 발생 시 원본 ID 사용
        contentIdMap.set(content.content_id, content.content_id);
      }
    }

    // 5. 콘텐츠 소요시간 정보 조회
    const contentDurationMap = new Map<
      string,
      {
        content_type: "book" | "lecture" | "custom";
        content_id: string;
        total_pages?: number | null;
        duration?: number | null;
        total_page_or_time?: number | null;
      }
    >();

    // 더미 UUID에 대한 기본값 추가 (비학습 항목 및 자율학습용)
    const DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW =
      "00000000-0000-0000-0000-000000000000";
    const DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW =
      "00000000-0000-0000-0000-000000000001";

    contentDurationMap.set(DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW, {
      content_type: "custom",
      content_id: DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW,
      total_page_or_time: 0,
    });

    contentDurationMap.set(DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW, {
      content_type: "custom",
      content_id: DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW,
      total_page_or_time: 0,
    });

    for (const content of contents) {
      const finalContentId =
        contentIdMap.get(content.content_id) || content.content_id;

      if (content.content_type === "book") {
        // 학생 교재 조회
        const { data: studentBook } = await queryClient
          .from("books")
          .select("id, total_pages, master_content_id")
          .eq("id", finalContentId)
          .eq("student_id", studentId)
          .maybeSingle();

        if (studentBook?.total_pages) {
          contentDurationMap.set(content.content_id, {
            content_type: "book",
            content_id: content.content_id,
            total_pages: studentBook.total_pages,
          });
        } else if (studentBook?.master_content_id) {
          // 마스터 교재 조회 (관리자가 조회할 때는 Admin 클라이언트 사용)
          const { data: masterBook } = await masterQueryClient
            .from("master_books")
            .select("id, total_pages")
            .eq("id", studentBook.master_content_id)
            .maybeSingle();

          if (masterBook?.total_pages) {
            contentDurationMap.set(content.content_id, {
              content_type: "book",
              content_id: content.content_id,
              total_pages: masterBook.total_pages,
            });
          }
        }
      } else if (content.content_type === "lecture") {
        // 학생 강의 조회
        const { data: studentLecture } = await queryClient
          .from("lectures")
          .select("id, duration, master_content_id")
          .eq("id", finalContentId)
          .eq("student_id", studentId)
          .maybeSingle();

        if (studentLecture?.duration) {
          contentDurationMap.set(content.content_id, {
            content_type: "lecture",
            content_id: content.content_id,
            duration: studentLecture.duration,
          });
        } else if (studentLecture?.master_content_id) {
          // 마스터 강의 조회 (관리자가 조회할 때는 Admin 클라이언트 사용)
          const { data: masterLecture } = await masterQueryClient
            .from("master_lectures")
            .select("id, total_duration")
            .eq("id", studentLecture.master_content_id)
            .maybeSingle();

          if (masterLecture?.total_duration) {
            contentDurationMap.set(content.content_id, {
              content_type: "lecture",
              content_id: content.content_id,
              duration: masterLecture.total_duration,
            });
          }
        }
      } else if (content.content_type === "custom") {
        // 더미 UUID는 이미 처리했으므로 스킵
        if (
          finalContentId === DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW ||
          finalContentId === DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW ||
          content.content_id === DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW ||
          content.content_id === DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW
        ) {
          continue;
        }

        // 커스텀 콘텐츠 조회
        const { data: customContent } = await queryClient
          .from("student_custom_contents")
          .select("id, total_page_or_time")
          .eq("id", finalContentId)
          .eq("student_id", studentId)
          .maybeSingle();

        if (customContent?.total_page_or_time) {
          contentDurationMap.set(content.content_id, {
            content_type: "custom",
            content_id: content.content_id,
            total_page_or_time: customContent.total_page_or_time,
          });
        } else if (!customContent) {
          // 더미 UUID인 경우는 에러 발생하지 않음 (더미 content 생성 실패해도 계속 진행)
          // 일반 custom content가 존재하지 않으면 에러 발생
          if (
            finalContentId !== DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW &&
            finalContentId !== DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW &&
            content.content_id !== DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW &&
            content.content_id !== DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW
          ) {
            throw new AppError(
              `Referenced custom content (${finalContentId}) does not exist`,
              ErrorCode.VALIDATION_ERROR,
              400,
              true
            );
          }
          // 더미 UUID인 경우는 contentDurationMap에 이미 기본값이 있으므로 스킵
        }
      }
    }

    // 6. dateAvailableTimeRanges 추출
    const dateAvailableTimeRanges = new Map<
      string,
      Array<{ start: string; end: string }>
    >();
    scheduleResult.daily_schedule.forEach((daily) => {
      if (
        daily.day_type === "학습일" &&
        daily.available_time_ranges.length > 0
      ) {
        dateAvailableTimeRanges.set(
          daily.date,
          daily.available_time_ranges.map((range) => ({
            start: range.start,
            end: range.end,
          }))
        );
      }
    });

    // 7. 스케줄러 호출 (플랜 생성)
    const { generatePlansFromGroup } = await import("@/lib/plan/scheduler");

    const scheduledPlans = generatePlansFromGroup(
      group,
      contents,
      safeExclusions,
      safeAcademySchedules,
      [], // blocks는 사용하지 않음 (dateAvailableTimeRanges 사용)
      undefined, // contentSubjects
      undefined, // riskIndexMap
      dateAvailableTimeRanges, // dateAvailableTimeRanges 추가
      dateTimeSlots,
      contentDurationMap
    );

    // 8. 콘텐츠 메타데이터 정보 조회 (denormalization용)
    const contentMetadataMap = new Map<
      string,
      {
        title?: string | null;
        subject?: string | null;
        subject_category?: string | null;
        category?: string | null;
      }
    >();

    console.log("[_previewPlansFromGroup] 콘텐츠 메타데이터 조회 시작", {
      contentsCount: contents.length,
      studentId,
      isAdminOrConsultant,
      viewingOtherStudent,
    });

    for (const content of contents) {
      const finalContentId =
        contentIdMap.get(content.content_id) || content.content_id;

      console.log("[_previewPlansFromGroup] 콘텐츠 처리 시작", {
        content_id: content.content_id,
        finalContentId,
        content_type: content.content_type,
      });

      if (content.content_type === "book") {
        // 학생 교재 조회 (master_content_id도 함께 조회)
        console.log("[_previewPlansFromGroup] 학생 교재 조회 시도", {
          finalContentId,
          studentId,
        });
        const { data: book, error: bookError } = await queryClient
          .from("books")
          .select("title, subject, subject_category, master_content_id")
          .eq("id", finalContentId)
          .eq("student_id", studentId)
          .maybeSingle();

        console.log("[_previewPlansFromGroup] 학생 교재 조회 결과", {
          found: !!book,
          book: book
            ? {
                title: book.title,
                subject: book.subject,
                subject_category: book.subject_category,
                master_content_id: book.master_content_id,
              }
            : null,
          error: bookError,
        });

        if (book) {
          const metadata = {
            title: book.title || null,
            subject: book.subject || null,
            subject_category: book.subject_category || null,
            category: null, // books 테이블에 content_category 컬럼이 없음
          };
          contentMetadataMap.set(content.content_id, metadata);
          console.log("[_previewPlansFromGroup] 학생 교재 메타데이터 저장", {
            content_id: content.content_id,
            metadata,
          });
        } else {
          // 학생 교재가 없으면 마스터 콘텐츠 ID로 학생 교재 찾기
          // content.master_content_id를 사용 (content.content_id는 학생 교재 ID)
          const masterContentId =
            content.master_content_id || content.content_id;
          console.log(
            "[_previewPlansFromGroup] 마스터 콘텐츠 ID로 학생 교재 찾기",
            {
              masterContentId,
              studentId,
              content_content_id: content.content_id,
              content_master_content_id: content.master_content_id,
            }
          );
          const { data: bookByMaster, error: bookByMasterError } =
            await queryClient
              .from("books")
              .select("title, subject, subject_category, master_content_id")
              .eq("student_id", studentId)
              .eq("master_content_id", masterContentId)
              .maybeSingle();

          console.log(
            "[_previewPlansFromGroup] 마스터 콘텐츠 ID로 학생 교재 찾기 결과",
            {
              found: !!bookByMaster,
              bookByMaster: bookByMaster
                ? {
                    title: bookByMaster.title,
                    subject: bookByMaster.subject,
                    subject_category: bookByMaster.subject_category,
                  }
                : null,
              error: bookByMasterError,
            }
          );

          if (bookByMaster) {
            const metadata = {
              title: bookByMaster.title || null,
              subject: bookByMaster.subject || null,
              subject_category: bookByMaster.subject_category || null,
              category: null, // books 테이블에 content_category 컬럼이 없음
            };
            contentMetadataMap.set(content.content_id, metadata);
            console.log(
              "[_previewPlansFromGroup] 마스터 콘텐츠 ID로 찾은 학생 교재 메타데이터 저장",
              {
                content_id: content.content_id,
                metadata,
              }
            );
          } else {
            // 마스터 교재 조회 (관리자가 조회할 때는 Admin 클라이언트 사용)
            // content.master_content_id를 사용 (content.content_id는 학생 교재 ID)
            const actualMasterContentId =
              content.master_content_id || content.content_id;
            console.log("[_previewPlansFromGroup] 마스터 교재 조회 시도", {
              masterContentId: actualMasterContentId,
              usingAdminClient: isAdminOrConsultant,
              content_content_id: content.content_id,
              content_master_content_id: content.master_content_id,
            });
            const { data: masterBook, error: masterBookError } =
              await masterQueryClient
                .from("master_books")
                .select("title, subject, subject_category, content_category")
                .eq("id", actualMasterContentId)
                .maybeSingle();

            console.log("[_previewPlansFromGroup] 마스터 교재 조회 결과", {
              found: !!masterBook,
              masterBook: masterBook
                ? {
                    title: masterBook.title,
                    subject: masterBook.subject,
                    subject_category: masterBook.subject_category,
                    content_category: masterBook.content_category,
                  }
                : null,
              error: masterBookError,
            });

            if (masterBook) {
              const metadata = {
                title: masterBook.title || null,
                subject: masterBook.subject || null,
                subject_category: masterBook.subject_category || null,
                category: masterBook.content_category || null,
              };
              contentMetadataMap.set(content.content_id, metadata);
              console.log(
                "[_previewPlansFromGroup] 마스터 교재 메타데이터 저장",
                {
                  content_id: content.content_id,
                  metadata,
                }
              );
            } else {
              console.warn(
                "[_previewPlansFromGroup] 교재 정보를 찾을 수 없음",
                {
                  content_id: content.content_id,
                  finalContentId,
                  masterContentId,
                }
              );
            }
          }
        }
      } else if (content.content_type === "lecture") {
        // 학생 강의 조회 (master_content_id도 함께 조회)
        console.log("[_previewPlansFromGroup] 학생 강의 조회 시도", {
          finalContentId,
          studentId,
        });
        const { data: lecture, error: lectureError } = await queryClient
          .from("lectures")
          .select("title, subject, subject_category, master_content_id")
          .eq("id", finalContentId)
          .eq("student_id", studentId)
          .maybeSingle();

        console.log("[_previewPlansFromGroup] 학생 강의 조회 결과", {
          found: !!lecture,
          lecture: lecture
            ? {
                title: lecture.title,
                subject: lecture.subject,
                subject_category: lecture.subject_category,
                master_content_id: lecture.master_content_id,
              }
            : null,
          error: lectureError,
        });

        if (lecture) {
          const metadata = {
            title: lecture.title || null,
            subject: lecture.subject || null,
            subject_category: lecture.subject_category || null,
            category: null, // lectures 테이블에 content_category 컬럼이 없을 수 있음
          };
          contentMetadataMap.set(content.content_id, metadata);
          console.log("[_previewPlansFromGroup] 학생 강의 메타데이터 저장", {
            content_id: content.content_id,
            metadata,
          });
        } else {
          // 학생 강의가 없으면 마스터 콘텐츠 ID로 학생 강의 찾기
          // content.master_content_id를 사용 (content.content_id는 학생 강의 ID)
          const masterContentId =
            content.master_content_id || content.content_id;
          console.log(
            "[_previewPlansFromGroup] 마스터 콘텐츠 ID로 학생 강의 찾기",
            {
              masterContentId,
              studentId,
              content_content_id: content.content_id,
              content_master_content_id: content.master_content_id,
            }
          );
          const { data: lectureByMaster, error: lectureByMasterError } =
            await queryClient
              .from("lectures")
              .select("title, subject, subject_category, master_content_id")
              .eq("student_id", studentId)
              .eq("master_content_id", masterContentId)
              .maybeSingle();

          console.log(
            "[_previewPlansFromGroup] 마스터 콘텐츠 ID로 학생 강의 찾기 결과",
            {
              found: !!lectureByMaster,
              lectureByMaster: lectureByMaster
                ? {
                    title: lectureByMaster.title,
                    subject: lectureByMaster.subject,
                    subject_category: lectureByMaster.subject_category,
                  }
                : null,
              error: lectureByMasterError,
            }
          );

          if (lectureByMaster) {
            const metadata = {
              title: lectureByMaster.title || null,
              subject: lectureByMaster.subject || null,
              subject_category: lectureByMaster.subject_category || null,
              category: null, // lectures 테이블에 content_category 컬럼이 없을 수 있음
            };
            contentMetadataMap.set(content.content_id, metadata);
            console.log(
              "[_previewPlansFromGroup] 마스터 콘텐츠 ID로 찾은 학생 강의 메타데이터 저장",
              {
                content_id: content.content_id,
                metadata,
              }
            );
          } else {
            // 마스터 강의 조회 (관리자가 조회할 때는 Admin 클라이언트 사용)
            // content.master_content_id를 사용 (content.content_id는 학생 강의 ID)
            const actualMasterContentId =
              content.master_content_id || content.content_id;
            console.log("[_previewPlansFromGroup] 마스터 강의 조회 시도", {
              masterContentId: actualMasterContentId,
              usingAdminClient: isAdminOrConsultant,
              content_content_id: content.content_id,
              content_master_content_id: content.master_content_id,
            });
            const { data: masterLecture, error: masterLectureError } =
              await masterQueryClient
                .from("master_lectures")
                .select("title, subject, subject_category, content_category")
                .eq("id", actualMasterContentId)
                .maybeSingle();

            console.log("[_previewPlansFromGroup] 마스터 강의 조회 결과", {
              found: !!masterLecture,
              masterLecture: masterLecture
                ? {
                    title: masterLecture.title,
                    subject: masterLecture.subject,
                    subject_category: masterLecture.subject_category,
                    content_category: masterLecture.content_category,
                  }
                : null,
              error: masterLectureError,
            });

            if (masterLecture) {
              const metadata = {
                title: masterLecture.title || null,
                subject: masterLecture.subject || null,
                subject_category: masterLecture.subject_category || null,
                category: masterLecture.content_category || null,
              };
              contentMetadataMap.set(content.content_id, metadata);
              console.log(
                "[_previewPlansFromGroup] 마스터 강의 메타데이터 저장",
                {
                  content_id: content.content_id,
                  metadata,
                }
              );
            } else {
              console.warn(
                "[_previewPlansFromGroup] 강의 정보를 찾을 수 없음",
                {
                  content_id: content.content_id,
                  finalContentId,
                  masterContentId,
                }
              );
            }
          }
        }
      } else if (content.content_type === "custom") {
        // 커스텀 콘텐츠 조회
        const { data: customContent } = await queryClient
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

    // 플랜 미리보기 데이터 생성 (실제 저장하지 않음)
    const previewPlans: Array<{
      plan_date: string;
      block_index: number;
      content_type: "book" | "lecture" | "custom";
      content_id: string;
      content_title: string | null;
      content_subject: string | null;
      content_subject_category: string | null;
      content_category: string | null;
      planned_start_page_or_time: number;
      planned_end_page_or_time: number;
      chapter: string | null;
      start_time: string | null;
      end_time: string | null;
      day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
      week: number | null;
      day: number | null;
      is_partial: boolean;
      is_continued: boolean;
      plan_number: number | null;
    }> = [];

    // 플랜 번호 부여를 위한 매핑 (논리적 플랜 키 -> 플랜 번호)
    const previewPlanNumberMap = new Map<string, number>();
    let previewNextPlanNumber = 1;

    // 날짜별로 그룹화
    const plansByDate = new Map<string, typeof scheduledPlans>();
    scheduledPlans.forEach((plan) => {
      if (!plansByDate.has(plan.plan_date)) {
        plansByDate.set(plan.plan_date, []);
      }
      plansByDate.get(plan.plan_date)!.push(plan);
    });

    // 각 날짜별로 처리 (assignPlanTimes를 사용하여 정확한 시간 계산)
    for (const [date, datePlans] of plansByDate.entries()) {
      // 해당 날짜의 time_slots에서 "학습시간" 슬롯만 필터링 및 정렬
      const timeSlotsForDate = dateTimeSlots.get(date) || [];
      const studyTimeSlots = timeSlotsForDate
        .filter((slot) => slot.type === "학습시간")
        .map((slot) => ({ start: slot.start, end: slot.end }))
        .sort((a, b) => {
          const aStart = a.start.split(":").map(Number);
          const bStart = b.start.split(":").map(Number);
          const aMinutes = aStart[0] * 60 + aStart[1];
          const bMinutes = bStart[0] * 60 + bStart[1];
          return aMinutes - bMinutes;
        });

      // 날짜별 메타데이터 가져오기
      const dateMetadata = dateMetadataMap.get(date) || {
        day_type: null,
        week_number: null,
      };
      const dayType = dateMetadata.day_type || "학습일";

      // 해당 날짜의 총 학습시간 계산
      const dailySchedule = scheduleResult.daily_schedule.find(
        (d) => d.date === date
      );
      const totalStudyHours = dailySchedule?.study_hours || 0;

      // assignPlanTimes를 사용하여 플랜 시간 배치 (쪼개진 플랜 처리 포함)
      const plansForAssign = datePlans.map((plan) => {
        const finalContentId =
          contentIdMap.get(plan.content_id) || plan.content_id;
        return {
          content_id: finalContentId,
          content_type: plan.content_type,
          planned_start_page_or_time: plan.planned_start_page_or_time,
          planned_end_page_or_time: plan.planned_end_page_or_time,
          chapter: plan.chapter || null,
          block_index: plan.block_index,
        };
      });

      // assignPlanTimes 호출하여 시간 세그먼트 계산
      const timeSegments = assignPlanTimes(
        plansForAssign,
        studyTimeSlots,
        contentDurationMap,
        dayType,
        totalStudyHours
      );

      let blockIndex = 1;

      // 각 세그먼트마다 별도의 레코드 생성
      for (const segment of timeSegments) {
        // 콘텐츠 메타데이터 조회
        const originalContentId =
          datePlans.find(
            (p) =>
              p.content_id === segment.plan.content_id ||
              contentIdMap.get(p.content_id) === segment.plan.content_id
          )?.content_id || segment.plan.content_id;
        const metadata = contentMetadataMap.get(originalContentId) || {};

        if (!metadata.title && !metadata.subject) {
          console.warn("[_previewPlansFromGroup] 메타데이터가 없는 플랜 발견", {
            originalContentId,
            segmentContentId: segment.plan.content_id,
            content_type: segment.plan.content_type,
            date,
            availableContentIds: Array.from(contentMetadataMap.keys()),
          });
        }

        // 주차별 일차(day) 계산
        let weekDay: number | null = null;
        if (dateMetadata.week_number) {
          if (group.scheduler_type === "1730_timetable") {
            const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
            const dayIndex = weekDates.indexOf(date);
            if (dayIndex >= 0) {
              weekDay = dayIndex + 1;
            }
          } else {
            const start = new Date(group.period_start);
            const current = new Date(date);
            start.setHours(0, 0, 0, 0);
            current.setHours(0, 0, 0, 0);
            const diffTime = current.getTime() - start.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            weekDay = (diffDays % 7) + 1;
          }
        }

        // 플랜 번호 부여 (같은 논리적 플랜은 같은 번호)
        const planKey = `${date}:${segment.plan.content_id}:${segment.plan.planned_start_page_or_time}:${segment.plan.planned_end_page_or_time}`;
        let planNumber: number | null = null;

        if (previewPlanNumberMap.has(planKey)) {
          planNumber = previewPlanNumberMap.get(planKey)!;
        } else {
          planNumber = previewNextPlanNumber;
          previewPlanNumberMap.set(planKey, planNumber);
          previewNextPlanNumber++;
        }

        previewPlans.push({
          plan_date: date,
          block_index: blockIndex,
          content_type: segment.plan.content_type,
          content_id: segment.plan.content_id,
          content_title: metadata?.title || null,
          content_subject: metadata?.subject || null,
          content_subject_category: metadata?.subject_category || null,
          content_category: metadata?.category || null,
          planned_start_page_or_time: segment.plan.planned_start_page_or_time,
          planned_end_page_or_time: segment.plan.planned_end_page_or_time,
          chapter: segment.plan.chapter || null,
          start_time: segment.start,
          end_time: segment.end,
          day_type: dateMetadata.day_type,
          week: dateMetadata.week_number,
          day: weekDay,
          is_partial: segment.isPartial,
          is_continued: segment.isContinued,
          plan_number: planNumber,
        });

        blockIndex++;
      }

      // 비학습 항목 저장 (학원일정, 이동시간, 점심시간, 자율학습)
      // 자율학습은 일반 학습일/복습일의 경우 time_slots에 포함되므로 여기서도 처리
      const nonStudySlots = timeSlotsForDate.filter(
        (slot) => slot.type !== "학습시간"
      );

      for (const slot of nonStudySlots) {
        let contentTitle: string;
        let contentSubject: string | null = null;

        if (slot.type === "학원일정") {
          contentTitle = slot.label || "학원일정";
          const dailySchedule = scheduleResult.daily_schedule.find(
            (d) => d.date === date
          );
          if (
            dailySchedule?.academy_schedules &&
            dailySchedule.academy_schedules.length > 0
          ) {
            const matchingAcademy = dailySchedule.academy_schedules.find(
              (academy) =>
                academy.start_time === slot.start &&
                academy.end_time === slot.end
            );
            if (matchingAcademy) {
              contentTitle = matchingAcademy.academy_name || "학원일정";
              if (matchingAcademy.subject) {
                contentSubject = matchingAcademy.subject;
              }
            }
          }
        } else if (slot.type === "이동시간") {
          contentTitle = "이동시간";
        } else if (slot.type === "점심시간") {
          contentTitle = "점심시간";
        } else {
          contentTitle = slot.label || slot.type;
        }

        // 주차별 일차(day) 계산
        let weekDay: number | null = null;
        if (dateMetadata.week_number) {
          if (group.scheduler_type === "1730_timetable") {
            const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
            const dayIndex = weekDates.indexOf(date);
            if (dayIndex >= 0) {
              weekDay = dayIndex + 1;
            }
          } else {
            const start = new Date(group.period_start);
            const current = new Date(date);
            start.setHours(0, 0, 0, 0);
            current.setHours(0, 0, 0, 0);
            const diffTime = current.getTime() - start.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            weekDay = (diffDays % 7) + 1;
          }
        }

        previewPlans.push({
          plan_date: date,
          block_index: blockIndex,
          content_type: "custom",
          content_id: "00000000-0000-0000-0000-000000000000", // 비학습 항목은 더미 UUID 사용
          content_title: contentTitle,
          content_subject: contentSubject,
          content_subject_category: null,
          content_category: slot.type,
          planned_start_page_or_time: 0,
          planned_end_page_or_time: 0,
          chapter: null,
          start_time: slot.start,
          end_time: slot.end,
          day_type: dateMetadata.day_type,
          week: dateMetadata.week_number,
          day: weekDay,
          is_partial: false,
          is_continued: false,
          plan_number: null,
        });

        blockIndex++;
      }

      // 지정휴일의 경우 배정된 학습시간을 자율학습으로 저장
      // enable_self_study_for_holidays가 true일 때만 자율학습 시간 배정
      const schedulerOptionsPreview = (group.scheduler_options as any) || {};
      const enableSelfStudyForHolidaysPreview =
        schedulerOptionsPreview.enable_self_study_for_holidays === true;
      if (
        dateMetadata.day_type === "지정휴일" &&
        studyTimeSlots.length > 0 &&
        enableSelfStudyForHolidaysPreview
      ) {
        for (const studySlot of studyTimeSlots) {
          // 주차별 일차(day) 계산
          let weekDay: number | null = null;
          if (dateMetadata.week_number) {
            if (group.scheduler_type === "1730_timetable") {
              const weekDates =
                weekDatesMap.get(dateMetadata.week_number) || [];
              const dayIndex = weekDates.indexOf(date);
              if (dayIndex >= 0) {
                weekDay = dayIndex + 1;
              }
            } else {
              const start = new Date(group.period_start);
              const current = new Date(date);
              start.setHours(0, 0, 0, 0);
              current.setHours(0, 0, 0, 0);
              const diffTime = current.getTime() - start.getTime();
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              weekDay = (diffDays % 7) + 1;
            }
          }

          previewPlans.push({
            plan_date: date,
            block_index: blockIndex,
            content_type: "custom",
            content_id: "00000000-0000-0000-0000-000000000000", // 자율학습은 더미 UUID 사용
            content_title: "자율학습",
            content_subject: null,
            content_subject_category: null,
            content_category: "자율학습",
            planned_start_page_or_time: 0,
            planned_end_page_or_time: 0,
            chapter: null,
            start_time: studySlot.start,
            end_time: studySlot.end,
            day_type: dateMetadata.day_type,
            week: dateMetadata.week_number,
            day: weekDay,
            is_partial: false,
            is_continued: false,
            plan_number: null,
          });

          blockIndex++;
        }
      }
    }

    console.log("[_previewPlansFromGroup] 플랜 미리보기 결과", {
      totalPlans: previewPlans.length,
      contentMetadataMapSize: contentMetadataMap.size,
      contentMetadataMapEntries: Array.from(contentMetadataMap.entries()).map(
        ([id, meta]) => ({
          content_id: id,
          title: meta.title,
          subject: meta.subject,
          subject_category: meta.subject_category,
        })
      ),
      samplePlans: previewPlans.slice(0, 5).map((p) => ({
        content_id: p.content_id,
        content_title: p.content_title,
        content_subject: p.content_subject,
        content_subject_category: p.content_subject_category,
        content_type: p.content_type,
      })),
      plansWithoutMetadata: previewPlans
        .filter((p) => !p.content_title && !p.content_subject)
        .slice(0, 10)
        .map((p) => ({
          content_id: p.content_id,
          content_type: p.content_type,
          plan_date: p.plan_date,
        })),
    });

    return { plans: previewPlans };
  } catch (error) {
    console.error("[planGroupActions] 플랜 미리보기 실패:", error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      error instanceof Error ? error.message : "플랜 미리보기에 실패했습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }
}

export const previewPlansFromGroupAction = withErrorHandling(
  _previewPlansFromGroup
);

async function _getPlansByGroupId(groupId: string): Promise<{
  plans: Array<{
    id: string;
    plan_date: string;
    block_index: number | null;
    content_type: string;
    content_id: string;
    chapter: string | null;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    completed_amount: number | null;
    is_reschedulable: boolean;
    sequence: number | null;
  }>;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_plan")
    .select(
      "id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,is_reschedulable,sequence"
    )
    .eq("plan_group_id", groupId)
    .eq("student_id", user.userId)
    .order("plan_date", { ascending: true })
    .order("block_index", { ascending: true });

  if (error) {
    console.error("[planGroupActions] 플랜 조회 실패", error);
    throw new AppError(
      error.message || "플랜 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  return {
    plans: (data || []).map((plan) => ({
      id: plan.id,
      plan_date: plan.plan_date || "",
      block_index: plan.block_index,
      content_type: plan.content_type || "",
      content_id: plan.content_id || "",
      chapter: plan.chapter,
      planned_start_page_or_time: plan.planned_start_page_or_time,
      planned_end_page_or_time: plan.planned_end_page_or_time,
      completed_amount: plan.completed_amount,
      is_reschedulable: plan.is_reschedulable || false,
      sequence: (plan as any).sequence ?? null,
    })),
  };
}

export const getPlansByGroupIdAction = withErrorHandling(_getPlansByGroupId);

async function _checkPlansExist(groupId: string): Promise<{
  hasPlans: boolean;
  planCount: number;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("student_plan")
    .select("*", { count: "exact", head: true })
    .eq("plan_group_id", groupId)
    .eq("student_id", user.userId);

  if (error) {
    console.error("[planGroupActions] 플랜 개수 확인 실패", error);
    throw new AppError(
      error.message || "플랜 개수 확인에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  return {
    hasPlans: (count ?? 0) > 0,
    planCount: count ?? 0,
  };
}

export const checkPlansExistAction = withErrorHandling(_checkPlansExist);

async function _getActivePlanGroups(
  excludeGroupId?: string
): Promise<Array<{ id: string; name: string | null }>> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("plan_groups")
    .select("id, name")
    .eq("student_id", user.userId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (excludeGroupId) {
    query = query.neq("id", excludeGroupId);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError(
      "활성 플랜 그룹 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  return data || [];
}

export const getActivePlanGroups = withErrorHandling(_getActivePlanGroups);
