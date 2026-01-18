# Chat 도메인 Repomix 생성

> 작성일: 2026-01-16  
> 목적: Chat 도메인 관련 코드를 repomix로 추출하여 문서화

## 작업 개요

Chat 도메인과 관련된 모든 코드를 `npx repomix`를 사용하여 단일 XML 파일로 추출했습니다.

## 생성된 파일

- **출력 파일**: `chat-domain.repomix.xml`
- **설정 파일**: `repomix.config.ts`

## 포함된 파일 통계

- **총 파일 수**: 51개
- **총 토큰 수**: 76,994 tokens
- **총 문자 수**: 300,032 chars
- **파일 크기**: 약 300KB

## 포함된 주요 디렉토리 및 파일

### 1. Chat 도메인 핵심 로직
- `lib/domains/chat/` (전체)
  - `types.ts`: 타입 정의
  - `repository.ts`: 데이터 접근 레이어 (8,860 tokens)
  - `service.ts`: 비즈니스 로직 레이어 (10,293 tokens)
  - `messageGrouping.ts`: 메시지 그룹핑 로직
  - `actions/`: Server Actions
    - `index.ts`: 전체 export
    - `messages.ts`: 메시지 관련 액션
    - `rooms.ts`: 채팅방 관련 액션
    - `members.ts`: 멤버 관리 액션
    - `pins.ts`: 고정 메시지 액션
    - `reactions.ts`: 반응(이모지) 액션
    - `safety.ts`: 차단 및 신고 액션
  - `hooks/`: 커스텀 훅
    - `useChatRoomLogic.ts`: 채팅방 로직 훅 (5,164 tokens)
    - `index.ts`: 훅 export

### 2. Chat UI 컴포넌트
- `components/chat/` (전체)
  - `atoms/`: 원자 컴포넌트
    - `AnnouncementBanner.tsx`: 공지 배너
    - `DateDivider.tsx`: 날짜 구분선
    - `MessageBubble.tsx`: 메시지 버블
    - `OnlineStatus.tsx`: 온라인 상태
    - `ReactionPicker.tsx`: 반응 선택기
    - `ReactionPills.tsx`: 반응 알약
    - `TypingIndicator.tsx`: 타이핑 인디케이터
    - `UnreadBadge.tsx`: 읽지 않음 배지
  - `molecules/`: 분자 컴포넌트
    - `AnnouncementDialog.tsx`: 공지 다이얼로그
    - `ChatInput.tsx`: 채팅 입력
    - `ChatRoomCard.tsx`: 채팅방 카드
    - `EditMessageDialog.tsx`: 메시지 수정 다이얼로그
    - `MessageContextMenu.tsx`: 메시지 컨텍스트 메뉴
    - `MessageSearch.tsx`: 메시지 검색
    - `PinnedMessagesBar.tsx`: 고정 메시지 바
  - `organisms/`: 유기체 컴포넌트
    - `ChatList.tsx`: 채팅 목록
    - `ChatRoom.tsx`: 채팅방 (4,794 tokens)
    - `ChatRoomInfo.tsx`: 채팅방 정보
    - `InviteMemberModal.tsx`: 멤버 초대 모달
  - `index.ts`: 컴포넌트 export

### 3. Chat 페이지 (학생용)
- `app/(student)/chat/`
  - `page.tsx`: 채팅 목록 페이지
  - `_components/`
    - `ChatListPage.tsx`: 채팅 목록 페이지 컴포넌트
    - `CreateChatModal.tsx`: 채팅방 생성 모달
  - `[roomId]/`
    - `page.tsx`: 채팅방 페이지
    - `_components/`
      - `ChatRoomPage.tsx`: 채팅방 페이지 컴포넌트

### 4. Chat 페이지 (관리자용)
- `app/(admin)/admin/chat/`
  - `page.tsx`: 관리자 채팅 목록 페이지
  - `_components/`
    - `AdminChatListPage.tsx`: 관리자 채팅 목록 페이지 컴포넌트
    - `AdminCreateChatModal.tsx`: 관리자 채팅방 생성 모달
  - `[roomId]/`
    - `page.tsx`: 관리자 채팅방 페이지
    - `_components/`
      - `AdminChatRoomPage.tsx`: 관리자 채팅방 페이지 컴포넌트
  - `reports/`
    - `page.tsx`: 신고 관리 페이지
    - `_components/`
      - `ReportListPage.tsx`: 신고 목록 페이지
      - `ReportDetailModal.tsx`: 신고 상세 모달
      - `ReportTable.tsx`: 신고 테이블
      - `ReportFilter.tsx`: 신고 필터

### 5. Chat 실시간 기능
- `lib/realtime/`
  - `useChatRealtime.ts`: 채팅 실시간 구독 (4,103 tokens)
  - `useChatPresence.ts`: 채팅방 Presence 상태 관리

## Top 5 파일 (토큰 기준)

1. `lib/domains/chat/service.ts` (10,293 tokens, 13.4%)
2. `lib/domains/chat/repository.ts` (8,860 tokens, 11.5%)
3. `lib/domains/chat/hooks/useChatRoomLogic.ts` (5,164 tokens, 6.7%)
4. `components/chat/organisms/ChatRoom.tsx` (4,794 tokens, 6.2%)
5. `lib/realtime/useChatRealtime.ts` (4,103 tokens, 5.3%)

## Repomix 설정 파일

`repomix.config.ts` 파일을 생성하여 다음을 포함하도록 설정했습니다:

```typescript
{
  include: [
    "lib/domains/chat/**",
    "components/chat/**",
    "app/(student)/chat/**",
    "app/(admin)/admin/chat/**",
    "lib/realtime/useChat*.ts",
  ],
  exclude: [
    "node_modules/**",
    "**/*.test.ts",
    "**/__tests__/**",
  ],
  output: "chat-domain.repomix.xml",
}
```

## 사용 방법

생성된 `chat-domain.repomix.xml` 파일은:

1. **AI 분석**: Chat 도메인의 전체 구조를 한눈에 파악
2. **코드 리뷰**: 관련 코드를 한 파일에서 검토
3. **문서화**: 시스템 아키텍처 이해 및 문서 작성
4. **온보딩**: 신규 개발자에게 Chat 시스템 소개
5. **리팩토링**: Chat 도메인 개선 작업 시 참고

## Chat 도메인 주요 기능

### 메시지 기능
- 메시지 전송/수정/삭제
- 메시지 검색
- 메시지 답장 (reply)
- 메시지 고정 (pin)
- 메시지 반응 (이모지)

### 채팅방 기능
- 채팅방 생성/조회/나가기
- 멤버 초대
- 공지사항 설정
- 읽음 상태 관리

### 실시간 기능
- 실시간 메시지 수신
- 타이핑 인디케이터
- 온라인 상태 표시
- Presence 관리

### 안전 기능
- 사용자 차단/차단 해제
- 메시지 신고
- 신고 관리 (관리자)

## 참고 사항

- 이 파일은 읽기 전용입니다. 원본 파일을 수정해야 합니다.
- 보안 정보가 포함될 수 있으므로 주의해서 다루어야 합니다.
- 바이너리 파일은 포함되지 않습니다.
- 테스트 파일은 제외되었습니다.

## 다음 단계

필요시 다음 작업을 수행할 수 있습니다:

1. 특정 기능만 추출하여 별도 repomix 파일 생성
2. 주기적으로 업데이트하여 최신 상태 유지
3. CI/CD 파이프라인에 통합하여 자동 생성
4. Chat 도메인 개선 작업 시 참고 자료로 활용

