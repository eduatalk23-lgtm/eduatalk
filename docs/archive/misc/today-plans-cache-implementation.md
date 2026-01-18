# todayPlans 캐싱 구현 가이드

**작성 일자**: 2025-12-XX  
**목적**: todayPlans 결과를 Postgres에 캐싱하여 반복 호출 시 성능 개선

---

## 1. 개요

### 1.1 목적

`getTodayPlans()` 함수의 결과를 Postgres에 캐싱하여, 같은 학생/날짜/캠프 모드에 대한 반복 호출 시 성능을 개선합니다.

### 1.2 성능 개선 효과

- **첫 호출**: 기존과 동일 (2.5초 내외)
- **두 번째 호출부터**: 캐시 히트 시 **10-50ms** 수준으로 단축
- **예상 개선율**: **98% 이상** (2.5초 → 50ms)

---

## 2. 캐시 테이블 구조

### 2.1 테이블 스키마

**테이블명**: `today_plans_cache`

```sql
CREATE TABLE today_plans_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,                    -- NULL 가능
  student_id uuid NOT NULL,
  plan_date date NOT NULL,            -- 'YYYY-MM-DD' 형식
  is_camp_mode boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,             -- getTodayPlans() 결과 전체
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,    -- 캐시 만료 시각
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 2.2 캐시 키

캐시 키는 다음 조합으로 구성됩니다:
- `tenant_id` (nullable)
- `student_id`
- `plan_date` (date)
- `is_camp_mode` (boolean)

**특징**:
- `tenant_id`가 NULL인 경우도 별도의 캐시 키로 처리
- 같은 학생이라도 일반 모드와 캠프 모드는 별도 캐시

### 2.3 인덱스

1. **Unique Index**: 캐시 키 중복 방지
   ```sql
   CREATE UNIQUE INDEX idx_today_plans_cache_unique_key
   ON today_plans_cache (
     COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
     student_id,
     plan_date,
     is_camp_mode
   );
   ```

2. **Lookup Index**: 캐시 조회 최적화
   ```sql
   CREATE INDEX idx_today_plans_cache_lookup
   ON today_plans_cache (
     COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
     student_id,
     plan_date,
     is_camp_mode,
     expires_at
   )
   WHERE expires_at > now();
   ```

3. **Cleanup Index**: 만료된 캐시 정리
   ```sql
   CREATE INDEX idx_today_plans_cache_expires_at
   ON today_plans_cache (expires_at)
   WHERE expires_at < now();
   ```

---

## 3. 캐싱 로직

### 3.1 캐시 조회 (Cache Lookup)

**위치**: `getTodayPlans()` 함수 최상단

**로직**:
1. `useCache !== false`인 경우에만 실행
2. Supabase에서 캐시 조회:
   ```typescript
   const { data: cacheRows } = await supabase
     .from("today_plans_cache")
     .select("payload, expires_at")
     .eq("student_id", studentId)
     .eq("plan_date", targetDate)
     .eq("is_camp_mode", !!camp)
     .gt("expires_at", new Date().toISOString()) // 유효한 캐시만
     .maybeSingle();
   ```
3. 캐시 히트 시: `cacheRows.payload` 반환
4. 캐시 미스 시: 기존 로직 실행

**로그**:
- `[todayPlans] cache hit` - 캐시 히트
- `[todayPlans] cache miss` - 캐시 미스

### 3.2 캐시 저장 (Cache Store)

**위치**: `getTodayPlans()` 함수 결과 생성 후

**로직**:
1. `useCache !== false`이고 결과가 유효한 경우에만 실행
2. TTL 계산: `expires_at = now() + cacheTtlSeconds`
3. 캐시 저장:
   ```typescript
   await supabase
     .from("today_plans_cache")
     .insert({
       tenant_id: tenantId ?? null,
       student_id: studentId,
       plan_date: targetDate,
       is_camp_mode: !!camp,
       payload: result,
       computed_at: now.toISOString(),
       expires_at: expiresAt.toISOString(),
     });
   ```
4. 에러 발생 시: 결과는 그대로 반환 (캐시 실패는 무시)

**로그**:
- `[todayPlans] cache stored` - 캐시 저장 성공

### 3.3 TTL (Time-To-Live)

**기본값**: 120초 (2분)

**설정 가능**:
- `cacheTtlSeconds` 옵션으로 커스터마이징 가능
- 캠프 모드: 60초 (1분, 더 짧은 TTL)
- 일반 모드: 120초 (2분, 기본값)

**만료 조건**:
- `expires_at < now()`인 캐시는 자동으로 무시됨
- 조회 시 `WHERE expires_at > now()` 조건으로 필터링

---

## 4. 사용 방법

### 4.1 기본 사용 (캐시 활성화)

```typescript
const data = await getTodayPlans({
  studentId: userId,
  tenantId: tenantContext?.tenantId || null,
  date: targetDate,
  camp: false,
  useCache: true,        // 기본값: true
  cacheTtlSeconds: 120, // 기본값: 120초
});
```

### 4.2 캐시 비활성화

```typescript
const data = await getTodayPlans({
  studentId: userId,
  tenantId: tenantContext?.tenantId || null,
  date: targetDate,
  camp: false,
  useCache: false, // 캐시 사용 안 함
});
```

### 4.3 API 엔드포인트에서 사용

**기본 (캐시 사용)**:
```
GET /api/today/plans?date=2025-12-10
```

**캐시 비활성화**:
```
GET /api/today/plans?date=2025-12-10&noCache=true
```

**TTL 커스터마이징**:
```
GET /api/today/plans?date=2025-12-10&cacheTtl=60
```

### 4.4 서버 컴포넌트에서 사용

**캠프 모드** (`/camp/today`):
```typescript
const todayPlansData = await getTodayPlans({
  studentId: userId,
  tenantId: tenantContext?.tenantId || null,
  date: requestedDate,
  camp: true,
  useCache: true,
  cacheTtlSeconds: 60, // 1분 TTL
});
```

**일반 모드** (`/today`):
```typescript
// calculateTodayProgress 사용 (별도 캐싱 고려 필요)
```

---

## 5. 캐시 청소 전략

### 5.1 자동 만료

캐시는 TTL 기반으로 자동 만료됩니다:
- 조회 시: `expires_at > now()` 조건으로 필터링
- 만료된 캐시는 자동으로 무시됨

### 5.2 수동 청소

캐시 테이블이 너무 커졌을 때를 대비한 청소 쿼리:

```sql
-- 만료된 캐시 삭제 (1일 이상 지난 만료 캐시)
DELETE FROM today_plans_cache
WHERE expires_at < now() - interval '1 day';
```

### 5.3 주기적 청소 (권장)

**수동 실행 쿼리**:
```sql
-- 만료된 캐시 삭제 (1일 이상 지난 만료 캐시)
DELETE FROM today_plans_cache
WHERE expires_at < now() - interval '1 day';
```

**Cron 작업 예시** (Supabase Edge Function 또는 외부 cron):
```typescript
// supabase/functions/cleanup-cache/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Delete expired cache entries (older than 1 day)
  const { data, error } = await supabase
    .from("today_plans_cache")
    .delete()
    .lt("expires_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return new Response(JSON.stringify({ success: !error, deleted: data?.length || 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Supabase Cron 설정** (Supabase Dashboard):
- Function: `cleanup-cache`
- Schedule: `0 0 * * *` (매일 자정)

**Supabase Edge Function 예시**:
```typescript
// supabase/functions/cleanup-cache/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data, error } = await supabase.rpc("cleanup_expired_cache", {
    days_old: 1,
  });

  return new Response(JSON.stringify({ success: !error, data }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### 5.4 캐시 통계 확인

```sql
-- 캐시 테이블 크기 확인
SELECT 
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE expires_at > now()) as active_entries,
  COUNT(*) FILTER (WHERE expires_at < now()) as expired_entries,
  pg_size_pretty(pg_total_relation_size('today_plans_cache')) as table_size
