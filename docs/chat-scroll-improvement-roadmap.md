# 채팅방 스크롤 개선 로드맵

> 하이엔드 사용성을 위한 채팅 스크롤 종합 개선 계획
> 작성일: 2026-03-13

## 현황 요약

| 영역 | 현재 수준 | 목표 수준 | 참고 |
|------|-----------|-----------|------|
| 키보드 스크롤 보정 | 100ms 고정 타임아웃 | 적응형 보정 + 애니메이션 동기화 | iOS Safari 특수 처리 필요 |
| 스크롤 위치 복원 | 없음 (매번 unread divider/최하단) | 방별 앵커 저장/복원 | WhatsApp/Telegram 수준 |
| 이미지 레이아웃 시프트 | 고정 aspect-ratio (4:3) | 실제 치수 기반 + BlurHash | DB에 width/height 이미 존재 |
| 메모리/성능 | 양호 (LRU, 배치 버퍼) | 디바이스 적응형 버퍼 | 저사양 모바일 최적화 |
| 접근성 | 기본 (aria-live, role=log) | 키보드 네비게이션 추가 | WCAG 2.1 AA 충족 |

---

## Phase 0: 이미지 레이아웃 시프트 제거 (P0 — 체감 최대)

### 배경

현재 `AttachmentRenderer.tsx`는 이미지 개수에 따라 **고정 aspect-ratio**를 사용:
- 1장: `aspect-[4/3] max-h-64`
- 2장: `aspect-square`
- 3장+: `aspect-[3/4]` / `aspect-square`

그러나 DB에 이미 `width`/`height` 필드가 존재하고, 업로드 시 `imageResize.ts`에서 실제 치수를 추출하여 저장하고 있음. **이 데이터가 렌더링에 활용되지 않고 있음.**

### 현재 문제

1. **CLS(Cumulative Layout Shift)**: `defaultItemHeight=80px`이지만 이미지 메시지는 ~260px → 첫 측정 시 180px 차이로 스크롤 점프
2. **고정 비율 왜곡**: 세로 이미지(3:4)를 가로 비율(4:3)로 표시 → 잘림/왜곡
3. **이미지 URL 갱신 경합**: 10+ 이미지 동시 로드 → signed URL 갱신 cascade → 연쇄 layout shift

### 개선 계획

#### Step 0-1: 실제 치수 기반 aspect-ratio 적용

```
변경 파일: components/chat/atoms/AttachmentRenderer.tsx
```

- `ChatAttachment.width`/`height`가 존재하면 `aspect-ratio: {w}/{h}` CSS 사용
- 없으면 기존 고정 비율 fallback
- `max-h-80`(320px)으로 상한 제한, `min-h-20`(80px)으로 하한 보장
- 예상 효과: 이미지 로드 전후 높이 변화 **0px** (CLS 완전 제거)

#### Step 0-2: Skeleton 개선 (BlurHash 준비)

```
변경 파일: components/chat/atoms/AttachmentRenderer.tsx
신규 파일: (없음 — CSS만 변경)
```

- 현재: `animate-pulse` 회색 박스
- 개선: 실제 치수 기반으로 정확한 크기의 skeleton → 로드 완료 시 fade-in
- `transition-opacity duration-300`으로 부드러운 전환

#### Step 0-3: Virtuoso `defaultItemHeight` 개선

```
변경 파일: components/chat/organisms/ChatRoom.tsx
```

- 메시지 타입별 예상 높이를 제공하는 `estimateSize` 함수 도입:
  - `text` → 72px
  - `image` (1장, w/h 있음) → 실제 비율 기반 계산
  - `image` (1장, w/h 없음) → 200px (현재 80px보다 정확)
  - `file` → 64px
  - `mixed` → 240px
- Virtuoso의 `computeItemKey`와 함께 `defaultItemHeight`를 동적으로 제공

#### Step 0-4: (후순위) BlurHash 서버 생성 + 렌더링

```
변경 파일: lib/domains/chat/actions/attachments.ts (생성 시 blurhash 계산)
DB 마이그레이션: chat_attachments에 blur_hash TEXT 컬럼 추가
신규 컴포넌트: components/chat/atoms/BlurhashPlaceholder.tsx
```

