# TimeLevelUp Architecture

> 이 문서는 프로젝트의 **중심축(hub)**입니다. 상세 내용은 각 섹션의 위성 문서로 링크됩니다.
> 작성 규칙은 [matklad의 ARCHITECTURE.md 원칙](https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html)을 따릅니다 — **"국가 지도이지 주(州) 지도 세트가 아니다."**

---

## 0. 한 문장 정의

**TimeLevelUp은 학생 생기부(학생생활기록부)를 멀티 에이전트 AI 파이프라인으로 분석·설계·전략 제시하는 학종 컨설팅 플랫폼이다.**

학원(학습관) SaaS에서 출발했으나, 현재 프로젝트의 실질 중심은 **생기부 AI 분석 시스템(Compound AI)**이다.
학습 플랜/성적 관리는 그 중심을 지탱하는 주변 기능이다.

---

## 1. 시스템 정체성 (Why)

### 1.1 해결하는 문제

| 문제 | 현재 업계 상태 | TimeLevelUp의 접근 |
|---|---|---|
| **컨설턴트 병목** | 생기부 1건 정성 분석에 2~4시간 | AI가 1차 분석 → 컨설턴트가 검토·교정 (협업 모델) |
| **생기부 품질 편차** | 학교·교사별 기재 수준 차이 | 루브릭 기반 5축 품질 점수 + 반복 패턴 감지 |
| **학종 불투명성** | "어느 대학이 내 생기부를 좋아할까?" | 대학 인재상 프로필 매칭 + 교과 적합도 |

### 1.2 사용자 3주체

- **학원(관리자·컨설턴트)** — 생기부 분석·진단·전략 생성·검토
- **학생** — 내 생기부 약점·보완 방향 확인 (AI 라벨 비노출)
- **학부모** — 자녀 학습/생기부 현황 모니터링

### 1.3 핵심 가치 제안

**"AI가 1차 분석 → 컨설턴트가 검토·교정"**. AI 단독 결정 금지, 항상 Human-in-the-loop. 이 원칙이 L4-D 검증 루프(§5), 프롬프트 엄격화, 골든셋 CI 전체를 관통한다.

---

## 2. 아키텍처 5계층 관점 (What)

프로젝트를 전통적 "프론트/백/DB" 3-tier가 아닌 **Compound AI System** 관점에서 5계층으로 본다. 각 계층은 독립적으로 진화 가능하며, 명시적 계약(interface)으로만 연결된다.

```
┌────────────────────────────────────────────────────────────┐
│ ⑤ UI Layer         4단계 탭 (RECORD→DIAGNOSIS→DESIGN→      │
│                    STRATEGY), React Query, App Router       │
├────────────────────────────────────────────────────────────┤
│ ④ Data Layer       Supabase + RLS (initplan), 3중 저장     │
│                    전략, Polymorphic FK, 소프트 삭제         │
├────────────────────────────────────────────────────────────┤
│ ③ AgentOps Layer   프롬프트 버전, LLM 티어/쿼터/폴백,      │
│                    재시도(withRetry), 재실행 cascade          │
├────────────────────────────────────────────────────────────┤
│ ② Harness Layer    골든셋 50건, LLM-as-Judge(L2),         │
│                    CI 회귀(eval-golden-dataset.yml)          │
├────────────────────────────────────────────────────────────┤
│ ① Agent Layer      3-Tier 파이프라인, L4-D Hypothesis-     │
│                    Verify Loop, 18개 LLM Actions             │
└────────────────────────────────────────────────────────────┘
```

### 2.1 Agent Layer (핵심)

- **위치**: `lib/domains/record-analysis/pipeline/`, `lib/domains/record-analysis/llm/`
- **역할**: 생기부 분석의 실제 계산. Grade 9태스크×8Phase + Synthesis 10태스크×6Phase.
- **자기 반성 루프**: L1 Deterministic(규칙) → L2 Coherence(Flash LLM-judge) → L3 Targeted Repair
- **대표 파일**: `pipeline-executor.ts`, `pipeline-grade-phases.ts`, `llm/validators/`
- **상세**: [`lib/domains/record-analysis/CLAUDE.md`](../lib/domains/record-analysis/CLAUDE.md)

