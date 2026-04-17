# Phase T-4: 컨텍스트 승계 규약 (설계 확정)

**작성**: 2026-04-17
**최근 개정**: 2026-04-17 (D1 재평가 → E-2 고정)
**상태**: 설계 확정 (구현 진입)
**의존**: T-1/T-2/T-3 공통 전제
**관련**: `docs/ai-chat-roadmap.md` (Phase T 섹션), `ai-chat-phase-t-brief.md`

---

## 결정 확정 (2026-04-17 D 세션)

| # | 결정 | 확정값 |
|---|------|--------|
| D1 | LLM 주입 위치 | **E-2. 템플릿 선공 + 시스템 프롬프트 + 배너** (agent-first, LLM 호출 0) |
| D2 | seed 추천 | **from별 4개 프리셋** (선공 메시지 내부 chips로 위치) |
| D3 | 출처 기록 | **ai_conversations.origin JSONB** 신설 |

**E-2 선택 배경**: 2026 agent-first 트렌드(ChatGPT Agents · Claude Projects · Cursor agent) 반영. LLM 호출 0으로 진입 지연 없음 + 템플릿 기반 자연스러운 assistant 선공. Phase D에서 Agent 추상화 도입 시 E-1(LLM 선공)으로 자연 승격.

---

## 1. 목적과 범위

기존 GUI 환경 페이지(예: `/scores`, `/plan`, `/admin/students/[id]/record/...`)에서 사용자가 "AI와 대화" 버튼 등을 통해 `/ai-chat`으로 진입할 때, **현재 보던 화면의 맥락을 LLM에 승계**하기 위한 공통 규약.

**범위:**
- URL 쿼리 스펙
- 서버 측 소스 검증·권한 검증
- LLM 주입 위치 (system prompt / 첫 메시지 / 하이브리드)
- 영속화
- 재진입 정책
- 실패 모드

**비범위:**
- 각 페이지별 버튼 UI (T-1 담당)
- 역방향 배너 (T-2 담당)
- 모드 토글 (T-3 담당)

---

## 2. 사용자 시나리오

### S1. 학생이 자기 성적 화면에서 질문
```
/scores → "이 성적으로 AI와 대화" 버튼 클릭
  → /ai-chat?id=<new>&from=scores&grade=1&semester=1
  → 첫 메시지: "1학년 1학기 내 성적에 대해 물어보고 싶어요"
  → AI: 사용자 현재 컨텍스트(학년/학기 필터 + 실제 성적)를 이미 알고 응답
```

### S2. 컨설턴트가 학생 분석 페이지에서 질문
```
/admin/students/abc/record/analysis → "이 학생 분석 대화" 버튼
  → /ai-chat?id=<new>&from=record-analysis&studentId=abc
  → subject_student_id=abc 로 대화 생성
  → 첫 메시지: "김세린 학생 생기부 분석 결과를 보고 있어요. 개선점은?"
  → AI: 해당 학생 문맥 접근 가능 (RLS 통과 시)
```

### S3. 기존 대화에 재진입 (from 미포함)
```
사이드바에서 과거 대화 클릭 → /ai-chat?id=<existing>
  → from 없음 → 일반 대화로 처리
```

### S4. 부적합 from (크로스-테넌트 / 미승인 페이지)
```
/ai-chat?id=<new>&from=admin-dashboard&studentId=다른-테넌트-ID
  → 서버 거부. from 무시하고 일반 진입.
  → 감사 로그에 위반 기록.
```

---

## 3. URL 쿼리 스펙

### 3.1 공통 파라미터

| 키 | 타입 | 필수 | 설명 |
|----|------|------|------|
| `id` | uuid | ✅ | 대화 ID (기존 규칙 유지) |
| `from` | enum | - | **소스 페이지 키** (화이트리스트 중 하나) |
| `studentId` | uuid | 조건부 | from이 학생 맥락을 요구할 때 (`record-analysis` 등) |
| `grade` | 1\|2\|3 | - | 학년 필터 |
| `semester` | 1\|2 | - | 학기 필터 |
| `subject` | string | - | 과목 필터 |
| `seed` | enum | - | 기본 seed 프리셋 키 (`ask-about-scores`, `ask-about-record` 등) |

