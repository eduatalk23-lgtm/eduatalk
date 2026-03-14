# Supabase Disk I/O Budget 소진 문제 해결 보고서

> 작성일: 2026-03-13
> 상태: 완료 (모든 조치 적용됨)

---

## 1. 문제 정의

### 1.1 증상

Supabase에서 다음 경고가 발생하며 서비스가 간헐적으로 중단됨:

```
Your project is about to deplete its Disk IO Budget,
and may become unresponsive once fully exhausted
```

실제 관측된 장애:
- API 요청에 504(Gateway Timeout), 522(Connection Timed Out) 응답 연쇄 발생
- `user_presence` POST가 가장 먼저 522 반환하며 장애 시작
- `auth/v1/user`, `rest/v1/*` 전체로 504 확산
- MCP(Management API) 연결도 타임아웃
- 관리자 대시보드 렌더링 16-17초 소요

### 1.2 Disk I/O Budget이란

Supabase(AWS EBS)는 인스턴스별 기준 IOPS와 처리량(MB/s)이 있으며, 이를 초과하면 "버스트 크레딧"을 소비합니다. 크레딧이 소진되면 기준 성능으로 제한되어 DB가 사실상 응답 불가 상태에 빠집니다.

---

## 2. 근본 원인 분석

### 2.1 진단 결과 요약

| 항목 | 값 | 판정 |
|------|-----|------|
| DB 크기 | 52MB | 정상 (데이터 양이 문제 아님) |
| 테이블 캐시 히트율 | 99.99% | 정상 |
| 인덱스 캐시 히트율 | 99.90% | 정상 |
| 연결 수 | 26 / 60 | 정상 |
| **Temp 파일 누적** | **69GB** | **심각** |
| **Realtime WAL CPU 점유** | **54.2%** | **심각** |
| **pg_cron 실행 빈도** | **매 1분** | **과다** |
| Dead rows (일부 테이블) | 300%+ | 비정상 |

### 2.2 원인별 상세

#### 원인 1: Temp 파일 69GB (가장 심각)

- `work_mem`이 17MB로 설정되어, 정렬/해시 조인 시 메모리 부족
- 초과분이 디스크 임시 파일로 기록됨 (11,703회, 총 69GB)
- DB 크기 52MB 대비 1,300배의 디스크 쓰기 발생

#### 원인 2: Realtime WAL 폴링 (CPU 54%)

- 5개 테이블이 `supabase_realtime` publication에 등록
  - `student_plan`, `calendar_events`, `make_scenario_logs`, `recommended_contents`, `student_content_progress`
- 모든 write가 WAL을 통해 Realtime으로 전달
- 639,367회 WAL 읽기, 총 5,327초 CPU 시간 소비

#### 원인 3: pg_cron scheduled_messages (매 1분)

- `* * * * *` 스케줄로 매 분 실행
- DB 다운 중에도 10초마다 재시도하며 "job startup timeout" 49회 연쇄 실패
- `cron.job_run_details` UPDATE가 평균 8,565ms (비정상)

#### 원인 4: user_presence 하트비트 (30초마다)

- 30초 간격으로 DB UPSERT
- 100명 기준 일 288,000 writes
- 장애 시작 시점에 가장 먼저 522 반환

#### 원인 5: 캘린더 RRULE 쿼리 (2년 스캔)

- 반복 이벤트 조회 시 2년 전까지 스캔 (730일)
- 4개 OR 조건의 복합 쿼리
- RRULE 전용 인덱스 부재

#### 원인 6: 대시보드 쿼리 폭발 (27개)

- 관리자 대시보드 1회 렌더에 약 27개 DB 쿼리
- 전체 행을 JS로 fetch한 뒤 메모리에서 집계하는 패턴
- `student_study_sessions`, `student_plan` 등 전체 행 fetch

#### 원인 7: Dead Rows 누적

- `user_presence` (311%), `storage.objects` (350%), `chat_attachments` (1300%)
- 일부 테이블은 autovacuum이 한 번도 실행되지 않음
- 임계값 미달로 autovacuum 트리거 안됨

---

## 3. 해결 조치

### 3.1 DB 직접 적용 (즉시 효과)

#### 3.1.1 work_mem 증가

