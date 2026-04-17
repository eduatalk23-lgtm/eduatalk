# Phase T-3: 양방향 토글 (Split Mode) 설계

**작성**: 2026-04-17
**상태**: 설계 초안 (사용자 리뷰 대기)
**관련**: `docs/ai-chat-roadmap.md`, `docs/phase-t-context-handoff-spec.md` (T-4)

---

## 1. 목적

기존 GUI 페이지(/scores, /plan, /admin/students/[id]/record 등)에서 **페이지를 떠나지 않고** AI 대화 패널을 옆에 띄워 질문·분석을 이어가는 모드. T-1(완전 전환)의 "이탈" 동선 대비 **공존** 동선.

**사용자 시나리오**:
- 학생이 /scores에서 표를 보며 동시에 AI에게 "이 과목 왜 떨어졌어?" 물어봄. 답변 보며 표를 같이 확인
- 컨설턴트가 /admin/students/xxx/record 에서 생기부 항목을 하나씩 클릭하며 동시에 AI에게 개선안 물어봄
- 학부모가 /parent/record에서 자녀 항목 보며 "이게 무슨 뜻이야?" 대화

**근거 (L2 복제)**:
- Cursor 우측 사이드 채팅 패널
- Claude Projects: 문서 + 채팅 split
- Notion AI: 우측 슬라이드 패널
- ChatGPT Canvas 양방향 편집

---

## 2. 전환 4유형과의 위치

| 유형 | 비교 |
|------|------|
| A (T-1 GUI → 내러티브) | **완전 전환** (라우트 이동) |
| B (T-2 내러티브 → GUI) | **복귀** (배너) |
| **C (T-3 양방향 토글)** | **공존** (같은 페이지 내 split) |
| D (C-3 Canvas 편집) | **내러티브 안에 GUI 재현** |

T-3는 "잠깐 질문하고 바로 작업 복귀"가 핵심. 긴 상담이면 T-1(이탈)이 적합.

---

## 3. UI 결정 (리뷰 필요)

### 결정 D1: 패널 형태

**추천: 우측 슬라이드 패널 (overlay)**

- 우측에서 슬라이드 인 (~420px, md+ 에서만 노출; 모바일은 bottom sheet)
- 본문 페이지는 그대로. 패널이 페이지 위에 살짝 겹침 (반투명 backdrop X, 또는 아주 옅게)
- Esc 또는 토글 버튼으로 닫기

**대안들**:
- A. Split layout (본문 60% + 패널 40% reflow) — 기존 페이지 레이아웃 깨짐. 구현 비용 크고 각 페이지마다 대응 필요
- B. 풀스크린 모달 — T-1과 차이가 없어짐
- C. 하단 드로어 — 생기부 같은 세로 긴 데이터에 맞지 않음
- D. 우측 슬라이드 오버레이 (추천)

### 결정 D2: 진입점

**추천: T-1 "AI와 대화" 버튼에 모드 선택**

현재 T-1 버튼은 항상 `/ai-chat` 이동(완전 전환). 2모드 제공:

```
[💬 AI와 대화 ▼]
   ├── 이 화면에서 대화 (split) ← 신규 T-3 진입
   └── 대화방에서 보기 (이탈)     ← 기존 T-1
```

또는 **기본 버튼 = split**, **Shift+Click = 이탈** (파워유저용)

**추천: 드롭다운 2선택**. 명시성 > 파워유저 단축.

**대안**: 완전히 별개 버튼 2개 나란히 배치 → UI 혼잡

### 결정 D3: 대화 영속화 스코프

**추천: split 모드 대화도 `ai_conversations` 에 저장 + origin.mode="split" 플래그**

- 같은 대화를 사이드바에서 클릭하면 전환 가능
- split에서 시작한 대화를 나중에 /ai-chat 에서 이어받을 수 있음
- 반대로 /ai-chat 에서 시작한 대화를 split으로 열 수도 있음

**대안**: split 대화는 메모리에만 (reload 시 소실) — 일관성 손상

### 결정 D4: 컴포넌트 재사용

