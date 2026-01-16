# Chat 도메인 실시간 반응성 개선 - 진행 상황

## 📅 마지막 업데이트: 2026-01-17

---

## ✅ 완료된 작업

### Phase 1: 치명적 문제 해결 (완료)

#### 1. Realtime Publication 활성화
- **파일**: `supabase/migrations/20260117200000_add_chat_realtime_publication.sql`
- **상태**: ✅ 마이그레이션 적용 완료
- **내용**: 5개 채팅 테이블을 `supabase_realtime` publication에 등록
  - `chat_messages`
  - `chat_message_reactions`
  - `chat_pinned_messages`
  - `chat_rooms`
  - `chat_room_members`

#### 2. 낙관적 업데이트 구현
- **파일**: `lib/domains/chat/hooks/useChatRoomLogic.ts`
- **상태**: ✅ 커밋 완료 (`3372e1ac`)
- **내용**:
  - 리액션 토글: 즉시 UI 반영 + 롤백 처리
  - 메시지 편집: 즉시 content 업데이트
  - 메시지 삭제: 즉시 `is_deleted=true` 설정
  - `InfiniteMessagesCache` 타입 정의 추가
  - `staleTime` 10초 → 30초 조정

#### 3. 발신자 정보 최적화
- **파일**: `lib/realtime/useChatRealtime.ts`
- **상태**: ✅ 커밋 완료 (`3372e1ac`)
- **내용**:
  - `senderCache` prop 추가 (roomData.members에서 구성)
  - `findSenderFromExistingMessages()` 함수로 기존 캐시 조회
  - "로딩 중..." 깜빡임 감소

#### 4. Realtime 중복 방지
- **파일**: `lib/realtime/useChatRealtime.ts`
- **상태**: ✅ 커밋 완료 (`3372e1ac`)
- **내용**:
  - 리액션 INSERT/DELETE 핸들러에서 낙관적 업데이트 중복 체크

---

### Phase 2: Quick Wins (완료, 미커밋)

#### 1. `.catch()` 핸들러 추가
- **파일**: `lib/realtime/useChatRealtime.ts` (line 326-332)
- **내용**: `fetchSenderInfo` 프로미스 에러 핸들링

#### 2. LRU 캐시 구현
- **파일**: `lib/realtime/useChatRealtime.ts` (line 61-98)
- **내용**: 
  - `LRUCache` 클래스 (최대 100개 항목)
  - `senderCacheRef`를 LRU 캐시로 교체
  - 메모리 누수 방지

#### 3. 데이터베이스 인덱스 추가
- **파일**: `supabase/migrations/20260117200001_add_chat_message_indexes.sql`
- **상태**: ✅ 마이그레이션 적용 완료
- **내용**:
  ```sql
  - idx_chat_messages_reply_to_id (답장 조회)
  - idx_chat_messages_room_active_created (메시지 목록)
  - idx_chat_messages_sender (발신자별 조회)
  - idx_chat_reactions_message_emoji (리액션 카운트)
  - idx_chat_reactions_user_message (사용자별 리액션)
  - idx_chat_room_members_user_active (활성 멤버)
  - idx_chat_room_members_room_read (읽음 표시)
  ```

#### 4. 커서 유효성 검증
- **파일**: `lib/domains/chat/repository.ts` (line 41-52, 432-433)
- **내용**: 
  - `validateCursor()` 함수 추가
  - `findMessagesByRoom`에서 커서 검증 적용

#### 5. 삭제 메시지 애니메이션
- **파일**: `components/chat/atoms/MessageBubble.tsx`
- **내용**:
  - `isDeleted` prop 추가
  - 삭제된 메시지 전용 UI (fade-in 애니메이션)
  - "삭제된 메시지입니다" 표시
- **파일**: `components/chat/organisms/ChatRoom.tsx`
- **내용**:
  - `isDeleted` prop 전달
  - 삭제된 메시지에 액션 비활성화

---

## 🔄 미커밋 변경 파일

```bash
# Quick Wins 관련 (커밋 필요)
modified:   lib/realtime/useChatRealtime.ts
modified:   lib/domains/chat/repository.ts
modified:   components/chat/atoms/MessageBubble.tsx
modified:   components/chat/organisms/ChatRoom.tsx
new file:   supabase/migrations/20260117200001_add_chat_message_indexes.sql
```

