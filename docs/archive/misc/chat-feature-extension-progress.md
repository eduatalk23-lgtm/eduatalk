# 채팅 도메인 기능 확장 작업 기록

> **마지막 업데이트**: 2026-01-15
> **현재 상태**: Phase 4.3 채팅방 공지 완료 ✅

---

## 전체 진행 현황

| Phase | 기능 | 상태 | 비고 |
|-------|------|------|------|
| Phase 1 | 메시지 검색, 편집, 읽음 표시 | ✅ 완료 | 빌드/린트 검증 통과 |
| Phase 2 | 타이핑 인디케이터, 온라인 상태 | ✅ 완료 | Supabase Presence API |
| Phase 3 | 메시지 리액션 (이모지) | ✅ 완료 | 빌드/린트 검증 통과 |
| Phase 4.1 | 메시지 답장 (Reply) | ✅ 완료 | 빌드/린트 검증 통과 |
| Phase 4.2 | 메시지 고정 (Pin) | ✅ 완료 | 빌드/린트 검증 통과 |
| Phase 4.3 | 채팅방 공지 (Announcement) | ✅ 완료 | 빌드/린트 검증 통과 |

---

## Phase 1 완료 (메시지 검색, 편집, 읽음 표시)

### 구현된 기능
1. **메시지 검색**: pg_trgm 인덱스 기반 채팅방 내 키워드 검색
2. **메시지 편집**: 5분 이내 본인 메시지 수정 가능, "(수정됨)" 표시
3. **읽음 표시**: 카카오톡 스타일 "1" 표시 (안 읽은 멤버 수)

### 수정된 파일
- `supabase/migrations/xxx_add_chat_search.sql` - trigram 인덱스
- `lib/domains/chat/types.ts` - SearchMessagesOptions, SearchMessagesResult
- `lib/domains/chat/repository.ts` - searchMessagesByRoom(), findMessagesWithReadStatus()
- `lib/domains/chat/service.ts` - editMessage(), searchMessages(), getMessagesWithReadStatus()
- `lib/domains/chat/actions/messages.ts` - editMessageAction(), searchMessagesAction()
- `components/chat/atoms/MessageBubble.tsx` - isEdited, unreadCount props
- `components/chat/molecules/MessageSearch.tsx` - 신규 검색 UI
- `components/chat/organisms/ChatRoom.tsx` - 검색/읽음 통합

---

## Phase 2 완료 (타이핑 인디케이터, 온라인 상태)

### 구현된 기능
1. **타이핑 인디케이터**: "○○님이 입력 중..." (2초 자동 해제)
2. **온라인 상태**: 1:1 채팅은 녹색 점, 그룹 채팅은 "n명 온라인"

### 기술 선택
- **Supabase Presence API**: ephemeral 상태 관리 (DB 불필요)
- 자동 cleanup (연결 끊김 시 자동 제거)

### 신규 생성 파일
| 파일 | 역할 |
|------|------|
| `lib/realtime/useChatPresence.ts` | Presence 훅 (타이핑/온라인 상태) |
| `components/chat/atoms/TypingIndicator.tsx` | "입력 중" 표시 컴포넌트 |
| `components/chat/atoms/OnlineStatus.tsx` | 녹색 점 표시 컴포넌트 |

### 수정된 파일
| 파일 | 변경 내용 |
|------|-----------|
| `lib/domains/chat/types.ts` | PresenceUser 타입 추가 |
| `lib/realtime/index.ts` | useChatPresence export 추가 |
| `components/chat/molecules/ChatInput.tsx` | onTypingChange prop 추가 |
| `components/chat/organisms/ChatRoom.tsx` | Presence 통합, 인디케이터 표시 |

---

## Phase 3 완료 (메시지 리액션)

### 구현된 기능
메시지에 이모지 리액션 추가/삭제 (👍❤️😂🔥😮)
- 리액션 토글 (클릭 시 추가/삭제)
- 리액션 카운트 표시
- 본인 리액션 강조 표시
- 실시간 동기화

### 완료된 작업

#### 1. DB 마이그레이션 ✅
**파일**: `supabase/migrations/20260116100000_add_chat_reactions.sql`

```sql
CREATE TABLE IF NOT EXISTS chat_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('student', 'admin')),
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, user_type, emoji)
);
```

