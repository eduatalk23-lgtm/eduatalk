# Student-Record Domain 10-Area Improvement Plan

## Context

생기부 도메인 원점 분석에서 10개 개선 영역을 도출. 프로덕션 안정성을 위해 **안전 수정(Batch 1-3)과 구조 변경(Batch 4-8)을 분리 배포**하며, 각 배치는 독립 커밋+검증 가능.

CLAUDE.md 규칙: "안전 수정과 구조 변경 절대 같이 배포 금지"

---

## Batch 1: 상수 추출 + 중복 제거 (Safe, 기능 변경 없음)

### 1-A. 매직 넘버 `< 20` → 상수 교체 (14건)

`PIPELINE_THRESHOLDS.MIN_IMPORTED_LENGTH` (이미 `constants.ts:510`에 정의됨)로 교체:

| 파일 | 건수 |
|------|------|
| `stale-detection.ts:68` | 1 |
| `llm/actions/analyzeWithHighlight.ts:33,149` | 2 |
| `pipeline/synthesis/phase-s1-storyline.ts:50,65` | 2 |
| `pipeline-task-runners-competency.ts:516,522,528,706,755,804,851,898,981` | 9 |

### 1-B. ACTIVITY_LABELS 상수화

- `constants.ts`에 추가:
  ```typescript
  export const ACTIVITY_TYPE_LABELS: Record<string, string> = { autonomy: "자율", club: "동아리", career: "진로" };
  ```
- `pipeline-task-runners-guide.ts:198,233,490` 인라인 선언 3개 → import로 교체

### 검증
```bash
pnpm lint && pnpm build && pnpm test lib/domains/student-record
```

---

## Batch 2: Fire-and-forget 로깅 + 타입 캐스트 정리 (Safe)

### 2-A. 빈 catch → logActionWarn (13건)

| 파일 | 건수 | 패턴 |
|------|------|------|
| `stale-detection.ts:18,35,52,109,164` | 5 | 빈 catch 블록 |
| `stale-detection.ts:193,196,204` | 3 | `.catch(() => {})` |
| `actions/pipeline.ts:279,332` | 2 | 빈 catch 블록 |
| `import/importer.ts:264,282,284` | 3 | 빈 catch + `.catch(() => {})` |

각 catch에 `logActionWarn(LOG_CTX, "<작업명> failed (fire-and-forget)", { error })` 추가.

### 2-B. `as unknown as` → `.returns<T>()` 전환 (8건)

**새 파일**: `repository/typed-queries.ts` — Supabase nested select 결과 타입 헬퍼

| 파일:줄 | 현재 | 변경 |
|---------|------|------|
| `guide-context.ts:60` | `as unknown as { title... }` | `.returns<AssignmentWithGuide[]>()` |
| `actions/duplication.ts:63` | `as unknown as { display_name }` | `.returns<StudentWithProfile[]>()` |
| `actions/report-share.ts:83` | exportData 캐스팅 | `as Record<string, unknown>` (JSONB 컬럼 — 유지) |
| `actions/report-share.ts:142` | share.report_data 캐스팅 | `.returns<ShareWithReport[]>()` |
| `actions/schoolProfile.ts:394` | subject nested | `.returns<SubjectWithGroup[]>()` |
| `actions/schoolProfile.ts:494` | subject_group nested | `.returns<SubjectGroupRow[]>()` |
| `actions/report.ts:214` | user_profiles nested | `.returns<StudentWithName[]>()` |

### 검증
```bash
pnpm lint && pnpm build && pnpm test lib/domains/student-record
```

---

## Batch 3: 테스트 추가 (Safe, 신규 파일만)

### 3-A. `__tests__/service.test.ts` — service.ts 35개 함수 중 핵심 12개

Mock: `vi.mock("./repository")`, `vi.mock("@/lib/supabase/server")`

테스트 시나리오:
- `saveSetek`: NEIS 바이트 초과/정상/공통과목 합산/충돌감지(expectedUpdatedAt)
- `saveChangche`/`saveHaengteuk`: 정상저장 + 충돌감지
- `getRecordTabData`: repository 6개 함수 병렬 호출 확인
- 에러 케이스: repository throw 시 `{ success: false }` 반환

### 3-B. `__tests__/html-parser.test.ts` — parseNeisHtml

