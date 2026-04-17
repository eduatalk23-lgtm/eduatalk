# AI Chat (Chat-First Shell) 아키텍처 문서

**최종 업데이트**: 2026-04-17
**경로**: `/ai-chat`
**스택**: Next.js 16 + AI SDK v6 + Supabase + Ollama/Gemma 4

---

## 시스템 다이어그램

```
┌──────────────────────────────────────────────────────────────────┐
│                         브라우저 (client)                         │
│                                                                   │
│  ┌──────────┬──────────────────────────┬──────────────────────┐ │
│  │ Sidebar  │       Chat Shell         │   Artifact Panel    │ │
│  │  (server │  (useChat + MessageRow   │   (Zustand store)   │ │
│  │   SSR)   │   + ToolCard)            │                     │ │
│  └──────────┴──────────────────────────┴──────────────────────┘ │
│                                                                   │
└─────────────┬──────────────────────────────┬────────────────────┘
              │                              │
              ▼                              ▼
    ┌─────────────────────┐      ┌─────────────────────┐
    │  app/ai-chat/       │      │  /api/chat          │
    │  page.tsx (server)  │      │  (POST)             │
    │  - redirect ?id=    │      │  - getCurrentUser   │
    │  - loadMessages     │      │  - streamText       │
    │  - listConversations│      │  - onFinish → save  │
    └──────────┬──────────┘      └──────────┬──────────┘
               │                            │
               ▼                            ▼
    ┌─────────────────────────────────────────────┐
    │           Supabase (Postgres)                │
    │                                              │
    │  ai_conversations  (RLS: owner only)         │
    │  ai_messages       (RLS: owner via FK)       │
    │                                              │
    └─────────────────────────────────────────────┘
               ▲
               │
               ▼
    ┌──────────────────────┐
    │  Ollama (localhost)  │
    │  gemma4:latest        │
    └──────────────────────┘
```

---

## 파일 구조

```
app/
├── ai-chat/
│   └── page.tsx                    # 서버 컴포넌트. 진입점.
└── api/chat/
    └── route.ts                    # POST 핸들러. streamText + tools + 저장.

components/ai-chat/
├── ChatShell.tsx                   # 메인 클라이언트 (useChat + layout)
├── ToolCard.tsx                    # 3단 disclosure wrapper
├── ArtifactPanel.tsx               # 우측 패널
├── ConversationSidebar.tsx         # 좌측 사이드바
└── ScoresCard.tsx                  # 성적 generative UI

lib/
├── domains/ai-chat/
│   ├── types.ts                    # AIConversationRow, AIMessageRow
│   └── persistence.ts              # saveChatTurn, loadConversationMessages, listConversations
└── stores/
    └── artifactStore.ts            # Zustand

supabase/migrations/
└── 20260417400000_ai_chat_persistence.sql
```

---

## 데이터 흐름

### 1. 페이지 진입
```
User → /ai-chat
  → server: randomUUID() → redirect(?id=xxx)
  → server: loadConversationMessages(id) + listConversations(user.id)
  → render ChatShell with initialMessages + conversations
```

### 2. 메시지 전송
```
User types → sendMessage({text})
  → useChat posts to /api/chat with { id, messages }
  → server: getCurrentUser + buildUserContextPrompt
  → server: streamText({model: ollama, tools, system})
  → stream UIMessage parts back to client
  → onFinish: saveChatTurn({conversationId, ...}, finalMessages)
    ├─ UPSERT ai_conversations (title from first user msg)
    └─ UPSERT ai_messages (parts JSONB)
```

### 3. Tool 호출
```
LLM → tool call {navigateTo | getScores}
  → server: execute() returns output
  → client: render ToolCard with state "success"
  → user: click footer action → navigate OR open artifact panel
```

### 4. Artifact 승격
```
User clicks "패널에서 크게 보기"
  → artifactStore.openArtifact({type, props})
  → ArtifactPanel subscribes → renders ScoresCard
  → 닫기 → artifactStore.closeArtifact()
```

---

## 핵심 API

