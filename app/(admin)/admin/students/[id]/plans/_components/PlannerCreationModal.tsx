"use client";

/**
 * PlannerCreationModal
 *
 * 새 플래너 생성 모달
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/PlannerCreationModal
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { X, Loader2, Calendar, Clock, Info, Moon, Download, Building, CalendarX, Plus } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  addStudentAcademyScheduleForAdmin,
  addStudentExclusionForAdmin,
} from "@/lib/domains/admin-plan/actions/timeManagement";
import { validateAcademyScheduleOverlap } from "@/lib/validation/scheduleValidator";
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
import {
  syncTimeManagementExclusionsAction,
  savePlannerOverridesForPlannerAction,
  getPlannerOverridesForPlannerAction,
} from "@/lib/domains/plan/actions/plan-groups/exclusions";
import type { AcademySchedule, ExclusionSchedule } from "./admin-wizard/_context/types";
import type { ExclusionType } from "@/lib/types/plan";

// ============================================
// 상수
// ============================================

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 제외일 오버라이드 타입
 * - add: 이 플래너에만 추가 (전역에 없음)
 * - remove: 전역에서 제거 (전역에 있지만 이 플래너에서는 제외)
 */
interface ExclusionOverride {
  exclusion_date: string;
  override_type: "add" | "remove";
  exclusion_type?: ExclusionType;
  reason?: string;
}

/**
 * 전역 제외일 (시간 관리에서 불러온 것)
 */
