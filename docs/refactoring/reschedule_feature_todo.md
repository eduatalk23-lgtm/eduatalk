# 플랜 그룹 재조정 기능 구현 TODO

## 📋 문서 정보

- **작성일**: 2025-12-09
- **버전**: 1.0
- **관련 문서**:
  - `docs/refactoring/plan_flow_documentation.md`
  - `docs/refactoring/03_phase_todo_list.md`

---

## 📊 Phase 요약

| Phase   | 목표                       | 예상 기간 | 위험도  | 주요 산출물                          |
| ------- | -------------------------- | --------- | ------- | ------------------------------------ |
| Phase 1 | 안전한 최소 기능 고도화    | 3-4일     | 🟡 중간 | 상태 도메인, FK 연결, 인덱스, 기본 UI |
| Phase 2 | 데이터 모델 및 롤백 정교화 | 4-5일     | 🔴 높음 | 버전 체계, 롤백 정책, ENUM, RLS       |
| Phase 3 | 성능·운영 고도화           | 5-7일     | 🔴 높음 | 비동기 처리, 캐시, 모니터링           |

---

## 🟢 Phase 1: 안전한 최소 기능 고도화

**목표**: 기존 구조를 최소한으로 변경하면서 재조정 기능의 안전한 기반 마련

**예상 기간**: 3-4일

**의존성**: 기존 Phase 1-3 완료

---

### 1.1 플랜 상태 도메인 명확화

#### [R1-1] student_plan 상태 컬럼 추가/정리 ✅

- **파일**: `supabase/migrations/20251209211447_add_student_plan_status.sql` ✅
- **작업**:
  ```sql
  -- 상태 컬럼 추가 (기존 데이터 마이그레이션 포함)
  ALTER TABLE student_plan
    ADD COLUMN IF NOT EXISTS status TEXT
      CHECK (status IN ('pending', 'in_progress', 'completed', 'canceled'))
      DEFAULT 'pending';
  
  -- 기존 데이터 마이그레이션
  UPDATE student_plan
  SET status = CASE
    WHEN actual_end_time IS NOT NULL THEN 'completed'
    WHEN actual_start_time IS NOT NULL THEN 'in_progress'
    ELSE 'pending'
  END
  WHERE status IS NULL;
  ```
- **위험도**: 🔴 높음 (기존 데이터 영향)
- **테스트**:
  - [ ] 기존 플랜 상태가 올바르게 마이그레이션되는지 확인
  - [ ] 새 플랜 생성 시 기본 상태 'pending' 확인

#### [R1-2] 상태 관련 헬퍼 함수 추가 ✅

- **파일**: `lib/utils/planStatusUtils.ts` (신규) ✅
- **작업**:
  ```typescript
  // 상태 정의
  export type PlanStatus = 'pending' | 'in_progress' | 'completed' | 'canceled';
  
  // 재조정 대상 여부 판단
  export function isReschedulable(plan: { status: PlanStatus; is_active?: boolean }): boolean;
  
  // 완료 플랜 여부 (재조정 제외 대상)
  export function isCompletedPlan(plan: { status: PlanStatus }): boolean;
  
  // 롤백 가능 여부 (새 플랜이 아직 시작 안 됨)
  export function isRollbackable(plan: { status: PlanStatus }): boolean;
  ```
- **위험도**: 🟢 낮음 (신규 파일)
- **테스트**:
  - [ ] 각 상태별 헬퍼 함수 동작 확인

#### [R1-3] 요구사항 문서에 상태 정의 명시 ✅

- **파일**: `docs/refactoring/reschedule_status_policy.md` (신규) ✅
- **작업**:
  - 완료 플랜 정의: `status = 'completed'`
  - 재조정 대상: `status IN ('pending', 'in_progress') AND is_active = true`
  - 롤백 가능 조건: 새 플랜 중 `status = 'pending'`인 것만
- **위험도**: 🟢 낮음 (문서만)

---

### 1.2 히스토리·로그 구조 연결

#### [R1-4] plan_history 테이블 생성 ✅