### 3.2 from 화이트리스트 (v0)

```ts
export const HANDOFF_SOURCES = {
  scores: {
    label: "성적 화면",
    originPath: "/scores",
    requiresStudentId: false,  // 학생 본인은 self
    allowedRoles: ["student", "admin", "consultant"],
    contextResolver: "scores",
  },
  "admin-scores": {
    label: "관리자 성적 화면",
    originPath: "/admin/students/[id]/scores",
    requiresStudentId: true,
    allowedRoles: ["admin", "consultant"],
    contextResolver: "scores",
  },
  "record-analysis": {
    label: "생기부 분석",
    originPath: "/admin/students/[id]/record/analysis",
    requiresStudentId: true,
    allowedRoles: ["admin", "consultant"],
    contextResolver: "record-analysis",
  },
  plan: {
    label: "학습 플랜",
    originPath: "/plan",
    requiresStudentId: false,
    allowedRoles: ["student"],
    contextResolver: "plan",
  },
  // ... 추가는 PR 단위로 화이트리스트 확장
} as const;
```

**근거**: 화이트리스트는 crazy injection 방지. 서버가 `from` 값을 이 테이블에서 찾지 못하면 무시.

### 3.3 URL 크기 제한

- 요약·데이터 JSON을 URL에 싣지 **않는다** (보안 + URL 크기 제한)
- URL에는 **식별자·필터만**. 실제 데이터는 서버가 재조회

---

## 4. 서버 검증 레이어

### 4.1 파일 배치

```
lib/domains/ai-chat/handoff/
├── sources.ts         # HANDOFF_SOURCES 상수 + 타입
├── validator.ts       # validateHandoff(params, user) → Result
├── resolvers/         # from별 데이터 리졸버
│   ├── scores.ts
│   ├── record-analysis.ts
│   └── plan.ts
└── prompt.ts          # 리졸버 결과 → LLM 시스템 프롬프트 조각
```

### 4.2 검증 흐름

```ts
type HandoffInput = {
  from?: string;
  studentId?: string;
  grade?: number;
  semester?: number;
  subject?: string;
  seed?: string;
};

type HandoffContext =
  | { ok: true; source: HandoffSource; resolved: unknown; snippet: string; seedText?: string }
  | { ok: false; reason: "unknown-source" | "forbidden-role" | "missing-studentId" | "cross-tenant" | "resolver-failed" };

async function validateAndResolveHandoff(
  input: HandoffInput,
  user: CurrentUser,
): Promise<HandoffContext>;
```

**검증 순서:**
1. `from` 값이 HANDOFF_SOURCES에 존재
2. 사용자 role이 `allowedRoles`에 포함
3. `requiresStudentId` 인 경우 `studentId` 제공됨
4. `studentId`의 테넌트가 `user.tenantId`와 일치 (크로스-테넌트 방지)
5. 리졸버 실행 → 스냅샷 획득
6. 실패 시 감사 로그에 위반 기록

### 4.3 리졸버 예시 (`scores.ts`)

```ts
export async function resolveScoresContext(
  input: HandoffInput,
  user: CurrentUser,
): Promise<{ snippet: string; data: unknown }> {
  const targetStudentId = input.studentId ?? user.userId;
  const scores = await getInternalScoresByTerm(
    targetStudentId,
    user.tenantId!,
    input.grade,
    input.semester,
  );

  // 프롬프트용 1-2줄 요약
  const snippet = scores.length === 0
    ? `${input.grade ?? ""}학년 ${input.semester ?? ""}학기 성적 데이터가 아직 없습니다.`
    : `조회 기준: ${input.grade ?? "전체"}학년 ${input.semester ?? "전체"}학기. 총 ${scores.length}과목.`;

  return { snippet, data: { scores, filter: input } };
}
```