### 2.2 Harness Layer

- **위치**: `lib/domains/record-analysis/eval/`, `scripts/eval-*.ts`, `.github/workflows/eval-golden-dataset.yml`
- **역할**: Agent Layer 변경 시 품질 회귀 방지. 업계 표준 "LLM-as-a-Judge + Golden Dataset" 패턴 구현.
- **규모**: 골든셋 50건 (카테고리 A/B/F/Z), 4-Provider 실측 체계(Gemini/GPT/Gemma)
- **대표 파일**: `eval/golden-dataset.ts`, `scripts/eval-student-record.ts`
- **상세**: [`docs/llm-comparison-2026-04-13.md`](./llm-comparison-2026-04-13.md)

### 2.3 AgentOps Layer

- **위치**: `lib/domains/record-analysis/llm/` (retry, ai-client), `lib/domains/plan/llm/actions/coldStart/`
- **역할**: LLM 호출의 운영 안정성. 티어 정책, 쿼터 추적, 폴백.
- **티어 매핑**:
  - `advanced` → Gemini 2.5 Pro (역량 태깅, 생성 품질 중시)
  - `standard` → Gemini Flash (가이드/진단/전략, 비용·속도 균형)
  - `fast` → GPT-4o-mini (단순 분류/검증)
- **쿼터**: Gemini Free Tier 일 20회/분 15회 → DB 캐시 폴백
- **재시도**: 지수 백오프 1s→3s→10s, 최대 3회
- **상세**: [`docs/llm-model-tier-analysis.md`](./llm-model-tier-analysis.md), [`docs/cold-start-system-guide.md`](./cold-start-system-guide.md)

### 2.4 Data Layer

- **위치**: `supabase/migrations/`, `lib/supabase/`, `lib/domains/*/repository/`
- **역할**: 영속성. Supabase Postgres + RLS + 트리거.
- **핵심 규칙**:
  - RLS 정책: `(SELECT auth.uid())`로 감싸 initplan 1회 평가
  - FK CASCADE: `students.id` 참조는 `ON UPDATE/DELETE CASCADE`
  - 분석 데이터 3중 저장: `analysis_cache` / `activity_tags+competency_scores` / `content_quality`
  - Polymorphic FK: `record_type + record_id` (트리거로 고아 방지)
  - 삭제 정책: 코어=소프트 삭제, 파생=하드 삭제
- **상세**: 루트 [`CLAUDE.md`](../CLAUDE.md) "Database" 섹션

### 2.5 UI Layer

- **위치**: `app/`, `components/`
- **역할**: 3 역할(학생/관리자/학부모) × 4단계 탭 구조.
- **생기부 4단계 탭** (`app/(admin)/admin/students/[id]/`):
  ```
  1. RECORD (기록)     — 세특/창체/행특/독서 에디터
  2. DIAGNOSIS (진단)  — 역량 분석, 품질 점수 배지
  3. DESIGN (설계)     — 방향 가이드, 수강계획, 로드맵
  4. STRATEGY (전략)   — 보완전략, 면접 예상 질문, 최저 기준
  ```
- **상태 관리**: React Query(서버 상태) + Context(Toast 등 클라이언트 상태)
- **디자인 시스템**: Tailwind Spacing-First(`gap` 우선), `cn()` 유틸
- **상세**: [`docs/COMPONENT_GUIDE.md`](./COMPONENT_GUIDE.md), [`docs/component-structure-guide.md`](./component-structure-guide.md)

---

## 3. 도메인 지도 (Where)

`lib/domains/` 아래 50+ 도메인. **중심은 `record-analysis`**, 나머지는 중심을 지탱하거나 독립 기능.