#### 2. 타입 정의 ✅
**파일**: `lib/domains/chat/types.ts`

- `REACTION_EMOJIS` - 지원 이모지 목록
- `ReactionEmoji` - 이모지 타입
- `MessageReaction` - 리액션 엔티티
- `ReactionSummary` - UI 표시용 요약
- `ReactionToggleInput` - 토글 입력
- `ChatMessageWithSender.reactions` - 메시지에 리액션 추가

#### 3. Repository 함수 ✅
**파일**: `lib/domains/chat/repository.ts`

```typescript
// 리액션 추가
export async function insertReaction(input: {...}): Promise<void>

// 리액션 삭제
export async function deleteReaction(input: {...}): Promise<void>

// 리액션 존재 확인 (토글용)
export async function hasReaction(input: {...}): Promise<boolean>

// 메시지별 리액션 조회 (배치)
export async function findReactionsByMessageIds(messageIds: string[]): Promise<Map<string, MessageReaction[]>>
```

#### 4. Service 함수 ✅
**파일**: `lib/domains/chat/service.ts`

```typescript
// 리액션 목록을 요약으로 변환
function convertReactionsToSummaries(reactions, currentUserId, currentUserType): ReactionSummary[]

// 리액션 토글 (있으면 삭제, 없으면 추가)
export async function toggleReaction(userId, userType, input): Promise<ChatActionResult<{ added: boolean }>>
```

- `getMessagesWithReadStatus`에 리액션 조회 통합

#### 5. Server Action ✅
**파일**: `lib/domains/chat/actions/reactions.ts` (신규)

```typescript
export async function toggleReactionAction(
  messageId: string,
  emoji: ReactionEmoji
): Promise<ChatActionResult<{ added: boolean }>>
```

**파일**: `lib/domains/chat/actions/index.ts`
- `toggleReactionAction` export 추가

#### 6. UI 컴포넌트 ✅
**파일**: `components/chat/atoms/ReactionPills.tsx` (신규)
- 메시지 하단에 리액션 요약 표시 (👍 3  ❤️ 2)
- 클릭 시 토글

**파일**: `components/chat/atoms/ReactionPicker.tsx` (신규)
- 이모지 선택 팝업 [👍] [❤️] [😂] [🔥] [😮]
- 외부 클릭/ESC로 닫기

#### 7. MessageBubble 수정 ✅
**파일**: `components/chat/atoms/MessageBubble.tsx`

```typescript
// Props 추가
reactions?: ReactionSummary[];
onToggleReaction?: (emoji: ReactionEmoji) => void;

// UI: 메시지 버블 하단에 ReactionPills 표시
// 호버 시 + 버튼으로 ReactionPicker 열기
```

#### 8. ChatRoom 통합 ✅
**파일**: `components/chat/organisms/ChatRoom.tsx`

```typescript
// 리액션 mutation 추가
const reactionMutation = useMutation({
  mutationFn: ({ messageId, emoji }) => toggleReactionAction(messageId, emoji),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["chat-messages", roomId] });
  },
});

// MessageBubble에 props 전달
<MessageBubble
  reactions={message.reactions ?? []}
  onToggleReaction={(emoji) => reactionMutation.mutate({ messageId: message.id, emoji })}
/>
```

#### 9. 실시간 구독 ✅
**파일**: `lib/realtime/useChatRealtime.ts`

```typescript
// chat_message_reactions 테이블 구독 추가
.on("postgres_changes", {
  event: "INSERT",
  schema: "public",
  table: "chat_message_reactions",
}, () => invalidateMessages())
.on("postgres_changes", {
  event: "DELETE",
  schema: "public",
  table: "chat_message_reactions",
}, () => invalidateMessages())
```

#### 10. 빌드/린트 검증 ✅
```bash
pnpm lint && pnpm build  # 통과
```

---

## 전체 파일 변경 목록 (Phase 3)

