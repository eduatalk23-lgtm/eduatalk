# 안드로이드 푸시 알림 "+n건" 카운트 오류 수정 로드맵

> **문제**: 앱에서 메시지를 읽어도 안드로이드 알림 트레이의 기존 알림이 정리되지 않아,
> 새 메시지 도착 시 이미 읽은 메시지까지 "+n건"에 포함됨

## 1. 문제 분석

### 재현 시나리오

```
1. 메시지 A 수신 → push 도착 (tag: "chat-{roomId}", messageCount: 1)
2. 메시지 B 수신 → SW가 기존 알림 messageCount 읽어 +1 → "외 1건의 메시지" (messageCount: 2)
3. 사용자가 앱 내에서 채팅방 진입 → markAsRead() → last_read_at 업데이트
   ⚠️ 그러나 안드로이드 알림 트레이의 기존 알림은 그대로 남아있음 (messageCount: 2)
4. 메시지 C 수신 → 서버는 정상 발송 (새 메시지이므로)
5. SW가 getNotifications({ tag })로 기존 알림(messageCount: 2) 가져옴 → messageCount: 3
6. "외 2건의 메시지"로 표시되지만, 실제 안 읽은 메시지는 1건뿐
```

### 근본 원인

| 위치 | 현재 동작 | 문제점 |
|------|-----------|--------|
| `sw.js:252-268` | `getNotifications({ tag })`로 기존 알림의 `messageCount` 누적 | 앱에서 읽어도 카운트 리셋 안 됨 |
| `sw.js:336-402` | 알림 클릭/dismiss 시에만 `clearTagCount()` 호출 | 앱 내 읽음 처리 시 호출 경로 없음 |
| `useChatRoomLogic.ts` | `markAsRead()` → DB 업데이트 + 낙관적 UI 업데이트 | SW에 알림 정리 메시지를 보내지 않음 |
| `useAppBadge.ts` | `SYNC_BADGE` 메시지로 뱃지 수 동기화 | 알림 트레이 정리는 별개 문제 |

### 영향 범위

- **Android Chrome PWA**: 주요 영향 (알림 트레이에 알림이 오래 남음)
- **iOS Safari PWA**: `getNotifications()` 미지원/불안정하여 IndexedDB fallback 사용 → 동일 문제
- **Desktop Chrome**: 알림이 자동 dismiss 되는 경우가 많아 영향 적음

## 2. 업계 사례 & 모범 사례

### 2.1 주요 앱 벤치마크