```
┌─────────────────────────────────────────────────────────┐
│  ★ 중심 도메인 (AI 분석)                                │
│  ┌───────────────────────────────────────────────────┐ │
│  │  record-analysis  — 파이프라인/LLM/eval           │ │
│  │  student-record   — CRUD/도메인 모델              │ │
│  └───────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  ● 주변 AI 도메인                                       │
│  plan              — 학습 플랜 + Cold Start 추천        │
│  guide             — 탐구 가이드 매칭/생성              │
│  admission         — 입시 배치/배분 엔진                │
│  admin-plan        — 배치 작업 + AI 생성                │
├─────────────────────────────────────────────────────────┤
│  ● 운영 도메인                                          │
│  chat, payment, notification, sms, push, enrollment     │
│  content, master-content, drive                         │
│  calendar, attendance, block, camp, today               │
│  school, tenant, user, auth, student, parent            │
└─────────────────────────────────────────────────────────┘
```

### 3.1 도메인별 상세 문서

각 도메인의 상세 규칙은 **도메인 루트의 `CLAUDE.md`**에 있다 (Claude Code 서브에이전트가 자동 참조).

| 도메인 | 규모 | 상세 | 담당 에이전트 |
|---|---|---|---|
| record-analysis | 70+ 파일 | [`CLAUDE.md`](../lib/domains/record-analysis/CLAUDE.md) | `record-dev` |
| student-record | 89 파일 | [`CLAUDE.md`](../lib/domains/student-record/CLAUDE.md) | `record-dev` |
| plan | 190 파일 | [`CLAUDE.md`](../lib/domains/plan/CLAUDE.md) | `plan-dev` |
| admin-plan | 64 파일 | [`CLAUDE.md`](../lib/domains/admin-plan/CLAUDE.md) | `admin-plan-dev` |
| admission | 47 파일 | [`CLAUDE.md`](../lib/domains/admission/CLAUDE.md) | `admission-dev` |
| guide | 39 파일 | [`CLAUDE.md`](../lib/domains/guide/CLAUDE.md) | `guide-dev` |
| chat | 63 파일 | [`CLAUDE.md`](../lib/domains/chat/CLAUDE.md) | `chat-dev` |

### 3.2 도메인 경계 원칙

- **순환 의존 금지**. `record-analysis → student-record` 방향만 허용.
- **도메인 간 공유 타입**은 `student-record/types`, `student-record/constants` 로 집중.
- **새 도메인 신설 기준**: 5+ 파일 + 독립 DB 테이블 세트.
- **상세**: [`docs/domain-based-architecture-guide.md`](./domain-based-architecture-guide.md)

---

## 4. Record Analysis 심층 (How — 프로젝트의 핵심)

> 이 섹션은 §2.1의 확장. 더 깊은 내용은 [`lib/domains/record-analysis/CLAUDE.md`](../lib/domains/record-analysis/CLAUDE.md)로.

### 4.1 Bird's Eye View

생기부는 **3개 학년 × (세특 / 창체 / 행특 / 독서)** 구조. 파이프라인은 이를 2단계로 처리한다.

```
학년별 (Grade Pipeline)        →    종합 (Synthesis Pipeline)
─────────────────────────────       ───────────────────────────
P1-P3: 역량 분석                    S1: 스토리라인
P4-P6: 방향 가이드                  S2: Edge + 가이드매칭
P7-P8: 가안 생성·분석(설계 모드)    S3: AI 진단 + 교과 적합
                                    S5: 활동 요약 + 전략
                                    S6: 면접 질문 + 로드맵
```

### 4.2 Phase 간 데이터 흐름 (핵심 불변조건)

**원본 LLM 응답은 DB에만 저장. Phase 간 전달은 가공된 요약(`analysisContext`)만.**

이 규칙이 깨지면 Phase가 거대해지고 의존성이 폭발한다. [`student-record-blueprint.md`](./student-record-blueprint.md) 다이어그램 2번 참조.

