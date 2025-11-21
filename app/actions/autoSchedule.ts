"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getSchoolScoreSummary,
  getMockScoreSummary,
  getRiskIndexBySubject,
} from "@/lib/scheduler/scoreLoader";
import {
  calculatePriorityScore,
  validatePriorityConfig,
  type PriorityConfig,
} from "@/lib/scheduler/priorityEngine";
import { recordHistory } from "@/lib/history/record";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { validateFormData, autoScheduleSchema } from "@/lib/validation/schemas";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type ContentType = "book" | "lecture" | "custom";

type BlockRow = {
  id: string;
  day_of_week?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  block_index?: number | null;
};

type BookRow = {
  id: string;
  title?: string | null;
  total_pages?: number | null;
  difficulty_level?: string | null;
  subject?: string | null;
  created_at?: string | null;
};

type LectureRow = {
  id: string;
  title?: string | null;
  duration?: number | null;
  difficulty_level?: string | null;
  subject?: string | null;
  created_at?: string | null;
};

type CustomRow = {
  id: string;
  title?: string | null;
  total_page_or_time?: number | null;
  difficulty_level?: string | null;
  subject?: string | null;
  created_at?: string | null;
};

type ProgressRow = {
  content_type?: string | null;
  content_id?: string | null;
  progress?: number | null;
  last_updated?: string | null;
};

type ScoreRow = {
  id: string;
  course?: string | null;
  course_detail?: string | null;
  grade?: number | null;
  raw_score?: number | null;
  test_date?: string | null;
  semester?: string | null;
};

type SubjectScoreInfo = {
  recentGrade: number; // 최근 등급 (낮을수록 좋음, 1이 최고)
  averageGrade: number; // 평균 등급
  gradeVariance: number; // 등급 편차 (표준편차)
  scoreVariance: number; // 원점수 편차 (표준편차)
  nextTestDate: string | null; // 다음 시험일
  daysUntilNextTest: number | null; // 다음 시험까지 남은 일수
  semesterUrgency: number; // 학기 종료 임박도 (0-100, 높을수록 급함)
};

type ContentItem = {
  id: string;
  type: ContentType;
  total: number;
  difficulty: string | null;
  progress: number;
  lastUpdated: string | null;
  currentStart: number; // 현재 시작 위치 (페이지/시간)
  subject: string | null; // 과목명
  scoreInfo: SubjectScoreInfo | null; // 성적 정보 (기존 호환용)
  schoolScore?: any; // 내신 성적 요약
  mockScore?: any; // 모의고사 성적 요약
  riskIndex?: any; // Risk Index
  priorityScore?: number; // 계산된 Priority Score
};

type PlanPayload = {
  student_id?: string;
  plan_date: string;
  block_index: number;
  content_type: ContentType;
  content_id: string;
  chapter: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  is_reschedulable: boolean;
};

const DIFFICULTY_ORDER: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