- **파일**: `supabase/migrations/20251209211500_create_plan_history_and_reschedule_log.sql` ✅
- **작업**:
  ```sql
  CREATE TABLE IF NOT EXISTS plan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES student_plan(id) ON DELETE CASCADE,
    plan_group_id UUID NOT NULL REFERENCES plan_groups(id) ON DELETE CASCADE,
    plan_data JSONB NOT NULL,  -- 플랜 전체 스냅샷
    content_id UUID,  -- 관련 콘텐츠 (optional)
    adjustment_type TEXT CHECK (adjustment_type IN ('range', 'replace', 'full')),
    reschedule_log_id UUID,  -- FK는 R1-5 이후 추가
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
  );
  
  -- 인덱스
  CREATE INDEX idx_plan_history_plan_id ON plan_history(plan_id);
  CREATE INDEX idx_plan_history_plan_group_id ON plan_history(plan_group_id);
  CREATE INDEX idx_plan_history_reschedule_log_id ON plan_history(reschedule_log_id);
  ```
- **위험도**: 🟢 낮음 (신규 테이블)

#### [R1-5] reschedule_log 테이블 생성 ✅

- **파일**: `supabase/migrations/20251209211500_create_plan_history_and_reschedule_log.sql` ✅
- **작업**:
  ```sql
  CREATE TABLE IF NOT EXISTS reschedule_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_group_id UUID NOT NULL REFERENCES plan_groups(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    adjusted_contents JSONB NOT NULL,  -- 콘텐츠 단위 변경 요약
    plans_before_count INTEGER NOT NULL DEFAULT 0,
    plans_after_count INTEGER NOT NULL DEFAULT 0,
    reason TEXT,  -- 재조정 사유
    status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'rolled_back')) DEFAULT 'pending',
    rolled_back_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
  );
  
  -- 인덱스
  CREATE INDEX idx_reschedule_log_plan_group_id ON reschedule_log(plan_group_id);
  CREATE INDEX idx_reschedule_log_student_id ON reschedule_log(student_id);
  CREATE INDEX idx_reschedule_log_created_at ON reschedule_log(created_at DESC);
  ```
- **위험도**: 🟢 낮음 (신규 테이블)

#### [R1-6] plan_history ↔ reschedule_log FK 연결 ✅

- **파일**: `supabase/migrations/20251209211500_create_plan_history_and_reschedule_log.sql` ✅
- **작업**:
  ```sql
  ALTER TABLE plan_history
    ADD CONSTRAINT fk_plan_history_reschedule_log
    FOREIGN KEY (reschedule_log_id) REFERENCES reschedule_log(id) ON DELETE SET NULL;
  ```
- **위험도**: 🟢 낮음 (FK 추가만)
- **테스트**:
  - [ ] plan_history에서 reschedule_log_id로 역추적 가능 확인

---

### 1.3 기본 트랜잭션·락 구조 구현

#### [R1-7] 플랜 그룹 단위 Advisory Lock 유틸 ✅

- **파일**: `lib/utils/planGroupLock.ts` (신규) ✅
- **작업**:
  ```typescript
  // Advisory Lock 획득 (트랜잭션 내에서만 유효)
  export async function acquirePlanGroupLock(
    supabase: SupabaseClient,
    groupId: string
  ): Promise<boolean>;
  
  // Lock 키 생성
  export function getPlanGroupLockKey(groupId: string): number;
  ```
- **위험도**: 🟡 중간 (동시성 제어)
- **테스트**:
  - [ ] 동일 그룹에 대한 동시 재조정 요청 시 하나만 처리되는지 확인

#### [R1-8] 재조정 트랜잭션 래퍼 함수 ✅

- **파일**: `lib/reschedule/transaction.ts` (신규) ✅
- **작업**:
  ```typescript
  export async function executeRescheduleTransaction<T>(
    groupId: string,
    operation: (supabase: SupabaseClient) => Promise<T>
  ): Promise<T>;
  ```
- **위험도**: 🟡 중간
- **테스트**:
  - [ ] 트랜잭션 롤백 시 모든 변경 취소 확인

---

### 1.4 스케줄 엔진 추출

#### [R1-9] 순수 함수 형태 스케줄 엔진 추출 ✅