Mock 없음 (순수 함수). 테스트 데이터:
- 정상 NEIS HTML 샘플 (세특+성적+창체+행특+독서 포함)
- 일반/진로선택/체예 테이블 모드 각 1건
- 엣지: 빈 HTML, 섹션 누락, 특수문자

### 3-C. `__tests__/pipeline-competency-runners.test.ts` — 역량 분석 러너

Mock: `vi.mock("./llm/actions/analyzeWithHighlight")`, `vi.mock("./competency-repository")`, `vi.mock("./content-hash")`

테스트 시나리오:
- 캐시 히트 → LLM 미호출
- 캐시 미스 → LLM 호출 + 결과 저장
- 청크 분할 (chunkSize=2, 미캐시 5건 → 2건만 처리 + hasMore=true)
- 실패 레코드 재시도 (10초 대기 mock)
- 에러 케이스: LLM 전체 실패 → failed 카운트

### 검증
```bash
pnpm test lib/domains/student-record
# 기존 991+ 테스트 + 신규 ~60건 모두 통과 확인
```

---

## Batch 4: withRetry 일관화 (구조 변경, 저위험)

LLM action 내부에 이미 `withRetry`가 적용된 곳과 아닌 곳을 최종 확인 후, 누락된 곳에 래핑 추가.

탐색 결과: 대부분의 LLM action은 내부에서 이미 `withRetry`를 사용. 누락이 확인되면 해당 action 파일 내부에 추가.

### 검증
```bash
pnpm test lib/domains/student-record/__tests__/retry.test.ts
pnpm build
```

---

## Batch 5: 성적 조회 헬퍼 추출 (구조 변경, 중위험)

### 5-A. `repository/score-query.ts` 신규 생성

```typescript
export async function fetchCareerContext(supabase, studentId): Promise<CareerContext | null>
export async function fetchScoresWithSubject(supabase, studentId): Promise<ScoreRow[]>
```

### 5-B. 6곳 인라인 쿼리 교체

| 파일 | 줄 | 교체 함수 |
|------|----|---------| 
| `pipeline-task-runners-competency.ts:66,318,407` | 3곳 | `fetchCareerContext` |
| `pipeline/synthesis/phase-s3-diagnosis.ts:70,97` | 2곳 | `fetchScoresWithSubject` |
| `llm/actions/analyzeWithHighlight.ts:50` | 1곳 | `fetchScoresWithSubject` |

### 검증
```bash
pnpm lint && pnpm build && pnpm test lib/domains/student-record
```

---

## Batch 6: Phase narrowed 타입 적용 (구조 변경, 중위험)

`assertGradeCtx()`, `assertSynthesisCtx()` 를 실제 Phase 러너 진입부에 적용.

### Grade Phase 러너 (9개 함수)
`pipeline-task-runners-competency.ts`의 각 export 함수 진입부에:
```typescript
assertGradeCtx(ctx);
// 이후 ctx.targetGrade, ctx.resolvedRecords는 non-null 보장
```
기존 `if (targetGrade == null) throw new Error(...)` 패턴을 어설션 헬퍼로 교체.

### Synthesis Phase 러너 (6개 Phase)
`pipeline-synthesis-phases.ts`의 각 Phase 진입부에:
```typescript
assertSynthesisCtx(ctx);
// 이후 ctx.unifiedInput은 non-null 보장
```

### 검증
```bash
pnpm build && pnpm test lib/domains/student-record
```

---

## Batch 7: 스토리라인 트랜잭션 RPC (구조 변경, 고위험)

### 7-A. DB 마이그레이션

**신규**: `supabase/migrations/YYYYMMDD_storyline_atomic_ops.sql`

```sql
-- 1. AI 스토리라인 일괄 삭제 (링크 포함)
CREATE OR REPLACE FUNCTION delete_ai_storylines_by_student(p_student_id uuid, p_tenant_id uuid)
RETURNS integer AS $$ ... $$ LANGUAGE plpgsql;

-- 2. 스토리라인+링크 원자적 삽입
CREATE OR REPLACE FUNCTION create_ai_storyline_with_links(p_tenant_id uuid, p_student_id uuid, p_storyline jsonb, p_links jsonb)
RETURNS uuid AS $$ ... $$ LANGUAGE plpgsql;
```

### 7-B. Phase 코드 교체

