/**
 * 플랜 그룹 위저드 단계별 검증 로직 통합
 * PlanValidator를 확장하여 위저드 특화 검증 제공
 * 
 * 검증 전략:
 * 1. Zod 스키마로 기본 타입 및 형식 검증
 * 2. WizardValidator로 비즈니스 로직 검증
 */

import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { PlanValidator } from "./planValidator";
import { validateSubjectConstraints } from "@/lib/plan/1730TimetableLogic";
import type { ValidationResult } from "./planValidator";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  step7Schema,
  validatePartialWizardDataSafe,
} from "@/lib/schemas/planWizardSchema";
import { defaultRangeRecommendationConfig } from "@/lib/recommendations/config/defaultConfig";

type WizardStep = 1 | 2 | 2.5 | 3 | 4 | 5 | 6 | 7;

export class WizardValidator {
  /**
   * 특정 단계의 검증 수행
   * 
   * 검증 순서:
   * 1. Zod 스키마로 기본 검증 (타입, 형식)
   * 2. 비즈니스 로직 검증 (WizardValidator)
   */
  static validateStep(
    step: WizardStep,
    wizardData: WizardData
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Zod 스키마로 기본 검증 수행
    const zodValidation = this.validateStepWithZod(step, wizardData);
    if (!zodValidation.valid) {
      errors.push(...zodValidation.errors);
      warnings.push(...zodValidation.warnings);
    }

    // 비즈니스 로직 검증 수행
    let businessValidation: ValidationResult;
    switch (step) {
      case 1:
        businessValidation = this.validateStep1(wizardData);
        break;
      case 2:
        businessValidation = this.validateStep2(wizardData);
        break;
      case 2.5:
        businessValidation = this.validateStep2_5(wizardData);
        break;
      case 3:
        businessValidation = this.validateStep3(wizardData);
        break;
      case 4:
        businessValidation = this.validateStep4(wizardData);
        break;
      case 5:
        businessValidation = this.validateStep5(wizardData);
        break;
      case 6:
        businessValidation = this.validateStep6(wizardData);
        break;
      case 7:
        businessValidation = this.validateStep7(wizardData);
        break;
      default:
        businessValidation = { valid: true, errors: [], warnings: [] };
    }

    errors.push(...businessValidation.errors);
    warnings.push(...businessValidation.warnings);

    return {
      valid: errors.length === 0,
      errors: [...new Set(errors)], // 중복 제거
      warnings: [...new Set(warnings)],
    };
  }

