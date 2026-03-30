# Chat Domain Rules

## Scope
실시간 메시징: 채팅방, 메시지, 리액션, 핀, 멤버, 첨부파일, 이미지 리사이즈, 링크 프리뷰, 예약 메시지, 안전/신고, 스토리지 쿼터, 동시성 제어.

## Architecture
```
chat/
├── types.ts              # ChatRoomType, MessageStatus, PresenceUser 등
├── repository/           # 모듈화된 repo (11파일): rooms, messages, members, attachments, pins, reactions, senders, linkPreviews, safety
├── service/              # 모듈화된 서비스 (11파일): rooms, messages, members, pins, reactions, announcements, safety
├── actions/              # Server Actions: rooms, messages, members, attachments, pins, reactions, safety
├── hooks/                # useChatMode, useChatRoomLogic, useTotalUnreadCount
├── scheduled/            # processScheduledMessages, 예약 메시지 처리
├── operationTracker.ts   # 싱글톤: 낙관적 업데이트 ↔ Realtime 이벤트 경합 방지
├── quota.ts              # 역할별 스토리지 한도 (student=500MB, admin=2GB, parent=200MB)
├── imageResize.ts        # 클라이언트 이미지 리사이즈 (Web Worker)
├── fileValidation.ts     # 업로드 파일 검증
├── mimeVerification.ts   # 서버 측 MIME 타입 검증
├── messageGrouping.ts    # 메시지 그룹핑 로직
├── linkPreview.ts        # URL 프리뷰 추출
├── queryKeys.ts          # React Query 키 상수
└── localCache.ts         # 로컬 캐시 레이어
```

## Enforced Rules

1. **operationTracker**: **낙관적 업데이트를 하는** mutation에만 필요. 낙관적 업데이트 없이 Server Action만 호출하는 경우(예: ForwardModal)는 불필요 — Realtime과 충돌할 클라이언트 메시지가 없기 때문. 적용 대상: useChatRoomLogic의 send/edit/delete mutation (캐시 직접 조작). 비적용: 순수 서버 호출(sendMessageAction 단독 사용).
2. **스토리지 쿼터 체크**: 파일 업로드 전 `isQuotaExceeded()` 확인. 역할별 한도 상이. `getStorageLimitForRole()` 사용.
3. **이미지 리사이즈**: 업로드 전 Web Worker로 클라이언트 리사이즈. 원본 고해상도 이미지 업로드 금지.
4. **MIME 서버 검증**: 파일 확장자가 아닌 `mimeVerification.ts`로 서버 측 MIME 타입 검증.
5. **모듈화 패턴**: repository/와 service/의 모듈 구조(rooms, messages, members...)가 정식 아키텍처. 레거시 단일 파일 패턴 지양.
6. **Realtime**: Supabase Realtime 채널. 클라이언트 낙관적 업데이트 → Realtime 이벤트로 reconcile.

## Tests
```bash
pnpm test lib/domains/chat
```

## Related Domains
- `notification`: 채팅 이벤트 → 인앱/푸시 알림 트리거.
- `push`: 푸시 알림 전송.
