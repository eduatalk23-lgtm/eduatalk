"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
} from "@/app/(student)/actions/planGroupActions";
import { PlanGroupCreationData } from "@/lib/types/plan";
import { PlanValidator } from "@/lib/validation/planValidator";
import { Step1BasicInfo } from "./Step1BasicInfo";
import { Step2BlocksAndExclusions } from "./Step2BlocksAndExclusions";
import { Step2_5SchedulePreview } from "./Step2_5SchedulePreview";
import { Step3Contents } from "./Step3Contents";
import { Step4RecommendedContents } from "./Step4RecommendedContents";
import { Step6FinalReview } from "./Step6FinalReview";
import { Step7ScheduleResult } from "./Step7ScheduleResult";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type WizardData = {
  // Step 1
  name: string;
  plan_purpose: "내신대비" | "모의고사(수능)" | "";
  scheduler_type: "자동스케줄러" | "1730_timetable" | "";
  scheduler_options?: {
    // 자동 스케줄러
    difficulty_weight?: number;
    progress_weight?: number;
    score_weight?: number;
    weak_subject_focus?: "low" | "medium" | "high" | boolean;
    exam_urgency_enabled?: boolean;
    allow_consecutive?: boolean;
    // 1730 Timetable
    study_days?: number;
    review_days?: number;
    review_scope?: "full" | "partial";
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
  }>;
  academy_schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string;
    subject?: string;
    travel_time?: number; // 이동시간 (분 단위, 기본값: 60분)
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
    title?: string; // 추가: 제목 저장
    subject_category?: string; // 추가: 과목 카테고리 저장 (필수 과목 검증용)
  }>;
  // Step 4 - 추천 콘텐츠
  recommended_contents: Array<{
    content_type: "book" | "lecture";
    content_id: string;
    start_range: number;
    end_range: number;
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
};

