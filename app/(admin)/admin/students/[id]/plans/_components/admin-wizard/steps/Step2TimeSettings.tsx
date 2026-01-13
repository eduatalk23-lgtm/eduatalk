"use client";

/**
 * Step 2: 시간 설정
 *
 * Phase 3: 7단계 위저드 확장
 * - 스케줄러 타입 선택
 * - 학원 스케줄 연동
 * - 제외 일정 설정
 * - 시간 관리 데이터 불러오기 기능
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step2TimeSettings
 */

import { useCallback, useState, useEffect } from "react";
import { Clock, Calendar, Plus, X, Building2, AlertCircle, Coffee, Moon, Sun, Lock, Download } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import {
  useAdminWizardData,
  useAdminWizardValidation,
  useAdminWizardStep,
} from "../_context";
import type { ExclusionSchedule, AcademySchedule, NonStudyTimeBlock } from "../_context/types";
import { syncTimeManagementAcademySchedulesAction } from "@/lib/domains/plan/actions/plan-groups/academy";
import { syncTimeManagementExclusionsAction } from "@/lib/domains/plan/actions/plan-groups/exclusions";
import {
  addStudentAcademyScheduleForAdmin,
  addStudentExclusionForAdmin,
} from "@/lib/domains/admin-plan/actions/timeManagement";
import { AdminAcademyScheduleImportModal } from "../modals/AdminAcademyScheduleImportModal";
import { AdminExclusionImportModal } from "../modals/AdminExclusionImportModal";

/**
 * Step2TimeSettings Props
 */