```sql
-- Before: 17MB → After: 32MB
-- CLI로 적용:
-- npx supabase postgres-config update --project-ref oabpkkihlfmfslqxaugh --config 'work_mem=32MB' --experimental
```

효과: temp 파일 생성 대폭 감소, Disk I/O 절약

#### 3.1.2 Realtime 발행 테이블 축소 (5개 → 2개)

```sql
ALTER PUBLICATION supabase_realtime DROP TABLE public.make_scenario_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.recommended_contents;
ALTER PUBLICATION supabase_realtime DROP TABLE public.student_content_progress;
```

남은 테이블: `student_plan`, `calendar_events` (실시간 필수)

효과: WAL 폴링 약 60% 감소

#### 3.1.3 pg_cron 스케줄 변경

```sql
-- scheduled_messages 체크: 매 1분 → 매 5분
SELECT cron.alter_job(1, schedule := '*/5 * * * *');
```

효과: cron 호출 80% 감소 (1,440 → 288회/일)

#### 3.1.4 인덱스 추가

```sql
-- user_presence: 하트비트 정리 쿼리 최적화
CREATE INDEX idx_user_presence_updated_at ON public.user_presence (updated_at DESC);

-- calendar_events: RRULE 반복 이벤트 전용 부분 인덱스
CREATE INDEX idx_cal_events_rrule_time
  ON public.calendar_events (calendar_id, start_at)
  WHERE rrule IS NOT NULL AND is_all_day = false AND deleted_at IS NULL;

CREATE INDEX idx_cal_events_rrule_date
  ON public.calendar_events (calendar_id, start_date)
  WHERE rrule IS NOT NULL AND is_all_day = true AND deleted_at IS NULL;
```

#### 3.1.5 VACUUM FULL (8개 테이블)

```
public.user_presence, public.chat_attachments, public.chat_room_members,
public.calendar_list, storage.objects, auth.flow_state, auth.sessions, auth.users
```

효과: dead rows 제거, 디스크 공간 반환

#### 3.1.6 Dashboard RPC 함수 생성

```sql
CREATE OR REPLACE FUNCTION public.get_dashboard_statistics(
  p_week_start DATE,
  p_week_end DATE
) RETURNS JSON ...
```

27개 개별 쿼리를 1개 SQL 함수로 통합. DB 내에서 `COUNT(DISTINCT)`, `GROUP BY`, `LIMIT`으로 집계.

#### 3.1.7 cron.job_run_details 정리 및 통계 리셋

```sql
DELETE FROM cron.job_run_details WHERE start_time < now() - interval '24 hours';
SELECT pg_stat_statements_reset();
```

### 3.2 코드 변경 (Git 커밋 + Vercel 배포)

#### 커밋 1: `221b8499` — 기존 미작업 정리

| 파일 | 변경 |
|------|------|
| `app/(admin)/layout.tsx` | `revalidate: 300` → `force-dynamic` |
| `app/(parent)/layout.tsx` | `revalidate: 300` → `force-dynamic` |
| `app/(student)/layout.tsx` | `revalidate: 300` → `force-dynamic` |
| `app/(admin)/admin/subjects/page.tsx` | N+1 쿼리 제거 (배치 조회) |
| `lib/cache/calendarCache.ts` | 캘린더 ID 캐시 레이어 추가 |
| 외 6개 파일 | force-dynamic, 쿼리 최적화 |

#### 커밋 2: `aebb35ce` — Disk I/O 최적화

| 파일 | 변경 | 효과 |
|------|------|------|
| `lib/realtime/useAppPresence.ts` | 하트비트 30s → 120s | writes 75% 감소 |
| `lib/query-options/calendarEvents.ts` | RRULE cutoff 2년 → 6개월 | 스캔 범위 75% 감소 |
| `vercel.json` | 자정 cron 3개 동시 → 5분 간격 분산 | I/O 스파이크 완화 |
| `app/(admin)/admin/dashboard/page.tsx` | 27개 쿼리 → 1 RPC + 3 쿼리 | 렌더 16s → 3-5s |
| `supabase/migrations/20260323100000_*` | 전체 마이그레이션 기록 | 재현 가능 |

---

## 4. 효과 측정

### 4.1 예상 개선 효과

