"use client";

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Info,
  FileText,
  Save,
  Loader2,
  AlertCircle,
  Clock,
  Plus,
  X,
  Settings,
  Building2,
  RefreshCw,
  Check,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAdminPlanBasic } from "../context/AdminPlanContext";
import {
  getPlannerAction,
  updatePlannerAction,
  setPlannerAcademySchedulesAction,
  getStudentAcademiesWithSchedulesForAdmin,
  // Phase 5: Exclusion Overrides
  getStudentGlobalExclusionsAction,
  getPlannerExclusionOverridesAction,
  upsertPlannerExclusionOverrideAction,
  deletePlannerExclusionOverrideAction,
  type Planner,
  type PlannerStatus,
  type NonStudyTimeBlock,
  type PlannerAcademySchedule,
  type PlannerAcademyScheduleInput,
  type AcademyWithSchedules,
  type PlanExclusion,
  type PlannerExclusionOverride,
  type ExclusionType,
} from "@/lib/domains/admin-plan/actions";
import { useToast } from "@/components/ui/ToastProvider";
import type { TimeRange } from "@/lib/features/wizard/types/data";
import { WeeklyAvailabilityTimeline } from "../admin-wizard/steps/_components/WeeklyAvailabilityTimeline";
import {
  DEFAULT_CAMP_STUDY_HOURS,
  DEFAULT_CAMP_LUNCH_TIME,
} from "@/lib/types/schedulerSettings";
import {
  SCHEDULER_DEFAULTS,
  type Timetable1730Options,
} from "@/lib/domains/admin-plan/constants/schedulerDefaults";
import { SCHEDULER_TYPES, type SchedulerType } from "@/lib/scheduler/types";

interface SettingsTabProps {
  tab: "settings";
}

// 상태 옵션
const STATUS_OPTIONS: { value: PlannerStatus; label: string; description: string }[] = [
  { value: "draft", label: "초안", description: "작성 중인 플래너" },
  { value: "active", label: "활성", description: "현재 사용 중인 플래너" },
  { value: "paused", label: "일시정지", description: "일시적으로 중단된 플래너" },
  { value: "completed", label: "완료", description: "학습이 완료된 플래너" },
  { value: "archived", label: "보관됨", description: "보관 처리된 플래너" },
];

// 비학습 시간 블록 타입 옵션
const NON_STUDY_BLOCK_TYPES: NonStudyTimeBlock["type"][] = [
  "아침식사",
  "점심식사",
  "저녁식사",
  "수면",
  "기타",
];

// 스케줄러 타입 옵션 (Phase 3)
const SCHEDULER_TYPE_OPTIONS: {
  value: SchedulerType;
  label: string;
  description: string;
}[] = [
  {
    value: SCHEDULER_TYPES.TIMETABLE_1730,
    label: "1730 시간표",
    description: "N일 학습 + M일 복습 사이클로 학습 계획 생성",
  },
  {
    value: SCHEDULER_TYPES.DEFAULT,
    label: "기본 균등 배분",
    description: "콘텐츠를 날짜에 균등하게 배분",
  },
];

/**
 * 설정 탭 컴포넌트
 *
 * 포함 섹션:
 * - Phase 1: 기본 정보 (이름, 설명, 관리자 메모, 상태)
 * - Phase 1: 기간 설정 (시작일, 종료일, 목표일)
 * - Phase 2: 학습 시간 설정 (학습시간, 점심시간, 자습시간, 비학습 블록)
 * - Phase 3: 스케줄러 설정 (스케줄러 타입, 학습/복습 일수)
 */
