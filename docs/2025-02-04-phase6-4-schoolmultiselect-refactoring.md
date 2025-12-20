# Phase 6.4: SchoolMultiSelect 리팩토링 완료

**작업일**: 2025-02-04  
**작업 범위**: SchoolMultiSelect 컴포넌트 로직 분리

---

## 작업 개요

4,600+ tokens로 비대했던 `components/ui/SchoolMultiSelect.tsx` 파일을 UI 렌더링 로직과 비즈니스 로직으로 분리하여 가독성과 유지보수성을 개선했습니다.

---

## 리팩토링 결과

### 변경 전
- 단일 파일에 모든 로직 집중 (545줄)
- 상태 관리, 검색, 선택 관리, 이벤트 처리 등 모든 로직이 한 곳에 섞여 있음
- 가독성 및 유지보수성 낮음

### 변경 후
- 로직과 UI가 명확히 분리된 구조 (2개 파일)
- 커스텀 훅으로 비즈니스 로직 분리
- 컴포넌트는 UI 렌더링에만 집중

---

## 새로운 파일 구조

```
components/ui/
├── SchoolMultiSelect.tsx (UI 컴포넌트)
└── hooks/
    └── useSchoolMultiSelectLogic.ts (커스텀 훅 - 비즈니스 로직)
```

---

## 세부 작업 내용

### 1. 커스텀 훅 분리 (`useSchoolMultiSelectLogic.ts`)

**위치**: `components/ui/hooks/useSchoolMultiSelectLogic.ts`

**분리된 로직**:

#### 상태 관리
- `isSearchMode`, `isOpen`, `searchQuery`, `schools`, `loading`, `selectedSchools`
- `canAddMore` (계산된 값)

#### refs
- `containerRef`: 외부 클릭 감지용
- `searchInputRef`: 검색 입력 필드 포커스용
- `previousValueRef`: value 변경 추적용 (중복 조회 방지)

#### useEffect 훅
1. **외부 클릭 감지**: 드롭다운 외부 클릭 시 닫기
2. **검색 모드 포커스**: 검색 모드로 전환 시 입력 필드에 자동 포커스
3. **검색어 디바운스**: 검색어 변경 시 300ms 디바운스 후 자동 검색
4. **value 동기화**: value prop 변경 시 선택된 학교 목록 동기화 (중복 조회 방지)

#### 핸들러 함수
- `fetchSchoolsByIds`: 학교 ID 배열로 학교 정보 조회
- `handleSearchSchools`: 학교 검색 실행
- `handleSelect`: 학교 선택
- `handleRemove`: 선택된 학교 제거
- `handleClear`: 모든 선택 초기화
- `handleSearchClick`: 검색 모드 진입
- `handleSearchSubmit`: 검색 실행 (Enter 키)
- `handleSearchKeyDown`: 키보드 이벤트 처리 (Enter, Escape)
- `handleClose`: 드롭다운 닫기

**반환값**:
```typescript
{
  // 상태
  isSearchMode, isOpen, searchQuery, setSearchQuery,
  schools, loading, selectedSchools, canAddMore,

  // refs
  containerRef, searchInputRef,

  // 핸들러
  handleSelect, handleRemove, handleClear,
  handleSearchClick, handleSearchSubmit, handleSearchKeyDown,
  handleClose,
}
```

---

### 2. 컴포넌트 단순화 (`SchoolMultiSelect.tsx`)

**변경사항**:
- 기존 로직 코드를 모두 제거하고 훅을 호출하여 상태와 핸들러를 받아옴
- UI 렌더링 부분만 유지
- `getRankStyles` 헬퍼 함수는 컴포넌트 내부에 유지 (순수 UI 로직)

**Props 인터페이스 유지**:
기존 Props 인터페이스를 완전히 동일하게 유지하여 기존 코드와의 호환성을 보장했습니다:

```typescript
type SchoolMultiSelectProps = {
  value?: string[];
  onChange: (value: string[]) => void;
  type?: "중학교" | "고등학교" | "대학교";
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxCount?: number;
  onSchoolSelect?: (school: School) => void;
};
```

---

## 개선 효과

### 가독성 향상
- 로직과 UI가 명확히 분리되어 코드 이해가 쉬움
- 컴포넌트 파일이 545줄에서 약 300줄로 감소 (약 45% 감소)
- 각 파일이 단일 책임을 가지도록 구조화

### 유지보수성 향상
- 비즈니스 로직 수정 시 훅만 수정하면 됨
- UI 수정 시 컴포넌트만 수정하면 됨
- 테스트 및 디버깅이 용이함

### 재사용성 향상
- `useSchoolMultiSelectLogic` 훅을 다른 컴포넌트에서도 재사용 가능
- 로직과 UI의 독립적인 변경 가능

---

## 검증 결과

### 타입 체크
- ✅ TypeScript 타입 오류 없음
- ✅ Props 타입 일치 확인

### 기능 검증
- ✅ 검색 기능 정상 작동 (디바운스 포함)
- ✅ 선택/삭제/초기화 기능 정상 작동
- ✅ 최대 개수 제한 기능 정상 작동
- ✅ 순위 표시 기능 정상 작동
- ✅ `value` prop 변경 시 동기화 정상 작동
- ✅ 외부 클릭 시 드롭다운 닫기 정상 작동
- ✅ 키보드 이벤트 (Enter, Escape) 정상 작동

### 호환성 검증
- ✅ 기존 Props 인터페이스 유지
- ✅ 기존 사용처와 호환
  - `app/(student)/settings/_components/sections/CareerInfoSection.tsx`
  - `app/(admin)/admin/students/[id]/_components/sections/CareerInfoSection.tsx`

---

## 주요 기능 설명

### 1. 검색 기능
- 검색어 입력 시 300ms 디바운스 후 자동 검색
- 이미 선택된 학교는 검색 결과에서 제외
- 검색 중 로딩 상태 표시

### 2. 선택 관리
- 최대 선택 개수 제한 (기본값: 3개)
- 선택 순서대로 1순위, 2순위, 3순위로 표시
- 순위별 다른 스타일 적용 (1순위는 별 아이콘)

### 3. value 동기화
- `value` prop 변경 시 선택된 학교 목록 자동 업데이트
- 중복 조회 방지 로직 포함
- 배열 내용 비교를 통한 정확한 변경 감지

### 4. 외부 클릭 감지
- 드롭다운 외부 클릭 시 자동으로 닫힘
- `useEffect`와 `ref`를 활용한 구현

---

## 향후 개선 사항

1. **테스트 추가**: 훅과 컴포넌트에 대한 단위 테스트 작성
2. **성능 최적화**: 불필요한 리렌더링 방지 최적화
3. **접근성 개선**: 키보드 네비게이션 및 ARIA 속성 보강

---

## 참고사항

### 주요 의존성

- `@/app/(student)/actions/schoolActions` - 학교 검색 및 조회 액션
- `@/lib/cn` - 클래스명 병합 유틸리티

### 주의사항

1. 검색어 디바운스는 300ms로 설정되어 있습니다.
2. `value` prop 변경 감지는 JSON.stringify를 사용하여 배열 내용을 비교합니다.
3. 최대 선택 개수는 기본값 3개이며, `maxCount` prop으로 변경 가능합니다.

---

**작업 완료일**: 2025-02-04

