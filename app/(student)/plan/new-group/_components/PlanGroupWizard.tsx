"use client";

import { useState, useTransition, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { debounce } from "@/lib/utils/performance";
import { getActivePlanGroups } from "@/app/(student)/actions/planGroupActions";
import { PlanGroupActivationDialog } from "./PlanGroupActivationDialog";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createPlanGroupAction,
  savePlanGroupDraftAction,
  updatePlanGroupDraftAction,
  updatePlanGroupAction,
  generatePlansFromGroupAction,
  updatePlanGroupStatus,
  checkPlansExistAction,
} from "@/app/(student)/actions/planGroupActions";
import { updateCampTemplateAction } from "@/app/(admin)/actions/campTemplateActions";
import { PlanGroupCreationData } from "@/lib/types/plan";
import { WizardValidator } from "@/lib/validation/wizardValidator";
import { PlanValidator } from "@/lib/validation/planValidator";
import { syncWizardDataToCreationData, validateDataConsistency } from "@/lib/utils/planGroupDataSync";
import { PlanGroupError, toPlanGroupError, isRecoverableError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";
import { Step1BasicInfo } from "./Step1BasicInfo";
import { Step2TimeSettingsWithPreview } from "./Step2TimeSettingsWithPreview";
import { Step3ContentSelection } from "./Step3ContentSelection";
import { Step6FinalReview } from "./Step6FinalReview";
import { Step7ScheduleResult } from "./Step7ScheduleResult";
import { TemplateWizardChecklist } from "@/app/(admin)/admin/camp-templates/_components/TemplateWizardChecklist";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export type WizardData = {
  // Step 1
  name: string;
  plan_purpose: "내신대비" | "모의고사(수능)" | "";
  scheduler_type: "1730_timetable" | "";
  scheduler_options?: {
    study_days?: number;
    review_days?: number;
  };
  period_start: string;
  period_end: string;
  target_date?: string;
  block_set_id: string;
  // Step 2
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
    reason?: string;
    source?: "template" | "student" | "time_management"; // 출처 구분
    is_locked?: boolean; // 템플릿에서 고정된 제외일
  }>;
  academy_schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string;
    subject?: string;
    travel_time?: number; // 이동시간 (분 단위, 기본값: 60분)
    source?: "template" | "student" | "time_management"; // 출처 구분
    is_locked?: boolean; // 템플릿에서 고정된 학원 일정
  }>;
  // Step 2 - 시간 설정
  time_settings?: {
    lunch_time?: {
      start: string; // "12:00"
      end: string; // "13:00"
    };
    // 1730 Timetable 전용 설정
    camp_study_hours?: {
      start: string; // "10:00"
      end: string; // "19:00"
    };
    camp_self_study_hours?: {
      start: string; // "19:00"
      end: string; // "22:00"
    };
    designated_holiday_hours?: {
      start: string; // "13:00"
      end: string; // "19:00"
    };
    // 자율학습시간 사용 가능 (학생/등록 시간블록과 조율)
    use_self_study_with_blocks?: boolean;
    // 자율학습 시간 배정 토글
    enable_self_study_for_holidays?: boolean; // 지정휴일 자율학습 시간 배정
    enable_self_study_for_study_days?: boolean; // 학습일/복습일 자율학습 시간 배정
  };
  // Step 3 - 학생 콘텐츠
  student_contents: Array<{
    content_type: "book" | "lecture";
    content_id: string;
    start_range: number;
    end_range: number;
    start_detail_id?: string | null; // 시작 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)
    end_detail_id?: string | null; // 종료 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)
    title?: string; // 추가: 제목 저장
    subject_category?: string; // 추가: 과목 카테고리 저장 (필수 과목 검증용)
    master_content_id?: string | null; // 추가: 마스터 콘텐츠 ID (중복 방지용)
  }>;
  // Step 4 - 추천 콘텐츠
  recommended_contents: Array<{
    content_type: "book" | "lecture";
    content_id: string;
    start_range: number;
    end_range: number;
    start_detail_id?: string | null; // 시작 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)
    end_detail_id?: string | null; // 종료 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)
    title?: string; // 추가: 제목 저장
    subject_category?: string; // 추가: 과목 카테고리 저장 (필수 과목 검증용)
  }>;
  // Step 2.5 - 스케줄 요약 정보 (Step 3에서 학습 범위 추천에 사용)
  schedule_summary?: {
    total_days: number;
    total_study_days: number;
    total_review_days: number;
    total_study_hours: number;
    total_study_hours_학습일: number;
    total_study_hours_복습일: number;
    total_self_study_hours: number;
  };
  // Step 2.5 - 일별 스케줄 정보 (plan_groups.daily_schedule에 저장)
  daily_schedule?: Array<{
    date: string;
    day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정";
    study_hours: number;
    available_time_ranges: Array<{ start: string; end: string }>;
    note: string;
    academy_schedules?: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      academy_name?: string;
      subject?: string;
      travel_time?: number;
    }>;
    exclusion?: {
      exclusion_date: string;
      exclusion_type: string;
      reason?: string;
    } | null;
    week_number?: number;
    time_slots?: Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>;
  }>;
  // 1730 Timetable 추가 필드
  study_review_cycle?: {
    study_days: number; // 기본값: 6
    review_days: number; // 기본값: 1
  };
  // 학생 수준 정보 (필수)
  student_level?: "high" | "medium" | "low";
  // 전략과목/취약과목 정보 (필수)
  subject_allocations?: Array<{
    subject_id: string;
    subject_name: string;
    subject_type: "strategy" | "weakness";
    weekly_days?: number; // 전략과목인 경우: 2, 3, 4
  }>;
  subject_constraints?: {
    enable_required_subjects_validation?: boolean; // 필수 과목 검증 사용 여부 (템플릿 모드에서 설정)
    required_subjects?: Array<{
      subject_category: string; // 교과 (예: 국어, 수학, 영어)
      subject?: string; // 세부 과목 (선택사항)
      min_count: number; // 최소 개수
    }>; // 필수 교과/과목 목록 (위계 구조 + 개수)
    excluded_subjects?: string[];
    constraint_handling: "strict" | "warning" | "auto_fix";
  };
  additional_period_reallocation?: {
    period_start: string;
    period_end: string;
    type: "additional_review";
    original_period_start: string;
    original_period_end: string;
    subjects?: string[];
    review_of_review_factor?: number; // 기본값: 0.25
  };
  non_study_time_blocks?: Array<{
    type: "아침식사" | "저녁식사" | "수면" | "기타"; // "점심식사" 제거
    start_time: string; // HH:mm
    end_time: string; // HH:mm
    day_of_week?: number[]; // 0-6, 없으면 매일
    description?: string;
  }>;
  // 템플릿 고정 필드 (템플릿 모드에서만 사용)
  templateLockedFields?: {
    // Step 1 고정 필드
    step1?: {
      name?: boolean;
      plan_purpose?: boolean;
      scheduler_type?: boolean;
      period_start?: boolean;
      period_end?: boolean;
      block_set_id?: boolean;
      student_level?: boolean;
      subject_allocations?: boolean;
      study_review_cycle?: boolean;
      // 학생 입력 허용 필드
      allow_student_name?: boolean;
      allow_student_plan_purpose?: boolean;
      allow_student_scheduler_type?: boolean;
      allow_student_period?: boolean; // period_start, period_end 통합
      allow_student_block_set_id?: boolean;
      allow_student_student_level?: boolean;
      allow_student_subject_allocations?: boolean;
      allow_student_study_review_cycle?: boolean;
      allow_student_additional_period_reallocation?: boolean;
    };
    // Step 2 고정 필드
    step2?: {
      exclusions?: boolean; // 전체 제외일 고정
      exclusion_items?: string[]; // 특정 제외일 ID 배열 (exclusion_date 기준)
      academy_schedules?: boolean; // 전체 학원 일정 고정
      academy_schedule_items?: string[]; // 특정 학원 일정 ID 배열
      time_settings?: boolean; // 전체 시간 설정 고정
      time_settings_fields?: string[]; // 특정 시간 설정 필드 배열
      // 신규 필드
      non_study_time_blocks?: boolean; // 학습 시간 제외 항목 사용/미사용
      allow_student_exclusions?: boolean; // 학생이 제외일 입력 가능 여부
      allow_student_academy_schedules?: boolean; // 학생이 학원 일정 입력 가능 여부
      allow_student_time_settings?: boolean; // 학생이 시간 설정 입력 가능 여부
      allow_student_non_study_time_blocks?: boolean; // 학생이 학습 시간 제외 항목 입력 가능 여부
    };
    // Step 3 고정 필드
    step3?: {
      student_contents?: boolean; // 전체 학생 콘텐츠 고정
      student_content_items?: string[]; // 특정 콘텐츠 ID 배열 (content_id 기준)
    };
  };
};