interface GlobalExclusion {
  exclusion_date: string;
  exclusion_type: string;
  reason?: string;
  /** 이 플래너에 적용할지 여부 (false면 remove 오버라이드 생성) */
  enabled: boolean;
}

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
  /** 뷰 모드 (admin: 관리자, student: 학생) */
  viewMode?: 'admin' | 'student';
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
  /** 수정 시 기존 플랜 그룹에도 변경사항 반영 여부 */
  syncToExistingGroups: boolean;
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
    syncToExistingGroups: false,
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
    syncToExistingGroups: false,
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
  viewMode = 'admin',
}: PlannerCreationModalProps) {
  const isAdminMode = viewMode === 'admin';
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

  // 제외일 관련 상태 (오버라이드 시스템)
  const [globalExclusions, setGlobalExclusions] = useState<GlobalExclusion[]>([]);
  const [plannerOnlyExclusions, setPlannerOnlyExclusions] = useState<ExclusionSchedule[]>([]); // 플래너에만 추가된 제외일
  const [isLoadingExclusion, setIsLoadingExclusion] = useState(false);
  const [hasLoadedGlobalExclusions, setHasLoadedGlobalExclusions] = useState(false);

  // 기존 호환성을 위한 레거시 상태 (하위 호환)
  const [exclusions, setExclusions] = useState<ExclusionSchedule[]>([]);
  const [availableExclusions, setAvailableExclusions] = useState<ExclusionSchedule[]>([]);
  const [isExclusionImportModalOpen, setIsExclusionImportModalOpen] = useState(false);

  // 직접 추가 관련 상태
  const [showAddAcademy, setShowAddAcademy] = useState(false);
  const [showAddExclusion, setShowAddExclusion] = useState(false);
  const [isAddingAcademy, setIsAddingAcademy] = useState(false);
  const [isAddingExclusion, setIsAddingExclusion] = useState(false);

  const [newAcademy, setNewAcademy] = useState<Partial<AcademySchedule>>({
    day_of_week: 1,
    start_time: "18:00",
    end_time: "21:00",
    academy_name: "",
    subject: "",
    travel_time: 30,
  });

  const [newExclusion, setNewExclusion] = useState<Partial<ExclusionSchedule>>({
    exclusion_date: "",
    exclusion_type: "personal",
    reason: "",
  });

  // Toast
  const toast = useToast();

  // 모드 판별
  const mode = useMemo(() => {
    if (editPlanner) return "edit";
    if (duplicateFrom) return "duplicate";
    return "create";
  }, [editPlanner, duplicateFrom]);

  // 전역 제외일 자동 로드
  const loadGlobalExclusions = useCallback(async () => {
    if (!formData.periodStart || !formData.periodEnd) return;

    setIsLoadingExclusion(true);
    try {
      const result = await syncTimeManagementExclusionsAction(
        null,
        formData.periodStart,
        formData.periodEnd,
        studentId
      );

      if (result.exclusions && result.exclusions.length > 0) {
        setGlobalExclusions(
          result.exclusions.map((e) => ({
            exclusion_date: e.exclusion_date,
            exclusion_type: e.exclusion_type,
            reason: e.reason,
            enabled: true, // 기본적으로 모든 전역 제외일 활성화
          }))
        );
      } else {
        setGlobalExclusions([]);
      }
      setHasLoadedGlobalExclusions(true);
    } catch (err) {
      console.error("[PlannerCreationModal] 전역 제외일 로드 실패:", err);
    } finally {
      setIsLoadingExclusion(false);
    }
  }, [formData.periodStart, formData.periodEnd, studentId]);

  // 기간 변경 시 전역 제외일 자동 로드
  useEffect(() => {
    if (open && formData.periodStart && formData.periodEnd && !hasLoadedGlobalExclusions) {
      loadGlobalExclusions();
    }
  }, [open, formData.periodStart, formData.periodEnd, hasLoadedGlobalExclusions, loadGlobalExclusions]);

  // 오버라이드 계산: 전역 제외일 + 플래너 전용 제외일로부터 오버라이드 생성
  const computeOverrides = useCallback((): ExclusionOverride[] => {
    const overrides: ExclusionOverride[] = [];

    // 1. remove 오버라이드: 비활성화된 전역 제외일
    for (const global of globalExclusions) {
      if (!global.enabled) {
        overrides.push({
          exclusion_date: global.exclusion_date,
          override_type: "remove",
        });
      }
    }

    // 2. add 오버라이드: 플래너에만 추가된 제외일
    for (const excl of plannerOnlyExclusions) {
      overrides.push({
        exclusion_date: excl.exclusion_date,
        override_type: "add",
        exclusion_type: mapExclusionTypeToPlanner(excl.exclusion_type) as ExclusionType,
        reason: excl.reason,
      });
    }

    return overrides;
  }, [globalExclusions, plannerOnlyExclusions]);

  // 실제 적용될 제외일 목록 (UI 표시용)
  const effectiveExclusions = useMemo(() => {
    const result: ExclusionSchedule[] = [];

    // 1. 활성화된 전역 제외일
    for (const global of globalExclusions) {
      if (global.enabled) {
        result.push({
          exclusion_date: global.exclusion_date,
          exclusion_type: mapExclusionTypeFromTimeManagement(global.exclusion_type),
          reason: global.reason,
          source: "imported" as const,
        });
      }
    }

    // 2. 플래너 전용 제외일
    for (const excl of plannerOnlyExclusions) {
      result.push({
        ...excl,
        source: "manual" as const,
      });
    }

    // 날짜순 정렬
    return result.sort((a, b) => a.exclusion_date.localeCompare(b.exclusion_date));
  }, [globalExclusions, plannerOnlyExclusions]);

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
        // 오버라이드 시스템 상태 초기화
        setGlobalExclusions([]);
        setPlannerOnlyExclusions([]);
        setHasLoadedGlobalExclusions(false);
      }
      setError(null);

      // 편집 모드에서 기존 오버라이드 로드
      if (editPlanner && editPlanner.id) {
        loadExistingOverrides(editPlanner.id);
      }
    }
  }, [open, editPlanner, duplicateFrom]);

  // 기존 오버라이드 로드 (편집 모드)
  const loadExistingOverrides = useCallback(async (plannerId: string) => {
    try {
      const result = await getPlannerOverridesForPlannerAction(plannerId);
      if (result.success && result.data) {
        // 오버라이드를 분류하여 상태에 반영
        for (const override of result.data) {
          if (override.override_type === "remove") {
            // 전역 제외일 중 해당 날짜를 비활성화
            setGlobalExclusions((prev) =>
              prev.map((g) =>
                g.exclusion_date === override.exclusion_date
                  ? { ...g, enabled: false }
                  : g
              )
            );
          } else if (override.override_type === "add") {
            // 플래너 전용 제외일에 추가
            setPlannerOnlyExclusions((prev) => [
              ...prev,
              {
                exclusion_date: override.exclusion_date,
                exclusion_type: mapExclusionTypeFromTimeManagement(
                  override.exclusion_type || "기타"
                ),
                reason: override.reason || undefined,
                source: "manual" as const,
              },
            ]);
          }
        }
      }
    } catch (err) {
      console.error("[loadExistingOverrides] Error:", err);
    }
  }, []);

  // 폼 필드 변경 핸들러
  const handleChange = useCallback(
    (field: keyof FormData, value: string | number | boolean) => {
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

  /**
   * 학원 일정 직접 추가 핸들러
   */
  const handleAddAcademy = useCallback(async () => {
    // 시간 입력 검증
    if (!newAcademy.start_time || !newAcademy.end_time) {
      setError("시간을 입력해주세요.");
      return;
    }

    // 종료 시간 > 시작 시간 검증
    if (newAcademy.start_time >= newAcademy.end_time) {
      setError("종료 시간은 시작 시간보다 이후여야 합니다.");
      return;
    }

    const dayOfWeek = newAcademy.day_of_week ?? 1;

    // 동일 요일 시간대 겹침 검사
    const scheduleToValidate = {
      day_of_week: dayOfWeek,
      start_time: newAcademy.start_time,
      end_time: newAcademy.end_time,
      travel_time: newAcademy.travel_time ?? 30,
    };

    const validation = validateAcademyScheduleOverlap(scheduleToValidate, academySchedules);
    if (!validation.isValid) {
      setError("해당 요일에 시간대가 겹치는 일정이 있습니다.");
      return;
    }

    setIsAddingAcademy(true);
    try {
      // 시간 관리에 저장
      const result = await addStudentAcademyScheduleForAdmin(studentId, {
        day_of_week: dayOfWeek,
        start_time: newAcademy.start_time,
        end_time: newAcademy.end_time,
        academy_name: newAcademy.academy_name,
        subject: newAcademy.subject,
      });

      if (!result.success) {
        setError(result.error || "학원 일정 저장에 실패했습니다.");
        return;
      }

      // 로컬 상태 업데이트 (검증 통과한 값들이므로 타입 단언 사용)
      setAcademySchedules((prev) => [
        ...prev,
        {
          day_of_week: dayOfWeek,
          start_time: newAcademy.start_time!,
          end_time: newAcademy.end_time!,
          academy_name: newAcademy.academy_name || "",
          subject: newAcademy.subject || "",
          travel_time: newAcademy.travel_time ?? 30,
          source: "manual" as const,
        },
      ]);

      toast.showSuccess("학원 일정이 시간 관리에 저장되었습니다.");

      // 폼 리셋
      setNewAcademy({
        day_of_week: 1,
        start_time: "18:00",
        end_time: "21:00",
        academy_name: "",
        subject: "",
        travel_time: 30,
      });
      setShowAddAcademy(false);
      setError(null);
    } catch (err) {
      console.error("[handleAddAcademy] Error:", err);
      setError("학원 일정 저장 중 오류가 발생했습니다.");
    } finally {
      setIsAddingAcademy(false);
    }
  }, [newAcademy, academySchedules, studentId, toast]);

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

  /**
   * 제외일 직접 추가 핸들러 (플래너 전용 - 오버라이드 시스템)
   *
   * 이 함수는 이 플래너에만 적용되는 제외일을 추가합니다.
   * 시간 관리에는 저장하지 않고 플래너 오버라이드로만 저장합니다.
   */
  const handleAddExclusion = useCallback(async () => {
    // 날짜 필수 검증
    if (!newExclusion.exclusion_date) {
      setError("날짜를 선택해주세요.");
      return;
    }

    // 기간 범위 내 검증
    if (formData.periodStart && formData.periodEnd) {
      const date = new Date(newExclusion.exclusion_date);
      const start = new Date(formData.periodStart);
      const end = new Date(formData.periodEnd);
      if (date < start || date > end) {
        setError("학습 기간 내의 날짜를 선택해주세요.");
        return;
      }
    }

    // 중복 날짜 검사 (전역 + 플래너 전용)
    const isDuplicateGlobal = globalExclusions.some(
      (e) => e.exclusion_date === newExclusion.exclusion_date && e.enabled
    );
    const isDuplicatePlanner = plannerOnlyExclusions.some(
      (e) => e.exclusion_date === newExclusion.exclusion_date
    );
    if (isDuplicateGlobal || isDuplicatePlanner) {
      setError("이미 추가된 날짜입니다.");
      return;
    }

    // 플래너 전용 제외일에 추가 (시간 관리에는 저장하지 않음)
    setPlannerOnlyExclusions((prev) => [
      ...prev,
      {
        exclusion_date: newExclusion.exclusion_date!,
        exclusion_type: newExclusion.exclusion_type || "personal",
        reason: newExclusion.reason || "",
        source: "manual" as const,
      },
    ]);

    toast.showSuccess("이 플래너에만 적용되는 제외일이 추가되었습니다.");

    // 폼 리셋
    setNewExclusion({
      exclusion_date: "",
      exclusion_type: "personal",
      reason: "",
    });
    setShowAddExclusion(false);
    setError(null);
  }, [newExclusion, globalExclusions, plannerOnlyExclusions, formData.periodStart, formData.periodEnd, toast]);

  /**
   * 전역 제외일 활성화/비활성화 토글
   */
  const handleToggleGlobalExclusion = useCallback((exclusionDate: string) => {
    setGlobalExclusions((prev) =>
      prev.map((e) =>
        e.exclusion_date === exclusionDate ? { ...e, enabled: !e.enabled } : e
      )
    );
  }, []);

  /**
   * 플래너 전용 제외일 제거
   */
  const handleRemovePlannerOnlyExclusion = useCallback((index: number) => {
    setPlannerOnlyExclusions((prev) => prev.filter((_, i) => i !== index));
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
          // 기존 플랜 그룹에도 변경사항 반영
          syncToExistingGroups: formData.syncToExistingGroups,
        };

        result = await updatePlannerAction(editPlanner.id, updateInput);

        // 플래너 수정 후 오버라이드 업데이트
        if (result && result.id) {
          const overrides = computeOverrides();
          // 기존 오버라이드를 새 것으로 교체
          const overrideResult = await savePlannerOverridesForPlannerAction(
            result.id,
            overrides.map((o) => ({
              exclusion_date: o.exclusion_date,
              override_type: o.override_type,
              exclusion_type: o.exclusion_type,
              reason: o.reason,
            }))
          );
          if (!overrideResult.success) {
            console.warn("[PlannerCreationModal] 오버라이드 업데이트 실패:", overrideResult.error);
            toast.showWarning("플래너는 수정되었지만 제외일 오버라이드 저장에 실패했습니다.");
          }
        }
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
          // 제외일은 오버라이드 시스템으로 별도 저장 (아래에서 처리)
          // exclusions 파라미터는 제거됨
        };

        result = await createPlannerAction(createInput);

        // 플래너 생성 후 오버라이드 저장
        if (result && result.id) {
          const overrides = computeOverrides();
          if (overrides.length > 0) {
            const overrideResult = await savePlannerOverridesForPlannerAction(
              result.id,
              overrides.map((o) => ({
                exclusion_date: o.exclusion_date,
                override_type: o.override_type,
                exclusion_type: o.exclusion_type,
                reason: o.reason,
              }))
            );
            if (!overrideResult.success) {
              console.warn("[PlannerCreationModal] 오버라이드 저장 실패:", overrideResult.error);
              // 플래너는 생성되었으므로 경고만 표시
              toast.showWarning("플래너는 생성되었지만 제외일 오버라이드 저장에 실패했습니다.");
            }
          }
        }
      }

      if (result) {
        onSuccess(result);
        setFormData(getDefaultFormData());
        setNonStudyBlocks([]);
        setShowSelfStudy(false);
        setAcademySchedules([]);
        setExclusions([]);
        // 오버라이드 시스템 상태 초기화
        setGlobalExclusions([]);
        setPlannerOnlyExclusions([]);
        setHasLoadedGlobalExclusions(false);
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
                <div className="flex items-center gap-2">
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
                  <button
                    type="button"
                    onClick={() => setShowAddAcademy(!showAddAcademy)}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" />
                    직접 추가
                  </button>
                </div>
              </div>

              {/* 직접 추가 인라인 폼 */}
              {showAddAcademy && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">요일</label>
                      <select
                        value={newAcademy.day_of_week}
                        onChange={(e) => setNewAcademy({ ...newAcademy, day_of_week: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isAddingAcademy}
                      >
                        {DAY_NAMES.map((name, idx) => (
                          <option key={idx} value={idx}>{name}요일</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">학원명</label>
                      <input
                        type="text"
                        value={newAcademy.academy_name || ""}
                        onChange={(e) => setNewAcademy({ ...newAcademy, academy_name: e.target.value })}
                        placeholder="예: 영어학원"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isAddingAcademy}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">시작 시간</label>
                      <input
                        type="time"
                        value={newAcademy.start_time || ""}
                        onChange={(e) => setNewAcademy({ ...newAcademy, start_time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isAddingAcademy}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">종료 시간</label>
                      <input
                        type="time"
                        value={newAcademy.end_time || ""}
                        onChange={(e) => setNewAcademy({ ...newAcademy, end_time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isAddingAcademy}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">이동 시간(분)</label>
                      <input
                        type="number"
                        value={newAcademy.travel_time || 0}
                        onChange={(e) => setNewAcademy({ ...newAcademy, travel_time: parseInt(e.target.value) || 0 })}
                        min={0}
                        max={120}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isAddingAcademy}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs text-gray-600 mb-1">과목 (선택)</label>
                    <input
                      type="text"
                      value={newAcademy.subject || ""}
                      onChange={(e) => setNewAcademy({ ...newAcademy, subject: e.target.value })}
                      placeholder="예: 영어"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isAddingAcademy}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddAcademy(false);
                        setNewAcademy({
                          day_of_week: 1,
                          start_time: "18:00",
                          end_time: "21:00",
                          academy_name: "",
                          subject: "",
                          travel_time: 30,
                        });
                      }}
                      disabled={isAddingAcademy}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-400"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleAddAcademy}
                      disabled={isAddingAcademy}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isAddingAcademy ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          추가 중...
                        </>
                      ) : (
                        "추가"
                      )}
                    </button>
                  </div>
                </div>
              )}

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
                    &quot;직접 추가&quot; 또는 &quot;시간 관리에서 불러오기&quot;를 클릭하여 학원 일정을 추가할 수 있습니다.
                  </p>
                </div>
              )}
            </section>

            {/* 제외일 섹션 (오버라이드 시스템) */}
            <section className="border-t pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <CalendarX className="w-4 h-4" />
                  제외일
                  {effectiveExclusions.length > 0 && (
                    <span className="text-xs text-gray-500">
                      ({effectiveExclusions.length}개 적용)
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadGlobalExclusions}
                    disabled={isLoadingExclusion || isSubmitting || !formData.periodStart || !formData.periodEnd}
                    className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                    title={!formData.periodStart || !formData.periodEnd ? "기간을 먼저 설정해주세요" : "전역 제외일 새로고침"}
                  >
                    {isLoadingExclusion ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    새로고침
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddExclusion(!showAddExclusion)}
                    disabled={isSubmitting || !formData.periodStart || !formData.periodEnd}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                    title={!formData.periodStart || !formData.periodEnd ? "기간을 먼저 설정해주세요" : "이 플래너에만 적용되는 제외일 추가"}
                  >
                    <Plus className="h-4 w-4" />
                    직접 추가
                  </button>
                </div>
              </div>

              {/* 안내 문구 */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
                  <Info className="w-3.5 h-3.5 inline-block mr-1" />
                  전역 제외일(시간 관리)이 자동으로 불러와집니다. 체크를 해제하면 이 플래너에서만 제외됩니다.
                </p>
              </div>

              {/* 직접 추가 인라인 폼 */}
              {showAddExclusion && (
                <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-700 mb-3">
                    이 플래너에만 적용되는 제외일을 추가합니다. (시간 관리에는 저장되지 않음)
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">날짜</label>
                      <input
                        type="date"
                        value={newExclusion.exclusion_date || ""}
                        onChange={(e) => setNewExclusion({ ...newExclusion, exclusion_date: e.target.value })}
                        min={formData.periodStart}
                        max={formData.periodEnd}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={isAddingExclusion}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">유형</label>
                      <select
                        value={newExclusion.exclusion_type || "personal"}
                        onChange={(e) => setNewExclusion({ ...newExclusion, exclusion_type: e.target.value as ExclusionSchedule["exclusion_type"] })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={isAddingExclusion}
                      >
                        <option value="holiday">휴일</option>
                        <option value="personal">개인</option>
                        <option value="event">행사</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs text-gray-600 mb-1">사유 (선택)</label>
                    <input
                      type="text"
                      value={newExclusion.reason || ""}
                      onChange={(e) => setNewExclusion({ ...newExclusion, reason: e.target.value })}
                      placeholder="예: 가족 여행"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isAddingExclusion}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddExclusion(false);
                        setNewExclusion({
                          exclusion_date: "",
                          exclusion_type: "personal",
                          reason: "",
                        });
                      }}
                      disabled={isAddingExclusion}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-400"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleAddExclusion}
                      disabled={isAddingExclusion}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      추가
                    </button>
                  </div>
                </div>
              )}

              {/* 전역 제외일 목록 (체크박스로 토글) */}
              {globalExclusions.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">전역</span>
                    시간 관리 제외일
                  </h4>
                  <div className="space-y-2">
                    {globalExclusions.map((excl) => {
                      const typeLabel = {
                        "휴일지정": "휴일",
                        "휴가": "휴가",
                        "개인사정": "개인",
                        "기타": "기타",
                      }[excl.exclusion_type] || excl.exclusion_type;

                      return (
                        <label
                          key={excl.exclusion_date}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            excl.enabled
                              ? "bg-green-50 border-green-200 hover:bg-green-100"
                              : "bg-gray-50 border-gray-200 opacity-60 hover:bg-gray-100"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={excl.enabled}
                            onChange={() => handleToggleGlobalExclusion(excl.exclusion_date)}
                            disabled={isSubmitting}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <div className="flex-1 flex items-center gap-3">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                              {typeLabel}
                            </span>
                            <div className="flex flex-col">
                              <span className={cn(
                                "text-sm font-medium",
                                excl.enabled ? "text-gray-900" : "text-gray-500 line-through"
                              )}>
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
                          </div>
                          {!excl.enabled && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                              제외됨
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 플래너 전용 제외일 목록 */}
              {plannerOnlyExclusions.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">플래너 전용</span>
                    이 플래너에만 적용
                  </h4>
                  <div className="space-y-2">
                    {plannerOnlyExclusions.map((excl, idx) => {
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
                          key={`planner-${excl.exclusion_date}-${idx}`}
                          className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200"
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
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePlannerOnlyExclusion(idx)}
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
                </div>
              )}

              {/* 빈 상태 */}
              {globalExclusions.length === 0 && plannerOnlyExclusions.length === 0 && (
                <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                  {isLoadingExclusion ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      <p className="text-sm text-gray-500">전역 제외일 불러오는 중...</p>
                    </div>
                  ) : hasLoadedGlobalExclusions ? (
                    <>
                      <p className="text-sm text-gray-500">
                        해당 기간 내 등록된 전역 제외일이 없습니다.
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        &quot;직접 추가&quot;를 클릭하여 이 플래너에만 적용되는 제외일을 추가할 수 있습니다.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500">
                        기간을 설정하면 전역 제외일이 자동으로 불러와집니다.
                      </p>
                    </>
                  )}
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

            {/* 관리자 메모 (학생 모드에서 숨김) */}
            {isAdminMode && (
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
            )}

            {/* 수정 모드: 기존 플랜 그룹 동기화 옵션 */}
            {mode === "edit" && (
              <section className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.syncToExistingGroups}
                    onChange={(e) => handleChange("syncToExistingGroups", e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      기존 플랜 그룹에도 반영
                    </span>
                    <p className="text-xs text-gray-600 mt-0.5">
                      활성/초안 상태의 플랜 그룹에 시간 설정(학습시간, 자습시간, 점심시간 등)을 동기화합니다.
                    </p>
                  </div>
                </label>
              </section>
            )}
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
