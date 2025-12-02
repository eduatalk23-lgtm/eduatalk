"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getTenantSchedulerSettingsAction,
  saveTenantSchedulerSettingsAction,
} from "@/app/(admin)/actions/schedulerSettings";
import type { TenantSchedulerSettings } from "@/lib/types/schedulerSettings";
import { Spinner } from "@/components/atoms/Spinner";

export function SchedulerSettingsForm() {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<
    Partial<TenantSchedulerSettings>
  >({
    default_study_days: 6,
    default_review_days: 1,
    default_weak_subject_focus: "medium",
    default_review_scope: "full",
    default_lunch_time: { start: "12:00", end: "13:00" },
    default_study_hours: { start: "09:00", end: "18:00" },
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getTenantSchedulerSettingsAction();
        if (data) {
          setSettings(data);
        }
      } catch (error) {
        console.error("Failed to load scheduler settings:", error);
        showError("설정을 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [showError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const result = await saveTenantSchedulerSettingsAction({
        default_study_days: settings.default_study_days,
        default_review_days: settings.default_review_days,
        default_weak_subject_focus: settings.default_weak_subject_focus,
        default_review_scope: settings.default_review_scope,
        default_lunch_time: settings.default_lunch_time,
        default_study_hours: settings.default_study_hours,
        default_self_study_hours: settings.default_self_study_hours,
      });

      if (result.success) {
        showSuccess("설정이 저장되었습니다.");
      } else {
        showError(result.error || "설정 저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("Failed to save scheduler settings:", error);
      showError("설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* 학습일/복습일 비율 */}
      <div className="rounded-xl border border-gray-30 bg-white p-6">
        <h2 className="text-h2 text-gray-100 mb-4">학습일/복습일 비율</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-body-2-bold text-gray-90 mb-2">
              주당 학습일 수
            </label>
            <input
              type="number"
              min="1"
              max="7"
              value={settings.default_study_days}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_study_days: parseInt(e.target.value, 10),
                })
              }
              className="w-full rounded-lg border border-gray-30 px-4 py-2 text-body-2 text-gray-100"
            />
            <p className="mt-1 text-sm text-gray-60">
              1-7일 사이의 값을 입력하세요.
            </p>
          </div>

          <div>
            <label className="block text-body-2-bold text-gray-90 mb-2">
              주당 복습일 수
            </label>
            <input
              type="number"
              min="0"
              max="7"
              value={settings.default_review_days}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_review_days: parseInt(e.target.value, 10),
                })
              }
              className="w-full rounded-lg border border-gray-30 px-4 py-2 text-body-2 text-gray-100"
            />
            <p className="mt-1 text-sm text-gray-60">
              0-7일 사이의 값을 입력하세요.
            </p>
          </div>
        </div>
      </div>

      {/* 기타 옵션 */}
      <div className="rounded-xl border border-gray-30 bg-white p-6">
        <h2 className="text-h2 text-gray-100 mb-4">기타 옵션</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-body-2-bold text-gray-90 mb-2">
              취약과목 집중 모드
            </label>
            <select
              value={settings.default_weak_subject_focus}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_weak_subject_focus: e.target.value as
                    | "low"
                    | "medium"
                    | "high",
                })
              }
              className="w-full rounded-lg border border-gray-30 px-4 py-2 text-body-2 text-gray-100"
            >
              <option value="low">낮음</option>
              <option value="medium">중간</option>
              <option value="high">높음</option>
            </select>
          </div>

          <div>
            <label className="block text-body-2-bold text-gray-90 mb-2">
              복습 범위
            </label>
            <select
              value={settings.default_review_scope}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_review_scope: e.target.value as "full" | "partial",
                })
              }
              className="w-full rounded-lg border border-gray-30 px-4 py-2 text-body-2 text-gray-100"
            >
              <option value="full">전체 복습</option>
              <option value="partial">축소 복습</option>
            </select>
          </div>
        </div>
      </div>

      {/* 시간 설정 */}
      <div className="rounded-xl border border-gray-30 bg-white p-6">
        <h2 className="text-h2 text-gray-100 mb-4">시간 설정</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-body-2-bold text-gray-90 mb-2">
              점심시간
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="time"
                value={settings.default_lunch_time?.start || "12:00"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    default_lunch_time: {
                      ...settings.default_lunch_time!,
                      start: e.target.value,
                    },
                  })
                }
                className="flex-1 rounded-lg border border-gray-30 px-4 py-2 text-body-2 text-gray-100"
              />
              <span className="text-gray-60">~</span>
              <input
                type="time"
                value={settings.default_lunch_time?.end || "13:00"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    default_lunch_time: {
                      ...settings.default_lunch_time!,
                      end: e.target.value,
                    },
                  })
                }
                className="flex-1 rounded-lg border border-gray-30 px-4 py-2 text-body-2 text-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-body-2-bold text-gray-90 mb-2">
              학습시간
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="time"
                value={settings.default_study_hours?.start || "09:00"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    default_study_hours: {
                      ...settings.default_study_hours!,
                      start: e.target.value,
                    },
                  })
                }
                className="flex-1 rounded-lg border border-gray-30 px-4 py-2 text-body-2 text-gray-100"
              />
              <span className="text-gray-60">~</span>
              <input
                type="time"
                value={settings.default_study_hours?.end || "18:00"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    default_study_hours: {
                      ...settings.default_study_hours!,
                      end: e.target.value,
                    },
                  })
                }
                className="flex-1 rounded-lg border border-gray-30 px-4 py-2 text-body-2 text-gray-100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-gray-900 px-6 py-3 text-body-2-bold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {saving ? "저장 중..." : "설정 저장"}
        </button>
      </div>
    </form>
  );
}

