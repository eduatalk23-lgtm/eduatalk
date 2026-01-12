/**
 * 플랜 페이로드 빌더 서비스
 *
 * 스케줄 결과를 플랜 레코드로 변환합니다.
 *
 * @module lib/domains/plan/services/planPayloadBuilder
 */

import { assignPlanTimes } from "@/lib/plan/assignPlanTimes";
import { splitPlanTimeInputByEpisodes } from "@/lib/plan/planSplitter";
import { timeToMinutes } from "../actions/plan-groups/utils";
import { generatePlanNameString } from "@/lib/domains/admin-plan/utils/planNaming";
import type {
  PlanServiceContext,
  ContentResolutionResult,
  DailyScheduleItem,
  PayloadBuildResult,
  GeneratePlanPayload,
  DayType,
  ContentDurationMap,
} from "./types";

// ============================================
// 타입 정의
// ============================================

/**
 * 스케줄 결과에서 가져온 플랜 정보
 */
interface ScheduledPlan {
  plan_date: string;
  content_id: string;
  content_type: string;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter?: string | null;
  block_index?: number;
  start_time?: string | null;
  end_time?: string | null;
}

/**
 * 시간 슬롯 정보
 */
interface TimeSlot {
  type: string;
  start: string;
  end: string;
  label?: string;
}

/**
 * 날짜 메타데이터
 */
interface DateMetadata {
  day_type: DayType;
  week_number: number | null;
}

/**
 * 스케줄 결과
 */
interface ScheduleResult {
  daily_schedule: Array<{
    date: string;
    day_type: string;
    study_hours: number;
    week_number?: number | null;
  }>;
}

// ============================================
// PlanPayloadBuilder 클래스
// ============================================

/**
 * 플랜 페이로드 빌더
 *
 * 스케줄 결과를 플랜 레코드로 변환하고 시퀀스를 할당합니다.
 */
export class PlanPayloadBuilder {
  private ctx: PlanServiceContext;

  constructor(context: PlanServiceContext) {
    this.ctx = context;
  }

  /**
   * 스케줄된 플랜들을 DB 저장용 페이로드로 변환합니다.
   */
  buildPayloads(
    scheduledPlans: ScheduledPlan[],
    contentResolution: ContentResolutionResult,
    scheduleResult: ScheduleResult,
    dateTimeSlots: Map<string, TimeSlot[]>,
    dateMetadataMap: Map<string, DateMetadata>,
    weekDatesMap: Map<number, string[]>
  ): PayloadBuildResult {
    const warnings: string[] = [];
    const planPayloads: GeneratePlanPayload[] = [];

    const { contentIdMap, metadataMap, durationMap } = contentResolution;

    // 역방향 콘텐츠 ID 맵 생성
    const reverseContentIdMap = new Map<string, string>();
    contentIdMap.forEach((resolvedId, originalId) => {
      reverseContentIdMap.set(resolvedId, originalId);
    });

    // plan_number 계산
    const { planKeyToNumber } = this.calculatePlanNumbers(scheduledPlans);

    // 콘텐츠별 시퀀스 추적
    const contentSequenceMap = new Map<
      string,
      {
        lastSequence: number;
        seenPlanNumbers: Set<number | null>;
        planNumberToSequence: Map<number | null, number>;
      }
    >();

    // 날짜별로 그룹화
    const plansByDate = this.groupPlansByDate(scheduledPlans);

    // 날짜 순서대로 처리
    const sortedDates = Array.from(plansByDate.keys()).sort();
    for (const date of sortedDates) {
      const datePlans = plansByDate.get(date)!;
      const datePayloads = this.buildDatePayloads(
        date,
        datePlans,
        contentResolution,
        scheduleResult,
        dateTimeSlots,
        dateMetadataMap,
        weekDatesMap,
        reverseContentIdMap,
        planKeyToNumber,
        contentSequenceMap
      );

      planPayloads.push(...datePayloads.payloads);
      warnings.push(...datePayloads.warnings);
    }

    return {
      payloads: planPayloads,
      sequencedPayloads: planPayloads, // 이미 시퀀스가 할당됨
      warnings,
    };
  }

  /**
   * 플랜 번호를 계산합니다.
   */
  private calculatePlanNumbers(scheduledPlans: ScheduledPlan[]): {
    planKeyToNumber: Map<string, number>;
  } {
    const planKeyToNumber = new Map<string, number>();
    let nextPlanNumber = 1;

    // 날짜 순서대로 정렬
    const sortedPlans = [...scheduledPlans].sort((a, b) => {
      if (a.plan_date !== b.plan_date) {
        return a.plan_date.localeCompare(b.plan_date);
      }
      return (a.block_index || 0) - (b.block_index || 0);
    });

    for (const plan of sortedPlans) {
      const planKey = `${plan.content_id}-${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`;
      if (!planKeyToNumber.has(planKey)) {
        planKeyToNumber.set(planKey, nextPlanNumber);
        nextPlanNumber++;
      }
    }

    return { planKeyToNumber };
  }