  /**
   * Zod 스키마로 단계별 기본 검증 수행
   */
  private static validateStepWithZod(
    step: WizardStep,
    wizardData: WizardData
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    let schema;
    switch (step) {
      case 1:
        schema = step1Schema;
        break;
      case 2:
        schema = step2Schema;
        break;
      case 2.5:
        schema = step3Schema; // Step 2.5는 Step 3 스키마 사용
        break;
      case 3:
        schema = step3Schema;
        break;
      case 4:
        schema = step4Schema;
        break;
      case 5:
        schema = step5Schema;
        break;
      case 6:
        schema = step6Schema;
        break;
      case 7:
        schema = step7Schema;
        break;
      default:
        return { valid: true, errors: [], warnings: [] };
    }

    // 부분 스키마로 검증 (일부 필드만 있을 수 있음)
    const validation = validatePartialWizardDataSafe(wizardData);
    if (!validation.success) {
      // Zod 에러를 사용자 친화적인 메시지로 변환
      validation.error.errors.forEach((err) => {
        const path = err.path.join(".");
        const message = err.message;
        // 해당 단계의 필드인지 확인
        const stepFields = Object.keys(schema.shape);
        if (stepFields.some((field) => path.startsWith(field))) {
          errors.push(`${path}: ${message}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Step 1: 기본 정보 검증
   */
  private static validateStep1(wizardData: WizardData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 필수 필드 검증
    if (!wizardData.name || wizardData.name.trim() === "") {
      errors.push("플랜 이름을 입력해주세요.");
    }

    // 플랜 목적: 템플릿 모드에서 학생 입력 허용이 체크되어 있으면 필수 아님
    const isStudentInputAllowed = wizardData.templateLockedFields?.step1?.allow_student_plan_purpose === true;
    if (!isStudentInputAllowed && !wizardData.plan_purpose) {
      errors.push("플랜 목적을 선택해주세요.");
    }

    if (!wizardData.scheduler_type) {
      errors.push("스케줄러 유형을 선택해주세요.");
    }

    if (!wizardData.period_start || !wizardData.period_end) {
      errors.push("학습 기간을 설정해주세요.");
    } else {
      const periodValidation = PlanValidator.validatePeriod(
        wizardData.period_start,
        wizardData.period_end
      );
      errors.push(...periodValidation.errors);
      warnings.push(...periodValidation.warnings);
    }

    // 블록 세트는 기본값 옵션이 추가되어 검증 제거

    // 학생 수준 항목이 삭제되어 검증 제거

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Step 2: 블록 및 제외일 검증
   */
  private static validateStep2(wizardData: WizardData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 제외일 검증
    if (wizardData.exclusions.length > 0) {
      const exclusionValidation = PlanValidator.validateExclusions(
        wizardData.period_start,
        wizardData.period_end,
        wizardData.exclusions
      );
      errors.push(...exclusionValidation.errors);
      warnings.push(...exclusionValidation.warnings);
    }

    // 학원 일정 검증
    if (wizardData.academy_schedules.length > 0) {
      const academyValidation = PlanValidator.validateAcademySchedules(
        wizardData.academy_schedules
      );
      errors.push(...academyValidation.errors);
      warnings.push(...academyValidation.warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Step 2.5: 스케줄 확인 검증
   */
  private static validateStep2_5(wizardData: WizardData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // daily_schedule이 있는지 확인
    if (!wizardData.daily_schedule || wizardData.daily_schedule.length === 0) {
      warnings.push("스케줄 정보가 없습니다. 이전 단계로 돌아가 스케줄을 확인해주세요.");
    }

    // schedule_summary가 있는지 확인
    if (!wizardData.schedule_summary) {
      warnings.push("스케줄 요약 정보가 없습니다.");
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Step 3: 학생 콘텐츠 검증
   */
  private static validateStep3(wizardData: WizardData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 학생 콘텐츠는 선택사항이지만, 범위 검증은 수행
    wizardData.student_contents.forEach((content, index) => {
      if (content.start_range >= content.end_range) {
        errors.push(
          `학생 콘텐츠 ${index + 1}: 시작 범위는 종료 범위보다 작아야 합니다.`
        );
      }

      if (content.start_range < 0 || content.end_range < 0) {
        errors.push(`학생 콘텐츠 ${index + 1}: 범위는 0 이상이어야 합니다.`);
      }
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Step 4: 콘텐츠 선택 검증
   * 블록 및 제외일 단계(Step 2)에서 이미 검증이 완료되었으므로 검증 제거
   */
  private static validateStep4(wizardData: WizardData): ValidationResult {
    // 검증 로직 제거 (사용자 요청에 따라)
    return { valid: true, errors: [], warnings: [] };
  }

  /**
   * Step 5: 추천 콘텐츠 추가 및 제약 조건 검증
   * - 추천 콘텐츠 검증 (Step 4와 동일)
   * - 취약과목/전략과목 설정 검증
   * - 필수 교과 검증 (subject_constraints)
   * - 콘텐츠와 subject_allocations 일치 검증
   */
  private static validateStep5(wizardData: WizardData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Step 4 검증 재수행 (추천 콘텐츠 기본 검증)
    const step4Validation = this.validateStep4(wizardData);
    errors.push(...step4Validation.errors);
    warnings.push(...step4Validation.warnings);

    // 1730 Timetable인 경우 제약 조건 검증
    if (wizardData.scheduler_type === "1730_timetable") {
      // content_allocations 또는 subject_allocations 중 하나라도 있어야 함
      const hasContentAllocations =
        wizardData.content_allocations &&
        wizardData.content_allocations.length > 0;
      const hasSubjectAllocations =
        wizardData.subject_allocations &&
        wizardData.subject_allocations.length > 0;

      if (!hasContentAllocations && !hasSubjectAllocations) {
        errors.push("전략과목/취약과목 정보를 설정해주세요.");
      } else if (hasSubjectAllocations) {
        // subject_allocations가 있을 때만 교과 일치 검증 수행
        // subject_allocations의 모든 교과가 콘텐츠에 포함되어 있는지 검증
        // subject_id가 있으면 subject_id로 매칭, 없으면 subject_category로 매칭
        const allocatedSubjects = new Map<string, { name: string; id?: string }>();
        (wizardData.subject_allocations || []).forEach((a) => {
          allocatedSubjects.set(a.subject_name, {
            name: a.subject_name,
            id: a.subject_id,
          });
        });

        // 콘텐츠에서 subject와 subject_category 수집
        const contentSubjects = new Set<string>();
        const contentSubjectCategories = new Set<string>();

        [...wizardData.student_contents, ...wizardData.recommended_contents].forEach((c) => {
          // subject가 있으면 추가
          if (c.subject) {
            contentSubjects.add(c.subject);
          }
          // subject_category가 있으면 추가
          if (c.subject_category) {
            contentSubjectCategories.add(c.subject_category);
          }
        });

        // 매칭되지 않는 교과 찾기
        const missingSubjects: string[] = [];
        allocatedSubjects.forEach((allocated, subjectName) => {
          // 1. subject로 매칭 시도
          if (contentSubjects.has(subjectName)) {
            return; // 매칭됨
          }

          // 2. subject_name이 subject_category와 정확히 일치하는지 확인
          if (contentSubjectCategories.has(subjectName)) {
            return; // 매칭됨
          }
          
          // 3. subject_name이 subject_category에 포함되는지 확인 (부분 매칭)
          // 예: "수학"이 "수학I", "수학II" 등에 포함되는지 확인
          const hasMatchingCategory = Array.from(contentSubjectCategories).some(
            (category) => category && category.includes(subjectName)
          );
          if (hasMatchingCategory) {
            return; // 매칭됨
          }
          
          // 4. subject_category가 subject_name에 포함되는지 확인 (역방향)
          // 예: "수학"이 "수학I"에 포함되는지 확인
          const hasMatchingName = Array.from(contentSubjectCategories).some(
            (category) => subjectName && category && subjectName.includes(category)
          );
          if (hasMatchingName) {
            return; // 매칭됨
          }
          
          // 모든 매칭 시도 실패
          missingSubjects.push(subjectName);
        });

        if (missingSubjects.length > 0) {
          errors.push(
            `다음 교과의 콘텐츠를 선택해주세요: ${missingSubjects.join(", ")}`
          );
        }
      }

      // study_review_cycle 검증
      const studyDays =
        wizardData.study_review_cycle?.study_days ||
        wizardData.scheduler_options?.study_days ||
        6;
      const reviewDays =
        wizardData.study_review_cycle?.review_days ||
        wizardData.scheduler_options?.review_days ||
        1;

      if (studyDays < 1 || studyDays > 7) {
        errors.push("학습일 수는 1일 이상 7일 이하여야 합니다.");
      }
      if (reviewDays < 1 || reviewDays > 7) {
        errors.push("복습일 수는 1일 이상 7일 이하여야 합니다.");
      }
      if (studyDays + reviewDays > 7) {
        errors.push("학습일 수와 복습일 수의 합은 7일 이하여야 합니다.");
      }
    }

    // subject_constraints 검증
    if (wizardData.subject_constraints) {
      const allContents = [
        ...wizardData.student_contents,
        ...wizardData.recommended_contents,
      ];

      // WizardData의 subject_constraints를 SubjectConstraints 타입으로 변환
      const subjectConstraints: import("@/lib/types/plan").SubjectConstraints | undefined = wizardData.subject_constraints
        ? {
            required_subjects: wizardData.subject_constraints.required_subjects?.map((req) => ({
              subject_category: req.subject_category,
              subject: req.subject_category, // fallback
              min_count: req.min_count,
              subjects_by_curriculum: req.subjects_by_curriculum
                ?.filter((s) => s.subject_id) // subject_id가 있는 것만 필터링
                .map((s) => ({
                  curriculum_revision_id: s.curriculum_revision_id,
                  subject_id: s.subject_id!, // 필터링했으므로 non-null assertion 가능
                  subject_name: s.subject_name,
                })),
            })),
            excluded_subjects: wizardData.subject_constraints.excluded_subjects,
            constraint_handling: wizardData.subject_constraints.constraint_handling,
          }
        : undefined;

      if (!subjectConstraints) {
        // subject_constraints가 없으면 검증 통과
        return { valid: true, errors: [], warnings: [] };
      }

      const constraintValidation = validateSubjectConstraints(
        allContents.map((c) => ({
          subject_id: c.subject_category || "",
          subject_name: c.subject_category || "",
          detail_subject: c.subject || undefined, // 세부 과목 추가
        })),
        subjectConstraints
      );

      if (!constraintValidation.valid) {
        if (
          wizardData.subject_constraints.constraint_handling === "strict"
        ) {
          errors.push(...constraintValidation.errors);
        } else {
          warnings.push(...constraintValidation.errors);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Step 6: 학습 분량 조절 검증
   * - 제약 조건 검증은 Step 5에서 완료된 상태
   * - 학습 분량(범위) 관련 검증만 수행
   */
  private static validateStep6(wizardData: WizardData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 최소 1개 이상의 콘텐츠 필요
    const totalContents =
      wizardData.student_contents.length +
      wizardData.recommended_contents.length;
    if (totalContents === 0) {
      errors.push("최소 1개 이상의 콘텐츠를 선택해주세요.");
    }

    // 학습 분량 범위 검증
    wizardData.student_contents.forEach((content, index) => {
      if (content.start_range >= content.end_range) {
        errors.push(
          `학생 콘텐츠 ${index + 1}: 시작 범위는 종료 범위보다 작아야 합니다.`
        );
      }

      if (content.start_range < 0 || content.end_range < 0) {
        errors.push(`학생 콘텐츠 ${index + 1}: 범위는 0 이상이어야 합니다.`);
      }
    });

    wizardData.recommended_contents.forEach((content, index) => {
      if (content.start_range >= content.end_range) {
        errors.push(
          `추천 콘텐츠 ${index + 1}: 시작 범위는 종료 범위보다 작아야 합니다.`
        );
      }

      if (content.start_range < 0 || content.end_range < 0) {
        errors.push(`추천 콘텐츠 ${index + 1}: 범위는 0 이상이어야 합니다.`);
      }
    });

    // 학습 분량 적정성 검증 (schedule_summary가 있는 경우)
    if (wizardData.schedule_summary) {
      const { total_study_days, total_study_hours } = wizardData.schedule_summary;
      
      // 총 학습 분량 계산 (페이지 및 회차)
      let totalPages = 0;
      let totalEpisodes = 0;
      
      [...wizardData.student_contents, ...wizardData.recommended_contents].forEach((content) => {
        const range = content.end_range - content.start_range;
        if (content.content_type === "book") {
          totalPages += range;
        } else if (content.content_type === "lecture") {
          totalEpisodes += range;
        }
      });
      
      // 예상 소요 일수 계산
      const avgDailyHours = total_study_days > 0 ? total_study_hours / total_study_days : 0;
      const pagesPerHour = defaultRangeRecommendationConfig.pagesPerHour;
      const episodesPerHour = defaultRangeRecommendationConfig.episodesPerHour;
      const totalDailyPages = Math.round(avgDailyHours * pagesPerHour);
      const totalDailyEpisodes = Math.round(avgDailyHours * episodesPerHour);
      
      let estimatedDays = 0;
      if (totalPages > 0 && totalDailyPages > 0) {
        estimatedDays = Math.ceil(totalPages / totalDailyPages);
      }
      if (totalEpisodes > 0 && totalDailyEpisodes > 0) {
        const episodeDays = Math.ceil(totalEpisodes / totalDailyEpisodes);
        estimatedDays = Math.max(estimatedDays, episodeDays);
      }
      
      // 예상 소요 일수가 총 학습일 수를 초과하는 경우 경고
      if (estimatedDays > total_study_days && total_study_days > 0) {
        warnings.push(
          `예상 소요 일수(${estimatedDays}일)가 총 학습일 수(${total_study_days}일)를 초과합니다. 학습 분량을 조정하는 것을 권장합니다.`
        );
      }
      
      // 학습 분량이 과도하게 적은 경우 경고 (예상 소요 일수가 총 학습일 수의 50% 미만)
      if (estimatedDays > 0 && total_study_days > 0 && estimatedDays < total_study_days * 0.5) {
        warnings.push(
          `예상 소요 일수(${estimatedDays}일)가 총 학습일 수(${total_study_days}일)의 50% 미만입니다. 학습 분량을 늘리는 것을 고려해보세요.`
        );
      }
      
      // 학습 분량이 과도하게 많은 경우 경고 (예상 소요 일수가 총 학습일 수의 150% 초과)
      if (estimatedDays > total_study_days * 1.5 && total_study_days > 0) {
        warnings.push(
          `예상 소요 일수(${estimatedDays}일)가 총 학습일 수(${total_study_days}일)의 150%를 초과합니다. 학습 분량이 과도할 수 있습니다.`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Step 7: 스케줄 결과 검증
   */
  private static validateStep7(wizardData: WizardData): ValidationResult {
    // Step 7은 결과 표시 단계이므로 검증 불필요
    return { valid: true, errors: [], warnings: [] };
  }

  /**
   * 전체 위저드 데이터 검증 (최종 제출 전)
   */
  static validateAll(wizardData: WizardData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 각 단계별 검증 수행
    const step1 = this.validateStep1(wizardData);
    const step2 = this.validateStep2(wizardData);
    // Step 4 검증 제거 (블록 및 제외일 단계에서 이미 검증 완료)
    const step6 = this.validateStep6(wizardData);

    errors.push(...step1.errors, ...step2.errors, ...step6.errors);
    warnings.push(
      ...step1.warnings,
      ...step2.warnings,
      ...step6.warnings
    );

    return {
      valid: errors.length === 0,
      errors: [...new Set(errors)], // 중복 제거
      warnings: [...new Set(warnings)],
    };
  }
}