- **파일**: `lib/reschedule/scheduleEngine.ts` (신규) ✅
- **작업**:
  ```typescript
  // DB I/O 없이 순수 계산
  export function generatePlans(
    group: PlanGroup,
    contents: PlanContent[],
    adjustments: AdjustmentInput[]
  ): GeneratedPlanResult;
  
  // 타입 정의
  export interface AdjustmentInput {
    plan_content_id: string;
    change_type: 'range' | 'replace';
    before: ContentSnapshot;
    after: ContentSnapshot;
  }
  
  export interface GeneratedPlanResult {
    plans: PlanData[];
    summary: {
      total_plans: number;
      affected_dates: string[];
      estimated_hours: number;
    };
  }
  ```
- **위험도**: 🟡 중간 (기존 로직 추출)
- **테스트**:
  - [ ] 동일 입력에 대해 항상 동일 결과 반환 확인

#### [R1-10] 미리보기/실행 로직 통합 ✅

- **파일**: `app/(student)/actions/plan-groups/reschedule.ts` (신규) ✅
- **작업**:
  ```typescript
  // 미리보기 (DB 미적용)
  export async function getReschedulePreview(
    groupId: string,
    adjustments: AdjustmentInput[]
  ): Promise<ReschedulePreviewResult>;
  
  // 실제 재조정 실행
  export async function rescheduleContents(
    groupId: string,
    adjustments: AdjustmentInput[]
  ): Promise<RescheduleResult>;
  ```
- **위험도**: 🟡 중간
- **테스트**:
  - [ ] 미리보기 결과와 실제 결과 일치 확인

---

### 1.5 기본 UI 구현 (Wizard 형태)

#### [R1-11] 재조정 페이지 라우트 생성

- **파일**: `app/(student)/plan/group/[id]/reschedule/page.tsx` (신규)
- **작업**:
  - 3단계 Wizard 구조 구현
  - Step 1: 콘텐츠 선택
  - Step 2: 상세 조정
  - Step 3: 미리보기 & 확인
- **위험도**: 🟡 중간 (신규 UI)

#### [R1-12] Step 1 - 콘텐츠 선택 컴포넌트

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/ContentSelectStep.tsx` (신규)
- **작업**:
  - 재조정 대상 콘텐츠 체크박스 목록
  - 상태 배지 (완료/진행/불가) 표시
  - 완료된 콘텐츠는 선택 불가 처리
- **위험도**: 🟢 낮음

#### [R1-13] Step 2 - 상세 조정 컴포넌트

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/AdjustmentStep.tsx` (신규)
- **작업**:
  - 범위 수정 폼 (시작/끝 페이지, 강의 번호 등)
  - 콘텐츠 교체 모달
  - 콘텐츠별 미니 미리보기
- **위험도**: 🟡 중간

