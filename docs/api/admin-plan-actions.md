# Admin Plan Actions API 문서

## 개요

관리자용 학습 플랜 관리 Server Actions API 문서입니다.

**위치**: `lib/domains/admin-plan/actions/`

**인증**: 모든 액션은 `requireAdminOrConsultant()` 가드를 통해 관리자/상담사 권한 검증

---

## 플랜 수정 (Edit)

### `getStudentPlanForEdit`

단일 플랜 조회 (수정용)

```typescript
import { getStudentPlanForEdit } from '@/lib/domains/admin-plan/actions';

const result = await getStudentPlanForEdit(planId: string, studentId: string);
```

**Parameters:**
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| planId | string | ✅ | 플랜 ID |
| studentId | string | ✅ | 학생 ID |

**Returns:** `AdminPlanResponse<StudentPlanDetail>`

```typescript
interface StudentPlanDetail {
  id: string;
  student_id: string;
  plan_group_id: string | null;
  content_title: string | null;
  content_subject: string | null;
  custom_title: string | null;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  estimated_minutes: number | null;
  status: string;
  container_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

---

### `adminUpdateStudentPlan`

단일 플랜 수정

```typescript
import { adminUpdateStudentPlan } from '@/lib/domains/admin-plan/actions';

const result = await adminUpdateStudentPlan(
  planId: string,
  studentId: string,
  updates: StudentPlanUpdateInput
);
```

**Parameters:**
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| planId | string | ✅ | 플랜 ID |
| studentId | string | ✅ | 학생 ID |
| updates | StudentPlanUpdateInput | ✅ | 수정할 필드들 |

**StudentPlanUpdateInput:**
```typescript
interface StudentPlanUpdateInput {
  custom_title?: string;
  plan_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  planned_start_page_or_time?: number | null;
  planned_end_page_or_time?: number | null;
  estimated_minutes?: number | null;
  status?: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';
  container_type?: 'daily' | 'weekly' | 'unfinished';
}
```

**Returns:** `AdminPlanResponse<StudentPlanDetail>`

**이벤트 로깅:** `plan_updated` 이벤트 자동 생성

---

### `adminBulkUpdatePlans`

플랜 일괄 수정

```typescript
import { adminBulkUpdatePlans } from '@/lib/domains/admin-plan/actions';

const result = await adminBulkUpdatePlans(
  planIds: string[],
  studentId: string,
  updates: Partial<StudentPlanUpdateInput>
);
```

**Parameters:**
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| planIds | string[] | ✅ | 수정할 플랜 ID 배열 |
| studentId | string | ✅ | 학생 ID |
| updates | Partial<StudentPlanUpdateInput> | ✅ | 수정할 필드들 |

**Returns:** `AdminPlanResponse<{ updatedCount: number }>`

---

## 플랜 복사 (Copy)

### `copyPlansToDate`

플랜을 특정 날짜로 복사

```typescript
import { copyPlansToDate } from '@/lib/domains/admin-plan/actions';

const result = await copyPlansToDate({
  sourcePlanIds: ['plan-1', 'plan-2'],
  targetDates: ['2024-01-20', '2024-01-21'],
  studentId: 'student-123',
  targetStudentIds: ['student-456'], // 선택적
});
```

**Parameters:**
```typescript
interface CopyPlanInput {
  sourcePlanIds: string[];      // 복사할 원본 플랜 ID들
  targetDates: string[];        // 복사할 대상 날짜들 (YYYY-MM-DD)
  studentId: string;            // 원본 플랜 소유 학생 ID
  targetStudentIds?: string[];  // 복사 대상 학생들 (미지정시 원본 학생)
}
```

**Returns:**
```typescript
interface CopyPlanResult {
  copiedCount: number;      // 복사된 플랜 수
  copiedPlanIds: string[];  // 복사된 플랜 ID들
}
```

**복사 로직:**
- 복사 개수 = `sourcePlanIds.length × targetDates.length × targetStudentIds.length`
- 다른 학생에게 복사 시 `plan_group_id`는 `null`로 설정
- 복사된 플랜의 `status`는 `'pending'`, `is_completed`는 `false`

---

## 그룹 이동 (Move to Group)

### `getStudentPlanGroups`

학생의 플랜 그룹 목록 조회

```typescript
import { getStudentPlanGroups } from '@/lib/domains/admin-plan/actions';

const result = await getStudentPlanGroups(studentId: string);
```

**Returns:** `AdminPlanResponse<PlanGroupInfo[]>`

```typescript
interface PlanGroupInfo {
  id: string;
  name: string;
  content_master_id: string | null;
  content_title: string | null;
  start_date: string | null;
  end_date: string | null;
  plan_count: number;  // 해당 그룹의 플랜 수
}
```

---

### `movePlansToGroup`

플랜을 다른 그룹으로 이동

```typescript
import { movePlansToGroup } from '@/lib/domains/admin-plan/actions';

const result = await movePlansToGroup({
  planIds: ['plan-1', 'plan-2'],
  targetGroupId: 'group-new', // null이면 그룹에서 제거
  studentId: 'student-123',
});
```

**Parameters:**
```typescript
interface MoveToGroupInput {
  planIds: string[];           // 이동할 플랜 ID들
  targetGroupId: string | null; // 대상 그룹 ID (null = 그룹에서 제거)
  studentId: string;           // 학생 ID
}
```

**Returns:** `AdminPlanResponse<{ movedCount: number }>`

---

## 콘텐츠 기반 플랜 생성 (Create from Content)

### `createPlanFromContent`

유연한 콘텐츠에서 플랜 생성 (배치 방식 지원)

```typescript
import { createPlanFromContent } from '@/lib/domains/admin-plan/actions';

