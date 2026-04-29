# Sprint 2-C++ — 통합 운영 전환 런북

**작성**: 2026-04-30 / **대상**: 3 flag 동시 운영 전환

## Why 통합 전환

3 flag 모두 단일 학생 풀런으로 코드 검증 완료. 개별 전환은 모니터링 비용만 누적, 동시 전환 후 telemetry 누적이 효율적.

| flag | 검증 | 도입 커밋 | 효과 |
|---|---|---|---|
| `ENABLE_SLOT_AWARE_RANKING` | 김세린/이가은 cross-validation (04-30 C) | `dd0f50fb` `9053dff3` `5b025f60` | 가이드 다양성 + 5 보너스 |
| `ENABLE_DRAFT_REFINEMENT` | 인제고 1학년 1건 refined +12 (04-24 B) | `d9183265` `7fe12657` | 가안 품질 자가 개선 |
| `ENABLE_MID_PIPELINE_PLANNER` | 김세린 G2 override 실 ID 판정 (04-24 D) | `ba2bf657` | belief 정확도 |

---

## Pre-flight Checklist

- [ ] Vercel 대시보드 → Project → Settings → Environment Variables 접근 가능
- [ ] `/superadmin/pipeline-telemetry` 접근 권한 (telemetry 모니터링)
- [ ] 컨설턴트 1~2명 사전 통보 (분석 결과 변화 사유 설명용)
- [ ] 롤백 권한 확인 (env 토글 즉시 가능)

---

## Step 1 — Vercel 환경변수 추가 (5분)

Vercel Dashboard → Project → Settings → Environment Variables → Add New (각 flag, **Production + Preview 모두**):

```
ENABLE_SLOT_AWARE_RANKING = true
ENABLE_DRAFT_REFINEMENT = true
ENABLE_MID_PIPELINE_PLANNER = true
```

**중요**: 추가 후 자동 redeploy 안 됨 → 수동 redeploy 필요 (Deployments → Redeploy).

---

## Step 2 — Telemetry 베이스라인 캡처 (전환 직전, 10분)

전환 전 비교 기준 확보:

```bash
# Phase 5 telemetry (variant 별 refined 누적)
psql $SUPABASE_DB_URL -f scripts/phase-5-telemetry-queries.sql

# 또는 superadmin UI:
# /superadmin/pipeline-telemetry → variant 별 refined / rolledBack / avgScoreDelta 스크린샷
```

기록할 baseline 지표:
- 지난 7일 풀런 평균 시간 (synthesis pipeline duration)
- 평균 가이드 배정 건수 / 학생
- 평균 content_quality.overall_score
- v1 / v2 refined 누적 (현재 0 / 0)

---

## Step 3 — 배포 + 첫 풀런 모니터링 (1시간)

1. Vercel redeploy 트리거
2. 배포 완료 후 (~3분):
   - 임의 학생 1명 synthesis 재실행 (가급적 김세린 또는 이가은 — 검증 학생)
   - `/superadmin/pipeline-telemetry` 에서 task_results 즉시 확인:
     - `_slotAwareBoost.appliedCount > 0` 확인 → SLOT_AWARE_RANKING 작동
     - `draft_refinement` task 실행 (점수 < 70 가안 있는 경우) → DRAFT_REFINEMENT 작동
     - `runOrientPhase` 후 `midPlan` belief 영속 → MID_PIPELINE_PLANNER 작동

**즉시 롤백 조건**:
- 풀런 시간 baseline 대비 +50% 초과 (timeout 위험)
- 5xx 에러율 baseline 대비 +5%p 초과
- LLM rate limit 비정상 폭증

---

## Step 4 — 24h 모니터링 (1일)

```sql
-- variant 별 refined 누적
SELECT refinement_variant, COUNT(*), AVG(refinement_score_delta)
FROM student_record_content_quality
WHERE refinement_variant IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY refinement_variant;

-- slot-aware boost 적용 분포
SELECT
  (task_results->'_slotAwareBoost'->>'hardPenalizedCount')::int AS hard,
  (task_results->'_slotAwareBoost'->>'penalizedCount')::int AS soft,
  (task_results->'_slotAwareBoost'->>'totalGuides')::int AS total
FROM student_record_analysis_pipelines
WHERE pipeline_type = 'synthesis'
  AND status = 'completed'
  AND completed_at > NOW() - INTERVAL '24 hours';
```

**중단 조건**:
- 컨설턴트 강한 우려 보고 (가이드 추천 품질 / 가안 변경 거부감)
- avgScoreDelta < -3 (refinement 가 평균적으로 점수 하락시킴)
- hard penalty 비율 > 60% (다양성 가드 무효화 → pool 추가 확장 필요)

---

## Step 5 — 2주 누적 후 판정 (Phase 5 v1/v2)

variant 별 refined ≥ 30 도달 시 판정:
- v2 avgΔ ≥ +5 + v2 ≥ v1 → v2 default 승격
- v1 avgΔ ≥ +5 + v2 < v1 → v1 default 고정
- 둘 다 avgΔ < +3 → v3 설계 (별도 sprint)

판정 기준 상세: `lib/domains/record-analysis/llm/prompts/draft-refinement-prompts.ts` 상단 docstring.

---

## Rollback (즉시 가능)

Vercel 대시보드에서 해당 env 만 삭제 또는 `false` 설정 → 자동 redeploy 후 즉시 no-op.

각 flag 의 코드 측 가드:
- `ENABLE_SLOT_AWARE_RANKING`: `phase-s2-guide-match.ts:462` `process.env... === "true"` 체크 → off 시 boost 미적용
- `ENABLE_DRAFT_REFINEMENT`: `pipeline-task-runners-draft-refinement.ts` skip 분기 + retry_count=1 가드
- `ENABLE_MID_PIPELINE_PLANNER`: `pipeline-orient-phase.ts` LLM 분기 → 규칙 기반 MVP 복귀

3 flag 독립 rollback 가능 (서로 의존성 없음).

---

## 참조

- `memory/sprint-1-wiring-handoff-2026-04-30.md`
- `memory/sprint-2-diversity-guard-handoff-2026-04-30.md`
- `memory/sprint-2d-pool-expansion-handoff-2026-04-30.md`
- `memory/session-handoff-2026-04-24-d.md` (mid-pipeline-planner 검증)
- `docs/phase-5-production-rollout-checklist.md` (Phase 5 단독 런북, 통합 시 보완 자료)
- `scripts/phase-5-telemetry-queries.sql`