| 파일 | 상태 | 변경 내용 |
|------|------|-----------|
| `supabase/migrations/20260116100000_*.sql` | ✅ 완료 | reactions 테이블 |
| `lib/domains/chat/types.ts` | ✅ 완료 | ReactionSummary 등 타입, ChatMessageWithSender.reactions 추가 |
| `lib/domains/chat/repository.ts` | ✅ 완료 | 리액션 CRUD 함수 4개 추가 |
| `lib/domains/chat/service.ts` | ✅ 완료 | toggleReaction, convertReactionsToSummaries, getMessagesWithReadStatus 수정 |
| `lib/domains/chat/actions/reactions.ts` | ✅ 완료 | 신규 Server Action |
| `lib/domains/chat/actions/index.ts` | ✅ 완료 | toggleReactionAction export 추가 |
| `lib/realtime/useChatRealtime.ts` | ✅ 완료 | reactions 구독 추가 |
| `components/chat/atoms/ReactionPills.tsx` | ✅ 완료 | 신규 컴포넌트 |
| `components/chat/atoms/ReactionPicker.tsx` | ✅ 완료 | 신규 컴포넌트 |
| `components/chat/atoms/MessageBubble.tsx` | ✅ 완료 | reactions prop 추가, ReactionPills/Picker 통합 |
| `components/chat/organisms/ChatRoom.tsx` | ✅ 완료 | reactionMutation 추가 |

---

## 테스트 시나리오

### Phase 3 (리액션)
1. 메시지에 👍 클릭 → 리액션 추가 확인
2. 같은 이모지 다시 클릭 → 리액션 제거 확인
3. 여러 사용자가 같은 이모지 → 카운트 증가 확인
4. 본인 리액션 → 강조 표시 확인
5. 다른 브라우저에서 실시간 업데이트 확인

### Phase 4.2 (메시지 고정)
1. owner/admin 역할 사용자 → "고정" 버튼 표시 확인
2. 일반 member 역할 사용자 → "고정" 버튼 미표시 확인
3. 메시지 고정 → 상단 PinnedMessagesBar 표시 확인
4. 고정 메시지 클릭 → 해당 메시지로 스크롤 확인
5. "고정 해제" 클릭 → 고정 목록에서 제거 확인
6. 5개 이상 고정 시도 → 에러 메시지 표시 확인
7. 삭제된 메시지 고정 시도 → 에러 메시지 표시 확인
8. 다른 브라우저에서 실시간 업데이트 확인

### Phase 4.3 (채팅방 공지)
1. owner/admin 역할 사용자 → 헤더에 공지 설정 버튼(📢) 표시 확인
2. 일반 member 역할 사용자 → 공지 설정 버튼 미표시 확인
3. 공지 설정 버튼 클릭 → AnnouncementDialog 열림 확인
4. 공지 저장 → 채팅방 상단 AnnouncementBanner 표시 확인
5. 긴 공지(100자 초과) → 축약 + "펼치기" 버튼 확인
6. 펼치기 클릭 → 전체 공지 표시 + "접기" 버튼 확인
7. 공지 편집 버튼 클릭 → 기존 내용이 다이얼로그에 표시 확인
8. 공지 삭제 → 배너 사라짐 확인
9. 500자 초과 입력 → 저장 버튼 비활성화 확인
10. 다른 브라우저에서 실시간 업데이트 확인

---

---

## Phase 4.1 완료 (메시지 답장)

### 구현된 기능
특정 메시지를 인용하여 답장하는 기능
- 답장 버튼 클릭 시 입력창 위에 원본 메시지 표시
- 답장 메시지 위에 원본 메시지 미리보기 표시
- 원본 메시지 클릭 시 해당 메시지로 스크롤

### 완료된 작업

#### 1. DB 마이그레이션 ✅
**파일**: `supabase/migrations/20260117000000_add_chat_message_reply.sql`

```sql
ALTER TABLE chat_messages
ADD COLUMN reply_to_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to
ON chat_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
```

#### 2. 타입 정의 ✅
**파일**: `lib/domains/chat/types.ts`

- `ChatMessage.reply_to_id: string | null` 추가
- `ChatMessageInsert.reply_to_id?: string | null` 추가
- `ReplyTargetInfo` 타입 추가 (id, content, senderName, isDeleted)
- `ChatMessageWithSender.replyTarget?: ReplyTargetInfo | null` 추가
- `SendMessageRequest.replyToId?: string | null` 추가

#### 3. Repository 함수 ✅
**파일**: `lib/domains/chat/repository.ts`

