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
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAdminPlanBasic } from "../context/AdminPlanContext";
import {
  getPlannerAction,
  updatePlannerAction,
  type Planner,
  type PlannerStatus,
  type NonStudyTimeBlock,
} from "@/lib/domains/admin-plan/actions";
import { useToast } from "@/components/ui/ToastProvider";
import type { TimeRange } from "@/lib/features/wizard/types/data";
import { WeeklyAvailabilityTimeline } from "../admin-wizard/steps/_components/WeeklyAvailabilityTimeline";
import PlannerCalendarView from "../planner-calendar/PlannerCalendarView";
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

      {/* 섹션 5: 플래너 캘린더 (학원 + 제외일 + 비학습시간 통합) */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-5">
          <PlannerCalendarView
            plannerId={selectedPlannerId || ""}
            plannerPeriodStart={periodStart}
            plannerPeriodEnd={periodEnd}
            studentId={studentId}
            readOnly={!canEditSettings}
          />
        </div>
      </section>


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