  /**
   * 플랜을 날짜별로 그룹화합니다.
   */
  private groupPlansByDate(
    scheduledPlans: ScheduledPlan[]
  ): Map<string, ScheduledPlan[]> {
    const plansByDate = new Map<string, ScheduledPlan[]>();
    for (const plan of scheduledPlans) {
      if (!plansByDate.has(plan.plan_date)) {
        plansByDate.set(plan.plan_date, []);
      }
      plansByDate.get(plan.plan_date)!.push(plan);
    }
    return plansByDate;
  }

  /**
   * 특정 날짜의 플랜 페이로드를 빌드합니다.
   */
  private buildDatePayloads(
    date: string,
    datePlans: ScheduledPlan[],
    contentResolution: ContentResolutionResult,
    scheduleResult: ScheduleResult,
    dateTimeSlots: Map<string, TimeSlot[]>,
    dateMetadataMap: Map<string, DateMetadata>,
    weekDatesMap: Map<number, string[]>,
    reverseContentIdMap: Map<string, string>,
    planKeyToNumber: Map<string, number>,
    contentSequenceMap: Map<
      string,
      {
        lastSequence: number;
        seenPlanNumbers: Set<number | null>;
        planNumberToSequence: Map<number | null, number>;
      }
    >
  ): { payloads: GeneratePlanPayload[]; warnings: string[] } {
    const payloads: GeneratePlanPayload[] = [];
    const warnings: string[] = [];
    const { contentIdMap, metadataMap, durationMap } = contentResolution;

    // 시간 슬롯 정보 가져오기
    const timeSlotsForDate = dateTimeSlots.get(date) || [];
    const studyTimeSlots = timeSlotsForDate
      .filter((slot) => slot.type === "학습시간")
      .map((slot) => ({ start: slot.start, end: slot.end }))
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    // 날짜 메타데이터
    const dateMetadata = dateMetadataMap.get(date) || {
      day_type: null as DayType,
      week_number: null,
    };

    const dailySchedule = scheduleResult.daily_schedule.find(
      (d) => d.date === date
    );
    const totalStudyHours = dailySchedule?.study_hours || 0;
    const dayType = dateMetadata.day_type || "학습일";

    // contentIdMap에 있는 콘텐츠만 처리
    const excludedContents: Array<{
      content_id: string;
      content_type: string;
      reason: string;
    }> = [];

    const plansForAssign = datePlans
      .map((plan, originalIndex) => {
        const finalContentId = contentIdMap.get(plan.content_id);
        if (!finalContentId) {
          excludedContents.push({
            content_id: plan.content_id,
            content_type: plan.content_type,
            reason: "contentIdMap에 매핑되지 않음",
          });
          return null;
        }
        return {
          content_id: finalContentId,
          content_type: plan.content_type,
          planned_start_page_or_time: plan.planned_start_page_or_time,
          planned_end_page_or_time: plan.planned_end_page_or_time,
          chapter: plan.chapter || null,
          block_index: plan.block_index,
          _precalculated_start: plan.start_time,
          _precalculated_end: plan.end_time,
          _originalIndex: originalIndex,
        };
      })
      .filter(
        (plan): plan is NonNullable<typeof plan> => plan !== null
      ) as Array<
      {
        content_id: string;
        content_type: string;
        planned_start_page_or_time: number;
        planned_end_page_or_time: number;
        chapter?: string | null;
        block_index?: number;
        _precalculated_start?: string | null;
        _precalculated_end?: string | null;
        _originalIndex: number;
      }
    >;

    if (excludedContents.length > 0) {
      warnings.push(
        `${date}: ${excludedContents.length}개의 콘텐츠가 제외됨`
      );
    }

    // Episode별 플랜 분할
    const splitPlansForAssign = plansForAssign.flatMap((p) => {
      if (p.content_type === "lecture") {
        if (dayType === "복습일") {
          return [p];
        }
        const isAlreadySingleEpisode =
          p.planned_start_page_or_time === p.planned_end_page_or_time;
        if (isAlreadySingleEpisode) {
          return [p];
        }
        const splitPlans = splitPlanTimeInputByEpisodes(
          p as Parameters<typeof splitPlanTimeInputByEpisodes>[0],
          durationMap
        );
        return splitPlans.map((splitPlan) => ({
          ...splitPlan,
          _originalIndex: p._originalIndex,
        }));
      }
      return [p];
    });

    // 시간 배정
    const timeSegments = assignPlanTimes(
      splitPlansForAssign as Parameters<typeof assignPlanTimes>[0],
      studyTimeSlots,
      durationMap,
      dayType as Parameters<typeof assignPlanTimes>[3],
      totalStudyHours
    );

    let blockIndex = 1;
    const now = new Date().toISOString();

    for (const segment of timeSegments) {
      // DEBUG: segment.plan 범위 확인
      console.log("[PlanPayloadBuilder] segment.plan 범위:", {
        date,
        content_id: segment.plan.content_id,
        planned_start: segment.plan.planned_start_page_or_time,
        planned_end: segment.plan.planned_end_page_or_time,
      });

      const originalContentId =
        reverseContentIdMap.get(segment.plan.content_id) ||
        segment.plan.content_id;
      const metadata = metadataMap.get(originalContentId) || {};
      const finalContentId = segment.plan.content_id;

      // 원본 플랜 정보로 plan_number 추론
      const originalPlanIndex = (segment.plan as { _originalIndex?: number })._originalIndex ?? 0;
      const originalPlan = datePlans[originalPlanIndex];

      let planNumber: number | null = null;
      if (originalPlan) {
        const planKey = `${originalPlan.content_id}-${originalPlan.planned_start_page_or_time}-${originalPlan.planned_end_page_or_time}`;
        planNumber = planKeyToNumber.get(planKey) || null;
      }

      // 콘텐츠별 시퀀스 계산
      const contentSequence = this.calculateContentSequence(
        finalContentId,
        planNumber,
        contentSequenceMap
      );

      // 주차별 일차 계산
      let weekDay: number | null = null;
      if (dateMetadata.week_number) {
        const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
        const dayIndex = weekDates.indexOf(date);
        if (dayIndex >= 0) {
          weekDay = dayIndex + 1;
        }
      }

      // custom_title 자동 생성: [과목] 콘텐츠명 범위
      const customTitle = generatePlanNameString({
        subject: metadata?.subject || null,
        contentTitle: metadata?.title || "",
        startRange: segment.plan.planned_start_page_or_time,
        endRange: segment.plan.planned_end_page_or_time,
        contentType: segment.plan.content_type as "book" | "lecture",
      });

      // DEBUG: custom_title 생성 확인
      console.log("[PlanPayloadBuilder] custom_title 생성:", {
        date,
        content_id: finalContentId,
        customTitle,
        metadata: {
          subject: metadata?.subject,
          title: metadata?.title,
        },
        range: {
          start: segment.plan.planned_start_page_or_time,
          end: segment.plan.planned_end_page_or_time,
        },
      });

      payloads.push({
        plan_group_id: this.ctx.groupId,
        student_id: this.ctx.studentId,
        tenant_id: this.ctx.tenantId,
        plan_date: date,
        block_index: blockIndex,
        content_type: segment.plan.content_type,
        content_id: finalContentId,
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
        is_reschedulable: true,
        content_title: metadata?.title || null,
        custom_title: customTitle || null,
        content_subject: metadata?.subject || null,
        content_subject_category: metadata?.subject_category || null,
        content_category: metadata?.category || null,
        sequence: contentSequence,
        plan_number: null,
      });

      blockIndex++;
    }

    return { payloads, warnings };
  }

