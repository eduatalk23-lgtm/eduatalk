"use client";

import { useState, useEffect, useRef, useTransition, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Info, Plus, X, Save, Copy, Check, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAdminPlanBasic } from "../context/AdminPlanContext";
import type { NonStudyTimeBlock } from "@/lib/domains/admin-plan/types";
import {
  getCalendarSettingsAction,
  updateCalendarSettingsAction,
} from "@/lib/domains/calendar/actions/calendars";
import type { CalendarSettings } from "@/lib/domains/admin-plan/types";
import { useToast } from "@/components/ui/ToastProvider";
import { usePlanTabState } from "../hooks/usePlanTabState";
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
import { EVENT_COLOR_PALETTE } from "../utils/eventColors";

interface SettingsTabProps {
  tab: "settings";
}

type CalendarStatus = "draft" | "active" | "paused" | "completed" | "archived";
const STATUS_OPTIONS: { value: CalendarStatus; label: string }[] = [
  { value: "active", label: "활성" },
  { value: "paused", label: "일시정지" },
  { value: "completed", label: "완료" },
  { value: "archived", label: "보관됨" },
];

const NON_STUDY_BLOCK_TYPES: NonStudyTimeBlock["type"][] = [
  "아침식사", "점심식사", "저녁식사", "수면", "기타",
];

const SCHEDULER_TYPE_OPTIONS: { value: SchedulerType; label: string; desc: string }[] = [
  { value: SCHEDULER_TYPES.TIMETABLE_1730, label: "1730 시간표", desc: "N일 학습 + M일 복습 사이클" },
  { value: SCHEDULER_TYPES.DEFAULT, label: "기본 균등 배분", desc: "콘텐츠를 날짜에 균등 배분" },
];


/* ─── 공통 input 스타일 ─── */
const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500";
const timeCls = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500";
const disabledCls = "bg-gray-50 cursor-not-allowed opacity-60";

/* ─── Pill 선택 버튼 ─── */
function Pill({ selected, disabled, onClick, children }: {
  selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-3 py-1.5 text-sm rounded-full border transition-colors disabled:opacity-50",
        selected
          ? "bg-primary-50 border-primary-300 text-primary-700 font-medium"
          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50",
      )}
    >
      {children}
    </button>
  );
}

/* ─── 사이드바 섹션 정의 ─── */
type SectionDef = { id: string; label: string };
const ALL_SECTIONS: SectionDef[] = [
  { id: "general", label: "일반" },
  { id: "notifications", label: "이벤트 알림" },
  { id: "view-options", label: "보기 옵션" },
  { id: "study-period", label: "학습 기간" },
  { id: "study-hours", label: "학습 시간" },
  { id: "scheduler", label: "스케줄러" },
  { id: "calendar-preview", label: "캘린더 프리뷰" },
  { id: "calendar-info", label: "캘린더 정보" },
];

/**
 * GCal-style 캘린더 설정 탭
 *
 * 공통: 일반, 이벤트 알림, 보기 옵션, 캘린더 정보
 * 학습 전용: 학습 기간, 학습 시간, 스케줄러
 */
