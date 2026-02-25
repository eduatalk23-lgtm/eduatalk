# 통합 알림 시스템 (Unified Notification Service) 구현 가이드

> **목표**: 7개의 분산된 알림 경로를 3개로 통폐합하고, PWA Push 알림을 추가하여 앱이 닫혀있어도 알림을 전달할 수 있는 업계 표준 시스템 구축
>
> **작성일**: 2026-02-24
> **상태**: 구현 대기

---

## 목차

1. [현재 상태 진단](#1-현재-상태-진단)
2. [목표 아키텍처](#2-목표-아키텍처)
3. [Phase 0: 기반 정비](#phase-0-기반-정비)
4. [Phase 1: Push 구독 파이프라인](#phase-1-push-구독-파이프라인)
5. [Phase 2: Notification Router](#phase-2-notification-router)
6. [Phase 3: 기존 경로 통폐합](#phase-3-기존-경로-통폐합)
7. [Phase 4: Presence 기반 지능형 라우팅](#phase-4-presence-기반-지능형-라우팅)
8. [Phase 5: 알림 설정 UI 확장](#phase-5-알림-설정-ui-확장)
9. [Phase 6: iOS 대응 및 안정화](#phase-6-ios-대응-및-안정화)
10. [롤백 및 사이드이펙트 방지](#롤백-및-사이드이펙트-방지)
11. [검증 체크리스트](#검증-체크리스트)

---

## 1. 현재 상태 진단

### 1.1 분산된 7개 알림 경로

| # | 경로 | 파일 | 역할 | 문제점 |
|---|------|------|------|--------|
| 1 | `useNotificationRealtime` | `lib/realtime/useNotificationRealtime.ts` | DB 알림 → Browser Notification API | 앱 열려있을 때만 작동 |
| 2 | `useEventReminders` | `lib/domains/calendar/reminders.ts` | setTimeout → Browser Notification API | 페이지 닫으면 타이머 소멸 |
| 3 | SSE Polling | `app/api/notifications/stream/route.ts` | 30초 폴링으로 미읽음 알림 조회 | Realtime과 중복, 서버 부하 |
| 4 | `ToastProvider` | `components/ui/ToastProvider.tsx` | 인앱 토스트 메시지 | 정상 (유지) |
| 5 | `UndoSnackbar` | `admin/.../UndoSnackbar.tsx` | 되돌리기 스낵바 | 정상 (유지) |
| 6 | `useChatRealtime` | `lib/realtime/useChatRealtime.ts` | 채팅 실시간 동기화 | 앱 닫으면 알림 없음 |
| 7 | Vercel Cron | `vercel.json` (6개 cron) | DB INSERT만 수행 | Push 전달 수단 없음 |

### 1.2 Browser Notification API 중복 호출

현재 두 곳에서 독립적으로 `new Notification()`을 호출합니다:

```
1. lib/realtime/useNotificationRealtime.ts
   → requestNotificationPermission() + new Notification()
   → tag: 'notification', 자동닫기 5초

2. lib/domains/calendar/reminders.ts
   → requestNotificationPermission() (useNotificationRealtime에서 import)
   → new Notification(), 자동닫기 8초
```

이로 인해 권한 요청 타이밍, 중복 방지, 자동닫기 시간이 파일마다 다릅니다.

### 1.3 기존 알림 설정 테이블

`student_notification_preferences` 테이블이 이미 존재합니다:

```typescript
// lib/domains/student/actions/notifications.ts
type NotificationSettings = {
  plan_start_enabled: boolean;
  plan_complete_enabled: boolean;
  daily_goal_achieved_enabled: boolean;
  weekly_report_enabled: boolean;
  plan_delay_enabled: boolean;
  plan_delay_threshold_minutes: number;
  notification_time_start: string;        // HH:MM
  notification_time_end: string;          // HH:MM
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;              // HH:MM
  quiet_hours_end: string;               // HH:MM
  attendance_check_in_enabled?: boolean;
  attendance_check_out_enabled?: boolean;
  attendance_absent_enabled?: boolean;
  attendance_late_enabled?: boolean;
};
```

### 1.4 기존 인프라 자산 (재활용 가능)

- `connectionManager.ts` — 싱글톤, 채널 상태 관리, 지수 백오프 재연결
- `chat_room_members.is_muted` — 채팅 뮤트 이미 DB 레벨 구현
- `lib/offline/` — IndexedDB 큐, 네트워크 상태 감지, 재시도 로직
- `useChatPresence` — Supabase Presence API 사용 패턴 존재
- `operationTracker.ts` — 중복 이벤트 방지 패턴 존재
- PWA 기반 — manifest.json, 아이콘, InstallPrompt 컴포넌트

---

## 2. 목표 아키텍처

### 2.1 통폐합 전후 비교

```
Before (7개 경로):                    After (3개 경로):
─────────────────                    ─────────────────
1. useNotificationRealtime            1. Supabase Realtime (인앱 실시간)
   → Browser Notification                → Client NotificationRouter
2. useEventReminders                       → Toast / Badge 표시
   → Browser Notification
3. SSE Polling (/api/stream)          2. Server NotificationRouter (Edge Function)
4. ToastProvider                         → Web Push (앱 닫힘 시)
5. UndoSnackbar                          → 모든 트리거 소스 통합
6. useChatRealtime (알림 없음)
7. Vercel Cron (전달 없음)            3. UndoSnackbar (액션 피드백 전용, 기존 유지)

제거 대상:
  ✗ SSE Polling (app/api/notifications/stream/route.ts)
  ✗ Browser Notification 직접 호출 2곳 → Client Router로 통합
  ✗ setTimeout 리마인더 → Server 스케줄러로 대체
```

### 2.2 전체 데이터 흐름

```
[트리거 소스]
  DB Trigger (chat_messages INSERT)  ─┐
  Vercel Cron (학습 리마인더)          ─┼─→ [Server NotificationRouter]
  Server Action (관리자 플랜 생성)     ─┘     (Edge Function)
                                              │
                                    ┌─────────┼─────────┐
                                    ▼         ▼         ▼
                              설정 확인   온라인 확인  로그 저장
                              (preferences) (presence) (notification_log)
                                    │         │
                                    ▼         ▼
                              ┌─ 오프라인 → Web Push (SW → showNotification)
                              └─ 온라인   → Push 스킵 (인앱으로 충분)

[클라이언트]
  Realtime broadcast 수신 ─→ [Client NotificationRouter]
                                    │
                              ┌─────┼─────┐
                              ▼     ▼     ▼
                           Toast  Badge  Sound
                           (앱 내) (탭)  (선택)
```

### 2.3 신규 파일 구조

```
lib/domains/notification/              # 통합 알림 도메인 (신규)
  ├── router.ts                        # 클라이언트 NotificationRouter
  ├── browserNotification.ts           # Browser Notification API 래퍼 (단일)
  ├── types.ts                         # 통합 알림 타입
  └── constants.ts                     # 알림 카테고리, 기본값

lib/domains/push/                      # Push 도메인 (신규)
  ├── actions/
  │   ├── subscription.ts              # subscribe/unsubscribe Server Actions
  │   └── send.ts                      # sendPushToUser Server Action
  ├── hooks/
  │   └── usePushSubscription.ts       # 구독 관리 훅
  └── vapid.ts                         # VAPID 키 설정

lib/realtime/
  └── useAppPresence.ts                # 앱 레벨 온라인 상태 (신규)

app/sw.ts                              # Serwist Service Worker 소스 (신규)

supabase/functions/
  └── notification-router/index.ts     # Edge Function (신규)

supabase/migrations/
  └── YYYYMMDD_push_subscriptions.sql  # 테이블 마이그레이션 (신규)
```

---

## Phase 0: 기반 정비

> **원칙**: 기존 동작을 일절 변경하지 않고 인프라만 준비
>
> **사이드이펙트**: 없음

### Task 0-1: `next-pwa` → `@serwist/next` 마이그레이션

**배경**: `next-pwa`는 2년간 미관리. Turbopack 미지원, 보안 패치 없음. Next.js 공식 문서에서 `@serwist/next`를 권장.

**작업**:

```bash
# 1. 패키지 교체
pnpm remove next-pwa
pnpm add @serwist/next
pnpm add -D serwist

# 2. 타입 확인 (web-push는 Phase 1에서 설치)
```

**수정 파일**: `next.config.ts`

```typescript
// Before (현재)
import withPWA from "next-pwa";

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/app-build-manifest\.json$/],
  runtimeCaching: [/* ... */],
});

module.exports = pwaConfig(nextConfig);

// After (변경)
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",          // SW 소스 파일 (Phase 1에서 생성)
  swDest: "public/sw.js",      // 빌드 출력 위치
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(withBundleAnalyzer(nextConfig));
```

**신규 파일**: `app/sw.ts` (최소 버전 — 기존 동작만 유지)

```typescript
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

**검증**:
- [ ] `pnpm build` 성공
- [ ] `public/sw.js` 생성 확인
- [ ] 브라우저 DevTools > Application > Service Workers에서 등록 확인
- [ ] 오프라인 모드에서 캐시된 페이지 로딩 확인

---

### Task 0-2: VAPID 키 생성

```bash
npx web-push generate-vapid-keys
```

**환경변수 추가** (`.env.local`):

```env
# Push Notification VAPID Keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BPxxx...  # 클라이언트에서 사용
VAPID_PRIVATE_KEY=xxx...                # 서버에서만 사용 (NEXT_PUBLIC 아님!)
```

> Vercel 환경변수에도 동일하게 추가 필요

**주의**: 이 단계에서는 키를 생성하고 저장만 합니다. 사용은 Phase 1부터.

---

### Task 0-3: DB 테이블 생성

**마이그레이션**: `supabase/migrations/YYYYMMDD_create_push_subscriptions.sql`

```sql
-- ============================================
-- 1. Push 구독 저장 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  subscription JSONB NOT NULL,       -- 전체 PushSubscription 객체
  device_label TEXT,                  -- "iPhone Safari", "Chrome Desktop" 등
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT push_subscriptions_user_endpoint_unique
    UNIQUE(user_id, endpoint)
);

-- 인덱스: 활성 구독 빠른 조회
CREATE INDEX idx_push_subscriptions_user_active
  ON public.push_subscriptions(user_id)
  WHERE is_active = true;

-- RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- 2. 알림 발송 로그 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,                -- 'chat_message', 'study_reminder', 'event_reminder', ...
  reference_id TEXT,                 -- 원본 엔티티 ID (chat_message.id, plan.id 등)
  channel TEXT NOT NULL,             -- 'push', 'in_app', 'browser'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered BOOLEAN DEFAULT false,
  clicked BOOLEAN DEFAULT false,
  clicked_at TIMESTAMPTZ,
  skipped_reason TEXT                -- 'muted', 'quiet_hours', 'online', 'preference_off'
);

-- 인덱스: 중복 방지 및 분석용
CREATE INDEX idx_notification_log_user_type
  ON public.notification_log(user_id, type, sent_at DESC);

CREATE INDEX idx_notification_log_reference
  ON public.notification_log(reference_id)
  WHERE reference_id IS NOT NULL;

-- RLS
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notification log"
  ON public.notification_log FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- 3. 기존 student_notification_preferences에 Push 컬럼 추가
-- ============================================
ALTER TABLE public.student_notification_preferences
  ADD COLUMN IF NOT EXISTS chat_push_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_group_push_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS study_reminder_push_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS plan_update_push_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS achievement_push_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS event_reminder_push_enabled BOOLEAN DEFAULT true;
```

**검증**:
- [ ] `supabase db push` 또는 로컬 마이그레이션 성공
- [ ] 테이블 생성 확인 (비어 있음)
- [ ] 기존 `student_notification_preferences` 데이터 변경 없음

---

### Task 0-4: `database.types.ts` 업데이트

```bash
pnpm supabase gen types typescript --local > lib/supabase/database.types.ts
```

또는 수동으로 `push_subscriptions`, `notification_log` 타입 추가.

**Phase 0 완료 기준**:
- [ ] `pnpm build` 성공
- [ ] `pnpm lint` 통과
- [ ] 기존 기능 동작 변경 없음
- [ ] 빈 테이블 3개 생성 + 기존 테이블 컬럼 추가

---

## Phase 1: Push 구독 파이프라인

> **원칙**: Push를 받을 수 있는 상태만 만듦. 아직 아무것도 보내지 않음.
>
> **사이드이펙트**: 없음 (구독 저장만, 발송 없음)

### Task 1-1: Service Worker에 Push 핸들러 추가

**수정 파일**: `app/sw.ts`

```typescript
// === 기존 Serwist 설정 유지 ===
// ... (Phase 0에서 생성한 코드)

// === Push 핸들러 추가 ===
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json() as {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    renotify?: boolean;
    url?: string;
    type?: string;
  };

  const options: NotificationOptions = {
    body: data.body,
    icon: data.icon ?? "/icons/icon-192x192.png",
    badge: data.badge ?? "/icons/icon-72x72.png",
    tag: data.tag,
    renotify: data.renotify ?? true,
    data: {
      url: data.url ?? "/",
      type: data.type,
      timestamp: Date.now(),
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification.data?.url as string) ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // 이미 열린 앱 창이 있으면 포커스 + 네비게이션
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            client.postMessage({ type: "PUSH_NAVIGATE", url });
            return;
          }
        }
        // 없으면 새 창
        return self.clients.openWindow(url);
      })
  );
});

serwist.addEventListeners();
```

---

### Task 1-2: Push 구독 Server Actions

**신규 파일**: `lib/domains/push/actions/subscription.ts`

```typescript
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export type PushSubscriptionData = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

/**
 * Push 구독을 서버에 저장합니다.
 * 동일 endpoint가 있으면 갱신 (UPSERT).
 */
export async function subscribePush(
  subscription: PushSubscriptionData,
  deviceLabel?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "로그인이 필요합니다." };

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.userId,
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
        subscription: subscription as unknown as Record<string, unknown>,
        device_label: deviceLabel ?? detectDeviceLabel(),
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    );

  if (error) {
    console.error("[Push] Subscribe failed:", error);
    return { success: false, error: "구독 저장에 실패했습니다." };
  }

  return { success: true };
}

/**
 * Push 구독을 비활성화합니다.
 */
export async function unsubscribePush(
  endpoint: string
): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", user.userId)
    .eq("endpoint", endpoint);

  return { success: true };
}