#### [R1-14] Step 3 - 미리보기 & 확인 컴포넌트

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/PreviewStep.tsx` (신규)
- **작업**:
  - 전체 변경 요약 (플랜 수 변화, 영향받는 날짜)
  - 경고 메시지 표시
  - 최종 실행 버튼 (Confirm Dialog 포함)
- **위험도**: 🟡 중간

#### [R1-15] 플랜 그룹 상세 페이지에 재조정 버튼 추가

- **파일**: `app/(student)/plan/group/[id]/_components/PlanGroupActionButtons.tsx` (수정)
- **작업**:
  - "재조정" 버튼 추가
  - `/plan/group/[id]/reschedule`로 이동
- **위험도**: 🟢 낮음

---

### Phase 1 테스트 시나리오

1. **상태 마이그레이션**
   - [ ] 기존 플랜의 status 값이 올바르게 설정되는지 확인
   - [ ] 완료된 플랜이 재조정 대상에서 제외되는지 확인

2. **히스토리 연결**
   - [ ] 재조정 시 plan_history 레코드 생성 확인
   - [ ] reschedule_log와 plan_history 연결 확인

3. **동시성 제어**
   - [ ] 동일 그룹에 대한 동시 재조정 요청 시 하나만 처리
   - [ ] 트랜잭션 실패 시 롤백 확인

4. **UI 플로우**
   - [ ] 3단계 Wizard 정상 동작 확인
   - [ ] 뒤로가기 지원 확인
   - [ ] 미리보기 결과와 실제 결과 일치 확인

---

## 🟡 Phase 2: 데이터 모델 및 롤백 정교화

**목표**: 버전 관리 체계 구축 및 롤백 기능 구현

**예상 기간**: 4-5일

**의존성**: Phase 1 완료

---

### 2.1 버전 체계 구축

#### [R2-1] version_group_id 컬럼 추가

- **파일**: `supabase/migrations/2025XXXX_add_version_group_id.sql`
- **작업**:
  ```sql
  ALTER TABLE student_plan
    ADD COLUMN IF NOT EXISTS version_group_id UUID;
  
  -- 기존 플랜: version_group_id = id (자기 자신)
  UPDATE student_plan
  SET version_group_id = id
  WHERE version_group_id IS NULL;
  
  -- 인덱스
  CREATE INDEX idx_student_plan_version_group ON student_plan(version_group_id, version);
  ```
- **위험도**: 🟡 중간 (기존 데이터 영향)

#### [R2-2] 버전 관리 헬퍼 함수

- **파일**: `lib/utils/planVersionUtils.ts` (신규)
- **작업**:
  ```typescript
  // 최신 버전 플랜 조회
  export async function getLatestVersionPlan(
    versionGroupId: string
  ): Promise<StudentPlan | null>;
  
  // 새 버전 생성
  export function createNewVersion(
    originalPlan: StudentPlan,
    changes: Partial<StudentPlan>
  ): StudentPlan;
  
  // 버전 히스토리 조회
  export async function getVersionHistory(
    versionGroupId: string
  ): Promise<StudentPlan[]>;
  ```
- **위험도**: 🟢 낮음

#### [R2-3] replaced_by 컬럼 정리 (선택)

- **파일**: `supabase/migrations/2025XXXX_cleanup_replaced_by.sql`
- **작업**:
  - `replaced_by` 컬럼 사용 중단 결정
  - 또는 `version_group_id`와 병행 사용 정책 결정
- **위험도**: 🟡 중간

---

### 2.2 롤백 기능 구현

#### [R2-4] 롤백 가능 조건 검증 함수

- **파일**: `lib/reschedule/rollbackValidator.ts` (신규)
- **작업**:
  ```typescript
  export interface RollbackValidation {
    canRollback: boolean;
    reason?: string;
    blockers?: {
      planId: string;
      status: PlanStatus;
      reason: string;
    }[];
  }
  
  // 롤백 가능 여부 검증
  export async function validateRollback(
    rescheduleLogId: string
  ): Promise<RollbackValidation>;
  ```
- **위험도**: 🟡 중간

#### [R2-5] 롤백 실행 함수

- **파일**: `app/(student)/actions/plan-groups/rollback.ts` (신규)
- **작업**:
  ```typescript
  // 롤백 실행
  export async function rollbackReschedule(
    rescheduleLogId: string
  ): Promise<RollbackResult>;
  
  // 롤백 결과
  export interface RollbackResult {
    success: boolean;
    restoredPlans: number;
    canceledPlans: number;
    error?: string;
  }
  ```
- **위험도**: 🔴 높음 (데이터 복원)

#### [R2-6] 롤백 UI 컴포넌트

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/RollbackButton.tsx` (신규)
- **작업**:
  - 롤백 가능 여부 표시
  - 롤백 실행 확인 다이얼로그
  - 롤백 결과 피드백
- **위험도**: 🟡 중간

---

### 2.3 ENUM 및 타입 강화

#### [R2-7] Postgres ENUM 타입 생성

- **파일**: `supabase/migrations/2025XXXX_create_enum_types.sql`
- **작업**:
  ```sql
  -- 콘텐츠 타입
  CREATE TYPE content_type_enum AS ENUM ('book', 'lecture', 'custom');
  
  -- 조정 타입
  CREATE TYPE adjustment_type_enum AS ENUM ('range', 'replace', 'full');
  
  -- 플랜 상태
  CREATE TYPE plan_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'canceled');
  ```