- 업로드 시 서버에서 `blurhash` 문자열 생성 (4x3 component, ~30byte)
- 렌더링 시 `<canvas>`로 blurhash → 이미지 로드 완료 시 swap
- 기존 이미지는 null → 기존 skeleton fallback
- **리서치 결과**: WhatsApp/Telegram 모두 서버에서 thumbnail+dimensions을 메시지와 함께 전달

### 검증 기준

- [ ] PerformanceObserver로 CLS 측정: chat 스크롤 중 layout-shift 0.05 미만
- [ ] 이미지 20장 포함 대화방에서 초기 로드 시 스크롤 점프 없음
- [ ] 고속 스크롤(scrollSeek 모드) 진입/퇴장 시 위치 정확

---

## Phase 1: 스크롤 위치 복원 (P0 — UX 핵심)

### 배경

현재 채팅방 이탈 후 복귀 시:
1. React Query 캐시 유효(60s) → `initialScrollIndex`로 이동 (unread divider or 최하단)
2. 캐시 만료 → refetch → 최하단으로 리셋
3. 브라우저 뒤로가기 → Virtuoso 재마운트 → 위치 유실

**WhatsApp/Telegram**: 방별 `{ messageId, scrollOffset }`를 IndexedDB에 저장, 복귀 시 해당 위치로 정확히 복원.

### 개선 계획

#### Step 1-1: 세션 기반 스크롤 앵커 저장

```
변경 파일: components/chat/organisms/ChatRoom.tsx
변경 파일: lib/domains/chat/hooks/useChatRoomLogic.ts
```

- Virtuoso의 `rangeChanged` 콜백에서 현재 보이는 **첫 번째 메시지 ID** + **offset from top** 추적
- `sessionStorage`에 `chat-scroll-anchor:${roomId}` 키로 저장 (throttle 1s)
- 저장 형식: `{ messageId: string, offsetFromTop: number, timestamp: number }`

#### Step 1-2: 복원 로직

```
변경 파일: components/chat/organisms/ChatRoom.tsx
```

복원 우선순위:
1. **세션 앵커** (< 5분 이내) → 해당 messageId의 index 찾아 `scrollToIndex({ index, align: 'start', offset })`
2. **Unread divider** → 기존 로직 유지
3. **최하단** → 기존 fallback

```typescript
// 의사 코드
const anchor = sessionStorage.getItem(`chat-scroll-anchor:${roomId}`);
if (anchor && Date.now() - anchor.timestamp < 5 * 60 * 1000) {
  const index = messages.findIndex(m => m.id === anchor.messageId);
  if (index >= 0) {
    initialTopMostItemIndex = index; // + offset 보정
  }
}
```

#### Step 1-3: History API 연동

```
변경 파일: components/chat/pages/ChatRoomPageWrapper.tsx
```

- `history.scrollRestoration = 'manual'` 설정 (Next.js App Router 기본 복원 비활성화)
- `beforeunload` / 라우트 변경 시 현재 앵커를 `history.state`에 저장
- `popstate` (뒤로가기) 시 앵커 복원

#### Step 1-4: 메시지 ID 앵커가 없는 경우 대응

- 앵커 메시지가 삭제된 경우 → 가장 가까운 이전 메시지로 fallback
- 앵커 메시지가 다른 페이지에 있는 경우 → `around` 커서로 해당 메시지 주변 로드
- React Query의 `initialPageParam`을 앵커 기반으로 동적 설정

### 검증 기준

- [ ] 채팅방 A → B → A 이동 시 A의 스크롤 위치 정확히 복원
- [ ] 브라우저 뒤로가기 시 이전 스크롤 위치 복원
- [ ] 5분 이상 경과한 앵커는 무시하고 최하단/unread divider로 이동
- [ ] 앵커 메시지 삭제 시 graceful fallback

---

## Phase 2: 키보드 스크롤 보정 고도화 (P1)

### 배경

현재 문제:
1. **100ms 고정 타임아웃**: 저사양 기기에서 키보드 애니메이션 미완료 시 실행
2. **isAtBottomRef 체크 시점**: 타임아웃 설정 시점이 아닌 실행 시점에 체크 → 100ms 사이 사용자가 스크롤했으면 불필요한 하단 이동
3. **Virtuoso followOutput과 이중 스크롤**: 키보드 열림 → 컨테이너 리사이즈 → Virtuoso followOutput 자동 스크롤 + 100ms 후 명시적 scrollToIndex → 두 번 스크롤
4. **RAF 폴링과 setTimeout 비동기화**: useVisualViewport의 500ms RAF 폴링과 ChatRoom의 100ms setTimeout이 독립 실행