function detectDeviceLabel(): string {
  // Server Action에서는 User-Agent 직접 접근 불가
  // 클라이언트에서 전달받거나, headers()에서 추출
  return "Unknown Device";
}
```

---

### Task 1-3: 클라이언트 구독 관리 훅

**신규 파일**: `lib/domains/push/hooks/usePushSubscription.ts`

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import { subscribePush, unsubscribePush } from "../actions/subscription";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

/**
 * Push 구독을 자동으로 관리하는 훅.
 *
 * - 마운트 시 기존 구독 확인
 * - 구독이 없으면 자동 등록 (사용자가 이미 권한 허용한 경우)
 * - iOS 구독 풀림 대비 매 방문 시 체크
 * - 권한 미요청 상태면 아무것도 하지 않음 (Phase 5에서 UI로 유도)
 */
export function usePushSubscription(userId: string | null) {
  const subscribedRef = useRef(false);

  const syncSubscription = useCallback(async () => {
    if (!userId || subscribedRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    // 권한이 이미 granted인 경우에만 자동 구독
    if (Notification.permission !== "granted") return;

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // iOS 구독 풀림 등으로 없는 경우 → 재구독
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const result = await subscribePush(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey("p256dh")!),
            auth: arrayBufferToBase64(subscription.getKey("auth")!),
          },
        },
        detectDeviceLabel()
      );

      if (result.success) {
        subscribedRef.current = true;
      }
    } catch (err) {
      console.error("[Push] Subscription sync failed:", err);
    }
  }, [userId]);

  useEffect(() => {
    syncSubscription();
  }, [syncSubscription]);

  /**
   * 명시적 구독 요청 (설정 UI에서 사용).
   * Notification.requestPermission() 포함.
   */
  const requestSubscription = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    await syncSubscription();
    return subscribedRef.current;
  }, [syncSubscription]);

  /**
   * 구독 해제 (설정 UI에서 사용).
   */
  const cancelSubscription = useCallback(async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      subscribedRef.current = false;
      return true;
    } catch {
      return false;
    }
  }, []);

  return { requestSubscription, cancelSubscription };
}

// --- 유틸리티 ---

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function detectDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iOS Safari";
  if (/Android/.test(ua)) return "Android Chrome";
  if (/Mac/.test(ua)) return "macOS Desktop";
  if (/Windows/.test(ua)) return "Windows Desktop";
  return "Unknown Device";
}
```