- **위험도**: 🟡 중간 (기존 TEXT 컬럼 변환 필요)

#### [R2-8] 기존 컬럼 ENUM 변환

- **파일**: `supabase/migrations/2025XXXX_convert_to_enum.sql`
- **작업**:
  - `plan_history.content_type` → `content_type_enum`
  - `plan_history.adjustment_type` → `adjustment_type_enum`
  - `student_plan.status` → `plan_status_enum`
- **위험도**: 🔴 높음 (기존 데이터 영향)

---

### 2.4 테넌트/권한 모델 반영

#### [R2-9] 히스토리/로그 테이블에 tenant_id 추가

- **파일**: `supabase/migrations/2025XXXX_add_tenant_id_to_history.sql`
- **작업**:
  ```sql
  ALTER TABLE plan_history
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
  
  ALTER TABLE reschedule_log
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
  
  -- 기존 데이터 마이그레이션 (plan_group_id를 통해)
  UPDATE plan_history ph
  SET tenant_id = pg.tenant_id
  FROM plan_groups pg
  WHERE ph.plan_group_id = pg.id AND ph.tenant_id IS NULL;
  ```
- **위험도**: 🟡 중간

#### [R2-10] RLS 정책 추가

- **파일**: `supabase/migrations/2025XXXX_add_history_rls.sql`
- **작업**:
  ```sql
  -- plan_history RLS
  ALTER TABLE plan_history ENABLE ROW LEVEL SECURITY;
  
  CREATE POLICY "tenant_isolation_plan_history" ON plan_history
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
  
  -- reschedule_log RLS
  ALTER TABLE reschedule_log ENABLE ROW LEVEL SECURITY;
  
  CREATE POLICY "tenant_isolation_reschedule_log" ON reschedule_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
  ```
- **위험도**: 🔴 높음 (접근 제어 영향)

---

### Phase 2 테스트 시나리오

1. **버전 관리**
   - [ ] 재조정 시 새 버전 생성 확인
   - [ ] version_group_id로 히스토리 조회 확인
   - [ ] 최신 버전만 활성화 상태 확인

2. **롤백 기능**
   - [ ] 24시간 내 롤백 가능 확인
   - [ ] 진행/완료된 플랜이 있으면 롤백 불가 확인
   - [ ] 롤백 시 기존 플랜 복원 확인

3. **RLS 정책**
   - [ ] 다른 테넌트의 히스토리 접근 불가 확인
   - [ ] 같은 테넌트 내 관리자 접근 가능 확인

---

## 🔴 Phase 3: 성능·운영 고도화

**목표**: 대규모 재조정 처리 및 운영 도구 구축

**예상 기간**: 5-7일

**의존성**: Phase 2 완료

---

### 3.1 성능 최적화

#### [R3-1] 인덱스 정교화

- **파일**: `supabase/migrations/2025XXXX_optimize_reschedule_indexes.sql`
- **작업**:
  ```sql
  -- 플랜 그룹 내 활성 플랜 조회 최적화
  CREATE INDEX CONCURRENTLY IF NOT EXISTS 
    idx_student_plan_group_active 
    ON student_plan (plan_group_id, is_active, status);
  
  -- 학습 날짜 기준 조회
  CREATE INDEX CONCURRENTLY IF NOT EXISTS 
    idx_student_plan_due_date 
    ON student_plan (due_date, plan_group_id);
  
  -- 버전 그룹 조회
  CREATE INDEX CONCURRENTLY IF NOT EXISTS 
    idx_student_plan_version_active 
    ON student_plan (version_group_id, is_active) WHERE is_active = true;
  ```
- **위험도**: 🟢 낮음 (인덱스만)

#### [R3-2] Batch 처리 유틸

- **파일**: `lib/reschedule/batchProcessor.ts` (신규)
- **작업**:
  ```typescript
  // 대량 플랜 비활성화
  export async function batchDeactivatePlans(
    planIds: string[]
  ): Promise<number>;
  
  // 대량 플랜 생성
  export async function batchCreatePlans(
    plans: CreatePlanInput[]
  ): Promise<string[]>;
  
  // 대량 히스토리 생성
  export async function batchCreateHistory(
    histories: CreateHistoryInput[]
  ): Promise<string[]>;
  ```
