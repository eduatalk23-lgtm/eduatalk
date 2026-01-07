"use client";

/**
 * PlannerCreationModal
 *
 * 새 플래너 생성 모달
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/PlannerCreationModal
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { X, Loader2, Calendar, Clock, Info, Moon, Download, Building, CalendarX } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  createPlannerAction,
  updatePlannerAction,
  type Planner,
  type CreatePlannerInput,
  type UpdatePlannerInput,
  type NonStudyTimeBlock,
  type PlannerAcademyScheduleInput,
  type PlannerExclusionInput,
} from "@/lib/domains/admin-plan/actions";
import { NonStudyTimeBlocksEditor } from "./NonStudyTimeBlocksEditor";
import { AdminAcademyScheduleImportModal } from "./admin-wizard/modals/AdminAcademyScheduleImportModal";
import { AdminExclusionImportModal } from "./admin-wizard/modals/AdminExclusionImportModal";
import { syncTimeManagementAcademySchedulesAction } from "@/lib/domains/plan/actions/plan-groups/academy";
import { syncTimeManagementExclusionsAction } from "@/lib/domains/plan/actions/plan-groups/exclusions";
import type { AcademySchedule, ExclusionSchedule } from "./admin-wizard/_context/types";

// ============================================
// 상수
// ============================================

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 제외일 타입 매핑 (DB 타입 → 위저드 타입)
 */
function mapExclusionTypeFromTimeManagement(
  type: string
): ExclusionSchedule["exclusion_type"] {
  switch (type) {
    case "휴일지정":
      return "holiday";
    case "휴가":
    case "개인사정":
      return "personal";
    case "행사":
      return "event";
    default:
      return "personal";
  }
}

/**
 * 제외일 타입 매핑 (위저드 타입 → DB 타입)
 */
function mapExclusionTypeToPlanner(
  type: ExclusionSchedule["exclusion_type"]
): PlannerExclusionInput["exclusionType"] {
  switch (type) {
    case "holiday":
      return "휴일지정";
    case "personal":
      return "개인사정";
    case "event":
      return "기타";
    default:
      return "기타";
  }
}

// ============================================
// 타입 정의
// ============================================

interface PlannerCreationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (planner: Planner) => void;
  studentId: string;
  tenantId: string;
  studentName: string;
  /** 편집 모드: 기존 플래너 데이터 전달 */
  editPlanner?: Planner;
  /** 복제 모드: 기존 플래너를 복제할 때 사용 */
  duplicateFrom?: Planner;
}

interface FormData {
  name: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  targetDate: string;
  studyHoursStart: string;
  studyHoursEnd: string;
  selfStudyHoursStart: string;
  selfStudyHoursEnd: string;
  lunchTimeStart: string;
  lunchTimeEnd: string;
  schedulerType: "1730_timetable" | "custom";
  studyDays: number;
  reviewDays: number;
  adminMemo: string;
}

// ============================================
// 초기값
// ============================================

function getDefaultFormData(): FormData {
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return {
    name: "",
    description: "",
    periodStart: today.toISOString().split("T")[0],
    periodEnd: nextMonth.toISOString().split("T")[0],
    targetDate: "",
    studyHoursStart: "10:00",
    studyHoursEnd: "19:00",
    selfStudyHoursStart: "19:00",
    selfStudyHoursEnd: "22:00",
    lunchTimeStart: "12:00",
    lunchTimeEnd: "13:00",
    schedulerType: "1730_timetable",
    studyDays: 6,
    reviewDays: 1,
    adminMemo: "",
  };
}

/**
 * 플래너 데이터를 FormData로 변환
 */
function plannerToFormData(planner: Planner, isDuplicate: boolean = false): FormData {
  const schedulerOptions = planner.defaultSchedulerOptions as {
    study_days?: number;
    review_days?: number;
  } | null;

  return {
    name: isDuplicate ? `${planner.name} (복사본)` : planner.name,
    description: planner.description || "",
    periodStart: planner.periodStart,
    periodEnd: planner.periodEnd,
    targetDate: planner.targetDate || "",
    studyHoursStart: planner.studyHours?.start || "10:00",
    studyHoursEnd: planner.studyHours?.end || "19:00",
    selfStudyHoursStart: planner.selfStudyHours?.start || "19:00",
    selfStudyHoursEnd: planner.selfStudyHours?.end || "22:00",
    lunchTimeStart: planner.lunchTime?.start || "12:00",
    lunchTimeEnd: planner.lunchTime?.end || "13:00",
    schedulerType: (planner.defaultSchedulerType as "1730_timetable" | "custom") || "1730_timetable",
    studyDays: schedulerOptions?.study_days ?? 6,
    reviewDays: schedulerOptions?.review_days ?? 1,
    adminMemo: planner.adminMemo || "",
  };
}

