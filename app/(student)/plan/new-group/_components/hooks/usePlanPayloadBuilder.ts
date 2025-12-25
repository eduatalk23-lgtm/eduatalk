
import { useMemo } from "react";
import { WizardData } from "../PlanGroupWizard";
import { PlanGroupCreationData, ContentType, PlanPurpose, PlanContentInput } from "@/lib/types/plan";
import { PlanGroupError, PlanGroupErrorCodes, ErrorUserMessages } from "@/lib/errors/planGroupErrors";
import { validateDataConsistency } from "@/lib/utils/planGroupDataSync";
import { mergeTimeSettingsSafely, mergeStudyReviewCycle } from "@/lib/utils/schedulerOptionsMerge";
import { validatePeriod } from "../utils/validationUtils";

/**
 * 확장된 PlanContentInput 타입 (추천 관련 필드 포함)
 */
type ExtendedPlanContentInput = PlanContentInput & {
  title?: string;
  subject_category?: string;
  subject?: string;
  is_auto_recommended?: boolean;
  recommendation_source?: "auto" | "admin" | "template" | null;
  recommendation_reason?: string | null;
  recommendation_metadata?: Record<string, unknown> | null;
  master_content_id?: string | null;
  display_order?: number;
};

type UsePlanPayloadBuilderOptions = {
  validateOnBuild?: boolean;
  isCampMode?: boolean;
};

type PayloadBuildResult = {
  payload: PlanGroupCreationData | null;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  build: () => PlanGroupCreationData;
};

