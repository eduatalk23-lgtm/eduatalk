/**
 * 플랜 그룹 위저드 단계별 검증 로직 통합
 * PlanValidator를 확장하여 위저드 특화 검증 제공
 */

import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { PlanValidator } from "./planValidator";
import { validateSubjectConstraints } from "@/lib/plan/1730TimetableLogic";
import type { ValidationResult } from "./planValidator";

type WizardStep = 1 | 2 | 2.5 | 3 | 4 | 5 | 6 | 7;

export class WizardValidator {
  /**
   * 특정 단계의 검증 수행
   */
  static validateStep(
    step: WizardStep,
    wizardData: WizardData
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (step) {
      case 1:
        return this.validateStep1(wizardData);
      case 2:
        return this.validateStep2(wizardData);
      case 2.5:
        return this.validateStep2_5(wizardData);
      case 3:
        return this.validateStep3(wizardData);
      case 4:
        return this.validateStep4(wizardData);
      case 5:
        return this.validateStep5(wizardData);
      case 6:
        return this.validateStep6(wizardData);
      case 7:
        return this.validateStep7(wizardData);
      default:
        return { valid: true, errors: [], warnings: [] };
    }
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
   * Step 4: 추천 콘텐츠 검증
   */
  private static validateStep4(wizardData: WizardData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const totalContents =
      wizardData.student_contents.length +
      wizardData.recommended_contents.length;

    // 최소 1개 이상의 콘텐츠 필요
    if (totalContents === 0) {
      errors.push("최소 1개 이상의 콘텐츠를 선택해주세요.");
    }

    // 추천 콘텐츠 범위 검증
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

    // 필수 과목 검증 (템플릿 설정에 따라 동적 처리)
    // enable_required_subjects_validation이 true이고 required_subjects가 설정된 경우에만 검증
    if (
      wizardData.subject_constraints?.enable_required_subjects_validation &&
      wizardData.subject_constraints?.required_subjects &&
      wizardData.subject_constraints.required_subjects.length > 0
    ) {
      const requiredSubjects = wizardData.subject_constraints.required_subjects;
      
      // 선택된 콘텐츠를 교과/과목별로 카운트
      const contentCountBySubject = new Map<string, number>();
      
      // 학생 콘텐츠 카운트
      wizardData.student_contents.forEach((sc) => {
        if (sc.subject_category) {
          // subject 필드는 레거시이므로 subject_category만 사용
          const key = sc.subject_category;
          contentCountBySubject.set(key, (contentCountBySubject.get(key) || 0) + 1);
        }
      });

      // 추천 콘텐츠 카운트
      wizardData.recommended_contents.forEach((rc) => {
        if (rc.subject_category) {
          // subject 필드는 레거시이므로 subject_category만 사용
          const key = rc.subject_category;
          contentCountBySubject.set(key, (contentCountBySubject.get(key) || 0) + 1);
        }
      });

      // 필수 과목 검증
      const missingRequiredSubjects: string[] = [];
      
      requiredSubjects.forEach((req) => {
        // 세부 과목이 지정된 경우: 정확히 일치하는 과목만 카운트
        // 세부 과목이 없는 경우: 교과만 일치하면 카운트
        let count = 0;
        
        if (req.subject) {
          // 세부 과목이 지정된 경우
          const exactKey = `${req.subject_category}:${req.subject}`;
          count = contentCountBySubject.get(exactKey) || 0;
        } else {
          // 교과만 지정된 경우: 해당 교과의 모든 콘텐츠 카운트
          contentCountBySubject.forEach((cnt, key) => {
            if (key.startsWith(req.subject_category + ":") || key === req.subject_category) {
              count += cnt;
            }
          });
        }
        
        if (count < req.min_count) {
          const displayName = req.subject 
            ? `${req.subject_category} - ${req.subject}` 
            : req.subject_category;
          missingRequiredSubjects.push(
            `${displayName} (최소 ${req.min_count}개 필요, 현재 ${count}개)`
          );
        }
      });

      if (missingRequiredSubjects.length > 0) {
        errors.push(
          `다음 필수 과목의 최소 개수 조건을 만족하지 않습니다:\n${missingRequiredSubjects.join("\n")}`
        );
      }
    }

    return { valid: errors.length === 0, errors, warnings };
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
      // subject_allocations 필수 검증
      if (
        !wizardData.subject_allocations ||
        wizardData.subject_allocations.length === 0
      ) {
        errors.push("전략과목/취약과목 정보를 설정해주세요.");
      } else {
        // subject_allocations의 모든 과목이 콘텐츠에 포함되어 있는지 검증
        const allocatedSubjects = new Set(
          wizardData.subject_allocations.map((a) => a.subject_name)
        );
        const contentSubjects = new Set([
          ...wizardData.student_contents
            .map((c) => c.subject_category)
            .filter(Boolean),
          ...wizardData.recommended_contents
            .map((c) => c.subject_category)
            .filter(Boolean),
        ]);

        const missingSubjects = Array.from(allocatedSubjects).filter(
          (subject) => !contentSubjects.has(subject)
        );

        if (missingSubjects.length > 0) {
          errors.push(
            `다음 과목의 콘텐츠를 선택해주세요: ${missingSubjects.join(", ")}`
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

      const constraintValidation = validateSubjectConstraints(
        allContents.map((c) => ({
          subject_id: c.subject_category || "",
          subject_name: c.subject_category || "",
        })),
        wizardData.subject_constraints
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
    const step4 = this.validateStep4(wizardData);
    const step6 = this.validateStep6(wizardData);

    errors.push(...step1.errors, ...step2.errors, ...step4.errors, ...step6.errors);
    warnings.push(
      ...step1.warnings,
      ...step2.warnings,
      ...step4.warnings,
      ...step6.warnings
    );

    return {
      valid: errors.length === 0,
      errors: [...new Set(errors)], // 중복 제거
      warnings: [...new Set(warnings)],
    };
  }
}