type PlanGroupWizardProps = {
  initialBlockSets?: Array<{ id: string; name: string }>;
  initialContents?: {
    books: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
  };
  initialData?: Partial<WizardData> & { groupId?: string; templateId?: string; templateProgramType?: string; templateStatus?: string; _startStep?: number };
  isEditMode?: boolean;
  isCampMode?: boolean;
  campInvitationId?: string;
  isTemplateMode?: boolean; // 템플릿 생성 모드 (관리자용)
  isAdminMode?: boolean; // 관리자 모드 (관리자용)
  isAdminContinueMode?: boolean; // 관리자 남은 단계 진행 모드 (1~4단계 읽기 전용, 5~7단계만 편집)
  onTemplateSave?: (wizardData: WizardData) => Promise<void>; // 템플릿 저장 콜백
};

const stepLabels = [
  "기본 정보",
  "블록 및 제외일",
  "스케줄 확인",
  "콘텐츠 선택",
  "추천 콘텐츠",
  "최종 확인",
  "스케줄 결과",
];

// 템플릿 모드용 라벨 (Step 4, 5, 6, 7 제외 - 1, 2, 3만)
const templateStepLabels = [
  "기본 정보",
  "블록 및 제외일",
  "스케줄 확인",
];

// 캠프 모드용 라벨 (Step 5, 6, 7 제외 - 1, 2, 3, 4만)
const campStepLabels = [
  "기본 정보",
  "블록 및 제외일",
  "스케줄 확인",
  "콘텐츠 선택",
];

// Step별 가중치 (진행률 계산용)
const stepWeights: Record<WizardStep, number> = {
  1: 15,  // 기본 정보
  2: 15,  // 블록 및 제외일
  3: 10,  // 스케줄 확인
  4: 20,  // 콘텐츠 선택
  5: 20,  // 추천 콘텐츠
  6: 15,  // 최종 확인
  7: 5,   // 스케줄 결과
};

/**
 * 진행률 계산 함수
 */
function calculateProgress(currentStep: WizardStep, wizardData: WizardData, isTemplateMode: boolean = false): number {
  let progress = 0;

  // 완료된 Step들의 가중치 합산
  for (let step = 1; step < currentStep; step++) {
    // 템플릿 모드일 때 Step 4, 5, 6, 7 제외 (1, 2, 3만)
    if (isTemplateMode && (step === 4 || step === 5 || step === 6 || step === 7)) {
      continue;
    }
    progress += stepWeights[step as WizardStep];
  }

  // 현재 Step의 부분 완료도 계산
  // 템플릿 모드일 때 Step 4, 5, 6, 7은 가중치 0으로 처리
  const currentStepWeight = (isTemplateMode && (currentStep === 4 || currentStep === 5 || currentStep === 6 || currentStep === 7)) ? 0 : stepWeights[currentStep];
  let currentStepProgress = 0;

  switch (currentStep) {
    case 1:
      // 기본 정보: name, plan_purpose, scheduler_type, period, block_set_id
      let step1Count = 0;
      let step1Total = 5;
      if (wizardData.name && wizardData.name.trim() !== "") step1Count++;
      // 템플릿 모드에서 학생 입력 허용이 체크되어 있으면 plan_purpose는 선택사항
      const isPlanPurposeOptional = isTemplateMode && wizardData.templateLockedFields?.step1?.allow_student_plan_purpose === true;
      if (isPlanPurposeOptional) {
        step1Total = 4; // plan_purpose 제외
      } else {
        if (wizardData.plan_purpose) step1Count++;
      }
      if (wizardData.scheduler_type) step1Count++;
      if (wizardData.period_start && wizardData.period_end) step1Count++;
      if (wizardData.block_set_id) step1Count++;
      currentStepProgress = (step1Count / step1Total) * currentStepWeight;
      break;
    case 2:
      // 블록 및 제외일: 항상 완료로 간주 (선택사항)
      currentStepProgress = currentStepWeight;
      break;
    case 3:
      // 콘텐츠 선택 (학생 + 추천 통합): student_contents 또는 recommended_contents가 있으면 완료
      const hasAnyContent = wizardData.student_contents.length > 0 || wizardData.recommended_contents.length > 0;
      currentStepProgress = hasAnyContent ? currentStepWeight : 0;
      break;
    case 4:
      // 최종 확인: 모든 필수 항목이 있으면 완료
      // 템플릿 모드일 때는 recommended_contents 제외
      const hasContents = isTemplateMode 
        ? wizardData.student_contents.length > 0 
        : wizardData.student_contents.length > 0 || wizardData.recommended_contents.length > 0;
      // 1730 Timetable 필드 검증 제거 - student_level과 subject_allocations는 학생 입력폼에서는 관리자 영역
      const has1730Fields = wizardData.scheduler_type !== "1730_timetable" || true;
      currentStepProgress = (hasContents && has1730Fields) ? currentStepWeight : 0;
      break;
    case 5:
      // 스케줄 결과: 항상 완료
      currentStepProgress = currentStepWeight;
      break;
  }

  progress += currentStepProgress;

  return Math.min(progress, 100);
}

/**
 * 데이터베이스에서 읽은 plan_purpose를 UI 형식으로 변환
 * 기존 데이터 호환성: "수능" 또는 "모의고사"는 "모의고사(수능)"으로 변환
 * 새 데이터: "내신대비", "모의고사(수능)"은 그대로 사용
 */