- **위험도**: 🟡 중간

#### [R3-3] 미리보기 결과 캐싱

- **파일**: `lib/reschedule/previewCache.ts` (신규)
- **작업**:
  ```typescript
  // 미리보기 결과 캐시 (5분 TTL)
  export async function cachePreviewResult(
    key: string,
    result: ReschedulePreviewResult
  ): Promise<void>;
  
  export async function getCachedPreview(
    key: string
  ): Promise<ReschedulePreviewResult | null>;
  
  // 캐시 키 생성
  export function generatePreviewCacheKey(
    groupId: string,
    adjustments: AdjustmentInput[]
  ): string;
  ```
- **위험도**: 🟢 낮음

---

### 3.2 비동기 처리 (대규모 재조정)

#### [R3-4] Job Queue 인터페이스

- **파일**: `lib/reschedule/jobQueue.ts` (신규)
- **작업**:
  ```typescript
  export interface RescheduleJob {
    id: string;
    groupId: string;
    adjustments: AdjustmentInput[];
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    result?: RescheduleResult;
    error?: string;
  }
  
  // Job 생성
  export async function enqueueRescheduleJob(
    groupId: string,
    adjustments: AdjustmentInput[]
  ): Promise<string>;
  
  // Job 상태 조회
  export async function getRescheduleJobStatus(
    jobId: string
  ): Promise<RescheduleJob>;
  ```
- **위험도**: 🟡 중간

#### [R3-5] 비동기 처리 Edge Function

- **파일**: `supabase/functions/reschedule-worker/index.ts` (신규)
- **작업**:
  - Job Queue에서 작업 가져오기
  - 재조정 실행
  - 결과 저장 및 알림
- **위험도**: 🔴 높음 (인프라 변경)