- `CHAT_MESSAGE_COLUMNS`에 `reply_to_id` 추가
- `findReplyTargetsByIds(replyToIds: string[])` 함수 추가

#### 4. Service 수정 ✅
**파일**: `lib/domains/chat/service.ts`

- `sendMessage()`: `replyToId` 파라미터 추가, 답장 대상 검증
- `getMessagesWithReadStatus()`: 답장 원본 정보 배치 조회 및 매핑

#### 5. Server Action 수정 ✅
**파일**: `lib/domains/chat/actions/messages.ts`

- `sendMessageAction()`: `replyToId` 파라미터 추가

#### 6. UI 컴포넌트 수정 ✅

**ChatInput.tsx** (`components/chat/molecules/ChatInput.tsx`)
- `replyTarget` prop 추가
- `onCancelReply` prop 추가
- 입력창 위에 답장 대상 표시 영역 추가

**MessageBubble.tsx** (`components/chat/atoms/MessageBubble.tsx`)
- `replyTarget` prop 추가
- `onReply` prop 추가
- `onReplyTargetClick` prop 추가
- 메시지 버블 위에 답장 원본 표시
- 액션 메뉴에 "답장" 버튼 추가

**ChatRoom.tsx** (`components/chat/organisms/ChatRoom.tsx`)
- `replyTarget` 상태 추가
- `handleReply` 함수 추가
- `sendMutation` 수정 (replyToId 포함)
- MessageBubble, ChatInput에 답장 관련 props 전달

---

## Phase 4.2 완료 (메시지 고정)

### 구현된 기능
메시지를 최대 5개까지 고정할 수 있는 기능
- owner/admin 역할만 고정/해제 가능
- 고정 메시지 바에서 캐러셀 형태로 표시
- 클릭 시 해당 메시지로 스크롤
- 실시간 동기화

### 완료된 작업

#### 1. DB 마이그레이션 ✅
**파일**: `supabase/migrations/20260117000001_add_chat_pinned_messages.sql`

```sql
CREATE TABLE IF NOT EXISTS chat_pinned_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  pinned_by uuid NOT NULL,
  pinned_by_type text NOT NULL CHECK (pinned_by_type IN ('student', 'admin')),
  pin_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(room_id, message_id)
);

-- RLS 정책: 멤버만 조회, owner/admin만 추가/삭제
```

#### 2. 타입 정의 ✅
**파일**: `lib/domains/chat/types.ts`

- `PinnedMessage` - 고정 메시지 기본 타입
- `PinnedMessageWithContent` - UI 표시용 (메시지 내용 + 발신자 이름 포함)
- `PinMessageInput` - 고정/해제 입력 타입
- `PinnedMessageInsert` - Repository 삽입용 타입

#### 3. Repository 함수 ✅
**파일**: `lib/domains/chat/repository.ts`

```typescript
findPinnedMessagesByRoom(roomId)     // 채팅방의 고정 메시지 목록 조회
insertPinnedMessage(input)            // 고정 메시지 추가 (자동 pin_order 부여)
deletePinnedMessage(roomId, messageId) // 고정 메시지 삭제
isPinnedMessage(roomId, messageId)    // 고정 여부 확인
countPinnedMessages(roomId)           // 고정 메시지 개수 조회
```

#### 4. Service 함수 ✅
**파일**: `lib/domains/chat/service.ts`

```typescript
pinMessage(userId, userType, input)      // 메시지 고정 (권한/개수 검증)
unpinMessage(userId, userType, input)    // 메시지 고정 해제
getPinnedMessages(userId, userType, roomId) // 고정 메시지 목록 조회 (내용 포함)
checkMessagePinned(roomId, messageId)    // 단일 메시지 고정 여부 확인
canUserPinMessages(userId, userType, roomId) // 사용자 고정 권한 확인
```

#### 5. Server Actions ✅
**파일**: `lib/domains/chat/actions/pins.ts` (신규)

```typescript
pinMessageAction(roomId, messageId)      // 메시지 고정
unpinMessageAction(roomId, messageId)    // 고정 해제
getPinnedMessagesAction(roomId)          // 고정 메시지 목록 조회
canPinMessagesAction(roomId)             // 권한 확인
```