### 4.3 콘텐츠 해소 4-Layer (불변조건)

```
imported_content (NEIS 최종)
  > confirmed_content (확정본)
  > content (가안)
  > ai_draft_content (AI 초안)
```

**이 순서는 `pipeline-data-resolver.ts`, `pipeline-unified-input.ts`, `phase-s6-interview.ts`에서 일치해야 한다.** 불일치 시 분석 대상이 학년별로 달라져 결과가 무너진다.

### 4.4 L4-D Hypothesis-Verify Loop (품질 보증의 심장)

AI 출력을 무조건 신뢰하지 않는다. 3단계 검증:

```
[LLM 1차 생성]
    ↓
L1 Deterministic  (규칙 11~12종, 0ms, 필수)
    ↓
L2 Coherence      (Flash LLM-judge, 6~5종 규칙, non-fatal)
    ↓
L3 Targeted Repair (Flash MAX=1회, 필드 단위, non-fatal)
    ↓
[검증된 최종 출력]
```

- **적용 범위**: `ai_diagnosis`, `ai_strategy` 양쪽 완료 (L4-D 전체 완료, 커밋 `8da41092` 계열)
- **L3 Repair 제약**: 최대 1회만. 더 돌리면 drift 위험.
- **상세**: `lib/domains/record-analysis/llm/validators/` 하위 8개 파일

### 4.5 설계/분석 이중 레이어

| 테이블 | 구분자 | 분석(NEIS) | 설계(AI 가안) |
|---|---|---|---|
| activity_tags | `tag_context` | `analysis` | `draft_analysis` |
| competency_scores | `source` | `ai` | `ai_projected` |
| content_quality | `source` | `ai` | `ai_projected` |
| edges | `edge_context` | `analysis` | `projected` |
| guides | `guide_mode` | `retrospective` | `prospective` |

**"현재 생기부는 이렇다"(analysis)와 "이렇게 설계해야 한다"(projected)를 DB 레벨에서 분리.** 두 레이어를 섞으면 학생이 아직 하지도 않은 활동을 이미 한 것처럼 오인한다.

---

## 5. 품질 보증 체계 (Quality Guarantees)

Agent Layer 변경이 회귀를 일으키지 않도록 **자동화된 harness**가 상시 감시한다.

### 5.1 골든 데이터셋

- **규모**: 50건 (카테고리 A 고품질 / B 보통 / F 결함 / Z 경계값)
- **위치**: `lib/domains/record-analysis/eval/golden-dataset.ts`
- **진행**: F2+M1 정밀화 완료 — GPT-5.4 98%, GPT-4o 78% (2026-04-13 기준, 커밋 `6bed32fa`)
- **상세**: [`docs/llm-comparison-2026-04-13.md`](./llm-comparison-2026-04-13.md)

### 5.2 LLM-as-a-Judge

L2 Coherence 단계에서 **Flash 모델이 상위 모델의 출력을 평가**. 업계 G-Eval 패턴 구현.

- `diagnosis-coherence-checker.ts`: 6종 규칙
- `strategy-coherence-checker.ts`: 5종 규칙

### 5.3 CI 회귀

- `.github/workflows/eval-golden-dataset.yml` — PR마다 골든셋 점수 리포트
- `.github/workflows/agent-simulation.yml` — 에이전트 세션 회귀

### 5.4 Human-in-the-loop 보정

AWS/MAXIM 권고 패턴: 전문가가 golden 만들고, LLM judge를 그 기준으로 calibrate. 현재 컨설턴트 검토 워크플로우가 이 역할을 수행 중.

---

## 6. 운영 원칙 (Operational Invariants)

> 이 규칙들이 깨지면 시스템이 고장난다. 변경 시 **PR 설명에 명시적 승인** 필요.

### 6.1 LLM 호출