| 지표 | Before | After | 개선율 |
|------|--------|-------|--------|
| Temp 파일 생성 | 69GB 누적 | work_mem 32MB로 억제 | - |
| CPU (Realtime WAL) | 54% 점유 | ~22% | **59%** |
| Dashboard 렌더 | 16-17초 | 3-5초 | **70-80%** |
| Presence writes/일 | ~288,000 | ~72,000 | **75%** |
| Cron 호출/일 | 1,440 | 288 | **80%** |
| 캘린더 스캔 범위 | 730일 | 180일 | **75%** |
| DB 쿼리/대시보드 | ~27개 | 4개 | **85%** |

### 4.2 모니터링 방법

1. **Supabase Dashboard** → Infrastructure → Disk IO Budget 그래프 확인
2. **pg_stat_statements** 재조회 (1-2시간 후):

```sql
SELECT round(total_exec_time::numeric, 0) AS total_ms,
       calls, round((total_exec_time/calls)::numeric, 1) AS avg_ms,
       left(query, 100) AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 15;
```

3. **Temp 파일 모니터링**:

```sql
SELECT temp_files, pg_size_pretty(temp_bytes) AS temp_bytes
FROM pg_stat_database WHERE datname = current_database();
```

---

## 5. 향후 권장 사항

### 5.1 단기 (1-2주) — 모니터링 및 검증

#### 5.1.1 Disk IO Budget 회복 모니터링

- [ ] Supabase Dashboard → Observability → Database Health에서 `Disk IO % consumed` 확인
- [ ] 이 값이 1% 이상이면 워크로드가 baseline IO를 초과하고 있다는 의미
- [ ] 100%에 도달하면 버스트 크레딧이 완전 소진된 상태

> **참고**: Supabase 공식 문서에 따르면, Micro/Small 같은 작은 인스턴스는 baseline 성능이 제한적이며, 하루 한 번 버스트 크레딧이 소진될 수 있습니다. 4XL 이상에서만 안정적인 디스크 성능이 보장됩니다.
>
> 참조: https://supabase.com/docs/guides/platform/compute-and-disk#choosing-the-right-compute-instance-for-consistent-disk-performance

#### 5.1.2 pg_stat_statements 재분석

통계를 리셋했으므로 1-2시간 후 아래 쿼리로 최적화 효과를 정량 검증합니다:

```sql
-- 가장 시간 소모가 큰 쿼리 Top 15
SELECT
  auth.rolname,
  statements.query,
  statements.calls,
  statements.total_exec_time + statements.total_plan_time AS total_time,
  statements.mean_exec_time + statements.mean_plan_time AS mean_time,
  to_char(
    ((statements.total_exec_time + statements.total_plan_time) /
     sum(statements.total_exec_time + statements.total_plan_time) OVER ()) * 100,
    'FM90D0'
  ) || '%' AS pct_total
FROM pg_stat_statements AS statements
  INNER JOIN pg_authid AS auth ON statements.userid = auth.oid
ORDER BY total_time DESC
LIMIT 15;
```

> 참조: https://supabase.com/docs/guides/database/extensions/pg_stat_statements

#### 5.1.3 Temp 파일 모니터링

`work_mem` 32MB 적용 후 temp 파일 생성이 감소했는지 확인:

```sql
SELECT temp_files, pg_size_pretty(temp_bytes) AS temp_bytes
FROM pg_stat_database WHERE datname = current_database();
```

#### 5.1.4 cron.job_run_details 자동 정리

현재 수동으로 정리했지만, 매일 자동 정리하는 cron을 등록하는 것을 권장합니다:

```sql
SELECT cron.schedule(
  'cleanup-cron-history',
  '0 3 * * *',  -- 매일 새벽 3시 (UTC)
  'DELETE FROM cron.job_run_details WHERE start_time < now() - interval ''7 days'''
);
```

### 5.2 중기 (1개월) — 아키텍처 개선

#### 5.2.1 Realtime 아키텍처 최적화

현재 Realtime은 Postgres Changes(WAL 기반)를 사용하고 있으며, CPU의 54%를 소비하는 최대 원인입니다.

**권장 전략: Broadcast로 전환**

Supabase Realtime은 3가지 모드를 제공합니다:

| 모드 | 동작 | DB 부하 |
|------|------|---------|
| **Postgres Changes** | WAL 폴링으로 DB 변경 감지 | **높음** (모든 write가 WAL 처리) |
| **Broadcast** | 서버 간 메시지 직접 전송 | **없음** (DB 우회) |
| **Presence** | 클라이언트 상태 동기화 | **없음** (DB 우회) |

