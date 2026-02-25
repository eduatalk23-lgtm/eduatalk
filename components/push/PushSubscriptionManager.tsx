"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePushSubscription } from "@/lib/domains/push/hooks/usePushSubscription";

/**
 * 로그인 사용자의 Push 구독을 자동 관리하는 래퍼.
 * UI를 렌더링하지 않음. 레이아웃에 한 번만 마운트.
 */
export function PushSubscriptionManager() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    // 초기 userId 조회
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
    // 로그인/로그아웃 시 userId 갱신
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  usePushSubscription(userId);

  return null;
}