// ============================================
// 메인 컴포넌트
// ============================================

export function PlannerCreationModal({
  open,
  onClose,
  onSuccess,
  studentId,
  tenantId,
  studentName,
  editPlanner,
  duplicateFrom,
}: PlannerCreationModalProps) {
  const [formData, setFormData] = useState<FormData>(getDefaultFormData);
  const [nonStudyBlocks, setNonStudyBlocks] = useState<NonStudyTimeBlock[]>([]);
  const [showSelfStudy, setShowSelfStudy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 학원 일정 관련 상태
  const [academySchedules, setAcademySchedules] = useState<AcademySchedule[]>([]);
  const [availableAcademySchedules, setAvailableAcademySchedules] = useState<AcademySchedule[]>([]);
  const [isAcademyImportModalOpen, setIsAcademyImportModalOpen] = useState(false);
  const [isLoadingAcademy, setIsLoadingAcademy] = useState(false);

  // 제외일 관련 상태
  const [exclusions, setExclusions] = useState<ExclusionSchedule[]>([]);
  const [availableExclusions, setAvailableExclusions] = useState<ExclusionSchedule[]>([]);
  const [isExclusionImportModalOpen, setIsExclusionImportModalOpen] = useState(false);
  const [isLoadingExclusion, setIsLoadingExclusion] = useState(false);

  // 모드 판별
  const mode = useMemo(() => {
    if (editPlanner) return "edit";
    if (duplicateFrom) return "duplicate";
    return "create";
  }, [editPlanner, duplicateFrom]);

  const modalTitle = useMemo(() => {
    switch (mode) {
      case "edit":
        return "플래너 수정";
      case "duplicate":
        return "플래너 복제";
      default:
        return "새 플래너 만들기";
    }
  }, [mode]);

  const submitButtonText = useMemo(() => {
    if (isSubmitting) {
      switch (mode) {
        case "edit":
          return "수정 중...";
        case "duplicate":
          return "복제 중...";
        default:
          return "생성 중...";
      }
    }
    switch (mode) {
      case "edit":
        return "플래너 수정";
      case "duplicate":
        return "플래너 복제";
      default:
        return "플래너 생성";
    }
  }, [mode, isSubmitting]);

  // 모달 열릴 때 폼 데이터 초기화
  useEffect(() => {
    if (open) {
      if (editPlanner) {
        setFormData(plannerToFormData(editPlanner, false));
        setNonStudyBlocks(editPlanner.nonStudyTimeBlocks || []);
        setShowSelfStudy(!!editPlanner.selfStudyHours);
        // 편집 모드에서 기존 학원일정/제외일 로드
        setAcademySchedules(
          (editPlanner.academySchedules || []).map((s) => ({
            day_of_week: s.dayOfWeek,
            start_time: s.startTime,
            end_time: s.endTime,
            academy_name: s.academyName || undefined,
            subject: s.subject || undefined,
            travel_time: s.travelTime,
            source: (s.source as AcademySchedule["source"]) || "imported",
            is_locked: s.isLocked,
          }))
        );
        setExclusions(
          (editPlanner.exclusions || []).map((e) => ({
            exclusion_date: e.exclusionDate,
            exclusion_type: mapExclusionTypeFromTimeManagement(e.exclusionType),
            reason: e.reason || undefined,
            source: (e.source as ExclusionSchedule["source"]) || "imported",
            is_locked: e.isLocked,
          }))
        );
      } else if (duplicateFrom) {
        setFormData(plannerToFormData(duplicateFrom, true));
        setNonStudyBlocks(duplicateFrom.nonStudyTimeBlocks || []);
        setShowSelfStudy(!!duplicateFrom.selfStudyHours);
        // 복제 모드에서도 학원일정/제외일 복제
        setAcademySchedules(
          (duplicateFrom.academySchedules || []).map((s) => ({
            day_of_week: s.dayOfWeek,
            start_time: s.startTime,
            end_time: s.endTime,
            academy_name: s.academyName || undefined,
            subject: s.subject || undefined,
            travel_time: s.travelTime,
            source: "imported" as const,
            is_locked: false,
          }))
        );
        setExclusions(
          (duplicateFrom.exclusions || []).map((e) => ({
            exclusion_date: e.exclusionDate,
            exclusion_type: mapExclusionTypeFromTimeManagement(e.exclusionType),
            reason: e.reason || undefined,
            source: "imported" as const,
            is_locked: false,
          }))
        );
      } else {
        setFormData(getDefaultFormData());
        setNonStudyBlocks([]);
        setShowSelfStudy(false);
        setAcademySchedules([]);
        setExclusions([]);
      }
      setError(null);
    }
  }, [open, editPlanner, duplicateFrom]);

  // 폼 필드 변경 핸들러
  const handleChange = useCallback(
    (field: keyof FormData, value: string | number) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setError(null);
    },
    []
  );

  // 폼 유효성 검사
  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return "플래너 이름을 입력해주세요.";
    }
    if (!formData.periodStart || !formData.periodEnd) {
      return "기간을 설정해주세요.";
    }
    if (new Date(formData.periodStart) > new Date(formData.periodEnd)) {
      return "종료일은 시작일보다 뒤여야 합니다.";
    }
    if (formData.targetDate && new Date(formData.targetDate) < new Date(formData.periodEnd)) {
      return "목표일은 종료일 이후여야 합니다.";
    }
    return null;
  };

  // ============================================
  // 학원 일정 Import 핸들러
  // ============================================

  const handleOpenAcademyImportModal = useCallback(async () => {
    setIsLoadingAcademy(true);
    try {
      const result = await syncTimeManagementAcademySchedulesAction(null, studentId);
      if (!result.academySchedules || result.academySchedules.length === 0) {
        setError("시간 관리에 등록된 학원 일정이 없습니다.");
        return;
      }

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
    } catch (err) {
      console.error("[PlannerCreationModal] 학원 일정 불러오기 실패:", err);
      setError("학원 일정을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingAcademy(false);
    }
  }, [studentId]);

  const handleImportAcademySchedules = useCallback((selected: AcademySchedule[]) => {
    // 중복 제거: day_of_week + start_time + end_time 조합으로 판단
    const existingKeys = new Set(
      academySchedules.map((s) => `${s.day_of_week}-${s.start_time}-${s.end_time}`)
    );
    const newSchedules = selected.filter(
      (s) => !existingKeys.has(`${s.day_of_week}-${s.start_time}-${s.end_time}`)
    );

    if (newSchedules.length > 0) {
      setAcademySchedules((prev) => [...prev, ...newSchedules]);
    }
    setIsAcademyImportModalOpen(false);
  }, [academySchedules]);

  const handleRemoveAcademySchedule = useCallback((index: number) => {
    setAcademySchedules((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ============================================
  // 제외일 Import 핸들러
  // ============================================

  const handleOpenExclusionImportModal = useCallback(async () => {
    if (!formData.periodStart || !formData.periodEnd) {
      setError("학습 기간을 먼저 설정해주세요.");
      return;
    }

    setIsLoadingExclusion(true);
    try {
      const result = await syncTimeManagementExclusionsAction(
        null,
        formData.periodStart,
        formData.periodEnd,
        studentId
      );
      if (!result.exclusions || result.exclusions.length === 0) {
        setError("해당 기간 내 등록된 제외일이 없습니다.");
        return;
      }

      const convertedExclusions: ExclusionSchedule[] = result.exclusions.map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: mapExclusionTypeFromTimeManagement(e.exclusion_type),
        reason: e.reason,
        source: "imported" as const,
      }));

      setAvailableExclusions(convertedExclusions);
      setIsExclusionImportModalOpen(true);
    } catch (err) {
      console.error("[PlannerCreationModal] 제외일 불러오기 실패:", err);
      setError("제외일을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingExclusion(false);
    }
  }, [studentId, formData.periodStart, formData.periodEnd]);

  const handleImportExclusions = useCallback((selected: ExclusionSchedule[]) => {
    // 중복 제거: exclusion_date + exclusion_type 조합으로 판단
    const existingKeys = new Set(
      exclusions.map((e) => `${e.exclusion_date}-${e.exclusion_type}`)
    );
    const newExclusions = selected.filter(
      (e) => !existingKeys.has(`${e.exclusion_date}-${e.exclusion_type}`)
    );

    if (newExclusions.length > 0) {
      setExclusions((prev) => [...prev, ...newExclusions]);
    }
    setIsExclusionImportModalOpen(false);
  }, [exclusions]);

  const handleRemoveExclusion = useCallback((index: number) => {
    setExclusions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 폼 제출
  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let result: Planner | null = null;

      if (mode === "edit" && editPlanner) {
        // 수정 모드
        const updateInput: UpdatePlannerInput = {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          targetDate: formData.targetDate || null,
          studyHours: {
            start: formData.studyHoursStart,
            end: formData.studyHoursEnd,
          },
          selfStudyHours: showSelfStudy
            ? {
                start: formData.selfStudyHoursStart,
                end: formData.selfStudyHoursEnd,
              }
            : undefined,
          lunchTime: {
            start: formData.lunchTimeStart,
            end: formData.lunchTimeEnd,
          },
          nonStudyTimeBlocks: nonStudyBlocks.length > 0 ? nonStudyBlocks : [],
          defaultSchedulerType: formData.schedulerType,
          defaultSchedulerOptions: {
            study_days: formData.studyDays,
            review_days: formData.reviewDays,
          },
          adminMemo: formData.adminMemo.trim() || null,
        };

        result = await updatePlannerAction(editPlanner.id, updateInput);
      } else {
        // 생성 또는 복제 모드
        const createInput: CreatePlannerInput = {
          studentId,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          targetDate: formData.targetDate || undefined,
          studyHours: {
            start: formData.studyHoursStart,
            end: formData.studyHoursEnd,
          },
          selfStudyHours: showSelfStudy
            ? {
                start: formData.selfStudyHoursStart,
                end: formData.selfStudyHoursEnd,
              }
            : undefined,
          lunchTime: {
            start: formData.lunchTimeStart,
            end: formData.lunchTimeEnd,
          },
          nonStudyTimeBlocks: nonStudyBlocks.length > 0 ? nonStudyBlocks : undefined,
          defaultSchedulerType: formData.schedulerType,
          defaultSchedulerOptions: {
            study_days: formData.studyDays,
            review_days: formData.reviewDays,
          },
          adminMemo: formData.adminMemo.trim() || undefined,
          // 학원 일정 (시간 관리에서 불러온 데이터)
          academySchedules: academySchedules.length > 0
            ? academySchedules.map((s) => ({
                dayOfWeek: s.day_of_week,
                startTime: s.start_time,
                endTime: s.end_time,
                academyName: s.academy_name,
                subject: s.subject,
                travelTime: s.travel_time ?? 30,
                source: (s.source as PlannerAcademyScheduleInput["source"]) ?? "imported",
              }))
            : undefined,
          // 제외일 (시간 관리에서 불러온 데이터)
          exclusions: exclusions.length > 0
            ? exclusions.map((e) => ({
                exclusionDate: e.exclusion_date,
                exclusionType: mapExclusionTypeToPlanner(e.exclusion_type),
                reason: e.reason,
                source: (e.source as PlannerExclusionInput["source"]) ?? "imported",
              }))
            : undefined,
        };

        result = await createPlannerAction(createInput);
      }

      if (result) {
        onSuccess(result);
        setFormData(getDefaultFormData());
        setNonStudyBlocks([]);
        setShowSelfStudy(false);
        setAcademySchedules([]);
        setExclusions([]);
      }
    } catch (err) {
      console.error(`[PlannerCreationModal] ${mode} 실패:`, err);
      const errorMessages = {
        create: "플래너 생성에 실패했습니다.",
        edit: "플래너 수정에 실패했습니다.",
        duplicate: "플래너 복제에 실패했습니다.",
      };
      setError(err instanceof Error ? err.message : errorMessages[mode]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 모달 닫기
  const handleClose = () => {
    if (isSubmitting) return;
    setFormData(getDefaultFormData());
    setNonStudyBlocks([]);
    setShowSelfStudy(false);
    setAcademySchedules([]);
    setExclusions([]);
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{modalTitle}</h2>
            <p className="text-sm text-gray-500">{studentName}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-6">
            {/* 기본 정보 */}
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-3">기본 정보</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    플래너 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="예: 겨울방학 수능 대비"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">설명</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="플래너에 대한 간단한 설명"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </section>

            {/* 기간 설정 */}
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                기간 설정
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    시작일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) => handleChange("periodStart", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    종료일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.periodEnd}
                    onChange={(e) => handleChange("periodEnd", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm text-gray-600 mb-1">
                  목표일 (선택)
                </label>
                <input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => handleChange("targetDate", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                  placeholder="예: 수능일"
                />
                <p className="text-xs text-gray-500 mt-1">
                  수능, 모의고사 등 최종 목표 날짜
                </p>
              </div>
            </section>

            {/* 시간 설정 */}
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                학습 시간 설정
              </h3>
              <div className="flex flex-col gap-4">
                {/* 학습 시간 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">기본 학습 시간</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        시작
                      </label>
                      <input
                        type="time"
                        value={formData.studyHoursStart}
                        onChange={(e) => handleChange("studyHoursStart", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        종료
                      </label>
                      <input
                        type="time"
                        value={formData.studyHoursEnd}
                        onChange={(e) => handleChange("studyHoursEnd", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                {/* 점심 시간 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">점심 시간</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        시작
                      </label>
                      <input
                        type="time"
                        value={formData.lunchTimeStart}
                        onChange={(e) => handleChange("lunchTimeStart", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        종료
                      </label>
                      <input
                        type="time"
                        value={formData.lunchTimeEnd}
                        onChange={(e) => handleChange("lunchTimeEnd", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                {/* 자율학습 시간 토글 */}
                <div className="border-t pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSelfStudy}
                      onChange={(e) => setShowSelfStudy(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                      disabled={isSubmitting}
                    />
                    <Moon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">자율학습 시간 설정</span>
                  </label>
                  {showSelfStudy && (
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          시작
                        </label>
                        <input
                          type="time"
                          value={formData.selfStudyHoursStart}
                          onChange={(e) => handleChange("selfStudyHoursStart", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          종료
                        </label>
                        <input
                          type="time"
                          value={formData.selfStudyHoursEnd}
                          onChange={(e) => handleChange("selfStudyHoursEnd", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 비학습 시간 설정 */}
            <section className="border-t pt-6">
              <NonStudyTimeBlocksEditor
                blocks={nonStudyBlocks}
                onChange={setNonStudyBlocks}
                disabled={isSubmitting}
              />
            </section>

            {/* 학원 일정 섹션 */}
            <section className="border-t pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  학원 일정
                  {academySchedules.length > 0 && (
                    <span className="text-xs text-gray-500">
                      ({academySchedules.length}개)
                    </span>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={handleOpenAcademyImportModal}
                  disabled={isLoadingAcademy || isSubmitting}
                  className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {isLoadingAcademy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  시간 관리에서 불러오기
                </button>
              </div>

              {academySchedules.length > 0 ? (
                <div className="space-y-2">
                  {academySchedules.map((schedule, idx) => (
                    <div
                      key={`${schedule.day_of_week}-${schedule.start_time}-${idx}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                          {DAY_NAMES[schedule.day_of_week]}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {schedule.academy_name || "학원"}
                            {schedule.subject && (
                              <span className="text-gray-500 font-normal">
                                {" "}
                                - {schedule.subject}
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-gray-500">
                            {schedule.start_time} ~ {schedule.end_time}
                            {schedule.travel_time && schedule.travel_time > 0 && (
                              <span className="ml-2 text-gray-400">
                                (이동 {schedule.travel_time}분)
                              </span>
                            )}
                          </span>
                        </div>
                        {schedule.source === "imported" && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                            불러옴
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAcademySchedule(idx)}
                        disabled={isSubmitting}
                        className="p-1 text-gray-400 hover:text-red-500 disabled:cursor-not-allowed"
                        title="삭제"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                  <p className="text-sm text-gray-500">
                    등록된 학원 일정이 없습니다.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    &quot;시간 관리에서 불러오기&quot;를 클릭하여 학생의 학원 일정을 가져올 수 있습니다.
                  </p>
                </div>
              )}
            </section>

            {/* 제외일 섹션 */}
            <section className="border-t pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <CalendarX className="w-4 h-4" />
                  제외일
                  {exclusions.length > 0 && (
                    <span className="text-xs text-gray-500">
                      ({exclusions.length}개)
                    </span>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={handleOpenExclusionImportModal}
                  disabled={isLoadingExclusion || isSubmitting || !formData.periodStart || !formData.periodEnd}
                  className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  title={!formData.periodStart || !formData.periodEnd ? "기간을 먼저 설정해주세요" : ""}
                >
                  {isLoadingExclusion ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  시간 관리에서 불러오기
                </button>
              </div>

              {exclusions.length > 0 ? (
                <div className="space-y-2">
                  {exclusions.map((excl, idx) => {
                    const typeLabel = {
                      holiday: "휴일",
                      personal: "개인",
                      event: "행사",
                    }[excl.exclusion_type];
                    const typeColor = {
                      holiday: "bg-orange-100 text-orange-700",
                      personal: "bg-purple-100 text-purple-700",
                      event: "bg-blue-100 text-blue-700",
                    }[excl.exclusion_type];

                    return (
                      <div
                        key={`${excl.exclusion_date}-${excl.exclusion_type}-${idx}`}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "px-2 py-1 text-xs font-medium rounded-full",
                              typeColor
                            )}
                          >
                            {typeLabel}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">
                              {new Date(excl.exclusion_date).toLocaleDateString("ko-KR", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                weekday: "short",
                              })}
                            </span>
                            {excl.reason && (
                              <span className="text-xs text-gray-500">
                                {excl.reason}
                              </span>
                            )}
                          </div>
                          {excl.source === "imported" && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                              불러옴
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveExclusion(idx)}
                          disabled={isSubmitting}
                          className="p-1 text-gray-400 hover:text-red-500 disabled:cursor-not-allowed"
                          title="삭제"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                  <p className="text-sm text-gray-500">
                    등록된 제외일이 없습니다.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    &quot;시간 관리에서 불러오기&quot;를 클릭하여 학생의 제외일을 가져올 수 있습니다.
                  </p>
                </div>
              )}
            </section>

            {/* 스케줄러 설정 */}
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" />
                스케줄러 설정
              </h3>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="schedulerType"
                      value="1730_timetable"
                      checked={formData.schedulerType === "1730_timetable"}
                      onChange={(e) => handleChange("schedulerType", e.target.value)}
                      className="text-blue-600"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm">1730 타임테이블</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="schedulerType"
                      value="custom"
                      checked={formData.schedulerType === "custom"}
                      onChange={(e) => handleChange("schedulerType", e.target.value)}
                      className="text-blue-600"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm">커스텀</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      주간 학습일 수
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={formData.studyDays}
                      onChange={(e) => handleChange("studyDays", parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      주간 복습일 수
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={7}
                      value={formData.reviewDays}
                      onChange={(e) => handleChange("reviewDays", parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 관리자 메모 */}
            <section>
              <label className="block text-sm text-gray-600 mb-1">
                관리자 메모
              </label>
              <textarea
                value={formData.adminMemo}
                onChange={(e) => handleChange("adminMemo", e.target.value)}
                placeholder="관리자용 메모 (학생에게 표시되지 않음)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                disabled={isSubmitting}
              />
            </section>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-100">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg",
              isSubmitting
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitButtonText}
          </button>
        </div>
      </div>

      {/* 학원 일정 Import 모달 */}
      <AdminAcademyScheduleImportModal
        isOpen={isAcademyImportModalOpen}
        onClose={() => setIsAcademyImportModalOpen(false)}
        availableSchedules={availableAcademySchedules}
        existingSchedules={academySchedules}
        onImport={handleImportAcademySchedules}
      />

      {/* 제외일 Import 모달 */}
      <AdminExclusionImportModal
        isOpen={isExclusionImportModalOpen}
        onClose={() => setIsExclusionImportModalOpen(false)}
        availableExclusions={availableExclusions}
        existingExclusions={exclusions}
        onImport={handleImportExclusions}
        periodStart={formData.periodStart}
        periodEnd={formData.periodEnd}
      />
    </div>
  );
}

export default PlannerCreationModal;