`student_plan`과 `calendar_events`의 실시간 업데이트를 Broadcast 방식으로 전환하면 WAL 폴링을 완전히 제거할 수 있습니다:

```typescript
// Before: DB 변경을 WAL로 감지 (Postgres Changes)
supabase.channel('plan-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'student_plan' }, handler)
  .subscribe();

// After: Server Action에서 직접 Broadcast (DB 부하 제로)
// 1. Server Action에서 DB 업데이트 후 broadcast
await supabase.channel('plan-changes').send({
  type: 'broadcast',
  event: 'plan-updated',
  payload: { studentId, planDate }
});

// 2. 클라이언트에서 broadcast 수신
supabase.channel('plan-changes')
  .on('broadcast', { event: 'plan-updated' }, handler)
  .subscribe();
```

> 참조: https://supabase.com/docs/guides/realtime/broadcast
>
> Supabase Realtime 벤치마크에 따르면 Broadcast는 2노드 클러스터에서 700K 메시지/분 처리 가능.
> 참조: https://supabase.com/docs/guides/realtime/benchmarks

#### 5.2.2 대시보드 at-risk 쿼리 RPC 통합

현재 `getBatchAtRiskStudents()`는 약 9개의 배치 쿼리를 실행합니다. 이것도 단일 RPC 함수로 통합하면 대시보드 쿼리가 총 2개(통계 RPC + at-risk RPC)로 줄어듭니다.

#### 5.2.3 Unindexed Foreign Keys 순차 해소

Supabase Performance Advisor에서 다수의 `unindexed foreign keys` 경고가 발생 중입니다. FK에 인덱스가 없으면 `DELETE`/`UPDATE` 시 전체 테이블 스캔이 발생할 수 있습니다.

```sql
-- 누락된 FK 인덱스 확인
SELECT
  c.conrelid::regclass AS table_name,
  c.conname AS fk_name,
  a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND a.attnum = ANY(i.indkey)
  )
ORDER BY table_name;
```

#### 5.2.4 Autovacuum 튜닝

일부 테이블(`user_presence`, `chat_room_members`)은 dead row 비율이 높지만 autovacuum이 트리거되지 않았습니다. 고빈도 write 테이블에 대해 개별 autovacuum 설정을 조정합니다:

```sql
-- user_presence: 50개 dead row마다 vacuum 실행 (기본값은 50 + 20% * live rows)
ALTER TABLE public.user_presence SET (
  autovacuum_vacuum_threshold = 50,
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_threshold = 50,
  autovacuum_analyze_scale_factor = 0.05
);
```

> 참조: https://supabase.com/docs/guides/platform/database-size#vacuum-operations
>
> 대규모 테이블(30만 행 이상)에서 VACUUM FULL은 테이블 잠금을 유발하므로, `pg_repack` 확장을 대안으로 사용할 수 있습니다.
> 참조: https://supabase.com/docs/guides/database/extensions/pg_repack

### 5.3 장기 — 인프라 확장

#### 5.3.1 컴퓨트 업그레이드 기준

현재 프로젝트는 Micro 인스턴스(2-core ARM shared, 1GB RAM, 500 IOPS)입니다.

| 인스턴스 | 월 비용 | CPU | 메모리 | IOPS | 대상 시나리오 |
|---------|---------|-----|--------|------|-------------|
| **Micro** (현재) | ~$10 | 2-core shared | 1 GB | 500 | 개발/소규모 |
| **Small** | ~$15 | 2-core shared | 2 GB | 1,000 | 소규모 프로덕션 |
| **Medium** | ~$60 | 2-core shared | 4 GB | 2,000 | 중규모 프로덕션 |
| **Large** | ~$110 | 2-core dedicated | 8 GB | 3,600 | 안정적 성능 필요 시 |

**업그레이드 판단 기준**:

- `Disk IO % consumed`가 지속적으로 1% 이상 → Small 이상 검토
- 캐시 히트율 99% 미만 → 메모리 부족, 업그레이드 필요
- 대시보드 Observability에서 CPU 80% 이상 지속 → 업그레이드 필요
- 다운타임: 보통 2분 미만, 클라우드 환경에 따라 차이

> 참조: https://supabase.com/docs/guides/platform/compute-and-disk

