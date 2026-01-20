'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { createPlanGroupForPlanner } from '../utils/planGroupSelector';
import { generateHybridPlanCompleteAction } from '@/lib/domains/plan/llm/actions/generateHybridPlanComplete';
import { saveRecommendationsToMasterContent } from '@/lib/domains/plan/llm/actions/coldStart/persistence';
import { logActionDebug, logActionError, logActionWarn } from '@/lib/utils/serverActionLogger';
import type {
  GenerateSlotBasedPlanInput,
  ConfirmedSlot,
  SlotGenerationResult,
} from '../types/aiPlanSlot';
import type { RecommendationItem } from '@/lib/domains/plan/llm/actions/coldStart/types';

// ============================================================================
// 타입
// ============================================================================

interface GenerateSlotBasedPlanResult {
  success: boolean;
  results?: SlotGenerationResult[];
  totalPlans?: number;
  error?: string;
}

// ============================================================================
// 메인 Server Action
// ============================================================================

/**
 * 슬롯 기반 플랜 생성 Server Action
 *
 * 각 확정된 슬롯에 대해:
 * 1. AI 추천 콘텐츠 → Master Content DB에 저장
 * 2. Plan Group 생성
 * 3. Hybrid Pipeline으로 플랜 생성
 */
export async function generateSlotBasedPlanAction(
  input: GenerateSlotBasedPlanInput
): Promise<GenerateSlotBasedPlanResult> {
  const { studentId, tenantId, plannerId, periodStart, periodEnd, slots } = input;

  // 인증 확인
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  // 입력 검증
  if (!studentId || !tenantId || !plannerId) {
    return { success: false, error: '필수 입력값이 누락되었습니다.' };
  }

  if (slots.length === 0) {
    return { success: false, error: '확정된 슬롯이 없습니다.' };
  }

  logActionDebug(
    'generateSlotBasedPlan',
    `슬롯 기반 플랜 생성 시작: ${slots.length}개 슬롯`
  );

  const results: SlotGenerationResult[] = [];
  let totalPlans = 0;

  // 각 슬롯별로 처리
  for (const slot of slots) {
    const slotResult = await processSlot({
      slot,
      studentId,
      tenantId,
      plannerId,
      periodStart,
      periodEnd,
    });

    results.push(slotResult);

    if (slotResult.success) {
      totalPlans += slotResult.planCount;
    }
  }

  // 전체 성공 여부 판단 (1개 이상 성공이면 부분 성공)
  const successCount = results.filter(r => r.success).length;
  const allSuccess = successCount === slots.length;
  const partialSuccess = successCount > 0 && successCount < slots.length;

  if (allSuccess) {
    logActionDebug(
      'generateSlotBasedPlan',
      `슬롯 기반 플랜 생성 완료: ${totalPlans}개 플랜`
    );
  } else if (partialSuccess) {
    logActionWarn(
      'generateSlotBasedPlan',
      `슬롯 기반 플랜 부분 성공: ${successCount}/${slots.length}개 슬롯`
    );
  } else {
    logActionError(
      'generateSlotBasedPlan',
      '슬롯 기반 플랜 생성 전체 실패'
    );
  }

  return {
    success: successCount > 0,
    results,
    totalPlans,
    error: successCount === 0 ? '모든 슬롯 생성에 실패했습니다.' : undefined,
  };
}

// ============================================================================
// 개별 슬롯 처리
// ============================================================================