#### [R3-6] 진행 상황 UI 컴포넌트

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/JobProgress.tsx` (신규)
- **작업**:
  - 실시간 진행률 표시
  - 완료/실패 알림
  - 결과 페이지 이동
- **위험도**: 🟢 낮음

---

### 3.3 모니터링 및 운영 도구

#### [R3-7] 재조정 통계 집계

- **파일**: `lib/reschedule/analytics.ts` (신규)
- **작업**:
  ```typescript
  export interface RescheduleStats {
    totalRequests: number;
    averagePlansPerRequest: number;
    failureRate: number;
    averageProcessingTime: number;
    rollbackRate: number;
  }
  
  // 통계 조회
  export async function getRescheduleStats(
    tenantId: string,
    period: 'day' | 'week' | 'month'
  ): Promise<RescheduleStats>;
  ```
- **위험도**: 🟢 낮음

#### [R3-8] 관리자용 재조정 로그 조회 페이지

- **파일**: `app/(admin)/admin/reschedule-logs/page.tsx` (신규)
- **작업**:
  - reschedule_log 목록 조회
  - 필터링 (플랜 그룹, 학생, 날짜)
  - 상세 보기 (adjusted_contents, 관련 plan_history)
- **위험도**: 🟢 낮음

#### [R3-9] 강제 정리 기능

- **파일**: `app/(admin)/actions/reschedule/cleanup.ts` (신규)
- **작업**:
  ```typescript
  // 비정상 상태 플랜 정리
  export async function cleanupOrphanedPlans(
    groupId: string
  ): Promise<CleanupResult>;
  
  // 실패한 재조정 복구
  export async function recoverFailedReschedule(
    rescheduleLogId: string
  ): Promise<RecoveryResult>;
  ```
- **위험도**: 🔴 높음 (데이터 수정)

---

### 3.4 자동 제안 기능 (선택)

#### [R3-10] 재조정 패턴 분석

- **파일**: `lib/reschedule/patternAnalyzer.ts` (신규)
- **작업**:
  ```typescript
  // 재조정이 필요한 플랜 그룹 감지
  export async function detectRescheduleNeeds(
    studentId: string
  ): Promise<RescheduleRecommendation[]>;
  
  export interface RescheduleRecommendation {
    groupId: string;
    reason: string;
    suggestedAdjustments: AdjustmentInput[];
    priority: 'low' | 'medium' | 'high';
  }
  ```
- **위험도**: 🟢 낮음

#### [R3-11] 자동 제안 UI 컴포넌트

- **파일**: `app/(student)/plan/_components/RescheduleRecommendations.tsx` (신규)
- **작업**:
  - 추천 재조정 목록 표시
  - 원클릭 재조정 실행
- **위험도**: 🟢 낮음

---

### Phase 3 테스트 시나리오

1. **성능 테스트**
   - [ ] 100개 이상 플랜 재조정 시 10초 이내 완료 확인
   - [ ] 미리보기 캐시 적중률 확인
   - [ ] 인덱스 사용 여부 확인 (EXPLAIN ANALYZE)

2. **비동기 처리**
   - [ ] 대규모 재조정 시 Job Queue 동작 확인
   - [ ] 진행 상황 실시간 업데이트 확인
   - [ ] 실패 시 재시도 동작 확인

3. **운영 도구**
   - [ ] 관리자 로그 조회 페이지 동작 확인
   - [ ] 강제 정리 기능 안전성 확인
   - [ ] 통계 데이터 정확성 확인

---

## 📋 전체 체크리스트

### Phase 1 (안전한 최소 기능)

- [ ] [R1-1] student_plan 상태 컬럼 추가/정리
- [ ] [R1-2] 상태 관련 헬퍼 함수 추가
- [ ] [R1-3] 상태 정의 문서화
- [ ] [R1-4] plan_history 테이블 생성
- [ ] [R1-5] reschedule_log 테이블 생성
- [ ] [R1-6] plan_history ↔ reschedule_log FK 연결
- [ ] [R1-7] Advisory Lock 유틸
- [ ] [R1-8] 트랜잭션 래퍼 함수
- [ ] [R1-9] 스케줄 엔진 추출
- [ ] [R1-10] 미리보기/실행 로직 통합
- [ ] [R1-11] 재조정 페이지 라우트 생성
- [ ] [R1-12] Step 1 - 콘텐츠 선택 컴포넌트
- [ ] [R1-13] Step 2 - 상세 조정 컴포넌트
- [ ] [R1-14] Step 3 - 미리보기 & 확인 컴포넌트
- [ ] [R1-15] 플랜 그룹 상세 페이지에 재조정 버튼 추가

### Phase 2 (데이터 모델 및 롤백)

- [ ] [R2-1] version_group_id 컬럼 추가
- [ ] [R2-2] 버전 관리 헬퍼 함수
- [ ] [R2-3] replaced_by 컬럼 정리 (선택)
- [ ] [R2-4] 롤백 가능 조건 검증 함수
- [ ] [R2-5] 롤백 실행 함수
- [ ] [R2-6] 롤백 UI 컴포넌트
- [ ] [R2-7] Postgres ENUM 타입 생성
- [ ] [R2-8] 기존 컬럼 ENUM 변환
- [ ] [R2-9] 히스토리/로그 테이블에 tenant_id 추가
- [ ] [R2-10] RLS 정책 추가

### Phase 3 (성능·운영 고도화)

- [ ] [R3-1] 인덱스 정교화
- [ ] [R3-2] Batch 처리 유틸
- [ ] [R3-3] 미리보기 결과 캐싱
- [ ] [R3-4] Job Queue 인터페이스
- [ ] [R3-5] 비동기 처리 Edge Function
- [ ] [R3-6] 진행 상황 UI 컴포넌트
- [ ] [R3-7] 재조정 통계 집계
- [ ] [R3-8] 관리자용 재조정 로그 조회 페이지
- [ ] [R3-9] 강제 정리 기능
- [ ] [R3-10] 재조정 패턴 분석 (선택)
- [ ] [R3-11] 자동 제안 UI 컴포넌트 (선택)

---

## 📝 변경 기록

| 날짜       | 버전 | 내용      |
| ---------- | ---- | --------- |
| 2025-12-09 | v1.0 | 초안 작성 |