---

### Task 1-4: 레이아웃 통합

**수정 파일**: `app/layout.tsx`

```typescript
// 기존 import 유지
import { PushSubscriptionManager } from "@/components/push/PushSubscriptionManager";

// children 근처에 추가 (비차단 렌더링)
<PushSubscriptionManager />
```

**신규 파일**: `components/push/PushSubscriptionManager.tsx`

```typescript
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
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  usePushSubscription(userId);

  return null; // UI 없음
}
```

**Phase 1 완료 기준**:
- [ ] Service Worker에 push/notificationclick 핸들러 존재
- [ ] 알림 권한 허용 시 `push_subscriptions` 테이블에 레코드 저장
- [ ] DevTools > Application > Push에서 테스트 메시지 전송 시 알림 표시
- [ ] 기존 기능 변경 없음 (아직 서버에서 Push 발송 안 함)

---

## Phase 2: Notification Router

> **원칙**: 새 라우팅 경로 추가. 기존 경로는 아직 유지.
>
> **사이드이펙트**: 없음 (새 경로 병행 운영)

### Task 2-1: 통합 타입 정의

**신규 파일**: `lib/domains/notification/types.ts`

```typescript
/** 알림 카테고리 */
export type NotificationType =
  | "chat_message"        // 1:1 채팅 메시지
  | "chat_group_message"  // 그룹 채팅 메시지
  | "chat_mention"        // @멘션 (뮤트 무시)
  | "study_reminder"      // 학습 리마인더 (아침)
  | "plan_created"        // 관리자가 플랜 생성
  | "plan_overdue"        // 미완료 플랜
  | "plan_updated"        // 플랜 변경
  | "achievement"         // 달성 알림
  | "event_reminder"      // 캘린더 이벤트 리마인더
  | "payment_reminder"    // 결제 알림
  | "consultation_reminder" // 상담 알림
  | "attendance"          // 출결 알림
  | "system";             // 시스템 공지

/** 알림 우선순위 */
export type NotificationPriority = "high" | "normal" | "low";

/** 서버 → Edge Function 요청 페이로드 */
export interface NotificationRequest {
  type: NotificationType;
  recipientIds: string[];            // 수신자 목록
  payload: {
    title: string;
    body: string;
    url?: string;                    // 클릭 시 이동
    tag?: string;                    // 같은 tag는 교체 (채팅방별 그룹)
    icon?: string;
  };
  priority: NotificationPriority;
  source: "db_trigger" | "cron" | "server_action";
  referenceId?: string;              // 원본 엔티티 ID
}

/** 클라이언트 라우터 디스패치 페이로드 */
export interface ClientNotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  inApp: "toast" | "badge" | "none"; // 인앱 표시 방식
}

/** 알림이 스킵된 이유 */
export type SkipReason =
  | "preference_off"     // 사용자가 해당 카테고리 비활성화
  | "muted"              // 채팅방 뮤트
  | "quiet_hours"        // 방해금지 시간
  | "online"             // 사용자 온라인 (인앱으로 충분)
  | "rate_limited"       // 빈도 제한
  | "duplicate";         // 중복

/** 알림 카테고리 → 설정 필드 매핑 */
export const NOTIFICATION_PREFERENCE_MAP: Record<
  NotificationType,
  string | null  // null = 항상 발송 (설정 불가)
> = {
  chat_message: "chat_push_enabled",
  chat_group_message: "chat_group_push_enabled",
  chat_mention: null,                           // 항상 발송
  study_reminder: "study_reminder_push_enabled",
  plan_created: "plan_update_push_enabled",
  plan_overdue: "plan_delay_enabled",
  plan_updated: "plan_update_push_enabled",
  achievement: "achievement_push_enabled",
  event_reminder: "event_reminder_push_enabled",
  payment_reminder: null,                       // 항상 발송
  consultation_reminder: null,                  // 항상 발송
  attendance: "attendance_check_in_enabled",
  system: null,                                 // 항상 발송
};
```