`pipeline/synthesis/phase-s1-storyline.ts:113-172`의 `Promise.allSettled` 중첩을:
1. `supabase.rpc("delete_ai_storylines_by_student", ...)` 1회
2. storyline별 `supabase.rpc("create_ai_storyline_with_links", ...)` N회

로 교체. 부분 실패 → 고아 레코드 위험 제거.

### 배포 전략
1. 마이그레이션 먼저 배포 (하위 호환 — 신규 함수 추가만)
2. 코드 변경 후속 배포

### 검증
```bash
supabase db reset  # 로컬 검증
pnpm test lib/domains/student-record
```

---

## Batch 8: 대형 파일 분리 (구조 변경, 중위험)

### 8-A. `generateDiagnosis.ts` (931줄) → 3파일
- `llm/actions/generateDiagnosis.ts` (~200줄): 메인 함수만
- `llm/prompts/diagnosisPrompt.ts` (~400줄): 프롬프트 빌딩
- `llm/actions/diagnosis-helpers.ts` (~300줄): 데이터 준비

### 8-B. `actions/report.ts` (805줄) → 2파일
- `actions/report.ts` (~400줄): 액션 + 공유
- `actions/report-data-builder.ts` (~400줄): `fetchReportData` 데이터 조립

### 검증
```bash
pnpm lint && pnpm build && pnpm test lib/domains/student-record
```

---

## 배포 순서 + 의존성

```
Deploy 1: Batch 1+2 (Safe) ─── 상수교체 + 로깅 + 타입정리
Deploy 2: Batch 3 (Safe)   ─── 테스트 추가 (신규 파일만)
Deploy 3: Batch 4 (Low)    ─── withRetry 일관화
Deploy 4: Batch 5 (Medium) ─── 성적 조회 헬퍼 (테스트 커버 확보 후)
Deploy 5: Batch 6 (Medium) ─── Phase narrowed 타입
Deploy 6: Batch 7 (High)   ─── 스토리라인 RPC (마이그레이션 선행)
Deploy 7: Batch 8 (Medium) ─── 대형 파일 분리 (마지막)
```

## 핵심 파일 목록

| 파일 | 관련 Batch |
|------|-----------|
| `lib/domains/student-record/constants.ts` | 1 |
| `lib/domains/student-record/stale-detection.ts` | 1, 2 |
| `lib/domains/student-record/pipeline-task-runners-competency.ts` | 1, 5, 6 |
| `lib/domains/student-record/pipeline-task-runners-guide.ts` | 1 |
| `lib/domains/student-record/pipeline/synthesis/phase-s1-storyline.ts` | 1, 7 |
| `lib/domains/student-record/llm/actions/analyzeWithHighlight.ts` | 1 |
| `lib/domains/student-record/actions/pipeline.ts` | 2 |
| `lib/domains/student-record/import/importer.ts` | 2 |
| `lib/domains/student-record/guide-context.ts` | 2 |
| `lib/domains/student-record/actions/report.ts` | 2, 8 |
| `lib/domains/student-record/actions/schoolProfile.ts` | 2 |
| `lib/domains/student-record/service.ts` | 3 |
| `lib/domains/student-record/import/html-parser.ts` | 3 |
| `lib/domains/student-record/pipeline-types.ts` | 6 |
| `lib/domains/student-record/pipeline-synthesis-phases.ts` | 6 |
| `lib/domains/student-record/llm/actions/generateDiagnosis.ts` | 8 |

## 재사용할 기존 유틸리티

| 유틸 | 경로 | 용도 |
|------|------|------|
| `PIPELINE_THRESHOLDS` | `constants.ts:508` | 매직 넘버 교체 |
| `logActionWarn` | `@/lib/logging/actionLogger` | fire-and-forget 로깅 |
| `withRetry` | `llm/retry.ts` | LLM 재시도 래핑 |
| `assertGradeCtx/assertSynthesisCtx` | `pipeline-types.ts` | Phase 타입 가드 |
| `refreshCompetencyTagsAtomic` (RPC 패턴) | `competency-repository.ts` | 스토리라인 RPC 참조 |

## 검증 체크리스트 (모든 Deploy 공통)

```bash
pnpm lint                                    # 린트 에러 0
pnpm build                                   # 빌드 성공
pnpm test lib/domains/student-record         # 기존 991+ 테스트 통과
git diff --stat HEAD                         # 변경 범위 확인
```