async function _createAutoSchedule(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // 입력 검증 (선택적 필드들이 많아서 유연하게 처리)
  const validation = validateFormData(formData, autoScheduleSchema);
  if (!validation.success) {
    const firstError = validation.errors.issues[0];
    throw new AppError(
      firstError?.message ?? "입력값을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const validatedData = validation.data;

  // 옵션 파싱 (기본값 적용)
  const periodInput = validatedData.period ?? 7;
  const singleDateInput = validatedData.single_date;
  const difficultyWeightInput = validatedData.difficulty_weight ?? 50;
  const progressWeightInput = validatedData.progress_weight ?? 50;
  const scoreWeightInput = validatedData.score_weight ?? 0;

  // 기간 처리: single_date가 있으면 1일로 처리
  let period: number;
  let startDate: Date;
  
  if (singleDateInput) {
    period = 1;
    const parsedDate = new Date(`${singleDateInput}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new AppError("올바른 날짜 형식을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
    }
    startDate = parsedDate;
    startDate.setHours(0, 0, 0, 0);
  } else {
    if (periodInput !== 1 && periodInput !== 7 && periodInput !== 30) {
      throw new AppError("생성 기간은 1일, 7일, 30일 중 하나를 선택해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
    }
    period = periodInput;
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  }

  // 가중치 검증
  const difficultyWeight = difficultyWeightInput;
  const progressWeight = progressWeightInput;
  const scoreWeight = scoreWeightInput;
  
  if (
    difficultyWeight < 0 ||
    difficultyWeight > 100 ||
    progressWeight < 0 ||
    progressWeight > 100 ||
    scoreWeight < 0 ||
    scoreWeight > 100
  ) {
    throw new AppError("가중치는 0-100 사이의 값이어야 합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const allowConsecutive = validatedData.allow_consecutive === "on";
  const conflictMode = validatedData.conflict_mode === "overwrite" ? "overwrite" : "empty_only";
  const enableScoreBased = validatedData.enable_score_based === "on";
  const weakSubjectFocus = validatedData.weak_subject_focus === "on";
  const examUrgencyEnabled = validatedData.exam_urgency_enabled === "on";

  try {
    // 1. 필요한 데이터 조회
    const [blocks, books, lectures, customContents, progressMap] =
      await Promise.all([
        fetchAllBlocks(supabase, user.id),
        fetchBooks(supabase, user.id),
        fetchLectures(supabase, user.id),
        fetchCustomContents(supabase, user.id),
        fetchProgressMap(supabase, user.id),
      ]);

    // 2. 성적 데이터 조회 (새로운 방식)
    let schoolScoreSummary = new Map();
    let mockScoreSummary = new Map();
    let riskIndexMap = new Map();

    if (enableScoreBased) {
      try {
        [schoolScoreSummary, mockScoreSummary, riskIndexMap] = await Promise.all([
          getSchoolScoreSummary(user.id),
          getMockScoreSummary(user.id),
          getRiskIndexBySubject(user.id),
        ]);
      } catch (error) {
        console.error("[autoSchedule] 성적 데이터 로드 실패", error);
        // 성적 데이터 로드 실패해도 계속 진행 (기본값 사용)
      }
    }

    // 3. 기존 플랜 조회 (충돌 처리용)
    const existingPlansMap = await fetchExistingPlansMap(
      supabase,
      user.id,
      startDate,
      period
    );

    // 4. Priority Config 생성
    const priorityConfig: PriorityConfig = {
      riskIndexWeight: scoreWeight * 0.35, // risk_index 가중치
      scoreWeight: scoreWeight * 0.25, // 성적 요소 가중치
      progressWeight: progressWeight,
      difficultyWeight: difficultyWeight,
      examUrgencyWeight: examUrgencyEnabled ? 10 : 0,
      otherWeight: 5,
    };
    const validatedConfig = validatePriorityConfig(priorityConfig);

    // 5. 콘텐츠 통합 및 정렬 (새로운 priority engine 사용)
    const contents = prepareContentsWithPriority(
      books,
      lectures,
      customContents,
      progressMap,
      validatedConfig,
      schoolScoreSummary,
      mockScoreSummary,
      riskIndexMap,
      weakSubjectFocus,
      examUrgencyEnabled,
      startDate
    );

    if (contents.length === 0) {
      console.error("[autoSchedule] 콘텐츠가 없음");
      throw new AppError("학습할 콘텐츠가 없습니다. 먼저 콘텐츠를 등록해주세요.", ErrorCode.BUSINESS_LOGIC_ERROR, 400, true);
    }

    if (blocks.length === 0) {
      console.error("[autoSchedule] 시간 블록이 없음");
      throw new AppError("시간 블록이 없습니다. 먼저 시간 블록을 설정해주세요.", ErrorCode.BUSINESS_LOGIC_ERROR, 400, true);
    }

    console.log(`[autoSchedule] 콘텐츠 ${contents.length}개, 블록 ${blocks.length}개, 기간 ${period}일`);

    // 4. 취약과목 식별 (최소 하루 1블록 배정용)
    const weakSubjects = new Set<string>();
    contents.forEach((c) => {
      if (c.riskIndex && c.riskIndex.riskScore >= 30 && c.subject) {
        weakSubjects.add(c.subject);
      }
    });

    // 5. 기간 동안 플랜 생성
    const plans: PlanPayload[] = [];
    const plansToDelete: string[] = []; // 덮어쓰기 모드일 때 삭제할 플랜 ID
    let lastContentId: string | null = null; // 연속 블록 체크용
    let inProgressIndex = 0; // 진행 중 콘텐츠 순환 인덱스
    let completedIndex = 0; // 완료된 콘텐츠 순환 인덱스
    const weakSubjectAssignedPerDay = new Map<string, Set<string>>(); // 날짜별 취약과목 배정 추적

    // 각 콘텐츠의 현재 시작 위치 초기화 (진행률 기반)
    contents.forEach((content) => {
      content.currentStart = Math.floor((content.total * content.progress) / 100);
    });

    // 진행 중 콘텐츠 우선 분리 (진행률 기반)
    const highPriorityContents = contents.filter((c) => c.progress < 30); // 진행률 30% 미만: 우선 배정
    const inProgressContents = contents.filter((c) => c.progress >= 30 && c.progress < 100);
    const nearCompletionContents = contents.filter((c) => c.progress >= 80 && c.progress < 100); // 진행률 80% 이상: 빈틈 배정
    const completedContents = contents.filter((c) => c.progress >= 100);

    // 기간 동안 각 날짜 순회
    for (let dayOffset = 0; dayOffset < period; dayOffset++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + dayOffset);
      const dayOfWeek = currentDate.getDay();
      const planDate = currentDate.toISOString().slice(0, 10);

      // 해당 요일의 블록 조회
      const dayBlocks = blocks.filter(
        (block) =>
          typeof block.day_of_week === "number" &&
          block.day_of_week === dayOfWeek
      );

      // 블록 인덱스 순으로 정렬
      dayBlocks.sort((a, b) => {
        const aIndex =
          typeof a.block_index === "number" && a.block_index > 0
            ? a.block_index
            : 999;
        const bIndex =
          typeof b.block_index === "number" && b.block_index > 0
            ? b.block_index
            : 999;
        return aIndex - bIndex;
      });

      // 각 블록에 콘텐츠 할당
      for (const block of dayBlocks) {
        const blockIndex =
          typeof block.block_index === "number" && block.block_index > 0
            ? block.block_index
            : 1;

        const blockKey = `${planDate}:${blockIndex}`;
        const existingPlan = existingPlansMap[blockKey];

        // 충돌 처리
        if (existingPlan) {
          if (conflictMode === "empty_only") {
            // 비어있는 블록만 생성 모드: 기존 플랜이 있으면 스킵
            continue;
          } else {
            // 덮어쓰기 모드: 기존 플랜 삭제 예약
            plansToDelete.push(existingPlan.id);
          }
        }

        // 콘텐츠 선택 로직
        let selectedContent: ContentItem | null = null;

        // 취약과목 최소 배정 체크 (하루 1블록 이상)
        const weakSubjectsForToday = weakSubjectAssignedPerDay.get(planDate) ?? new Set<string>();
        if (weakSubjects.size > 0 && weakSubjectsForToday.size < weakSubjects.size) {
          // 아직 배정되지 않은 취약과목 찾기
          const unassignedWeakSubjects = Array.from(weakSubjects).filter(
            (subject) => !weakSubjectsForToday.has(subject)
          );
          
          if (unassignedWeakSubjects.length > 0) {
            // 해당 과목의 콘텐츠 중 우선순위가 높은 것 선택
            const weakSubjectContents = contents.filter(
              (c) => c.subject && unassignedWeakSubjects.includes(c.subject)
            );
            
            if (weakSubjectContents.length > 0) {
              // Priority Score가 높은 순으로 정렬
              weakSubjectContents.sort((a, b) => {
                const aPriority = a.priorityScore ?? 0;
                const bPriority = b.priorityScore ?? 0;
                return bPriority - aPriority;
              });
              
              selectedContent = weakSubjectContents[0];
              if (selectedContent && selectedContent.subject) {
                weakSubjectsForToday.add(selectedContent.subject);
                weakSubjectAssignedPerDay.set(planDate, weakSubjectsForToday);
              }
            }
          }
        }

        // 취약과목 배정이 없으면 일반 로직 진행
        if (!selectedContent) {
          // 1. 진행률 30% 미만 콘텐츠 우선 배정
          if (highPriorityContents.length > 0) {
            const availableHighPriority = highPriorityContents
              .filter((c) => c.currentStart < c.total)
              .sort((a, b) => {
                const aPriority = a.priorityScore ?? 0;
                const bPriority = b.priorityScore ?? 0;
                return bPriority - aPriority;
              });
            
            if (availableHighPriority.length > 0) {
              selectedContent = availableHighPriority[0];
            }
          }

          // 2. 연속 블록 허용 옵션 체크
          if (!selectedContent && allowConsecutive && lastContentId) {
            const allInProgress = [...highPriorityContents, ...inProgressContents];
            const lastContent = allInProgress.find(
              (c) => c.id === lastContentId && c.progress < 100
            );
            if (lastContent && lastContent.currentStart < lastContent.total) {
              selectedContent = lastContent;
            }
          }

          // 3. 진행 중 콘텐츠 (30-100%) 배정
          if (!selectedContent && inProgressContents.length > 0) {
            const availableContents = inProgressContents
              .filter((c) => c.currentStart < c.total)
              .sort((a, b) => {
                const aPriority = a.priorityScore ?? 0;
                const bPriority = b.priorityScore ?? 0;
                return bPriority - aPriority;
              });

            if (availableContents.length > 0) {
              selectedContent = availableContents[0];
              inProgressIndex = (inProgressIndex + 1) % inProgressContents.length;
            } else {
              // 모든 진행 중 콘텐츠가 소진되면 다시 시작
              inProgressContents.forEach((c) => {
                c.currentStart = Math.floor((c.total * c.progress) / 100);
              });
              inProgressIndex = 0;
              if (inProgressContents.length > 0) {
                selectedContent = inProgressContents[0];
                inProgressIndex++;
              }
            }
          }

          // 4. 진행률 80% 이상 콘텐츠 (빈틈 배정 모드)
          if (!selectedContent && nearCompletionContents.length > 0) {
            const availableNearCompletion = nearCompletionContents
              .filter((c) => c.currentStart < c.total)
              .sort((a, b) => {
                const aPriority = a.priorityScore ?? 0;
                const bPriority = b.priorityScore ?? 0;
                return bPriority - aPriority;
              });
            
            if (availableNearCompletion.length > 0) {
              selectedContent = availableNearCompletion[0];
            }
          }

          // 5. 완료된 콘텐츠에서 선택 (Priority Score 순)
          if (!selectedContent && completedContents.length > 0) {
            const sortedCompleted = [...completedContents].sort((a, b) => {
              const aPriority = a.priorityScore ?? 0;
              const bPriority = b.priorityScore ?? 0;
              return bPriority - aPriority;
            });
            selectedContent = sortedCompleted[completedIndex % sortedCompleted.length];
            completedIndex++;
          }
        }

        if (!selectedContent || contents.length === 0) {
          continue;
        }

        // 시작/종료 범위 계산
        const { start, end } = calculateRange(
          selectedContent,
          selectedContent.currentStart,
          selectedContent.total
        );

        // 플랜 생성
        plans.push({
          student_id: user.id,
          plan_date: planDate,
          block_index: blockIndex,
          content_type: selectedContent.type,
          content_id: selectedContent.id,
          chapter: null,
          planned_start_page_or_time: start,
          planned_end_page_or_time: end,
          is_reschedulable: true,
        });

        // 현재 시작 위치 업데이트
        selectedContent.currentStart = end;

        // 연속 블록 체크용 업데이트
        if (allowConsecutive) {
          lastContentId = selectedContent.id;
        } else {
          lastContentId = null;
        }
      }

      // 날짜가 바뀌면 연속 체크 리셋 (선택적)
      if (!allowConsecutive) {
        lastContentId = null;
      }
    }

    // 5. 기존 플랜 삭제 (덮어쓰기 모드)
    if (conflictMode === "overwrite" && plansToDelete.length > 0) {
      const deleteBatchSize = 100;
      for (let i = 0; i < plansToDelete.length; i += deleteBatchSize) {
        const deleteBatch = plansToDelete.slice(i, i + deleteBatchSize);

        let { error } = await supabase
          .from("student_plan")
          .delete()
          .in("id", deleteBatch)
          .eq("student_id", user.id);

        if (error && error.code === "42703") {
          ({ error } = await supabase
            .from("student_plan")
            .delete()
            .in("id", deleteBatch));
        }

        if (error) {
          throw new AppError(`기존 플랜 삭제 실패: ${error.message}`, ErrorCode.DATABASE_ERROR, 500, true);
        }
      }
    }

    // 6. Bulk insert
    if (plans.length === 0) {
      console.error("[autoSchedule] 생성된 플랜이 없음 - 콘텐츠:", contents.length, "블록:", blocks.length);
      throw new AppError("생성된 플랜이 없습니다. 시간 블록과 콘텐츠가 일치하는지 확인해주세요.", ErrorCode.BUSINESS_LOGIC_ERROR, 400, true);
    }

    console.log(`[autoSchedule] ${plans.length}개 플랜 생성 완료, 취약과목 ${weakSubjects.size}개`);

    // 100개씩 나누어 insert (Supabase 제한 고려)
    const batchSize = 100;
    for (let i = 0; i < plans.length; i += batchSize) {
      const batch = plans.slice(i, i + batchSize);

      let { error } = await supabase.from("student_plan").insert(batch);

      if (error && error.code === "42703") {
        // student_id 제거하고 재시도
        const fallbackBatch = batch.map(({ student_id: _studentId, ...rest }) => rest);
        ({ error } = await supabase.from("student_plan").insert(fallbackBatch));
      }

      if (error) {
        throw new AppError(`플랜 생성 실패: ${error.message}`, ErrorCode.DATABASE_ERROR, 500, true);
      }
    }

    // 결과 통계 계산
    const weakSubjectsAssigned = new Set<string>();
    contents.forEach((c) => {
      if (c.subject && riskIndexMap.has(c.subject)) {
        const risk = riskIndexMap.get(c.subject);
        if (risk && risk.riskScore >= 30) {
          weakSubjectsAssigned.add(c.subject);
        }
      }
    });

    // 히스토리 기록
    await recordHistory(supabase, user.id, "auto_schedule_generated", {
      plans_count: plans.length,
      start_date: startDate,
      period_days: period,
      weak_subjects_count: weakSubjectsAssigned.size,
      score_based: enableScoreBased,
    });

    revalidatePath("/plan");
    revalidatePath("/scheduler");
    // redirect는 서버 액션에서 직접 처리
    // useFormState와 함께 사용하기 위해 성공 시에도 redirect
    redirect(
      `/scheduler?success=true&created=${plans.length}&weakSubjects=${weakSubjectsAssigned.size}&scoreBased=${enableScoreBased ? "true" : "false"}`
    );
  } catch (error) {
    console.error("[autoSchedule] 자동 스케줄 생성 실패", error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("자동 스케줄 생성 중 오류가 발생했습니다.", ErrorCode.INTERNAL_ERROR, 500, true);
  }
}

export const createAutoSchedule = withErrorHandling(_createAutoSchedule);

async function fetchAllBlocks(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<BlockRow[]> {
  try {
    const selectBlocks = () =>
      supabase
        .from("student_block_schedule")
        .select("id,day_of_week,start_time,end_time,block_index")
        .order("day_of_week", { ascending: true })
        .order("block_index", { ascending: true });

    let { data, error } = await selectBlocks().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectBlocks());
    }
    if (error) throw error;

    return (data as BlockRow[] | null) ?? [];
  } catch (error) {
    console.error("[autoSchedule] 블록 조회 실패", error);
    return [];
  }
}

async function fetchBooks(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<BookRow[]> {
  try {
    const selectBooks = () =>
      supabase
        .from("books")
        .select("id,title,total_pages,difficulty_level,subject,created_at")
        .order("created_at", { ascending: true });

    let { data, error } = await selectBooks().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectBooks());
    }
    if (error) throw error;

    return (data as BookRow[] | null) ?? [];
  } catch (error) {
    console.error("[autoSchedule] 책 조회 실패", error);
    return [];
  }
}

async function fetchLectures(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<LectureRow[]> {
  try {
    const selectLectures = () =>
      supabase
        .from("lectures")
        .select("id,title,duration,difficulty_level,subject,created_at")
        .order("created_at", { ascending: true });

    let { data, error } = await selectLectures().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectLectures());
    }
    if (error) throw error;

    return (data as LectureRow[] | null) ?? [];
  } catch (error) {
    console.error("[autoSchedule] 강의 조회 실패", error);
    return [];
  }
}

async function fetchCustomContents(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<CustomRow[]> {
  try {
    const selectCustom = () =>
      supabase
        .from("student_custom_contents")
        .select("id,title,total_page_or_time,difficulty_level,subject,created_at")
        .order("created_at", { ascending: true });

    let { data, error } = await selectCustom().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectCustom());
    }
    if (error) throw error;

    return (data as CustomRow[] | null) ?? [];
  } catch (error) {
    console.error("[autoSchedule] 커스텀 콘텐츠 조회 실패", error);
    return [];
  }
}

async function fetchScores(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<ScoreRow[]> {
  try {
    const selectScores = () =>
      supabase
        .from("student_scores")
        .select("id,course,course_detail,grade,raw_score,test_date,semester")
        .order("test_date", { ascending: false });

    let { data, error } = await selectScores().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectScores());
    }
    if (error) throw error;

    return (data as ScoreRow[] | null) ?? [];
  } catch (error) {
    console.error("[autoSchedule] 성적 조회 실패", error);
    return [];
  }
}

async function fetchProgressMap(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<Record<string, ProgressRow>> {
  try {
    const selectProgress = () =>
      supabase
        .from("student_content_progress")
        .select("content_type,content_id,progress,last_updated");

    let { data, error } = await selectProgress().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectProgress());
    }
    if (error) throw error;

    const rows = (data as ProgressRow[] | null) ?? [];
    return rows.reduce<Record<string, ProgressRow>>((acc, row) => {
      if (row.content_type && row.content_id) {
        const key = `${row.content_type}:${row.content_id}`;
        acc[key] = row;
      }
      return acc;
    }, {});
  } catch (error) {
    console.error("[autoSchedule] 진행률 조회 실패", error);
    return {};
  }
}

async function fetchExistingPlansMap(
  supabase: SupabaseServerClient,
  studentId: string,
  startDate: Date,
  period: number
): Promise<Record<string, { id: string }>> {
  try {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + period - 1);
    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const selectPlans = () =>
      supabase
        .from("student_plan")
        .select("id,plan_date,block_index")
        .gte("plan_date", startDateStr)
        .lte("plan_date", endDateStr);

    let { data, error } = await selectPlans().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectPlans());
    }
    if (error) throw error;

    const rows = (data as Array<{
      id: string;
      plan_date?: string | null;
      block_index?: number | null;
    }> | null) ?? [];

    const map: Record<string, { id: string }> = {};
    rows.forEach((row) => {
      if (row.plan_date && row.block_index) {
        const key = `${row.plan_date}:${row.block_index}`;
        map[key] = { id: row.id };
      }
    });

    return map;
  } catch (error) {
    console.error("[autoSchedule] 기존 플랜 조회 실패", error);
    return {};
  }
}

// 성적 정보 매핑 (과목명 -> 성적 정보)
function buildScoreMap(
  scores: ScoreRow[],
  currentDate: Date
): Map<string, SubjectScoreInfo> {
  const map = new Map<string, SubjectScoreInfo>();

  // 과목별로 그룹화
  const subjectMap = new Map<string, ScoreRow[]>();
  scores.forEach((score) => {
    if (!score.course || score.grade === null) return;
    const key = score.course.toLowerCase().trim();
    const existing = subjectMap.get(key) ?? [];
    existing.push(score);
    subjectMap.set(key, existing);
  });

  subjectMap.forEach((subjectScores, subjectKey) => {
    // 날짜순 정렬 (최신순)
    const sortedScores = subjectScores.sort((a, b) => {
      const dateA = a.test_date ? new Date(a.test_date).getTime() : 0;
      const dateB = b.test_date ? new Date(b.test_date).getTime() : 0;
      return dateB - dateA;
    });

    const validGrades = sortedScores
      .map((s) => s.grade)
      .filter((g): g is number => g !== null && g !== undefined);
    const validRawScores = sortedScores
      .map((s) => s.raw_score)
      .filter((r): r is number => r !== null && r !== undefined);

    if (validGrades.length === 0) return;

    // 최근 등급
    const recentGrade = validGrades[0];

    // 평균 등급
    const averageGrade =
      validGrades.reduce((a, b) => a + b, 0) / validGrades.length;

    // 등급 편차 계산
    const gradeMean = averageGrade;
    const gradeVariance =
      validGrades.length > 1
        ? validGrades.reduce((sum, grade) => {
            return sum + Math.pow(grade - gradeMean, 2);
          }, 0) / validGrades.length
        : 0;
    const gradeStdDev = Math.sqrt(gradeVariance);

    // 원점수 편차 계산
    let scoreStdDev = 0;
    if (validRawScores.length >= 2) {
      const scoreMean =
        validRawScores.reduce((a, b) => a + b, 0) / validRawScores.length;
      const scoreVariance =
        validRawScores.reduce((sum, score) => {
          return sum + Math.pow(score - scoreMean, 2);
        }, 0) / validRawScores.length;
      scoreStdDev = Math.sqrt(scoreVariance);
    }

    // 다음 시험일 찾기 (현재 날짜 이후)
    const futureScores = sortedScores.filter((s) => {
      if (!s.test_date) return false;
      const testDate = new Date(s.test_date);
      testDate.setHours(0, 0, 0, 0);
      return testDate >= currentDate;
    });

    let nextTestDate: string | null = null;
    let daysUntilNextTest: number | null = null;
    if (futureScores.length > 0) {
      // 가장 가까운 미래 시험일
      const closestFuture = futureScores.reduce((closest, current) => {
        const closestDate = closest.test_date
          ? new Date(closest.test_date).getTime()
          : Infinity;
        const currentDate = current.test_date
          ? new Date(current.test_date).getTime()
          : Infinity;
        return currentDate < closestDate ? current : closest;
      });
      nextTestDate = closestFuture.test_date ?? null;
      if (nextTestDate) {
        const testDate = new Date(nextTestDate);
        testDate.setHours(0, 0, 0, 0);
        const diffTime = testDate.getTime() - currentDate.getTime();
        daysUntilNextTest = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    // 학기 종료 임박도 계산 (다음 시험일까지 남은 일수 기반)
    // 30일 이내면 급함, 60일 이내면 보통, 그 외는 여유
    let semesterUrgency = 0;
    if (daysUntilNextTest !== null) {
      if (daysUntilNextTest <= 30) {
        semesterUrgency = 100 - (daysUntilNextTest / 30) * 50; // 30일 이내: 50-100
      } else if (daysUntilNextTest <= 60) {
        semesterUrgency = 50 - ((daysUntilNextTest - 30) / 30) * 30; // 30-60일: 20-50
      } else {
        semesterUrgency = Math.max(0, 20 - (daysUntilNextTest - 60) / 10); // 60일 이후: 0-20
      }
    }

    map.set(subjectKey, {
      recentGrade,
      averageGrade,
      gradeVariance: gradeStdDev,
      scoreVariance: scoreStdDev,
      nextTestDate,
      daysUntilNextTest,
      semesterUrgency,
    });
  });

  return map;
}

function prepareContentsWithPriority(
  books: BookRow[],
  lectures: LectureRow[],
  customContents: CustomRow[],
  progressMap: Record<string, ProgressRow>,
  priorityConfig: PriorityConfig,
  schoolScoreSummary: Map<string, any>,
  mockScoreSummary: Map<string, any>,
  riskIndexMap: Map<string, any>,
  weakSubjectFocus: boolean,
  examUrgencyEnabled: boolean,
  currentDate: Date
): ContentItem[] {
  const contents: ContentItem[] = [];

  // 책 추가
  books.forEach((book) => {
    if (book.total_pages && book.total_pages > 0) {
      const key = `book:${book.id}`;
      const progress = progressMap[key]?.progress ?? 0;
      const subject = book.subject?.toLowerCase().trim() ?? null;
      
      // 성적 정보 매핑 (기존 방식과 호환)
      const schoolScore = subject ? schoolScoreSummary.get(subject) : null;
      const mockScore = subject ? mockScoreSummary.get(subject) : null;
      const riskIndex = subject ? riskIndexMap.get(subject) : null;
      
      const scoreInfo: SubjectScoreInfo | null = schoolScore
        ? {
            recentGrade: schoolScore.recentGrade,
            averageGrade: schoolScore.averageGrade,
            gradeVariance: schoolScore.gradeVariance,
            scoreVariance: schoolScore.scoreVariance,
            nextTestDate: schoolScore.nextTestDate,
            daysUntilNextTest: schoolScore.daysUntilNextTest,
            semesterUrgency: schoolScore.semesterUrgency,
          }
        : null;

      contents.push({
        id: book.id,
        type: "book",
        total: book.total_pages,
        difficulty: book.difficulty_level ?? null,
        progress,
        lastUpdated: progressMap[key]?.last_updated ?? null,
        currentStart: 0,
        subject,
        scoreInfo,
        // 새로운 필드 추가 (priority 계산용)
        schoolScore,
        mockScore,
        riskIndex,
      });
    }
  });

  // 강의 추가
  lectures.forEach((lecture) => {
    if (lecture.duration && lecture.duration > 0) {
      const key = `lecture:${lecture.id}`;
      const progress = progressMap[key]?.progress ?? 0;
      const subject = lecture.subject?.toLowerCase().trim() ?? null;
      
      const schoolScore = subject ? schoolScoreSummary.get(subject) : null;
      const mockScore = subject ? mockScoreSummary.get(subject) : null;
      const riskIndex = subject ? riskIndexMap.get(subject) : null;
      
      const scoreInfo: SubjectScoreInfo | null = schoolScore
        ? {
            recentGrade: schoolScore.recentGrade,
            averageGrade: schoolScore.averageGrade,
            gradeVariance: schoolScore.gradeVariance,
            scoreVariance: schoolScore.scoreVariance,
            nextTestDate: schoolScore.nextTestDate,
            daysUntilNextTest: schoolScore.daysUntilNextTest,
            semesterUrgency: schoolScore.semesterUrgency,
          }
        : null;

      contents.push({
        id: lecture.id,
        type: "lecture",
        total: lecture.duration,
        difficulty: lecture.difficulty_level ?? null,
        progress,
        lastUpdated: progressMap[key]?.last_updated ?? null,
        currentStart: 0,
        subject,
        scoreInfo,
        schoolScore,
        mockScore,
        riskIndex,
      });
    }
  });

  // 커스텀 콘텐츠 추가
  customContents.forEach((custom) => {
    if (custom.total_page_or_time && custom.total_page_or_time > 0) {
      const key = `custom:${custom.id}`;
      const progress = progressMap[key]?.progress ?? 0;
      const subject = custom.subject?.toLowerCase().trim() ?? null;
      
      const schoolScore = subject ? schoolScoreSummary.get(subject) : null;
      const mockScore = subject ? mockScoreSummary.get(subject) : null;
      const riskIndex = subject ? riskIndexMap.get(subject) : null;
      
      const scoreInfo: SubjectScoreInfo | null = schoolScore
        ? {
            recentGrade: schoolScore.recentGrade,
            averageGrade: schoolScore.averageGrade,
            gradeVariance: schoolScore.gradeVariance,
            scoreVariance: schoolScore.scoreVariance,
            nextTestDate: schoolScore.nextTestDate,
            daysUntilNextTest: schoolScore.daysUntilNextTest,
            semesterUrgency: schoolScore.semesterUrgency,
          }
        : null;

      contents.push({
        id: custom.id,
        type: "custom",
        total: custom.total_page_or_time,
        difficulty: custom.difficulty_level ?? null,
        progress,
        lastUpdated: progressMap[key]?.last_updated ?? null,
        currentStart: 0,
        subject,
        scoreInfo,
        schoolScore,
        mockScore,
        riskIndex,
      });
    }
  });

  // Priority Score 계산 및 할당
  contents.forEach((content) => {
    const schoolScore = content.schoolScore;
    const mockScore = content.mockScore;
    const riskIndex = content.riskIndex;

    // 시험 임박도 계산
    let examUrgency = 0;
    if (examUrgencyEnabled) {
      if (schoolScore?.daysUntilNextTest !== null && schoolScore?.daysUntilNextTest !== undefined) {
        const days = schoolScore.daysUntilNextTest;
        if (days <= 7) {
          examUrgency = 100;
        } else if (days <= 14) {
          examUrgency = 80;
        } else if (days <= 30) {
          examUrgency = 50;
        } else if (days <= 60) {
          examUrgency = 30;
        }
      }
      if (mockScore?.daysUntilNextTest !== null && mockScore?.daysUntilNextTest !== undefined) {
        const days = mockScore.daysUntilNextTest;
        const mockUrgency = days <= 7 ? 100 : days <= 14 ? 80 : days <= 30 ? 50 : days <= 60 ? 30 : 0;
        examUrgency = Math.max(examUrgency, mockUrgency);
      }
    }

    // Priority Score 계산
    const priorityInput = {
      subject: content.subject,
      progress: content.progress,
      difficulty_level: content.difficulty,
      recent_grade: schoolScore?.recentGrade ?? null,
      recent_percentile: mockScore?.recentPercentile ?? null,
      risk_index: riskIndex?.riskScore ?? (content.subject ? 30 : 0), // 데이터 부족 시 기본값 30
      exam_urgency: examUrgency,
      semester_urgency: schoolScore?.semesterUrgency ?? 0,
      history: content.lastUpdated
        ? Math.min(10, Math.floor((Date.now() - new Date(content.lastUpdated).getTime()) / (1000 * 60 * 60 * 24)))
        : undefined,
    };

    content.priorityScore = calculatePriorityScore(priorityInput, priorityConfig);
  });

  // 취약과목 집중 모드: Risk Score가 높은 과목만 필터링
  let filteredContents = contents;
  if (weakSubjectFocus && priorityConfig.riskIndexWeight > 0) {
    filteredContents = contents.filter((c) => {
      if (!c.riskIndex) return false;
      // Risk Score 30 이상인 경우만
      return c.riskIndex.riskScore >= 30;
    });
    // 필터링 결과가 없으면 전체 사용
    if (filteredContents.length === 0) {
      filteredContents = contents;
    }
  }

  // Priority Score 기반 정렬 (높은 순)
  filteredContents.sort((a, b) => {
    const aPriority = a.priorityScore ?? 0;
    const bPriority = b.priorityScore ?? 0;
    
    if (Math.abs(aPriority - bPriority) > 0.01) {
      return bPriority - aPriority; // Priority Score가 높을수록 우선
    }

    // Priority Score가 같으면 진행률 기준 (낮을수록 우선)
    if (a.progress !== b.progress) {
      return a.progress - b.progress;
    }

    // 진행률도 같으면 난이도 기준 (낮을수록 우선)
    const difficultyA = DIFFICULTY_ORDER[a.difficulty ?? ""] ?? 999;
    const difficultyB = DIFFICULTY_ORDER[b.difficulty ?? ""] ?? 999;
    if (difficultyA !== difficultyB) {
      return difficultyA - difficultyB;
    }

    // 마지막으로 학습 속도
    const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
    const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
    return dateA - dateB;
  });

  return filteredContents;
}

// 성적 위험도 계산 (0-100, 높을수록 위험)
function calculateScoreRisk(scoreInfo: SubjectScoreInfo | null): number {
  if (!scoreInfo) return 0;

  let risk = 0;

  // 1. 최근 등급이 낮을수록 위험 (등급이 높을수록 나쁨)
  // 1등급=0, 5등급=50, 9등급=100
  const gradeRisk = ((scoreInfo.recentGrade - 1) / 8) * 100;
  risk += gradeRisk * 0.4; // 40% 가중치

  // 2. 평균 등급이 낮을수록 위험
  const avgGradeRisk = ((scoreInfo.averageGrade - 1) / 8) * 100;
  risk += avgGradeRisk * 0.2; // 20% 가중치

  // 3. 학기 종료 임박도 (높을수록 위험)
  risk += scoreInfo.semesterUrgency * 0.3; // 30% 가중치

  // 4. 원점수 편차 (불안정할수록 위험)
  // 편차가 20 이상이면 penalty (표준편차 기준)
  const variancePenalty = Math.min(100, (scoreInfo.scoreVariance / 20) * 100);
  risk += variancePenalty * 0.1; // 10% 가중치

  return Math.min(100, risk);
}

function calculateRange(
  content: ContentItem,
  currentStart: number,
  total: number
): { start: number; end: number } {
  // 기본 분량: 총량의 10% 또는 최소 1
  const defaultChunk = Math.max(1, Math.floor(total * 0.1));

  const start = Math.min(currentStart, total - 1);
  const end = Math.min(start + defaultChunk, total);

  return { start, end };
}