FROM today_plans_cache;
```

---

## 6. 성능 모니터링

### 6.1 로그 확인

**캐시 히트**:
```
[todayPlans] cache hit - student: xxx, date: 2025-12-10, camp: false
[todayPlans] cache - lookup: 15.234ms
```

**캐시 미스**:
```
[todayPlans] cache miss - student: xxx, date: 2025-12-10, camp: false
[todayPlans] cache - lookup: 12.456ms
[todayPlans] db - planGroups: 209.46ms
[todayPlans] db - plans: 256.874ms
...
[todayPlans] cache stored - student: xxx, date: 2025-12-10, camp: false, expires: 2025-12-10T12:02:00.000Z
[todayPlans] cache - store: 8.123ms
```

### 6.2 성능 비교

**첫 호출 (캐시 미스)**:
- 총 시간: ~2.5초
- DB 쿼리: ~2.0초
- 메모리 연산: ~0.5초

**두 번째 호출 (캐시 히트)**:
- 총 시간: ~10-50ms
- 캐시 조회: ~10-30ms
- DB 쿼리: 없음

**개선율**: **98% 이상**

---

## 7. 주의사항

### 7.1 캐시 무효화

캐시는 TTL 기반으로 자동 만료되지만, 다음 경우에는 수동 무효화가 필요할 수 있습니다:

1. **플랜 변경 시**: 플랜이 생성/수정/삭제되면 해당 날짜의 캐시를 무효화
2. **세션 변경 시**: 세션이 시작/종료되면 해당 날짜의 캐시를 무효화
3. **진행률 변경 시**: 진행률이 업데이트되면 해당 날짜의 캐시를 무효화

**무효화 예시**:
```typescript
// 플랜 변경 후 캐시 무효화
await supabase
  .from("today_plans_cache")
  .delete()
  .eq("student_id", studentId)
  .eq("plan_date", planDate)
  .eq("is_camp_mode", isCampMode);