interface Step2TimeSettingsProps {
  studentId: string;
  editable?: boolean;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const SCHEDULER_TYPES = [
  {
    value: "1730_timetable",
    label: "1730 시간표",
    description: "표준 학습 시간표 적용",
  },
  {
    value: "custom",
    label: "맞춤 설정",
    description: "학원/개인 스케줄 직접 설정",
  },
];

const EXCLUSION_TYPES = [
  { value: "holiday", label: "휴일" },
  { value: "event", label: "행사" },
  { value: "personal", label: "개인" },
] as const;

const NON_STUDY_BLOCK_TYPES: Record<NonStudyTimeBlock["type"], { label: string; icon: "coffee" | "moon" | "sun" }> = {
  "아침식사": { label: "아침식사", icon: "coffee" },
  "점심식사": { label: "점심식사", icon: "coffee" },
  "저녁식사": { label: "저녁식사", icon: "coffee" },
  "수면": { label: "수면", icon: "moon" },
  "기타": { label: "기타", icon: "sun" },
};

/**
 * Step 2: 시간 설정 컴포넌트
 */
export function Step2TimeSettings({
  studentId,
  editable = true,
}: Step2TimeSettingsProps) {
  const { wizardData, updateData } = useAdminWizardData();
  const { setFieldError, clearFieldError } = useAdminWizardValidation();
  const { prevStep } = useAdminWizardStep();
  const toast = useToast();

  const {
    schedulerType,
    academySchedules,
    exclusions,
    periodStart,
    periodEnd,
    // NEW: 플래너 상속 시간 설정
    plannerId,
    studyHours,
    selfStudyHours,
    lunchTime,
    nonStudyTimeBlocks,
    // 스케줄러 옵션 (학습일/복습일)
    schedulerOptions,
  } = wizardData;

  // 플래너에서 상속된 시간 설정이 있는지 확인
  const hasInheritedTimeSettings = !!plannerId && (!!studyHours || !!selfStudyHours || !!lunchTime);

  // 플래너에서 상속된 스케줄러 옵션이 있는지 확인
  const hasInheritedSchedulerOptions = !!plannerId && !!schedulerOptions &&
    (schedulerOptions.study_days !== undefined || schedulerOptions.review_days !== undefined);

  // 플래너에서 상속된 스케줄러 타입이 있는지 확인
  const hasInheritedSchedulerType = !!plannerId && !!schedulerType;

  // 새 제외일/학원 스케줄 입력 상태
  const [newExclusion, setNewExclusion] = useState<Partial<ExclusionSchedule>>({
    exclusion_date: "",
    exclusion_type: "personal",
    reason: "",
  });

  const [newAcademy, setNewAcademy] = useState<Partial<AcademySchedule>>({
    day_of_week: 1,
    start_time: "18:00",
    end_time: "21:00",
    academy_name: "",
    subject: "",
    travel_time: 30, // 기본 이동시간 30분
  });

  const [showAddExclusion, setShowAddExclusion] = useState(false);
  const [showAddAcademy, setShowAddAcademy] = useState(false);

  // 시간 관리에서 불러오기 Modal 상태
  const [isAcademyImportModalOpen, setIsAcademyImportModalOpen] = useState(false);
  const [isExclusionImportModalOpen, setIsExclusionImportModalOpen] = useState(false);

  // 불러올 수 있는 데이터
  const [availableAcademySchedules, setAvailableAcademySchedules] = useState<AcademySchedule[]>([]);
  const [availableExclusions, setAvailableExclusions] = useState<ExclusionSchedule[]>([]);

  // 배지용 개수 (새로 불러올 수 있는 항목 수)
  const [academyAvailableCount, setAcademyAvailableCount] = useState<number | null>(null);
  const [exclusionAvailableCount, setExclusionAvailableCount] = useState<number | null>(null);

  // 로딩 상태
  const [isLoadingAcademy, setIsLoadingAcademy] = useState(false);
  const [isLoadingExclusion, setIsLoadingExclusion] = useState(false);

  /**
   * 제외일 유형 변환: 한글(시간관리) → 영문(관리자 위저드)
   */
  const mapExclusionType = (korean: string): "holiday" | "event" | "personal" => {
    switch (korean) {
      case "휴일지정":
        return "holiday";
      case "휴가":
      case "개인사정":
        return "personal";
      default:
        return "event";
    }
  };

  /**
   * 학원 일정 키 생성 (중복 체크용)
   */
  const getAcademyKey = (schedule: AcademySchedule): string => {
    return `${schedule.day_of_week}-${schedule.start_time}-${schedule.end_time}`;
  };

  /**
   * 제외일 키 생성 (중복 체크용)
   */
  const getExclusionKey = (exclusion: ExclusionSchedule): string => {
    return `${exclusion.exclusion_date}-${exclusion.exclusion_type}`;
  };

  // 스케줄러 타입 변경
  const handleSchedulerTypeChange = useCallback(
    (type: "1730_timetable" | "custom" | "") => {
      updateData({ schedulerType: type });
    },
    [updateData]
  );

  // 제외일 추가 (시간 관리에도 저장)
  const handleAddExclusion = useCallback(async () => {
    if (!newExclusion.exclusion_date) {
      setFieldError("exclusion", "날짜를 선택해주세요.");
      return;
    }

    // 기간 내 날짜인지 확인
    if (periodStart && periodEnd) {
      const date = new Date(newExclusion.exclusion_date);
      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      if (date < start || date > end) {
        setFieldError("exclusion", "학습 기간 내의 날짜를 선택해주세요.");
        return;
      }
    }

    // 중복 확인
    const isDuplicate = exclusions.some(
      (e) => e.exclusion_date === newExclusion.exclusion_date
    );
    if (isDuplicate) {
      setFieldError("exclusion", "이미 추가된 날짜입니다.");
      return;
    }

    // 시간 관리에 저장
    setIsLoadingExclusion(true);
    try {
      const result = await addStudentExclusionForAdmin(studentId, {
        exclusion_date: newExclusion.exclusion_date,
        exclusion_type: newExclusion.exclusion_type || "personal",
        reason: newExclusion.reason,
      });

      if (!result.success) {
        setFieldError("exclusion", result.error || "제외일 저장에 실패했습니다.");
        return;
      }

      // 위저드 컨텍스트에도 추가
      updateData({
        exclusions: [
          ...exclusions,
          {
            exclusion_date: newExclusion.exclusion_date,
            exclusion_type: newExclusion.exclusion_type || "personal",
            reason: newExclusion.reason,
            source: "manual",
          },
        ],
      });

      // 성공 토스트
      toast.showSuccess("제외일이 시간 관리에 저장되었습니다.");

      setNewExclusion({
        exclusion_date: "",
        exclusion_type: "personal",
        reason: "",
      });
      setShowAddExclusion(false);
      clearFieldError("exclusion");

      // 배지 카운트 갱신
      loadExclusionAvailableCount();
    } catch (error) {
      console.error("[handleAddExclusion] Error:", error);
      setFieldError("exclusion", "제외일 저장 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingExclusion(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newExclusion, exclusions, periodStart, periodEnd, studentId, updateData, setFieldError, clearFieldError, toast]);

  // 제외일 삭제
  const handleRemoveExclusion = useCallback(
    (index: number) => {
      updateData({
        exclusions: exclusions.filter((_, i) => i !== index),
      });
    },
    [exclusions, updateData]
  );

  // 학원 스케줄 추가 (시간 관리에도 저장)
  const handleAddAcademy = useCallback(async () => {
    if (!newAcademy.start_time || !newAcademy.end_time) {
      setFieldError("academy", "시간을 입력해주세요.");
      return;
    }

    // 종료 시간이 시작 시간보다 이후인지 확인
    if (newAcademy.start_time >= newAcademy.end_time) {
      setFieldError("academy", "종료 시간은 시작 시간보다 이후여야 합니다.");
      return;
    }

    // 동일 요일에 시간대가 겹치는 일정 중복 확인
    const dayOfWeek = newAcademy.day_of_week ?? 1;
    const startTime = newAcademy.start_time;
    const endTime = newAcademy.end_time;
    const hasOverlap = academySchedules.some((schedule) => {
      if (schedule.day_of_week !== dayOfWeek) return false;
      // 시간대 겹침 체크: 새 시작 < 기존 종료 && 새 종료 > 기존 시작
      return startTime < schedule.end_time && endTime > schedule.start_time;
    });

    if (hasOverlap) {
      setFieldError("academy", "해당 요일에 시간대가 겹치는 일정이 있습니다.");
      return;
    }

    // 시간 관리에 저장
    setIsLoadingAcademy(true);
    try {
      const result = await addStudentAcademyScheduleForAdmin(studentId, {
        day_of_week: dayOfWeek,
        start_time: newAcademy.start_time,
        end_time: newAcademy.end_time,
        academy_name: newAcademy.academy_name,
        subject: newAcademy.subject,
        travel_time: newAcademy.travel_time ?? 30,
      });

      if (!result.success) {
        setFieldError("academy", result.error || "학원 일정 저장에 실패했습니다.");
        return;
      }

      // 위저드 컨텍스트에도 추가
      updateData({
        academySchedules: [
          ...academySchedules,
          {
            day_of_week: dayOfWeek,
            start_time: newAcademy.start_time,
            end_time: newAcademy.end_time,
            academy_name: newAcademy.academy_name,
            subject: newAcademy.subject,
            travel_time: newAcademy.travel_time ?? 30,
            source: "manual",
          },
        ],
      });

      // 성공 토스트
      toast.showSuccess("학원 일정이 시간 관리에 저장되었습니다.");

      setNewAcademy({
        day_of_week: 1,
        start_time: "18:00",
        end_time: "21:00",
        academy_name: "",
        subject: "",
        travel_time: 30,
      });
      setShowAddAcademy(false);
      clearFieldError("academy");

      // 배지 카운트 갱신
      loadAcademyAvailableCount();
    } catch (error) {
      console.error("[handleAddAcademy] Error:", error);
      setFieldError("academy", "학원 일정 저장 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingAcademy(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newAcademy, academySchedules, studentId, updateData, setFieldError, clearFieldError, toast]);

  // 학원 스케줄 삭제
  const handleRemoveAcademy = useCallback(
    (index: number) => {
      updateData({
        academySchedules: academySchedules.filter((_, i) => i !== index),
      });
    },
    [academySchedules, updateData]
  );

  /**
   * 학원 일정 개수 조회 (배지용)
   */
  const loadAcademyAvailableCount = useCallback(async () => {
    if (!studentId) return;
    try {
      const result = await syncTimeManagementAcademySchedulesAction(null, studentId);
      if (result.academySchedules) {
        // 이미 등록된 항목 제외
        const existingKeys = new Set(academySchedules.map(getAcademyKey));
        const newCount = result.academySchedules.filter(
          (s) => !existingKeys.has(`${s.day_of_week}-${s.start_time}-${s.end_time}`)
        ).length;
        setAcademyAvailableCount(newCount > 0 ? newCount : null);
      }
    } catch {
      // 에러 시 배지 숨김
      setAcademyAvailableCount(null);
    }
  }, [studentId, academySchedules]);

  /**
   * 제외일 개수 조회 (배지용)
   */
  const loadExclusionAvailableCount = useCallback(async () => {
    if (!studentId || !periodStart || !periodEnd) return;
    try {
      const result = await syncTimeManagementExclusionsAction(null, periodStart, periodEnd, studentId);
      if (result.exclusions) {
        // 이미 등록된 항목 제외 (날짜+유형 조합)
        const existingKeys = new Set(exclusions.map(getExclusionKey));
        const newCount = result.exclusions.filter(
          (e) => !existingKeys.has(`${e.exclusion_date}-${mapExclusionType(e.exclusion_type)}`)
        ).length;
        setExclusionAvailableCount(newCount > 0 ? newCount : null);
      }
    } catch {
      // 에러 시 배지 숨김
      setExclusionAvailableCount(null);
    }
  }, [studentId, periodStart, periodEnd, exclusions]);

  /**
   * 학원 일정 불러오기 모달 열기
   */
  const handleOpenAcademyImportModal = useCallback(async () => {
    if (!studentId) {
      toast.showError("학생 정보를 찾을 수 없습니다.");
      return;
    }

    setIsLoadingAcademy(true);
    try {
      const result = await syncTimeManagementAcademySchedulesAction(null, studentId);
      if (!result.academySchedules || result.academySchedules.length === 0) {
        toast.showInfo("시간 관리에 등록된 학원 일정이 없습니다.");
        return;
      }

      // 관리자 위저드 타입으로 변환
      const convertedSchedules: AcademySchedule[] = result.academySchedules.map((s) => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        academy_name: s.academy_name,
        subject: s.subject,
        travel_time: s.travel_time ?? 30,
        source: "imported" as const,
      }));

      setAvailableAcademySchedules(convertedSchedules);
      setIsAcademyImportModalOpen(true);
    } catch (error) {
      toast.showError("학원 일정을 불러오는 중 오류가 발생했습니다.");
      console.error("Academy schedule load error:", error);
    } finally {
      setIsLoadingAcademy(false);
    }
  }, [studentId]);

  /**
   * 제외일 불러오기 모달 열기
   */
  const handleOpenExclusionImportModal = useCallback(async () => {
    if (!studentId) {
      toast.showError("학생 정보를 찾을 수 없습니다.");
      return;
    }

    if (!periodStart || !periodEnd) {
      toast.showError("학습 기간을 먼저 설정해주세요.");
      return;
    }

    setIsLoadingExclusion(true);
    try {
      const result = await syncTimeManagementExclusionsAction(null, periodStart, periodEnd, studentId);
      if (!result.exclusions || result.exclusions.length === 0) {
        toast.showInfo("해당 기간 내 등록된 제외일이 없습니다.");
        return;
      }

      // 관리자 위저드 타입으로 변환
      const convertedExclusions: ExclusionSchedule[] = result.exclusions.map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: mapExclusionType(e.exclusion_type),
        reason: e.reason,
        source: "imported" as const,
      }));

      setAvailableExclusions(convertedExclusions);
      setIsExclusionImportModalOpen(true);
    } catch (error) {
      toast.showError("제외일을 불러오는 중 오류가 발생했습니다.");
      console.error("Exclusion load error:", error);
    } finally {
      setIsLoadingExclusion(false);
    }
  }, [studentId, periodStart, periodEnd]);

  /**
   * 학원 일정 Import 핸들러
   */
  const handleImportAcademySchedules = useCallback(
    (selectedSchedules: AcademySchedule[]) => {
      // 기존 항목과 중복되지 않는 것만 추가
      const existingKeys = new Set(academySchedules.map(getAcademyKey));
      const newSchedules = selectedSchedules.filter(
        (s) => !existingKeys.has(getAcademyKey(s))
      );

      if (newSchedules.length === 0) {
        toast.showInfo("추가할 새로운 학원 일정이 없습니다.");
        return;
      }

      updateData({
        academySchedules: [...academySchedules, ...newSchedules],
      });

      toast.showSuccess(`${newSchedules.length}개의 학원 일정이 추가되었습니다.`);
      setIsAcademyImportModalOpen(false);
    },
    [academySchedules, updateData]
  );

  /**
   * 제외일 Import 핸들러
   */
  const handleImportExclusions = useCallback(
    (selectedExclusions: ExclusionSchedule[]) => {
      // 기존 항목과 중복되지 않는 것만 추가
      const existingKeys = new Set(exclusions.map(getExclusionKey));
      const newExclusions = selectedExclusions.filter(
        (e) => !existingKeys.has(getExclusionKey(e))
      );

      if (newExclusions.length === 0) {
        toast.showInfo("추가할 새로운 제외일이 없습니다.");
        return;
      }

      updateData({
        exclusions: [...exclusions, ...newExclusions],
      });

      toast.showSuccess(`${newExclusions.length}개의 제외일이 추가되었습니다.`);
      setIsExclusionImportModalOpen(false);
    },
    [exclusions, updateData]
  );

  // 학원 일정 개수 로드 (초기 및 academySchedules 변경 시)
  useEffect(() => {
    loadAcademyAvailableCount();
  }, [loadAcademyAvailableCount]);

  // 제외일 개수 로드 (기간 설정 후 및 exclusions 변경 시)
  useEffect(() => {
    if (periodStart && periodEnd) {
      loadExclusionAvailableCount();
    }
  }, [loadExclusionAvailableCount, periodStart, periodEnd]);

  return (
    <div className="space-y-6">
      {/* 플래너 상속 시간 설정 표시 (읽기 전용) */}
      {hasInheritedTimeSettings && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-blue-500" />
            <label className="text-sm font-medium text-gray-700">
              플래너에서 상속된 시간 설정
            </label>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              읽기 전용
            </span>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="grid grid-cols-3 gap-4">
              {/* 학습 시간 */}
              {studyHours && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Sun className="h-3 w-3" />
                    학습 시간
                  </div>
                  <p className="text-sm font-medium text-gray-800">
                    {studyHours.start} - {studyHours.end}
                  </p>
                </div>
              )}
              {/* 자율학습 시간 */}
              {selfStudyHours && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Moon className="h-3 w-3" />
                    자율학습 시간
                  </div>
                  <p className="text-sm font-medium text-gray-800">
                    {selfStudyHours.start} - {selfStudyHours.end}
                  </p>
                </div>
              )}
              {/* 점심 시간 */}
              {lunchTime && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Coffee className="h-3 w-3" />
                    점심 시간
                  </div>
                  <p className="text-sm font-medium text-gray-800">
                    {lunchTime.start} - {lunchTime.end}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 비학습 블록 표시 (플래너 상속) */}
      {nonStudyTimeBlocks && nonStudyTimeBlocks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Coffee className="h-4 w-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">
              비학습 시간 블록
            </label>
            {plannerId && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                플래너에서 상속
              </span>
            )}
          </div>
          <div className="space-y-2">
            {nonStudyTimeBlocks.map((block, index) => {
              const blockInfo = NON_STUDY_BLOCK_TYPES[block.type];
              const IconComponent = blockInfo?.icon === "coffee" ? Coffee : blockInfo?.icon === "moon" ? Moon : Sun;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-4 w-4 text-gray-400" />
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {blockInfo?.label || block.type}
                    </span>
                    <span className="text-sm text-gray-700">
                      {block.start_time.slice(0, 5)} - {block.end_time.slice(0, 5)}
                    </span>
                    {block.day_of_week && block.day_of_week.length > 0 && block.day_of_week.length < 7 && (
                      <span className="text-xs text-gray-500">
                        ({block.day_of_week.map(d => WEEKDAYS[d]).join(", ")})
                      </span>
                    )}
                    {block.description && (
                      <span className="text-sm text-gray-500">- {block.description}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 스케줄러 타입 선택 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Clock className="h-4 w-4" />
            스케줄러 타입
          </label>
          {hasInheritedSchedulerType && (
            <div className="flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-blue-500" />
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                플래너에서 상속
              </span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {SCHEDULER_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() =>
                handleSchedulerTypeChange(
                  type.value as "1730_timetable" | "custom"
                )
              }
              disabled={!editable || hasInheritedSchedulerType}
              data-testid={`scheduler-type-${type.value}`}
              className={cn(
                "flex flex-col items-start rounded-lg border p-4 text-left transition",
                schedulerType === type.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300",
                (!editable || hasInheritedSchedulerType) && "cursor-not-allowed opacity-60"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "font-medium",
                    schedulerType === type.value
                      ? "text-blue-700"
                      : "text-gray-900"
                  )}
                >
                  {type.label}
                </span>
                {hasInheritedSchedulerType && schedulerType === type.value && (
                  <Lock className="h-3.5 w-3.5 text-blue-500" />
                )}
              </div>
              <span className="mt-1 text-xs text-gray-500">
                {type.description}
              </span>
            </button>
          ))}
        </div>

        {/* 플래너에서 상속된 스케줄러 옵션 (학습일/복습일) - 읽기 전용 */}
        {hasInheritedSchedulerOptions && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-900">
                플래너에서 상속된 주간 학습/복습 설정
              </span>
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                읽기 전용
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-600">주간 학습일:</span>
                <span className="text-sm font-medium text-blue-900">
                  {schedulerOptions?.study_days ?? 6}일
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-600">주간 복습일:</span>
                <span className="text-sm font-medium text-blue-900">
                  {schedulerOptions?.review_days ?? 1}일
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-blue-600">
              이 설정은 플래너에서 상속됩니다. 수정하려면 플래너 설정을 변경하세요.
            </p>
          </div>
        )}
      </div>

      {/* 학원 스케줄 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Building2 className="h-4 w-4" />
            학원 스케줄 <span className="text-xs text-gray-400">(선택)</span>
          </label>
          {editable && (
            <div className="flex items-center gap-2">
              {/* 시간 관리에서 불러오기 버튼 */}
              <button
                type="button"
                onClick={handleOpenAcademyImportModal}
                disabled={isLoadingAcademy}
                data-testid="import-academy-button"
                className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {isLoadingAcademy ? "불러오는 중..." : "시간 관리에서 불러오기"}
                {academyAvailableCount !== null && academyAvailableCount > 0 && (
                  <span className="ml-1 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                    {academyAvailableCount}
                  </span>
                )}
              </button>
              {/* 직접 추가 버튼 */}
              <button
                type="button"
                onClick={() => setShowAddAcademy(true)}
                data-testid="add-academy-button"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-4 w-4" />
                직접 추가
              </button>
            </div>
          )}
        </div>

        {/* 학원 스케줄 목록 */}
        {academySchedules.length > 0 ? (
          <div className="space-y-2">
            {academySchedules.map((schedule, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {WEEKDAYS[schedule.day_of_week]}
                  </span>
                  <span className="text-sm text-gray-700">
                    {schedule.start_time.slice(0, 5)} -{" "}
                    {schedule.end_time.slice(0, 5)}
                  </span>
                  {schedule.academy_name && (
                    <span className="text-sm text-gray-500">
                      {schedule.academy_name}
                    </span>
                  )}
                  {schedule.travel_time !== undefined && schedule.travel_time > 0 && (
                    <span className="text-xs text-orange-600">
                      (이동 {schedule.travel_time}분)
                    </span>
                  )}
                  {schedule.is_locked && (
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-500">
                      플래너
                    </span>
                  )}
                </div>
                {editable && !schedule.is_locked && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAcademy(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-4 text-center text-sm text-gray-500">
            등록된 학원 스케줄이 없습니다.
          </div>
        )}

        {/* 학원 스케줄 추가 폼 */}
        {showAddAcademy && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-600">요일</label>
                <select
                  value={newAcademy.day_of_week}
                  onChange={(e) =>
                    setNewAcademy({ ...newAcademy, day_of_week: Number(e.target.value) })
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {WEEKDAYS.map((day, i) => (
                    <option key={i} value={i}>
                      {day}요일
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">학원명</label>
                <input
                  type="text"
                  value={newAcademy.academy_name || ""}
                  onChange={(e) =>
                    setNewAcademy({ ...newAcademy, academy_name: e.target.value })
                  }
                  placeholder="학원명 (선택)"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">시작 시간</label>
                <input
                  type="time"
                  value={newAcademy.start_time}
                  onChange={(e) =>
                    setNewAcademy({ ...newAcademy, start_time: e.target.value })
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">종료 시간</label>
                <input
                  type="time"
                  value={newAcademy.end_time}
                  onChange={(e) =>
                    setNewAcademy({ ...newAcademy, end_time: e.target.value })
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">
                  이동시간 (분)
                  <span className="ml-1 text-orange-500">*</span>
                </label>
                <input
                  type="number"
                  value={newAcademy.travel_time ?? 30}
                  onChange={(e) =>
                    setNewAcademy({ ...newAcademy, travel_time: Number(e.target.value) })
                  }
                  min={0}
                  max={180}
                  placeholder="30"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
                <p className="mt-0.5 text-xs text-gray-500">등/하원 이동에 필요한 시간</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">과목 (선택)</label>
                <input
                  type="text"
                  value={newAcademy.subject || ""}
                  onChange={(e) =>
                    setNewAcademy({ ...newAcademy, subject: e.target.value })
                  }
                  placeholder="예: 수학, 영어"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddAcademy(false)}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddAcademy}
                data-testid="confirm-add-academy"
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                추가
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 제외 일정 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Calendar className="h-4 w-4" />
            제외 일정 <span className="text-xs text-gray-400">(선택)</span>
          </label>
          {editable && (
            <div className="flex items-center gap-2">
              {/* 시간 관리에서 불러오기 버튼 */}
              <button
                type="button"
                onClick={handleOpenExclusionImportModal}
                disabled={isLoadingExclusion || !periodStart || !periodEnd}
                data-testid="import-exclusion-button"
                className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!periodStart || !periodEnd ? "학습 기간을 먼저 설정해주세요" : ""}
              >
                <Download className="h-4 w-4" />
                {isLoadingExclusion ? "불러오는 중..." : "시간 관리에서 불러오기"}
                {exclusionAvailableCount !== null && exclusionAvailableCount > 0 && (
                  <span className="ml-1 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                    {exclusionAvailableCount}
                  </span>
                )}
              </button>
              {/* 직접 추가 버튼 */}
              <button
                type="button"
                onClick={() => setShowAddExclusion(true)}
                data-testid="add-exclusion-button"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-4 w-4" />
                직접 추가
              </button>
            </div>
          )}
        </div>

        {/* 제외일 목록 */}
        {exclusions.length > 0 ? (
          <div className="space-y-2">
            {exclusions.map((exc, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">
                    {exc.exclusion_date}
                  </span>
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-medium",
                      exc.exclusion_type === "holiday"
                        ? "bg-red-100 text-red-700"
                        : exc.exclusion_type === "event"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                    )}
                  >
                    {EXCLUSION_TYPES.find((t) => t.value === exc.exclusion_type)?.label ||
                      exc.exclusion_type}
                  </span>
                  {exc.reason && (
                    <span className="text-sm text-gray-500">{exc.reason}</span>
                  )}
                </div>
                {editable && !exc.is_locked && (
                  <button
                    type="button"
                    onClick={() => handleRemoveExclusion(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-4 text-center text-sm text-gray-500">
            등록된 제외 일정이 없습니다.
          </div>
        )}

        {/* 제외일 추가 폼 */}
        {showAddExclusion && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-600">날짜</label>
                <input
                  type="date"
                  value={newExclusion.exclusion_date}
                  min={periodStart}
                  max={periodEnd}
                  onChange={(e) =>
                    setNewExclusion({ ...newExclusion, exclusion_date: e.target.value })
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">유형</label>
                <select
                  value={newExclusion.exclusion_type}
                  onChange={(e) =>
                    setNewExclusion({
                      ...newExclusion,
                      exclusion_type: e.target.value as ExclusionSchedule["exclusion_type"],
                    })
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {EXCLUSION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">사유</label>
                <input
                  type="text"
                  value={newExclusion.reason || ""}
                  onChange={(e) =>
                    setNewExclusion({ ...newExclusion, reason: e.target.value })
                  }
                  placeholder="사유 (선택)"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddExclusion(false)}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddExclusion}
                data-testid="confirm-add-exclusion"
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                추가
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 안내 메시지 */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">시간 설정 안내</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-blue-700">
            <li>학원 스케줄이 있는 시간대는 학습 시간에서 자동으로 제외됩니다.</li>
            <li>제외 일정은 해당 날짜 전체가 학습에서 제외됩니다.</li>
            <li>다음 단계에서 설정된 스케줄을 미리 확인할 수 있습니다.</li>
          </ul>
        </div>
      </div>

      {/* 학원 일정 Import Modal */}
      <AdminAcademyScheduleImportModal
        isOpen={isAcademyImportModalOpen}
        onClose={() => setIsAcademyImportModalOpen(false)}
        availableSchedules={availableAcademySchedules}
        existingSchedules={academySchedules}
        onImport={handleImportAcademySchedules}
      />

      {/* 제외일 Import Modal */}
      <AdminExclusionImportModal
        isOpen={isExclusionImportModalOpen}
        onClose={() => setIsExclusionImportModalOpen(false)}
        availableExclusions={availableExclusions}
        existingExclusions={exclusions}
        onImport={handleImportExclusions}
        periodStart={periodStart}
        periodEnd={periodEnd}
      />
    </div>
  );
}
