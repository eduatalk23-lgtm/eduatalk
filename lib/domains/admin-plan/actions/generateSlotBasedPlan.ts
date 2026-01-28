'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { createPlanGroupForPlanner } from '../utils/planGroupSelector';
import { generatePlansWithServices } from '@/lib/plan/services/generatePlansWithServices';
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
 * 2. Plan Group 생성 (scheduler_options에 content_allocations 포함)
 * 3. 코드 기반 스케줄러로 플랜 생성 (LLM 우회)
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
      userId: user.userId,
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
    const failureSummary = results.map(r => ({
      slotId: r.slotId,
      title: r.contentTitle,
      error: r.error,
    }));
    logActionError(
      'generateSlotBasedPlan',
      `슬롯 기반 플랜 생성 전체 실패 - 결과: ${JSON.stringify(failureSummary)}`
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
  userId: string;
}): Promise<SlotGenerationResult> {
  const { slot, studentId, tenantId, plannerId, periodStart, periodEnd, userId } = params;

  try {
    let contentId: string = '';
    const contentTitle = slot.content.title;

    // Step 1: AI 추천 콘텐츠면 DB에 저장
    let masterContentId: string | null = null;

    // UUID 유효성 검사 헬퍼
    const isValidUUID = (id: unknown): id is string => {
      if (typeof id !== 'string' || !id) return false;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(id);
    };

    // AI 추천 콘텐츠인지 판단 (id가 없거나 유효하지 않은 UUID)
    const isAIRecommendation = slot.type === 'ai_recommendation' && !isValidUUID(slot.content.id);

    if (isAIRecommendation) {
      const persistResult = await persistVirtualContent({
        content: slot.content,
        tenantId,
      });

      if (!persistResult.success || !persistResult.contentId) {
        logActionError(
          'generateSlotBasedPlan',
          `[Step1] AI 콘텐츠 저장 실패 - slotId: ${slot.id}, title: ${contentTitle}, error: ${persistResult.error}`
        );
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

      masterContentId = persistResult.contentId;

      // Step 1.5: lectures/books 테이블에 학생용 콘텐츠 레코드 생성 (RLS 우회)
      const supabaseForContent = createSupabaseAdminClient();
      if (!supabaseForContent) {
        logActionError('generateSlotBasedPlan', '[Step1.5] Admin 클라이언트 생성 실패');
        return {
          slotId: slot.id,
          contentId: '',
          contentTitle,
          planGroupId: '',
          planCount: 0,
          success: false,
          error: 'Admin 클라이언트 생성 실패: Service Role Key 미설정',
        };
      }

      if (slot.content.contentType === 'lecture') {
        // 중복 체크: 같은 master_lecture_id를 가진 학생 강의가 이미 있는지 확인
        const { data: existingLecture } = await supabaseForContent
          .from('lectures')
          .select('id')
          .eq('student_id', studentId)
          .eq('master_lecture_id', masterContentId)
          .maybeSingle();

        if (existingLecture) {
          // 이미 존재하면 기존 ID 사용
          contentId = existingLecture.id;
          logActionDebug(
            'generateSlotBasedPlan',
            `[Step1.5] 기존 lectures 레코드 사용 - id: ${existingLecture.id}, masterContentId: ${masterContentId}`
          );
        } else {
          // master_lectures에서 추가 정보 조회
          const { data: masterData } = await supabaseForContent
            .from('master_lectures')
            .select('episode_analysis, estimated_hours, difficulty_level, total_duration, total_episodes')
            .eq('id', masterContentId)
            .single();

          // 총 에피소드 수: master_lectures 우선, fallback으로 slot 데이터 사용
          const totalEpisodes = masterData?.total_episodes || slot.content.totalRange || 1;

          // 총 소요시간 계산 (분 단위)
          const totalDuration = masterData?.total_duration
            || (masterData?.estimated_hours ? Math.round(masterData.estimated_hours * 60) : null);

          const { data: lectureData, error: lectureError } = await supabaseForContent
            .from('lectures')
            .insert({
              tenant_id: tenantId,
              student_id: studentId,
              master_lecture_id: masterContentId, // master_content_id → master_lecture_id로 변경
              title: contentTitle,
              platform: slot.content.publisher || null,
              subject: slot.content.subject || null,
              subject_category: slot.content.subjectCategory || null,
              total_episodes: totalEpisodes,
              difficulty_level: masterData?.difficulty_level || 'medium',
              episode_analysis: masterData?.episode_analysis || null,
              total_duration: totalDuration,
            })
            .select('id')
            .single();

          if (lectureError) {
            // Unique constraint 위반 (Race Condition)
            if (lectureError.code === '23505') {
              const { data: raceLecture } = await supabaseForContent
                .from('lectures')
                .select('id')
                .eq('student_id', studentId)
                .eq('master_lecture_id', masterContentId)
                .maybeSingle();

              if (raceLecture) {
                contentId = raceLecture.id;
                logActionDebug(
                  'generateSlotBasedPlan',
                  `[Step1.5] Race condition 처리 - 기존 lectures 레코드 사용: ${raceLecture.id}`
                );
              } else {
                logActionError(
                  'generateSlotBasedPlan',
                  `[Step1.5] lectures 레코드 생성 실패 (unique 위반 후 조회 실패) - error: ${lectureError.message}`
                );
                return {
                  slotId: slot.id,
                  contentId: '',
                  contentTitle,
                  planGroupId: '',
                  planCount: 0,
                  success: false,
                  error: `학생용 강의 레코드 생성 실패: ${lectureError.message}`,
                };
              }
            } else {
              logActionError(
                'generateSlotBasedPlan',
                `[Step1.5] lectures 레코드 생성 실패 - error: ${lectureError.message}`
              );
              return {
                slotId: slot.id,
                contentId: '',
                contentTitle,
                planGroupId: '',
                planCount: 0,
                success: false,
                error: `학생용 강의 레코드 생성 실패: ${lectureError.message}`,
              };
            }
          } else if (lectureData) {
            contentId = lectureData.id;
          }
        }

        // contentId가 설정되지 않았으면 에러
        if (!contentId) {
          logActionError(
            'generateSlotBasedPlan',
            `[Step1.5] lectures 레코드 생성 실패 - contentId가 설정되지 않음`
          );
          return {
            slotId: slot.id,
            contentId: '',
            contentTitle,
            planGroupId: '',
            planCount: 0,
            success: false,
            error: `학생용 강의 레코드 생성 실패`,
          };
        }
      } else {
        // book type
        // 중복 체크: 같은 master_content_id를 가진 학생 교재가 이미 있는지 확인
        const { data: existingBook } = await supabaseForContent
          .from('books')
          .select('id')
          .eq('student_id', studentId)
          .eq('master_content_id', masterContentId)
          .maybeSingle();

        if (existingBook) {
          // 이미 존재하면 기존 ID 사용
          contentId = existingBook.id;
          logActionDebug(
            'generateSlotBasedPlan',
            `[Step1.5] 기존 books 레코드 사용 - id: ${existingBook.id}, masterContentId: ${masterContentId}`
          );
        } else {
          // master_books에서 추가 정보 조회
          const { data: masterData } = await supabaseForContent
            .from('master_books')
            .select('page_analysis, estimated_hours, difficulty_level')
            .eq('id', masterContentId)
            .single();

          const { data: bookData, error: bookError } = await supabaseForContent
            .from('books')
            .insert({
              tenant_id: tenantId,
              student_id: studentId,
              master_content_id: masterContentId,
              title: contentTitle,
              publisher: slot.content.publisher || null,
              author: slot.content.author || null,
              subject: slot.content.subject || null,
              subject_category: slot.content.subjectCategory || null,
              total_pages: slot.content.totalRange || null,
              difficulty_level: masterData?.difficulty_level || 'medium',
              page_analysis: masterData?.page_analysis || null,
            })
            .select('id')
            .single();

          if (bookError) {
            // Unique constraint 위반 (Race Condition)
            if (bookError.code === '23505') {
              const { data: raceBook } = await supabaseForContent
                .from('books')
                .select('id')
                .eq('student_id', studentId)
                .eq('master_content_id', masterContentId)
                .maybeSingle();

              if (raceBook) {
                contentId = raceBook.id;
                logActionDebug(
                  'generateSlotBasedPlan',
                  `[Step1.5] Race condition 처리 - 기존 books 레코드 사용: ${raceBook.id}`
                );
              } else {
                logActionError(
                  'generateSlotBasedPlan',
                  `[Step1.5] books 레코드 생성 실패 (unique 위반 후 조회 실패) - error: ${bookError.message}`
                );
                return {
                  slotId: slot.id,
                  contentId: '',
                  contentTitle,
                  planGroupId: '',
                  planCount: 0,
                  success: false,
                  error: `학생용 교재 레코드 생성 실패: ${bookError.message}`,
                };
              }
            } else {
              logActionError(
                'generateSlotBasedPlan',
                `[Step1.5] books 레코드 생성 실패 - error: ${bookError.message}`
              );
              return {
                slotId: slot.id,
                contentId: '',
                contentTitle,
                planGroupId: '',
                planCount: 0,
                success: false,
                error: `학생용 교재 레코드 생성 실패: ${bookError.message}`,
              };
            }
          } else if (bookData) {
            contentId = bookData.id;
          }
        }

        // contentId가 설정되지 않았으면 에러
        if (!contentId) {
          logActionError(
            'generateSlotBasedPlan',
            `[Step1.5] books 레코드 생성 실패 - contentId가 설정되지 않음`
          );
          return {
            slotId: slot.id,
            contentId: '',
            contentTitle,
            planGroupId: '',
            planCount: 0,
            success: false,
            error: `학생용 교재 레코드 생성 실패`,
          };
        }
      }
    } else {
      // 기존 콘텐츠 - UUID 유효성 검사
      if (!isValidUUID(slot.content.id)) {
        logActionError(
          'generateSlotBasedPlan',
          `[기존 콘텐츠] 유효하지 않은 contentId - slotId: ${slot.id}, contentId: ${slot.content.id}, type: ${typeof slot.content.id}`
        );
        return {
          slotId: slot.id,
          contentId: '',
          contentTitle,
          planGroupId: '',
          planCount: 0,
          success: false,
          error: `유효하지 않은 콘텐츠 ID: ${slot.content.id}`,
        };
      }
      contentId = slot.content.id;
    }

    // Step 2: Plan Group 생성 (항상 새로 생성)
    const supabaseForPlanGroup = await createSupabaseServerClient();
    const masterIdForCheck = masterContentId || contentId;

    // 중복 경고: 같은 planner + content 조합이 이미 있는지 확인
    let duplicateWarning: string | undefined;
    const { data: existingPlanGroup } = await supabaseForPlanGroup
      .from('plan_groups')
      .select('id, name')
      .eq('planner_id', plannerId)
      .eq('master_content_id', masterIdForCheck)
      .maybeSingle();

    if (existingPlanGroup) {
      duplicateWarning = `같은 콘텐츠(${contentTitle})의 플랜 그룹이 이미 존재합니다. 새 플랜 그룹이 별도로 생성됩니다.`;
      logActionWarn(
        'generateSlotBasedPlan',
        `[Step2] 동일 콘텐츠 Plan Group 중복 감지 - 기존: ${existingPlanGroup.id}, 새로 생성 진행`
      );
    }

    const planGroupResult = await createPlanGroupForPlanner({
      plannerId,
      studentId,
      tenantId,
      name: contentTitle,
      periodStart,
      periodEnd,
      options: {
        isSingleContent: true,
        creationMode: 'content_based',
      },
    });

    if (!planGroupResult.success || !planGroupResult.planGroupId) {
      logActionError(
        'generateSlotBasedPlan',
        `[Step2] Plan Group 생성 실패 - slotId: ${slot.id}, title: ${contentTitle}, error: ${planGroupResult.error}`
      );
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

    // Step 3: Plan Group에 콘텐츠 정보 연결 + scheduler_options에 content_allocations 주입
    // 기존 scheduler_options를 읽어서 content_allocations를 병합
    const { data: currentGroup } = await supabaseForPlanGroup
      .from('plan_groups')
      .select('scheduler_options')
      .eq('id', planGroupId)
      .single();

    const existingSchedulerOptions = (currentGroup?.scheduler_options as Record<string, unknown>) || {};
    const subjectType = slot.subjectClassification === 'strategic' ? 'strategy' : 'weakness';

    const { error: updateError } = await supabaseForPlanGroup
      .from('plan_groups')
      .update({
        content_id: contentId,
        content_type: slot.content.contentType,
        master_content_id: masterContentId || contentId,
        // 범위 설정 저장
        start_range: slot.rangeConfig.startRange,
        end_range: slot.rangeConfig.endRange,
        // 전략/취약 과목 정보 저장
        study_type: subjectType,
        ...(slot.subjectClassification === 'strategic' && slot.strategicConfig && {
          strategy_days_per_week: slot.strategicConfig.weeklyDays,
        }),
        // 스케줄러가 읽는 content_allocations에 사용자 설정값 직접 반영
        scheduler_options: {
          ...existingSchedulerOptions,
          content_allocations: [{
            content_type: slot.content.contentType,
            content_id: contentId,
            subject_type: subjectType,
            ...(slot.subjectClassification === 'strategic' && slot.strategicConfig && {
              weekly_days: slot.strategicConfig.weeklyDays,
            }),
          }],
        },
      })
      .eq('id', planGroupId);

    if (updateError) {
      logActionWarn('generateSlotBasedPlan', `Plan Group 업데이트 실패: ${updateError.message}`);
    }

    // Step 3.5: plan_contents 테이블에 콘텐츠 레코드 추가
    const { error: contentInsertError } = await supabaseForPlanGroup
      .from('plan_contents')
      .insert({
        tenant_id: tenantId,
        plan_group_id: planGroupId,
        content_type: slot.content.contentType,
        content_id: contentId,
        master_content_id: masterContentId || contentId,
        start_range: slot.rangeConfig.startRange,
        end_range: slot.rangeConfig.endRange,
        display_order: 1,
        content_name: contentTitle,
        subject_name: slot.content.subject || null,
        subject_category: slot.content.subjectCategory || null,
        is_auto_recommended: true,
        recommendation_source: 'auto',
      });

    if (contentInsertError) {
      logActionError(
        'generateSlotBasedPlan',
        `[Step3.5] plan_contents 삽입 실패 - planGroupId: ${planGroupId}, error: ${contentInsertError.message}`
      );
      return {
        slotId: slot.id,
        contentId,
        contentTitle,
        planGroupId,
        planCount: 0,
        success: false,
        error: `콘텐츠 연결 실패: ${contentInsertError.message}`,
      };
    }

    // Step 4: 코드 기반 스케줄러로 플랜 생성 (LLM 우회)
    // scheduler_options.content_allocations에 사용자 설정이 이미 반영되어 있으므로
    // AI Framework 없이 코드 스케줄러만으로 정확한 날짜/시간 배치 가능
    const planResult = await generatePlansWithServices({
      groupId: planGroupId,
      context: {
        studentId,
        tenantId,
        userId,
        role: 'admin',
        isCampMode: false,
      },
      accessInfo: {
        userId,
        role: 'admin',
      },
      // aiSchedulerOptionsOverride 없음 → Plan Group의 scheduler_options만 사용
    });

    if (!planResult.success) {
      const errorMsg = planResult.error || '플랜 생성 실패';
      logActionError(
        'generateSlotBasedPlan',
        `[Step4] 플랜 생성 실패 - slotId: ${slot.id}, title: ${contentTitle}, planGroupId: ${planGroupId}, error: ${errorMsg}`
      );

      // 롤백: 빈 Plan Group 삭제 (플랜 생성 실패 시)
      try {
        // plan_contents 먼저 삭제
        await supabaseForPlanGroup
          .from('plan_contents')
          .delete()
          .eq('plan_group_id', planGroupId);
        // plan_groups 삭제
        await supabaseForPlanGroup
          .from('plan_groups')
          .delete()
          .eq('id', planGroupId);
        logActionDebug(
          'generateSlotBasedPlan',
          `[Rollback] 빈 Plan Group 삭제 완료 - planGroupId: ${planGroupId}`
        );
      } catch (rollbackErr) {
        logActionWarn(
          'generateSlotBasedPlan',
          `[Rollback] Plan Group 삭제 실패 - planGroupId: ${planGroupId}, error: ${rollbackErr}`
        );
      }

      return {
        slotId: slot.id,
        contentId,
        contentTitle,
        planGroupId: '', // 롤백됨
        planCount: 0,
        success: false,
        error: errorMsg,
      };
    }

    return {
      slotId: slot.id,
      contentId,
      contentTitle,
      planGroupId,
      planCount: planResult.count || 0,
      success: true,
      warning: duplicateWarning,
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
      // errors 배열에서 상세 에러 메시지 추출
      const errorDetail = saveResult.errors.length > 0
        ? saveResult.errors.map(e => `${e.title}: ${e.error}`).join(', ')
        : '원인 불명';

      logActionError(
        'generateSlotBasedPlan',
        `[persistVirtualContent] 콘텐츠 저장 실패 - title: ${content.title}, errorDetail: ${errorDetail}`
      );

      return {
        success: false,
        error: `콘텐츠 저장에 실패했습니다: ${errorDetail}`,
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
