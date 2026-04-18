# Agent-as-Tool 호출 규약 (Phase G Sprint S-0-c)

**작성**: 2026-04-19 · Sprint S-0 산출물
**목적**: 서브에이전트(record-sub / plan-sub / admission-sub)를 Chat Shell 메인 오케스트레이터에서 **tool처럼 호출**하기 위한 인터페이스·컨텍스트 격리·진행 표시·권한 가드 규약 정의.

---

## 1. 설계 원칙

업계 선두 수렴 결과(로드맵 "리서치 근거" 섹션)를 에듀엣톡 환경에 적용한 5 원칙:

1. **Tool 인터페이스**: 서브에이전트는 MCP tool 로 래핑되어 `createMcpServer()`에 등록된다. Shell 관점에선 `getScores` / `analyzeRecord` 와 동급.
2. **컨텍스트 격리**: 서브는 독립 AI SDK `streamText` 세션에서 실행. 메인 conversation 의 messages 배열에 중간 reasoning·tool call 을 섞지 않는다.
3. **요약 반환**: 서브의 최종 output 은 **압축 요약 + 핵심 데이터 + artifactId** 형태. Shell 메인 컨텍스트로 돌아오는 토큰은 원본의 10~20% 이하를 목표.
4. **자동 라우팅 + 수동 탈출구**: Tier Routing(F-4)이 기본 서브 선택. admin 사용자는 `/ask @record-sub ...` 같은 슬래시로 특정 서브 강제 호출 가능 (향후).
5. **권한 게이트**: 각 서브의 `inputSchema` 실행 전 role 검증. 학생은 read-only 서브셋만 접근. admin/consultant 가드는 서브 내부에서 재확인.

---

## 2. 서브에이전트 정의 파일 형식

### 2-1. 파일 위치

```
lib/mcp/subagents/
├── _shared/
│   ├── subagentRunner.ts      # 공통 실행 런타임
│   └── subagentTypes.ts       # SubagentDefinition 타입
├── record-sub.ts              # 생기부 분석·기록·전략·리포트
├── plan-sub.ts                # 수강·계획·적합도
└── admission-sub.ts           # 입시·배치·면접·메모리
```

### 2-2. `SubagentDefinition` 타입

```ts
export type SubagentDefinition = {
  /** "record-sub" 같은 식별자. MCP tool 이름에도 사용 */
  name: string;
  /** LLM 에게 노출되는 1~2문장 책임 설명 (description of description) */
  description: string;
  /** 내부 system prompt */
  systemPrompt: string;
  /** 서브가 호출할 수 있는 MCP/domain tools */
  tools: Record<string, Tool>;
  /** 서브가 사용할 모델 (기본: Gemini 2.5-pro) */
  model?: { provider: "gemini" | "ollama"; id: string };
  /** 최대 step 수. Claude Code default=25 */
  maxSteps?: number;
  /** 요청 timeout (ms) */
  timeoutMs?: number;
  /** 권한 가드: 허용 role 집합 */
  allowedRoles: Array<"student" | "admin" | "consultant" | "superadmin" | "parent">;
  /** 요약 schema — output 중 어떤 필드를 Shell 에 요약·반환할지 */
  summarySchema: ZodSchema;
};
```

### 2-3. 예시 — `record-sub.ts`

```ts
import { z } from "zod";
import type { SubagentDefinition } from "./_shared/subagentTypes";
// ... 기존 lib/agents/tools/record-tools.ts / data-tools.ts / report-tools.ts / strategy-tools.ts 의 tool 들을 import

export const recordSub: SubagentDefinition = {
  name: "record-sub",
  description:
    "학생 생기부 전반(기록·역량 진단·서사·전략·리포트)을 심층 분석·생성. 단순 조회는 Shell 직속 data-tools 로 처리하고, 이 서브는 '분석·진단·생성' 이 필요한 요청에만 호출.",
  systemPrompt: `당신은 생기부 심층 분석 전문 서브에이전트입니다. ...`,
  tools: {
    // read (24 tool 중 주요만 예시)
    getStudentRecords, getStudentDiagnosis, getStudentStorylines,
    // analyze
    analyzeCompetency, analyzeHighlight, detectStoryline, crossSubjectAnalysis,
    // generate
    generateDiagnosis, generateSetekDraft, improveSetekDraft, generateReport,
    // trigger
    triggerPipeline,
    // write
    saveDiagnosisResult, saveCompetencyScore, saveStrategy,
    // meta
    suggestStrategies, getWarnings, getPipelineStatus,
    // memory
    recallSimilarCases, recallPastCorrections,
  },
  model: { provider: "gemini", id: "gemini-2.5-pro" },
  maxSteps: 20,
  timeoutMs: 120_000,
  allowedRoles: ["admin", "consultant", "superadmin"],
  summarySchema: z.object({
    headline: z.string().describe("1문장 핵심 결론"),
    keyFindings: z.array(z.string()).max(5),
    recommendedActions: z.array(z.string()).max(3),
    artifactIds: z.array(z.string()).describe("Shell 이 열 수 있는 artifact id 목록"),
    durationMs: z.number(),
    stepCount: z.number(),
  }),
};
```

