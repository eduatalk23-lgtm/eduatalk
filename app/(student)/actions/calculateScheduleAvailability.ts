"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  calculateAvailableDates,
  type Block,
  type Exclusion,
  type AcademySchedule,
  type CalculateOptions,
} from "@/lib/scheduler/calculateAvailableDates";

type CalculateScheduleAvailabilityParams = {
  periodStart: string;
  periodEnd: string;
  blockSetId: string;
  exclusions: Exclusion[];
  academySchedules: AcademySchedule[];
  schedulerType: "1730_timetable";
  schedulerOptions?: {
    study_days?: number;
    review_days?: number;
  };
  timeSettings?: {
    lunch_time?: { start: string; end: string };
    camp_study_hours?: { start: string; end: string };
    camp_self_study_hours?: { start: string; end: string };
    designated_holiday_hours?: { start: string; end: string };
    use_self_study_with_blocks?: boolean;
    enable_self_study_for_holidays?: boolean;
    enable_self_study_for_study_days?: boolean;
  };
  // 템플릿 모드일 때 블록 데이터를 직접 전달
  blocks?: Block[];
  isTemplateMode?: boolean;
  // 캠프 모드일 때 템플릿 ID (템플릿 블록 조회용)
  isCampMode?: boolean;
  campTemplateId?: string;
};

