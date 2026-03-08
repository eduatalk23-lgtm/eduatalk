"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { updateNotificationSettings } from "../actions/notificationActions";
import { cn } from "@/lib/cn";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  getFormLabelClasses,
  getFormInputClasses,
  textPrimaryVar,
} from "@/lib/utils/darkMode";
import {
  getPushDevices,
  deletePushDevice,
  type PushDevice,
} from "@/lib/domains/push/actions/subscription";
import { usePushSubscription } from "@/lib/domains/push/hooks/usePushSubscription";

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
  // Push 카테고리
  chat_push_enabled: boolean;
  chat_group_push_enabled: boolean;
  study_reminder_push_enabled: boolean;
  plan_update_push_enabled: boolean;
  achievement_push_enabled: boolean;
  event_reminder_push_enabled: boolean;
  // 채팅 부가 설정
  chat_sound_enabled: boolean;
  chat_vibrate_enabled: boolean;
  chat_read_receipt_enabled: boolean;
};

type NotificationSettingsViewProps = {
  initialSettings: NotificationSettings;
  userId?: string;
};

// Push 카테고리 토글 항목 정의
const PUSH_CATEGORIES: {
  key: keyof NotificationSettings;
  label: string;
  description: string;
  group: string;
}[] = [
  {
    key: "chat_push_enabled",
    label: "1:1 채팅 메시지",
    description: "새 채팅 메시지를 받을 때 푸시 알림",
    group: "채팅",
  },
  {
    key: "chat_group_push_enabled",
    label: "그룹 채팅 메시지",
    description: "그룹 채팅의 새 메시지 푸시 알림",
    group: "채팅",
  },
  {
    key: "study_reminder_push_enabled",
    label: "학습 리마인더",
    description: "학습 시작 시간에 맞춰 리마인더 발송",
    group: "학습",
  },
  {
    key: "plan_update_push_enabled",
    label: "플랜 변경 알림",
    description: "플랜이 추가/변경되었을 때 알림",
    group: "학습",
  },
  {
    key: "achievement_push_enabled",
    label: "달성 알림",
    description: "학습 목표 달성 시 축하 알림",
    group: "학습",
  },
  {
    key: "event_reminder_push_enabled",
    label: "일정 리마인더",
    description: "캘린더 일정 시작 전 리마인더",
    group: "일정",
  },
  {
    key: "chat_sound_enabled",
    label: "채팅 알림음",
    description: "새 메시지를 받을 때 알림음을 재생합니다",
    group: "채팅 설정",
  },
  {
    key: "chat_vibrate_enabled",
    label: "채팅 진동",
    description: "새 메시지를 받을 때 진동으로 알립니다 (모바일)",
    group: "채팅 설정",
  },
  {
    key: "chat_read_receipt_enabled",
    label: "읽음 확인",
    description: "메시지 읽음 상태를 상대방에게 전송합니다",
    group: "채팅 설정",
  },
];

