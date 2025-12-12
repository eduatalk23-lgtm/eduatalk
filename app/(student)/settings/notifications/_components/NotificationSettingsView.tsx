"use client";

import { useState, useTransition } from "react";
import { updateNotificationSettings } from "../actions/notificationActions";
import { cn } from "@/lib/cn";

type NotificationSettings = {
  plan_start_enabled: boolean;
  plan_complete_enabled: boolean;
  daily_goal_achieved_enabled: boolean;
  weekly_report_enabled: boolean;
  plan_delay_enabled: boolean;
  plan_delay_threshold_minutes: number;
  notification_time_start: string;
  notification_time_end: string;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  attendance_check_in_enabled?: boolean | null;
  attendance_check_out_enabled?: boolean | null;
  attendance_absent_enabled?: boolean | null;
  attendance_late_enabled?: boolean | null;
};

type NotificationSettingsViewProps = {
  initialSettings: NotificationSettings;
};

export function NotificationSettingsView({
  initialSettings,
}: NotificationSettingsViewProps) {
  const [settings, setSettings] = useState<NotificationSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (key: keyof NotificationSettings) => {
    if (typeof settings[key] === "boolean" || settings[key] === null || settings[key] === undefined) {
      const currentValue = settings[key];
      const newValue = currentValue === true ? false : currentValue === false ? null : true;
      setSettings((prev) => ({ ...prev, [key]: newValue }));
      setSuccess(false);
      setError(null);
    }
  };

  const handleChange = (
    key: keyof NotificationSettings,
    value: string | number
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
    setError(null);
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const result = await updateNotificationSettings(settings);
        if (result.success) {
          setSuccess(true);
          setError(null);
          setTimeout(() => setSuccess(false), 3000);
        } else {
          setError(result.error || "저장에 실패했습니다.");
        }
      } catch (err: any) {
        setError(err.message || "저장 중 오류가 발생했습니다.");
      }
    });
  };

  const hasChanges =
    JSON.stringify(settings) !== JSON.stringify(initialSettings);

  return (
    <div className="space-y-6">
      {/* 저장 성공/에러 메시지 */}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          설정이 저장되었습니다.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* 알림 유형 설정 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900">알림 유형</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-gray-900">학습 시작 알림</div>
                <div className="text-sm text-gray-500">
                  플랜을 시작할 때 알림을 받습니다
                </div>
              </div>
            <button
              type="button"
              onClick={() => handleToggle("plan_start_enabled")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                settings.plan_start_enabled ? "bg-indigo-600" : "bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  settings.plan_start_enabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-gray-900">학습 완료 알림</div>
                <div className="text-sm text-gray-500">
                  플랜을 완료할 때 알림을 받습니다
                </div>
              </div>
            <button
              type="button"
              onClick={() => handleToggle("plan_complete_enabled")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                settings.plan_complete_enabled ? "bg-indigo-600" : "bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  settings.plan_complete_enabled
                    ? "translate-x-6"
                    : "translate-x-1"
                )}
              />
            </button>
          </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-gray-900">일일 목표 달성 알림</div>
                <div className="text-sm text-gray-500">
                  일일 학습 목표를 달성했을 때 알림을 받습니다
                </div>
              </div>
            <button
              type="button"
              onClick={() => handleToggle("daily_goal_achieved_enabled")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                settings.daily_goal_achieved_enabled
                  ? "bg-indigo-600"
                  : "bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  settings.daily_goal_achieved_enabled
                    ? "translate-x-6"
                    : "translate-x-1"
                )}
              />
            </button>
          </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-gray-900">주간 리포트 알림</div>
                <div className="text-sm text-gray-500">
                  주간 학습 리포트를 받습니다
                </div>
              </div>
            <button
              type="button"
              onClick={() => handleToggle("weekly_report_enabled")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                settings.weekly_report_enabled ? "bg-indigo-600" : "bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  settings.weekly_report_enabled
                    ? "translate-x-6"
                    : "translate-x-1"
                )}
              />
            </button>
          </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-gray-900">플랜 지연 알림</div>
                <div className="text-sm text-gray-500">
                  예정된 시간보다 늦게 시작할 때 알림을 받습니다
                </div>
              </div>
            <button
              type="button"
              onClick={() => handleToggle("plan_delay_enabled")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                settings.plan_delay_enabled ? "bg-indigo-600" : "bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  settings.plan_delay_enabled
                    ? "translate-x-6"
                    : "translate-x-1"
                )}
              />
            </button>
          </div>

            {settings.plan_delay_enabled && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">
                    지연 임계값 (분)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    step="5"
                    value={settings.plan_delay_threshold_minutes}
                    onChange={(e) =>
                      handleChange(
                        "plan_delay_threshold_minutes",
                        parseInt(e.target.value) || 30
                      )
                    }
                    className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <p className="text-xs text-gray-500">
                    예정 시간보다 이 시간만큼 늦으면 알림을 받습니다
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 알림 시간 설정 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900">알림 시간</h2>
          <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <label className="w-32 text-sm font-medium text-gray-700">
              알림 시작 시간
            </label>
            <input
              type="time"
              value={settings.notification_time_start}
              onChange={(e) =>
                handleChange("notification_time_start", e.target.value)
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <span className="text-sm text-gray-500">부터</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="w-32 text-sm font-medium text-gray-700">
              알림 종료 시간
            </label>
            <input
              type="time"
              value={settings.notification_time_end}
              onChange={(e) =>
                handleChange("notification_time_end", e.target.value)
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <span className="text-sm text-gray-500">까지</span>
          </div>
          </div>
        </div>
      </div>

      {/* 방해 금지 시간 설정 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">방해 금지 시간</h2>
          <button
            type="button"
            onClick={() => handleToggle("quiet_hours_enabled")}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
              settings.quiet_hours_enabled ? "bg-indigo-600" : "bg-gray-200"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                settings.quiet_hours_enabled
                  ? "translate-x-6"
                  : "translate-x-1"
              )}
            />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          방해 금지 시간 동안에는 알림을 받지 않습니다
        </p>

        {settings.quiet_hours_enabled && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="w-32 text-sm font-medium text-gray-700">
                시작 시간
              </label>
              <input
                type="time"
                value={settings.quiet_hours_start}
                onChange={(e) =>
                  handleChange("quiet_hours_start", e.target.value)
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="w-32 text-sm font-medium text-gray-700">
                종료 시간
              </label>
              <input
                type="time"
                value={settings.quiet_hours_end}
                onChange={(e) =>
                  handleChange("quiet_hours_end", e.target.value)
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            </div>
          )}
        </div>
      </div>

      {/* 출석 알림 설정 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900">출석 알림 설정</h2>
          <p className="text-sm text-gray-500">
            출석 관련 SMS 알림을 받을 항목을 선택하세요. 설정하지 않으면 학원 기본 설정을 따릅니다.
          </p>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-gray-900">입실 알림</div>
                <div className="text-sm text-gray-500">
                  입실 시 SMS 알림을 받습니다
                </div>
              </div>
            <button
              type="button"
              onClick={() => handleToggle("attendance_check_in_enabled")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                settings.attendance_check_in_enabled === true
                  ? "bg-indigo-600"
                  : settings.attendance_check_in_enabled === false
                  ? "bg-gray-200"
                  : "bg-gray-100"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  settings.attendance_check_in_enabled === true
                    ? "translate-x-6"
                    : "translate-x-1"
                )}
              />
            </button>
          </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-gray-900">퇴실 알림</div>
                <div className="text-sm text-gray-500">
                  퇴실 시 SMS 알림을 받습니다
                </div>
              </div>
            <button
              type="button"
              onClick={() => handleToggle("attendance_check_out_enabled")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                settings.attendance_check_out_enabled === true
                  ? "bg-indigo-600"
                  : settings.attendance_check_out_enabled === false
                  ? "bg-gray-200"
                  : "bg-gray-100"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  settings.attendance_check_out_enabled === true
                    ? "translate-x-6"
                    : "translate-x-1"
                )}
              />
            </button>
          </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-gray-900">결석 알림</div>
                <div className="text-sm text-gray-500">
                  결석 시 SMS 알림을 받습니다
                </div>
              </div>
            <button
              type="button"
              onClick={() => handleToggle("attendance_absent_enabled")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                settings.attendance_absent_enabled === true
                  ? "bg-indigo-600"
                  : settings.attendance_absent_enabled === false
                  ? "bg-gray-200"
                  : "bg-gray-100"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  settings.attendance_absent_enabled === true
                    ? "translate-x-6"
                    : "translate-x-1"
                )}
              />
            </button>
          </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-gray-900">지각 알림</div>
                <div className="text-sm text-gray-500">
                  지각 시 SMS 알림을 받습니다
                </div>
              </div>
            <button
              type="button"
              onClick={() => handleToggle("attendance_late_enabled")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                settings.attendance_late_enabled === true
                  ? "bg-indigo-600"
                  : settings.attendance_late_enabled === false
                  ? "bg-gray-200"
                  : "bg-gray-100"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  settings.attendance_late_enabled === true
                    ? "translate-x-6"
                    : "translate-x-1"
                )}
              />
            </button>
            </div>
          </div>
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
        {hasChanges && (
          <p className="flex-1 text-sm text-gray-500">
            변경사항이 있습니다. 저장하지 않으면 변경사항이 사라집니다.
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !hasChanges}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium text-white transition",
            isPending || !hasChanges
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
          )}
        >
          {isPending ? "저장 중..." : "저장하기"}
        </button>
      </div>
    </div>
  );
}

