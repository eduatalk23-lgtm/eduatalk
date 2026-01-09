# 관리자 플래너 생성 후 네비게이션 개선

## 📋 작업 개요

**작업 일자**: 2026-01-15  
**목적**: 관리자 영역에서 플래너 생성 후 플랜 관리 화면으로 이동하고, 플랜 그룹 상세 페이지에서 플래너 페이지로 돌아가는 네비게이션 흐름 개선

## 🔍 문제 분석

### 발견된 문제점

1. **플래너 생성 후 네비게이션 불일치**
   - 플래너 생성 후 `AdminPlanCreationWizard7Step`의 `onSuccess`에서 `handleRefresh()`만 호출
   - 플랜 관리 화면에 머물러야 하는데, Step 7 완료 시 플랜 그룹 상세 페이지로 이동하는 로직이 있었음
   - 실제로는 `AdminPlanManagement.tsx`의 `onSuccess` 콜백이 이미 올바르게 구현되어 있었음

2. **플랜 그룹 상세 페이지 네비게이션 경로 부재**
   - `AdminPlanGroupDetailPage`에서 뒤로가기 버튼이 `/admin/dashboard`로만 이동
   - 플래너 컨텍스트(`planner_id`)가 URL에 포함되지 않아 플래너 페이지로 돌아갈 수 없음
   - 캠프 모드와 일반 모드의 네비게이션 로직이 분산되어 있음

3. **중복 코드 및 최적화 필요**
   - 네비게이션 로직이 여러 곳에 분산되어 있음
   - 플래너 컨텍스트 전달 방식이 일관되지 않음

## ✅ 해결 방안

### 1. 네비게이션 유틸리티 함수 생성

**파일**: `lib/navigation/adminPlanNavigation.ts` (신규 생성)

**구현 내용**:
- `PlanGroupNavigationContext` 인터페이스 정의
- `getAdminPlanGroupBackPath()`: 플랜 그룹 상세 페이지에서 뒤로가기 경로 생성
- `getAdminPlanGroupBackLabel()`: 뒤로가기 버튼 텍스트 생성
- `getPlannerPagePath()`: 플래너 페이지 경로 생성

**우선순위**:
1. 플래너가 연결된 경우 → 플래너 페이지로 이동
2. 캠프 모드인 경우 → 캠프 템플릿 참여자 목록으로 이동
3. 기본값 → 대시보드로 이동

### 2. 플랜 그룹 상세 페이지 네비게이션 개선

**파일**: `app/(admin)/admin/plan-groups/[id]/page.tsx`

**변경 사항**:
- 네비게이션 유틸리티 함수 import
- `planner_id`를 확인하여 플래너 페이지로 돌아가는 경로 제공
- 뒤로가기 버튼 로직 개선:
  - `planner_id`가 있으면 → `/admin/students/[studentId]/plans/[plannerId]`로 이동
  - `camp_template_id`가 있으면 → 캠프 템플릿 참여자 목록으로 이동
  - 그 외 → `/admin/dashboard`로 이동

**코드 변경**:
```typescript
// 네비게이션 경로 및 라벨 생성
const backPath = getAdminPlanGroupBackPath({
  groupId: id,
  studentId: group.student_id,
  plannerId: group.planner_id,
  campTemplateId: group.camp_template_id,
  isCampMode,
});
const backLabel = getAdminPlanGroupBackLabel({
  groupId: id,
  studentId: group.student_id,
  plannerId: group.planner_id,
  campTemplateId: group.camp_template_id,
  isCampMode,
});
```

### 3. AdminPlanCreationWizard7Step의 onSuccess 로직 확인

**파일**: `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx`

**확인 결과**:
- `onSuccess` 콜백이 이미 올바르게 구현되어 있음
- 플랜 관리 화면에 머물도록 `handleRefresh()`만 호출
- 플랜 그룹 상세 페이지로 이동하는 로직이 없음

**현재 구현**:
```typescript
onSuccess={(groupId, generateAI) => {
  setShowCreateWizard(false);
  handleRefresh();
  // AI 생성 옵션이 선택된 경우, 새로 생성된 그룹으로 AI 모달 열기
  if (generateAI) {
    setNewGroupIdForAI(groupId);
    setShowAIPlanModal(true);
  }
}}
```

### 4. useStep7Completion 확인

**파일**: `app/(student)/plan/new-group/_components/hooks/useStep7Completion.ts`

**확인 결과**:
- `AdminPlanCreationWizard7Step`은 `useStep7Completion`을 사용하지 않음
- `useStep7Completion`은 학생 모드 위저드(`PlanGroupWizard`)에서만 사용됨
- 관리자 continue 모드(캠프 템플릿 관련)에서 플랜 그룹 상세 페이지로 이동하는 로직은 유지 (별도 플로우)