---

### Task 2-2: Push 발송 Server Action

**신규 파일**: `lib/domains/push/actions/send.ts`

```typescript
"use server";

import webpush from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// VAPID 설정 (모듈 레벨에서 1회)
webpush.setVapidDetails(
  "mailto:admin@timelevelup.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  type?: string;
}

/**
 * 특정 사용자의 모든 활성 디바이스에 Push 발송.
 * 410 Gone 응답 시 해당 구독을 자동 비활성화.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const supabase = createSupabaseAdminClient();

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!subscriptions?.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    subscriptions.map((row) =>
      webpush.sendNotification(
        row.subscription as unknown as webpush.PushSubscription,
        JSON.stringify(payload),
        { TTL: 86400, urgency: "normal" }
      )
    )
  );

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "fulfilled") {
      sent++;
    } else {
      failed++;
      const err = (results[i] as PromiseRejectedResult).reason;
      // 410 Gone = 구독 만료 → 비활성화
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("id", subscriptions[i].id);
      }
    }
  }

  return { sent, failed };
}
```

---

### Task 2-3: Server NotificationRouter (Edge Function)

**신규 파일**: `supabase/functions/notification-router/index.ts`

> 이 Edge Function은 DB Trigger, Cron, Server Action 모두에서 호출됩니다.

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "https://esm.sh/web-push@3";

// VAPID 설정
webpush.setVapidDetails(
  "mailto:admin@timelevelup.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
);

serve(async (req) => {
  const { type, recipientIds, payload, priority, source, referenceId } =
    await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results = { sent: 0, skipped: 0, failed: 0 };

  for (const userId of recipientIds) {
    const skipReason = await shouldSkip(supabase, userId, type, payload, priority);

    if (skipReason) {
      results.skipped++;
      // 스킵 로그
      await supabase.from("notification_log").insert({
        user_id: userId, type, channel: "push",
        title: payload.title, body: payload.body,
        reference_id: referenceId,
        skipped_reason: skipReason,
      });
      continue;
    }

    // Push 발송
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (!subscriptions?.length) {
      results.skipped++;
      continue;
    }

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
        results.sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions")
            .update({ is_active: false }).eq("id", sub.id);
        }
        results.failed++;
      }
    }

    // 발송 로그
    await supabase.from("notification_log").insert({
      user_id: userId, type, channel: "push",
      title: payload.title, body: payload.body,
      reference_id: referenceId, delivered: true,
    });
  }

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});

// ============================================
// 필터링 로직 (핵심)
// ============================================
async function shouldSkip(
  supabase: any,
  userId: string,
  type: string,
  payload: any,
  priority: string
): Promise<string | null> {
  // 1. 사용자 설정 확인
  const prefField = NOTIFICATION_PREFERENCE_MAP[type];
  if (prefField) {
    const { data: prefs } = await supabase
      .from("student_notification_preferences")
      .select(prefField)
      .eq("student_id", userId)
      .single();

    if (prefs && prefs[prefField] === false) {
      return "preference_off";
    }
  }

  // 2. 방해금지 시간 확인 (high 우선순위는 무시)
  if (priority !== "high") {
    const { data: prefs } = await supabase
      .from("student_notification_preferences")
      .select("quiet_hours_enabled, quiet_hours_start, quiet_hours_end")
      .eq("student_id", userId)
      .single();

    if (prefs?.quiet_hours_enabled) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (isInQuietHours(currentTime, prefs.quiet_hours_start, prefs.quiet_hours_end)) {
        return "quiet_hours";
      }
    }
  }

  // 3. 채팅 뮤트 확인
  if (type === "chat_message" || type === "chat_group_message") {
    // payload.tag 형식: "chat-{roomId}"
    const roomId = payload.tag?.replace("chat-", "");
    if (roomId) {
      const { data: member } = await supabase
        .from("chat_room_members")
        .select("is_muted")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .single();

      if (member?.is_muted) return "muted";
    }
  }

  // 4. 중복 방지 (30초 내 동일 reference)
  if (payload.tag) {
    const { data: recent } = await supabase
      .from("notification_log")
      .select("id")
      .eq("user_id", userId)
      .eq("type", type)
      .eq("channel", "push")
      .is("skipped_reason", null)
      .gte("sent_at", new Date(Date.now() - 30000).toISOString())
      .limit(1);

    if (recent?.length) return "duplicate";
  }

  // 5. 빈도 제한 (1시간 내 10건)
  const { count } = await supabase
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("channel", "push")
    .is("skipped_reason", null)
    .gte("sent_at", new Date(Date.now() - 3600000).toISOString());

  if ((count ?? 0) >= 10) return "rate_limited";

  return null; // 발송 허용
}