#### 5.3.2 Read Replica 도입

사용자가 증가하여 읽기 부하가 높아지면 Read Replica를 통해 부하를 분산할 수 있습니다.

**적용 시나리오**:

- 대시보드 통계 쿼리 → Read Replica로 라우팅 (Primary 부하 감소)
- 리포트/분석 쿼리 → Read Replica에서 실행
- 지역별 사용자 → 가까운 리전의 Replica로 지오 라우팅

**요구사항**:

- Small 컴퓨트 이상 필수
- Pro/Team/Enterprise 플랜
- PITR(Point in Time Recovery) 활성화 필요
- Replica당 Primary와 동일한 컴퓨트 비용 추가

**API 로드 밸런서**: Read Replica 배포 시 자동으로 로드 밸런서가 생성되어 GET 요청은 가장 가까운 DB로 자동 라우팅됩니다. Non-GET 요청은 Primary로 전달됩니다.

```typescript
// Supabase JS에서 Read Replica 사용 (RPC의 경우)
const { data } = await supabase.rpc('get_dashboard_statistics', {
  p_week_start: weekStart,
  p_week_end: weekEnd,
}, { get: true }); // get: true로 Read Replica 라우팅
```

> 참조: https://supabase.com/docs/guides/platform/read-replicas

#### 5.3.3 Connection Pooling 최적화

현재 26/60 연결을 사용 중이며 여유가 있지만, 사용자 증가 시 대비가 필요합니다.

**Supabase 연결 방식 비교**:

| 방식 | 포트 | 용도 | IPv4 지원 |
|------|------|------|----------|
| Direct Connection | 5432 | 장시간 서버 (VM, 컨테이너) | IPv6만 |
| Supavisor Session | 5432 | Direct 대안 (IPv4 필요 시) | O |
| Supavisor Transaction | 6543 | 서버리스/Edge 함수 | O |
| Dedicated PgBouncer | 6543 | 고성능, DB와 같은 머신 | IPv6만 |

**Next.js + Vercel 환경 권장 구성**:

- Server Components/Actions: Supavisor Transaction Mode (6543)
- Edge Functions: Supavisor Transaction Mode + `connection_limit=1`
- 마이그레이션/관리: Supavisor Session Mode (5432)

> 참조: https://supabase.com/docs/guides/database/connecting-to-postgres

#### 5.3.4 Prometheus/Grafana 모니터링 구축

Supabase는 프로젝트별 Prometheus 메트릭 엔드포인트를 제공합니다. Grafana 대시보드를 구축하면 CPU, 메모리, Disk IO, 캐시 히트율, 연결 수 등을 실시간으로 모니터링하고 알림을 설정할 수 있습니다.

```bash
# 메트릭 엔드포인트 (Pro 플랜 이상)
curl https://oabpkkihlfmfslqxaugh.supabase.co/customer/v1/privileged/metrics
```

> 참조: https://supabase.com/docs/guides/platform/metrics

#### 5.3.5 Supabase CLI inspect 정기 실행

Supabase CLI의 `inspect db` 명령으로 주기적인 DB 건강 검진을 수행합니다:

```bash
npx supabase inspect db bloat --linked       # 테이블 팽창 확인
npx supabase inspect db cache-hit --linked   # 캐시 히트율 확인
npx supabase inspect db unused-indexes --linked  # 미사용 인덱스
npx supabase inspect db outliers --linked    # 느린 쿼리 아웃라이어
npx supabase inspect db seq-scans --linked   # 순차 스캔 (인덱스 누락 후보)
npx supabase inspect db vacuum-stats --linked  # Vacuum 상태
```

> 참조: https://supabase.com/docs/guides/database/inspect

---

## 6. 파일 참조

| 구분 | 경로 |
|------|------|
| 마이그레이션 | `supabase/migrations/20260323100000_add_disk_io_optimization_indexes.sql` |
| Presence | `lib/realtime/useAppPresence.ts` |
| Calendar | `lib/query-options/calendarEvents.ts` |
| Dashboard | `app/(admin)/admin/dashboard/page.tsx` |
| Dashboard Cache | `lib/cache/dashboard.ts` |
| Cron 설정 | `vercel.json` |
| 이 문서 | `docs/architecture/disk-io-optimization-report-2026-03-13.md` |