## 📊 데이터베이스 확인

**확인 쿼리**:
```sql
SELECT id, planner_id, student_id, name, status, created_at 
FROM plan_groups 
WHERE planner_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 5;
```

**확인 결과**:
- `planner_id`가 올바르게 저장되고 있음
- 최근 생성된 플랜 그룹들이 플래너와 올바르게 연결되어 있음

## 🔄 네비게이션 흐름

### 개선 전

```
플래너 선택 페이지
  ↓ (플래너 선택)
플랜 관리 화면
  ↓ (플랜 생성 위저드 실행)
Step 7 완료
  ↓ (onSuccess)
플랜 관리 화면 (새로고침)
  ↓ (플랜 그룹 클릭)
플랜 그룹 상세 페이지
  ↓ (뒤로가기)
대시보드 (❌ 플래너 페이지로 돌아갈 수 없음)
```

### 개선 후

```
플래너 선택 페이지
  ↓ (플래너 선택)
플랜 관리 화면
  ↓ (플랜 생성 위저드 실행)
Step 7 완료
  ↓ (onSuccess)
플랜 관리 화면 (새로고침) ✅
  ↓ (플랜 그룹 클릭)
플랜 그룹 상세 페이지
  ↓ (뒤로가기)
플래너 페이지 ✅ (planner_id 기반)
```

## 📁 변경된 파일 목록

### 신규 생성
- `lib/navigation/adminPlanNavigation.ts` - 네비게이션 유틸리티 함수

### 수정
- `app/(admin)/admin/plan-groups/[id]/page.tsx` - 뒤로가기 버튼 로직 개선

### 확인 (변경 없음)
- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx` - 이미 올바르게 구현됨
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx` - 별도 수정 불필요

## 🧪 테스트 시나리오

### 1. 플래너 생성 후 플랜 관리 화면 유지

**시나리오**:
1. 플래너 선택 페이지에서 플래너 선택
2. 플랜 관리 화면에서 플랜 생성 위저드 실행
3. Step 7 완료

**기대 결과**:
- 플랜 관리 화면에 머물러야 함
- 새로 생성된 플랜 그룹이 목록에 표시되어야 함
- 플랜 그룹 상세 페이지로 자동 이동하지 않아야 함

**실제 결과**: ✅ 통과

### 2. 플랜 그룹 상세 페이지에서 플래너로 돌아가기

**시나리오**:
1. 플랜 그룹 상세 페이지 접근 (planner_id가 있는 경우)
2. 뒤로가기 버튼 클릭

**기대 결과**:
- 플래너 페이지(`/admin/students/[studentId]/plans/[plannerId]`)로 이동해야 함
- 버튼 텍스트가 "플래너로 돌아가기"로 표시되어야 함

**실제 결과**: ✅ 통과

### 3. 캠프 모드 네비게이션

**시나리오**:
1. 캠프 템플릿 기반 플랜 그룹 상세 페이지 접근
2. 뒤로가기 버튼 클릭

**기대 결과**:
- 캠프 템플릿 참여자 목록으로 이동해야 함
- 버튼 텍스트가 "참여자 목록으로"로 표시되어야 함

**실제 결과**: ✅ 통과

### 4. 플래너가 없는 플랜 그룹

**시나리오**:
1. 플래너가 연결되지 않은 플랜 그룹 상세 페이지 접근
2. 뒤로가기 버튼 클릭

**기대 결과**:
- 대시보드로 이동해야 함
- 버튼 텍스트가 "대시보드로"로 표시되어야 함

**실제 결과**: ✅ 통과

## 🛡 사이드 이펙트 방지

### 기존 기능 보존

1. **학생 모드 위저드**: 네비게이션 로직 변경 없음
2. **캠프 모드 네비게이션**: 기존 로직 유지 (우선순위에 포함)
3. **관리자 continue 모드**: `useStep7Completion`의 관리자 continue 모드는 캠프 템플릿 관련이므로 유지

### 점진적 개선

1. 네비게이션 유틸리티 함수를 먼저 생성
2. 기존 코드를 단계적으로 리팩토링
3. 타입 안전성 보장 (TypeScript 타입 정의 추가)

### 타입 안전성

- `PlanGroupNavigationContext` 인터페이스로 타입 정의
- null 체크 및 옵셔널 체이닝 사용
- TypeScript strict mode 준수

## 📝 코드 예시

### 네비게이션 유틸리티 사용 예시

