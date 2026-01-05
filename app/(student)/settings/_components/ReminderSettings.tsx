"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, Clock, AlertTriangle, Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  getReminderSettings,
  updateReminderSettings,
  type ReminderSettings as ReminderSettingsType,
} from "@/lib/services/planReminderService";
import { useToast } from "@/components/ui/ToastProvider";

interface ReminderSettingsProps {
  studentId: string;
  className?: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "일요일" },
  { value: 1, label: "월요일" },
  { value: 2, label: "화요일" },
  { value: 3, label: "수요일" },
  { value: 4, label: "목요일" },
  { value: 5, label: "금요일" },
  { value: 6, label: "토요일" },
];

const THRESHOLD_OPTIONS = [
  { value: 2, label: "2일" },
  { value: 3, label: "3일" },
  { value: 5, label: "5일" },
  { value: 7, label: "7일" },
];

/**
 * 플랜 리마인더 설정 컴포넌트
 */
export function ReminderSettings({ studentId, className }: ReminderSettingsProps) {
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<ReminderSettingsType>({
    incompleteReminderEnabled: true,
    incompleteReminderTime: "20:00",
    delayedPlanWarningEnabled: true,
    delayedPlanThreshold: 3,
    weeklySummaryEnabled: true,
    weeklySummaryDay: 0,
  });

  // 설정 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getReminderSettings(studentId);
        setSettings(data);
      } catch (error) {
        console.error("[ReminderSettings] 설정 로드 오류:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [studentId]);

  // 설정 업데이트
  const handleUpdate = (updates: Partial<ReminderSettingsType>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);

    startTransition(async () => {
      const result = await updateReminderSettings(studentId, updates);
      if (result.success) {
        showSuccess("설정이 저장되었습니다");
      } else {
        showError(result.error || "설정 저장에 실패했습니다");
        // 롤백
        setSettings(settings);
      }
    });
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* 일일 미완료 알림 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                일일 미완료 알림
              </h3>
              <p className="mt-0.5 text-xs text-gray-500">
                하루가 끝나기 전 미완료 플랜을 알려드려요
              </p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={settings.incompleteReminderEnabled}
              onChange={(e) =>
                handleUpdate({ incompleteReminderEnabled: e.target.checked })
              }
              disabled={isPending}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-disabled:opacity-50" />
          </label>
        </div>

        {settings.incompleteReminderEnabled && (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <Clock className="h-4 w-4 text-gray-400" />
            <label className="text-sm text-gray-600">알림 시간</label>
            <input
              type="time"
              value={settings.incompleteReminderTime}
              onChange={(e) =>
                handleUpdate({ incompleteReminderTime: e.target.value })
              }
              disabled={isPending}
              className="ml-auto rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
            />
          </div>
        )}
      </div>

      {/* 지연 플랜 경고 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                지연 플랜 경고
              </h3>
              <p className="mt-0.5 text-xs text-gray-500">
                오래 밀린 플랜이 있으면 알려드려요
              </p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={settings.delayedPlanWarningEnabled}
              onChange={(e) =>
                handleUpdate({ delayedPlanWarningEnabled: e.target.checked })
              }
              disabled={isPending}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-orange-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-disabled:opacity-50" />
          </label>
        </div>

        {settings.delayedPlanWarningEnabled && (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <span className="text-sm text-gray-600">경고 기준</span>
            <select
              value={settings.delayedPlanThreshold}
              onChange={(e) =>
                handleUpdate({ delayedPlanThreshold: Number(e.target.value) })
              }
              disabled={isPending}
              className="ml-auto rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {THRESHOLD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} 이상 지연
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 주간 요약 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">주간 요약</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                매주 학습 현황을 요약해서 알려드려요
              </p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={settings.weeklySummaryEnabled}
              onChange={(e) =>
                handleUpdate({ weeklySummaryEnabled: e.target.checked })
              }
              disabled={isPending}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-purple-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-disabled:opacity-50" />
          </label>
        </div>

        {settings.weeklySummaryEnabled && (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <span className="text-sm text-gray-600">요약 발송일</span>
            <select
              value={settings.weeklySummaryDay}
              onChange={(e) =>
                handleUpdate({ weeklySummaryDay: Number(e.target.value) })
              }
              disabled={isPending}
              className="ml-auto rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {DAYS_OF_WEEK.map((day) => (
                <option key={day.value} value={day.value}>
                  매주 {day.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 저장 상태 표시 */}
      {isPending && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>저장 중...</span>
        </div>
      )}
    </div>
  );
}
