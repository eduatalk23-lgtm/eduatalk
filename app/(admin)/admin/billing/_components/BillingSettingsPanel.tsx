"use client";

import { useState, useEffect, useTransition } from "react";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderDefault,
} from "@/lib/utils/darkMode";
import Button from "@/components/atoms/Button";
import ToggleSwitch from "@/components/atoms/ToggleSwitch";
import {
  getBillingSettingsAction,
  updateBillingSettingsAction,
} from "@/lib/domains/payment/actions/billing";

type BillingSettings = {
  billing_day: number;
  auto_billing_enabled: boolean;
  due_day_offset: number;
};

export function BillingSettingsPanel() {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<BillingSettings>({
    billing_day: 25,
    auto_billing_enabled: false,
    due_day_offset: 7,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const result = await getBillingSettingsAction();
      if (result.success && result.data) {
        setSettings(result.data);
      }
    });
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateBillingSettingsAction(settings);
      if (result.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <div className={cn("rounded-lg border", borderDefault, bgSurface)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between px-4 py-3",
          textPrimary
        )}
      >
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-sm font-medium">자동 청구 설정</span>
        </div>
        <svg
          className={cn(
            "h-4 w-4 transition-transform",
            isOpen && "rotate-180"
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className={cn("border-t px-4 pb-4 pt-3", borderDefault)}>
          <div className="flex flex-col gap-5">
            {/* 자동 청구 ON/OFF */}
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-sm font-medium", textPrimary)}>
                  자동 청구
                </p>
                <p className={cn("text-xs", textSecondary)}>
                  매월 청구일에 활성 수강에 대해 자동으로 청구서를 생성합니다
                </p>
              </div>
              <ToggleSwitch
                checked={settings.auto_billing_enabled}
                onCheckedChange={(checked) =>
                  setSettings((s) => ({ ...s, auto_billing_enabled: checked }))
                }
              />
            </div>

            {/* 청구일 */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={cn("text-sm font-medium", textPrimary)}>
                  매월 청구일
                </p>
                <p className={cn("text-xs", textSecondary)}>
                  매월 이 날짜에 청구서가 생성됩니다
                </p>
              </div>
              <select
                value={settings.billing_day}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    billing_day: Number(e.target.value),
                  }))
                }
                className={cn(
                  "w-24 rounded-lg border px-3 py-1.5 text-sm",
                  borderDefault,
                  bgSurface,
                  textPrimary
                )}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}일
                  </option>
                ))}
              </select>
            </div>

            {/* 납부기한 */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={cn("text-sm font-medium", textPrimary)}>
                  납부 기한
                </p>
                <p className={cn("text-xs", textSecondary)}>
                  청구일로부터 납부 마감까지의 일수
                </p>
              </div>
              <select
                value={settings.due_day_offset}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    due_day_offset: Number(e.target.value),
                  }))
                }
                className={cn(
                  "w-24 rounded-lg border px-3 py-1.5 text-sm",
                  borderDefault,
                  bgSurface,
                  textPrimary
                )}
              >
                {[3, 5, 7, 10, 14, 21, 30].map((days) => (
                  <option key={days} value={days}>
                    {days}일
                  </option>
                ))}
              </select>
            </div>

            {/* 저장 버튼 */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending ? "저장 중..." : "설정 저장"}
              </Button>
              {saved && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  저장되었습니다
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