**추천: ChatShell 컴포넌트를 재사용하고 layout prop으로 variant 분기**

```ts
<ChatShell
  variant="full"      // 기존 /ai-chat 동작
  variant="split"     // 우측 패널, sidebar 숨김, 배너 숨김
  variant="docked"    // 미니 도크 (Phase D-2)
/>
```

**대안**: 별도 `SplitChatPanel` 컴포넌트 — 중복 코드 + 기능 싱크 어려움

---

## 4. 핵심 컴포넌트

### 4.1 신규 파일

```
components/ai-chat/
├── SplitChatPanel.tsx       # 우측 슬라이드 wrapper. ChatShell(variant=split) 포함
├── HandoffLauncher.tsx      # (T-1에서 이미 존재) 드롭다운 확장으로 split/full 선택
└── ChatShell.tsx            # variant prop 추가
```

### 4.2 상태 관리

```ts
// lib/stores/splitChatStore.ts (신규)
export type SplitChatState = {
  open: boolean;
  conversationId: string | null;
  handoffInput: HandoffInput | null;
  openSplit: (input: HandoffInput) => void;
  closeSplit: () => void;
};
```

- **open**: 패널 가시성
- **conversationId**: 현재 활성 대화. 없으면 새로 생성
- **handoffInput**: T-4 규약 재사용

### 4.3 마운트 위치

Providers 안쪽(ChatReturnBanner 옆)에 SplitChatPanel 전역 마운트. 상태 기반 lazy 렌더.

```tsx
// app/providers.tsx
<Suspense fallback={null}>
  <ChatReturnBanner />
  <SplitChatPanel />
</Suspense>
```

---

## 5. 데이터 흐름

### 5.1 split 모드 오픈

```
사용자가 HandoffLauncher 드롭다운 → "이 화면에서 대화" 클릭
  → splitChatStore.openSplit({from:"scores", grade:1, semester:1})
  → SplitChatPanel 내부:
    1. conversationId 없으면 randomUUID() 생성
    2. fetch('/api/ai-chat/handoff/initialize', {method:'POST', body: handoffInput})
       → 서버: validateAndResolveHandoff + saveOpener
       → 응답: { conversationId, assistantMessage, suggestionChips, bannerOrigin }
    3. ChatShell(variant="split") 렌더
```

### 5.2 대화 진행

- `/api/chat` 는 동일. `?fromChat` 쿼리 없이 conversationId만으로 동작
- split 내부 navigateTo 버튼은 **비활성화** (모드 충돌) 또는 "전체 화면으로 이동" 치환
- Artifact 패널은 split 안에서는 표시 안 함 (가로 공간 부족). Artifact 있으면 "전체 화면으로" 안내

### 5.3 모드 전환

```
split 모드 헤더 우측 "⛶ 전체 화면" → /ai-chat?id=<conversationId> 로 이동
/ai-chat 헤더 우측 "⇤ split" (선택) → 이전 페이지로 복귀하며 split 오픈
```

**추천**: split → full 은 지원. full → split 은 복잡도 대비 효용 낮음, v0 제외.

---

## 6. 서버 API 추가

### 6.1 POST /api/ai-chat/handoff/initialize

**목적**: split 모드 진입 시 클라이언트-서버 분리된 핸드오프 검증 + 선공 생성. T-4 page.tsx 로직을 API로 노출.

```ts
// app/api/ai-chat/handoff/initialize/route.ts
POST {
  conversationId: string;
  from: string;
  studentId?: string;
  grade?: number;
  semester?: number;
  subject?: string;
}
→
Response {
  ok: true;
  bannerOrigin: {source, label, originPath};
  suggestionChips: Array<{category, text}>;
  openerMessageId: string;  // loadConversationMessages 가 반환할 것
} | {ok: false; reason: string}
```

**리팩터 기회**: page.tsx 의 handoff 초기화 로직을 `lib/domains/ai-chat/handoff/initialize.ts` 로 추출해 양쪽이 호출.

---

## 7. 레이아웃과 충돌 처리

### 7.1 폭 조정

