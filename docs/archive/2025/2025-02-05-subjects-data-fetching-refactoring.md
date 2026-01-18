# 교과/과목 관리 모듈 데이터 페칭 리팩토링

**작업 일시**: 2025-02-05  
**작업 범위**: `app/(admin)/admin/subjects` 모듈  
**목적**: 클라이언트 사이드 워터폴 제거 및 서버 사이드 데이터 페칭으로 성능 개선

---

## 📋 작업 개요

### 문제점
- `SubjectTable.tsx`에서 `useEffect`를 사용하여 Server Actions를 호출하는 클라이언트 사이드 워터폴 발생
- 초기 로딩 시 "로딩 중..." 메시지로 인한 깜빡임 현상
- 불필요한 클라이언트 사이드 데이터 처리

### 해결 방법
- 서버 컴포넌트에서 초기 데이터를 직접 페칭하여 props로 전달
- 클라이언트 컴포넌트에서 초기 로딩 상태 제거
- CRUD 작업 후 `router.refresh()`를 사용하여 서버 컴포넌트 재렌더링

---

## 🔧 변경 사항

### 1. `app/(admin)/admin/subjects/page.tsx`

**변경 전**: 클라이언트 컴포넌트 (`"use client"`)
- `useEffect`로 `getCurriculumRevisionsAction` 호출
- 클라이언트 사이드 상태 관리

**변경 후**: 서버 컴포넌트
- `getCurriculumRevisions` 직접 호출 (서버 사이드)
- 첫 번째 개정교육과정의 초기 데이터 준비:
  - 교과 그룹 (`getSubjectGroups`)
  - 과목구분 (`getSubjectTypes`)
  - 각 교과 그룹의 과목 (`getSubjectsByGroup`)
- 초기 데이터를 `SubjectsPageClient`에 props로 전달

```typescript
export default async function SubjectsPage() {
  const revisions = await getCurriculumRevisions();
  // 첫 번째 개정교육과정의 초기 데이터 준비
  const initialRevisionId = sortedRevisions.length > 0 ? sortedRevisions[0].id : null;
  
  if (initialRevisionId) {
    const [groups, subjectTypes] = await Promise.all([
      getSubjectGroups(initialRevisionId),
      getSubjectTypes(initialRevisionId),
    ]);
    // 각 교과 그룹의 과목 조회
    // ...
  }
  
  return <SubjectsPageClient {...initialData} />;
}
```

### 2. `app/(admin)/admin/subjects/_components/SubjectsPageClient.tsx` (신규)

**역할**: 클라이언트 사이드 인터랙션 처리
- Excel 다운로드/업로드 기능
- 개정교육과정 선택 상태 관리
- 초기 데이터를 하위 컴포넌트에 전달

### 3. `app/(admin)/admin/subjects/_components/SubjectTable.tsx`

**주요 변경사항**:

1. **Props 추가**:
   ```typescript
   type SubjectTableProps = {
     subjectGroupId: string;
     curriculumRevisionId: string;
     initialSubjects?: Subject[];
     initialSubjectTypes?: SubjectType[];
   };
   ```

2. **초기 로딩 상태 제거**:
   - `loading` 상태를 `false`로 초기화 (초기 데이터가 있으면 로딩 불필요)
   - `initialSubjects`와 `initialSubjectTypes`를 props로 받아 초기 상태 설정

3. **useEffect 로직 개선**:
   - 초기 데이터가 제공되지 않은 경우에만 서버 액션 호출
   - 초기 데이터가 있지만 다른 그룹을 선택한 경우에만 서버 액션 호출
   - `useCallback`으로 `loadData` 함수 메모이제이션

4. **CRUD 작업 후 `router.refresh()` 사용**:
   ```typescript
   async function handleDelete(id: string, name: string) {
     await deleteSubject(id);
     router.refresh(); // 서버 컴포넌트 재렌더링
   }
   
   function handleSuccess() {
     router.refresh(); // 서버 컴포넌트 재렌더링
   }
   ```

### 4. `app/(admin)/admin/subjects/_components/SubjectManagementPanel.tsx`

**변경사항**:
- `initialSubjects`와 `initialSubjectTypes` props 추가
- `SubjectTable`에 초기 데이터 전달

### 5. `app/(admin)/admin/subjects/_components/CurriculumRevisionTabs.tsx`

**변경사항**:
- `onRefresh` prop 제거 (더 이상 필요 없음)
- `initialGroups`, `initialSubjectsMap`, `initialSubjectTypes` props 추가
- `handleRevisionSuccess`에서 `router.refresh()` 사용

### 6. `app/(admin)/admin/subjects/_components/SubjectGroupSidebar.tsx`

**변경사항**:
- `initialGroups` prop 추가
- 초기 데이터가 있으면 서버 액션 호출 생략
- CRUD 작업 후 `router.refresh()` 사용

---

## ✅ 개선 효과

### 성능 개선
1. **초기 로딩 시간 단축**: 서버 사이드에서 데이터를 병렬로 페칭하여 클라이언트 사이드 워터폴 제거
2. **로딩 깜빡임 제거**: 초기 데이터를 props로 받아 즉시 렌더링
3. **불필요한 클라이언트 사이드 처리 제거**: 서버에서 데이터 처리 완료 후 전달

### 코드 품질 개선
1. **명확한 데이터 흐름**: 서버 컴포넌트 → 클라이언트 컴포넌트로 단방향 데이터 흐름
2. **타입 안전성**: 초기 데이터를 props로 받아 타입 안전성 향상
3. **유지보수성**: 서버 사이드 데이터 페칭 로직이 명확하게 분리됨

---

## 🔍 주의사항

### 초기 데이터 범위
- 현재 구현은 **첫 번째 개정교육과정**의 초기 데이터만 서버에서 페칭
- 다른 개정교육과정을 선택하거나 다른 교과 그룹을 선택하면 클라이언트 사이드에서 서버 액션 호출
- 이는 성능과 사용자 경험의 균형을 위한 설계 결정

### 향후 개선 가능성
1. **모든 개정교육과정의 초기 데이터 페칭**: 사용자가 자주 전환하는 경우
2. **선택적 데이터 페칭**: 사용자가 선택한 개정교육과정의 데이터만 페칭
3. **React Query 통합**: 클라이언트 사이드 캐싱 및 상태 관리 개선

---

## 📝 관련 파일

### 수정된 파일
- `app/(admin)/admin/subjects/page.tsx`
- `app/(admin)/admin/subjects/_components/SubjectTable.tsx`
- `app/(admin)/admin/subjects/_components/SubjectManagementPanel.tsx`
- `app/(admin)/admin/subjects/_components/CurriculumRevisionTabs.tsx`
- `app/(admin)/admin/subjects/_components/SubjectGroupSidebar.tsx`

### 신규 파일
- `app/(admin)/admin/subjects/_components/SubjectsPageClient.tsx`

### 사용된 라이브러리 함수
- `lib/data/contentMetadata.ts`: `getCurriculumRevisions`
- `lib/data/subjects.ts`: `getSubjectGroups`, `getSubjectsByGroup`, `getSubjectTypes`

---

## ✅ 체크리스트

- [x] 서버 컴포넌트에서 초기 데이터 페칭
- [x] 클라이언트 컴포넌트에서 초기 로딩 상태 제거
- [x] CRUD 작업 후 `router.refresh()` 사용
- [x] TypeScript 타입 안전성 유지
- [x] 린터 에러 없음
- [x] 기존 기능 정상 동작 확인 필요 (테스트 권장)

---

**작업 완료**: 2025-02-05

