# Today 페이지 버그 수정

## 날짜
2025-01-22

## 수정한 문제

### 1. 뷰 전환마다 로딩이 생기는 문제

**문제**: 단일 뷰와 일일 뷰를 전환할 때마다 로딩 화면이 나타남

**원인**: 
- `SinglePlanView`와 `DailyPlanListView`가 각각 독립적으로 데이터를 로딩
- 뷰 전환 시 컴포넌트가 언마운트/마운트되면서 다시 로딩 상태가 됨

**해결 방법**:
- 데이터 로딩을 상위 컴포넌트인 `PlanViewContainer`로 이동
- 데이터를 한 번만 로딩하고 하위 컴포넌트에 props로 전달
- 뷰 전환 시 데이터는 유지되고 UI만 변경됨

**변경 사항**:
- `PlanViewContainer.tsx`: 데이터 로딩 로직 추가
- `SinglePlanView.tsx`: 데이터 로딩 제거, props로 받도록 변경
- `DailyPlanListView.tsx`: 데이터 로딩 제거, props로 받도록 변경

### 2. tenant_id null constraint 에러

**문제**: 
```
null value in column "tenant_id" of relation "student_content_progress" violates not-null constraint
```

**원인**: 
- `togglePlanCompletion` 액션에서 `student_content_progress`에 insert할 때 `tenant_id`가 없음
- 테이블에 `tenant_id`가 not-null 제약이 있음

**해결 방법**:
- `student` 테이블에서 `tenant_id` 조회
- insert 시 `tenant_id` 포함
- `tenant_id`가 없으면 에러 반환

**변경 사항**:
- `app/actions/today.ts`: `togglePlanCompletion` 함수에 `tenant_id` 조회 및 설정 로직 추가

### 3. 같은 학습 범위를 가진 블록 번호가 여러개 나오는 문제

**문제**: 같은 학습 범위(`planned_start_page_or_time`, `planned_end_page_or_time`)를 가진 플랜이 여러 블록에 걸쳐 있을 때 중복으로 표시됨

**원인**: 
- 같은 `plan_number`를 가진 플랜들이 여러 블록에 걸쳐 있을 수 있음
- 각 블록이 개별적으로 표시되어 중복처럼 보임

**해결 방법**:
- 같은 범위를 가진 플랜이 여러 개인지 확인
- 중복인 경우 블록 개수를 표시하여 명확하게 표시

**변경 사항**:
- `PlanCard.tsx`: 플랜 목록 표시 시 같은 범위를 가진 플랜 개수 표시 추가

## 변경된 파일

1. `app/(student)/today/_components/PlanViewContainer.tsx`
   - 데이터 로딩 로직 추가
   - 하위 컴포넌트에 데이터 전달

2. `app/(student)/today/_components/SinglePlanView.tsx`
   - 데이터 로딩 제거
   - props로 데이터 받도록 변경

3. `app/(student)/today/_components/DailyPlanListView.tsx`
   - 데이터 로딩 제거
   - props로 데이터 받도록 변경

4. `app/actions/today.ts`
   - `togglePlanCompletion`에 `tenant_id` 조회 및 설정 추가

5. `app/(student)/today/_components/PlanCard.tsx`
   - 중복 블록 표시 개선 (블록 개수 표시)

## 테스트 체크리스트

- [x] 단일 뷰 ↔ 일일 뷰 전환 시 로딩 없이 즉시 전환
- [x] 완료/미완료 토글 시 `tenant_id` 에러 없음
- [x] 같은 범위를 가진 블록이 여러 개일 때 명확하게 표시

## 참고사항

- 데이터 로딩은 `PlanViewContainer`에서 1초마다 자동 갱신됨 (타이머 업데이트용)
- 뷰 전환 시 데이터는 유지되므로 빠른 전환이 가능
- `tenant_id`는 필수이므로 없으면 에러를 반환하도록 처리