- 데스크톱 (≥1024px): 본문은 그대로, 오버레이 패널 420px 우측
- 태블릿 (768~1024px): 패널 360px, 본문은 살짝 가려짐 (사용자가 수동 닫기 가능)
- 모바일 (<768px): **bottom sheet**. 90vh 높이, 전체 폭 

### 7.2 기존 우측 패널 충돌

일부 페이지(/plan 등)에 이미 사이드 패널이 있음. 충돌 시:
- split 패널이 우선 (overlay 특성)
- 기존 페이지 사이드바와 z-index 분리

### 7.3 키보드

- `Cmd/Ctrl + /`: split 토글 (Phase B-2 Cmd+K와 구분)
- `Esc`: 닫기
- 포커스 트랩 해제 (사용자가 본문과 split 자유롭게 오감)

---

## 8. 보안·권한

T-4 규약 그대로 상속:
- HANDOFF_SOURCES 화이트리스트
- role 검증
- 테넌트 일치
- RLS (ai_conversations owner-only — 핸드오프 D 빈틈 #2는 여전히 미해결. tenant 확장은 T-3와 무관하게 별도)

---

## 9. 테스트 시나리오

### S1. 학생 split 모드 기본
1. `/scores/school/1/1` 접속
2. "AI와 대화 ▼" → "이 화면에서 대화" 클릭
3. 우측 패널 슬라이드 인 (~420px)
4. T-4 선공 + chips 표시
5. chip 클릭 → 응답 스트리밍
6. Esc → 패널 닫힘. 본문 상태 유지
7. 다시 열면 같은 대화 이어감

### S2. split → full 전환
1. S1 5단계에서 패널 헤더 "⛶ 전체 화면" 클릭
2. `/ai-chat?id=<id>` 이동
3. 대화 연속성 유지 (메시지·origin 복원)

### S3. 모바일 bottom sheet
1. 뷰포트 375px
2. split 오픈 → bottom sheet 90vh
3. 스와이프 다운으로 닫기 (선택, v1)

### S4. 두 페이지에서 다른 대화
1. /scores에서 split으로 대화 A 시작
2. 패널 닫고 /plan 이동
3. /plan에서 split으로 대화 B 시작 (새 대화)
4. 사이드바(full 모드 진입 시)에서 두 대화 모두 확인 가능

---

## 10. 구현 순서

| # | 작업 | 난이도 | 비고 |
|---|------|--------|------|
| T-3.1 | handoff initialize API + 리팩터 (page.tsx → 공용 함수) | Med | T-4 재사용 |
| T-3.2 | splitChatStore (Zustand) | Low | |
| T-3.3 | ChatShell variant prop (full / split) | Med | 사이드바·배너·artifact 조건부 |
| T-3.4 | SplitChatPanel wrapper + 애니메이션 (framer-motion) | Med | |
| T-3.5 | HandoffLauncher 드롭다운 확장 | Low | split / full 선택 |
| T-3.6 | Providers 마운트 + 키보드 단축 | Low | |
| T-3.7 | 모바일 bottom sheet 대응 | Med | |
| T-3.8 | 실측 + 조정 | - | |

---

## 11. 리뷰 결정 요약

| # | 결정 | 추천 | 대안 |
|---|------|------|------|
| D1 | 패널 형태 | 우측 슬라이드 오버레이 420px | split reflow / 모달 / 하단 드로어 |
| D2 | 진입점 | HandoffLauncher 드롭다운 2선택 | Shift+Click / 별개 버튼 |
| D3 | 영속화 | ai_conversations 저장 + origin.mode | 메모리만 |
| D4 | 컴포넌트 | ChatShell variant prop 재사용 | 별도 SplitChatPanel |

---

## 12. v0 범위 제안

**포함**: T-3.1 ~ T-3.6 (데스크톱/태블릿 완결)
**제외 (v1 승격)**: T-3.7 모바일 bottom sheet (기존 /ai-chat 이탈 모드로 폴백)

v0 타겟: 학생 /scores 에서 split 모드 완주 1회 검증.

---

리뷰 후 결정 확정 → 구현 진입.