export function NotificationSettingsView({
  initialSettings,
  userId,
}: NotificationSettingsViewProps) {
  const [settings, setSettings] =
    useState<NotificationSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Push 구독 훅
  const { requestSubscription } = usePushSubscription(userId ?? null);

  // Push 디바이스 목록
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [pushPermission, setPushPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true);
    const result = await getPushDevices();
    if (result.success) {
      setDevices(result.devices);
    }
    setDevicesLoading(false);
  }, []);

  useEffect(() => {
    loadDevices();
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushPermission(Notification.permission);
    } else {
      setPushPermission("unsupported");
    }
  }, [loadDevices]);

  // 3-state 토글 (출석 알림 등 nullable 필드용)
  const handleToggle = (key: keyof NotificationSettings) => {
    if (
      typeof settings[key] === "boolean" ||
      settings[key] === null ||
      settings[key] === undefined
    ) {
      const currentValue = settings[key];
      const newValue =
        currentValue === true ? false : currentValue === false ? null : true;
      setSettings((prev) => ({ ...prev, [key]: newValue }));
      setSuccess(false);
      setError(null);
    }
  };

  // 2-state 토글 (Push 카테고리 등 boolean 필드용)
  const handleBinaryToggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setSuccess(false);
    setError(null);
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
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "저장 중 오류가 발생했습니다."
        );
      }
    });
  };

  const handleEnablePush = async () => {
    const granted = await requestSubscription();
    if (granted) {
      setPushPermission("granted");
      // 잠시 대기 후 디바이스 목록 새로고침
      setTimeout(loadDevices, 1000);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    const confirmed = window.confirm(
      "이 디바이스의 푸시 알림 구독을 해제하시겠습니까?"
    );
    if (!confirmed) return;

    const result = await deletePushDevice(deviceId);
    if (result.success) {
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    }
  };

  const hasChanges =
    JSON.stringify(settings) !== JSON.stringify(initialSettings);

  // 그룹별 Push 카테고리 렌더링
  const pushGroups = PUSH_CATEGORIES.reduce(
    (acc, cat) => {
      if (!acc[cat.group]) acc[cat.group] = [];
      acc[cat.group].push(cat);
      return acc;
    },
    {} as Record<string, typeof PUSH_CATEGORIES>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* 저장 성공/에러 메시지 */}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          설정이 저장되었습니다.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* 푸시 알림 설정 */}
      <SectionCard
        title="푸시 알림"
        description="앱을 사용하지 않을 때에도 중요한 알림을 받을 수 있습니다"
      >
        <div className="flex flex-col gap-5">
          {/* Push 권한 상태 */}
          {pushPermission !== "granted" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className={cn("text-sm font-medium", textPrimaryVar)}>
                    {pushPermission === "unsupported"
                      ? "이 브라우저에서는 푸시 알림을 지원하지 않습니다"
                      : pushPermission === "denied"
                        ? "푸시 알림이 차단되어 있습니다. 브라우저 설정에서 허용해주세요."
                        : "푸시 알림을 활성화하면 앱을 닫아도 알림을 받을 수 있습니다"}
                  </div>
                </div>
                {pushPermission === "default" && (
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
                  >
                    알림 허용
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 카테고리별 토글 */}
          {Object.entries(pushGroups).map(([group, categories]) => (
            <div key={group} className="flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {group}
              </div>
              {categories.map((cat) => (
                <div
                  key={cat.key}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className={cn("font-medium", textPrimaryVar)}>
                      {cat.label}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {cat.description}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings[cat.key] as boolean}
                    onChange={() => handleBinaryToggle(cat.key)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 등록된 디바이스 */}
      <SectionCard
        title="등록된 디바이스"
        description="푸시 알림을 수신하는 디바이스 목록"
      >
        <div className="flex flex-col gap-3">
          {devicesLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              로딩 중...
            </div>
          ) : devices.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              등록된 디바이스가 없습니다.
              {pushPermission === "default" &&
                " 위에서 알림을 허용하면 이 기기가 등록됩니다."}
            </div>
          ) : (
            devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30"
              >
                <div className="flex flex-col gap-0.5">
                  <div className={cn("text-sm font-medium", textPrimaryVar)}>
                    {device.device_label ?? "알 수 없는 기기"}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    등록:{" "}
                    {new Date(device.created_at).toLocaleDateString("ko-KR")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteDevice(device.id)}
                  className="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition"
                >
                  삭제
                </button>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      {/* 알림 유형 설정 */}
      <SectionCard title="알림 유형">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className={cn("font-medium", textPrimaryVar)}>
                학습 시작 알림
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                플랜을 시작할 때 알림을 받습니다
              </div>
            </div>
            <ToggleSwitch
              checked={settings.plan_start_enabled}
              onChange={() => handleBinaryToggle("plan_start_enabled")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className={cn("font-medium", textPrimaryVar)}>
                학습 완료 알림
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                플랜을 완료할 때 알림을 받습니다
              </div>
            </div>
            <ToggleSwitch
              checked={settings.plan_complete_enabled}
              onChange={() => handleBinaryToggle("plan_complete_enabled")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className={cn("font-medium", textPrimaryVar)}>
                일일 목표 달성 알림
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                일일 학습 목표를 달성했을 때 알림을 받습니다
              </div>
            </div>
            <ToggleSwitch
              checked={settings.daily_goal_achieved_enabled}
              onChange={() => handleBinaryToggle("daily_goal_achieved_enabled")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className={cn("font-medium", textPrimaryVar)}>
                주간 리포트 알림
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                주간 학습 리포트를 받습니다
              </div>
            </div>
            <ToggleSwitch
              checked={settings.weekly_report_enabled}
              onChange={() => handleBinaryToggle("weekly_report_enabled")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className={cn("font-medium", textPrimaryVar)}>
                플랜 지연 알림
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                예정된 시간보다 늦게 시작할 때 알림을 받습니다
              </div>
            </div>
            <ToggleSwitch
              checked={settings.plan_delay_enabled}
              onChange={() => handleBinaryToggle("plan_delay_enabled")}
            />
          </div>

          {settings.plan_delay_enabled && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4">
              <div className="flex flex-col gap-2">
                <label className={getFormLabelClasses()}>
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
                  className={cn(
                    getFormInputClasses(false, false, false),
                    "w-32"
                  )}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  예정 시간보다 이 시간만큼 늦으면 알림을 받습니다
                </p>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* 알림 시간 설정 */}
      <SectionCard title="알림 시간">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <label className={cn("w-32", getFormLabelClasses())}>
              알림 시작 시간
            </label>
            <input
              type="time"
              value={settings.notification_time_start}
              onChange={(e) =>
                handleChange("notification_time_start", e.target.value)
              }
              className={cn(
                getFormInputClasses(false, false, false),
                "text-sm"
              )}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              부터
            </span>
          </div>

          <div className="flex items-center gap-4">
            <label className={cn("w-32", getFormLabelClasses())}>
              알림 종료 시간
            </label>
            <input
              type="time"
              value={settings.notification_time_end}
              onChange={(e) =>
                handleChange("notification_time_end", e.target.value)
              }
              className={cn(
                getFormInputClasses(false, false, false),
                "text-sm"
              )}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              까지
            </span>
          </div>
        </div>
      </SectionCard>

      {/* 방해 금지 시간 설정 */}
      <SectionCard
        title="방해 금지 시간"
        headerAction={
          <ToggleSwitch
            checked={settings.quiet_hours_enabled}
            onChange={() => handleBinaryToggle("quiet_hours_enabled")}
          />
        }
        description="방해 금지 시간 동안에는 알림을 받지 않습니다"
      >
        {settings.quiet_hours_enabled && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <label className={cn("w-32", getFormLabelClasses())}>
                시작 시간
              </label>
              <input
                type="time"
                value={settings.quiet_hours_start}
                onChange={(e) =>
                  handleChange("quiet_hours_start", e.target.value)
                }
                className={cn(
                  getFormInputClasses(false, false, false),
                  "text-sm"
                )}
              />
            </div>

            <div className="flex items-center gap-4">
              <label className={cn("w-32", getFormLabelClasses())}>
                종료 시간
              </label>
              <input
                type="time"
                value={settings.quiet_hours_end}
                onChange={(e) =>
                  handleChange("quiet_hours_end", e.target.value)
                }
                className={cn(
                  getFormInputClasses(false, false, false),
                  "text-sm"
                )}
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* 출석 알림 설정 */}
      <SectionCard
        title="출석 알림 설정"
        description="출석 관련 SMS 알림을 받을 항목을 선택하세요. 설정하지 않으면 학원 기본 설정을 따릅니다."
      >
        <div className="flex flex-col gap-4">
          <AttendanceToggleRow
            label="입실 알림"
            description="입실 시 SMS 알림을 받습니다"
            value={settings.attendance_check_in_enabled}
            onChange={() => handleToggle("attendance_check_in_enabled")}
          />
          <AttendanceToggleRow
            label="퇴실 알림"
            description="퇴실 시 SMS 알림을 받습니다"
            value={settings.attendance_check_out_enabled}
            onChange={() => handleToggle("attendance_check_out_enabled")}
          />
          <AttendanceToggleRow
            label="결석 알림"
            description="결석 시 SMS 알림을 받습니다"
            value={settings.attendance_absent_enabled}
            onChange={() => handleToggle("attendance_absent_enabled")}
          />
          <AttendanceToggleRow
            label="지각 알림"
            description="지각 시 SMS 알림을 받습니다"
            value={settings.attendance_late_enabled}
            onChange={() => handleToggle("attendance_late_enabled")}
          />
        </div>
      </SectionCard>

      {/* 저장 버튼 */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-6">
        {hasChanges && (
          <p className="flex-1 text-sm text-gray-500 dark:text-gray-400">
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

// ============================================
// 재사용 컴포넌트
// ============================================

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
        checked ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

function AttendanceToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean | null | undefined;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <div className={cn("font-medium", textPrimaryVar)}>{label}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {description}
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
          value === true
            ? "bg-indigo-600"
            : value === false
              ? "bg-gray-200 dark:bg-gray-700"
              : "bg-gray-100 dark:bg-gray-800"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            value === true ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}