**파일**: `lib/domains/chat/actions/index.ts`
- pin 관련 4개 함수 export 추가

#### 6. UI 컴포넌트 ✅

**신규: PinnedMessagesBar.tsx** (`components/chat/molecules/PinnedMessagesBar.tsx`)
- 단일 메시지: 간단한 바 형태
- 여러 개: 캐러셀 + 전체 보기 버튼
- 확장 모드: 스크롤 가능한 전체 목록
- 클릭 시 해당 메시지로 스크롤
- 고정 해제 버튼 (권한 있을 때)

**수정: MessageBubble.tsx** (`components/chat/atoms/MessageBubble.tsx`)
- `isPinned`, `canPin`, `onTogglePin` props 추가
- 액션 메뉴에 "고정"/"고정 해제" 버튼 추가

**수정: ChatRoom.tsx** (`components/chat/organisms/ChatRoom.tsx`)
- 고정 메시지 조회 쿼리 추가 (`chat-pinned`)
- 권한 확인 쿼리 추가 (`chat-can-pin`)
- pin/unpin mutation 추가
- PinnedMessagesBar 컴포넌트 통합
- MessageBubble에 고정 관련 props 전달

#### 7. Realtime 구독 ✅
**파일**: `lib/realtime/useChatRealtime.ts`

- `chat_pinned_messages` INSERT/DELETE 이벤트 구독 추가
- `invalidatePinnedMessages` 콜백 추가

#### 8. 빌드/린트 검증 ✅
```bash
pnpm lint && pnpm build  # 통과
```

---

## Phase 4.3 완료 (채팅방 공지)

### 구현된 기능
채팅방 상단에 공지를 설정/편집/삭제할 수 있는 기능
- owner/admin 역할만 공지 설정/삭제 가능
- 공지 배너가 채팅방 상단에 표시
- 긴 공지는 축약 후 펼치기/접기 지원
- 실시간 동기화

### 완료된 작업

#### 1. DB 마이그레이션 ✅
**파일**: `supabase/migrations/20260117000002_add_chat_room_announcement.sql`

```sql
ALTER TABLE chat_rooms
ADD COLUMN IF NOT EXISTS announcement text,
ADD COLUMN IF NOT EXISTS announcement_by uuid,
ADD COLUMN IF NOT EXISTS announcement_by_type text CHECK (announcement_by_type IS NULL OR announcement_by_type IN ('student', 'admin')),
ADD COLUMN IF NOT EXISTS announcement_at timestamptz;

COMMENT ON COLUMN chat_rooms.announcement IS '채팅방 공지 내용 (최대 500자)';
COMMENT ON COLUMN chat_rooms.announcement_by IS '공지 작성자 ID';
COMMENT ON COLUMN chat_rooms.announcement_by_type IS '공지 작성자 유형 (student, admin)';
COMMENT ON COLUMN chat_rooms.announcement_at IS '공지 작성 시간';
```

#### 2. 타입 정의 ✅
**파일**: `lib/domains/chat/types.ts`

- `ChatRoom` 인터페이스에 announcement 관련 필드 추가
- `ChatRoomUpdate` 인터페이스에 announcement 관련 필드 추가
- `AnnouncementInfo` 타입 추가 (content, authorName, authorType, createdAt)
- `SetAnnouncementInput` 타입 추가 (roomId, content)

#### 3. Repository 함수 ✅
**파일**: `lib/domains/chat/repository.ts`

```typescript
// CHAT_ROOM_COLUMNS에 announcement 필드 추가
export async function setRoomAnnouncement(
  roomId: string,
  userId: string | null,
  userType: ChatUserType | null,
  content: string | null
): Promise<ChatRoom>
```

#### 4. Service 함수 ✅
**파일**: `lib/domains/chat/service.ts`

```typescript
export async function setAnnouncement(userId, userType, input): Promise<ChatActionResult<ChatRoom>>
export async function getAnnouncement(userId, userType, roomId): Promise<ChatActionResult<AnnouncementInfo | null>>
export async function canUserSetAnnouncement(userId, userType, roomId): Promise<boolean>
```

#### 5. Server Actions ✅
**파일**: `lib/domains/chat/actions/rooms.ts`