function denormalizePlanPurpose(purpose: string | null | undefined): "" | "내신대비" | "모의고사(수능)" {
  if (!purpose) return "";
  // 기존 데이터 호환성: "수능" 또는 "모의고사"는 "모의고사(수능)"으로 변환
  if (purpose === "수능" || purpose === "모의고사") return "모의고사(수능)";
  // 새 데이터: "내신대비", "모의고사(수능)"은 그대로 사용
  if (purpose === "내신대비" || purpose === "모의고사(수능)") return purpose as "내신대비" | "모의고사(수능)";
  return "";
}

export function PlanGroupWizard({
  initialBlockSets = [],
  initialContents = { books: [], lectures: [], custom: [] },
  initialData,
  isEditMode = false,
  isCampMode = false,
  campInvitationId,
  isTemplateMode = false,
  isAdminMode = false,
  isAdminContinueMode = false,
  onTemplateSave,
}: PlanGroupWizardProps) {
  const router = useRouter();
  const toast = useToast();
  // _startStep이 있으면 해당 단계로 초기화 (관리자 남은 단계 진행 모드)
  const initialStep = (initialData as any)?._startStep 
    ? ((initialData as any)._startStep as WizardStep)
    : 1;
  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStep);
  const [blockSets, setBlockSets] = useState(initialBlockSets);
  // 하위 호환성: initialData에 contents가 있으면 student_contents로 변환
  const getInitialContents = () => {
    if (initialData?.student_contents || initialData?.recommended_contents) {
      return {
        student_contents: initialData.student_contents || [],
        recommended_contents: initialData.recommended_contents || [],
      };
    }
    // 기존 구조: contents가 있으면 모두 student_contents로 처리
    if ((initialData as any)?.contents) {
      return {
        student_contents: (initialData as any).contents,
        recommended_contents: [],
      };
    }
    return {
      student_contents: [],
      recommended_contents: [],
    };
  };

  const initialContentsData = useMemo(() => getInitialContents(), [initialData]);
  const normalizedSchedulerType: WizardData["scheduler_type"] =
    initialData?.scheduler_type === "자동스케줄러"
      ? "1730_timetable"
      : (initialData?.scheduler_type as WizardData["scheduler_type"]) || "1730_timetable";

  const [wizardData, setWizardData] = useState<WizardData>({
    name: initialData?.name || "",
    plan_purpose: denormalizePlanPurpose(initialData?.plan_purpose),
    scheduler_type: normalizedSchedulerType,
    period_start: initialData?.period_start || "",
    period_end: initialData?.period_end || "",
    block_set_id: initialData?.block_set_id || "",
    exclusions: initialData?.exclusions || [],
    academy_schedules: initialData?.academy_schedules || [],
    time_settings: initialData?.time_settings,
    student_contents: initialContentsData?.student_contents || [],
    recommended_contents: initialContentsData?.recommended_contents || [],
    target_date: initialData?.target_date,
    scheduler_options: initialData?.scheduler_options,
    // 1730 Timetable 추가 필드
    study_review_cycle: initialData?.study_review_cycle || (initialData?.scheduler_options?.study_days || initialData?.scheduler_options?.review_days ? {
      study_days: initialData.scheduler_options.study_days || 6,
      review_days: initialData.scheduler_options.review_days || 1,
    } : undefined),
    student_level: initialData?.student_level,
    subject_allocations: initialData?.subject_allocations,
    subject_constraints: initialData?.subject_constraints,
    additional_period_reallocation: initialData?.additional_period_reallocation,
    non_study_time_blocks: initialData?.non_study_time_blocks,
    templateLockedFields: initialData?.templateLockedFields || (isTemplateMode ? {
      step1: {
        allow_student_name: false,
        allow_student_plan_purpose: false,
        allow_student_scheduler_type: false,
        allow_student_period: false,
        allow_student_block_set_id: false,
        allow_student_student_level: false,
        allow_student_subject_allocations: false,
        allow_student_study_review_cycle: false,
        allow_student_additional_period_reallocation: false,
      },
      step2: {
        allow_student_exclusions: false,
        allow_student_academy_schedules: false,
        allow_student_time_settings: false,
        allow_student_non_study_time_blocks: false,
      },
    } : undefined),
  });
  // 초기 검증 에러 (템플릿 데이터 검증 결과)
  const initialValidationErrors = (initialData as any)?._validationErrors as string[] | undefined;
  const [validationErrors, setValidationErrors] = useState<string[]>(initialValidationErrors || []);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [draftGroupId, setDraftGroupId] = useState<string | null>(
    initialData?.groupId || null
  );
  const templateId = initialData?.templateId;
  const templateProgramType = initialData?.templateProgramType || "기타";
  const templateStatus = initialData?.templateStatus || "draft";

  // 디버깅: templateId 확인 (템플릿 모드일 때만, 새 템플릿 생성 시에는 정상)
  // 새 템플릿 생성 시에는 templateId가 없을 수 있음 (정상)
  // if (isTemplateMode && !templateId && process.env.NODE_ENV === "development") {
  //   console.warn("[PlanGroupWizard] 템플릿 모드인데 templateId가 없습니다:", {
  //     initialData,
  //     templateId,
  //   });
  // }
  const [activationDialogOpen, setActivationDialogOpen] = useState(false);
  const [activeGroupNames, setActiveGroupNames] = useState<string[]>([]);
  
  // 자동 저장 상태
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveSnapshotRef = useRef<string>("");
  const isInitialMountRef = useRef(true);
  const shouldTrackAutoSave =
    isCampMode && !isTemplateMode && !isAdminMode && !isAdminContinueMode;

  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
    setValidationErrors([]);
    setValidationWarnings([]);
  };

  const validateStep = (step: WizardStep): boolean => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 템플릿 모드에서 학생 입력 허용 필드 확인 헬퍼
    const isStudentInputAllowed = (fieldName: string): boolean => {
      if (!isTemplateMode) return false;
      const lockedFields = wizardData.templateLockedFields?.step1 || {};
      const allowFieldName = `allow_student_${fieldName}` as keyof typeof lockedFields;
      return lockedFields[allowFieldName] === true;
    };

    if (step === 1) {
      // 템플릿 모드가 아닐 때만 이름 검증 (템플릿 모드에서는 항상 필요)
      if (!isTemplateMode) {
        if (!wizardData.name || wizardData.name.trim() === "") {
          errors.push("플랜 이름을 입력해주세요.");
        }
      }

      // 플랜 목적: 학생 입력 허용이 아닐 때만 필수
      if (!isStudentInputAllowed("plan_purpose")) {
        if (!wizardData.plan_purpose) {
          errors.push("플랜 목적을 선택해주세요.");
        }
      }

      // 스케줄러 유형: 학생 입력 허용이 아닐 때만 필수
      if (!isStudentInputAllowed("scheduler_type")) {
        if (!wizardData.scheduler_type) {
          errors.push("스케줄러 유형을 선택해주세요.");
        }
      }

      // 학습 기간: 학생 입력 허용이 아닐 때만 필수
      if (!isStudentInputAllowed("period")) {
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
      }

      // 블록 세트는 기본값 옵션이 추가되어 검증 제거

      // 학생 수준 항목이 삭제되어 검증 제거
    }

    if (step === 2) {
      // 제외일과 학원 일정은 선택사항이므로 검증 불필요
    }

    if (step === 3) {
      // Step 3: 콘텐츠 선택 (학생 + 추천 통합)
      // 최소 1개 이상의 콘텐츠 필요
      const totalContents =
        wizardData.student_contents.length +
        wizardData.recommended_contents.length;
      if (totalContents === 0) {
        errors.push("최소 1개 이상의 콘텐츠를 선택해주세요.");
      }
    }

    if (step === 4) {
      // 템플릿 모드에서는 Step 4 검증 건너뛰기 (Step 2에서 바로 제출)
      if (isTemplateMode) {
        return true;
      }

      // Step 6 검증: 최종 확인 단계
      // 최소 1개 이상의 콘텐츠 필요
      const totalContents = wizardData.student_contents.length + wizardData.recommended_contents.length;
      if (totalContents === 0) {
        errors.push("최소 1개 이상의 콘텐츠를 선택해주세요.");
      }

      // selectedSubjectCategories를 먼저 정의 (여러 곳에서 사용)
      const selectedSubjectCategories = new Set<string>();
      
      // 학생 콘텐츠의 subject_category 수집
      wizardData.student_contents.forEach((sc) => {
        const subjectCategory = (sc as any).subject_category;
        if (subjectCategory) {
          selectedSubjectCategories.add(subjectCategory);
        }
      });

      // 추천 콘텐츠의 subject_category 수집
      wizardData.recommended_contents.forEach((rc) => {
        const subjectCategory = (rc as any).subject_category;
        if (subjectCategory) {
          selectedSubjectCategories.add(subjectCategory);
        }
      });

      // 필수 과목 검증 (템플릿 설정에 따라 동적 처리)
      // enable_required_subjects_validation이 true이고 required_subjects가 설정된 경우에만 검증
      if (
        !isTemplateMode &&
        wizardData.subject_constraints?.enable_required_subjects_validation &&
        wizardData.subject_constraints?.required_subjects &&
        wizardData.subject_constraints.required_subjects.length > 0
      ) {
        const requiredSubjects = wizardData.subject_constraints.required_subjects;

        const missingRequiredSubjects = requiredSubjects.filter(
          (subject) => !selectedSubjectCategories.has(subject)
        );

        if (missingRequiredSubjects.length > 0) {
          const constraintHandling = wizardData.subject_constraints.constraint_handling || "strict";
          if (constraintHandling === "strict") {
            errors.push(
              `다음 필수 교과를 각각 1개 이상 선택해주세요: ${missingRequiredSubjects.join(
                ", "
              )}`
            );
          } else if (constraintHandling === "warning") {
            // 경고만 표시 (에러로 추가하지 않음)
            console.warn(`[PlanGroupWizard] 필수 교과 누락 경고: ${missingRequiredSubjects.join(", ")}`);
          }
          // auto_fix는 나중에 자동으로 보완하는 로직 구현 필요
        }
      }

      // 1730 Timetable인 경우 추가 검증
      if (wizardData.scheduler_type === "1730_timetable") {
        // student_level 필수 제거됨 (사용자 요청에 따라)
        
        // subject_allocations 필수 검증 제거 - 학생 입력폼 제출 후 관리자 영역

        // study_review_cycle 검증
        const studyDays = wizardData.study_review_cycle?.study_days || wizardData.scheduler_options?.study_days || 6;
        const reviewDays = wizardData.study_review_cycle?.review_days || wizardData.scheduler_options?.review_days || 1;
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
    }

    setValidationErrors(errors);
    setValidationWarnings(warnings);
    return errors.length === 0;
  };

  const handleNext = () => {
    // Step 5에서는 완료 버튼이 Step7ScheduleResult 내부에 있으므로 여기서는 아무것도 하지 않음
    if (currentStep === 5) {
      return;
    }

    if (!validateStep(currentStep)) {
      return;
    }

    // 템플릿 모드일 때 Step 2에서 바로 제출 (Step 3, 4, 5 건너뛰기)
    if (isTemplateMode && currentStep === 2) {
      handleSubmit();
      return;
    }

    // 캠프 모드일 때 Step 3에서 바로 제출 (Step 4, 5 건너뛰기)
    // 단, 관리자 남은 단계 진행 모드일 때는 Step 4-5를 진행해야 하므로 제출하지 않음
    if (isCampMode && currentStep === 3 && !isAdminContinueMode) {
      handleSubmit();
      return;
    }

    if (currentStep < 5) {
      if (currentStep === 4) {
        // Step 4에서는 데이터만 저장하고 Step 5로 이동 (플랜 생성은 Step 5에서)
        handleSubmit(false); // 플랜 생성하지 않음
      } else {
        setCurrentStep((prev) => (prev + 1) as WizardStep);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      // 템플릿 모드에서는 Step 1, 2, 3만 있으므로 일반적인 뒤로가기
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const buildAutoSaveSnapshot = useCallback(() => {
    if (!shouldTrackAutoSave) {
      return "";
    }

    try {
      return JSON.stringify({
        name: wizardData.name,
        plan_purpose: wizardData.plan_purpose,
        scheduler_type: wizardData.scheduler_type,
        period_start: wizardData.period_start,
        period_end: wizardData.period_end,
        block_set_id: wizardData.block_set_id,
        exclusions: wizardData.exclusions,
        academy_schedules: wizardData.academy_schedules,
        student_contents: wizardData.student_contents,
      });
    } catch (error) {
      console.warn("[PlanGroupWizard] 자동 저장 스냅샷 생성 실패", error);
      return "";
    }
  }, [
    shouldTrackAutoSave,
    wizardData.name,
    wizardData.plan_purpose,
    wizardData.scheduler_type,
    wizardData.period_start,
    wizardData.period_end,
    wizardData.block_set_id,
    wizardData.exclusions,
    wizardData.academy_schedules,
    wizardData.student_contents,
  ]);

  const handleSaveDraft = useCallback(
    (silent = false, nextSnapshot?: string | null) => {
      const executeSave = async () => {
        if (!wizardData.name || wizardData.name.trim() === "") {
          if (!silent) {
            setValidationErrors(["플랜 이름을 입력해주세요."]);
          }
          if (!silent && shouldTrackAutoSave) {
            setAutoSaveStatus("idle");
          }
          return;
        }

        if (isTemplateMode) {
          if (!onTemplateSave) {
            if (!silent) {
              toast.showError("템플릿 저장에 실패했습니다.");
            }
            return;
          }

          const templateWizardData = {
            ...wizardData,
          } as WizardData;

          try {
            if (templateId) {
              const formData = new FormData();
              formData.append("name", wizardData.name);
              formData.append("program_type", templateProgramType);
              formData.append("description", "");
              formData.append("status", templateStatus);
              formData.append("template_data", JSON.stringify(templateWizardData));

              const result = await updateCampTemplateAction(templateId, formData);
              if (!result.success) {
                throw new Error(result.error || "템플릿 저장에 실패했습니다.");
              }
            } else {
              await onTemplateSave(templateWizardData);
            }

            if (!silent) {
              toast.showSuccess("저장되었습니다.");
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "템플릿 저장에 실패했습니다.";
            if (!silent) {
              toast.showError(errorMessage);
            }
          }
          return;
        }

        if (
          currentStep === 1 &&
          (!wizardData.plan_purpose ||
            !wizardData.scheduler_type ||
            !wizardData.period_start ||
            !wizardData.period_end)
        ) {
          if (!silent) {
            setAutoSaveStatus("idle");
          }
          return;
        }

        // 데이터 일관성 검증
        const consistencyCheck = validateDataConsistency(wizardData);
        if (!consistencyCheck.valid) {
          throw new PlanGroupError(
            consistencyCheck.errors.join(", "),
            PlanGroupErrorCodes.DATA_INCONSISTENCY,
            consistencyCheck.errors.join("\n"),
            true
          );
        }

        const snapshotValue =
          nextSnapshot ?? (shouldTrackAutoSave ? buildAutoSaveSnapshot() : null);

        // 데이터 변환 (일관성 보장)
        const creationData = syncWizardDataToCreationData(wizardData);

        if (isCampMode) {
          creationData.block_set_id = null;
          if (campInvitationId) {
            creationData.camp_invitation_id = campInvitationId;
          }
          if (initialData?.templateId) {
            creationData.camp_template_id = initialData.templateId;
          }
          creationData.plan_type = "camp";
        }

        if (draftGroupId) {
          await updatePlanGroupDraftAction(draftGroupId, creationData);
          if (!silent) {
            toast.showSuccess("저장되었습니다.");
          }
        } else {
          const result = await savePlanGroupDraftAction(creationData);
          if (result?.groupId) {
            setDraftGroupId(result.groupId);
            if (!silent) {
              toast.showSuccess("저장되었습니다.");
            }
          } else {
            throw new PlanGroupError(
              "Draft 생성 결과가 없습니다.",
              PlanGroupErrorCodes.DRAFT_SAVE_FAILED,
              "임시 저장에 실패했습니다. 다시 시도해주세요.",
              true
            );
          }
        }

        if (snapshotValue) {
          autoSaveSnapshotRef.current = snapshotValue;
        }

        if (!silent && shouldTrackAutoSave) {
          setAutoSaveStatus("saved");
          setLastSavedAt(new Date());
        }
      };

      if (!silent && shouldTrackAutoSave) {
        setAutoSaveStatus("saving");
      }

      return new Promise<void>((resolve, reject) => {
        startTransition(() => {
          executeSave()
            .then(resolve)
            .catch((error) => {
              const planGroupError = toPlanGroupError(
                error,
                PlanGroupErrorCodes.DRAFT_SAVE_FAILED
              );
              if (!silent) {
                toast.showError(planGroupError.userMessage);
                setValidationErrors([planGroupError.userMessage]);
                setAutoSaveStatus("error");
              }
              if (!isRecoverableError(planGroupError)) {
                console.error("[PlanGroupWizard] Draft 저장 실패:", planGroupError);
              }
              reject(error);
            });
        });
      });
    },
    [
      wizardData,
      shouldTrackAutoSave,
      isTemplateMode,
      onTemplateSave,
      templateId,
      templateProgramType,
      templateStatus,
      toast,
      currentStep,
      isCampMode,
      campInvitationId,
      initialData?.templateId,
      draftGroupId,
      buildAutoSaveSnapshot,
    ]
  );

  useEffect(() => {
    if (!shouldTrackAutoSave) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      if (autoSaveStatus !== "idle") {
        setAutoSaveStatus("idle");
      }
      return;
    }

    const snapshot = buildAutoSaveSnapshot();
    if (!snapshot) {
      return;
    }

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      autoSaveSnapshotRef.current = snapshot;
      return;
    }

    if (snapshot === autoSaveSnapshotRef.current) {
      return;
    }

    if (!wizardData.name || !wizardData.period_start || !wizardData.period_end) {
      return;
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      setAutoSaveStatus("saving");
      handleSaveDraft(true, snapshot)
        .then(() => {
          autoSaveSnapshotRef.current = snapshot;
          setLastSavedAt(new Date());
          setAutoSaveStatus("saved");
        })
        .catch(() => {
          setAutoSaveStatus("error");
        });
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [
    shouldTrackAutoSave,
    buildAutoSaveSnapshot,
    handleSaveDraft,
    wizardData.name,
    wizardData.period_start,
    wizardData.period_end,
    autoSaveStatus,
  ]);

  const handleSubmit = (generatePlans: boolean = true) => {
    // Step 6 검증 (학습 분량 관련만)
    if (currentStep === 6) {
      if (!validateStep(6)) {
        return;
      }
    } else if (!isTemplateMode && !isCampMode) {
      // 일반 모드에서 Step 6가 아닌 경우 (이전 버전 호환성)
      if (!validateStep(6)) {
        return;
      }
    }

    startTransition(async () => {
      try {
        // 데이터 일관성 검증
        const consistencyCheck = validateDataConsistency(wizardData);
        if (!consistencyCheck.valid) {
          throw new PlanGroupError(
            consistencyCheck.errors.join(", "),
            PlanGroupErrorCodes.DATA_INCONSISTENCY,
            consistencyCheck.errors.join("\n"),
            true
          );
        }

        // 전체 검증 수행
        // 템플릿 모드일 때는 Step 1, 2, 3만 검증 (Step 4, 6 제외)
        // 캠프 모드일 때는 Step 1, 2, 3, 4만 검증 (Step 6 제외 - subject_allocations는 관리자 검토 후 설정)
        let allValidation;
        if (isTemplateMode) {
          const step1 = WizardValidator.validateStep(1, wizardData);
          const step2 = WizardValidator.validateStep(2, wizardData);
          const step3 = WizardValidator.validateStep(2.5, wizardData); // Step 2.5는 스케줄 확인
          allValidation = {
            valid: step1.valid && step2.valid && step3.valid,
            errors: [...step1.errors, ...step2.errors, ...step3.errors],
            warnings: [...step1.warnings, ...step2.warnings, ...step3.warnings],
          };
        } else if (isCampMode) {
          // 캠프 모드: 현재 단계에 따라 검증
          if (currentStep === 5) {
            // Step 5: 추천 콘텐츠 및 제약 조건 검증
            const step1 = WizardValidator.validateStep(1, wizardData);
            const step2 = WizardValidator.validateStep(2, wizardData);
            const step3 = WizardValidator.validateStep(2.5, wizardData);
            const step4 = WizardValidator.validateStep(4, wizardData);
            const step5 = WizardValidator.validateStep(5, wizardData);
            allValidation = {
              valid: step1.valid && step2.valid && step3.valid && step4.valid && step5.valid,
              errors: [...step1.errors, ...step2.errors, ...step3.errors, ...step4.errors, ...step5.errors],
              warnings: [...step1.warnings, ...step2.warnings, ...step3.warnings, ...step4.warnings, ...step5.warnings],
            };
          } else if (currentStep === 6) {
            // Step 6: 학습 분량 검증만
            const step6 = WizardValidator.validateStep(6, wizardData);
            allValidation = {
              valid: step6.valid,
              errors: step6.errors,
              warnings: step6.warnings,
            };
          } else {
            // 기타: Step 1, 2, 3, 4만 검증
            const step1 = WizardValidator.validateStep(1, wizardData);
            const step2 = WizardValidator.validateStep(2, wizardData);
            const step3 = WizardValidator.validateStep(2.5, wizardData);
            const step4 = WizardValidator.validateStep(4, wizardData);
            allValidation = {
              valid: step1.valid && step2.valid && step3.valid && step4.valid,
              errors: [...step1.errors, ...step2.errors, ...step3.errors, ...step4.errors],
              warnings: [...step1.warnings, ...step2.warnings, ...step3.warnings, ...step4.warnings],
            };
          }
        } else {
          allValidation = WizardValidator.validateAll(wizardData);
        }
        
        if (!allValidation.valid) {
          setValidationErrors(allValidation.errors);
          setValidationWarnings(allValidation.warnings);
          throw new PlanGroupError(
            allValidation.errors.join(", "),
            PlanGroupErrorCodes.VALIDATION_FAILED,
            allValidation.errors.join("\n"),
            true
          );
        }

        // 템플릿 모드일 때는 onTemplateSave 호출 후 종료 (플랜 그룹 생성 건너뛰기)
        if (isTemplateMode && onTemplateSave) {
          // 템플릿 모드: template_block_sets는 별도 테이블이므로
          // 템플릿 저장 시 block_set_id는 template_block_sets의 ID를 참조
          // 하지만 템플릿 생성 시에는 templateId가 없어서 블록 세트를 생성할 수 없음
          // 따라서 템플릿 저장 시 block_set_id가 없어도 저장 가능 (나중에 edit 페이지에서 생성)
          const templateWizardData = {
            ...wizardData,
            // block_set_id는 template_block_sets의 ID이므로 그대로 저장
            // 템플릿 생성 시에는 없을 수 있음 (정상)
          } as WizardData;
          
          await onTemplateSave(templateWizardData);
          toast.showSuccess("템플릿이 저장되었습니다.");
          return;
        }

        // 캠프 모드일 때 제출 핸들러 변경
        if (isCampMode) {
          // 관리자 모드에서 남은 단계 진행 (isAdminContinueMode 또는 isAdminMode && isEditMode)
          if (isAdminContinueMode || (isAdminMode && isEditMode && draftGroupId)) {
            const { continueCampStepsForAdmin } = await import("@/app/(admin)/actions/campTemplateActions");
            
            try {
              const result = await continueCampStepsForAdmin(draftGroupId || (initialData?.groupId as string), wizardData, currentStep);

              if (result.success) {
                toast.showSuccess("저장되었습니다.");
                // Step 6에서 호출된 경우 데이터만 저장하고 Step 7로 이동 (플랜 생성은 Step 7에서)
                if (currentStep === 6) {
                  setDraftGroupId(draftGroupId || (initialData?.groupId as string));
                  setCurrentStep(7);
                }
                // Step 7에서 완료 후 참여자 목록으로 이동
                if (currentStep === 7) {
                  // templateId를 initialData에서 가져오기
                  const templateId = initialData?.templateId;
                  if (templateId) {
                    router.push(`/admin/camp-templates/${templateId}/participants`);
                  } else {
                    router.push(`/admin/camp-templates`);
                  }
                }
              } else {
                const errorMessage = result.error || "저장에 실패했습니다.";
                setValidationErrors([errorMessage]);
                toast.showError(errorMessage);
              }
            } catch (error) {
              console.error("[PlanGroupWizard] 관리자 캠프 남은 단계 진행 실패:", error);
              const errorMessage = error instanceof Error ? error.message : "저장에 실패했습니다.";
              setValidationErrors([errorMessage]);
              toast.showError(errorMessage);
            }
            return;
          }

          // 학생 모드에서 남은 단계 진행 (isEditMode && groupId가 있는 경우)
          if (isEditMode && draftGroupId && !isAdminMode) {
            const { continueCampSteps } = await import("@/app/(student)/actions/campActions");
            
            try {
              const result = await continueCampSteps(draftGroupId, wizardData);

              if (result.success) {
                toast.showSuccess("저장되었습니다.");
                // Step 7에서 플랜 생성 후 상세 페이지로 이동
                if (currentStep === 7) {
                  router.push(`/plan/group/${draftGroupId}`);
                }
              } else {
                const errorMessage = result.error || "저장에 실패했습니다.";
                setValidationErrors([errorMessage]);
                toast.showError(errorMessage);
              }
            } catch (error) {
              console.error("[PlanGroupWizard] 캠프 남은 단계 진행 실패:", error);
              const errorMessage = error instanceof Error ? error.message : "저장에 실패했습니다.";
              setValidationErrors([errorMessage]);
              toast.showError(errorMessage);
            }
            return;
          }

          // 캠프 참여 제출 (초기 참여 시 - 학생만)
          if (campInvitationId && !isAdminMode) {
            const { submitCampParticipation } = await import("@/app/(student)/actions/campActions");
            const result = await submitCampParticipation(campInvitationId, wizardData);

            if (result.success && result.groupId) {
              toast.showSuccess("캠프 참여가 완료되었습니다.");
              // 제출 완료 상세 페이지로 이동
              if (result.invitationId || campInvitationId) {
                router.push(`/camp/${result.invitationId || campInvitationId}/submitted`);
              } else {
                // 안전장치: invitationId가 없으면 기존 경로로 이동
                router.push(`/plan/group/${result.groupId}`);
              }
            } else {
              const planGroupError = toPlanGroupError(
                new Error(result.error || "캠프 참여에 실패했습니다."),
                PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED
              );
              setValidationErrors([planGroupError.userMessage]);
              toast.showError(planGroupError.userMessage);
            }
            return;
          }
        }

        // 데이터 변환 (일관성 보장)
        const creationData = syncWizardDataToCreationData(wizardData);

        // 캠프 모드에서는 block_set_id가 template_block_sets 테이블의 ID이므로
        // plan_groups.block_set_id (student_block_sets 참조)에 저장할 수 없음
        // 따라서 null로 설정
        if (isCampMode) {
          creationData.block_set_id = null;
          // 캠프 관련 필드 설정
          if (campInvitationId) {
            creationData.camp_invitation_id = campInvitationId;
          }
          if (initialData?.templateId) {
            creationData.camp_template_id = initialData.templateId;
          }
          creationData.plan_type = "camp";
        }

        let finalGroupId: string;

        if (isEditMode && draftGroupId) {
          // 수정 모드: draft 상태면 updatePlanGroupDraftAction, 아니면 updatePlanGroupAction
          // 현재는 draft 상태만 수정 가능하므로 updatePlanGroupDraftAction 사용
          await updatePlanGroupDraftAction(draftGroupId, creationData);
          finalGroupId = draftGroupId;
        } else {
          // 생성 모드
          const result = await createPlanGroupAction(creationData);
          if (!result?.groupId) {
            throw new PlanGroupError(
              "플랜 그룹 생성 결과가 없습니다.",
              PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED,
              "플랜 그룹 생성에 실패했습니다. 다시 시도해주세요.",
              true
            );
          }
          finalGroupId = result.groupId;
        }

        // 플랜 그룹 상태를 "saved"로 변경 (플랜 생성 전에 필요)
        try {
          await updatePlanGroupStatus(finalGroupId, "saved");
        } catch (error) {
          // 상태 변경 실패는 무시하고 계속 진행 (이미 saved 상태일 수 있음)
          const planGroupError = toPlanGroupError(
            error,
            PlanGroupErrorCodes.PLAN_GROUP_UPDATE_FAILED
          );
          console.warn("[PlanGroupWizard] 플랜 그룹 상태 변경 실패:", planGroupError);
        }

        // Step 6에서 호출된 경우 데이터만 저장하고 Step 7로 이동 (플랜 생성은 Step 7에서)
        if (currentStep === 6) {
          setDraftGroupId(finalGroupId);
          setCurrentStep(7);
          toast.showSuccess("저장되었습니다. 다음 단계에서 플랜을 생성합니다.");
          return;
        }

        // 플랜 생성 (Step 7로 이동하기 전에, 템플릿 모드가 아닐 때만, generatePlans가 true일 때만)
        if (!isTemplateMode && generatePlans) {
          try {
            await generatePlansFromGroupAction(finalGroupId);
            // Step 7로 이동
            setDraftGroupId(finalGroupId);
            setCurrentStep(7);
          
          // 완료 버튼 클릭 시 활성화 다이얼로그 표시를 위해 다른 활성 플랜 그룹 확인
          // (자동 활성화는 하지 않음 - 사용자가 완료 버튼을 눌렀을 때만 활성화)
          try {
            const activeGroups = await getActivePlanGroups(finalGroupId);
            if (activeGroups.length > 0) {
              // 다른 활성 플랜 그룹이 있으면 이름 저장 (완료 버튼 클릭 시 다이얼로그 표시)
              setActiveGroupNames(activeGroups.map(g => g.name || "플랜 그룹"));
            }
            // 다른 활성 플랜 그룹이 없어도 자동 활성화하지 않음
            // 사용자가 완료 버튼을 눌렀을 때만 활성화됨
          } catch (error) {
            // 활성 그룹 확인 실패는 경고만 (필수가 아니므로)
            const planGroupError = toPlanGroupError(
              error,
              PlanGroupErrorCodes.UNKNOWN_ERROR
            );
            console.warn("[PlanGroupWizard] 플랜 그룹 활성 그룹 확인 실패:", planGroupError);
          }
          } catch (error) {
            // 플랜 생성 실패 시에도 Step 7로 이동 (에러 표시)
            const planGroupError = toPlanGroupError(
              error,
              PlanGroupErrorCodes.PLAN_GENERATION_FAILED
            );
            setDraftGroupId(finalGroupId);
            setCurrentStep(7);
            setValidationErrors([planGroupError.userMessage]);
            toast.showError(planGroupError.userMessage);
          }
        }
      } catch (error) {
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED
        );
        setValidationErrors([planGroupError.userMessage]);
        toast.showError(planGroupError.userMessage);
        
        // 복구 불가능한 에러인 경우 로깅
        if (!isRecoverableError(planGroupError)) {
          console.error("[PlanGroupWizard] 플랜 그룹 저장 실패:", planGroupError);
        }
      }
    });
  };

  // 진행률 계산
  const progress = useMemo(() => calculateProgress(currentStep, wizardData, isTemplateMode), [currentStep, wizardData, isTemplateMode]);

  // 자동 저장 상태 텍스트
  const getAutoSaveStatusText = () => {
    switch (autoSaveStatus) {
      case "saving":
        return "저장 중...";
      case "saved":
        return lastSavedAt ? `저장됨 (${lastSavedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })})` : "저장됨";
      case "error":
        return "저장 실패";
      default:
        return "";
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* 상단 액션 바 */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          {/* 캠프 모드일 때는 버튼 숨김 (상위 페이지의 '목록으로 돌아가기' 버튼 사용) */}
          {!isCampMode && (
            <Link
              href={
                isTemplateMode
                  ? "/admin/camp-templates"
                  : isEditMode
                  ? `/plan/group/${draftGroupId}`
                  : "/plan"
              }
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {isTemplateMode
                ? "템플릿 목록"
                : isEditMode
                ? "상세 보기"
                : "플랜 목록"}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          {!isTemplateMode && autoSaveStatus !== "idle" && (
            <div className="text-sm">
              <span className={autoSaveStatus === "saving" ? "text-blue-600" : autoSaveStatus === "saved" ? "text-green-600" : "text-red-600"}>
                {getAutoSaveStatusText()}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirm("변경사항을 저장하지 않고 나가시겠습니까?")) {
                if (isTemplateMode) {
                  router.push("/admin/camp-templates");
                } else {
                  router.push(isEditMode && draftGroupId ? `/plan/group/${draftGroupId}` : "/plan");
                }
              }
            }}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => handleSaveDraft(false)}
            disabled={isPending || !wizardData.name}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* 진행률 바 - 템플릿 모드와 캠프 모드에서는 제외 (다수가 단계를 나누어 진행하므로 오차 발생) */}
      {!isTemplateMode && !isCampMode && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              진행률: {Math.round(progress)}%
            </span>
            <span className="text-sm text-gray-500">
              {stepLabels[currentStep - 1]} ({currentStep}/7)
            </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  progress === 100 ? "bg-green-600" : "bg-blue-600"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 진행 단계 표시 */}
      <div>
        <div className="flex items-center justify-between">
          {(isTemplateMode ? templateStepLabels : (isCampMode && !isAdminContinueMode) ? campStepLabels : stepLabels).map((label, index) => {
            // 템플릿 모드일 때 Step 4, 5, 6, 7을 건너뛰기 위해 step 번호 매핑
            // 캠프 모드일 때 Step 5, 6, 7을 건너뛰기 위해 step 번호 매핑 (단, 관리자 남은 단계 진행 모드일 때는 포함)
            let step: WizardStep;
            if (isTemplateMode) {
              // 템플릿 모드: 1, 2, 3만 (Step 4, 5, 6, 7 제외)
              const templateSteps: WizardStep[] = [1, 2, 3];
              step = templateSteps[index];
            } else if (isCampMode && !isAdminContinueMode) {
              // 캠프 모드: 1, 2, 3, 4만 (Step 5, 6, 7 제외)
              const campSteps: WizardStep[] = [1, 2, 3, 4];
              step = campSteps[index];
            } else {
              // 일반 모드 또는 관리자 남은 단계 진행 모드: 모든 Step 표시
              step = (index + 1) as WizardStep;
            }
            const isActive = step === currentStep;
            const isCompleted = step < currentStep;
            
            // 템플릿 모드일 때 Step 4, 5, 6, 7 숨기기
            if (isTemplateMode && (step === 4 || step === 5 || step === 6 || step === 7)) return null;
            // 캠프 모드일 때 Step 5, 6, 7 숨기기 (단, 관리자 남은 단계 진행 모드일 때는 보여야 함)
            if (isCampMode && (step === 5 || step === 6 || step === 7) && !isAdminContinueMode) return null;

            // 관리자 남은 단계 진행 모드일 때 1~4단계는 읽기 전용 표시
            const isReadOnly = isAdminContinueMode && step >= 1 && step <= 4;
            const isEditable = !isAdminContinueMode || step >= 5;

            return (
              <div key={step} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                      isActive
                        ? "border-gray-900 bg-gray-900 text-white"
                        : isCompleted
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 bg-white text-gray-400"
                    } ${isReadOnly ? "opacity-60" : ""}`}
                    onClick={() => {
                      if (isEditable || isReadOnly) {
                        setCurrentStep(step);
                      }
                    }}
                    style={{ cursor: isEditable || isReadOnly ? "pointer" : "default" }}
                  >
                    {isCompleted ? "✓" : step}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isActive ? "text-gray-900" : "text-gray-500"
                    } ${isReadOnly ? "opacity-60" : ""}`}
                    style={{ marginTop: "0.5rem" }}
                  >
                    {label}
                    {isReadOnly && " (읽기 전용)"}
                  </span>
                </div>
                {index < (isTemplateMode ? templateStepLabels : (isCampMode && !isAdminContinueMode) ? campStepLabels : stepLabels).length - 1 && (
                  <div
                    className={`h-0.5 flex-1 ${
                      isCompleted ? "bg-gray-900" : "bg-gray-300"
                    }`}
                    style={{ marginLeft: "0.5rem", marginRight: "0.5rem" }}
                  />
                )}
              </div>
            );
          }).filter(Boolean)}
        </div>
      </div>

      {/* 템플릿 모드 체크리스트 */}
      {isTemplateMode && (
        <div className="mb-6">
          <TemplateWizardChecklist wizardData={wizardData} />
        </div>
      )}

      {/* 에러 및 경고 메시지 */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg bg-red-50 p-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-red-800">오류</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {validationWarnings.length > 0 && (
        <div className="rounded-lg bg-yellow-50 p-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-yellow-800">경고</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-yellow-700">
              {validationWarnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 단계별 폼 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {currentStep === 1 && (
          <Step1BasicInfo
            data={wizardData}
            onUpdate={updateWizardData}
            blockSets={blockSets}
            isTemplateMode={isTemplateMode}
            templateId={templateId}
            isCampMode={isCampMode}
            onBlockSetCreated={(newBlockSet) => {
              setBlockSets([...blockSets, newBlockSet]);
              // 새로 생성된 블록 세트를 자동으로 선택
              updateWizardData({ block_set_id: newBlockSet.id });
            }}
            onBlockSetsLoaded={(latestBlockSets) => {
              setBlockSets(latestBlockSets);
            }}
            editable={!isAdminContinueMode}
            campTemplateInfo={
              isCampMode
                ? {
                    name: wizardData.name || "",
                    program_type: "캠프",
                  }
                : undefined
            }
          />
        )}
        {currentStep === 2 && (
          <Step2TimeSettingsWithPreview
            data={wizardData}
            onUpdate={updateWizardData}
            periodStart={wizardData.period_start}
            periodEnd={wizardData.period_end}
            groupId={draftGroupId || undefined}
            onNavigateToStep={setCurrentStep}
            campMode={isCampMode}
            isTemplateMode={isTemplateMode}
            templateExclusions={isCampMode ? wizardData.exclusions : undefined}
            editable={!isAdminContinueMode}
            studentId={(initialData as any)?.student_id}
            isAdminMode={isAdminMode}
            isAdminContinueMode={isAdminContinueMode}
            blockSets={blockSets}
            campTemplateId={isCampMode ? initialData?.templateId : undefined}
          />
        )}
        {currentStep === 3 && (
          null // Step 3은 Step 2에 통합됨 - 실시간 미리보기로 대체
        )}
        {currentStep === 3 && !isTemplateMode && (
          <Step3ContentSelection
            data={wizardData}
            onUpdate={updateWizardData}
            contents={initialContents}
            onSaveDraft={handleSaveDraft}
            isSavingDraft={isPending}
            isCampMode={isCampMode}
            isEditMode={isEditMode}
            studentId={(initialData as any)?.student_id}
            editable={!isAdminContinueMode}
          />
        )}
        {currentStep === 4 && !isTemplateMode && (!isCampMode || isAdminContinueMode) && (
          <Step6FinalReview
            data={wizardData}
            onUpdate={updateWizardData}
            contents={initialContents}
            isCampMode={isCampMode}
            studentId={(initialData as any)?.student_id}
          />
        )}
        {currentStep === 5 && draftGroupId && (!isCampMode || isAdminContinueMode) && (
          <Step7ScheduleResult
            groupId={draftGroupId}
            onComplete={async () => {
              // 플랜이 실제로 생성되었는지 확인
              try {
                const checkResult = await checkPlansExistAction(draftGroupId);
                if (!checkResult.hasPlans) {
                  alert("플랜이 생성되지 않았습니다. 플랜을 먼저 생성해주세요.");
                  return;
                }
              } catch (error) {
                alert(
                  error instanceof Error
                    ? `플랜 확인 중 오류: ${error.message}`
                    : "플랜 확인 중 오류가 발생했습니다."
                );
                return;
              }

              // 완료 버튼을 눌렀을 때만 활성화 및 리다이렉트
              // 다른 활성 플랜 그룹이 있으면 활성화 다이얼로그 표시
              if (activeGroupNames.length > 0) {
                setActivationDialogOpen(true);
              } else {
                // 다른 활성 플랜 그룹이 없으면 활성화 후 리다이렉트
                try {
                  // saved 상태로 먼저 변경 시도 (이미 saved 상태면 에러 없이 성공)
                  try {
                    await updatePlanGroupStatus(draftGroupId, "saved");
                  } catch (savedError) {
                    // saved 상태 변경 실패는 무시 (이미 saved 상태일 수 있음)
                    console.warn("플랜 그룹 saved 상태 변경 실패 (무시):", savedError);
                  }
                  // saved 상태에서 active로 전이
                  await updatePlanGroupStatus(draftGroupId, "active");
                  router.refresh(); // 캐시 갱신
                  router.push(`/plan/group/${draftGroupId}`);
                } catch (statusError) {
                  // 활성화 실패 시에도 리다이렉트 (경고만)
                  console.warn("플랜 그룹 활성화 실패:", statusError);
                  router.refresh(); // 캐시 갱신
                  router.push(`/plan/group/${draftGroupId}`);
                }
              }
            }}
          />
        )}
      </div>

      {/* 네비게이션 버튼 */}
      <div className="flex justify-between" style={{ marginTop: "1.5rem" }}>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1 || isPending}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            이전
          </button>
        </div>
        <button
          type="button"
          onClick={handleNext}
          disabled={isPending || currentStep === 7}
          className={`items-center justify-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400 ${
            currentStep === 7 ? "hidden" : "inline-flex"
          }`}
        >
          {isPending
            ? "저장 중..."
            : currentStep === 3 && isTemplateMode
            ? "템플릿 저장하기"
            : currentStep === 4 && isCampMode && !isAdminContinueMode
            ? "참여 제출하기"
            : currentStep === 6
            ? isEditMode
              ? "수정 및 플랜 생성"
              : "플랜 생성하기"
            : currentStep === 7
            ? "" // Step 7에서는 완료 버튼이 Step7ScheduleResult 내부에 있으므로 빈 문자열
            : "다음"}
        </button>
      </div>

      {/* 플랜 그룹 활성화 다이얼로그 */}
      {draftGroupId && (
        <PlanGroupActivationDialog
          open={activationDialogOpen}
          onOpenChange={setActivationDialogOpen}
          groupId={draftGroupId}
          activeGroupNames={activeGroupNames}
        />
      )}
    </div>
  );
}
