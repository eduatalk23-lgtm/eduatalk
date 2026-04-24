# Phase 5 draft_refinement 운영 전환 체크리스트

P9 draft_refinement(IMPROVE 자가 개선 루프) 의 운영 플래그 on + 2주 telemetry 수집 + v1/v2 판정 절차.
Sprint 1/2/3 코드 완결(`d9183265` / `05759ce0` / `7fe12657`) 후 남은 **외부 액션 한 묶음**.

---

## 1. 전제 조건

### 1.1 마이그레이션 prod 적용 확인

- `20260419120000_content_quality_retry_count.sql` — `retry_count INT NOT NULL DEFAULT 0`
- `20260420700000_content_quality_refinement_variant.sql` — `refinement_variant TEXT NULL`

확인 쿼리:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'student_record_content_quality'
  AND column_name IN ('retry_count', 'refinement_variant');
-- 2행 반환 + retry_count default 0, refinement_variant nullable 확인.
```

### 1.2 Sprint 2 측정 요약 (참고 baseline)

2026-04-19 xrun 1/3학년 + Kim 3학년 7건 실측:
- refined 5 / rolledBack 0 / skipped 2 (no-draft)
- **avgScoreDelta +12.4** (refined 기준)
- record_type 별: setek +12, changche +10, **haengteuk +15** (최저 baseline 최대 수혜)

2주 누적 실측은 이 수치에서 크게 벗어나지 않아야 함. 벗어나면 중단 조건(§3) 발동.

### 1.3 관련 파일/코드

- Runner: `lib/domains/record-analysis/pipeline/pipeline-task-runners-draft-refinement.ts`
- Prompts: `lib/domains/record-analysis/llm/prompts/draft-refinement-prompts.ts` (상단 docstring 에 판정 기준)
- API route: `app/api/admin/pipeline/grade/phase-9/route.ts`
- 재실행 스크립트: `scripts/rerun-grade-p9-only.ts`
- 쿼리 번들: `scripts/phase-5-telemetry-queries.sql`
- 대시보드: `/superadmin/pipeline-telemetry`

---

## 2. 단계적 플래그 on 절차

`ENABLE_DRAFT_REFINEMENT` 는 환경 변수. Vercel 에서는 프로젝트 설정 → Environment Variables → Production 에 추가.
각 단계마다 다음 단계 진입 전 sanity check 필수.

### Stage 1 — xrun 단일 학생 (24h)

- **범위**: xrun 1/3학년 (기준 학생 2명 중 이미 측정 데이터 있는 쪽)
- **진입 방법**: 로컬 `.env.local` 에 `ENABLE_DRAFT_REFINEMENT=true` + `npx tsx scripts/rerun-grade-p9-only.ts` 수동 실행
- **기대 결과**: Sprint 2 와 동일 경향 재현 — rollback 0, avgΔ 10~15 범위
- **중단 조건**:
  - rollback 발생 (0 기대)
  - avgΔ < +5
  - runner 처리 시간 > 60s/chunk

통과 시 Stage 2.

### Stage 2 — Kim 학생 추가 (3일)

- **범위**: Stage 1 + Kim 3학년
- **진입 방법**: 로컬 실행 그대로, 두 학생 번갈아
- **목표**: 학생간 variant 분포 확인 — djb2 parity 로 v1/v2 가 5:5 근처인지
- **중단 조건**: Stage 1 과 동일

### Stage 3 — Production on (2주)

- **범위**: Vercel Production env 에 `ENABLE_DRAFT_REFINEMENT=true` 설정 → 실 운영 파이프라인 전부
- **배포**: env 반영을 위해 empty deploy 1회 필요 (`vercel --prod` 또는 git push 로 자동 트리거)
- **모니터링 주기**:
  - 24h 후: §4 Q1~Q3 실행 (초기 배치 sanity)
  - 1주차: 대시보드 `/superadmin/pipeline-telemetry` 전체 지표 확인
  - 2주차: §5 판정 분기 적용

---

## 3. 중단 조건 (auto-abort)

아래 중 1개라도 충족 시 **즉시 env off → 원인 조사 → 재개 판단**:

| 지표 | 임계 | 감지 방법 |
|------|------|-----------|
| rollback 비율 | ≥ 30% | Q1 |
| avgScoreDelta | ≤ 0 (v1/v2 합산) | Q1 |
| P9 chunk 실행 시간 | > 60s | OTel span `gen_ai.duration` |
| LLM 월 비용 증가 | > +30% | Vercel usage dashboard |
| 사용자 품질 불만 신고 | 1건 이상 | 수동 |

**env off 이후 정리**:
- retry_count=1 로 마킹된 레코드는 자동 복구되지 않음 — 필요 시 SQL 로 `retry_count=0` 리셋 후 재실행
- 원인이 v2 프롬프트면 §5 [B] 로 진행 (v1 고정)

---

## 4. 2주 측정 목표

§5 판정에 충분한 표본 확보:

| 지표 | 목표 |
|------|------|
| variant 별 refined n | ≥ 30 each (v1, v2) |
| record_type 별 n | setek/changche/haengteuk 각 ≥ 15 |
| rollback 비율 | 관찰 (임계 미도달만 확인) |
| avgΔ 분포 | variant × record_type 6분할 평균 |

n < 30 이면 판정 보류 (§5 [D]) — 측정 기간 연장.

---

## 5. 판정 분기 (2주 후)

`draft-refinement-prompts.ts` 상단 docstring 에 같은 기준 명문화.

### [A] v2 승격 (v2 고정, v1 제거)

**조건 모두 충족**:
- v2.avgΔ ≥ v1.avgΔ + 2.0
- v2.rollbackRate ≤ v1.rollbackRate + 5%p
- v2.skipRate ≈ v1.skipRate (±5%p)

**액션**:
1. `draft-refinement-prompts.ts::selectRefinementVariant()` 를 `return "v2_axis_targeted"` 상수 반환으로 단순화
2. v1 분기 제거 (코드 + 테스트)
3. 커밋 prefix `feat(record-analysis):` — v2 단일화 이유 + 2주 실측 수치 포함

### [B] v1 고정 (v2 폐기)

**조건 중 하나라도**:
- v2.avgΔ < v1.avgΔ
- v2.rollbackRate > 15%

**액션**:
1. v2 분기 + v2 프롬프트 제거
2. `REFINEMENT_VARIANTS` 를 `["v1_baseline"] as const` 로 축소
3. `content_quality.refinement_variant` 컬럼은 historical data 용으로 유지

### [C] v3 설계 트리거

**조건**: `max(v1.avgΔ, v2.avgΔ) < +8.0`

프롬프트 엔지니어링 레버 소진 신호. 후속 브리프 작성:
- `memory/phase-5-v3-design-brief.md` 로 측정 결과 + 가설 기록
- Cyclic 전환 Phase 4 (`memory/pipeline-cyclic-architecture-research-2026-04-19.md`) 로 승계 검토

### [D] 판정 보류

§4 표본 미달 또는 A/B/C 모두 미해당. env on 상태 유지 + 2주 추가 관찰.

### max_retry 1 → 2 승격 (별도 · 후속)

위 [A] 또는 [B] 확정 **후 4주** 운영 관찰로 결정:
- avgΔ 안정 (월별 변동 ±2 이내)
- rollback < 5%
- retry=2 까지 허용 시 비용 2배 감당 가능

조건 충족 시 `max_retry` 상수 + 관련 가드 수정. 별도 Sprint.

---

## 6. 롤백 절차 (긴급)

1. Vercel env `ENABLE_DRAFT_REFINEMENT` 을 `false` 또는 제거
2. empty deploy 또는 다음 배포까지 대기 (runner 가 process.env 를 런타임 조회하므로 재배포 없어도 즉시 반영되는 경우 많음 — 그러나 안전을 위해 재배포 권장)
3. runner 가 processed=0 으로 no-op → 이후 파이프라인 실행에서 P9 skip
4. 이미 retry_count=1 로 마킹된 레코드는 가드로 재처리 안 됨 (원복 필요 없음)
5. 원본 score 복구가 필요하면 Sprint 1 rollback 로직 이미 발동됨 — 추가 DB 작업 불필요

---

## 7. 참조

- 설계 메모: `memory/phase-5-sprint-2-measurement.md`
- 트랙 매트릭스: `memory/active-tracks-2026-04-20.md` (③ 트랙)
- Cyclic 승계: `memory/pipeline-cyclic-architecture-research-2026-04-19.md`
- 관련 이슈: `memory/issue-pipeline-draft-row-residue.md`
- 관련 피드백: `memory/feedback_pipeline-design-first.md`