### `streamText` (AI SDK v6)

```ts
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { ollama } from "ai-sdk-ollama";

const result = streamText({
  model: ollama("gemma4:latest"),
  system: "...",
  messages: await convertToModelMessages(uiMessages),
  tools: { navigateTo, getScores },
  stopWhen: stepCountIs(3),
});

return result.toUIMessageStreamResponse({
  originalMessages: uiMessages,  // ⚠️ 필수, 빠지면 user 메시지 유실
  onFinish: async ({ messages }) => {
    await saveChatTurn({...}, messages);
  },
});
```

### `useChat` (클라이언트)

```ts
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const { messages, sendMessage, status, error, stop } = useChat({
  id: conversationId,              // 서버에 body.id로 전달됨
  messages: initialMessages,       // DB에서 로드
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});
```

### Tool 정의

```ts
import { tool } from "ai";
import { z } from "zod";

getScores: tool({
  description: "...",
  inputSchema: z.object({
    studentName: z.string().optional(),
    grade: z.number().int().min(1).max(3).optional(),
    semester: z.number().int().min(1).max(2).optional(),
  }),
  execute: async ({studentName, grade, semester}) => {
    // ...
    return { ok: true, rows, ... };
  },
}),
```

---

## DB 스키마

```sql
CREATE TABLE ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
  persona text NOT NULL DEFAULT 'student'
    CHECK (persona IN ('student','parent','consultant','admin','superadmin')),
  subject_student_id uuid REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  title text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  retention_until timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
  id text PRIMARY KEY,              -- AI SDK generated stable id
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  parts jsonb NOT NULL,             -- UIMessage.parts[] 원형
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: initplan (SELECT auth.uid()) 래핑 필수 (CLAUDE.md 규칙)
```

---

## Tool 추가 절차

1. **`app/api/chat/route.ts`**: `const tools = {...}`에 추가
2. **시스템 프롬프트**: `[도구 선택 규칙]` 섹션에 명시
3. **`ChatShell.tsx`**: MessageRow의 parts.map 분기에 `tool-<name>` 추가
4. **필요 시 ArtifactPanel**: type 분기 + 렌더러 추가

예제: `ScoresCard` 패턴 참조.

---

## UI 규칙 (Chat-First Shell)

1. **메시지**: Assistant no-bubble full-width, User 옅은 zinc 버블, content max-w-3xl
2. **Composer**: textarea auto-grow, Enter 전송(IME 체크), Send↔Stop 토글
3. **Tool**: ToolCard 3단 disclosure (status chip + 접기/펼치기 + footer action)
4. **Artifact**: 우측 패널, Zustand 단일 상태, 빈 상태 width:0 권장 (TODO)
5. **Sidebar**: 시간 그룹 (오늘/어제/지난 7일/이번 달/이전), persona 뱃지

상세 규칙: memory `feedback_chat-first-shell-patterns.md` 참조.

---

## 향후 확장

- **Phase B**: Cmd+K, slash commands, HITL approval, 모바일 bottom sheet
- **Phase C**: MCP server 래핑, artifact 버전 관리, Canvas 편집, citations
- **Phase D**: Agent abstraction, mem0 장기 기억, resumable streaming
- **Phase E**: 추가 tool 5종, persona 라우터 분리, multi-student workspace, voice, 3자 대화

상세: `docs/ai-chat-roadmap.md`.

---

## 주의 사항

### 필수 트랩
- `toUIMessageStreamResponse({ originalMessages: messages })` 없으면 user 메시지 유실
- RLS 정책은 `(SELECT auth.uid())` 래핑 필수 (initplan 최적화)
- `convertToModelMessages`는 v6에서 async → `await` 필수

### 인증 경로
- `/ai-chat`은 `ROLE_ALLOWED_PATHS`에 모든 역할 허용
- `/api/chat`은 기본 인증 가드 (proxy.ts)

### 권한 스코프
- 현재 POC는 owner 기반 RLS
- Wave 1에서 tenant 내 admin/consultant 읽기 권한 확장 예정