**원칙**: 리졸버는 `snippet`(LLM용 한국어 요약 1-3줄) + `data`(도구가 후속 조회할 수 있는 구조화된 참조)를 분리 반환. LLM 프롬프트는 토큰 절약이 중요하므로 스니펫만 주입.

---

## 5. LLM 주입 전략

### 5.1 결정 #1 확정 — E-2 (템플릿 선공 + system + 배너)

**구성:**
- **템플릿 선공 assistant 메시지** — `lib/domains/ai-chat/handoff/opener.ts` 에서 정적 템플릿 보간으로 생성. LLM 호출 0.
- **System prompt 주입** — `[대화 맥락]` 섹션으로 스니펫 삽입. LLM이 후속 발화 시 맥락 인지.
- **UI 배너** — 상단에 "성적 화면(1학년 1학기)에서 시작된 대화 · 원본 보기 ▸"
- **선공 메시지 내부 chips** — D2의 SEEDS를 메시지 parts에 삽입. 클릭 시 즉시 sendMessage.

**Agent-first 지향**: 진입 직후 AI가 맥락을 인지한 짧은 선공 메시지로 대화 시작. 사용자는 chip 또는 자유 입력으로 이어감.

**LLM 비용 0**: Phase D에서 Agent 추상화 도입 시 E-1(LLM 선공)으로 승격 예정.

### 5.2 결정 #2 (리뷰 필요) — seed 추천 정책

**추천: from별 seed 프리셋 최대 4개** (기존 `SUGGESTION_CHIPS` 구조 재사용)

```ts
// lib/domains/ai-chat/handoff/sources.ts
const SEEDS: Record<string, Array<{category: string; text: string}>> = {
  scores: [
    { category: "분석", text: "이 성적의 강점과 약점은?" },
    { category: "전략", text: "어느 과목에 집중해야 할까?" },
    { category: "비교", text: "지난 학기와 비교해줘" },
    { category: "진학", text: "이 성적으로 갈 수 있는 계열은?" },
  ],
  "record-analysis": [ /* ... */ ],
  plan: [ /* ... */ ],
};
```

**대안**: seed 없음 (사용자가 직접 질문 작성)

### 5.3 주입 프롬프트 템플릿

기존 `buildUserContextPrompt`에 이어 덧붙임:

```
[현재 사용자]
- user_id: xxx
- role: student
- grade: 1학년

[대화 맥락 — GUI 승계]
- 소스: 성적 화면 (/scores)
- 조회 기준: 1학년 1학기. 총 12과목.
- 사용자는 이 화면을 보고 있다가 질문을 시작했습니다.
- 구체 수치는 getScores 도구를 호출하여 조회하세요.

[도구 선택 규칙]
...
```

**원칙**:
- 스니펫은 한국어 1-3줄 고정
- 데이터 전체를 프롬프트에 넣지 않음 (토큰 낭비)
- "구체 수치는 도구로 조회" 지시어를 포함해 LLM이 자동으로 getScores 호출하도록 유도

---

## 6. 영속화

### 6.1 결정 #3 (리뷰 필요) — 대화 레코드에 출처 기록할지

**추천: ai_conversations에 `origin` JSONB 컬럼 추가**

```sql
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS origin jsonb;

COMMENT ON COLUMN public.ai_conversations.origin IS
  'GUI→내러티브 진입 시 소스 정보. {source: string, params: {...}, enteredAt: iso}. 재진입 시 읽기 전용.';
```

**효과**:
- 사이드바에서 "이 대화는 /scores에서 시작됨" 뱃지 표시 가능
- 재진입 시 배너 복원 가능
- 감사·디버깅에 유용

**대안들**:
- A. 기록 없음 — 재진입 시 맥락 유실
- B. 첫 user 메시지에 `data-origin` 메타 — parts 확장 필요, 비표준

### 6.2 재진입 정책