async function processSlot(params: {
  slot: ConfirmedSlot;
  studentId: string;
  tenantId: string;
  plannerId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<SlotGenerationResult> {
  const { slot, studentId, tenantId, plannerId, periodStart, periodEnd } = params;

  try {
    let contentId: string;
    const contentTitle = slot.content.title;

    // Step 1: AI 추천 콘텐츠면 DB에 저장
    if (slot.type === 'ai_recommendation' && !slot.content.id) {
      const persistResult = await persistVirtualContent({
        content: slot.content,
        tenantId,
      });

      if (!persistResult.success || !persistResult.contentId) {
        return {
          slotId: slot.id,
          contentId: '',
          contentTitle,
          planGroupId: '',
          planCount: 0,
          success: false,
          error: persistResult.error || 'AI 콘텐츠 저장 실패',
        };
      }

      contentId = persistResult.contentId;
    } else {
      // 기존 콘텐츠
      contentId = slot.content.id!;
    }

    // Step 2: Plan Group 생성
    const planGroupResult = await createPlanGroupForPlanner({
      plannerId,
      studentId,
      tenantId,
      name: contentTitle,
      periodStart,
      periodEnd,
      options: {
        isSingleContent: true,
        creationMode: 'ai_slot_based',
      },
    });

    if (!planGroupResult.success || !planGroupResult.planGroupId) {
      return {
        slotId: slot.id,
        contentId,
        contentTitle,
        planGroupId: '',
        planCount: 0,
        success: false,
        error: planGroupResult.error || 'Plan Group 생성 실패',
      };
    }

    const planGroupId = planGroupResult.planGroupId;

    // Step 3: Plan Group에 콘텐츠 정보 연결
    const supabase = await createSupabaseServerClient();
    const { error: updateError } = await supabase
      .from('plan_groups')
      .update({
        content_id: contentId,
        content_type: slot.content.contentType,
        master_content_id: contentId,
        // 범위 설정 저장
        start_page: slot.rangeConfig.startRange,
        end_page: slot.rangeConfig.endRange,
        // 전략/취약 과목 정보 저장
        subject_type: slot.subjectClassification === 'strategic' ? 'strategy' : 'weakness',
        ...(slot.subjectClassification === 'strategic' && slot.strategicConfig && {
          study_days: slot.strategicConfig.weeklyDays,
        }),
      })
      .eq('id', planGroupId);

    if (updateError) {
      logActionWarn('generateSlotBasedPlan', `Plan Group 업데이트 실패: ${updateError.message}`);
    }

    // Step 4: 기간 계산
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Step 5: Hybrid Pipeline으로 플랜 생성
    const hybridResult = await generateHybridPlanCompleteAction({
      planGroupId,
      student: {
        id: studentId,
        name: '',
        grade: '',
      },
      scores: [],
      contents: [{
        id: contentId,
        title: contentTitle,
        subject: slot.content.subject || '',
        subjectCategory: slot.content.subjectCategory || '',
        contentType: slot.content.contentType,
        estimatedHours: 10, // 기본값
        difficulty: 'medium',
      }],
      period: {
        startDate: periodStart,
        endDate: periodEnd,
        totalDays,
        studyDays: slot.subjectClassification === 'strategic'
          ? (slot.strategicConfig?.weeklyDays ?? 3) * Math.ceil(totalDays / 7)
          : Math.floor(totalDays * 6 / 7), // 취약 과목: 주 6일
      },
      modelTier: 'standard',
      role: 'admin',
      plannerValidationMode: 'warn',
    });

    if (!hybridResult.success) {
      return {
        slotId: slot.id,
        contentId,
        contentTitle,
        planGroupId,
        planCount: 0,
        success: false,
        error: typeof hybridResult.error === 'string' ? hybridResult.error : 'Hybrid 플랜 생성 실패',
      };
    }

    return {
      slotId: slot.id,
      contentId,
      contentTitle,
      planGroupId,
      planCount: hybridResult.planCount || 0,
      success: true,
    };
  } catch (error) {
    logActionError(
      'generateSlotBasedPlan',
      `슬롯 처리 실패 (${slot.id}): ${error instanceof Error ? error.message : String(error)}`
    );

    return {
      slotId: slot.id,
      contentId: slot.content.id || '',
      contentTitle: slot.content.title,
      planGroupId: '',
      planCount: 0,
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

// ============================================================================
// AI 콘텐츠 영속화
// ============================================================================

async function persistVirtualContent(params: {
  content: ConfirmedSlot['content'];
  tenantId: string;
}): Promise<{ success: boolean; contentId?: string; error?: string }> {
  const { content, tenantId } = params;

  try {
    // RecommendationItem 형태로 변환
    const recommendation: RecommendationItem = {
      title: content.title,
      contentType: content.contentType,
      totalRange: content.totalRange,
      author: content.author,
      publisher: content.publisher,
      chapters: content.chapters || [],
      rank: 1,
      matchScore: 100,
      reason: 'AI 추천 콘텐츠',
    };

    // Master Content에 저장
    const saveResult = await saveRecommendationsToMasterContent(
      [recommendation],
      {
        tenantId,
        subjectCategory: content.subjectCategory || '기타',
        subject: content.subject,
      }
    );

    if (saveResult.savedItems.length === 0) {
      return {
        success: false,
        error: '콘텐츠 저장에 실패했습니다.',
      };
    }

    return {
      success: true,
      contentId: saveResult.savedItems[0].id,
    };
  } catch (error) {
    logActionError(
      'generateSlotBasedPlan',
      `AI 콘텐츠 영속화 실패: ${error instanceof Error ? error.message : String(error)}`
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : '콘텐츠 저장 실패',
    };
  }
}
