"use client";

import { useState, useEffect } from "react";
import type { DifficultyLevel } from "@/lib/data/difficultyLevels";

type UseDifficultyOptionsOptions = {
  contentType: "book" | "lecture" | "custom";
};

/**
 * 콘텐츠 타입별 난이도 옵션 조회 훅
 * API 엔드포인트: /api/difficulty-levels?contentType=book
 */
export function useDifficultyOptions({ contentType }: UseDifficultyOptionsOptions) {
  const [options, setOptions] = useState<DifficultyLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchOptions() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/difficulty-levels?contentType=${contentType}`
        );

        if (!response.ok) {
          throw new Error(`난이도 조회 실패: ${response.statusText}`);
        }

        const data = await response.json();
        setOptions(data);
      } catch (err) {
        console.error("[useDifficultyOptions] 난이도 조회 실패:", err);
        setError(err instanceof Error ? err : new Error("난이도를 불러오는데 실패했습니다."));
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }

    fetchOptions();
  }, [contentType]);

  return {
    options,
    loading,
    error,
  };
}