---

## 3. 실행 런타임 — `subagentRunner.ts`

### 3-1. 서명

```ts
export async function runSubagent(args: {
  def: SubagentDefinition;
  input: string;                       // Shell 이 위임할 자연어 요청
  context?: {
    studentId?: string;
    conversationId?: string;           // 상위 대화 추적용
    parentMessageId?: string;          // trace 연결
  };
}): Promise<SubagentResult>;

export type SubagentResult = {
  ok: true;
  summary: z.infer<def.summarySchema>;  // Shell 반환용 압축 요약
  rawSteps: AgentStepTrace[];           // agent_step_traces 저장용 (Shell 에는 안 보냄)
  cost: { tokens: number; usd: number };
} | { ok: false; reason: string };
```

### 3-2. 흐름

1. `allowedRoles` 검증 → 불허 시 `ok:false` 반환
2. 독립 `streamText` 세션 생성: `{ model, system: def.systemPrompt, tools: def.tools, messages: [{role:"user", content: input}], stopWhen: stepCountIs(def.maxSteps) }`
3. 실행 중 각 step 은 `agent_step_traces` 테이블에 저장 (기존 Agent 영속화 재사용)
4. 스트림 종료 후 최종 assistant message 를 `summarySchema` 로 structured output 추출 — 서브 LLM 이 요약 JSON 을 생성하도록 prompt 지시
5. `SubagentResult` 반환

### 3-3. 실행 시간 + 서버리스 대응

- Vercel hobby = 10s · pro = 60s 제한. 서브 실행은 보통 10s~120s.
- **해결**: 서브 호출은 백그라운드 `ai_subagent_runs` 테이블에 `pending` 행으로 적재 + task id 반환. Shell 은 task id 를 polling 하거나 SSE 로 진행 수신.
- Shell tool call 은 즉시 반환(<3s): `{ok:true, pending:true, taskId}` 형태.
- 완료되면 Shell 이 다음 턴에서 `getSubagentResult(taskId)` 호출 또는 Realtime 으로 push.

---

## 4. Shell MCP tool 래퍼

### 4-1. 등록 방식

`lib/mcp/server.ts` 에 서브에이전트마다 **상위 tool 1 개** 등록. 서브 내부의 24 tool 이 Shell LLM 에 직접 노출되지 않음.

```ts
server.registerTool(
  "analyzeRecordDeep",
  {
    description:
      "학생 생기부를 심층 분석·진단·전략 생성. 단순 조회(getStudentRecords/Diagnosis)로 부족한 요청 — 새 진단 생성·세특 초안·리포트 작성·복합 분석 등 — 에 호출.",
    inputSchema: {
      studentName: z.string().describe("대상 학생 이름"),
      request: z.string().describe("자연어로 서브에이전트가 수행할 작업 요약"),
    },
  },
  async (args) => {
    const target = await resolveStudentTarget({ studentName: args.studentName });
    if (!target.ok) return { ok: false, reason: target.reason };
    const result = await runSubagent({
      def: recordSub,
      input: `학생: ${target.studentName} (id=${target.studentId})\n요청: ${args.request}`,
      context: { studentId: target.studentId },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
      isError: !result.ok,
    };
  },
);
```

### 4-2. tool 세트 확장 (Phase G 완료 후)

- `analyzeRecordDeep` — record-sub 위임
- `designStudentPlan` — plan-sub 위임
- `analyzeAdmission` — admission-sub 위임

Shell 은 **11 tool 체제** 로 안정화 (직속 8 + 서브 위임 3). LLM 프롬프트 토큰 절약 + 사용자 인지 부담 감소.

---

## 5. 컨텍스트 격리 + 요약 반환 규율

### 5-1. 요약 schema 적용

서브 내부 LLM 의 마지막 assistant message 는 **반드시 `summarySchema` 준수 JSON**. AI SDK `generateObject` 또는 `streamText` + `toolChoice: {type:"tool", toolName:"return_summary"}` 강제.

### 5-2. 메인 컨텍스트 오염 방지

Shell 에 반환되는 tool result 는 `summary` 만 포함. `rawSteps` 는 DB 저장용. Shell UI 는 **요약 카드** 로 렌더, 세부 trace 는 별도 `/admin/agent?traceId=xxx` debug 뷰에서 조회.

