"use client";

import { useState, useEffect } from "react";
import { updateStudentAttendanceNotificationSettings } from "@/app/(parent)/actions/parentSettingsActions";
import { cn } from "@/lib/cn";
import { useServerAction } from "@/lib/hooks/useServerAction";

type StudentAttendanceNotificationSettingsProps = {
  studentId: string;
  studentName: string;
  initialSettings: {
    attendance_check_in_enabled: boolean | null;
    attendance_check_out_enabled: boolean | null;
    attendance_absent_enabled: boolean | null;
    attendance_late_enabled: boolean | null;
  };
};

export function StudentAttendanceNotificationSettings({
  studentId,
  studentName,
  initialSettings,
}: StudentAttendanceNotificationSettingsProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [success, setSuccess] = useState(false);

  const { execute: executeSave, isPending: saving, error, isSuccess } = useServerAction(
    updateStudentAttendanceNotificationSettings,
    {
      onSuccess: () => {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      },
      onError: () => {
        setSuccess(false);
      },
    }
  );

  const handleToggle = (key: keyof typeof settings) => {
    // null -> true -> false -> null 순환
    const currentValue = settings[key];
    if (currentValue === null || currentValue === undefined) {
      setSettings((prev) => ({ ...prev, [key]: true }));
    } else if (currentValue === true) {
      setSettings((prev) => ({ ...prev, [key]: false }));
    } else {
      setSettings((prev) => ({ ...prev, [key]: null }));
    }
    setSuccess(false);
  };

  const handleSave = () => {
    setSuccess(false);
    executeSave(studentId, settings);
  };

  const hasChanges =
    JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const getToggleLabel = (value: boolean | null | undefined) => {
    if (value === null || value === undefined) return "기본값";
    return value ? "ON" : "OFF";
  };

  const getToggleColor = (value: boolean | null | undefined) => {
    if (value === true) return "bg-indigo-600";
    if (value === false) return "bg-gray-400";
    return "bg-gray-200";
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-gray-900">{studentName}</h3>
          <p className="text-xs text-gray-500">
            출석 관련 SMS 알림을 받을 항목을 설정합니다. 기본값이면 학원 기본 설정을 따릅니다.
          </p>
        </div>
      </div>

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          설정이 저장되었습니다.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">입실 알림</div>
            <div className="text-xs text-gray-500">
              입실 시 SMS 발송 여부
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {getToggleLabel(settings.attendance_check_in_enabled)}
            </span>
            <button
              type="button"
              onClick={() => handleToggle("attendance_check_in_enabled")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                getToggleColor(settings.attendance_check_in_enabled)
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
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">퇴실 알림</div>
            <div className="text-xs text-gray-500">
              퇴실 시 SMS 발송 여부
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {getToggleLabel(settings.attendance_check_out_enabled)}
            </span>
            <button
              type="button"
              onClick={() => handleToggle("attendance_check_out_enabled")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                getToggleColor(settings.attendance_check_out_enabled)
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
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">결석 알림</div>
            <div className="text-xs text-gray-500">
              결석 시 SMS 발송 여부
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {getToggleLabel(settings.attendance_absent_enabled)}
            </span>
            <button
              type="button"
              onClick={() => handleToggle("attendance_absent_enabled")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                getToggleColor(settings.attendance_absent_enabled)
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
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">지각 알림</div>
            <div className="text-xs text-gray-500">
              지각 시 SMS 발송 여부
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {getToggleLabel(settings.attendance_late_enabled)}
            </span>
            <button
              type="button"
              onClick={() => handleToggle("attendance_late_enabled")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                getToggleColor(settings.attendance_late_enabled)
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

      {hasChanges && (
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => setSettings(initialSettings)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium text-white transition",
              saving
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      )}
    </div>
  );
}

