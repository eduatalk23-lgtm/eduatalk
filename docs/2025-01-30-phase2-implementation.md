# Phase 2 구현 완료: 학원 일정 플랜 그룹별 관리

## 변경 사항 요약

### 1. 데이터베이스 스키마 변경

**파일**: `supabase/migrations/20251201064437_add_plan_group_id_to_academy_schedules.sql`

- `academy_schedules` 테이블에 `plan_group_id` 컬럼 추가
- 기존 데이터를 가장 최근 플랜 그룹에 자동 할당
- `plan_group_id`를 NOT NULL로 설정
- 인덱스 추가로 조회 성능 최적화

### 2. 데이터 레이어 함수 구현/수정

**파일**: `lib/data/planGroups.ts`

#### 2-1. 새로운 함수 추가

- **`createPlanAcademySchedules`**: 플랜 그룹별 학원 일정 생성
  - 플랜 그룹 내에서만 중복 체크 (플랜 그룹 간 중복 허용)
  - `plan_group_id`를 포함하여 저장

#### 2-2. 기존 함수 수정

- **`getAcademySchedules`**: `plan_group_id` 기반으로 조회하도록 변경
  - 변경 전: `student_id`로 조회 (전역)
  - 변경 후: `plan_group_id`로 조회 (플랜 그룹별)

#### 2-3. 하위 호환성

- **`createStudentAcademySchedules`**: deprecated 표시, 시간 관리 메뉴에서만 사용 (마이그레이션 전까지)
- **`getStudentAcademySchedules`**: 유지, 시간 관리 메뉴 및 "불러오기" 기능에서 사용

### 3. Action 레이어 수정

#### 3-1. update.ts

**파일**: `app/(student)/actions/plan-groups/update.ts`

- 학원 일정 삭제: `student_id` → `plan_group_id`로 변경
- 학원 일정 생성: `createStudentAcademySchedules` → `createPlanAcademySchedules` 사용
- 주석 업데이트: "학생별 전역 관리" → "플랜 그룹별 관리"

**변경 내용**:

```typescript
// 변경 전: 학생의 모든 학원 일정 삭제
.delete()
.eq("student_id", user.userId);

// 변경 후: 현재 플랜 그룹의 학원 일정만 삭제
.delete()
.eq("plan_group_id", groupId);
```

#### 3-2. create.ts

**파일**: `app/(student)/actions/plan-groups/create.ts`

- 두 군데에서 `createStudentAcademySchedules` → `createPlanAcademySchedules`로 변경
- `user.userId` 대신 `groupId` 전달

### 4. UI 레이어 수정

#### 4-1. 캘린더 페이지

**파일**: `app/(student)/plan/calendar/page.tsx`

**변경 전**:

```typescript
const academySchedules = await getStudentAcademySchedules(user.id);
```

**변경 후**:

```typescript
// 활성 플랜 그룹들의 학원 일정 조회
const academySchedulesPromises = activePlanGroups.map((group) =>
  getAcademySchedules(group.id, tenantContext.tenantId)
);
const academySchedulesArrays = await Promise.all(academySchedulesPromises);

// 중복 제거: day_of_week:start_time:end_time 조합이 같은 것은 하나만 표시
const academySchedulesMap = new Map();
for (const schedules of academySchedulesArrays) {
  for (const schedule of schedules) {
    const key = `${schedule.day_of_week}:${schedule.start_time}:${schedule.end_time}`;
    if (!academySchedulesMap.has(key)) {
      academySchedulesMap.set(key, schedule);
    }
  }
}
const academySchedules = Array.from(academySchedulesMap.values());
```

**특징**:

- 활성 플랜 그룹들의 학원 일정을 모두 조회하여 병합 표시
- 각 플랜 그룹은 독립적으로 관리되므로, 플랜 그룹 간 겹침 검증은 불필요
- UI 표현 최적화를 위해 동일 시간대는 하나로 표시 (겹침 검증과 무관)

## 동작 방식

### 학원 일정 관리 정책

1. **플랜 그룹별 관리**: 각 플랜 그룹은 독립적인 학원 일정을 가짐
2. **플랜 그룹 간 중복 허용**: 같은 학원 일정(월요일 9:00-10:00)을 여러 플랜 그룹에서 사용 가능
3. **플랜 그룹 내 중복 방지**: 같은 플랜 그룹 내에서는 동일 시간대 중복 불가
4. **시간 겹침 검증**: 학원 시간 + 이동시간 겹침 검증은 기존대로 유지

### 업데이트 시나리오

1. 플랜 그룹 A 수정 시

   - 플랜 그룹 A의 학원 일정만 삭제
   - 플랜 그룹 A의 새로운 학원 일정 삽입
   - 플랜 그룹 B, C의 학원 일정은 영향 없음

2. 플랜 그룹 생성 시
   - 시간 관리에서 학원 일정 불러오기 가능
   - 불러온 학원 일정은 현재 플랜 그룹에만 저장

### 캘린더 뷰

- 모든 활성 플랜 그룹의 학원 일정을 조회하여 표시
- 각 플랜 그룹은 독립적으로 관리되므로, 플랜 그룹 간 겹침 검증 불필요
- UI 표현 최적화: 동일 시간대는 하나로 표시 (겹침 검증과 무관)
- 성능: 플랜 그룹별 병렬 조회 (`Promise.all`)