function isInQuietHours(current: string, start: string, end: string): boolean {
  if (start <= end) {
    return current >= start && current <= end;
  }
  // 자정을 넘는 경우 (예: 23:00 ~ 07:00)
  return current >= start || current <= end;
}

const NOTIFICATION_PREFERENCE_MAP: Record<string, string | null> = {
  chat_message: "chat_push_enabled",
  chat_group_message: "chat_group_push_enabled",
  chat_mention: null,
  study_reminder: "study_reminder_push_enabled",
  plan_created: "plan_update_push_enabled",
  plan_overdue: "plan_delay_enabled",
  plan_updated: "plan_update_push_enabled",
  achievement: "achievement_push_enabled",
  event_reminder: "event_reminder_push_enabled",
  payment_reminder: null,
  consultation_reminder: null,
  attendance: "attendance_check_in_enabled",
  system: null,
};
```

---

### Task 2-4: 채팅 메시지 DB Trigger → Edge Function

**마이그레이션**: `supabase/migrations/YYYYMMDD_chat_push_trigger.sql`

```sql
-- pg_net 확장 필요 (Supabase 기본 제공)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 채팅 메시지 INSERT 시 Edge Function 호출
CREATE OR REPLACE FUNCTION notify_chat_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recipient_ids UUID[];
  room_name TEXT;
  room_type TEXT;
  msg_title TEXT;
  msg_body TEXT;
BEGIN
  -- 방 정보 조회
  SELECT cr.name, cr.type INTO room_name, room_type
  FROM chat_rooms cr WHERE cr.id = NEW.room_id;

  -- 수신자 목록 (발신자 제외, 탈퇴하지 않은 멤버)
  SELECT array_agg(user_id) INTO recipient_ids
  FROM chat_room_members
  WHERE room_id = NEW.room_id
    AND user_id != NEW.sender_id
    AND left_at IS NULL;

  IF recipient_ids IS NULL OR array_length(recipient_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- 알림 내용 구성
  IF room_type = 'direct' THEN
    msg_title := COALESCE(NEW.sender_name, '새 메시지');
    msg_body := left(NEW.content, 100);
  ELSE
    msg_title := COALESCE(room_name, '그룹 채팅');
    msg_body := COALESCE(NEW.sender_name, '알 수 없음') || ': ' || left(NEW.content, 100);
  END IF;

  -- Edge Function 비동기 호출 (fire-and-forget)
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/notification-router',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'type', CASE WHEN room_type = 'direct' THEN 'chat_message' ELSE 'chat_group_message' END,
      'recipientIds', to_jsonb(recipient_ids),
      'payload', jsonb_build_object(
        'title', msg_title,
        'body', msg_body,
        'url', '/chat/' || NEW.room_id,
        'tag', 'chat-' || NEW.room_id
      ),
      'priority', 'normal',
      'source', 'db_trigger',
      'referenceId', NEW.id::text
    )
  );

  RETURN NEW;
END;
$$;

-- 트리거 생성 (시스템 메시지 제외)
CREATE TRIGGER trg_chat_message_push
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  WHEN (NEW.type != 'system')
  EXECUTE FUNCTION notify_chat_message_push();
```

**Phase 2 완료 기준**:
- [ ] Edge Function 배포 및 호출 성공
- [ ] 채팅 메시지 전송 시 → 수신자 기기에 Push 알림 표시
- [ ] `notification_log`에 발송/스킵 로그 기록
- [ ] 뮤트된 방의 메시지는 스킵 확인
- [ ] 방해금지 시간에 스킵 확인
- [ ] 기존 채팅 Realtime, 토스트 등 변경 없음

---

## Phase 3: 기존 경로 통폐합

> **원칙**: Phase 2 안정 확인 후 진행. 각 제거 작업은 독립 PR. 2주 공존 기간.
>
> **사이드이펙트**: 기존 경로 제거 (롤백 계획 필수)

### Task 3-1: Client NotificationRouter 생성

**신규 파일**: `lib/domains/notification/router.ts`

```typescript
"use client";

import type { ClientNotificationPayload, NotificationType } from "./types";

type ToastFn = (message: string, type?: "info" | "success") => void;

// 중복 방지: tag별 최근 발송 타임스탬프
const recentTags = new Map<string, number>();
const DEDUP_WINDOW = 2000; // 2초

/**
 * 클라이언트 알림의 단일 진입점.
 *
 * 모든 인앱 알림(토스트, 뱃지)은 이 Router를 통해야 합니다.
 * Browser Notification은 이 Router에서만 호출됩니다.
 */
class ClientNotificationRouter {
  private showToast: ToastFn | null = null;
  private unreadCountUpdater: ((delta: number) => void) | null = null;

  /** ToastProvider에서 한 번 등록 */
  registerToast(fn: ToastFn) {
    this.showToast = fn;
  }

  /** 언리드 카운터 업데이트 함수 등록 */
  registerUnreadUpdater(fn: (delta: number) => void) {
    this.unreadCountUpdater = fn;
  }

