# 학원 일정 시간 관리 영역 지원 및 코드 최적화

**작성일**: 2025-12-18  
**작성자**: AI Assistant

## 개요

학원 일정을 학습 제외일처럼 `plan_group_id`가 NULL인 상태로 시간 관리 영역에 미리 등록하여 관리할 수 있도록 지원. 동시에 중복 코드를 최적화하고 모범 사례를 적용.

## 변경 사항 요약

### 1. 데이터베이스 마이그레이션

**파일**: `supabase/migrations/20251218000001_allow_null_plan_group_id_in_academy_schedules.sql`

- `academy_schedules.plan_group_id` 컬럼을 NULL 허용으로 변경
- 외래 키 제약조건을 `ON DELETE SET NULL`로 변경
- 플랜 그룹이 삭제되면 학원 일정의 `plan_group_id`가 자동으로 NULL로 설정됨

**변경 전**:
- `plan_group_id`: NOT NULL
- 외래 키: ON DELETE CASCADE

**변경 후**:
- `plan_group_id`: NULL 허용
- 외래 키: ON DELETE SET NULL

### 2. 코드 수정

#### 2.1 `createStudentAcademySchedules` 함수 수정

**파일**: `lib/data/planGroups.ts` (1913-2085줄)

**변경 사항**:
- `plan_group_id: null` 명시적 설정 (시간 관리 영역)
- Deprecated 주석 제거 및 함수 설명 업데이트
- 이제 시간 관리 영역에서 플랜 그룹 없이 학원 일정을 미리 등록할 수 있음

**변경 전**:
```typescript
return {
  tenant_id: tenantId,
  student_id: studentId,
  // plan_group_id는 마이그레이션 후 NOT NULL이므로 이 함수는 더 이상 사용 불가
  academy_id: academyId,
  // ...
};
```

**변경 후**:
```typescript
return {
  tenant_id: tenantId,
  student_id: studentId,
  plan_group_id: null, // 시간 관리 영역 (NULL 허용)
  academy_id: academyId,
  // ...
};
```

#### 2.2 헬퍼 함수 추출 및 중복 코드 제거

**추가된 헬퍼 함수들**:

1. **`getSupabaseClient(useAdminClient: boolean)`**
   - Supabase 클라이언트 생성 로직 통합
   - Admin 모드 지원
   - 여러 함수에서 중복되던 클라이언트 생성 로직을 하나로 통합

2. **`getOrCreateAcademy(supabase, studentId, tenantId, academyName)`**
   - Academy 찾기 또는 생성 로직 통합
   - `createStudentAcademySchedules`와 `createPlanAcademySchedules`에서 중복되던 로직을 하나로 통합

**최적화된 함수들**:
- `createStudentAcademySchedules`: 헬퍼 함수 사용으로 코드 간소화
- `createPlanAcademySchedules`: 로컬 `getOrCreateAcademy` 함수 제거, 공통 헬퍼 함수 사용

## 사용 방법

### 시간 관리 영역에 학원 일정 추가

```typescript
import { createStudentAcademySchedules } from "@/lib/data/planGroups";

// 시간 관리 영역에 학원 일정 추가 (plan_group_id = null)
const result = await createStudentAcademySchedules(
  studentId,
  tenantId,
  [
    {
      day_of_week: 1, // 월요일
      start_time: "14:00",
      end_time: "17:00",
      academy_name: "수학 학원",
      subject: "수학",
    },
  ]
);

if (result.success) {
  console.log("학원 일정이 시간 관리 영역에 추가되었습니다.");
}
```

### 플랜 그룹 생성 시 시간 관리 영역 학원 일정 재활용

`createPlanAcademySchedules` 함수는 이미 시간 관리 영역(`plan_group_id`가 NULL)의 학원 일정을 자동으로 재활용하도록 구현되어 있습니다.

```typescript
import { createPlanAcademySchedules } from "@/lib/data/planGroups";

// 플랜 그룹 생성 시 시간 관리 영역의 학원 일정이 자동으로 재활용됨
const result = await createPlanAcademySchedules(
  planGroupId,
  tenantId,
  schedules
);
```

**재활용 로직**:
1. 시간 관리 영역(`plan_group_id`가 NULL)의 학원 일정 조회
2. 동일한 요일/시간/학원명/과목이 있으면 `plan_group_id`만 업데이트
3. 없으면 새로 생성

## 데이터베이스 스키마

### academy_schedules 테이블

```sql
CREATE TABLE academy_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  plan_group_id UUID, -- NULL 허용 (시간 관리 영역)
  student_id UUID NOT NULL,
  academy_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  academy_name VARCHAR,
  subject VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  FOREIGN KEY (plan_group_id) REFERENCES plan_groups(id) ON DELETE SET NULL,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (academy_id) REFERENCES academies(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

## 테스트 및 검증

### 마이그레이션 검증

- ✅ `plan_group_id` 컬럼이 NULL 허용으로 변경됨
- ✅ 외래 키 제약조건이 `ON DELETE SET NULL`로 설정됨
- ✅ 주석이 업데이트됨

### 기능 테스트

1. **시간 관리 영역에 학원 일정 추가**
   - `createStudentAcademySchedules` 호출
   - `plan_group_id`가 NULL인 레코드 생성 확인

2. **플랜 그룹 생성 시 재활용**
   - 시간 관리 영역에 학원 일정 추가
   - 플랜 그룹 생성 시 `createPlanAcademySchedules` 호출
   - 기존 레코드의 `plan_group_id`가 업데이트되는지 확인

3. **플랜 그룹 삭제 시 동작**
   - 플랜 그룹 삭제
   - 학원 일정의 `plan_group_id`가 NULL로 변경되는지 확인

## 참고 사항

- 학습 제외일(`plan_exclusions`)과 동일한 패턴으로 구현
- `createPlanAcademySchedules`의 시간 관리 영역 재활용 로직은 이미 구현되어 있어 마이그레이션 후 정상 작동
- 헬퍼 함수 추출로 코드 중복 제거 및 유지보수성 향상

## 관련 파일

- `supabase/migrations/20251218000001_allow_null_plan_group_id_in_academy_schedules.sql`
- `supabase/migrations/20251217020000_allow_null_plan_group_id_in_exclusions.sql` (참고)
- `lib/data/planGroups.ts`

