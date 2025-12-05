/**
 * 템플릿 데이터와 학생 입력 데이터를 병합하는 유틸리티
 */

import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";

/**
 * 템플릿 데이터와 학생 입력 데이터를 병합합니다.
 * 
 * 병합 규칙:
 * 1. 템플릿 데이터를 기본값으로 사용
 * 2. 학생 입력 데이터가 있으면 우선 적용
 * 3. 제외일과 학원 일정은 템플릿 기본값 + 학생 추가 항목으로 병합
 * 4. 잠금 필드가 있는 경우 템플릿 값 유지
 * 
 * @param templateData 템플릿 데이터
 * @param studentInput 학생 입력 데이터
 * @param templateBlockSetId 템플릿 블록 세트 ID (옵션)
 * @returns 병합된 WizardData
 */
export function mergeTemplateDataWithStudentInput(
  templateData: Partial<WizardData>,
  studentInput: Partial<WizardData>,
  templateBlockSetId?: string | null
): Partial<WizardData> {
  // 템플릿 제외일 추출 (source가 "template"인 항목)
  const templateExclusions = (templateData.exclusions || []).filter(
    (e) => e.source === "template"
  );

  // 템플릿 학원 일정 추출 (source가 "template"인 항목)
  const templateAcademySchedules = (templateData.academy_schedules || []).filter(
    (s) => s.source === "template"
  );

  // 학생 입력 제외일 (템플릿 제외일 제외, 중복 제거)
  const studentExclusions = (studentInput.exclusions || []).filter(
    (e) =>
      e.source !== "template" &&
      !templateExclusions.some(
        (te) => te.exclusion_date === e.exclusion_date
      )
  );

  // 학생 입력 학원 일정 (템플릿 학원 일정 제외)
  const studentAcademySchedules = (studentInput.academy_schedules || []).filter(
    (s) => s.source !== "template"
  );

  // 병합된 데이터 생성
  const mergedData: Partial<WizardData> = {
    ...templateData,
    // 학생이 입력하는 필드는 studentInput 우선
    name: studentInput.name || templateData.name || "",
    plan_purpose: studentInput.plan_purpose || templateData.plan_purpose || "",
    scheduler_type:
      studentInput.scheduler_type || templateData.scheduler_type || "1730_timetable",
    period_start: studentInput.period_start || templateData.period_start || "",
    period_end: studentInput.period_end || templateData.period_end || "",
    block_set_id: studentInput.block_set_id || templateBlockSetId || "",
    // 제외일: 템플릿 기본값 + 학생 추가 제외일
    exclusions: [...templateExclusions, ...studentExclusions],
    // 학원 일정: 템플릿 기본값 + 학생 추가 학원 일정
    academy_schedules: [...templateAcademySchedules, ...studentAcademySchedules],
    // 학생 콘텐츠는 학생 입력만 사용
    student_contents: studentInput.student_contents || [],
    // 추천 콘텐츠는 템플릿 데이터 사용
    recommended_contents: templateData.recommended_contents || [],
    // 캠프 모드: 전략과목/취약과목 설정은 관리자 검토 후 설정하므로 undefined
    subject_allocations: undefined,
    student_level:
      studentInput.student_level || templateData.student_level || undefined,
    // 기타 필드들도 studentInput 우선
    time_settings: studentInput.time_settings || templateData.time_settings,
    scheduler_options:
      studentInput.scheduler_options || templateData.scheduler_options,
    study_review_cycle:
      studentInput.study_review_cycle || templateData.study_review_cycle,
    // 템플릿 잠금 필드 정보 유지
    templateLockedFields: templateData.templateLockedFields,
  };

  return mergedData;
}

/**
 * 템플릿 잠금 필드를 적용합니다.
 * 잠금 필드가 설정된 경우 템플릿 값을 유지하고 학생 입력을 무시합니다.
 * 
 * @param templateData 템플릿 데이터
 * @param studentInput 학생 입력 데이터
 * @param lockedFields 잠금 필드 설정
 * @returns 잠금 필드가 적용된 데이터
 */