- **모든 LLM 호출은 `withRetry()` 래핑** — 1s → 3s → 10s 지수 백오프, 최대 3회
- **타임아웃**: Vercel Hobby 서버리스 제한 고려 — Fire-and-forget 금지, 청크 실행 패턴 사용
- **모델 티어 임의 선택 금지** — `advanced/standard/fast` 맵핑 준수

### 6.2 Auth (1-Request, 1-Query)

- `supabase.auth.getUser()` 직접 호출 금지 → `getCachedAuthUser()`
- `getCurrentUserRole()` 직접 호출 금지 → `getCachedUserRole()`
- `proxy.ts`는 Edge Runtime이므로 DB 쿼리 0

### 6.3 DB (RLS/FK)

- RLS에서 `auth.uid()` 등은 반드시 `(SELECT auth.uid())`로 감싸기
- `students.id` 참조 FK는 `ON UPDATE/DELETE CASCADE` 필수
- 코어 레코드 하드 삭제 금지 (`deleted_at` 소프트 삭제)

### 6.4 Next.js 16 App Router

- `"use server"` 모듈에서 type re-export 금지 (ReferenceError)
- Dynamic route params는 `Promise<{...}>`
- 패키지는 반드시 `pnpm add` — `node_modules`만 있으면 Vercel 빌드 실패

### 6.5 Vercel Hobby 제약

- Cron: 하루 1회(daily)만 — sub-daily 스케줄 사용 불가
- 서버리스 함수: 체이닝(server→server) 금지, 클라이언트 호출 경유

---

## 7. 로드맵

> memory의 로드맵 문서를 공개용으로 정제. 상세는 `lib/domains/record-analysis/CLAUDE.md` "Pipeline Architecture" 섹션.

### 7.1 완료된 주요 이정표 (Phase별)

- ✅ **Phase 0**: 증거 체인 + 토큰 메트릭 + DB 마이그레이션
- ✅ **Phase 1**: 3-Step 분해(stepA/B/C) + Cascading + 오케스트레이터
- ✅ **Phase 2 (L2)**: Coherence 검증 + Targeted Repair
- ✅ **L4-D 전체**: L1 Deterministic + L2 Coherence + L3 Repair (diagnosis/strategy 양쪽)
- ✅ **H1**: Cross-subject Theme Extractor + S3 진단 주입
- ✅ **H2**: Narrative ProfileCard + interestConsistency
- ✅ **F3**: Golden Dataset CI + PR 코멘트 리포트
- ✅ **Week 1~2**: 측정 루프 (GPT-4o +20pp, GPT-5.4 +12pp)
- ✅ **Week 3**: F2+M1 정밀화 (GPT-5.4 98%, GPT-4o 78%, Q4=0)

### 7.2 진행 중

- 🔄 **L4-E**: Narrative Context 주입 (prioritizedWeaknesses, recordPriorityOrder)
- 🔄 **골든셋 Tier 2**: 다중 레코드 패턴 (L3 승격 검증 도구로 재포지셔닝)

### 7.3 차기 프론티어

- **Tool Calling**: AI가 기존 백엔드 API 실행 (plan 추가, PDF 생성 등)
- **Generative UI** (Vercel AI SDK `streamUI`): 고정 React 컴포넌트 → AI가 UI 구성
- **LLM 프로바이더 다각화 프로덕션 적용**: admin batch → GPT-5.4, 실시간은 Gemini 유지 ([`docs/llm-provider-stability-comparison.md`](../../.claude/projects/-Users-johyeon-u-Desktop-coding-eduatalk/memory/llm-provider-stability-comparison.md) — memory)

### 7.4 보류

- **B3 Exemplar 레벨 보정**: 데이터 부족 (12/51건)으로 보류
- **자동 라벨링 도구**: 라벨링 빈도/팀 규모 갖춰지면 재검토
- **E3 학부모 경고 필터링**: 설계 메모 존재, 미착수

---