```

### 7.2 캐시 일관성

- 캐시는 **최종 일관성(Eventually Consistent)** 모델 사용
- TTL이 짧아서(1-2분) 최신 데이터 반영 지연은 최소화됨
- 실시간성이 중요한 경우 `useCache: false` 사용

### 7.3 메모리 사용량

- `payload`는 JSONB로 저장되므로 효율적
- 캐시 테이블 크기 모니터링 필요
- 주기적 청소로 크기 관리

---

## 8. 트러블슈팅

### 8.1 캐시가 작동하지 않는 경우

1. **마이그레이션 확인**:
   ```bash
   supabase migration list
   ```

2. **테이블 존재 확인**:
   ```sql
   SELECT * FROM today_plans_cache LIMIT 1;
   ```

3. **RLS 정책 확인**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'today_plans_cache';
   ```

### 8.2 캐시 히트율이 낮은 경우

1. **TTL 확인**: 너무 짧으면 자주 만료됨
2. **캐시 키 확인**: student_id, date, camp 모드가 일치하는지
3. **만료된 캐시 확인**: `expires_at < now()`인 캐시가 많은지

### 8.3 성능이 개선되지 않는 경우

1. **캐시 조회 시간 확인**: `[todayPlans] cache - lookup` 로그
2. **인덱스 사용 확인**: EXPLAIN ANALYZE로 인덱스 사용 여부 확인
3. **네트워크 지연**: Supabase 연결 지연 가능성

---

## 9. 참고 자료

- `lib/data/todayPlans.ts`: 캐싱 로직 구현
- `supabase/migrations/20251211000000_create_today_plans_cache.sql`: 캐시 테이블 마이그레이션
- `app/api/today/plans/route.ts`: API 엔드포인트에서 캐시 사용
- `app/(student)/camp/today/page.tsx`: 서버 컴포넌트에서 캐시 사용

---

**작성자**: AI Assistant  
**검토 필요**: 백엔드 팀, DBA