```typescript
import {
  getAdminPlanGroupBackPath,
  getAdminPlanGroupBackLabel,
} from "@/lib/navigation/adminPlanNavigation";

// 플랜 그룹 상세 페이지에서
const backPath = getAdminPlanGroupBackPath({
  groupId: id,
  studentId: group.student_id,
  plannerId: group.planner_id,
  campTemplateId: group.camp_template_id,
  isCampMode,
});

const backLabel = getAdminPlanGroupBackLabel({
  groupId: id,
  studentId: group.student_id,
  plannerId: group.planner_id,
  campTemplateId: group.camp_template_id,
  isCampMode,
});

<Link href={backPath}>
  {backLabel}
</Link>
```

## 🎯 개선 효과

1. **사용자 경험 개선**
   - 플래너 컨텍스트를 유지하면서 네비게이션 가능
   - 직관적인 뒤로가기 경로 제공

2. **코드 품질 향상**
   - 네비게이션 로직 중앙화
   - 중복 코드 제거
   - 타입 안전성 보장

3. **유지보수성 향상**
   - 네비게이션 로직 변경 시 한 곳만 수정
   - 일관된 네비게이션 패턴 적용

## 🔮 향후 개선 사항

1. **플래너 페이지 경로 생성 함수 활용**
   - `getPlannerPagePath()` 함수를 더 많은 곳에서 활용
   - 날짜 쿼리 파라미터 처리 개선

2. **네비게이션 히스토리 관리**
   - 브라우저 히스토리를 활용한 뒤로가기 개선
   - 컨텍스트 기반 네비게이션 히스토리 추적

3. **접근성 개선**
   - ARIA 레이블 추가
   - 키보드 네비게이션 지원

## 📚 관련 문서

- [관리자 플래너 위저드 상속 분석](./2026-01-15-admin-planner-wizard-inheritance-analysis.md)
- [관리자 플래너 플랜 관리 플로우 분석](./2026-01-15-admin-planner-plan-management-flow-analysis.md)

## ✅ 작업 완료 체크리스트

- [x] 네비게이션 유틸리티 함수 생성
- [x] `AdminPlanGroupDetailPage` 네비게이션 개선
- [x] `AdminPlanCreationWizard7Step`의 `onSuccess` 로직 확인
- [x] 중복 코드 제거 및 최적화
- [x] 데이터베이스 확인
- [x] 문서 업데이트

---

## 🔧 추가 수정 (2026-01-08)

### 발견된 추가 문제

**문제**: 플래너 선택 페이지에서 새 플래너 생성 후 플랜 관리 페이지로 이동했다가 다시 플래너 선택 페이지로 리다이렉트되는 버그

**원인 분석**:

`PlannerManagement.tsx`의 `handlePlannerSaved` 함수에서 race condition 발생:

```typescript
// 수정 전 (문제 코드)
const handlePlannerSaved = (planner: Planner) => {
  setCreateModalOpen(false);
  setEditPlanner(undefined);
  setDuplicatePlanner(undefined);
  loadPlanners();                  // ← 비동기 함수, await 없이 호출
  onPlannerSelect?.(planner);      // ← router.push 호출
};
```

**문제 흐름**:
1. `loadPlanners()` 비동기 실행 시작
2. `onPlannerSelect()` → `router.push()`로 새 페이지 이동 시작
3. 이동 중에 `loadPlanners()` 완료 → `setPlanners()` 상태 변경
4. 상태 변경이 라우팅에 간섭하여 리다이렉트 발생

### 해결 방법

`onPlannerSelect`가 전달되면 다른 페이지로 이동하므로 목록 갱신이 불필요. 조건부 분기로 경합 조건 방지:

```typescript
// 수정 후
const handlePlannerSaved = (planner: Planner) => {
  setCreateModalOpen(false);
  setEditPlanner(undefined);
  setDuplicatePlanner(undefined);

  // onPlannerSelect가 있으면 다른 페이지로 이동하므로 목록 갱신 불필요
  // 라우팅과 상태 변경의 경합 조건(race condition) 방지
  if (onPlannerSelect) {
    onPlannerSelect(planner);
  } else {
    // onPlannerSelect가 없으면 현재 페이지에 남아있으므로 목록 갱신
    loadPlanners();
  }
};
```

### 수정된 파일

- `app/(admin)/admin/students/[id]/plans/_components/PlannerManagement.tsx` (498-512줄)

### 테스트 시나리오

1. **플래너 생성**: `/admin/students/[id]/plans`에서 "새 플래너" 클릭 → 생성 완료 → 플랜 관리 페이지로 이동 확인 (리다이렉트 없어야 함)
2. **플래너 수정**: 플래너 수정 후 해당 플래너 페이지로 정상 이동 확인
3. **플래너 복제**: 복제 후 새 플래너 페이지로 정상 이동 확인

---

**작업 완료 일자**: 2026-01-15
**추가 수정 일자**: 2026-01-08
**작업자**: AI Assistant
**검토 상태**: 완료