type PlanGroupWizardProps = {
  initialBlockSets?: Array<{ id: string; name: string }>;
  initialContents?: {
    books: Array<{ id: string; title: string; subtitle?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
  };
  initialData?: Partial<WizardData> & { groupId?: string };
  isEditMode?: boolean;
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

/**
 * 데이터베이스에서 읽은 plan_purpose를 UI 형식으로 변환
 * "수능" -> "모의고사(수능)"
 */
function denormalizePlanPurpose(purpose: string | null | undefined): "" | "내신대비" | "모의고사(수능)" {
  if (!purpose) return "";
  if (purpose === "수능" || purpose === "모의고사") return "모의고사(수능)";
  if (purpose === "내신대비") return "내신대비";
  return "";
}

export function PlanGroupWizard({
  initialBlockSets = [],
  initialContents = { books: [], lectures: [], custom: [] },
  initialData,
  isEditMode = false,
}: PlanGroupWizardProps) {
  const router = useRouter();
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
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
    if (initialData?.contents) {
      return {
        student_contents: initialData.contents,
        recommended_contents: [],
      };
    }
    return {
      student_contents: [],
      recommended_contents: [],
    };
  };

  const initialContentsData = getInitialContents();

  const [wizardData, setWizardData] = useState<WizardData>({
    name: initialData?.name || "",
    plan_purpose: denormalizePlanPurpose(initialData?.plan_purpose),
    scheduler_type: initialData?.scheduler_type || "",
    period_start: initialData?.period_start || "",
    period_end: initialData?.period_end || "",
    block_set_id: initialData?.block_set_id || "",
    exclusions: initialData?.exclusions || [],
    academy_schedules: initialData?.academy_schedules || [],
    time_settings: initialData?.time_settings,
    student_contents: initialContentsData.student_contents,
    recommended_contents: initialContentsData.recommended_contents,
    target_date: initialData?.target_date,
    scheduler_options: initialData?.scheduler_options,
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [draftGroupId, setDraftGroupId] = useState<string | null>(
    initialData?.groupId || null
  );
  const [activationDialogOpen, setActivationDialogOpen] = useState(false);
  const [activeGroupNames, setActiveGroupNames] = useState<string[]>([]);

  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
    setValidationErrors([]);
    setValidationWarnings([]);
  };

  const validateStep = (step: WizardStep): boolean => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (step === 1) {
      if (!wizardData.name || wizardData.name.trim() === "") {
        errors.push("플랜 이름을 입력해주세요.");
      }
      if (!wizardData.plan_purpose) {
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
      if (!wizardData.block_set_id) {
        errors.push("블록 세트를 선택해주세요.");
      }
    }

    if (step === 2) {
      // 제외일과 학원 일정은 선택사항이므로 검증 불필요
    }

    if (step === 3) {
      // Step 2.5 (스케줄 확인)는 검증 불필요, 확인만
    }

    if (step === 4) {
      // Step 3는 선택사항 (학생이 등록한 콘텐츠)
    }

    if (step === 5) {
      // Step 4 검증: 필수 과목 (국어, 수학, 영어) 각 1개 이상
      const requiredSubjects = ["국어", "수학", "영어"];
      const selectedSubjectCategories = new Set<string>();

      // contents에서 subject_category 추출 (마스터 콘텐츠인 경우)
      // TODO: 실제로는 마스터 콘텐츠의 subject_category를 조회해야 함
      // 현재는 Step 4에서 선택한 콘텐츠의 subject_category를 확인
      // 임시로 contents에 subject_category 정보가 포함되어 있다고 가정
      // 실제 구현 시 마스터 콘텐츠 정보를 조회해야 함

      // 최소 1개 이상의 콘텐츠 필요 (학생 + 추천 합쳐서)
      const totalContents =
        wizardData.student_contents.length +
        wizardData.recommended_contents.length;
      if (totalContents === 0) {
        errors.push("최소 1개 이상의 콘텐츠를 선택해주세요.");
      }

      // 필수 과목 검증은 Step 5에서 처리
      // 여기서는 최소 개수만 확인
    }

    if (step === 6) {
      // Step 6 검증: 최종 확인 단계
      // 최소 1개 이상의 콘텐츠 필요
      const totalContents =
        wizardData.student_contents.length +
        wizardData.recommended_contents.length;
      if (totalContents === 0) {
        errors.push("최소 1개 이상의 콘텐츠를 선택해주세요.");
      }

      // 필수 과목 검증 (국어, 수학, 영어 각 1개 이상)
      const requiredSubjects = ["국어", "수학", "영어"];
      const selectedSubjectCategories = new Set<string>();

      // 학생 콘텐츠의 subject_category
      wizardData.student_contents.forEach((sc) => {
        const subjectCategory = (sc as any).subject_category;
        if (subjectCategory) {
          selectedSubjectCategories.add(subjectCategory);
        }
      });

      // 추천 콘텐츠의 subject_category
      wizardData.recommended_contents.forEach((rc) => {
        const subjectCategory = (rc as any).subject_category;
        if (subjectCategory) {
          selectedSubjectCategories.add(subjectCategory);
        }
      });

      const missingRequiredSubjects = requiredSubjects.filter(
        (subject) => !selectedSubjectCategories.has(subject)
      );

      if (missingRequiredSubjects.length > 0) {
        errors.push(
          `다음 필수 과목을 각각 1개 이상 선택해주세요: ${missingRequiredSubjects.join(
            ", "
          )}`
        );
      }
    }

    setValidationErrors(errors);
    setValidationWarnings(warnings);
    return errors.length === 0;
  };

  const handleNext = () => {
    // Step 7에서는 완료 버튼이 Step7ScheduleResult 내부에 있으므로 여기서는 아무것도 하지 않음
    if (currentStep === 7) {
      return;
    }

    if (!validateStep(currentStep)) {
      return;
    }

    // Step 4에서 Step 5로 넘어갈 때, 9개 모두 선택한 경우 Step 5를 건너뛰고 Step 6으로
    const totalContents =
      wizardData.student_contents.length +
      wizardData.recommended_contents.length;
    if (currentStep === 4 && totalContents >= 9) {
      setCurrentStep(6);
      return;
    }

    if (currentStep < 7) {
      if (currentStep === 6) {
        handleSubmit();
      } else {
        setCurrentStep((prev) => (prev + 1) as WizardStep);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const handleSaveDraft = () => {
    // 최소 검증: 이름만 필수
    if (!wizardData.name || wizardData.name.trim() === "") {
      setValidationErrors(["플랜 이름을 입력해주세요."]);
      return;
    }

    startTransition(async () => {
      try {
        // time_settings를 scheduler_options에 병합
        const mergedSchedulerOptions = {
          ...(wizardData.scheduler_options || {}),
          ...(wizardData.time_settings || {}),
        };
        
        const creationData: PlanGroupCreationData = {
          name: wizardData.name,
          plan_purpose: wizardData.plan_purpose as any,
          scheduler_type: wizardData.scheduler_type as any,
          scheduler_options: Object.keys(mergedSchedulerOptions).length > 0 ? mergedSchedulerOptions : null,
          period_start: wizardData.period_start,
          period_end: wizardData.period_end,
          target_date: wizardData.target_date || null,
          block_set_id: wizardData.block_set_id || null,
          contents: [
            ...wizardData.student_contents.map((c, idx) => ({
              content_type: c.content_type,
              content_id: c.content_id,
              start_range: c.start_range,
              end_range: c.end_range,
              display_order: idx,
            })),
            ...wizardData.recommended_contents.map((c, idx) => ({
              content_type: c.content_type,
              content_id: c.content_id,
              start_range: c.start_range,
              end_range: c.end_range,
              display_order: wizardData.student_contents.length + idx,
            })),
          ],
          exclusions: wizardData.exclusions.map((e) => ({
            exclusion_date: e.exclusion_date,
            exclusion_type: e.exclusion_type,
            reason: e.reason || null,
          })),
          academy_schedules: wizardData.academy_schedules.map((s) => ({
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            academy_name: s.academy_name || null,
            subject: s.subject || null,
          })),
        };

        if (draftGroupId) {
          // 기존 draft 업데이트
          await updatePlanGroupDraftAction(draftGroupId, creationData);
          toast.showSuccess("저장되었습니다.");
        } else {
          // 새 draft 생성
          const result = await savePlanGroupDraftAction(creationData);
          if (result?.groupId) {
            setDraftGroupId(result.groupId);
            toast.showSuccess("저장되었습니다.");
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "저장에 실패했습니다.";
        toast.showError(errorMessage);
        setValidationErrors([errorMessage]);
      }
    });
  };

  const handleSubmit = () => {
    if (!validateStep(5)) {
      return;
    }

    startTransition(async () => {
      try {
        // time_settings를 scheduler_options에 병합
        const mergedSchedulerOptions = {
          ...(wizardData.scheduler_options || {}),
          ...(wizardData.time_settings || {}),
        };
        
        const creationData: PlanGroupCreationData = {
          name: wizardData.name,
          plan_purpose: wizardData.plan_purpose as any,
          scheduler_type: wizardData.scheduler_type as any,
          scheduler_options: Object.keys(mergedSchedulerOptions).length > 0 ? mergedSchedulerOptions : null,
          period_start: wizardData.period_start,
          period_end: wizardData.period_end,
          target_date: wizardData.target_date || null,
          block_set_id: wizardData.block_set_id || null,
          contents: [
            ...wizardData.student_contents.map((c, idx) => ({
              content_type: c.content_type,
              content_id: c.content_id,
              start_range: c.start_range,
              end_range: c.end_range,
              display_order: idx,
            })),
            ...wizardData.recommended_contents.map((c, idx) => ({
              content_type: c.content_type,
              content_id: c.content_id,
              start_range: c.start_range,
              end_range: c.end_range,
              display_order: wizardData.student_contents.length + idx,
            })),
          ],
          exclusions: wizardData.exclusions.map((e) => ({
            exclusion_date: e.exclusion_date,
            exclusion_type: e.exclusion_type,
            reason: e.reason || null,
          })),
          academy_schedules: wizardData.academy_schedules.map((s) => ({
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            academy_name: s.academy_name || null,
            subject: s.subject || null,
          })),
        };

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
            throw new Error("플랜 그룹 생성에 실패했습니다.");
          }
          finalGroupId = result.groupId;
        }

        // 플랜 그룹 상태를 "saved"로 변경 (플랜 생성 전에 필요)
        try {
          await updatePlanGroupStatus(finalGroupId, "saved");
        } catch (error) {
          // 상태 변경 실패는 무시하고 계속 진행 (이미 saved 상태일 수 있음)
          console.warn("플랜 그룹 상태 변경 실패:", error);
        }

        // 플랜 생성 (Step 7로 이동하기 전에)
        try {
          await generatePlansFromGroupAction(finalGroupId);
          // Step 7로 이동
          setDraftGroupId(finalGroupId);
          setCurrentStep(7);
          
          // 플랜 생성 후 자동 활성화를 위해 다른 활성 플랜 그룹 확인
          // (완료 버튼 클릭 시 활성화 다이얼로그 표시를 위해 상태 저장)
          try {
            const activeGroups = await getActivePlanGroups(finalGroupId);
            if (activeGroups.length > 0) {
              // 다른 활성 플랜 그룹이 있으면 이름 저장 (완료 버튼 클릭 시 다이얼로그 표시)
              setActiveGroupNames(activeGroups.map(g => g.name || "플랜 그룹"));
            } else {
              // 다른 활성 플랜 그룹이 없으면 바로 활성화
              // draft -> active 전이는 불가능하므로, saved 상태로 먼저 변경 후 active로 전이
              try {
                // saved 상태로 먼저 변경 시도 (이미 saved 상태면 에러 없이 성공)
                try {
                  await updatePlanGroupStatus(finalGroupId, "saved");
                } catch (savedError) {
                  // saved 상태 변경 실패는 무시 (이미 saved 상태일 수 있음)
                  console.warn("플랜 그룹 saved 상태 변경 실패 (무시):", savedError);
                }
                // saved 상태에서 active로 전이
                await updatePlanGroupStatus(finalGroupId, "active");
              } catch (statusError) {
                // 활성화 실패는 경고만 (필수가 아니므로)
                console.warn("플랜 그룹 자동 활성화 실패:", statusError);
              }
            }
          } catch (error) {
            // 활성화 실패는 경고만 (필수가 아니므로)
            console.warn("플랜 그룹 자동 활성화 확인 실패:", error);
          }
        } catch (error) {
          // 플랜 생성 실패 시에도 Step 7로 이동 (에러 표시)
          setDraftGroupId(finalGroupId);
          setCurrentStep(7);
          setValidationErrors([
            error instanceof Error
              ? `플랜 생성 중 오류: ${error.message}`
              : "플랜 생성에 실패했습니다.",
          ]);
        }
      } catch (error) {
        setValidationErrors([
          error instanceof Error
            ? error.message
            : "플랜 그룹 저장에 실패했습니다.",
        ]);
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* 상단 액션 바 */}
      <div className="mb-6 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Link
            href={isEditMode ? `/plan/group/${draftGroupId}` : "/plan"}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isEditMode ? "상세 보기" : "플랜 목록"}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (confirm("변경사항을 저장하지 않고 나가시겠습니까?")) {
                router.push(isEditMode && draftGroupId ? `/plan/group/${draftGroupId}` : "/plan");
              }
            }}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isPending || !wizardData.name}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* 진행 단계 표시 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {stepLabels.map((label, index) => {
            const step = (index + 1) as WizardStep;
            const isActive = step === currentStep;
            const isCompleted = step < currentStep;

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
                    }`}
                  >
                    {isCompleted ? "✓" : step}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      isActive ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {index < stepLabels.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 flex-1 ${
                      isCompleted ? "bg-gray-900" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 에러 및 경고 메시지 */}
      {validationErrors.length > 0 && (
        <div className="mb-6 rounded-lg bg-red-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-red-800">오류</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {validationWarnings.length > 0 && (
        <div className="mb-6 rounded-lg bg-yellow-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-yellow-800">경고</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-yellow-700">
            {validationWarnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 단계별 폼 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {currentStep === 1 && (
          <Step1BasicInfo
            data={wizardData}
            onUpdate={updateWizardData}
            blockSets={blockSets}
            onBlockSetCreated={(newBlockSet) => {
              setBlockSets([...blockSets, newBlockSet]);
              // 새로 생성된 블록 세트를 자동으로 선택
              updateWizardData({ block_set_id: newBlockSet.id });
            }}
            onBlockSetsLoaded={(latestBlockSets) => {
              setBlockSets(latestBlockSets);
            }}
          />
        )}
        {currentStep === 2 && (
          <Step2BlocksAndExclusions
            data={wizardData}
            onUpdate={updateWizardData}
            periodStart={wizardData.period_start}
            periodEnd={wizardData.period_end}
            groupId={draftGroupId || undefined}
            onNavigateToStep={setCurrentStep}
          />
        )}
        {currentStep === 3 && (
          <Step2_5SchedulePreview
            data={wizardData}
            onUpdate={updateWizardData}
          />
        )}
        {currentStep === 4 && (
          <Step3Contents
            data={wizardData}
            onUpdate={updateWizardData}
            contents={initialContents}
            onSaveDraft={handleSaveDraft}
            isSavingDraft={isPending}
          />
        )}
        {currentStep === 5 && (
          <Step4RecommendedContents
            data={wizardData}
            onUpdate={updateWizardData}
            isEditMode={isEditMode}
          />
        )}
        {currentStep === 6 && (
          <Step6FinalReview
            data={wizardData}
            onUpdate={updateWizardData}
            contents={initialContents}
          />
        )}
        {currentStep === 7 && draftGroupId && (
          <Step7ScheduleResult
            groupId={draftGroupId}
            onComplete={() => {
              // 완료 버튼을 눌렀을 때만 리다이렉트
              // 다른 활성 플랜 그룹이 있으면 활성화 다이얼로그 표시
              if (activeGroupNames.length > 0) {
                setActivationDialogOpen(true);
              } else {
                // 다른 활성 플랜 그룹이 없으면 바로 리다이렉트
                router.refresh(); // 캐시 갱신
                router.push(`/plan/group/${draftGroupId}`);
              }
            }}
          />
        )}
      </div>

      {/* 네비게이션 버튼 */}
      <div className="mt-6 flex justify-between">
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
          className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          style={{ display: currentStep === 7 ? "none" : "inline-flex" }}
        >
          {isPending
            ? "저장 중..."
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