  /**
   * 콘텐츠별 시퀀스를 계산합니다.
   */
  private calculateContentSequence(
    contentId: string,
    planNumber: number | null,
    contentSequenceMap: Map<
      string,
      {
        lastSequence: number;
        seenPlanNumbers: Set<number | null>;
        planNumberToSequence: Map<number | null, number>;
      }
    >
  ): number {
    if (!contentSequenceMap.has(contentId)) {
      contentSequenceMap.set(contentId, {
        lastSequence: 0,
        seenPlanNumbers: new Set(),
        planNumberToSequence: new Map(),
      });
    }

    const contentSeq = contentSequenceMap.get(contentId)!;

    if (
      planNumber !== null &&
      contentSeq.planNumberToSequence.has(planNumber)
    ) {
      return contentSeq.planNumberToSequence.get(planNumber)!;
    }

    if (planNumber === null) {
      contentSeq.lastSequence++;
      return contentSeq.lastSequence;
    } else {
      if (!contentSeq.seenPlanNumbers.has(planNumber)) {
        contentSeq.seenPlanNumbers.add(planNumber);
        contentSeq.lastSequence++;
        contentSeq.planNumberToSequence.set(planNumber, contentSeq.lastSequence);
      }
      return contentSeq.planNumberToSequence.get(planNumber)!;
    }
  }
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 플랜 페이로드 빌더 인스턴스 생성
 */
export function createPlanPayloadBuilder(
  context: PlanServiceContext
): PlanPayloadBuilder {
  return new PlanPayloadBuilder(context);
}