  /** 알림 디스패치 */
  dispatch(notification: ClientNotificationPayload) {
    // 중복 방지
    if (notification.tag) {
      const lastSent = recentTags.get(notification.tag);
      if (lastSent && Date.now() - lastSent < DEDUP_WINDOW) return;
      recentTags.set(notification.tag, Date.now());
    }

    // 현재 URL이 알림 대상과 동일하면 badge만
    if (notification.url && window.location.pathname === notification.url) {
      return; // 이미 해당 페이지에 있으므로 스킵
    }

    // 인앱 표시
    switch (notification.inApp) {
      case "toast":
        this.showToast?.(
          `${notification.title}: ${notification.body}`,
          "info"
        );
        break;
      case "badge":
        this.unreadCountUpdater?.(1);
        break;
      case "none":
        break;
    }
  }

  /** 오래된 tag 정리 (메모리 관리) */
  cleanup() {
    const now = Date.now();
    for (const [tag, ts] of recentTags) {
      if (now - ts > 60000) recentTags.delete(tag);
    }
  }
}

export const notificationRouter = new ClientNotificationRouter();

// 1분마다 오래된 tag 정리
if (typeof window !== "undefined") {
  setInterval(() => notificationRouter.cleanup(), 60000);
}
```

---

### Task 3-2: Browser Notification 통합 래퍼

**신규 파일**: `lib/domains/notification/browserNotification.ts`

```typescript
/**
 * Browser Notification API의 단일 래퍼.
 *
 * 이전에 2곳에서 독립적으로 호출하던 것을 이 파일로 통합합니다.
 * - lib/realtime/useNotificationRealtime.ts (제거)
 * - lib/domains/calendar/reminders.ts (제거)
 */

const NOTIFICATION_AUTO_CLOSE_MS = 5000;

/** 권한 요청 (한 곳에서만 export) */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}

/** 알림 표시 (단일 진입점) */
export function showBrowserNotification(options: {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  url?: string;
}) {
  if (Notification.permission !== "granted") return;

  const notification = new Notification(options.title, {
    body: options.body,
    icon: options.icon ?? "/icons/icon-192x192.png",
    tag: options.tag ?? "default",
  });

  notification.onclick = () => {
    window.focus();
    if (options.url) {
      window.location.href = options.url;
    }
    notification.close();
  };

  setTimeout(() => notification.close(), NOTIFICATION_AUTO_CLOSE_MS);
}
```

---

### Task 3-3: `useNotificationRealtime` 리팩토링

**수정 파일**: `lib/realtime/useNotificationRealtime.ts`

변경 사항:
1. `new Notification()` 직접 호출 → `notificationRouter.dispatch()` 로 교체
2. `requestNotificationPermission` export → `browserNotification.ts`에서 re-export

```typescript
// Before (현재):
if (showBrowserNotification && !notification.is_read) {
  const perm = await requestNotificationPermission();
  if (perm === "granted") {
    new Notification(notification.title, {
      body: notification.message,
      icon: "/icons/icon-192x192.png",
      tag: "notification",
    });
  }
}

// After (변경):
import { notificationRouter } from "@/lib/domains/notification/router";

if (!notification.is_read) {
  notificationRouter.dispatch({
    type: notification.type as NotificationType,
    title: notification.title,
    body: notification.message,
    url: notification.metadata?.url as string,
    tag: `notification-${notification.id}`,
    inApp: "toast",
  });
}
```

---

### Task 3-4: `useEventReminders` 리팩토링

**수정 파일**: `lib/domains/calendar/reminders.ts`

변경 사항:
1. `new Notification()` 직접 호출 → `notificationRouter.dispatch()` 로 교체
2. `requestNotificationPermission` import 변경

```typescript
// Before (현재):
const perm = await requestNotificationPermission();
if (perm === "granted") {
  const n = new Notification(`${event.title} - ${timeLabel}`, {
    body: `${event.title}이(가) ${timeLabel} 시작됩니다`,
    icon: "/icons/icon-192x192.png",
  });
  setTimeout(() => n.close(), 8000);
}

// After (변경):
import { notificationRouter } from "@/lib/domains/notification/router";

notificationRouter.dispatch({
  type: "event_reminder",
  title: `${event.title} - ${timeLabel}`,
  body: `${event.title}이(가) ${timeLabel} 시작됩니다`,
  tag: `reminder-${event.id}`,
  inApp: "toast",
});
```

> **주의**: setTimeout 기반 스케줄링 자체는 Phase 4의 서버 스케줄러가 안정화될 때까지 유지합니다. 여기서는 알림 표시 방법만 통합합니다.

---

### Task 3-5: SSE 폴링 엔드포인트 제거

**전제 조건**: Phase 2의 Push 전달률이 90% 이상 확인된 후

**제거 파일**: `app/api/notifications/stream/route.ts`

**확인 사항**:
- SSE를 사용하는 클라이언트 코드가 있는지 검색 (`EventSource`, `/api/notifications/stream`)
- 있다면 해당 코드도 함께 제거

**롤백**: 파일 복원 (git)

---

### Task 3-6: Cron Job에 Push 발송 연결

**수정 대상 파일들**:

```
app/api/cron/payment-reminders/route.ts
app/api/cron/consultation-reminders/route.ts
```

각 Cron에서 DB INSERT 이후 Edge Function 호출 추가:

```typescript
// Cron 핸들러 끝에 추가
await fetch(`${process.env.SUPABASE_URL}/functions/v1/notification-router`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({
    type: "payment_reminder",
    recipientIds: targetUserIds,
    payload: {
      title: "결제 알림",
      body: "이번 달 수강료 납부일이 다가옵니다.",
      url: "/payments",
    },
    priority: "normal",
    source: "cron",
  }),
});
```

**Phase 3 완료 기준**:
- [ ] Browser Notification 호출이 `browserNotification.ts` 한 곳에서만 발생
- [ ] `notificationRouter.dispatch()`가 유일한 인앱 알림 진입점
- [ ] SSE 폴링 제거됨 (해당 코드 참조 없음)
- [ ] Cron Job에서 Push 발송 확인
- [ ] 기존 알림 기능 정상 동작 (토스트, 스낵바, 채팅 Realtime)

---

## Phase 4: Presence 기반 지능형 라우팅

> **원칙**: 불필요한 Push 발송을 줄여 사용자 경험 최적화
>
> **사이드이펙트**: 없음 (기존 위에 레이어 추가)

### Task 4-1: 앱 레벨 Presence 훅

**신규 파일**: `lib/realtime/useAppPresence.ts`

```typescript
"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

