"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getRangeRecommendationSettingsAction,
  updateRangeRecommendationSettingsAction,
  resetRangeRecommendationSettingsAction,
} from "@/app/(admin)/actions/recommendationSettings";
import type { RangeRecommendationConfig } from "@/lib/recommendations/config/types";
import { defaultRangeRecommendationConfig } from "@/lib/recommendations/config/defaultConfig";
import { Spinner } from "@/components/atoms/Spinner";
import Button from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Label } from "@/components/atoms/Label";

export function RangeRecommendationSettings() {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<RangeRecommendationConfig>(
    defaultRangeRecommendationConfig
  );

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await getRangeRecommendationSettingsAction();
        if (result.success && result.config) {
          setConfig(result.config);
        } else if (result.error) {
          showError(result.error);
        }
      } catch (error) {
        console.error("Failed to load range recommendation settings:", error);
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
      const result = await updateRangeRecommendationSettingsAction(config);

      if (result.success) {
        showSuccess("설정이 저장되었습니다.");
      } else {
        showError(result.error || "설정 저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("Failed to save range recommendation settings:", error);
      showError("설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("설정을 기본값으로 재설정하시겠습니까?")) {
      return;
    }

    setSaving(true);

    try {
      const result = await resetRangeRecommendationSettingsAction();

      if (result.success) {
        setConfig(defaultRangeRecommendationConfig);
        showSuccess("설정이 기본값으로 재설정되었습니다.");
      } else {
        showError(result.error || "설정 재설정에 실패했습니다.");
      }
    } catch (error) {
      console.error("Failed to reset range recommendation settings:", error);
      showError("설정 재설정 중 오류가 발생했습니다.");
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
      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h2 className="mb-4 text-h2 text-gray-900 dark:text-gray-100">
          범위 추천 설정
        </h2>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          학습 범위 추천 알고리즘의 파라미터를 조정합니다. 이 설정은 학습 범위
          추천 계산에 사용됩니다.
        </p>

        <div className="flex flex-col gap-6">
          <div>
            <Label
              htmlFor="pagesPerHour"
              className="block text-body-2-bold text-gray-800 dark:text-gray-200 mb-2"
            >
              교재: 시간당 페이지 수
            </Label>
            <Input
              id="pagesPerHour"
              type="number"
              min="1"
              max="100"
              step="0.1"
              value={config.pagesPerHour}
              onChange={(e) =>
                setConfig({
                  ...config,
                  pagesPerHour: parseFloat(e.target.value) || 10,
                })
              }
              className="w-full max-w-xs"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              1시간에 몇 페이지를 학습할 것으로 예상하는지 설정합니다. 현재
              값: {config.pagesPerHour}페이지/시간
            </p>
          </div>

          <div>
            <Label
              htmlFor="episodesPerHour"
              className="block text-body-2-bold text-gray-800 dark:text-gray-200 mb-2"
            >
              강의: 시간당 회차 수
            </Label>
            <Input
              id="episodesPerHour"
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={config.episodesPerHour}
              onChange={(e) =>
                setConfig({
                  ...config,
                  episodesPerHour: parseFloat(e.target.value) || 1,
                })
              }
              className="w-full max-w-xs"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              1시간에 몇 회차를 학습할 것으로 예상하는지 설정합니다. 현재 값:{" "}
              {config.episodesPerHour}회차/시간
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={saving}
        >
          기본값으로 재설정
        </Button>
      </div>
    </form>
  );
}