```typescript
setAnnouncementAction(roomId, content)       // 공지 설정/삭제
getAnnouncementAction(roomId)                // 공지 조회
canSetAnnouncementAction(roomId)             // 권한 확인
```

**파일**: `lib/domains/chat/actions/index.ts`
- 공지 관련 3개 함수 export 추가

#### 6. UI 컴포넌트 ✅

**신규: AnnouncementBanner.tsx** (`components/chat/atoms/AnnouncementBanner.tsx`)
- 공지 내용 표시 (100자 이상 축약)
- 펼치기/접기 버튼
- 작성자 이름 및 시간 표시
- 편집/삭제 버튼 (권한 있을 때)

**신규: AnnouncementDialog.tsx** (`components/chat/molecules/AnnouncementDialog.tsx`)
- 공지 작성/편집 모달
- 500자 제한 및 글자수 표시
- 저장/취소 버튼

**수정: ChatRoom.tsx** (`components/chat/organisms/ChatRoom.tsx`)
- 공지 조회 쿼리 추가 (`chat-announcement`)
- 권한 확인 쿼리 추가 (`chat-can-set-announcement`)
- 공지 설정/삭제 mutation 추가
- 헤더에 공지 설정 버튼 (Megaphone 아이콘) 추가
- AnnouncementBanner, AnnouncementDialog 통합

#### 7. Realtime 구독 ✅
**파일**: `lib/realtime/useChatRealtime.ts`

```typescript
// chat_rooms UPDATE 이벤트 구독 추가
.on("postgres_changes", {
  event: "UPDATE",
  schema: "public",
  table: "chat_rooms",
  filter: `id=eq.${roomId}`,
}, () => invalidateAnnouncement())
```

#### 8. 빌드/린트 검증 ✅
```bash
pnpm lint && pnpm build  # 통과
```

---

## 변경된 파일 목록 (Phase 4)

### 마이그레이션 (신규)
- [x] `supabase/migrations/20260117000000_add_chat_message_reply.sql`
- [x] `supabase/migrations/20260117000001_add_chat_pinned_messages.sql`
- [x] `supabase/migrations/20260117000002_add_chat_room_announcement.sql`

### 도메인 레이어
- [x] `lib/domains/chat/types.ts` - 답장 + 고정 + 공지 타입 추가 완료
- [x] `lib/domains/chat/repository.ts` - 답장 + 고정 + 공지 함수 추가 완료
- [x] `lib/domains/chat/service.ts` - 답장 + 고정 + 공지 로직 추가 완료
- [x] `lib/domains/chat/actions/messages.ts` - replyToId 파라미터 추가 완료
- [x] `lib/domains/chat/actions/pins.ts` - 신규 생성 완료
- [x] `lib/domains/chat/actions/rooms.ts` - 공지 액션 추가 완료
- [x] `lib/domains/chat/actions/index.ts` - pin + 공지 export 추가 완료

### UI 컴포넌트
- [x] `components/chat/atoms/MessageBubble.tsx` - 답장 + 고정 UI 추가 완료
- [x] `components/chat/molecules/ChatInput.tsx` - 답장 표시 추가 완료
- [x] `components/chat/molecules/PinnedMessagesBar.tsx` - 신규 생성 완료
- [x] `components/chat/atoms/AnnouncementBanner.tsx` - 신규 생성 완료
- [x] `components/chat/molecules/AnnouncementDialog.tsx` - 신규 생성 완료
- [x] `components/chat/organisms/ChatRoom.tsx` - 답장 + 고정 + 공지 통합 완료

### Realtime
- [x] `lib/realtime/useChatRealtime.ts` - 고정 메시지 + 공지 구독 추가 완료

---

## 다음 세션에서 해야 할 작업

Phase 4 전체 완료! 🎉

추가로 고려할 수 있는 기능:
- Phase 5: 파일 첨부 (이미지, 문서)
- Phase 6: 음성 메시지
- Phase 7: 메시지 번역
- Phase 8: 채팅방 설정 (알림, 배경색 등)

---

## 관련 문서

- [Phase 4 구현 계획](/Users/johyeon-u/.claude/plans/enchanted-toasting-reef.md)
- [Auth Strategy Pattern](/docs/auth-strategy-pattern.md)
