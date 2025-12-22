"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStudentAttendanceSettings } from "@/lib/domains/attendance";
import { handleSupabaseError } from "@/lib/utils/errorHandling";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";
import Button from "@/components/atoms/Button";
import { cn } from "@/lib/cn";

type StudentAttendanceSettings = {
  attendance_check_in_enabled?: boolean | null;
  attendance_check_out_enabled?: boolean | null;
  attendance_absent_enabled?: boolean | null;
  attendance_late_enabled?: boolean | null;
};

type StudentAttendanceSettingsFormProps = {
  studentId: string;
  initialSettings?: StudentAttendanceSettings;
};

export function StudentAttendanceSettingsForm({
  studentId,
  initialSettings,
}: StudentAttendanceSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<StudentAttendanceSettings>({
    attendance_check_in_enabled: initialSettings?.attendance_check_in_enabled ?? null,
    attendance_check_out_enabled: initialSettings?.attendance_check_out_enabled ?? null,
    attendance_absent_enabled: initialSettings?.attendance_absent_enabled ?? null,
    attendance_late_enabled: initialSettings?.attendance_late_enabled ?? null,
  });
  
  const handleToggle = (key: keyof StudentAttendanceSettings) => {
    const currentValue = settings[key];
    const newValue = currentValue === true ? false : currentValue === false ? null : true;
    setSettings((prev) => ({ ...prev, [key]: newValue }));
    setSuccess(false);
    setError(null);
  };
  
  const handleSave = () => {
    startTransition(async () => {
      try {
        const result = await updateStudentAttendanceSettings(studentId, settings);
        if (result.success) {
          setSuccess(true);
          setError(null);
          setTimeout(() => {
            setSuccess(false);
            router.refresh();
          }, 2000);
        } else {
          setError(result.error || "저장에 실패했습니다.");
        }
      } catch (err: unknown) {
        const errorMessage = handleSupabaseError(err);
        setError(errorMessage || "저장 중 오류가 발생했습니다.");
      }
    });
  };
  
  const hasChanges =
    JSON.stringify(settings) !== JSON.stringify(initialSettings || {});
  
  const getToggleState = (value: boolean | null | undefined): "on" | "off" | "default" => {
    if (value === true) return "on";
    if (value === false) return "off";
    return "default";
  };
  
  const getToggleClass = (state: "on" | "off" | "default") => {
    switch (state) {
      case "on":
        return "bg-indigo-600";
      case "off":
        return "bg-gray-200";
      default:
        return "bg-gray-100";
    }
  };
  
  const getTogglePosition = (state: "on" | "off" | "default") => {
    switch (state) {
      case "on":
        return "translate-x-6";
      case "off":
      case "default":
        return "translate-x-1";
    }
  };
  
  return (
    <Card>
      <CardHeader title="출석 알림 설정" />
      <CardContent>
        <div className="space-y-6">
          {/* 저장 성공/에러 메시지 */}
          {success && (
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-800 dark:text-green-200">
              설정이 저장되었습니다.
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}
          
          <p className="text-sm text-gray-600 dark:text-gray-400">
            학생별 출석 SMS 알림을 설정할 수 있습니다. 설정하지 않으면 학원 기본 설정을 따릅니다.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-gray-900 dark:text-gray-100">입실 알림</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  입실 시 SMS 알림을 받습니다
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle("attendance_check_in_enabled")}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                  getToggleClass(getToggleState(settings.attendance_check_in_enabled))
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    getTogglePosition(getToggleState(settings.attendance_check_in_enabled))
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-gray-900 dark:text-gray-100">퇴실 알림</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  퇴실 시 SMS 알림을 받습니다
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle("attendance_check_out_enabled")}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                  getToggleClass(getToggleState(settings.attendance_check_out_enabled))
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    getTogglePosition(getToggleState(settings.attendance_check_out_enabled))
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-gray-900 dark:text-gray-100">결석 알림</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  결석 시 SMS 알림을 받습니다
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle("attendance_absent_enabled")}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                  getToggleClass(getToggleState(settings.attendance_absent_enabled))
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    getTogglePosition(getToggleState(settings.attendance_absent_enabled))
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-gray-900 dark:text-gray-100">지각 알림</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  지각 시 SMS 알림을 받습니다
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle("attendance_late_enabled")}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                  getToggleClass(getToggleState(settings.attendance_late_enabled))
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    getTogglePosition(getToggleState(settings.attendance_late_enabled))
                  )}
                />
              </button>
            </div>
          </div>
          
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>설정 상태:</strong>
              </p>
              <ul className="flex flex-col gap-1 text-sm text-blue-700 dark:text-blue-300">
                <li>• 켜짐 (파란색): 항상 알림을 받습니다</li>
                <li>• 꺼짐 (회색): 알림을 받지 않습니다</li>
                <li>• 기본값 (연한 회색): 학원 기본 설정을 따릅니다</li>
              </ul>
            </div>
          </div>
          
          {/* 저장 버튼 */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-6">
            {hasChanges && (
              <p className="flex-1 text-sm text-gray-500 dark:text-gray-400">
                변경사항이 있습니다. 저장하지 않으면 변경사항이 사라집니다.
              </p>
            )}
            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending || !hasChanges}
              isLoading={isPending}
            >
              {isPending ? "저장 중..." : "저장하기"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