export function applyTemplateLockedFields(
  templateData: Partial<WizardData>,
  studentInput: Partial<WizardData>,
  lockedFields?: WizardData["templateLockedFields"]
): Partial<WizardData> {
  if (!lockedFields) {
    return studentInput;
  }

  const result: Partial<WizardData> = { ...studentInput };

  // Step 1 잠금 필드 적용
  if (lockedFields.step1) {
    const step1 = lockedFields.step1;

    // 필드 고정
    if (step1.name === true) {
      result.name = templateData.name || "";
    }
    if (step1.plan_purpose === true) {
      result.plan_purpose = templateData.plan_purpose || "";
    }
    if (step1.scheduler_type === true) {
      result.scheduler_type = templateData.scheduler_type || "1730_timetable";
    }
    if (step1.period_start === true) {
      result.period_start = templateData.period_start || "";
    }
    if (step1.period_end === true) {
      result.period_end = templateData.period_end || "";
    }
    if (step1.block_set_id === true) {
      result.block_set_id = templateData.block_set_id || "";
    }
    if (step1.student_level === true) {
      result.student_level = templateData.student_level;
    }
    if (step1.subject_allocations === true) {
      result.subject_allocations = templateData.subject_allocations;
    }
    if (step1.study_review_cycle === true) {
      result.study_review_cycle = templateData.study_review_cycle;
    }
  }

  // Step 2 잠금 필드 적용
  if (lockedFields.step2) {
    const step2 = lockedFields.step2;

    // 제외일 고정
    if (step2.exclusions === true) {
      result.exclusions = templateData.exclusions || [];
    } else if (step2.exclusion_items && step2.exclusion_items.length > 0) {
      // 특정 제외일만 고정
      const templateExclusions = (templateData.exclusions || []).filter((e) =>
        step2.exclusion_items!.includes(e.exclusion_date)
      );
      const studentExclusions = (studentInput.exclusions || []).filter(
        (e) => !step2.exclusion_items!.includes(e.exclusion_date)
      );
      result.exclusions = [...templateExclusions, ...studentExclusions];
    }

    // 학원 일정 고정
    if (step2.academy_schedules === true) {
      result.academy_schedules = templateData.academy_schedules || [];
    } else if (step2.academy_schedule_items && step2.academy_schedule_items.length > 0) {
      // 특정 학원 일정만 고정 (구현 필요 시 추가)
      result.academy_schedules = studentInput.academy_schedules || [];
    }

    // 시간 설정 고정
    if (step2.time_settings === true) {
      result.time_settings = templateData.time_settings;
    } else if (
      step2.time_settings_fields &&
      step2.time_settings_fields.length > 0
    ) {
      // 특정 시간 설정 필드만 고정 (구현 필요 시 추가)
      result.time_settings = studentInput.time_settings || templateData.time_settings;
    }
  }

  // Step 3 잠금 필드 적용
  if (lockedFields.step3) {
    const step3 = lockedFields.step3;

    // 학생 콘텐츠 고정
    if (step3.student_contents === true) {
      result.student_contents = templateData.student_contents || [];
    } else if (
      step3.student_content_items &&
      step3.student_content_items.length > 0
    ) {
      // 특정 콘텐츠만 고정 (구현 필요 시 추가)
      result.student_contents = studentInput.student_contents || [];
    }
  }

  return result;
}

/**
 * 병합된 데이터의 유효성을 검증합니다.
 * 
 * @param mergedData 병합된 데이터
 * @returns 검증 에러 메시지 배열 (빈 배열이면 유효함)
 */
export function validateMergedData(
  mergedData: Partial<WizardData>
): string[] {
  const errors: string[] = [];

  // 필수 필드 검증
  if (!mergedData.name || mergedData.name.trim() === "") {
    errors.push("플랜 이름을 입력해주세요.");
  }

  if (!mergedData.period_start) {
    errors.push("시작일을 입력해주세요.");
  }

  if (!mergedData.period_end) {
    errors.push("종료일을 입력해주세요.");
  }

  if (mergedData.period_start && mergedData.period_end) {
    const start = new Date(mergedData.period_start);
    const end = new Date(mergedData.period_end);
    if (start > end) {
      errors.push("시작일이 종료일보다 늦을 수 없습니다.");
    }
  }

  // 블록 세트 검증
  // plan_type은 WizardData에 없으므로 block_set_id만 체크
  if (!mergedData.block_set_id) {
    errors.push("블록 세트를 선택해주세요.");
  }

  // 콘텐츠 검증
  const totalContents =
    (mergedData.student_contents?.length || 0) +
    (mergedData.recommended_contents?.length || 0);
  if (totalContents === 0) {
    errors.push("최소 1개 이상의 콘텐츠를 선택해주세요.");
  }

  return errors;
}