### 커밋 명령어
```bash
git add lib/realtime/useChatRealtime.ts lib/domains/chat/repository.ts \
  components/chat/atoms/MessageBubble.tsx components/chat/organisms/ChatRoom.tsx \
  supabase/migrations/20260117200001_add_chat_message_indexes.sql

git commit -m "perf: 채팅 도메인 Quick Wins 적용

- LRU 캐시로 발신자 정보 메모리 누수 방지 (최대 100개)
- fetchSenderInfo에 .catch() 핸들러 추가
- 커서 유효성 검증 함수 추가
- 삭제된 메시지 UI 개선 (fade-in 애니메이션)
- 성능 인덱스 7개 추가 (reply_to_id, sender, reactions 등)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## ⏳ 남은 작업 (우선순위순)

### Critical
| # | 문제 | 복잡도 | 예상 시간 |
|---|------|--------|----------|
| 1 | **Race Condition 수정** - 낙관적 업데이트와 Realtime 경쟁 | HIGH | 4-6h |
| 2 | **연결 복구 메커니즘** - 자동 재연결, 오프라인 큐 | HIGH | 6-8h |

### High
| # | 문제 | 복잡도 | 예상 시간 |
|---|------|--------|----------|
| 3 | **N+1 쿼리 수정** - `getRoomDetail`에서 `findSendersByIds` 사용 | MEDIUM | 2-3h |
| 4 | **markAsRead 최적화** - IntersectionObserver 사용 | MEDIUM | 2-3h |

### Medium
| # | 문제 | 복잡도 | 예상 시간 |
|---|------|--------|----------|
| 5 | **타입 안전성** - 캐시 업데이트에서 `any` 제거 | MEDIUM | 2-3h |
| 6 | **Error Boundary** - ChatRoom 컴포넌트 감싸기 | MEDIUM | 2-3h |
| 7 | **리액션 업데이트 최적화** - O(n) → O(1) | LOW | 1-2h |

### Low
| # | 문제 | 복잡도 | 예상 시간 |
|---|------|--------|----------|
| 8 | 검색 페이지네이션 | MEDIUM | 2-3h |
| 9 | 편집 충돌 해결 | MEDIUM | 3-4h |

---

## 📁 주요 파일 위치

```
lib/
├── domains/chat/
│   ├── hooks/useChatRoomLogic.ts    # 채팅방 비즈니스 로직
│   ├── repository.ts                 # DB 접근 레이어
│   ├── service.ts                    # 서비스 레이어
│   ├── actions/                      # Server Actions
│   └── types.ts                      # 타입 정의
├── realtime/
│   └── useChatRealtime.ts           # Realtime 구독 훅
components/chat/
├── atoms/MessageBubble.tsx          # 메시지 버블 컴포넌트
└── organisms/ChatRoom.tsx           # 채팅방 컴포넌트
supabase/migrations/
├── 20260117200000_add_chat_realtime_publication.sql
└── 20260117200001_add_chat_message_indexes.sql
```

---

## 🧪 테스트 체크리스트

### Realtime 기본 동작
- [ ] User A 메시지 전송 → User B 즉시 수신 (새로고침 없이)
- [ ] 콘솔에서 `[ChatRealtime] New message:` 로그 확인

### 낙관적 업데이트
- [ ] 리액션 클릭 시 즉시 UI 변경
- [ ] 메시지 편집 시 즉시 content 변경
- [ ] 메시지 삭제 시 즉시 "삭제된 메시지" 표시
- [ ] 네트워크 오류 시 롤백 확인

### 발신자 정보
- [ ] 새 메시지 수신 시 "로딩 중..." 없이 이름 표시

### 삭제 메시지
- [ ] 삭제된 메시지에 fade-in 애니메이션 적용
- [ ] 삭제된 메시지에 액션 버튼 비활성화

---

## 📝 참고 사항

1. **Git 상태**: main 브랜치, origin보다 4 커밋 ahead
2. **빌드 이슈**: `repomix.config.ts` 파일이 빌드 에러 유발 (채팅 관련 아님)
3. **Lint**: 기존 경고 다수 존재, 신규 에러 없음
