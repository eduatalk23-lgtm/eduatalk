# 플랜 생성 및 CRUD 기능 점검 및 개선점 분석

> 작성일: 2025-02-02  
> 상태: 분석 완료  
> 목적: 플랜 생성 및 CRUD 관련 기능의 현재 상태 점검 및 개선점 도출

---

## 📋 목차

1. [현재 상태 분석](#현재-상태-분석)
2. [CRUD 기능 점검](#crud-기능-점검)
3. [발견된 이슈](#발견된-이슈)
4. [개선 제안](#개선-제안)
5. [우선순위별 개선 계획](#우선순위별-개선-계획)

---

## 현재 상태 분석

### 1. 플랜 그룹 (Plan Groups) CRUD

#### Create (생성)

**위치**: `lib/domains/plan/actions/plan-groups/create.ts`

**주요 기능**:
- ✅ 원자적 트랜잭션 생성 (`createPlanGroupAtomic` RPC)
- ✅ 검증 로직 (`PlanValidator.validateCreation`)
- ✅ 기간 중복 검증 (`checkPlanPeriodOverlap`)
- ✅ Draft 자동 저장 및 업데이트
- ✅ 캠프 모드 지원 (`camp_invitation_id` 기반)
- ✅ 슬롯 모드 지원 (`use_slot_mode`, `content_slots`)
- ✅ Dual Write 패턴 (`content_slots` → `subject_allocations`)

**저장되는 데이터**:
- `plan_groups`: 메인 플랜 그룹 정보
- `plan_contents`: 콘텐츠 정보
- `plan_exclusions`: 제외일 정보
- `academy_schedules`: 학원 일정 정보

**권한 처리**:
- 학생: 자동으로 현재 사용자 ID 사용
- 관리자/컨설턴트: `options.studentId`로 대상 학생 지정

#### Read (조회)

**위치**: `lib/data/planGroups.ts`, `lib/domains/plan/repository.ts`

**주요 기능**:
- ✅ 단일 플랜 그룹 조회 (`getPlanGroupById`)
- ✅ 상세 정보 조회 (`getPlanGroupWithDetails`)
- ✅ 관리자용 조회 (`getPlanGroupWithDetailsForAdmin`)
- ✅ 목록 조회 (`findPlanGroups`)

**필터링 지원**:
- 상태별 필터 (`status`)
- 목적별 필터 (`plan_purpose`)
- 기간별 필터 (`dateRange`)
- 삭제된 항목 포함 여부 (`includeDeleted`)

#### Update (수정)

**위치**: `lib/domains/plan/actions/plan-groups/update.ts`

**주요 기능**:
- ✅ Draft 업데이트 (`updatePlanGroupDraftAction`)
- ✅ 일반 업데이트 (`updatePlanGroupAction`)
- ✅ 상태별 수정 권한 체크 (`PlanStatusManager.canEdit`)
- ✅ 콘텐츠 업데이트 (기존 삭제 후 재생성)
- ✅ 제외일 업데이트 (플랜 그룹별 관리)
- ✅ 학원 일정 업데이트 (플랜 그룹별 관리)

**제한사항**:
- `draft`, `saved` 상태에서만 수정 가능
- `active`, `paused`, `completed`, `cancelled` 상태에서는 수정 불가

#### Delete (삭제)

**위치**: `lib/domains/plan/actions/plan-groups/delete.ts`

**주요 기능**:
- ✅ Soft Delete (`deleted_at` 설정)
- ✅ 상태별 삭제 권한 체크 (`PlanStatusManager.canDelete`)
- ✅ 캠프 플랜 삭제 차단
- ✅ 관련 데이터 삭제:
  - `student_plan` (hard delete)
  - `ad_hoc_plans` (hard delete)
  - `plan_contents` (CASCADE)
  - `plan_exclusions` (CASCADE)
  - `academy_schedules` (CASCADE)

**백업 기능**:
- ⚠️ 백업 데이터 수집은 구현되어 있으나 저장은 주석 처리됨
- `plan_group_backups` 테이블 생성 시 활성화 예정

### 2. 학생 플랜 (Student Plans) CRUD

#### Create (생성)

**위치**: `lib/data/studentPlans.ts`, `lib/domains/plan/actions/core.ts`

**주요 기능**:
- ✅ 단일 플랜 생성 (`createPlan`)
- ✅ 일괄 플랜 생성 (`createStudentPlans`)
- ✅ 원자적 플랜 생성 (`generatePlansAtomic` RPC)
- ✅ 플랜 그룹 기반 생성 (`generatePlansFromGroupAction`)

**생성 방식**:
1. **수동 생성**: 개별 플랜 항목 생성
2. **자동 생성**: 플랜 그룹에서 `student_plan` 일괄 생성
3. **AI 생성**: LLM 기반 플랜 생성 (`generatePlanWithAI`)

#### Read (조회)

**위치**: `lib/data/studentPlans.ts`, `lib/domains/plan/repository.ts`

**주요 기능**:
- ✅ 단일 플랜 조회
- ✅ 목록 조회 (필터링 지원)
- ✅ 날짜별 조회
- ✅ 플랜 그룹별 조회

#### Update (수정)

**위치**: `lib/data/studentPlans.ts`, `lib/domains/plan/actions/core.ts`

**주요 기능**:
- ✅ 안전한 업데이트 (`updatePlanSafe`)
- ✅ 금지된 필드 보호 (`FORBIDDEN_UPDATE_FIELDS`)
- ✅ 상태별 수정 권한 체크

**금지된 필드**:
- `content_type`, `content_id`
- `plan_group_id`, `student_id`, `tenant_id`
- `origin_plan_item_id`, `plan_number`

#### Delete (삭제)

**위치**: `lib/domains/plan/actions/adjustDashboard.ts`

**주요 기능**:
- ✅ 단일 플랜 삭제 (`deletePlan`)
- ✅ 일괄 플랜 삭제 (`deleteMultiplePlans`)
- ✅ 완료된 플랜 삭제 차단
- ✅ Soft Delete (`is_active = false`)

**제한사항**:
- 완료된 플랜 (`status === "completed"`)은 삭제 불가
- 권한 확인 (자신의 플랜만 삭제 가능)

---

## CRUD 기능 점검

### 1. 데이터 일관성

#### ✅ 강점

1. **원자적 트랜잭션**
   - `createPlanGroupAtomic` RPC로 플랜 그룹 생성 시 관련 테이블 모두 트랜잭션 처리
   - `generatePlansAtomic` RPC로 플랜 생성 시 삭제/삽입/상태 업데이트 원자적 처리

2. **중복 방지**
   - 기간 중복 검증 (`checkPlanPeriodOverlap`)
   - Draft 중복 생성 방지 (`findExistingDraftPlanGroup`)
   - Unique constraint로 DB 레벨 중복 방지

3. **상태 관리**
   - `PlanStatusManager`로 상태별 권한 체크
   - 상태 전이 규칙 명확화

#### ⚠️ 개선 필요

1. **콘텐츠 업데이트 방식**
   - 현재: 기존 삭제 후 재생성 (DELETE → INSERT)
   - 문제: 삭제/생성 사이에 데이터 불일치 가능
   - 개선: UPSERT 패턴 또는 트랜잭션 내 처리

2. **제외일/학원 일정 업데이트**
   - 현재: 플랜 그룹별로 독립 관리
   - 문제: 플랜 그룹 간 중복 허용으로 인한 데이터 중복
   - 개선: 학생별 전역 관리로 전환 (Phase 2 계획)

### 2. 에러 처리

#### ✅ 강점

1. **에러 핸들링 래퍼**
   - `withErrorHandling`, `withErrorHandlingSafe`로 일관된 에러 처리
   - 에러 로깅 자동화 (`logActionError`)

2. **검증 로직**
   - `PlanValidator`로 입력값 검증
   - 상태별 권한 체크

#### ⚠️ 개선 필요

1. **에러 메시지 일관성**
   - 일부 에러 메시지가 기술적 용어 사용
   - 사용자 친화적 메시지로 개선 필요

2. **부분 실패 처리**
   - 일괄 작업 시 일부 실패 시 롤백 여부 불명확
   - 부분 성공 처리 전략 필요

### 3. 성능

#### ✅ 강점

1. **배치 조회**
   - `master_content_id` 조회 시 배치 처리
   - 병렬 쿼리 실행 (`Promise.all`)

2. **캐시 무효화**
   - `revalidatePath`로 관련 페이지 캐시 무효화

#### ⚠️ 개선 필요

1. **N+1 쿼리 문제**
   - 플랜 목록 조회 시 관련 데이터 개별 조회 가능성
   - JOIN 또는 배치 조회로 개선

2. **대량 데이터 처리**
   - 일괄 플랜 생성 시 성능 최적화 필요
   - 페이지네이션 또는 청크 처리 고려

### 4. 권한 관리

#### ✅ 강점

1. **역할 기반 접근 제어**
   - 학생: 자신의 플랜만 접근
   - 관리자/컨설턴트: 모든 학생 플랜 접근

2. **상태별 권한 체크**
   - `PlanStatusManager`로 상태별 CRUD 권한 관리

#### ⚠️ 개선 필요

1. **관리자 권한 세분화**
   - 관리자와 컨설턴트 권한 구분 필요
   - 특정 작업에 대한 세부 권한 설정

2. **감사 로그**
   - 관리자가 다른 학생 플랜 수정 시 감사 로그 필요
   - 현재는 디버그 로그만 존재

---

## 발견된 이슈

### 1. Critical (치명적)

#### C1. 콘텐츠 업데이트 시 데이터 불일치 가능성

**위치**: `lib/domains/plan/actions/plan-groups/update.ts:252-292`

**문제**:
```typescript
// 기존 콘텐츠 삭제
await supabase.from("plan_contents").delete().eq("plan_group_id", groupId);

// 새 콘텐츠 생성
await createPlanContents(groupId, tenantContext.tenantId, data.contents);
```

삭제와 생성 사이에 트랜잭션이 없어 부분 실패 시 데이터 불일치 가능.

**영향**: 플랜 그룹의 콘텐츠 정보 손실

**우선순위**: HIGH

#### C2. 백업 기능 미활성화

**위치**: `lib/domains/plan/actions/plan-groups/delete.ts:134-155`

**문제**:
- 플랜 그룹 삭제 시 백업 데이터 수집은 하지만 저장하지 않음
- `plan_group_backups` 테이블이 없어 백업 불가

**영향**: 삭제된 플랜 그룹 복구 불가

**우선순위**: MEDIUM

### 2. High (높음)

#### H1. 제외일/학원 일정 중복 관리

**위치**: `lib/domains/plan/actions/plan-groups/update.ts:294-390`

**문제**:
- 플랜 그룹별로 독립 관리되어 같은 날짜/시간의 제외일/학원 일정이 중복 생성 가능
- 학생별 전역 관리로 전환 예정이지만 아직 미구현

**영향**: 데이터 중복 및 관리 복잡도 증가

**우선순위**: MEDIUM

#### H2. 일괄 작업 시 부분 실패 처리 미흡

**위치**: `lib/domains/plan/actions/adjustDashboard.ts:758-819`

**문제**:
- 일괄 삭제 시 일부 실패해도 성공으로 처리
- 실패한 항목에 대한 정보 부족

**영향**: 사용자가 실패한 항목을 알 수 없음

**우선순위**: MEDIUM

### 3. Medium (중간)

#### M1. 에러 메시지 일관성 부족

**문제**:
- 일부 에러 메시지가 기술적 용어 사용
- 사용자 친화적 메시지로 개선 필요

**예시**:
- "Unique violation (23505)" → "이미 존재하는 플랜입니다"
- "Column not found" → "시스템 오류가 발생했습니다"

**우선순위**: LOW

#### M2. 감사 로그 부족

**문제**:
- 관리자가 다른 학생 플랜 수정 시 감사 로그 미기록
- 현재는 디버그 로그만 존재

**영향**: 보안 감사 및 추적 불가

**우선순위**: LOW

### 4. Low (낮음)

#### L1. N+1 쿼리 가능성

**문제**:
- 플랜 목록 조회 시 관련 데이터 개별 조회 가능성
- JOIN 또는 배치 조회로 개선 필요

**우선순위**: LOW

#### L2. 대량 데이터 처리 최적화 부족

**문제**:
- 일괄 플랜 생성 시 성능 최적화 필요
- 페이지네이션 또는 청크 처리 고려

**우선순위**: LOW

---

## 개선 제안

### 1. 데이터 일관성 개선

#### 1.1 콘텐츠 업데이트 트랜잭션 처리

**현재**:
```typescript
// 삭제
await supabase.from("plan_contents").delete().eq("plan_group_id", groupId);
// 생성
await createPlanContents(groupId, tenantContext.tenantId, data.contents);
```

**개선안**:
```typescript
// RPC 함수로 트랜잭션 내 처리
await supabase.rpc("update_plan_contents_atomic", {
  p_plan_group_id: groupId,
  p_contents: data.contents,
});
```

**우선순위**: HIGH

#### 1.2 제외일/학원 일정 전역 관리 전환

**현재**: 플랜 그룹별 독립 관리

**개선안**: 학생별 전역 관리
- `plan_exclusions`: `student_id` 기준으로 전역 관리
- `academy_schedules`: `student_id` 기준으로 전역 관리
- 플랜 그룹 간 중복 제거

**우선순위**: MEDIUM

### 2. 에러 처리 개선

#### 2.1 사용자 친화적 에러 메시지

**개선안**:
- 에러 코드별 메시지 매핑 테이블 생성
- 기술적 에러를 사용자 친화적 메시지로 변환

**예시**:
```typescript
const ERROR_MESSAGES = {
  "23505": "이미 존재하는 플랜입니다",
  "PGRST116": "요청한 데이터를 찾을 수 없습니다",
  // ...
};
```

**우선순위**: LOW

#### 2.2 부분 실패 처리

**개선안**:
- 일괄 작업 시 성공/실패 항목 분리
- 실패한 항목에 대한 상세 정보 제공

**예시**:
```typescript
{
  success: true,
  total: 100,
  succeeded: 95,
  failed: 5,
  errors: [
    { id: "plan-1", error: "이미 완료된 플랜입니다" },
    // ...
  ]
}
```

**우선순위**: MEDIUM

### 3. 성능 개선

#### 3.1 N+1 쿼리 해결

**개선안**:
- JOIN을 사용한 단일 쿼리로 변경
- 또는 배치 조회로 관련 데이터 일괄 로드

**우선순위**: LOW

#### 3.2 대량 데이터 처리 최적화

**개선안**:
- 청크 단위로 나누어 처리
- 진행 상황 표시 (Progress Bar)

**우선순위**: LOW

### 4. 권한 관리 개선

#### 4.1 감사 로그 구현

**개선안**:
- `plan_group_audit_logs` 테이블 생성
- 관리자 작업 시 자동 로깅

**스키마**:
```sql
CREATE TABLE plan_group_audit_logs (
  id uuid PRIMARY KEY,
  plan_group_id uuid REFERENCES plan_groups(id),
  action varchar(50), -- 'create', 'update', 'delete'
  performed_by uuid REFERENCES users(id),
  performed_for uuid REFERENCES users(id), -- student_id
  changes jsonb, -- 변경 사항
  created_at timestamptz DEFAULT now()
);
```

**우선순위**: MEDIUM

#### 4.2 권한 세분화

**개선안**:
- 관리자와 컨설턴트 권한 구분
- 특정 작업에 대한 세부 권한 설정

**우선순위**: LOW

### 5. 백업 기능 활성화

#### 5.1 백업 테이블 생성

**개선안**:
- `plan_group_backups` 테이블 생성
- 삭제 시 자동 백업 저장

**스키마**:
```sql
CREATE TABLE plan_group_backups (
  id uuid PRIMARY KEY,
  plan_group_id uuid,
  student_id uuid REFERENCES users(id),
  tenant_id uuid REFERENCES tenants(id),
  backup_data jsonb,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);
```

**우선순위**: MEDIUM

---

## 우선순위별 개선 계획

### Phase 1: Critical 이슈 해결 (1-2주)

1. **콘텐츠 업데이트 트랜잭션 처리** (HIGH)
   - RPC 함수 생성 (`update_plan_contents_atomic`)
   - 트랜잭션 내 삭제/생성 처리

2. **일괄 작업 부분 실패 처리** (MEDIUM)
   - 성공/실패 항목 분리
   - 상세 에러 정보 제공

### Phase 2: 데이터 일관성 개선 (2-3주)

1. **제외일/학원 일정 전역 관리 전환** (MEDIUM)
   - 마이그레이션 스크립트 작성
   - 기존 데이터 변환
   - 업데이트 로직 수정

2. **백업 기능 활성화** (MEDIUM)
   - `plan_group_backups` 테이블 생성
   - 삭제 시 자동 백업 저장

### Phase 3: 권한 및 감사 개선 (2-3주)

1. **감사 로그 구현** (MEDIUM)
   - `plan_group_audit_logs` 테이블 생성
   - 관리자 작업 자동 로깅

2. **권한 세분화** (LOW)
   - 관리자/컨설턴트 권한 구분
   - 세부 권한 설정

### Phase 4: 성능 및 UX 개선 (1-2주)

1. **에러 메시지 개선** (LOW)
   - 사용자 친화적 메시지 매핑
   - 에러 코드별 메시지 제공

2. **N+1 쿼리 해결** (LOW)
   - JOIN 또는 배치 조회로 개선

3. **대량 데이터 처리 최적화** (LOW)
   - 청크 처리
   - 진행 상황 표시

---

## 참고 파일

### 플랜 그룹 CRUD
- `lib/domains/plan/actions/plan-groups/create.ts` - 생성
- `lib/domains/plan/actions/plan-groups/update.ts` - 수정
- `lib/domains/plan/actions/plan-groups/delete.ts` - 삭제
- `lib/data/planGroups.ts` - 데이터 접근

### 학생 플랜 CRUD
- `lib/data/studentPlans.ts` - 데이터 접근
- `lib/domains/plan/actions/core.ts` - 핵심 액션
- `lib/domains/plan/actions/adjustDashboard.ts` - 일괄 작업

### 검증 및 상태 관리
- `lib/validation/planValidator.ts` - 검증 로직
- `lib/plan/statusManager.ts` - 상태 관리

### 문서
- `docs/2025-02-02-plan-creation-features-comprehensive-analysis.md` - 플랜 생성 기능 분석
- `docs/admin-plan-assignment-flow.md` - 관리자 플랜 배정 플로우
- `docs/플랜_그룹_생성_저장_정보.md` - 저장 정보 상세

---

## 결론

### 현재 상태 요약

1. **강점**:
   - 원자적 트랜잭션으로 데이터 일관성 보장
   - 상태별 권한 체크로 안전한 CRUD 작업
   - 검증 로직으로 데이터 무결성 보장

2. **개선 필요**:
   - 콘텐츠 업데이트 트랜잭션 처리
   - 제외일/학원 일정 전역 관리 전환
   - 백업 기능 활성화
   - 감사 로그 구현

### 권장 개선 순서

1. **즉시 개선** (Phase 1): 데이터 일관성 이슈 해결
2. **단기 개선** (Phase 2): 데이터 관리 방식 개선
3. **중기 개선** (Phase 3): 권한 및 감사 개선
4. **장기 개선** (Phase 4): 성능 및 UX 개선

---

*최종 업데이트: 2025-02-02*