export async function calculateScheduleAvailability(
  params: CalculateScheduleAvailabilityParams
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "로그인이 필요합니다.",
      data: null,
    };
  }

  try {
    // 캠프 모드에서 campTemplateId 필수 검증
    if (params.isCampMode && !params.campTemplateId) {
      return {
        success: false,
        error: "캠프 모드에서는 템플릿 ID가 필수입니다. 페이지를 새로고침하거나 관리자에게 문의해주세요.",
        data: null,
      };
    }

    let blocks: Block[] = [];

    // 캠프 모드: 템플릿 블록 세트의 블록 조회 (가장 먼저 처리, isTemplateMode보다 우선)
    if (params.isCampMode && params.campTemplateId && params.blockSetId) {
      // 새로운 연결 테이블 방식: camp_template_block_sets를 통해 tenant_block_sets 조회
      // 연결 테이블에서 템플릿에 연결된 블록 세트 조회
      const { data: templateBlockSetLink, error: linkError } = await supabase
        .from("camp_template_block_sets")
        .select("tenant_block_set_id")
        .eq("camp_template_id", params.campTemplateId)
        .maybeSingle();

      let templateBlockSetId: string | null = null;
      if (templateBlockSetLink) {
        templateBlockSetId = templateBlockSetLink.tenant_block_set_id;
      } else {
        // 하위 호환성: params.blockSetId가 이미 tenant_block_sets의 ID일 수 있음
        // 또는 template_data.block_set_id 확인 (마이그레이션 전 데이터용)
        const { getCampTemplate } = await import("@/lib/data/campTemplates");
        const template = await getCampTemplate(params.campTemplateId);
        if (template && template.template_data) {
          const templateData = template.template_data as any;
          templateBlockSetId = templateData.block_set_id || params.blockSetId || null;
        } else {
          // 연결 테이블에 없고 템플릿 데이터도 없으면 blockSetId를 직접 사용
          templateBlockSetId = params.blockSetId;
        }
      }

      if (templateBlockSetId) {
        // tenant_blocks 테이블에서 블록 조회
        const { data: blocksData, error: blocksError } = await supabase
          .from("tenant_blocks")
          .select("day_of_week, start_time, end_time")
          .eq("tenant_block_set_id", templateBlockSetId)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

        if (blocksError) {
          return {
            success: false,
            error: `템플릿 블록 조회 실패: ${blocksError.message}`,
            data: null,
          };
        }

        blocks =
          blocksData?.map((b) => ({
            day_of_week: b.day_of_week,
            start_time: b.start_time,
            end_time: b.end_time,
          })) || [];

        if (blocks.length === 0) {
          return {
            success: false,
            error: `템플릿 블록 세트(ID: ${templateBlockSetId})에 블록이 없습니다. 관리자에게 문의해주세요.`,
            data: null,
          };
        }
      } else {
        return {
          success: false,
          error: "템플릿에 블록 세트가 설정되지 않았습니다. 관리자에게 문의해주세요.",
          data: null,
        };
      }
    } else if (params.isTemplateMode) {
      // 템플릿 모드이거나 블록 데이터가 직접 전달된 경우
      if (params.blocks && params.blocks.length > 0) {
        blocks = params.blocks;
      } else {
        return {
          success: false,
          error: "템플릿 모드에서는 블록 세트에 최소 1개 이상의 블록이 필요합니다. Step 1에서 블록을 추가해주세요.",
          data: null,
        };
      }
    } else if (params.blocks) {
      // 블록 데이터가 직접 전달된 경우 사용
      blocks = params.blocks;
    } else {
      // 일반 모드: 학생 블록 세트의 블록 조회 (student_block_schedule 테이블)
      const { data: blocksData, error: blocksError } = await supabase
        .from("student_block_schedule")
        .select("day_of_week, start_time, end_time")
        .eq("student_id", user.id)
        .eq("block_set_id", params.blockSetId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (blocksError) {
        return {
          success: false,
          error: `블록 조회 실패: ${blocksError.message}`,
          data: null,
        };
      }

      blocks =
        blocksData?.map((b) => ({
          day_of_week: b.day_of_week,
          start_time: b.start_time,
          end_time: b.end_time,
        })) || [];

      if (blocks.length === 0) {
        return {
          success: false,
          error: `블록 세트(ID: ${params.blockSetId})에 블록이 없습니다. Step 1에서 블록을 추가해주세요.`,
          data: null,
        };
      }
    }

    // 계산 옵션 설정
    const options: CalculateOptions = {
      scheduler_type: params.schedulerType,
      scheduler_options: params.schedulerOptions,
      // 시간 설정 매핑
      lunch_time: params.timeSettings?.lunch_time,
      camp_study_hours: params.timeSettings?.camp_study_hours,
      camp_self_study_hours: params.timeSettings?.camp_self_study_hours,
      designated_holiday_hours: params.timeSettings?.designated_holiday_hours,
      use_self_study_with_blocks: params.timeSettings?.use_self_study_with_blocks,
      enable_self_study_for_holidays: params.timeSettings?.enable_self_study_for_holidays,
      enable_self_study_for_study_days: params.timeSettings?.enable_self_study_for_study_days,
    };

    // 입력값 사전 검증
    if (!params.periodStart || !params.periodEnd) {
      return {
        success: false,
        error: "학습 기간(시작일, 종료일)을 입력해주세요.",
        data: null,
      };
    }

    const startDate = new Date(params.periodStart);
    const endDate = new Date(params.periodEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return {
        success: false,
        error: "날짜 형식이 올바르지 않습니다. (YYYY-MM-DD 형식이어야 합니다)",
        data: null,
      };
    }

    if (startDate > endDate) {
      return {
        success: false,
        error: "시작일은 종료일보다 앞서야 합니다.",
        data: null,
      };
    }

    // 계산 실행
    const result = calculateAvailableDates(
      params.periodStart,
      params.periodEnd,
      blocks,
      params.exclusions,
      params.academySchedules,
      options
    );

    // 계산 결과에 에러가 있으면 실패로 처리
    if (result.errors && result.errors.length > 0) {
      return {
        success: false,
        error: result.errors.join(" "),
        data: null,
      };
    }

    return {
      success: true,
      error: null,
      data: result,
    };
  } catch (error) {
    console.error("[calculateScheduleAvailability] 계산 실패", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "스케줄 가능 날짜 계산 중 오류가 발생했습니다.",
      data: null,
    };
  }
}

