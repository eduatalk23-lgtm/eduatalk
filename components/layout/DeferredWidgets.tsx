"use client";

/**
 * DeferredWidgets - 초기 로드에 필수가 아닌 글로벌 위젯들을 dynamic import로 지연 로딩.
 *
 * 루트 레이아웃(Server Component)에서 직접 dynamic({ ssr: false }) 사용이 불가하므로,
 * 이 Client Component에서 non-critical 위젯들을 dynamic import합니다.
 *
 * 효과: 초기 JS 번들에서 채팅/Push/PWA 관련 코드 분리 → FCP -200~300ms
 */

import dynamic from "next/dynamic";

const InstallPrompt = dynamic(
  () => import("@/components/ui/InstallPrompt"),
  { ssr: false }
);

const ServiceWorkerRegistrar = dynamic(
  () =>
    import("@/components/pwa/ServiceWorkerRegistrar").then(
      (m) => m.ServiceWorkerRegistrar
    ),
  { ssr: false }
);

const FloatingChatWidget = dynamic(
  () =>
    import("@/components/chat/FloatingChatWidget").then(
      (m) => m.FloatingChatWidget
    ),
  { ssr: false }
);

const PushSubscriptionManager = dynamic(
  () =>
    import("@/components/push/PushSubscriptionManager").then(
      (m) => m.PushSubscriptionManager
    ),
  { ssr: false }
);

const PushPermissionBanner = dynamic(
  () =>
    import("@/components/push/PushPermissionBanner").then(
      (m) => m.PushPermissionBanner
    ),
  { ssr: false }
);

const AppPresenceProvider = dynamic(
  () =>
    import("@/components/push/AppPresenceProvider").then(
      (m) => m.AppPresenceProvider
    ),
  { ssr: false }
);

export function DeferredWidgets() {
  return (
    <>
      <InstallPrompt />
      <ServiceWorkerRegistrar />
      <PushSubscriptionManager />
      <PushPermissionBanner />
      <AppPresenceProvider />
      <FloatingChatWidget />
    </>
  );
}