export function SettingsTab({ tab: _tab }: SettingsTabProps) {
  const router = useRouter();
  const { selectedPlannerId, isAdminMode, studentId, canEditSettings } = useAdminPlanBasic();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();

  // 플래너 데이터 상태
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 폼 상태 - 기본 정보
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [adminMemo, setAdminMemo] = useState("");
  const [status, setStatus] = useState<PlannerStatus>("draft");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [targetDate, setTargetDate] = useState("");

  // 폼 상태 - 학습 시간 (Phase 2)
  const [studyHoursStart, setStudyHoursStart] = useState(DEFAULT_CAMP_STUDY_HOURS.start);
  const [studyHoursEnd, setStudyHoursEnd] = useState(DEFAULT_CAMP_STUDY_HOURS.end);
  const [lunchTimeStart, setLunchTimeStart] = useState(DEFAULT_CAMP_LUNCH_TIME.start);
  const [lunchTimeEnd, setLunchTimeEnd] = useState(DEFAULT_CAMP_LUNCH_TIME.end);
  const [selfStudyHoursStart, setSelfStudyHoursStart] = useState("");
  const [selfStudyHoursEnd, setSelfStudyHoursEnd] = useState("");
  const [nonStudyTimeBlocks, setNonStudyTimeBlocks] = useState<NonStudyTimeBlock[]>([]);

  // 폼 상태 - 스케줄러 설정 (Phase 3)
  const [schedulerType, setSchedulerType] = useState<SchedulerType>(SCHEDULER_DEFAULTS.TYPE);
  const [studyDays, setStudyDays] = useState(SCHEDULER_DEFAULTS.OPTIONS.study_days);
  const [reviewDays, setReviewDays] = useState(SCHEDULER_DEFAULTS.OPTIONS.review_days);

  // 상태 - 학원 일정 연동 (Phase 4)
  const [plannerAcademySchedules, setPlannerAcademySchedules] = useState<PlannerAcademySchedule[]>([]);
  const [studentAcademies, setStudentAcademies] = useState<AcademyWithSchedules[]>([]);
  const [isLoadingAcademies, setIsLoadingAcademies] = useState(false);
  const [isSyncingAcademies, setIsSyncingAcademies] = useState(false);

  // 상태 - 제외일 오버라이드 (Phase 5)
  const [globalExclusions, setGlobalExclusions] = useState<PlanExclusion[]>([]);
  const [exclusionOverrides, setExclusionOverrides] = useState<PlannerExclusionOverride[]>([]);
  const [isLoadingExclusions, setIsLoadingExclusions] = useState(false);
  const [isProcessingOverride, setIsProcessingOverride] = useState(false);
  // 새 제외일 추가 폼 상태 (Phase 5)
  const [newExclusionDate, setNewExclusionDate] = useState("");
  const [newExclusionType, setNewExclusionType] = useState<ExclusionType>("개인사정");
  const [newExclusionReason, setNewExclusionReason] = useState("");

  // 변경 여부 추적
  const [hasChanges, setHasChanges] = useState(false);

  // TimeRange 객체 생성 헬퍼
  const studyHours: TimeRange | null = useMemo(() => {
    if (!studyHoursStart || !studyHoursEnd) return null;
    return { start: studyHoursStart, end: studyHoursEnd };
  }, [studyHoursStart, studyHoursEnd]);

  const lunchTime: TimeRange | null = useMemo(() => {
    if (!lunchTimeStart || !lunchTimeEnd) return null;
    return { start: lunchTimeStart, end: lunchTimeEnd };
  }, [lunchTimeStart, lunchTimeEnd]);

  const selfStudyHours: TimeRange | null = useMemo(() => {
    if (!selfStudyHoursStart || !selfStudyHoursEnd) return null;
    return { start: selfStudyHoursStart, end: selfStudyHoursEnd };
  }, [selfStudyHoursStart, selfStudyHoursEnd]);

  // 플래너 데이터 로드
  const loadPlanner = useCallback(async () => {
    if (!selectedPlannerId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // includeRelations=true로 학원 일정도 함께 조회
      const plannerData = await getPlannerAction(selectedPlannerId, true);
      if (plannerData) {
        setPlanner(plannerData);

        // 폼 초기화 - 기본 정보
        setName(plannerData.name);
        setDescription(plannerData.description || "");
        setAdminMemo(plannerData.adminMemo || "");
        setStatus(plannerData.status);
        setPeriodStart(plannerData.periodStart);
        setPeriodEnd(plannerData.periodEnd);
        setTargetDate(plannerData.targetDate || "");

        // 폼 초기화 - 학습 시간 (Phase 2)
        setStudyHoursStart(plannerData.studyHours?.start || DEFAULT_CAMP_STUDY_HOURS.start);
        setStudyHoursEnd(plannerData.studyHours?.end || DEFAULT_CAMP_STUDY_HOURS.end);
        setLunchTimeStart(plannerData.lunchTime?.start || DEFAULT_CAMP_LUNCH_TIME.start);
        setLunchTimeEnd(plannerData.lunchTime?.end || DEFAULT_CAMP_LUNCH_TIME.end);
        setSelfStudyHoursStart(plannerData.selfStudyHours?.start || "");
        setSelfStudyHoursEnd(plannerData.selfStudyHours?.end || "");
        setNonStudyTimeBlocks(plannerData.nonStudyTimeBlocks || []);

        // 폼 초기화 - 스케줄러 설정 (Phase 3)
        setSchedulerType((plannerData.defaultSchedulerType as SchedulerType) || SCHEDULER_DEFAULTS.TYPE);
        const options = plannerData.defaultSchedulerOptions as unknown as Timetable1730Options | undefined;
        setStudyDays(options?.study_days ?? SCHEDULER_DEFAULTS.OPTIONS.study_days);
        setReviewDays(options?.review_days ?? SCHEDULER_DEFAULTS.OPTIONS.review_days);

        // 폼 초기화 - 학원 일정 (Phase 4)
        setPlannerAcademySchedules(plannerData.academySchedules || []);

        setHasChanges(false);
      }
    } catch (err) {
      console.error("[SettingsTab] 플래너 로드 실패:", err);
      setError(err instanceof Error ? err.message : "플래너 정보를 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedPlannerId]);

  useEffect(() => {
    loadPlanner();
  }, [loadPlanner]);

  // 변경 감지
  useEffect(() => {
    if (!planner) return;

    // 기본 정보 변경 감지
    const basicChanged =
      name !== planner.name ||
      description !== (planner.description || "") ||
      adminMemo !== (planner.adminMemo || "") ||
      status !== planner.status ||
      periodStart !== planner.periodStart ||
      periodEnd !== planner.periodEnd ||
      targetDate !== (planner.targetDate || "");

    // 학습 시간 변경 감지 (Phase 2)
    const timeChanged =
      studyHoursStart !== (planner.studyHours?.start || DEFAULT_CAMP_STUDY_HOURS.start) ||
      studyHoursEnd !== (planner.studyHours?.end || DEFAULT_CAMP_STUDY_HOURS.end) ||
      lunchTimeStart !== (planner.lunchTime?.start || DEFAULT_CAMP_LUNCH_TIME.start) ||
      lunchTimeEnd !== (planner.lunchTime?.end || DEFAULT_CAMP_LUNCH_TIME.end) ||
      selfStudyHoursStart !== (planner.selfStudyHours?.start || "") ||
      selfStudyHoursEnd !== (planner.selfStudyHours?.end || "") ||
      JSON.stringify(nonStudyTimeBlocks) !== JSON.stringify(planner.nonStudyTimeBlocks || []);

    // 스케줄러 설정 변경 감지 (Phase 3)
    const savedOptions = planner.defaultSchedulerOptions as unknown as Timetable1730Options | undefined;
    const schedulerChanged =
      schedulerType !== ((planner.defaultSchedulerType as SchedulerType) || SCHEDULER_DEFAULTS.TYPE) ||
      studyDays !== (savedOptions?.study_days ?? SCHEDULER_DEFAULTS.OPTIONS.study_days) ||
      reviewDays !== (savedOptions?.review_days ?? SCHEDULER_DEFAULTS.OPTIONS.review_days);

    setHasChanges(basicChanged || timeChanged || schedulerChanged);
  }, [
    name, description, adminMemo, status, periodStart, periodEnd, targetDate,
    studyHoursStart, studyHoursEnd, lunchTimeStart, lunchTimeEnd,
    selfStudyHoursStart, selfStudyHoursEnd, nonStudyTimeBlocks,
    schedulerType, studyDays, reviewDays,
    planner,
  ]);

  // 저장 핸들러
  const handleSave = () => {
    if (!selectedPlannerId || !planner) return;

    // 유효성 검사 - 기본 정보
    if (!name.trim()) {
      showError("플래너 이름을 입력해주세요.");
      return;
    }

    if (!periodStart || !periodEnd) {
      showError("학습 기간을 설정해주세요.");
      return;
    }

    if (new Date(periodStart) > new Date(periodEnd)) {
      showError("종료일은 시작일보다 늦어야 합니다.");
      return;
    }

    if (targetDate && new Date(targetDate) < new Date(periodEnd)) {
      showError("목표일(D-Day)은 종료일 이후여야 합니다.");
      return;
    }

    // 유효성 검사 - 학습 시간 (Phase 2)
    if (!studyHoursStart || !studyHoursEnd) {
      showError("학습 시간을 설정해주세요.");
      return;
    }

    if (studyHoursStart >= studyHoursEnd) {
      showError("학습 종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    if (!lunchTimeStart || !lunchTimeEnd) {
      showError("점심 시간을 설정해주세요.");
      return;
    }

    if (lunchTimeStart >= lunchTimeEnd) {
      showError("점심 종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    // 자습 시간 유효성 (둘 다 있거나 둘 다 없어야 함)
    if ((selfStudyHoursStart && !selfStudyHoursEnd) || (!selfStudyHoursStart && selfStudyHoursEnd)) {
      showError("자습 시간을 완전히 설정하거나 비워두세요.");
      return;
    }

    if (selfStudyHoursStart && selfStudyHoursEnd && selfStudyHoursStart >= selfStudyHoursEnd) {
      showError("자습 종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    // 유효성 검사 - 스케줄러 설정 (Phase 3)
    if (schedulerType === SCHEDULER_TYPES.TIMETABLE_1730) {
      if (studyDays < 1 || studyDays > 30) {
        showError("학습일은 1~30일 사이로 설정해주세요.");
        return;
      }
      if (reviewDays < 0 || reviewDays > 7) {
        showError("복습일은 0~7일 사이로 설정해주세요.");
        return;
      }
    }

    startTransition(async () => {
      try {
        // 스케줄러 옵션 구성 (Phase 3)
        const schedulerOptions: Record<string, unknown> =
          schedulerType === SCHEDULER_TYPES.TIMETABLE_1730
            ? { study_days: studyDays, review_days: reviewDays }
            : {};

        await updatePlannerAction(selectedPlannerId, {
          name: name.trim(),
          description: description.trim() || undefined,
          adminMemo: adminMemo.trim() || null,
          status,
          periodStart,
          periodEnd,
          targetDate: targetDate || null,
          // Phase 2: 학습 시간 설정
          studyHours: { start: studyHoursStart, end: studyHoursEnd },
          lunchTime: { start: lunchTimeStart, end: lunchTimeEnd },
          selfStudyHours: selfStudyHoursStart && selfStudyHoursEnd
            ? { start: selfStudyHoursStart, end: selfStudyHoursEnd }
            : undefined,
          nonStudyTimeBlocks: nonStudyTimeBlocks.length > 0 ? nonStudyTimeBlocks : undefined,
          // Phase 3: 스케줄러 설정
          defaultSchedulerType: schedulerType || undefined,
          defaultSchedulerOptions: schedulerOptions,
        });

        showSuccess("플래너 설정이 저장되었습니다.");
        router.refresh();
        await loadPlanner();
      } catch (err) {
        console.error("[SettingsTab] 저장 실패:", err);
        showError(err instanceof Error ? err.message : "저장에 실패했습니다.");
      }
    });
  };

  // 취소 핸들러 (변경사항 되돌리기)
  const handleCancel = () => {
    if (!planner) return;

    // 기본 정보 복원
    setName(planner.name);
    setDescription(planner.description || "");
    setAdminMemo(planner.adminMemo || "");
    setStatus(planner.status);
    setPeriodStart(planner.periodStart);
    setPeriodEnd(planner.periodEnd);
    setTargetDate(planner.targetDate || "");

    // 학습 시간 복원 (Phase 2)
    setStudyHoursStart(planner.studyHours?.start || DEFAULT_CAMP_STUDY_HOURS.start);
    setStudyHoursEnd(planner.studyHours?.end || DEFAULT_CAMP_STUDY_HOURS.end);
    setLunchTimeStart(planner.lunchTime?.start || DEFAULT_CAMP_LUNCH_TIME.start);
    setLunchTimeEnd(planner.lunchTime?.end || DEFAULT_CAMP_LUNCH_TIME.end);
    setSelfStudyHoursStart(planner.selfStudyHours?.start || "");
    setSelfStudyHoursEnd(planner.selfStudyHours?.end || "");
    setNonStudyTimeBlocks(planner.nonStudyTimeBlocks || []);

    // 스케줄러 설정 복원 (Phase 3)
    setSchedulerType((planner.defaultSchedulerType as SchedulerType) || SCHEDULER_DEFAULTS.TYPE);
    const savedOptions = planner.defaultSchedulerOptions as unknown as Timetable1730Options | undefined;
    setStudyDays(savedOptions?.study_days ?? SCHEDULER_DEFAULTS.OPTIONS.study_days);
    setReviewDays(savedOptions?.review_days ?? SCHEDULER_DEFAULTS.OPTIONS.review_days);

    setHasChanges(false);
  };

  // 비학습 시간 블록 추가 핸들러 (Phase 2)
  const handleAddNonStudyBlock = () => {
    setNonStudyTimeBlocks((prev) => [
      ...prev,
      {
        type: "기타",
        start_time: "18:00",
        end_time: "19:00",
        description: "",
      },
    ]);
  };

  // 비학습 시간 블록 삭제 핸들러 (Phase 2)
  const handleRemoveNonStudyBlock = (index: number) => {
    setNonStudyTimeBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  // 비학습 시간 블록 수정 핸들러 (Phase 2)
  const handleUpdateNonStudyBlock = (
    index: number,
    field: keyof NonStudyTimeBlock,
    value: string | number[]
  ) => {
    setNonStudyTimeBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, [field]: value } : block))
    );
  };

  // 학생 학원 목록 조회 (Phase 4)
  const loadStudentAcademies = useCallback(async () => {
    if (!studentId) return;

    setIsLoadingAcademies(true);
    try {
      const result = await getStudentAcademiesWithSchedulesForAdmin(studentId);
      if (result.success && result.data) {
        setStudentAcademies(result.data);
      }
    } catch (err) {
      console.error("[SettingsTab] 학생 학원 목록 조회 실패:", err);
    } finally {
      setIsLoadingAcademies(false);
    }
  }, [studentId]);

  // 학원 일정 동기화 핸들러 (Phase 4)
  const handleSyncAcademySchedules = async () => {
    if (!selectedPlannerId || !studentId) return;

    setIsSyncingAcademies(true);
    try {
      // 학생의 모든 학원 일정을 플래너 학원 일정 형식으로 변환
      const schedulesToSync: PlannerAcademyScheduleInput[] = [];

      for (const academy of studentAcademies) {
        for (const schedule of academy.schedules) {
          schedulesToSync.push({
            academyId: academy.id,
            academyName: academy.name,
            dayOfWeek: schedule.day_of_week,
            startTime: schedule.start_time,
            endTime: schedule.end_time,
            subject: schedule.subject || undefined,
            travelTime: academy.travel_time || 0,
            source: "sync",
            isLocked: false,
          });
        }
      }

      // 플래너 학원 일정 설정 (기존 일정 대체)
      const result = await setPlannerAcademySchedulesAction(selectedPlannerId, schedulesToSync);

      if (result) {
        setPlannerAcademySchedules(result);
        showSuccess(`${schedulesToSync.length}개의 학원 일정이 동기화되었습니다.`);
        router.refresh();
      }
    } catch (err) {
      console.error("[SettingsTab] 학원 일정 동기화 실패:", err);
      showError(err instanceof Error ? err.message : "동기화에 실패했습니다.");
    } finally {
      setIsSyncingAcademies(false);
    }
  };

  // 플래너 학원 일정을 타임라인 컴포넌트용으로 변환 (Phase 4)
  const academySchedulesForTimeline = useMemo(() => {
    return plannerAcademySchedules.map((schedule) => ({
      id: schedule.id,
      day_of_week: schedule.dayOfWeek,
      start_time: schedule.startTime,
      end_time: schedule.endTime,
      academy_name: schedule.academyName || "",
      subject: schedule.subject ?? undefined,
      travel_time: schedule.travelTime,
    }));
  }, [plannerAcademySchedules]);

  // 학생 학원 목록 로드 (Phase 4)
  useEffect(() => {
    if (studentId && selectedPlannerId) {
      loadStudentAcademies();
    }
  }, [studentId, selectedPlannerId, loadStudentAcademies]);

  // 제외일 및 오버라이드 로드 (Phase 5 - 설정 수정 권한 필요)
  const loadExclusions = useCallback(async () => {
    // 설정 수정 권한이 있을 때만 실행
    if (!canEditSettings || !studentId || !selectedPlannerId || !planner) return;

    setIsLoadingExclusions(true);
    try {
      // 병렬로 전역 제외일과 오버라이드 조회
      const [globalResult, overridesResult] = await Promise.all([
        getStudentGlobalExclusionsAction(studentId, planner.periodStart, planner.periodEnd),
        getPlannerExclusionOverridesAction(selectedPlannerId),
      ]);

      if (globalResult) {
        setGlobalExclusions(globalResult);
      }
      if (overridesResult) {
        setExclusionOverrides(overridesResult);
      }
    } catch (err) {
      console.error("[SettingsTab] 제외일 로드 실패:", err);
    } finally {
      setIsLoadingExclusions(false);
    }
  }, [canEditSettings, studentId, selectedPlannerId, planner]);

  // 제외일 로드 트리거 (Phase 5 - 설정 수정 권한 필요)
  useEffect(() => {
    if (canEditSettings && studentId && selectedPlannerId && planner) {
      loadExclusions();
    }
  }, [canEditSettings, studentId, selectedPlannerId, planner, loadExclusions]);

  // 전역 제외일 제거 오버라이드 추가 (Phase 5)
  const handleRemoveGlobalExclusion = async (exclusionDate: string) => {
    if (!selectedPlannerId) return;

    setIsProcessingOverride(true);
    try {
      const result = await upsertPlannerExclusionOverrideAction(selectedPlannerId, {
        exclusionDate,
        overrideType: "remove",
      });

      if (result?.success) {
        showSuccess("이 플래너에서 해당 제외일이 무시됩니다.");
        await loadExclusions();
      } else {
        showError(result?.error || "오버라이드 추가에 실패했습니다.");
      }
    } catch (err) {
      console.error("[SettingsTab] 오버라이드 추가 실패:", err);
      showError("오버라이드 추가에 실패했습니다.");
    } finally {
      setIsProcessingOverride(false);
    }
  };

  // 플래너 전용 제외일 추가 오버라이드 (Phase 5)
  const handleAddPlannerOnlyExclusion = async () => {
    if (!selectedPlannerId) return;

    // 입력 검증
    if (!newExclusionDate) {
      showError("날짜를 선택해주세요.");
      return;
    }

    // 중복 검증: 이미 적용된 제외일인지 확인
    const isDuplicate = effectiveExclusions.some((e) => e.date === newExclusionDate);
    if (isDuplicate) {
      showError("이미 해당 날짜에 제외일이 설정되어 있습니다.");
      return;
    }

    // 기간 검증
    if (newExclusionDate < periodStart || newExclusionDate > periodEnd) {
      showError("플래너 기간 내의 날짜를 선택해주세요.");
      return;
    }

    setIsProcessingOverride(true);
    try {
      const result = await upsertPlannerExclusionOverrideAction(selectedPlannerId, {
        exclusionDate: newExclusionDate,
        overrideType: "add",
        exclusionType: newExclusionType,
        reason: newExclusionReason || undefined,
      });

      if (result?.success) {
        showSuccess("이 플래너에만 제외일이 추가되었습니다.");
        // 입력 필드 초기화
        setNewExclusionDate("");
        setNewExclusionReason("");
        await loadExclusions();
      } else {
        showError(result?.error || "오버라이드 추가에 실패했습니다.");
      }
    } catch (err) {
      console.error("[SettingsTab] 오버라이드 추가 실패:", err);
      showError("오버라이드 추가에 실패했습니다.");
    } finally {
      setIsProcessingOverride(false);
    }
  };

  // 오버라이드 삭제 (Phase 5)
  const handleDeleteOverride = async (exclusionDate: string) => {
    if (!selectedPlannerId) return;

    setIsProcessingOverride(true);
    try {
      const result = await deletePlannerExclusionOverrideAction(selectedPlannerId, exclusionDate);

      if (result?.success) {
        showSuccess("오버라이드가 삭제되었습니다.");
        await loadExclusions();
      } else {
        showError(result?.error || "오버라이드 삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error("[SettingsTab] 오버라이드 삭제 실패:", err);
      showError("오버라이드 삭제에 실패했습니다.");
    } finally {
      setIsProcessingOverride(false);
    }
  };

  // 실제 적용될 제외일 계산 (Phase 5)
  const effectiveExclusions = useMemo(() => {
    // 전역 제외일 맵
    const effectiveMap = new Map<string, {
      date: string;
      type: string;
      reason?: string | null;
      source: "global" | "override_add";
    }>();

    // 전역 제외일 추가
    for (const exc of globalExclusions) {
      effectiveMap.set(exc.exclusion_date, {
        date: exc.exclusion_date,
        type: exc.exclusion_type,
        reason: exc.reason,
        source: "global",
      });
    }

    // 오버라이드 적용
    for (const override of exclusionOverrides) {
      if (override.override_type === "remove") {
        // 전역 제외일 제거
        effectiveMap.delete(override.exclusion_date);
      } else if (override.override_type === "add") {
        // 플래너 전용 제외일 추가
        effectiveMap.set(override.exclusion_date, {
          date: override.exclusion_date,
          type: override.exclusion_type || "기타",
          reason: override.reason,
          source: "override_add",
        });
      }
    }

    return Array.from(effectiveMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [globalExclusions, exclusionOverrides]);

  // 오버라이드로 제거된 전역 제외일 목록 (Phase 5)
  const removedByOverride = useMemo(() => {
    const removedDates = new Set(
      exclusionOverrides
        .filter((o) => o.override_type === "remove")
        .map((o) => o.exclusion_date)
    );

    return globalExclusions.filter((exc) => removedDates.has(exc.exclusion_date));
  }, [globalExclusions, exclusionOverrides]);

  // 요일 표시 헬퍼 (Phase 4)
  const formatDayOfWeek = (day: number): string => {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return days[day] || "";
  };

  // 날짜 포맷팅
  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      });
    } catch {
      return dateStr;
    }
  };

  // D-Day 계산
  const calculateDDay = () => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const dDay = calculateDDay();

  // 플래너 미선택 상태
  if (!selectedPlannerId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Info className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">플래너를 선택해주세요</h3>
        <p className="text-sm text-gray-500">
          설정을 확인하려면 먼저 플래너를 선택해야 합니다.
        </p>
      </div>
    );
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">오류가 발생했습니다</h3>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button
          onClick={loadPlanner}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* 설정 수정 불가 안내 배너 (execute_only 모드) */}
      {!canEditSettings && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-amber-600 text-lg">🔒</span>
          <div>
            <p className="text-sm font-medium text-amber-800">
              이 플래너는 관리자가 생성했습니다
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              설정은 조회만 가능합니다. 플랜 수행은 정상적으로 할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 변경사항 알림 바 */}
      {hasChanges && canEditSettings && (
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">저장되지 않은 변경사항이 있습니다.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              저장
            </button>
          </div>
        </div>
      )}

      {/* 섹션 1: 기본 정보 */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">기본 정보</h2>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {/* 플래너 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              플래너 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 2026년 1학기 수능 준비"
              disabled={!canEditSettings}
              className={cn(
                "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
                !canEditSettings && "bg-gray-50 cursor-not-allowed opacity-60"
              )}
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="플래너에 대한 설명을 입력하세요"
              rows={3}
              disabled={!canEditSettings}
              className={cn(
                "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none",
                !canEditSettings && "bg-gray-50 cursor-not-allowed opacity-60"
              )}
            />
          </div>

          {/* 관리자 메모 (관리자만 표시) */}
          {isAdminMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                관리자 메모
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  (학생에게 표시되지 않음)
                </span>
              </label>
              <textarea
                value={adminMemo}
                onChange={(e) => setAdminMemo(e.target.value)}
                placeholder="관리자용 메모를 입력하세요"
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none bg-amber-50/50"
              />
            </div>
          )}

          {/* 상태 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              상태
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {STATUS_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "relative flex flex-col p-3 border rounded-lg transition-all",
                    canEditSettings ? "cursor-pointer" : "cursor-not-allowed",
                    status === option.value
                      ? "border-primary-500 bg-primary-50 ring-2 ring-primary-500"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                    !canEditSettings && "opacity-60"
                  )}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    checked={status === option.value}
                    onChange={() => setStatus(option.value)}
                    disabled={!canEditSettings}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {option.label}
                  </span>
                  <span className="text-xs text-gray-500 mt-0.5">
                    {option.description}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 섹션 2: 학습 기간 */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">학습 기간</h2>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {/* 기간 표시 요약 */}
          {periodStart && periodEnd && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">학습 기간</p>
                  <p className="text-lg font-semibold text-blue-900 mt-1">
                    {formatDateForDisplay(periodStart)} ~ {formatDateForDisplay(periodEnd)}
                  </p>
                </div>
                {targetDate && dDay !== null && (
                  <div className="text-right">
                    <p className="text-sm text-blue-700 font-medium">목표일까지</p>
                    <p className={cn(
                      "text-2xl font-bold mt-1",
                      dDay <= 7 ? "text-red-600" : dDay <= 30 ? "text-amber-600" : "text-blue-900"
                    )}>
                      D{dDay > 0 ? `-${dDay}` : dDay === 0 ? "-Day" : `+${Math.abs(dDay)}`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 시작일 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                시작일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* 종료일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                종료일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                min={periodStart}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* 목표일 (D-Day) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              목표일 (D-Day)
              <span className="ml-2 text-xs text-gray-400 font-normal">선택사항</span>
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              min={periodEnd}
              className="w-full sm:w-1/2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              수능일, 시험일 등 최종 목표 날짜를 설정하면 D-Day가 표시됩니다.
            </p>
          </div>
        </div>
      </section>

      {/* 섹션 3: 학습 시간 설정 (Phase 2) */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">학습 시간 설정</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            일일 학습 가능 시간과 비학습 시간을 설정합니다.
          </p>
        </div>
        <div className="p-6 space-y-6">
          {/* 학습 시간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              학습 시간 <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              하루 중 학습이 가능한 시간대를 설정하세요.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={studyHoursStart}
                onChange={(e) => setStudyHoursStart(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <span className="text-gray-500">~</span>
              <input
                type="time"
                value={studyHoursEnd}
                onChange={(e) => setStudyHoursEnd(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <span className="text-sm text-gray-500">
                ({studyHours ? `${Math.floor((parseInt(studyHours.end.split(":")[0]) * 60 + parseInt(studyHours.end.split(":")[1]) - parseInt(studyHours.start.split(":")[0]) * 60 - parseInt(studyHours.start.split(":")[1])) / 60)}시간 ${(parseInt(studyHours.end.split(":")[0]) * 60 + parseInt(studyHours.end.split(":")[1]) - parseInt(studyHours.start.split(":")[0]) * 60 - parseInt(studyHours.start.split(":")[1])) % 60}분` : "-"})
              </span>
            </div>
          </div>

          {/* 점심 시간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              점심 시간 <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              점심 식사 시간을 설정하세요. 이 시간은 학습 시간에서 제외됩니다.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={lunchTimeStart}
                onChange={(e) => setLunchTimeStart(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <span className="text-gray-500">~</span>
              <input
                type="time"
                value={lunchTimeEnd}
                onChange={(e) => setLunchTimeEnd(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* 자습 시간 (선택) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              자습 시간
              <span className="ml-2 text-xs text-gray-400 font-normal">선택사항</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              정규 학습 시간 외에 추가 자습 시간이 있다면 설정하세요.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={selfStudyHoursStart}
                onChange={(e) => setSelfStudyHoursStart(e.target.value)}
                placeholder="시작"
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <span className="text-gray-500">~</span>
              <input
                type="time"
                value={selfStudyHoursEnd}
                onChange={(e) => setSelfStudyHoursEnd(e.target.value)}
                placeholder="종료"
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {selfStudyHoursStart && selfStudyHoursEnd && (
                <button
                  type="button"
                  onClick={() => {
                    setSelfStudyHoursStart("");
                    setSelfStudyHoursEnd("");
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                  title="자습 시간 초기화"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 비학습 시간 블록 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                비학습 시간 블록
                <span className="ml-2 text-xs text-gray-400 font-normal">선택사항</span>
              </label>
              <button
                type="button"
                onClick={handleAddNonStudyBlock}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded"
              >
                <Plus className="w-3 h-3" />
                추가
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              식사, 수면 등 학습에서 제외할 추가 시간대를 설정하세요.
            </p>

            {nonStudyTimeBlocks.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg">
                추가된 비학습 시간 블록이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {nonStudyTimeBlocks.map((block, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <select
                      value={block.type}
                      onChange={(e) =>
                        handleUpdateNonStudyBlock(index, "type", e.target.value as NonStudyTimeBlock["type"])
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {NON_STUDY_BLOCK_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={block.start_time}
                      onChange={(e) =>
                        handleUpdateNonStudyBlock(index, "start_time", e.target.value)
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <span className="text-gray-500">~</span>
                    <input
                      type="time"
                      value={block.end_time}
                      onChange={(e) =>
                        handleUpdateNonStudyBlock(index, "end_time", e.target.value)
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <input
                      type="text"
                      value={block.description || ""}
                      onChange={(e) =>
                        handleUpdateNonStudyBlock(index, "description", e.target.value)
                      }
                      placeholder="설명 (선택)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveNonStudyBlock(index)}
                      className="p-2 text-gray-400 hover:text-red-500"
                      title="삭제"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 주간 타임라인 시각화 */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">주간 학습 시간 미리보기</h3>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <WeeklyAvailabilityTimeline
                studyHours={studyHours}
                selfStudyHours={selfStudyHours}
                lunchTime={lunchTime}
                academySchedules={[]}
                nonStudyTimeBlocks={nonStudyTimeBlocks}
                compact={false}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              * 학원 일정은 &quot;시간관리&quot; 탭에서 별도로 관리됩니다.
            </p>
          </div>
        </div>
      </section>

      {/* 섹션 4: 스케줄러 설정 (Phase 3) */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">스케줄러 설정</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            학습 계획 생성 방식을 설정합니다.
          </p>
        </div>
        <div className="p-6 space-y-6">
          {/* 스케줄러 타입 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              스케줄러 타입
            </label>
            <p className="text-xs text-gray-500 mb-3">
              학습 계획을 생성할 때 사용할 알고리즘을 선택하세요.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SCHEDULER_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all",
                    schedulerType === option.value
                      ? "border-primary-500 bg-primary-50 ring-2 ring-primary-500"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <input
                    type="radio"
                    name="schedulerType"
                    value={option.value || ""}
                    checked={schedulerType === option.value}
                    onChange={() => setSchedulerType(option.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {option.label}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {option.description}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 1730 Timetable 옵션 (해당 타입 선택 시에만 표시) */}
          {schedulerType === SCHEDULER_TYPES.TIMETABLE_1730 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
              <h4 className="text-sm font-medium text-blue-900">
                1730 시간표 설정
              </h4>
              <p className="text-xs text-blue-700">
                학습일과 복습일 사이클을 설정합니다. 예: 6일 학습 후 1일 복습
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* 학습일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    학습일 수
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={studyDays}
                      onChange={(e) => setStudyDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                      min={1}
                      max={30}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <span className="text-sm text-gray-600">일</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">1~30일</p>
                </div>

                {/* 복습일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    복습일 수
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={reviewDays}
                      onChange={(e) => setReviewDays(Math.max(0, Math.min(7, parseInt(e.target.value) || 0)))}
                      min={0}
                      max={7}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <span className="text-sm text-gray-600">일</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">0~7일</p>
                </div>
              </div>

              {/* 사이클 미리보기 */}
              <div className="pt-3 border-t border-blue-200">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">사이클 미리보기:</span>{" "}
                  {studyDays}일 학습 → {reviewDays}일 복습 → 반복
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  총 {studyDays + reviewDays}일 주기로 학습 계획이 생성됩니다.
                </p>
              </div>
            </div>
          )}

          {/* 기본 균등 배분 설명 */}
          {schedulerType === SCHEDULER_TYPES.DEFAULT && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700">
                기본 균등 배분 방식
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                콘텐츠를 학습 기간에 균등하게 배분합니다. 별도의 복습일 설정 없이
                순차적으로 학습 계획이 생성됩니다.
              </p>
            </div>
          )}

          {/* 안내 메시지 */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              스케줄러 설정을 변경하면 이후 생성되는 새 플랜 그룹에 적용됩니다.
              기존 플랜 그룹의 일정은 변경되지 않습니다.
            </p>
          </div>
        </div>
      </section>

      {/* 섹션 5: 학원 일정 연동 (Phase 4) */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">학원 일정 연동</h2>
            </div>
            <button
              type="button"
              onClick={handleSyncAcademySchedules}
              disabled={isSyncingAcademies || studentAcademies.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncingAcademies ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              학생 일정 가져오기
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            학생의 학원 일정을 플래너에 연동하여 학습 시간 계산에 반영합니다.
          </p>
        </div>
        <div className="p-6 space-y-6">
          {/* 현재 플래너에 연동된 학원 일정 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              현재 연동된 학원 일정
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({plannerAcademySchedules.length}개)
              </span>
            </h4>

            {plannerAcademySchedules.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg">
                연동된 학원 일정이 없습니다.
                <br />
                <span className="text-xs">&quot;학생 일정 가져오기&quot; 버튼을 클릭하여 학생의 학원 일정을 가져오세요.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {plannerAcademySchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 text-sm font-medium text-orange-700 bg-orange-100 rounded-full">
                        {formatDayOfWeek(schedule.dayOfWeek)}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {schedule.academyName || "학원"}
                          {schedule.subject && (
                            <span className="ml-1 text-gray-500">({schedule.subject})</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {schedule.startTime} ~ {schedule.endTime}
                          {schedule.travelTime > 0 && (
                            <span className="ml-1 text-orange-600">
                              (이동 {schedule.travelTime}분)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 학생의 학원 일정 (동기화 가능한 목록) */}
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              학생 등록 학원 일정
              {isLoadingAcademies && (
                <Loader2 className="inline-block w-4 h-4 ml-2 animate-spin text-gray-400" />
              )}
            </h4>

            {studentAcademies.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg">
                {isLoadingAcademies ? (
                  "학원 일정을 불러오는 중..."
                ) : (
                  <>
                    등록된 학원 일정이 없습니다.
                    <br />
                    <span className="text-xs">학생 시간관리 탭에서 학원 일정을 먼저 등록해주세요.</span>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {studentAcademies.map((academy) => (
                  <div
                    key={academy.id}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {academy.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        이동시간 {academy.travel_time}분
                      </span>
                    </div>
                    {academy.schedules.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {academy.schedules.map((schedule) => (
                          <span
                            key={schedule.id}
                            className="inline-flex items-center px-2 py-1 text-xs text-gray-600 bg-white border border-gray-200 rounded"
                          >
                            {formatDayOfWeek(schedule.day_of_week)} {schedule.start_time}~{schedule.end_time}
                            {schedule.subject && ` (${schedule.subject})`}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">등록된 일정 없음</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 주간 타임라인 시각화 (학원 일정 포함) */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              주간 학습 시간 미리보기
              <span className="ml-2 text-xs font-normal text-gray-400">(학원 일정 반영)</span>
            </h3>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <WeeklyAvailabilityTimeline
                studyHours={studyHours}
                selfStudyHours={selfStudyHours}
                lunchTime={lunchTime}
                academySchedules={academySchedulesForTimeline}
                nonStudyTimeBlocks={nonStudyTimeBlocks}
                compact={false}
              />
            </div>
          </div>

          {/* 안내 메시지 */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700">
              <p className="font-medium mb-1">학원 일정 연동 안내</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>&quot;학생 일정 가져오기&quot;를 클릭하면 학생의 학원 일정이 이 플래너에 복사됩니다.</li>
                <li>연동된 일정은 학습 계획 생성 시 자동으로 제외됩니다.</li>
                <li>학생의 원본 학원 일정은 &quot;시간관리&quot; 탭에서 관리됩니다.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 섹션 6: 제외일 오버라이드 설정 (Phase 5 - 설정 수정 권한 필요) */}
      {canEditSettings && (
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-red-100 text-red-600 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">제외일 오버라이드</h2>
              <p className="text-sm text-gray-500">이 플래너에만 적용되는 제외일 커스터마이징</p>
            </div>
          </div>
          {isLoadingExclusions && (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* 안내 메시지 */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700">
              <p className="font-medium mb-1">제외일 오버라이드란?</p>
              <p>
                학생의 전역 제외일(시간관리)을 이 플래너에서만 다르게 적용할 수 있습니다.
                전역 제외일을 무시하거나, 이 플래너에만 추가 제외일을 설정할 수 있습니다.
              </p>
            </div>
          </div>

          {/* 현재 적용될 제외일 목록 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              이 플래너에 적용될 제외일
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({effectiveExclusions.length}개)
              </span>
            </h3>

            {effectiveExclusions.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg">
                적용될 제외일이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {effectiveExclusions.map((exc) => (
                  <div
                    key={exc.date}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg border text-sm",
                      exc.source === "override_add"
                        ? "bg-red-50 border-red-200"
                        : "bg-gray-50 border-gray-200"
                    )}
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                        {formatDateForDisplay(exc.date)}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        {exc.type}
                        {exc.source === "override_add" && (
                          <span className="ml-1 text-red-600">(플래너 전용)</span>
                        )}
                      </span>
                    </div>
                    {exc.source === "global" && (
                      <button
                        type="button"
                        onClick={() => handleRemoveGlobalExclusion(exc.date)}
                        disabled={isProcessingOverride}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="이 플래너에서 무시"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {exc.source === "override_add" && (
                      <button
                        type="button"
                        onClick={() => handleDeleteOverride(exc.date)}
                        disabled={isProcessingOverride}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="오버라이드 삭제"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 무시된 전역 제외일 (복원 가능) */}
          {removedByOverride.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                이 플래너에서 무시된 제외일
                <span className="ml-2 text-xs font-normal text-gray-400">
                  ({removedByOverride.length}개)
                </span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {removedByOverride.map((exc) => (
                  <div
                    key={exc.exclusion_date}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 line-through"
                  >
                    <span>{formatDateForDisplay(exc.exclusion_date)}</span>
                    <span className="text-xs">({exc.exclusion_type})</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteOverride(exc.exclusion_date)}
                      disabled={isProcessingOverride}
                      className="p-0.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors disabled:opacity-50"
                      title="복원 (전역 제외일 적용)"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 플래너 전용 제외일 추가 */}
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              플래너 전용 제외일 추가
            </h4>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="new-exclusion-date" className="block text-xs text-gray-500 mb-1">날짜</label>
                <input
                  type="date"
                  id="new-exclusion-date"
                  value={newExclusionDate}
                  onChange={(e) => setNewExclusionDate(e.target.value)}
                  min={periodStart}
                  max={periodEnd}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label htmlFor="new-exclusion-type" className="block text-xs text-gray-500 mb-1">유형</label>
                <select
                  id="new-exclusion-type"
                  value={newExclusionType}
                  onChange={(e) => setNewExclusionType(e.target.value as ExclusionType)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="휴가">휴가</option>
                  <option value="개인사정">개인사정</option>
                  <option value="휴일지정">휴일지정</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div>
                <label htmlFor="new-exclusion-reason" className="block text-xs text-gray-500 mb-1">사유 (선택)</label>
                <input
                  type="text"
                  id="new-exclusion-reason"
                  value={newExclusionReason}
                  onChange={(e) => setNewExclusionReason(e.target.value)}
                  placeholder="예: 가족 여행"
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <button
                type="button"
                onClick={handleAddPlannerOnlyExclusion}
                disabled={isProcessingOverride || !newExclusionDate}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessingOverride ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                추가
              </button>
            </div>
          </div>

          {/* 전역 제외일 참고 정보 */}
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              학생 전역 제외일 (시간관리에서 설정)
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({globalExclusions.length}개)
              </span>
            </h4>
            {globalExclusions.length === 0 ? (
              <p className="text-sm text-gray-400">
                설정된 전역 제외일이 없습니다.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {globalExclusions.map((exc) => {
                  const isRemoved = removedByOverride.some(
                    (r) => r.exclusion_date === exc.exclusion_date
                  );
                  return (
                    <span
                      key={exc.exclusion_date}
                      className={cn(
                        "inline-flex items-center px-2 py-1 text-xs rounded",
                        isRemoved
                          ? "bg-gray-100 text-gray-400 line-through"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      )}
                    >
                      {formatDateForDisplay(exc.exclusion_date)}
                      <span className="ml-1">({exc.exclusion_type})</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* 하단 저장 버튼 (설정 수정 권한 필요) */}
      {canEditSettings && (
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            onClick={handleCancel}
            disabled={isPending || !hasChanges}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || !hasChanges}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            변경사항 저장
          </button>
        </div>
      )}
    </div>
  );
}
