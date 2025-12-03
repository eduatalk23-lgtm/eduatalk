"use client";

import { useState, useEffect } from "react";
import {
  getCurriculumSettings,
  updateCurriculumSettings,
  type CurriculumSettingsData,
} from "@/app/(superadmin)/actions/curriculumSettingsActions";

export function CurriculumSettingsForm() {
  const [settings, setSettings] = useState<CurriculumSettingsData>({
    middle_2022: 2025,
    high_2022: 2025,
    middle_2015: 2018,
    high_2015: 2018,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 설정 로드
  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getCurriculumSettings();
        if (result.success && result.data) {
          setSettings(result.data);
        } else {
          setError(result.error || "설정을 불러오는데 실패했습니다.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "설정을 불러오는데 실패했습니다.");
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await updateCurriculumSettings(formData);

      if (result.success) {
        setSuccess(true);
        // 성공 메시지 3초 후 자동 제거
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "설정 저장에 실패했습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "설정 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div className="text-center text-gray-600 dark:text-gray-400">설정을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 text-green-800 dark:text-green-200">
          설정이 성공적으로 저장되었습니다.
        </div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">2022개정 교육과정</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="middle_2022" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              중학교 시작년도
            </label>
            <input
              type="number"
              id="middle_2022"
              name="middle_2022"
              value={settings.middle_2022}
              onChange={(e) =>
                setSettings({ ...settings, middle_2022: parseInt(e.target.value, 10) || 2025 })
              }
              min="2000"
              max="2100"
              required
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>
          <div>
            <label htmlFor="high_2022" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              고등학교 시작년도
            </label>
            <input
              type="number"
              id="high_2022"
              name="high_2022"
              value={settings.high_2022}
              onChange={(e) =>
                setSettings({ ...settings, high_2022: parseInt(e.target.value, 10) || 2025 })
              }
              min="2000"
              max="2100"
              required
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">2015개정 교육과정</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="middle_2015" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              중학교 시작년도
            </label>
            <input
              type="number"
              id="middle_2015"
              name="middle_2015"
              value={settings.middle_2015}
              onChange={(e) =>
                setSettings({ ...settings, middle_2015: parseInt(e.target.value, 10) || 2018 })
              }
              min="2000"
              max="2100"
              required
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>
          <div>
            <label htmlFor="high_2015" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              고등학교 시작년도
            </label>
            <input
              type="number"
              id="high_2015"
              name="high_2015"
              value={settings.high_2015}
              onChange={(e) =>
                setSettings({ ...settings, high_2015: parseInt(e.target.value, 10) || 2018 })
              }
              min="2000"
              max="2100"
              required
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-blue-600 dark:bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}