### 리서치 결과 (업계 동향)

| 앱 | 접근법 |
|----|--------|
| WhatsApp Web | visualViewport resize 직접 반응, setTimeout 없음, `scrollTop = scrollHeight` 동기 호출 |
| Telegram | 50ms debounce로 키보드 상태 필터링, CSS `scroll-behavior: smooth` 활용 |
| Slack | ResizeObserver on chat input container, `<input>` focus state 병행 모니터링 |

### 개선 계획

#### Step 2-1: 적응형 보정 타이밍

```
변경 파일: components/chat/organisms/ChatRoom.tsx (키보드 effect)
변경 파일: lib/hooks/useVisualViewport.ts
```

- useVisualViewport에 **안정화 감지** 추가: 연속 2프레임 동안 height 변화 < 2px → `isStabilized: true`
- ChatRoom에서 `isStabilized`를 기다린 후 스크롤 보정 (100ms 고정 대신)
- Fallback 최대 대기: 600ms (기기가 너무 느린 경우)

```typescript
// useVisualViewport 반환값 확장
interface VisualViewportState {
  height: number;
  offsetTop: number;
  keyboardHeight: number;
  isKeyboardOpen: boolean;
  isStabilized: boolean;  // NEW: 뷰포트 크기가 안정화되었는지
}
```

#### Step 2-2: 스크롤 의도 캡처

```
변경 파일: components/chat/organisms/ChatRoom.tsx
```

- 키보드 열림 감지 시점에 `wasAtBottom`을 캡처 (현재의 `isAtBottomRef.current` 스냅샷)
- 안정화 후 `wasAtBottom`이 true였을 때만 하단 스크롤 실행
- Virtuoso `followOutput`과의 이중 스크롤 방지: `followOutput` 콜백 내에서 키보드 전환 중이면 skip

#### Step 2-3: Virtuoso followOutput과 협조

```
변경 파일: components/chat/organisms/ChatRoom.tsx
```

- 키보드 전환 중(`isKeyboardOpen` 변경 후 안정화 전) → `followOutput` 반환값을 `false`로 강제
- 안정화 후 명시적 `scrollToIndex` 1회만 실행
- 이중 스크롤 경합 근본 제거

#### Step 2-4: Android `interactive-widget` 메타 태그

```
변경 파일: app/layout.tsx (viewport meta)
```

- Android Chrome 108+에서 `<meta name="viewport" content="..., interactive-widget=resizes-content">` 추가 검토
- iOS에는 영향 없음, Android에서 키보드가 layout viewport를 리사이즈하도록 명시적 opt-in
- 테스트 후 적용 여부 결정 (기존 dvh 동작과 충돌 가능)

### 검증 기준

- [ ] iOS Safari (iPhone SE ~ 15 Pro Max): 키보드 열기/닫기 시 스크롤 점프 없음
- [ ] Android Chrome: 키보드 열기 시 입력창 가려짐 없음
- [ ] 키보드 열린 상태에서 위로 스크롤 → 키보드 닫기 → 스크롤 위치 유지 (하단 이동 안 함)
- [ ] 빠른 키보드 토글(focus→blur→focus) 시 떨림 없음

---

## Phase 3: 성능 최적화 & 메모리 관리 (P1)

### 3-1: 디바이스 적응형 Virtuoso 버퍼

```
변경 파일: components/chat/organisms/ChatRoom.tsx
```

현재: `increaseViewportBy={{ top: 1500, bottom: 800 }}` (고정)

개선:
```typescript
const bufferSize = useMemo(() => {
  // 저사양 기기 감지 (navigator.deviceMemory, hardwareConcurrency)
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const isLowEnd = mem <= 2 || cores <= 2;

  return isLowEnd
    ? { top: 600, bottom: 400 }    // 저사양: DOM 노드 절약
    : { top: 1500, bottom: 800 };  // 고사양: 현재 값 유지
}, []);
```

### 3-2: messageRefs Map 메모리 누수 방지

```
변경 파일: components/chat/organisms/ChatRoom.tsx
```

현재: `Map<string, HTMLDivElement>` — Virtuoso가 아이템을 언마운트해도 ref 콜백이 `null`로 호출되어 삭제됨 (정상 동작).