### 5-3. Artifact 연동

서브가 `artifactIds` 를 돌려주면 Shell 이 `onOpenArtifact` 로 자동 오픈 (Phase T v1 #2 경로 재사용). 예: 리포트 생성 → artifactId=`report:{reportId}` → Shell 우측 패널에 리포트 미리보기.

---

## 6. 진행 표시 UI (S-2 작업)

Claude Code `/tasks` 타임라인 패턴 참고. ChatShell 에서 서브 호출 시:

```
┌─ analyzeRecordDeep (record-sub) ────────── 진행 중 · 14s ┐
│  step 1/12  getStudentRecords  ✓                         │
│  step 2/12  analyzeCompetency  ✓                         │
│  step 3/12  generateDiagnosis  ● running...              │
│                                                           │
│  [세부 trace 보기 →]                                      │
└───────────────────────────────────────────────────────────┘
```

- step count + 소요 시간 실시간 표시
- 완료 후에는 요약 카드로 교체 (접기 상태)
- debug 링크는 admin 에만 노출

---

## 7. 권한 가드 2층 구조

### Layer 1 — Shell tool 등록 시점
`analyzeRecordDeep` / `designStudentPlan` / `analyzeAdmission` 상위 tool 은 `route.ts` 의 `buildUserContextPrompt()` 에서 role 별로 tool set 동적 필터. 학생 role 은 상위 tool 3개 모두 제외.

### Layer 2 — `runSubagent` 진입 시점
`allowedRoles` 검증 중복. layer 1 우회(프롬프트 인젝션 등) 방어.

### Read-only 학생 경로
데이터 조회는 Shell 직속 `getStudentRecords` / `getStudentDiagnosis` / `getStudentStorylines` / `getStudentOverview` 로 처리. 학생 본인 데이터만 resolveStudentTarget 이 허용.

---

## 8. 마이그레이션 계획

### S-1: record-sub 구현
1. `lib/mcp/subagents/_shared/subagentRunner.ts` + `subagentTypes.ts`
2. `lib/mcp/subagents/record-sub.ts` — 24 tool 집결 + systemPrompt + summarySchema
3. `ai_subagent_runs` 마이그레이션 (pending/running/completed/failed state)
4. `analyzeRecordDeep` MCP tool 등록
5. Shell 시스템 프롬프트에 "[심층 분석 규칙] 진단·리포트 생성 요청은 analyzeRecordDeep 호출" 추가

### S-2: UI 통합
1. ChatShell 에 서브에이전트 진행 타임라인 컴포넌트
2. admin 이 아닌 사용자에게는 `analyzeRecordDeep` 숨김
3. `/admin/agent` 에 상단 배너 "trace/debug 전용. 실사용은 /ai-chat" 표시
4. Phase F-5 EscalationBanner 를 "Agent 모드 이동" → "서브에이전트 직접 호출" 로 문구 조정 가능

### S-3: plan-sub + admission-sub + 폴리싱
1. 각 서브 구현 반복
2. 미결 5건(S-0-a) 분류 반영: getStudentAssignments → record / simulateMinScore → admission / memory 분할 / etc
3. 회귀: 기존 `/admin/agent` 흐름이 여전히 작동 (trace 뷰 경로)

---

## 9. 롤백 플랜

Sprint 진행 중 문제 시:

- **S-1 실패** → record-sub 래퍼 제거, Shell 원복. 사용자 영향 없음 (기존 /admin/agent 그대로)
- **S-2 실패** → UI 통합 롤백, admin-only tool 재숨김. 서브에이전트는 API 만 존재
- **S-3 실패** → 해당 서브만 제외. record-sub 만 유지

---

## 10. 성공 기준

- Shell 8 + 서브 3 = **11 tool** 로 UI 단순화
- record-sub 1 호출로 생기부 진단 + 리포트 생성 end-to-end 가능
- admin 사용자 체감: `/admin/agent` 페이지 이동 없이 `/ai-chat` 에서 동일 워크플로우 완료
- agent_step_traces 는 보존되어 Observability/Auto-improve 루프(G-3/G-4)의 데이터 소스로 계속 기능

---

## 참조

- Claude Code subagents 공식: https://code.claude.com/docs/en/sub-agents
- LangGraph supervisor: https://docs.langchain.com/oss/python/langchain/multi-agent/subagents-personal-assistant
- 본 로드맵: `docs/ai-chat-roadmap.md` (Phase G 섹션 · 2026-04-19 재편)
- 경계안 근거: Sprint S-0-a 조사 보고서 (세션 대화 기록)