- `?id=<existing>` 만 있고 `from` 없음 → `origin` 컬럼 읽어 복원
- `?id=<existing>&from=<다른값>` → 기존 origin 유지 (1회 진입 시점이 authoritative)
- `?id=<new>&from=<값>` → origin 기록

---

## 7. 보안 경계

| 위협 | 대책 |
|------|------|
| `from` 주입으로 가짜 맥락 | HANDOFF_SOURCES 화이트리스트 |
| 크로스-테넌트 학생 접근 | studentId 테넌트 검증 (기존 RLS는 owner 기준이라 보완 필요) |
| 역할 위반 (학생이 admin from) | allowedRoles 체크 |
| URL에 민감 데이터 | 데이터는 서버 재조회, URL은 식별자만 |
| XSS via label | 스니펫은 서버 생성, 클라이언트는 텍스트로만 렌더 |
| 로그 유출 | origin JSONB는 RLS owner-only 상속 (기존 정책) |

**추가 감사 로그**: from 위반은 `audit_logs.metadata.kind = "handoff_violation"` 로 기록 (lib/audit/admin-client.ts 활용).

---

## 8. 실패 모드와 폴백

| 실패 | 동작 |
|------|------|
| `from` 모르는 값 | 무시하고 일반 진입. 로그 남김. |
| role 부족 | 무시하고 일반 진입. 사용자에게 별도 안내 없음 (UX 단순성). |
| 리졸버 에러 (DB down 등) | 무시하고 일반 진입. 로그에 기록. |
| studentId RLS 차단 | 무시하고 일반 진입. 감사 로그. |
| `from` 유효하지만 데이터 없음 | 스니펫에 "데이터 없음" 명시하고 계속 진입 |

**공통 원칙**: 승계 실패는 사용자 흐름을 차단하지 않는다. 항상 빈 대화로 폴백.

---

## 9. 구현 순서 (T-4 내부, E-2 반영)

1. **마이그레이션** — `ai_conversations.origin` JSONB 컬럼 추가
2. **sources.ts** — HANDOFF_SOURCES + SEEDS 상수 + 타입 (scores v0만)
3. **validator.ts** — validateAndResolveHandoff (6단계 검증)
4. **resolvers/scores.ts** — resolveScoresContext (첫 리졸버)
5. **prompt.ts** — snippet → system prompt 조각
6. **opener.ts** — 템플릿 선공 메시지 빌더 (assistant UIMessage + chips)
7. **persistence.ts** — saveOpener + origin 지원
8. **app/ai-chat/page.tsx** — searchParams 확장 + handoff 파이프라인 + 선공 저장
9. **ChatShell.tsx** — 선공 메시지 렌더 + origin 배너 + 내부 chips 처리
10. **api/chat/route.ts** — system prompt에 handoff snippet 주입

---

## 10. 테스트 체크리스트

- [ ] `/ai-chat?id=xxx&from=scores` — 학생 진입 시 seed chips 교체, 프롬프트 주입
- [ ] `/ai-chat?id=xxx&from=admin-scores&studentId=yyy` — admin 진입 시 subject_student_id 기록
- [ ] `/ai-chat?id=xxx&from=admin-scores&studentId=다른테넌트` — 차단 + 감사 로그
- [ ] `/ai-chat?id=xxx&from=unknown` — 무시, 일반 진입
- [ ] 기존 대화 재진입 시 origin 복원 (배너 표시는 T-2)
- [ ] from 없는 기존 진입 동작 불변 (회귀 방지)
- [ ] 리졸버 에러 시에도 페이지 렌더링 성공

---

## 11. 리뷰 필요 결정 요약

| # | 결정 | 추천 | 대안 |
|---|------|------|------|
| 1 | LLM 주입 위치 | 하이브리드 (system + 배너 + seed) | system만 / 자동 user / 자동 assistant |
| 2 | seed 추천 정책 | from별 4개 프리셋 | seed 없음 |
| 3 | 대화 레코드 출처 | ai_conversations.origin JSONB | 기록 없음 / parts 확장 |

리뷰 후 결정 고정 → 구현 진입.