## 8. 문서 지도 (Navigation Hub)

이 레포의 모든 중요 문서를 **목적별**로 분류. Diátaxis 프레임워크 기반.

### 8.1 Explanation (왜/무엇)

| 주제 | 문서 |
|---|---|
| **이 문서** | [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) |
| 생기부 시스템 청사진 | [`docs/student-record-blueprint.md`](./student-record-blueprint.md) |
| 도메인 경계 | [`docs/domain-based-architecture-guide.md`](./domain-based-architecture-guide.md) |
| 에이전트 운영 | [`docs/domain-agent-architecture.md`](./domain-agent-architecture.md) |
| LLM 모델 티어 분석 | [`docs/llm-model-tier-analysis.md`](./llm-model-tier-analysis.md) |
| 4-Provider 실측 | [`docs/llm-comparison-2026-04-13.md`](./llm-comparison-2026-04-13.md) |

### 8.2 Reference (참조)

| 주제 | 문서 |
|---|---|
| 프로젝트 규칙 (Claude 용) | [`CLAUDE.md`](../CLAUDE.md) |
| Record Analysis 상세 | [`lib/domains/record-analysis/CLAUDE.md`](../lib/domains/record-analysis/CLAUDE.md) |
| Student Record 상세 | [`lib/domains/student-record/CLAUDE.md`](../lib/domains/student-record/CLAUDE.md) |
| Plan 상세 | [`lib/domains/plan/CLAUDE.md`](../lib/domains/plan/CLAUDE.md) |
| 기타 도메인 | `lib/domains/*/CLAUDE.md` |

### 8.3 How-to (작업 가이드)

| 주제 | 문서 |
|---|---|
| Auth 전략 패턴 | [`docs/auth-strategy-pattern.md`](./auth-strategy-pattern.md) |
| Cold Start 배치 | [`docs/cold-start-system-guide.md`](./cold-start-system-guide.md) |
| 마이그레이션 실행 | [`docs/migration-execution-guide.md`](./migration-execution-guide.md) |
| 환경 설정 | [`docs/env-setup-guide.md`](./env-setup-guide.md) |
| Vercel 배포 | [`docs/vercel-deployment-guide.md`](./vercel-deployment-guide.md) |

### 8.4 Tutorial (학습)

현재 공식 튜토리얼 없음. 신규 합류자는 다음 순서 권장:
1. 이 문서(`ARCHITECTURE.md`) 전체 통독 — 15분
2. [`CLAUDE.md`](../CLAUDE.md) 루트 통독 — 10분
3. [`lib/domains/record-analysis/CLAUDE.md`](../lib/domains/record-analysis/CLAUDE.md) — 20분
4. `app/(admin)/admin/students/[id]/page.tsx`부터 실제 코드 탐색

### 8.5 Decision Log (ADR)

현재 `docs/adr/` 미구축. 향후 세션 핸드오프의 **구조적 결정**을 ADR로 승격 예정 (L4-D 도입, 3-Tier 파이프라인 채택, 멀티 프로바이더 전환 등).

---

## 9. 변경 동기화 규칙

이 문서가 낡으면 신뢰를 잃는다. 다음 변경 시 **반드시 이 문서도 업데이트**:

| 변경 | 업데이트 섹션 |
|---|---|
| 새 도메인 추가/삭제 | §3 |
| 새 LLM 모델/프로바이더 도입 | §2.3, §6.1 |
| 파이프라인 Phase 구조 변경 | §4.1, §4.2 + `record-analysis/CLAUDE.md` |
| 새 계층 신설 (Tool Calling 등) | §2 |
| 5축 이상 주요 리팩토링 완료 | §7.1 |
| 새로운 운영 불변조건 도입 | §6 |

검토 주기: **분기 1회** 정기 검토 + 위 이벤트 발생 시 즉시.

---

*마지막 정기 검토: 2026-04-13*
*다음 정기 검토 예정: 2026-07-13*