const result = await createPlanFromContent({
  flexibleContentId: 'content-123',
  contentTitle: '개념원리 수학1',
  contentSubject: '수학',
  rangeStart: 1,
  rangeEnd: 100,
  distributionMode: 'period',
  targetDate: '2024-01-15',
  periodEndDate: '2024-01-24',
  studentId: 'student-123',
  tenantId: 'tenant-123',
});
```

**Parameters:**
```typescript
type DistributionMode = 'today' | 'period' | 'weekly';

interface CreatePlanFromContentInput {
  // 콘텐츠 정보
  flexibleContentId: string;
  contentTitle: string;
  contentSubject: string | null;

  // 범위 정보
  rangeStart: number | null;
  rangeEnd: number | null;
  customRangeDisplay?: string | null;  // 자유 입력 범위
  totalVolume?: number | null;         // 예상 볼륨

  // 배치 정보
  distributionMode: DistributionMode;
  targetDate: string;                  // 기준 날짜
  periodEndDate?: string;              // period 모드 종료 날짜

  // 학생 정보
  studentId: string;
  tenantId: string;
}
```

**Returns:**
```typescript
interface CreatePlanFromContentResult {
  createdPlanIds: string[];
  createdCount: number;
}
```

**배치 모드 설명:**

| 모드 | 설명 | container_type | 생성 개수 |
|------|------|----------------|-----------|
| `today` | Daily Dock에 단일 플랜 | daily | 1개 |
| `weekly` | Weekly Dock에 단일 플랜 | weekly | 1개 |
| `period` | 기간에 걸쳐 분배 | daily | 날짜 수만큼 |

**period 모드 분배 로직:**
- 날짜 수 = (periodEndDate - targetDate) + 1
- 범위가 있는 경우: 총 범위를 날짜 수로 균등 분배
- 범위가 없는 경우: 각 날짜에 동일한 플랜 생성

---

## 컨테이너 이동 (Container Operations)

### `movePlanToContainer`

플랜을 다른 컨테이너로 이동 (Daily ↔ Weekly ↔ Unfinished)

```typescript
import { movePlanToContainer } from '@/lib/domains/admin-plan/actions';

const result = await movePlanToContainer({
  planId: 'plan-123',
  planType: 'plan',  // 'plan' | 'adhoc'
  fromContainer: 'daily',
  toContainer: 'weekly',
  studentId: 'student-123',
  tenantId: 'tenant-123',
  targetDate: '2024-01-15',  // daily로 이동 시 필수
});
```

---

### `deletePlanWithLogging`

플랜 삭제 (소프트 삭제 + 이벤트 로깅)

```typescript
import { deletePlanWithLogging } from '@/lib/domains/admin-plan/actions';

const result = await deletePlanWithLogging({
  planId: 'plan-123',
  studentId: 'student-123',
  tenantId: 'tenant-123',
  reason: '사용자 요청',  // 선택적
});
```

---

## 이벤트 로깅 (Plan Events)

### 자동 로깅

모든 플랜 변경 작업은 자동으로 `plan_events` 테이블에 로깅됩니다.

**이벤트 타입:**
- `plan_created` - 플랜 생성
- `plan_updated` - 플랜 수정
- `plan_completed` - 플랜 완료
- `plan_deleted` - 플랜 삭제
- `container_moved` - 컨테이너 이동
- `volume_adjusted` - 볼륨 조정
- `volume_redistributed` - 볼륨 재분배
- `plan_carryover` - 플랜 이월
- `timer_started` - 타이머 시작
- `timer_completed` - 타이머 완료

### 헬퍼 함수

```typescript
import {
  logPlanCreated,
  logPlanCompleted,
  logVolumeAdjusted,
  logContainerMoved,
  logPlanDeleted,
} from '@/lib/domains/admin-plan/actions';
```

---

## 공통 타입

### AdminPlanResponse

모든 액션의 응답 타입

```typescript
interface AdminPlanResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  event_id?: string;  // 생성된 이벤트 ID (있는 경우)
}
```

### ContainerType

```typescript
type ContainerType = 'daily' | 'weekly' | 'unfinished';
```

### PlanStatus

```typescript
type PlanStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';
```

---

## 경로 재검증

모든 플랜 변경 작업 후 자동 재검증되는 경로:
- `/admin/students/[studentId]/plans`
- `/today`
- `/plan`

---

## 사용 예시

### 플랜 수정 후 새로고침

```typescript
'use client';

import { adminUpdateStudentPlan } from '@/lib/domains/admin-plan/actions';
import { useRouter } from 'next/navigation';

function EditPlanForm({ planId, studentId }) {
  const router = useRouter();

  const handleSubmit = async (formData) => {
    const result = await adminUpdateStudentPlan(planId, studentId, {
      custom_title: formData.title,
      plan_date: formData.date,
      status: formData.status,
    });

    if (result.success) {
      router.refresh(); // 자동 재검증과 함께 UI 갱신
    } else {
      console.error(result.error);
    }
  };

  return /* ... */;
}
```

### 플랜 복사 (여러 날짜로)

```typescript
const result = await copyPlansToDate({
  sourcePlanIds: ['plan-1'],
  targetDates: ['2024-01-20', '2024-01-21', '2024-01-22'],
  studentId: 'student-123',
});

// result.data.copiedCount === 3
```

---

**최종 업데이트**: 2026-01-05