export function usePlanPayloadBuilder(
  wizardData: WizardData,
  options: UsePlanPayloadBuilderOptions = { validateOnBuild: false }
): PayloadBuildResult {
  const { payload, isValid, errors, warnings } = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Basic Field Validation
    if (!wizardData.name || wizardData.name.trim() === "") {
      errors.push("플랜 그룹 이름이 필요합니다.");
    }
    
    // 기간 검증: 공통 검증 함수 사용
    const periodValidation = validatePeriod(wizardData, options.isCampMode ?? false);
    if (!periodValidation.isValid && periodValidation.error) {
      errors.push(periodValidation.error);
    }
    if (!wizardData.block_set_id) {
       // Note: block_set_id might be missing in 'Draft' mode or early stages, 
       // but for a final build it is usually required. 
       // However, PlanGroupCreationData allows it to be nullable/optional in some contexts, 
       // but typically strictly required for 'Active' plans. 
       // We'll treat it as required if validateOnBuild is strict, but here we just check presence.
       // errors.push("시간표 템플릿(Block Set)이 선택되지 않았습니다.");
    }

    // 2. Data Consistency Check (Using existing utility)
    const consistencyCheck = validateDataConsistency(wizardData);
    if (!consistencyCheck.valid) {
      errors.push(...consistencyCheck.errors);
    }

    // 3. Content Merging & Deduplication
    const allContents = [
      ...wizardData.student_contents,
      ...(wizardData.recommended_contents || []),
    ];

    const contentKeys = new Set<string>();
    // Relaxed type to allow extended properties during construction
    const uniqueContents: ExtendedPlanContentInput[] = [];
    const duplicateNames: string[] = [];

    allContents.forEach((c, idx) => {
      // Key by type + id
      const key = `${c.content_type}:${c.content_id}`;
      
        if (!contentKeys.has(key)) {
        contentKeys.add(key);
        // student_contents에는 추천 필드가 없고, recommended_contents에만 있으므로 옵셔널 체이닝 사용
        const contentWithExtras = c as typeof c & {
          is_auto_recommended?: boolean;
          recommendation_source?: "auto" | "admin" | "template" | null;
          recommendation_reason?: string | null;
          recommendation_metadata?: Record<string, unknown> | null;
          master_content_id?: string | null;
        };
        uniqueContents.push({ 
          ...contentWithExtras, 
          display_order: uniqueContents.length,
          title: contentWithExtras.title,
          subject_category: contentWithExtras.subject_category,
          subject: contentWithExtras.subject,
          is_auto_recommended: contentWithExtras.is_auto_recommended,
          recommendation_source: contentWithExtras.recommendation_source,
          recommendation_reason: contentWithExtras.recommendation_reason,
          recommendation_metadata: contentWithExtras.recommendation_metadata,
          master_content_id: contentWithExtras.master_content_id // Ensure master_content_id is included
        });
      } else {
        // Find existing to see if we should merge metadata
        // For now, simpler strategy: First come first serve (Student contents usually come first in the array concat)
        const existing = uniqueContents.find(u => `${u.content_type}:${u.content_id}` === key);
        if (existing) {
             // If the duplicate has specific recommendation reasons, maybe we want to keep them?
             // But usually student selection overrides or we just treat them as one.
             // We'll just warn.
             duplicateNames.push(c.title || c.content_id);
        }
      }
    });

    if (duplicateNames.length > 0) {
        // Technically this might not be a blocker for fetching, but for saving a plan it's better to be clean
        // warnings.push(`중복된 콘텐츠가 감지되어 하나로 통합되었습니다: ${duplicateNames.slice(0, 3).join(", ")}...`);
    }

    if (uniqueContents.length === 0 && options.validateOnBuild) {
        // Only error if strict
        // errors.push("최소 1개 이상의 콘텐츠가 필요합니다.");
    }

    // 4. Construct Scheduler Options (Legacy Support & New Structure)
    // We try to flatten where possible but must respect PlanGroupCreationData structure.
    
    // Construct base scheduler options
    let schedulerOptions: Record<string, any> = {
      ...(wizardData.scheduler_options || {}),
    };

    // Merge high-level fields into scheduler_options if they exist, to ensure backend receives them
    // properly formatted as expected by the legacy logic if strictly needed, 
    // OR just rely on the new top-level fields if the backend supports them.
    // Based on `syncWizardDataToCreationData` logic:
    schedulerOptions = mergeStudyReviewCycle(
      schedulerOptions,
      wizardData.study_review_cycle
    );
    if (wizardData.student_level) {
      schedulerOptions.student_level = wizardData.student_level;
    }
    if (wizardData.subject_allocations) {
      schedulerOptions.subject_allocations = wizardData.subject_allocations;
    }
    if (wizardData.content_allocations) {
        schedulerOptions.content_allocations = wizardData.content_allocations;
    }
    // Time settings merge (보호 필드 자동 보호)
    schedulerOptions = mergeTimeSettingsSafely(
      schedulerOptions,
      wizardData.time_settings
    );

    // 5. Construct Final Payload
    const finalPayload: PlanGroupCreationData = {
      name: wizardData.name || null,
      plan_purpose: (wizardData.plan_purpose as PlanPurpose) || "내신대비",
      scheduler_type: (wizardData.scheduler_type as "1730_timetable" | "") || "1730_timetable",
      
      period_start: wizardData.period_start,
      period_end: wizardData.period_end,
      target_date: wizardData.target_date || null,
      block_set_id: wizardData.block_set_id || null, // Allow null for drafts

      contents: uniqueContents.map((c): PlanContentInput => {
         // Determine master_content_id precedence
         let masterId = c.master_content_id;

         // If implicit from being a pure recommended content
         if (!masterId && c.is_auto_recommended) {
             // In auto recommendation, content_id is often the master id if it came from the master list
             masterId = c.content_id;
         }

         // 타입 안전하게 PlanContentInput에 정의된 필드만 포함
         // ExtendedPlanContentInput의 추가 필드(title, subject_category 등)는 제외
         const planContent: PlanContentInput = {
            content_type: c.content_type,
            content_id: c.content_id,
            master_content_id: masterId ?? null,
            start_range: c.start_range,
            end_range: c.end_range,
            start_detail_id: c.start_detail_id ?? null,
            end_detail_id: c.end_detail_id ?? null,
            display_order: c.display_order ?? undefined,
         };

         return planContent;
      }),

      exclusions: (wizardData.exclusions || []).map(e => ({
          exclusion_date: e.exclusion_date,
          exclusion_type: e.exclusion_type,
          reason: e.reason || null
      })),

      academy_schedules: (wizardData.academy_schedules || []).map(s => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          academy_name: s.academy_name,
          subject: s.subject,
          travel_time: s.travel_time,
          source: s.source,        // 일정 출처 보존
          is_locked: s.is_locked,  // 템플릿 잠금 여부 보존
      })),

      // Top Level Fields
      study_review_cycle: wizardData.study_review_cycle,
      student_level: wizardData.student_level,
      subject_allocations: wizardData.subject_allocations,
      additional_period_reallocation: wizardData.additional_period_reallocation,
      non_study_time_blocks: wizardData.non_study_time_blocks,
      
      // Scheduler Options (Legacy + Merged)
      scheduler_options: Object.keys(schedulerOptions).length > 0 ? schedulerOptions : null,

      // Constraints
      subject_constraints: wizardData.subject_constraints ? {
          ...wizardData.subject_constraints,
          required_subjects: wizardData.subject_constraints.required_subjects?.map(req => ({
              subject_category: req.subject_category,
              subject: req.subject_category, // fallback
              min_count: req.min_count,
              subjects_by_curriculum: req.subjects_by_curriculum?.filter(s => s.subject_id).map(s => ({
                  curriculum_revision_id: s.curriculum_revision_id,
                  subject_id: s.subject_id!,
                  subject_name: s.subject_name
              }))
          }))
      } : undefined,

      // Pre-calculated Daily Schedule (Step 2.5/6)
      daily_schedule: wizardData.daily_schedule || null,

      // Camp Props
      plan_type: wizardData.plan_type, 
      camp_template_id: wizardData.camp_template_id,
      camp_invitation_id: wizardData.camp_invitation_id,
    };

    return {
      payload: finalPayload,
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, [wizardData, options.validateOnBuild, options.isCampMode]);

  const build = () => {
    if (!isValid && options.validateOnBuild) {
        throw new PlanGroupError(
            `데이터 유효성 검증 실패: ${errors.join(", ")}`,
            PlanGroupErrorCodes.VALIDATION_FAILED,
            "입력된 데이터에 오류가 있어 저장할 수 없습니다."
        );
    }
    if (!payload) {
         throw new PlanGroupError(
            "Payload 생성 실패",
            PlanGroupErrorCodes.DATA_TRANSFORMATION_FAILED,
            ErrorUserMessages[PlanGroupErrorCodes.DATA_TRANSFORMATION_FAILED]
         );
    }
    return payload;
  };

  return { payload, isValid, errors, warnings, build };
}