/**
 * 앱 전역에서 사용자 온라인 상태를 Supabase Presence로 추적.
 * 레이아웃에서 한 번만 마운트.
 *
 * Edge Function에서 이 정보를 조회하여 Push 발송 여부를 결정합니다.
 */
export function useAppPresence(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel("app-presence", {
      config: { presence: { key: userId } },
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
          status: "active",
        });
      }
    });

    // 탭 비활성화 시 idle 상태로 전환
    const handleVisibility = () => {
      channel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
        status: document.hidden ? "idle" : "active",
      });
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
```

**레이아웃 통합** (`app/layout.tsx`):

```typescript
<AppPresenceProvider />  // userId를 내부에서 resolve
```

---

### Task 4-2: Edge Function에 Presence 체크 추가

**수정**: `supabase/functions/notification-router/index.ts`의 `shouldSkip` 함수

```typescript
// shouldSkip 함수에 추가 (5번째 체크):

// 5. 온라인 상태 확인 (active 상태면 Push 스킵)
const presenceChannel = supabase.channel("app-presence");
const presenceState = presenceChannel.presenceState();

const userPresence = Object.values(presenceState)
  .flat()
  .find((p: any) => p.user_id === userId);

if (userPresence?.status === "active") {
  return "online";
}
// idle 상태나 오프라인은 Push 발송
```

---

### Task 4-3: 채팅 요약 알림 (그룹 채팅 빈도 제한)

Edge Function에서 그룹 채팅 미읽음이 3건 이상이면 요약 알림으로 전환:

```typescript
// notification-router에서 chat_group_message 처리 시:

if (type === "chat_group_message") {
  const { count } = await supabase
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "chat_group_message")
    .like("reference_id", `chat-${roomId}%`)
    .is("skipped_reason", null)
    .gte("sent_at", new Date(Date.now() - 300000).toISOString()); // 5분

  if ((count ?? 0) >= 3) {
    // 개별 알림 대신 요약으로 교체
    payload.title = roomName;
    payload.body = `${count + 1}개의 새 메시지`;
  }
}
```

**Phase 4 완료 기준**:
- [ ] 앱 열려있을 때 Push 알림 안 옴 (`notification_log.skipped_reason = 'online'`)
- [ ] 앱 닫힌 후 채팅 메시지 Push 정상 수신
- [ ] 그룹 채팅 5분 내 3건 이상 → 요약 알림
- [ ] `notification_log`에 skip reason 기록 확인

---

## Phase 5: 알림 설정 UI 확장

> **원칙**: 기존 설정 페이지 확장. 사용자 제어권 강화.
>
> **사이드이펙트**: 없음 (UI 추가)

### Task 5-1: NotificationSettings 타입 확장

**수정 파일**: `lib/domains/student/actions/notifications.ts`

```typescript
export type NotificationSettings = {
  // === 기존 필드 (유지) ===
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

  // === 신규 Push 필드 ===
  chat_push_enabled: boolean;
  chat_group_push_enabled: boolean;
  study_reminder_push_enabled: boolean;
  plan_update_push_enabled: boolean;
  achievement_push_enabled: boolean;
  event_reminder_push_enabled: boolean;
};
```

---

### Task 5-2: 설정 UI 컴포넌트

**수정 파일**: 기존 알림 설정 페이지 (student settings)

섹션 추가:

```
┌─ 푸시 알림 ─────────────────────────────────┐
│                                              │
│ 전체 푸시 알림          [████████████] ON     │
│                                              │
│ ─── 채팅 ───                                 │
│ 1:1 채팅 메시지         [████████████] ON     │
│ 그룹 채팅 메시지        [████████████] ON     │
│                                              │
│ ─── 학습 ───                                 │
│ 학습 리마인더           [████████████] ON     │
│ 플랜 변경 알림          [████████████] ON     │
│ 달성 알림              [████████████] ON     │
│                                              │
│ ─── 일정 ───                                 │
│ 일정 리마인더           [████████████] ON     │
│                                              │
│ ─── 방해금지 ───                              │
│ 방해금지 시간           [████████] ON          │
│ 시작: [23:00]  종료: [07:00]                 │
│                                              │
│ ─── 디바이스 ───                              │
│ 🖥 macOS Desktop    등록 2026-02-20  [삭제]  │
│ 📱 iOS Safari       등록 2026-02-18  [삭제]  │
│                                              │
└──────────────────────────────────────────────┘
```

**Phase 5 완료 기준**:
- [ ] 설정 UI에서 카테고리별 토글 동작
- [ ] 토글 OFF → 해당 카테고리 Push 스킵 확인 (`notification_log`)
- [ ] 방해금지 시간 설정 → 해당 시간 Push 스킵 확인
- [ ] 디바이스 목록 표시 + 삭제 기능

---

## Phase 6: iOS 대응 및 안정화

> **원칙**: iOS 특화 처리. 안정성 모니터링 체계 구축.

### Task 6-1: iOS 설치 유도 강화

**수정 파일**: `components/ui/InstallPrompt.tsx` (기존)

```typescript
// iOS + 미설치 감지 시 표시하는 배너 강화
// 기존: 수동적 배너
// 변경: 채팅 첫 수신 시, 리마인더 설정 시 적극 유도

const isIOS = /iPhone|iPad/.test(navigator.userAgent);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

