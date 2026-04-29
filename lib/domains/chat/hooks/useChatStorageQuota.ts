"use client";

/**
 * useChatStorageQuota — 채팅 첨부 스토리지 쿼터 조회 + 캐시
 *
 * - 마운트 시 1회 조회
 * - 외부에서 refresh() 호출 가능 (업로드 완료 후 트리거)
 * - 60초 throttle (연속 호출 시 서버 부하 방지)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getChatStorageQuotaAction } from "@/lib/domains/chat/actions";
import type { StorageQuotaInfo } from "@/lib/domains/chat/quota";

const REFRESH_THROTTLE_MS = 60_000;

export interface UseChatStorageQuotaReturn {
  quota: StorageQuotaInfo | null;
  isLoading: boolean;
  refresh: () => void;
}

export function useChatStorageQuota(): UseChatStorageQuotaReturn {
  const [quota, setQuota] = useState<StorageQuotaInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastFetchedAtRef = useRef<number>(0);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (inFlightRef.current) return;
    if (now - lastFetchedAtRef.current < REFRESH_THROTTLE_MS) return;

    inFlightRef.current = true;
    setIsLoading(true);
    try {
      const result = await getChatStorageQuotaAction();
      if (result.success && result.data) {
        setQuota(result.data);
        lastFetchedAtRef.current = Date.now();
      }
    } catch {
      // 비치명적 — 다음 호출 시 재시도
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { quota, isLoading, refresh };
}