하지만 Edge case: Virtuoso의 `scrollSeekConfiguration` 활성화 중에는 placeholder로 대체되므로 원본 ref 콜백이 호출되지 않을 수 있음.

개선:
- `scrollSeekConfiguration.exit` 시점에 Map 크기가 `messages.length`의 2배를 초과하면 GC 수행
- 또는 Map 대신 WeakRef 기반 참조 사용 (브라우저 지원 확인 필요)

### 3-3: 이미지 치수 인메모리 캐시

```
신규 파일: lib/domains/chat/imageDimensionCache.ts
```

- 모듈 레벨 `Map<attachmentId, { width, height }>` (최대 300항목)
- Virtuoso의 `defaultItemHeight` 계산 시 캐시 참조
- 이미지 로드 완료 시 `naturalWidth`/`naturalHeight`로 캐시 갱신
- Virtuoso 재마운트 시에도 캐시 유지 (모듈 레벨)

### 3-4: scrollSeek 임계값 적응형 조정

현재: enter 800px/s, exit 100px/s (고정)

개선:
```typescript
const scrollSeekConfig = useMemo(() => ({
  enter: (velocity: number) => Math.abs(velocity) > (isLowEnd ? 500 : 800),
  exit: (velocity: number) => Math.abs(velocity) < (isLowEnd ? 200 : 100),
}), [isLowEnd]);
```

저사양 기기에서 더 빨리 placeholder 모드 진입 → DOM 부하 감소

### 검증 기준

- [ ] Chrome DevTools Memory → 1000메시지 로드 후 Heap snapshot 비교
- [ ] 저사양 기기(4GB RAM) 시뮬레이션에서 FPS 60 유지
- [ ] messageRefs Map 크기가 visible range + buffer 이내로 유지

---

## Phase 4: 접근성 고도화 (P2)

### 4-1: 키보드 네비게이션

```
변경 파일: components/chat/organisms/ChatRoom.tsx
```

- `ArrowUp`/`ArrowDown`: 메시지 간 포커스 이동
- `Enter`/`Space`: 포커스된 메시지에서 컨텍스트 메뉴 열기
- `Escape`: 메시지 포커스 해제, 입력창으로 돌아가기
- `Home`/`End`: 첫 메시지/마지막 메시지로 이동
- `roving tabindex` 패턴 적용 (현재 포커스된 메시지만 `tabIndex={0}`)

### 4-2: 스크린리더 개선

```
변경 파일: components/chat/atoms/ScreenReaderAnnouncer.tsx
변경 파일: components/chat/organisms/ChatRoom.tsx
```

- 새 메시지 도착 시 `aria-live="polite"` 알림 (현재 연결 상태만 알림)
- 스크롤 위치 맥락: "50개 중 30번째 메시지" 형태의 위치 정보
- 이미지 메시지: alt 텍스트에 치수 정보 포함 ("이미지 1920x1080")

### 4-3: 포커스 관리

- 메시지 검색 후 검색 결과로 포커스 이동
- 컨텍스트 메뉴 닫힘 시 원래 메시지로 포커스 복원
- 채팅방 진입 시 입력창에 자동 포커스 (현재 구현됨 ✅)

### 검증 기준

- [ ] VoiceOver (iOS) / TalkBack (Android)에서 메시지 탐색 가능
- [ ] 키보드만으로 모든 메시지 액션 수행 가능
- [ ] axe-core 자동 검사 통과

---

## Phase 5: 고급 최적화 (P3 — 차별화)

### 5-1: PerformanceObserver 기반 CLS 자동 모니터링

```
신규 파일: lib/hooks/useCLSMonitor.ts
```

- 개발 모드에서 `PerformanceObserver({ type: 'layout-shift' })` 활성화
- 채팅 컨테이너 내 CLS 누적값 콘솔 출력
- 0.1 초과 시 warning, 어떤 요소가 shift를 유발했는지 로깅

### 5-2: 오프라인 → 온라인 복귀 시 스크롤 동기화

```
변경 파일: lib/domains/chat/hooks/useChatRoomLogic.ts
```

현재: reconnect 시 `refetchOnReconnect` → 전체 재로드
개선:
- 오프라인 중 마지막으로 본 메시지 ID 저장
- 온라인 복귀 시 `getMessagesSinceAction`으로 delta만 로드
- 스크롤 위치 유지하면서 새 메시지만 append