if (isIOS && !isStandalone) {
  // "알림을 받으려면 홈 화면에 추가해주세요" 배너
  // 설치 방법 시각 가이드 포함
}
```

---

### Task 6-2: 구독 자동 복구

이미 Phase 1의 `usePushSubscription`에 포함됨:
- 매 방문 시 `pushManager.getSubscription()` 체크
- null이면 자동 재구독
- endpoint 변경 시 서버 갱신

---

### Task 6-3: 모니터링 대시보드 (관리자용)

**신규 라우트**: `app/(admin)/admin/notifications/page.tsx`

`notification_log` 테이블 기반:

```
┌─ 알림 모니터링 ─────────────────────────────┐
│                                              │
│ 오늘 발송: 247건  스킵: 89건  실패: 3건      │
│                                              │
│ 스킵 사유 분포:                               │
│   online: 45건 (51%)                         │
│   quiet_hours: 22건 (25%)                    │
│   muted: 12건 (13%)                          │
│   preference_off: 7건 (8%)                   │
│   rate_limited: 3건 (3%)                     │
│                                              │
│ 활성 구독: 128개 디바이스 (52명)              │
│   iOS: 34  Android: 56  Desktop: 38          │
│                                              │
│ 클릭률: 23% (최근 7일)                        │
└──────────────────────────────────────────────┘
```

**Phase 6 완료 기준**:
- [ ] iOS Safari PWA에서 Push 수신 확인
- [ ] 구독 풀림 후 재방문 시 자동 재구독 확인
- [ ] 관리자 모니터링 페이지에서 발송 통계 확인

---

## 롤백 및 사이드이펙트 방지

### 전체 원칙

| 원칙 | 설명 |
|------|------|
| **Additive First** | Phase 0~2는 기존 코드 수정 없이 새 코드만 추가 |
| **공존 기간** | Phase 3 통폐합 전 최소 2주 병행 운영 |
| **Feature Flag** | `NEXT_PUBLIC_ENABLE_PUSH=true` 환경변수로 전체 on/off |
| **독립 PR** | 각 Task는 독립 PR로 배포, 롤백 단위 명확 |
| **로그 기반 전환** | `notification_log`로 전달률 비교 후 구 경로 제거 |

### Phase별 롤백 계획

| Phase | 롤백 방법 | 영향 범위 |
|-------|-----------|-----------|
| **0** | `pnpm add next-pwa && pnpm remove @serwist/next` | SW만 |
| **1** | `push_subscriptions` 테이블 비움 + 환경변수 제거 | 없음 (발송 안 함) |
| **2** | Edge Function 비활성화 + 트리거 DROP | 새 경로만 중단 |
| **3-1** | SSE route 파일 git 복원 | SSE 복원 |
| **3-3~4** | `notificationRouter.dispatch` → `new Notification` 복원 | Browser Notification 복원 |
| **4** | Presence 훅 제거 (Edge Function에서 online 체크 스킵) | Push 빈도 증가 |
| **5** | UI 컴포넌트 제거 (설정 컬럼 유지) | UI만 |
| **6** | 없음 (추가 기능) | 없음 |

### 위험 시나리오 대응

| 시나리오 | 대응 |
|----------|------|
| Push 전달률이 예상보다 낮음 | SSE 폴링 유지 (Phase 3-5 보류) |
| Edge Function 과부하 | 트리거에 Rate Limit 추가 / 배치 처리 |
| iOS 구독 지속적 풀림 | 인앱 배너로 재설치 유도 + 로그 분석 |
| 사용자 알림 피로 | Rate Limit 강화 (시간당 5건→3건) |
| Vercel Hobby cron 일 1회 제한 | 리마인더는 Edge Function cron으로 이관 |

---

## 검증 체크리스트

### 기능 테스트

```
Phase 0:
  [ ] pnpm build 성공
  [ ] SW 등록 확인 (DevTools)
  [ ] 오프라인 캐시 동작

Phase 1:
  [ ] 알림 권한 허용 → push_subscriptions에 레코드
  [ ] DevTools Push 테스트 → 알림 표시
  [ ] 알림 클릭 → 앱 내 네비게이션

Phase 2:
  [ ] 채팅 메시지 전송 → 상대방 Push 수신
  [ ] 뮤트된 방 → Push 안 옴
  [ ] 방해금지 시간 → Push 안 옴
  [ ] notification_log 기록 확인

Phase 3:
  [ ] Browser Notification이 한 곳에서만 호출됨
  [ ] Toast 알림 정상 동작
  [ ] SSE 관련 코드 없음

Phase 4:
  [ ] 앱 열림 → Push 안 옴 (인앱만)
  [ ] 앱 닫힘 → Push 옴
  [ ] 그룹 채팅 요약 알림

Phase 5:
  [ ] 설정 토글 → 해당 카테고리 Push 스킵
  [ ] 디바이스 목록 + 삭제
  [ ] 방해금지 시간 설정

Phase 6:
  [ ] iOS PWA Push 수신
  [ ] 구독 자동 복구
  [ ] 관리자 모니터링 대시보드
```

### 회귀 테스트

```
모든 Phase에서 확인:
  [ ] 채팅 실시간 동기화 정상 (useChatRealtime)
  [ ] 채팅 타이핑 인디케이터 정상 (useChatPresence)
  [ ] 플랜 실시간 업데이트 정상 (usePlanRealtimeUpdates)
  [ ] 관리자 실시간 업데이트 정상 (useAdminPlanRealtime)
  [ ] 오프라인 큐 정상 (lib/offline/)
  [ ] Toast 알림 정상 (ToastProvider)
  [ ] Undo 스낵바 정상 (UndoSnackbar)
  [ ] 캘린더 리마인더 정상 (useEventReminders)
  [ ] 기존 Vercel Cron 정상 동작
```

### 성능 기준

```
  [ ] Edge Function 응답 시간 < 500ms (P95)
  [ ] Push 전달 지연 < 3초 (메시지 전송 → 알림 수신)
  [ ] notification_log 쿼리 < 50ms
  [ ] 앱 초기 로딩 시간 변화 없음 (±100ms 이내)
```

---

## 참고: 기술 선택 근거

| 선택 | 대안 | 근거 |
|------|------|------|
| `web-push` npm | OneSignal, FCM | 비용 0원, 벤더 종속 없음, 교육 앱 규모에 적합 |
| `@serwist/next` | `next-pwa` | Next.js 공식 권장, 유지보수 활발, Turbopack 지원 |
| Edge Function | Server Action 직접 발송 | 비동기 fire-and-forget, 메시지 전송 지연 방지 |
| DB Trigger | Server Action 내부 호출 | 채팅 코드 변경 없이 알림 추가 (비침투적) |
| Presence API | 클라이언트 폴링 | Supabase 기본 제공, 실시간, 추가 비용 없음 |
| `notification_log` | 메모리 카운터 | 분석 가능, 디버깅 용이, 중복 방지 근거 |