| 앱 | 패턴 | 상세 |
|----|-------|------|
| **WhatsApp** | Clear on Read | 앱 내에서 메시지 읽으면 알림 트레이에서 해당 대화의 알림 즉시 제거. Android `NotificationManager.cancel(tag, id)` 사용 |
| **Telegram** | Clear on Read + Server Sync | 다른 기기에서 읽어도 FCM data message로 알림 dismiss 명령 전송. `notification_id` 기반 cancel |
| **Signal** | Clear on Read (부분) | 같은 기기 내 읽음 시 정리됨. **다른 기기 간 동기화는 미완성** (GitHub Issue [#11950](https://github.com/signalapp/Signal-Android/issues/11950), [#717](https://github.com/signalapp/Signal-Desktop/issues/717)) |
| **Slack** | Presence + Clear | Active 상태면 push 스킵 + 앱 진입 시 기존 알림 dismiss. 데스크톱↔모바일 간 동기화 |
| **Discord** | Ack-based | 서버에서 "ack" 이벤트 수신 시 다른 기기의 알림 카운트 리셋 |

### 2.2 Web Push API 패턴

#### Pattern A: Main Thread → SW `postMessage` (권장, 우리 케이스에 적합)

```javascript
// Main Thread: 메시지 읽음 처리 시
navigator.serviceWorker.controller?.postMessage({
  type: "CLEAR_NOTIFICATIONS",
  tag: `chat-${roomId}`,
});

// Service Worker: 메시지 수신 시
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_NOTIFICATIONS") {
    const tag = event.data.tag;
    self.registration.getNotifications({ tag }).then((notifications) => {
      notifications.forEach((n) => n.close());
    });
    clearTagCount(tag);
  }
});
```

**장점**: 즉각적, 추가 네트워크 비용 없음, 이미 SW ↔ Main Thread 통신 패턴 존재
**단점**: 앱이 열려있을 때만 동작 (다른 기기에서 읽은 경우는 커버 안 됨)

#### Pattern B: Server-Sent Silent Push (보완적)

서버에서 `type: "dismiss"` 페이로드를 가진 push를 전송하여 알림을 닫는 패턴.

```javascript
// sw.js push handler
if (data.type === "dismiss") {
  const existing = await self.registration.getNotifications({ tag: data.tag });
  existing.forEach((n) => n.close());
  await clearTagCount(data.tag);
  // showNotification 호출하지 않음 — 단, 브라우저 정책 주의
  return;
}
```

**장점**: 다른 기기에서 읽은 경우도 커버
**단점**:
- Web Push 스펙상 push 이벤트에서 `showNotification()`을 호출하지 않으면 브라우저가 자동 알림 표시 가능 (Chrome의 "This site has been updated in the background" 등)
- 추가 push 비용 발생
- `userVisibleOnly: true` 제약 (Chrome 121부터 extensions에서만 false 허용)

#### Pattern C: Tag 기반 교체 (`renotify`) (이미 사용 중)

동일 `tag`로 `showNotification()`을 호출하면 기존 알림을 교체.
`renotify: true`면 교체 시 소리/진동 재발생.

```javascript
// web.dev 권장 패턴
await self.registration.showNotification(title, {
  tag: "chat-room-123",
  renotify: true, // 교체 시에도 알림음 재생
  body: "새 메시지가 3개 있습니다",
});
```

> **참고**: [web.dev - Notification behavior](https://web.dev/articles/push-notifications-notification-behaviour)

#### Pattern D: Notification.close() 직접 호출

`ServiceWorkerRegistration.getNotifications()`로 조회 후 `.close()` 호출.

```javascript
const notifications = await self.registration.getNotifications({ tag });
notifications.forEach((n) => n.close());
```

> **참고**: [MDN - ServiceWorkerRegistration.showNotification()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification)

### 2.3 업계 표준 정리

| 레이어 | 업계 표준 | 현재 상태 | 갭 |
|--------|-----------|-----------|-----|
| 같은 기기, 앱 내 읽음 | Main Thread → SW `close()` | ❌ 미구현 | **P0** |
| 같은 기기, 알림 클릭 읽음 | 알림 click → `clearTagCount()` | ✅ 구현됨 | - |
| 같은 기기, 알림 dismiss | 알림 close → `clearTagCount()` | ✅ 구현됨 | - |
| 다른 기기 간 동기화 | Silent push / FCM data message | ❌ 미구현 | P2 (Signal도 미완성) |
| 앱 뱃지 동기화 | `navigator.setAppBadge()` + SW sync | ✅ 구현됨 | - |

## 3. 수정 로드맵

### Phase 1: "Clear on Read" 핵심 수정 (P0, 예상 작업량: 소)

> 앱에서 메시지를 읽으면 안드로이드 알림 트레이의 해당 채팅방 알림을 즉시 제거

#### 1-1. SW에 `CLEAR_NOTIFICATIONS` 메시지 핸들러 추가

**파일**: `public/sw.js`

```javascript
// message handler에 추가 (기존 SYNC_BADGE, CLEAR_BADGE와 동일 패턴)
case "CLEAR_NOTIFICATIONS": {
  const tag = event.data.tag;
  if (tag) {
    const existing = await self.registration.getNotifications({ tag });
    existing.forEach((n) => n.close());
    await clearTagCount(tag);
  }
  break;
}
```

#### 1-2. `markAsRead` 성공 시 SW에 알림 정리 메시지 전송

**파일**: `lib/domains/chat/hooks/useChatRoomLogic.ts`

```typescript
// markAsReadMutation.onMutate 또는 onSuccess에서:
const tag = `chat-${roomId}`;
navigator.serviceWorker?.controller?.postMessage({
  type: "CLEAR_NOTIFICATIONS",
  tag,
});
```

#### 1-3. 채팅방 진입 시에도 정리 (이미 읽은 알림)

**파일**: `lib/domains/chat/hooks/useChatRoomLogic.ts` (또는 ChatRoom 컴포넌트)

채팅방 마운트 시 해당 tag의 알림을 정리하여 이전 세션에서 남은 stale 알림도 제거.

### Phase 2: 견고성 강화 (P1, 예상 작업량: 소)

#### 2-1. IndexedDB tag_counts도 함께 정리

Phase 1에서 `clearTagCount(tag)`는 이미 포함되어 있으나,
iOS에서 `getNotifications()`가 빈 배열을 반환하는 경우에도
IndexedDB의 `tag_counts`가 리셋되도록 보장.

#### 2-2. 탭 복귀 시 stale 알림 정리

**파일**: `lib/domains/push/hooks/useAppBadge.ts`

`visibilitychange` 이벤트에서 뱃지 동기화 시,
`unreadCount === 0`인 채팅방의 tag에 대해 `CLEAR_NOTIFICATIONS` 전송.

```typescript
// syncBadge() 내부에서
const rooms = queryClient.getQueryData(chatKeys.rooms());
rooms?.forEach((room) => {
  if (room.unreadCount === 0) {
    navigator.serviceWorker?.controller?.postMessage({
      type: "CLEAR_NOTIFICATIONS",
      tag: `chat-${room.id}`,
    });
  }
});
```

#### 2-3. mention 알림도 정리

채팅방 읽음 처리 시 `chat-mention-{roomId}` tag도 함께 정리.

### Phase 3: 크로스 디바이스 동기화 (P2, 예상 작업량: 중)

> Signal도 아직 완전히 해결하지 못한 영역. 우선순위 낮음.

#### 3-1. Realtime 기반 알림 정리

다른 기기에서 `markAsRead` → Supabase Realtime broadcast →
현재 기기의 SW에 `CLEAR_NOTIFICATIONS` 전송.

**장점**: 추가 push 비용 없음, 앱이 열려있을 때 즉시 반영
**단점**: 앱이 백그라운드일 때는 동작 안 함

#### 3-2. Server-Sent Dismiss Push (선택적)

`markAsRead` 시 서버가 다른 기기들에 `type: "dismiss"` push 전송.

**주의**: Web Push 스펙상 push 이벤트에서 `showNotification()`을 호출해야 하므로,
빈 알림을 잠깐 표시 후 즉시 닫는 트릭이 필요하거나,
`showNotification()` 호출 없이 진행 시 Chrome이 자동 알림을 생성할 수 있음.

→ 실용적으로는 Phase 3-1 (Realtime 기반)이 더 적합

## 4. 구현 우선순위 & 체크리스트

```
Phase 1 (P0 — 핵심 수정) ✅ 완료
├── [x] sw.js: CLEAR_NOTIFICATIONS 메시지 핸들러 추가
├── [x] useChatRoomLogic.ts: markAsRead onMutate에서 SW postMessage
├── [x] ChatRoom 마운트 시 해당 tag 알림 정리
└── [ ] 테스트: 앱에서 읽고 → 새 메시지 수신 → 카운트 1부터 시작 확인

Phase 2 (P1 — 견고성) ✅ 완료
├── [x] iOS Safari fallback (getNotifications 미지원 시 IndexedDB만 정리)
├── [x] visibilitychange 시 unreadCount=0인 방의 알림 정리
├── [x] chat-mention-{roomId} tag도 함께 정리
└── [ ] 뱃지 카운트와 알림 트레이 카운트 일관성 검증

Phase 2.5 (Pattern B — 서버 카운트 안전장치) ✅ 완료
├── [x] PushPayload에 unreadCount 필드 추가 (send.ts)
├── [x] 라우터에서 채팅 알림 발송 시 DB 기반 unread count 조회 (router.ts)
├── [x] SW에서 서버 unreadCount 우선 사용, 없으면 로컬 누적 fallback (sw.js)
└── [ ] 서버 카운트 정확성 검증

Phase 3 (P2 — 크로스 디바이스, 선택)
├── [ ] Realtime READ_RECEIPT 이벤트 수신 시 SW에 CLEAR 전송
└── [ ] 멀티 디바이스 시나리오 테스트
```

## 5. 참고 자료

| 자료 | 링크 |
|------|------|
| web.dev - Notification behavior | https://web.dev/articles/push-notifications-notification-behaviour |
| MDN - Push API Best Practices | https://developer.mozilla.org/en-US/docs/Web/API/Push_API/Best_Practices |
| MDN - showNotification() | https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification |
| Signal Issue #11950 | https://github.com/signalapp/Signal-Android/issues/11950 |
| Signal Issue #717 | https://github.com/signalapp/Signal-Desktop/issues/717 |
| Progressier - Replace notifications | https://intercom.help/progressier/en/articles/6582394 |
| WebKit - Declarative Web Push | https://webkit.org/blog/16535/meet-declarative-web-push/ |
