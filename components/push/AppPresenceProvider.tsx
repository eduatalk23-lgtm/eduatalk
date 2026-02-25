"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAppPresence } from "@/lib/realtime/useAppPresence";

/**
 * 사용자 Presence를 추적하는 레이아웃 래퍼.
 * UI 렌더링 없음. 레이아웃에 한 번만 마운트.
 */
export function AppPresenceProvider() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useAppPresence(userId);

  return null;
}