### 5-3: 타이핑 인디케이터 스크롤 영향 제거

현재: `<TypingIndicator>`가 Virtuoso 외부, ChatInput 위에 렌더됨 (✅ 이미 적절)
하지만: 인디케이터 표시/숨김 시 입력창 위치가 미세하게 변동

개선:
- 타이핑 인디케이터에 고정 높이(`h-6`) 예약, 내용 없을 때 `invisible` (현재 조건부 렌더링)
- 또는 `min-h-6` + `opacity` 전환으로 레이아웃 시프트 방지

### 5-4: PWA standalone 모드 특화

```
변경 파일: components/chat/pages/ChatRoomPageWrapper.tsx
```

- `display-mode: standalone` 감지 시 `env(safe-area-inset-bottom)` 추가 적용
- iOS notch/Dynamic Island 영역 고려
- 홈 인디케이터 영역과 입력창 겹침 방지

---

## 우선순위 & 일정 추정

| Phase | 우선순위 | 복잡도 | 파일 수 | 의존성 |
|-------|----------|--------|---------|--------|
| **Phase 0**: 이미지 CLS 제거 | P0 | 낮음~중간 | 2~3 | 없음 (DB 컬럼 이미 존재) |
| **Phase 1**: 스크롤 위치 복원 | P0 | 중간 | 3~4 | Phase 0 권장 (높이 정확도 향상) |
| **Phase 2**: 키보드 보정 고도화 | P1 | 중간 | 2~3 | 없음 |
| **Phase 3**: 성능/메모리 | P1 | 낮음 | 2~3 | 없음 |
| **Phase 4**: 접근성 | P2 | 중간 | 3~4 | 없음 |
| **Phase 5**: 고급 최적화 | P3 | 중간~높음 | 4~5 | Phase 0~2 완료 후 |

### 권장 실행 순서

```
Phase 0 (이미지 CLS) → Phase 1 (위치 복원) → Phase 2 (키보드) → Phase 3 (성능) → Phase 4 (접근성) → Phase 5 (고급)
```

Phase 0이 최우선인 이유:
1. **이미 DB에 width/height 데이터 존재** → 서버 변경 없이 클라이언트만 수정
2. 이미지 CLS 제거가 Phase 1(위치 복원)의 정확도를 높임 (높이 추정이 정확해야 앵커 복원이 정확)
3. 사용자 체감 개선이 가장 즉각적

---

## 참고 자료

### 업계 벤치마크 (WhatsApp / Telegram / Slack)

| 기능 | WhatsApp Web | Telegram Web | Slack | 현재 (TimeLevelUp) |
|------|-------------|-------------|-------|-------------------|
| 이미지 치수 pre-reserve | ✅ 서버 제공 w/h | ✅ 썸네일 + 치수 | ✅ media_metadata | ⚠️ DB에 존재, 미사용 |
| BlurHash/LQIP | ✅ LQIP | ✅ 썸네일 프리뷰 | ❌ | ❌ |
| 스크롤 위치 복원 | ✅ IndexedDB | ✅ message ID 앵커 | ✅ last_read_timestamp | ❌ |
| 키보드 보정 | ✅ 동기 scrollTop | ✅ 50ms debounce | ✅ ResizeObserver | ⚠️ 100ms setTimeout |
| 키보드 네비게이션 | ✅ Arrow keys | ✅ Arrow keys | ✅ Arrow keys | ❌ |
| 디바이스 적응형 버퍼 | ✅ | 불명 | ✅ lazy loading | ❌ (고정값) |

### 기술 참고

- [Visual Viewport API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)
- [react-virtuoso 공식 문서](https://virtuoso.dev/)
- [CLS 측정 가이드 (web.dev)](https://web.dev/articles/cls)
- [BlurHash 알고리즘](https://blurha.sh/)
- [Slack 성능 최적화 사례](https://slack.engineering/making-slack-faster-by-being-lazy/)
- [iOS Safari 키보드 특수 동작](https://blog.opendigerati.com/the-eccentric-ways-of-ios-safari-with-the-keyboard-b5aa3f34228d)
- [Chrome interactive-widget 메타 태그](https://developer.chrome.com/blog/viewport-resize-behavior)