export function SettingsTab({ tab: _tab }: SettingsTabProps) {
  const router = useRouter();
  const { selectedCalendarId, isAdminMode, studentId, canEditSettings } = useAdminPlanBasic();
  const { showSuccess, showError } = useToast();
  const { handleTabChange } = usePlanTabState();
  const [isPending, startTransition] = useTransition();

  const [calSettings, setCalSettings] = useState<CalendarSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── 폼 상태 ──
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [adminMemo, setAdminMemo] = useState("");
  const [status, setStatus] = useState<CalendarStatus>("draft");
  const [defaultColor, setDefaultColor] = useState<string | null>(null);

  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const [studyHoursStart, setStudyHoursStart] = useState(DEFAULT_CAMP_STUDY_HOURS.start);
  const [studyHoursEnd, setStudyHoursEnd] = useState(DEFAULT_CAMP_STUDY_HOURS.end);
  const [lunchTimeStart, setLunchTimeStart] = useState(DEFAULT_CAMP_LUNCH_TIME.start);
  const [lunchTimeEnd, setLunchTimeEnd] = useState(DEFAULT_CAMP_LUNCH_TIME.end);
  const [selfStudyHoursStart, setSelfStudyHoursStart] = useState("");
  const [selfStudyHoursEnd, setSelfStudyHoursEnd] = useState("");
  const [nonStudyTimeBlocks, setNonStudyTimeBlocks] = useState<NonStudyTimeBlock[]>([]);

  const [schedulerType, setSchedulerType] = useState<SchedulerType>(SCHEDULER_DEFAULTS.TYPE);
  const [studyDays, setStudyDays] = useState(SCHEDULER_DEFAULTS.OPTIONS.study_days);
  const [reviewDays, setReviewDays] = useState(SCHEDULER_DEFAULTS.OPTIONS.review_days);

  const [defaultEstimatedMinutes, setDefaultEstimatedMinutes] = useState<number | null>(null);
  const [defaultReminderMinutes, setDefaultReminderMinutes] = useState<number | null>(null);
  const [weekStartsOn, setWeekStartsOn] = useState(0);

  const [hasChanges, setHasChanges] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // ── 사이드바 네비게이션 ──
  const [activeSection, setActiveSection] = useState("general");
  const contentRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ratioMapRef = useRef<Map<string, number>>(new Map());

  // ── TimeRange 헬퍼 ──
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

  // calendar-preview는 periodStart/periodEnd 모두 필요
  const hasPreviewSection = !!periodStart && !!periodEnd;

  const visibleSections = useMemo(
    () =>
      ALL_SECTIONS.filter((s) => {
        if (s.id === "calendar-preview") return hasPreviewSection;
        return true;
      }),
    [hasPreviewSection],
  );

  // ── IntersectionObserver: 누적 ratioMap 기반 활성 섹션 추적 ──
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    ratioMapRef.current.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        // 스크롤 애니메이션 중엔 IO 업데이트 무시 (경쟁 조건 방지)
        if (isScrollingRef.current) return;

        // 누적 Map 업데이트
        for (const entry of entries) {
          ratioMapRef.current.set(entry.target.id, entry.intersectionRatio);
        }

        // Map에서 가장 높은 ratio 찾기
        let maxRatio = 0;
        let maxId = "";
        for (const [id, ratio] of ratioMapRef.current) {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            maxId = id;
          }
        }
        if (maxId) setActiveSection(maxId);
      },
      {
        root: container,
        rootMargin: "-10% 0px -60% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    const sections = container.querySelectorAll("section[id]");
    sections.forEach((s) => observer.observe(s));

    return () => {
      observer.disconnect();
      clearTimeout(scrollTimerRef.current);
    };
  }, [visibleSections]);

  const scrollToSection = useCallback((sectionId: string) => {
    const scrollEl = contentRef.current;
    const target = document.getElementById(sectionId);
    if (!scrollEl || !target) return;

    isScrollingRef.current = true;
    setActiveSection(sectionId);

    // 콘텐츠 스크롤 컨테이너 내에서 직접 스크롤 (부모 레이아웃 영향 없음)
    const top = target.offsetTop - 16;
    scrollEl.scrollTo({ top: Math.max(0, top), behavior: "smooth" });

    clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 600);
  }, []);

  // ── 데이터 로드 ──
  const loadSettings = useCallback(async () => {
    if (!selectedCalendarId) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const d = await getCalendarSettingsAction(selectedCalendarId, true);
      if (d) {
        setCalSettings(d);
        setName(d.name);
        setDescription(d.description || "");
        setAdminMemo(d.adminMemo || "");
        setStatus(d.status as CalendarStatus);
        setDefaultColor(d.defaultColor);
        setPeriodStart(d.periodStart ?? "");
        setPeriodEnd(d.periodEnd ?? "");
        setTargetDate(d.targetDate || "");
        setStudyHoursStart(d.studyHours?.start || DEFAULT_CAMP_STUDY_HOURS.start);
        setStudyHoursEnd(d.studyHours?.end || DEFAULT_CAMP_STUDY_HOURS.end);
        const lunch = (d.nonStudyTimeBlocks || []).find((b) => b.type === "점심식사");
        setLunchTimeStart(lunch?.start_time || DEFAULT_CAMP_LUNCH_TIME.start);
        setLunchTimeEnd(lunch?.end_time || DEFAULT_CAMP_LUNCH_TIME.end);
        setSelfStudyHoursStart(d.selfStudyHours?.start || "");
        setSelfStudyHoursEnd(d.selfStudyHours?.end || "");
        setNonStudyTimeBlocks((d.nonStudyTimeBlocks || []).filter((b) => b.type !== "점심식사"));
        setSchedulerType((d.defaultSchedulerType as SchedulerType) || SCHEDULER_DEFAULTS.TYPE);
        const opts = d.defaultSchedulerOptions as unknown as Timetable1730Options | undefined;
        setStudyDays(opts?.study_days ?? SCHEDULER_DEFAULTS.OPTIONS.study_days);
        setReviewDays(opts?.review_days ?? SCHEDULER_DEFAULTS.OPTIONS.review_days);
        setDefaultEstimatedMinutes(d.defaultEstimatedMinutes);
        setDefaultReminderMinutes(d.defaultReminderMinutes?.[0] ?? null);
        setWeekStartsOn(d.weekStartsOn ?? 0);
        setHasChanges(false);
      }
    } catch (err) {
      console.error("[SettingsTab] load failed:", err);
      setError(err instanceof Error ? err.message : "캘린더 정보를 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCalendarId]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // ── 변경 감지 ──
  useEffect(() => {
    if (!calSettings) return;
    const savedLunch = (calSettings.nonStudyTimeBlocks || []).find((b) => b.type === "점심식사");
    const savedBlocks = (calSettings.nonStudyTimeBlocks || []).filter((b) => b.type !== "점심식사");
    const savedOpts = calSettings.defaultSchedulerOptions as unknown as Timetable1730Options | undefined;
    const savedReminder = calSettings.defaultReminderMinutes?.[0] ?? null;

    const changed =
      name !== calSettings.name ||
      description !== (calSettings.description || "") ||
      adminMemo !== (calSettings.adminMemo || "") ||
      status !== (calSettings.status as CalendarStatus) ||
      defaultColor !== (calSettings.defaultColor ?? null) ||
      periodStart !== (calSettings.periodStart ?? "") ||
      periodEnd !== (calSettings.periodEnd ?? "") ||
      targetDate !== (calSettings.targetDate || "") ||
      studyHoursStart !== (calSettings.studyHours?.start || DEFAULT_CAMP_STUDY_HOURS.start) ||
      studyHoursEnd !== (calSettings.studyHours?.end || DEFAULT_CAMP_STUDY_HOURS.end) ||
      lunchTimeStart !== (savedLunch?.start_time || DEFAULT_CAMP_LUNCH_TIME.start) ||
      lunchTimeEnd !== (savedLunch?.end_time || DEFAULT_CAMP_LUNCH_TIME.end) ||
      selfStudyHoursStart !== (calSettings.selfStudyHours?.start || "") ||
      selfStudyHoursEnd !== (calSettings.selfStudyHours?.end || "") ||
      JSON.stringify(nonStudyTimeBlocks) !== JSON.stringify(savedBlocks) ||
      schedulerType !== ((calSettings.defaultSchedulerType as SchedulerType) || SCHEDULER_DEFAULTS.TYPE) ||
      studyDays !== (savedOpts?.study_days ?? SCHEDULER_DEFAULTS.OPTIONS.study_days) ||
      reviewDays !== (savedOpts?.review_days ?? SCHEDULER_DEFAULTS.OPTIONS.review_days) ||
      defaultEstimatedMinutes !== calSettings.defaultEstimatedMinutes ||
      defaultReminderMinutes !== savedReminder ||
      weekStartsOn !== (calSettings.weekStartsOn ?? 0);

    setHasChanges(changed);
  }, [
    name, description, adminMemo, status, defaultColor,
    periodStart, periodEnd, targetDate,
    studyHoursStart, studyHoursEnd, lunchTimeStart, lunchTimeEnd,
    selfStudyHoursStart, selfStudyHoursEnd, nonStudyTimeBlocks,
    schedulerType, studyDays, reviewDays,
    defaultEstimatedMinutes, defaultReminderMinutes, weekStartsOn,
    calSettings,
  ]);

  // ── 저장 ──
  const handleSave = () => {
    if (!selectedCalendarId || !calSettings) return;
    if (!name.trim()) { showError("캘린더 이름을 입력해주세요."); return; }

    if (periodStart && periodEnd && new Date(periodStart) > new Date(periodEnd)) {
      showError("종료일은 시작일보다 늦어야 합니다."); return;
    }
    if (targetDate && periodEnd && new Date(targetDate) < new Date(periodEnd)) {
      showError("목표일(D-Day)은 종료일 이후여야 합니다."); return;
    }
    if (studyHoursStart && studyHoursEnd && studyHoursStart >= studyHoursEnd) {
      showError("학습 종료 시간은 시작 시간보다 늦어야 합니다."); return;
    }
    if (lunchTimeStart && lunchTimeEnd && lunchTimeStart >= lunchTimeEnd) {
      showError("점심 종료 시간은 시작 시간보다 늦어야 합니다."); return;
    }
    if ((selfStudyHoursStart && !selfStudyHoursEnd) || (!selfStudyHoursStart && selfStudyHoursEnd)) {
      showError("자습 시간을 완전히 설정하거나 비워두세요."); return;
    }
    if (selfStudyHoursStart && selfStudyHoursEnd && selfStudyHoursStart >= selfStudyHoursEnd) {
      showError("자습 종료 시간은 시작 시간보다 늦어야 합니다."); return;
    }
    if (schedulerType === SCHEDULER_TYPES.TIMETABLE_1730) {
      if (studyDays < 1 || studyDays > 30) { showError("학습일은 1~30일 사이로 설정해주세요."); return; }
      if (reviewDays < 0 || reviewDays > 7) { showError("복습일은 0~7일 사이로 설정해주세요."); return; }
    }

    startTransition(async () => {
      try {
        const payload: Parameters<typeof updateCalendarSettingsAction>[1] = {
          name: name.trim(),
          description: description.trim() || undefined,
          adminMemo: adminMemo.trim() || null,
          status,
          color: defaultColor,
          defaultEstimatedMinutes,
          defaultReminderMinutes: defaultReminderMinutes !== null ? [defaultReminderMinutes] : null,
          weekStartsOn,
        };

        const schedulerOptions: Record<string, unknown> =
          schedulerType === SCHEDULER_TYPES.TIMETABLE_1730
            ? { study_days: studyDays, review_days: reviewDays }
            : {};
        Object.assign(payload, {
          periodStart: periodStart || undefined,
          periodEnd: periodEnd || undefined,
          targetDate: targetDate || null,
          studyHours: studyHoursStart && studyHoursEnd ? { start: studyHoursStart, end: studyHoursEnd } : undefined,
          lunchTime: lunchTimeStart && lunchTimeEnd ? { start: lunchTimeStart, end: lunchTimeEnd } : undefined,
          selfStudyHours: selfStudyHoursStart && selfStudyHoursEnd ? { start: selfStudyHoursStart, end: selfStudyHoursEnd } : undefined,
          nonStudyTimeBlocks: nonStudyTimeBlocks.length > 0 ? nonStudyTimeBlocks : undefined,
          defaultSchedulerType: schedulerType || undefined,
          defaultSchedulerOptions: schedulerOptions,
        });

        await updateCalendarSettingsAction(selectedCalendarId, payload);
        showSuccess("캘린더 설정이 저장되었습니다.");
        router.refresh();
        await loadSettings();
      } catch (err) {
        console.error("[SettingsTab] save failed:", err);
        showError(err instanceof Error ? err.message : "저장에 실패했습니다.");
      }
    });
  };

  // ── 취소 (되돌리기) ──
  const handleCancel = () => {
    if (!calSettings) return;
    setName(calSettings.name);
    setDescription(calSettings.description || "");
    setAdminMemo(calSettings.adminMemo || "");
    setStatus(calSettings.status as CalendarStatus);
    setDefaultColor(calSettings.defaultColor);
    setPeriodStart(calSettings.periodStart ?? "");
    setPeriodEnd(calSettings.periodEnd ?? "");
    setTargetDate(calSettings.targetDate || "");
    setStudyHoursStart(calSettings.studyHours?.start || DEFAULT_CAMP_STUDY_HOURS.start);
    setStudyHoursEnd(calSettings.studyHours?.end || DEFAULT_CAMP_STUDY_HOURS.end);
    const savedLunch = (calSettings.nonStudyTimeBlocks || []).find((b) => b.type === "점심식사");
    setLunchTimeStart(savedLunch?.start_time || DEFAULT_CAMP_LUNCH_TIME.start);
    setLunchTimeEnd(savedLunch?.end_time || DEFAULT_CAMP_LUNCH_TIME.end);
    setSelfStudyHoursStart(calSettings.selfStudyHours?.start || "");
    setSelfStudyHoursEnd(calSettings.selfStudyHours?.end || "");
    setNonStudyTimeBlocks((calSettings.nonStudyTimeBlocks || []).filter((b) => b.type !== "점심식사"));
    setSchedulerType((calSettings.defaultSchedulerType as SchedulerType) || SCHEDULER_DEFAULTS.TYPE);
    const opts = calSettings.defaultSchedulerOptions as unknown as Timetable1730Options | undefined;
    setStudyDays(opts?.study_days ?? SCHEDULER_DEFAULTS.OPTIONS.study_days);
    setReviewDays(opts?.review_days ?? SCHEDULER_DEFAULTS.OPTIONS.review_days);
    setDefaultEstimatedMinutes(calSettings.defaultEstimatedMinutes);
    setDefaultReminderMinutes(calSettings.defaultReminderMinutes?.[0] ?? null);
    setWeekStartsOn(calSettings.weekStartsOn ?? 0);
    setHasChanges(false);
  };

  // ── 비학습 블록 핸들러 ──
  const handleAddBlock = () => {
    setNonStudyTimeBlocks((p) => [...p, { type: "기타", start_time: "18:00", end_time: "19:00", description: "" }]);
  };
  const handleRemoveBlock = (i: number) => {
    setNonStudyTimeBlocks((p) => p.filter((_, idx) => idx !== i));
  };
  const handleUpdateBlock = (i: number, field: keyof NonStudyTimeBlock, value: string | number[]) => {
    setNonStudyTimeBlocks((p) => p.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)));
  };

  // ── D-Day ──
  const dDay = useMemo(() => {
    if (!targetDate) return null;
    const t = new Date(targetDate); const now = new Date();
    t.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0);
    return Math.ceil((t.getTime() - now.getTime()) / 86400000);
  }, [targetDate]);

  // ── 학습시간 계산 ──
  const studyMinutes = useMemo(() => {
    if (!studyHours) return null;
    const [sh, sm] = studyHours.start.split(":").map(Number);
    const [eh, em] = studyHours.end.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }, [studyHours]);

  const handleCopyId = () => {
    if (!selectedCalendarId) return;
    navigator.clipboard.writeText(selectedCalendarId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // ── Early returns ──
  if (!selectedCalendarId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Info className="w-8 h-8 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">설정을 확인하려면 캘린더를 선택해주세요.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button onClick={loadSettings} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          다시 시도
        </button>
      </div>
    );
  }

  const disabled = !canEditSettings;

  // ════════════════════════════════════════════
  //  GCal-style flat settings layout with sidebar
  // ════════════════════════════════════════════
  return (
    <div className="h-full flex flex-col">
      {/* 헤더: 뒤로가기 + 제목 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 shrink-0">
        <button
          type="button"
          onClick={() => handleTabChange("planner")}
          className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 transition-colors"
          title="캘린더로 돌아가기"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-base font-semibold text-gray-900">캘린더 설정</h2>
      </div>

      {/* 읽기 전용 배너 */}
      {disabled && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg mx-4 mt-4 shrink-0">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>이 캘린더는 관리자가 생성하여 설정은 조회만 가능합니다.</span>
        </div>
      )}

      {/* 변경사항 바 */}
      {hasChanges && !disabled && (
        <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-200 shrink-0">
          <span className="text-sm font-medium text-blue-800">저장되지 않은 변경사항</span>
          <div className="flex items-center gap-2">
            <button onClick={handleCancel} disabled={isPending} className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              취소
            </button>
            <button onClick={handleSave} disabled={isPending} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              저장
            </button>
          </div>
        </div>
      )}

      {/* 사이드바(고정) + 콘텐츠(자체 스크롤) */}
      <div className="flex flex-1 min-h-0">
        {/* ── 사이드바 네비게이션 (md 이상) ── */}
        <nav className="hidden md:flex flex-col w-48 shrink-0 border-r border-gray-200 py-4 pl-4 pr-2" aria-label="설정 섹션 탐색">
          <ul className="space-y-0.5">
            {visibleSections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
                    activeSection === s.id
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                  )}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── 콘텐츠 (자체 스크롤) ── */}
        <div ref={contentRef} className="flex-1 min-w-0 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">
        <div className="divide-y divide-gray-200">

        {/* ════ 일반 ════ */}
        <section id="general" className="pb-8 scroll-mt-16">
          <h3 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-5">일반</h3>
          <div className="space-y-5">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">캘린더 이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 수능 준비, 개인 일정"
                disabled={disabled}
                className={cn(inputCls, disabled && disabledCls)}
              />
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="캘린더에 대한 간단한 설명"
                rows={2}
                disabled={disabled}
                className={cn(inputCls, "resize-none", disabled && disabledCls)}
              />
            </div>

            {/* 색상 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">색상</label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_COLOR_PALETTE.map((c) => {
                  const sel = defaultColor === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      title={c.label}
                      disabled={disabled}
                      onClick={() => setDefaultColor(sel ? null : c.key)}
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed",
                        sel && "ring-2 ring-offset-1 ring-gray-400",
                      )}
                      style={{ backgroundColor: c.hex }}
                    >
                      {sel && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 16 16" fill="none">
                          <path d="M4 8l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              {!defaultColor && <p className="mt-1 text-xs text-gray-400">선택하지 않으면 기본 색상이 적용됩니다.</p>}
            </div>
          </div>
        </section>

        {/* ════ 이벤트 알림 ════ */}
        <section id="notifications" className="py-8 scroll-mt-16">
          <h3 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-5">이벤트 알림</h3>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">기본 이벤트 시간</label>
              <p className="text-xs text-gray-500 mb-2">빠른 생성 시 자동 설정되는 이벤트 길이</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: null, l: "기본 (60분)" },
                  { v: 15, l: "15분" },
                  { v: 30, l: "30분" },
                  { v: 45, l: "45분" },
                  { v: 60, l: "1시간" },
                  { v: 90, l: "1시간 30분" },
                  { v: 120, l: "2시간" },
                ].map((o) => (
                  <Pill key={o.v ?? "null"} selected={defaultEstimatedMinutes === o.v} disabled={disabled} onClick={() => setDefaultEstimatedMinutes(o.v)}>
                    {o.l}
                  </Pill>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">기본 알림</label>
              <p className="text-xs text-gray-500 mb-2">새 이벤트 생성 시 자동 설정되는 알림</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: null, l: "없음" },
                  { v: 5, l: "5분 전" },
                  { v: 10, l: "10분 전" },
                  { v: 30, l: "30분 전" },
                  { v: 60, l: "1시간 전" },
                ].map((o) => (
                  <Pill key={o.v ?? "null"} selected={defaultReminderMinutes === o.v} disabled={disabled} onClick={() => setDefaultReminderMinutes(o.v)}>
                    {o.l}
                  </Pill>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ════ 보기 옵션 ════ */}
        <section id="view-options" className="py-8 scroll-mt-16">
          <h3 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-5">보기 옵션</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">주 시작 요일</label>
            <p className="text-xs text-gray-500 mb-2">주간/월간 뷰에서 첫 번째 열</p>
            <div className="flex flex-wrap gap-2">
              {[{ v: 0, l: "일요일" }, { v: 1, l: "월요일" }, { v: 6, l: "토요일" }].map((o) => (
                <Pill key={o.v} selected={weekStartsOn === o.v} disabled={disabled} onClick={() => setWeekStartsOn(o.v)}>
                  {o.l}
                </Pill>
              ))}
            </div>
          </div>
        </section>

        {/* ════ 학습 기간 ════ */}
        <section id="study-period" className="py-8 scroll-mt-16">
          <h3 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-5">학습 기간</h3>
          <div className="space-y-5">
            {/* D-Day 요약 */}
            {periodStart && periodEnd && (
              <div className="flex items-center justify-between px-4 py-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-blue-800">
                  {new Date(periodStart).toLocaleDateString("ko-KR")} ~ {new Date(periodEnd).toLocaleDateString("ko-KR")}
                </span>
                {targetDate && dDay !== null && (
                  <span className={cn(
                    "text-lg font-bold",
                    dDay <= 7 ? "text-red-600" : dDay <= 30 ? "text-amber-600" : "text-blue-700",
                  )}>
                    D{dDay > 0 ? `-${dDay}` : dDay === 0 ? "-Day" : `+${Math.abs(dDay)}`}
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} disabled={disabled} className={cn(inputCls, disabled && disabledCls)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} min={periodStart} disabled={disabled} className={cn(inputCls, disabled && disabledCls)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                목표일 (D-Day) <span className="text-xs text-gray-400 font-normal ml-1">선택</span>
              </label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} min={periodEnd} disabled={disabled} className={cn("w-1/2", inputCls, disabled && disabledCls)} />
            </div>
          </div>
        </section>

        {/* ════ 학습 시간 ════ */}
        <section id="study-hours" className="py-8 scroll-mt-16">
            <h3 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-5">학습 시간</h3>
            <div className="space-y-5">
              {/* 학습 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학습 가능 시간</label>
                <div className="flex items-center gap-2">
                  <input type="time" value={studyHoursStart} onChange={(e) => setStudyHoursStart(e.target.value)} disabled={disabled} className={cn(timeCls, disabled && disabledCls)} />
                  <span className="text-gray-400">~</span>
                  <input type="time" value={studyHoursEnd} onChange={(e) => setStudyHoursEnd(e.target.value)} disabled={disabled} className={cn(timeCls, disabled && disabledCls)} />
                  {studyMinutes !== null && studyMinutes > 0 && (
                    <span className="text-xs text-gray-500">{Math.floor(studyMinutes / 60)}시간 {studyMinutes % 60}분</span>
                  )}
                </div>
              </div>

              {/* 점심 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">점심 시간</label>
                <div className="flex items-center gap-2">
                  <input type="time" value={lunchTimeStart} onChange={(e) => setLunchTimeStart(e.target.value)} disabled={disabled} className={cn(timeCls, disabled && disabledCls)} />
                  <span className="text-gray-400">~</span>
                  <input type="time" value={lunchTimeEnd} onChange={(e) => setLunchTimeEnd(e.target.value)} disabled={disabled} className={cn(timeCls, disabled && disabledCls)} />
                </div>
              </div>

              {/* 자습 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  자습 시간 <span className="text-xs text-gray-400 font-normal ml-1">선택</span>
                </label>
                <div className="flex items-center gap-2">
                  <input type="time" value={selfStudyHoursStart} onChange={(e) => setSelfStudyHoursStart(e.target.value)} disabled={disabled} className={cn(timeCls, disabled && disabledCls)} />
                  <span className="text-gray-400">~</span>
                  <input type="time" value={selfStudyHoursEnd} onChange={(e) => setSelfStudyHoursEnd(e.target.value)} disabled={disabled} className={cn(timeCls, disabled && disabledCls)} />
                  {selfStudyHoursStart && selfStudyHoursEnd && (
                    <button type="button" onClick={() => { setSelfStudyHoursStart(""); setSelfStudyHoursEnd(""); }} className="p-1.5 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* 비학습 블록 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    비학습 시간 블록 <span className="text-xs text-gray-400 font-normal ml-1">선택</span>
                  </label>
                  {!disabled && (
                    <button type="button" onClick={handleAddBlock} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
                      <Plus className="w-3 h-3" /> 추가
                    </button>
                  )}
                </div>
                {nonStudyTimeBlocks.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">추가된 블록 없음</p>
                ) : (
                  <div className="space-y-2">
                    {nonStudyTimeBlocks.map((block, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <select value={block.type} onChange={(e) => handleUpdateBlock(i, "type", e.target.value as NonStudyTimeBlock["type"])} disabled={disabled} className="px-2 py-1.5 border border-gray-300 rounded text-xs">
                          {NON_STUDY_BLOCK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="time" value={block.start_time} onChange={(e) => handleUpdateBlock(i, "start_time", e.target.value)} disabled={disabled} className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
                        <span className="text-gray-400 text-xs">~</span>
                        <input type="time" value={block.end_time} onChange={(e) => handleUpdateBlock(i, "end_time", e.target.value)} disabled={disabled} className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
                        <input type="text" value={block.description || ""} onChange={(e) => handleUpdateBlock(i, "description", e.target.value)} placeholder="메모" disabled={disabled} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs" />
                        {!disabled && (
                          <button type="button" onClick={() => handleRemoveBlock(i)} className="p-1 text-gray-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 타임라인 미리보기 */}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">주간 학습 시간 미리보기</p>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <WeeklyAvailabilityTimeline
                    studyHours={studyHours}
                    selfStudyHours={selfStudyHours}
                    lunchTime={lunchTime}
                    academySchedules={[]}
                    nonStudyTimeBlocks={nonStudyTimeBlocks}
                    compact={false}
                  />
                </div>
              </div>
            </div>
        </section>

        {/* ════ 스케줄러 ════ */}
        <section id="scheduler" className="py-8 scroll-mt-16">
            <h3 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-5">스케줄러</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">스케줄러 타입</label>
                <div className="grid grid-cols-2 gap-3">
                  {SCHEDULER_TYPE_OPTIONS.map((o) => (
                    <label
                      key={o.value}
                      className={cn(
                        "flex flex-col p-3 border rounded-lg cursor-pointer transition-colors",
                        schedulerType === o.value
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                        disabled && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <input type="radio" name="scheduler" value={o.value || ""} checked={schedulerType === o.value} onChange={() => setSchedulerType(o.value)} disabled={disabled} className="sr-only" />
                      <span className="text-sm font-medium text-gray-900">{o.label}</span>
                      <span className="text-xs text-gray-500 mt-0.5">{o.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {schedulerType === SCHEDULER_TYPES.TIMETABLE_1730 && (
                <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">학습일 수</label>
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={studyDays} onChange={(e) => setStudyDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))} min={1} max={30} disabled={disabled} className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm text-center" />
                        <span className="text-xs text-gray-600">일</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">복습일 수</label>
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={reviewDays} onChange={(e) => setReviewDays(Math.max(0, Math.min(7, parseInt(e.target.value) || 0)))} min={0} max={7} disabled={disabled} className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm text-center" />
                        <span className="text-xs text-gray-600">일</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-blue-700">
                    {studyDays}일 학습 → {reviewDays}일 복습 (총 {studyDays + reviewDays}일 주기)
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 text-xs text-gray-500">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>스케줄러 변경은 이후 생성되는 플랜 그룹에만 적용됩니다.</span>
              </div>
            </div>
        </section>

        {/* ════ 캘린더 프리뷰 ════ */}
        {periodStart && periodEnd && (
          <section id="calendar-preview" className="py-8 scroll-mt-16">
            <h3 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-5">캘린더 프리뷰</h3>
            <PlannerCalendarView
              calendarId={selectedCalendarId || ""}
              periodStart={periodStart}
              periodEnd={periodEnd}
              studentId={studentId}
              readOnly={disabled}
            />
          </section>
        )}

        {/* ════ 캘린더 정보 ════ */}
        <section id="calendar-info" className="py-8 scroll-mt-16">
          <h3 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-5">캘린더 정보</h3>
          <div className="space-y-4">
            {/* 상태 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((o) => (
                  <Pill key={o.value} selected={status === o.value} disabled={disabled} onClick={() => setStatus(o.value)}>
                    {o.label}
                  </Pill>
                ))}
              </div>
            </div>

            {/* 관리자 메모 */}
            {isAdminMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  관리자 메모 <span className="text-xs text-gray-400 font-normal ml-1">학생에게 표시되지 않음</span>
                </label>
                <textarea
                  value={adminMemo}
                  onChange={(e) => setAdminMemo(e.target.value)}
                  placeholder="관리자용 메모"
                  rows={2}
                  className={cn(inputCls, "resize-none")}
                />
              </div>
            )}

            {/* 메타 정보 */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">캘린더 ID</p>
                <div className="flex items-center gap-1.5">
                  <code className="text-xs text-gray-600 font-mono truncate">{selectedCalendarId?.slice(0, 8)}...</code>
                  <button type="button" onClick={handleCopyId} className="p-1 text-gray-400 hover:text-gray-600" title="ID 복사">
                    {copiedId ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              {calSettings?.createdAt && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">생성일</p>
                  <p className="text-xs text-gray-700">{new Date(calSettings.createdAt).toLocaleDateString("ko-KR")}</p>
                </div>
              )}
              {calSettings?.isPrimary && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">기본 캘린더</p>
                  <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700">기본</span>
                </div>
              )}
            </div>
          </div>
        </section>
        </div>{/* end divide-y */}

        {/* 하단 저장 버튼 */}
        {!disabled && (
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
            <button onClick={handleCancel} disabled={isPending || !hasChanges} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
              취소
            </button>
            <button onClick={handleSave} disabled={isPending || !hasChanges} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              변경사항 저장
            </button>
          </div>
        )}

        {/* 마지막 섹션 스크롤 여백 */}
        <div className="h-[40vh]" aria-hidden="true" />
        </div>{/* end max-w-2xl */}
        </div>{/* end contentRef scroll */}
      </div>{/* end flex sidebar+content */}
    </div>
  );
}