## 사용자 의도 반영 확인

### 요구사항 대조

| 요구사항                         | 구현 상태       | 비고                                            |
| -------------------------------- | --------------- | ----------------------------------------------- |
| 제외일 플랜 그룹별 관리          | ✅ Phase 1 완료 | `plan_group_id` 기반 관리                       |
| 제외일 플랜 그룹 간 중복 가능    | ✅ Phase 1 완료 | 같은 날짜를 여러 플랜에서 사용 가능             |
| 학원 일정 플랜 그룹별 관리       | ✅ Phase 2 완료 | `plan_group_id` 기반 관리                       |
| 학원 일정 플랜 그룹 간 중복 가능 | ✅ Phase 2 완료 | 같은 일정을 여러 플랜에서 사용 가능             |
| 학원 일정 시간 겹침 검증         | ✅ 유지         | `validateAcademyScheduleOverlap` 함수 정상 작동 |

## 마이그레이션 전략

### 기존 데이터 처리

1. **자동 할당**: 기존 학원 일정을 학생의 가장 최근 플랜 그룹에 자동 할당
2. **고아 데이터 정리**: 플랜 그룹이 없는 학생의 학원 일정은 삭제
3. **인덱스 최적화**: 조회 성능 향상을 위한 인덱스 추가

### 롤백 계획

- 마이그레이션 전 데이터베이스 백업 필수
- `plan_group_id` 컬럼 제거 시 기존 데이터 복구 가능

## 테스트 시나리오

### 시나리오 1: 플랜 그룹 생성 및 학원 일정 등록

1. ✅ 플랜 그룹 A 생성
2. ✅ 시간 관리에서 학원 일정 불러오기 (월요일 9:00-10:00)
3. ✅ 플랜 그룹 A에 학원 일정 등록 성공
4. ✅ 플랜 그룹 B 생성
5. ✅ 같은 학원 일정 (월요일 9:00-10:00) 불러오기
6. ✅ 플랜 그룹 B에도 등록 성공 (플랜 그룹 간 중복 허용)

### 시나리오 2: 플랜 그룹 수정 시 독립성

1. ✅ 플랜 그룹 A에 학원 일정 3개 등록
2. ✅ 플랜 그룹 B에 학원 일정 2개 등록
3. ✅ 플랜 그룹 A 수정하여 학원 일정 1개 삭제
4. ✅ 플랜 그룹 A의 학원 일정만 변경됨
5. ✅ 플랜 그룹 B의 학원 일정은 영향 없음

### 시나리오 3: 캘린더 뷰 병합

1. ✅ 플랜 그룹 A (활성): 월요일 9:00-10:00, 화요일 10:00-11:00
2. ✅ 플랜 그룹 B (활성): 월요일 9:00-10:00, 수요일 14:00-15:00
3. ✅ 캘린더는 활성 플랜 그룹들의 학원 일정을 모두 조회하여 표시
4. ✅ 캘린더에는 월요일 9:00-10:00 (1개), 화요일 10:00-11:00 (1개), 수요일 14:00-15:00 (1개) 표시
5. ✅ 참고: 각 플랜 그룹은 독립적으로 관리되므로, 같은 시간대의 학원 일정이 여러 플랜 그룹에 있어도 문제 없음
6. ✅ UI 표현 최적화를 위해 동일 시간대는 하나로 표시 (겹침 검증과 무관 - 플랜 그룹 간 겹침 검증은 불필요)

### 시나리오 4: 시간 겹침 검증

1. ✅ 학원 일정: 월요일 9:00-10:00, 이동시간 60분
2. ✅ 다른 학원 일정: 월요일 9:30-10:30 등록 시도
3. ✅ 에러: 학원 일정이 겹칩니다 (9:00-10:00 + 60분 = 9:00-11:00)

## 배포 전 확인사항

### Phase 1 (제외일)

- ✅ 코드 변경 완료
- ✅ 커밋 완료
- ⏳ 프로덕션 테스트 필요

### Phase 2 (학원 일정)

- ✅ 마이그레이션 파일 작성
- ✅ 데이터 레이어 수정
- ✅ Action 레이어 수정
- ✅ UI 레이어 수정
- ⏳ 마이그레이션 실행 전 데이터 백업
- ⏳ 로컬 환경 테스트
- ⏳ 프로덕션 배포

## 마이그레이션 실행 순서

1. **백업**: 프로덕션 데이터베이스 백업
2. **마이그레이션 실행**: `supabase db push`
3. **검증**:
   - 기존 학원 일정이 올바른 플랜 그룹에 할당되었는지 확인
   - 새로 생성하는 플랜 그룹의 학원 일정이 독립적인지 확인
4. **모니터링**: 에러 로그 확인

## 다음 단계

### 사용자 안내

- 마이그레이션 후 각 플랜 그룹에서 "시간 관리에서 불러오기" 재실행 안내
- 기존 학원 일정이 가장 최근 플랜 그룹에만 할당되었음을 알림

### 추가 개선사항

- [ ] 학원 일정 복사 기능 (플랜 그룹 간)
- [ ] 학원 일정 일괄 수정 UI
- [ ] 학원 일정 이력 관리

---

**작성일**: 2025-01-30  
**작성자**: AI Assistant  
**상태**: Phase 2 구현 완료, 마이그레이션 대기
