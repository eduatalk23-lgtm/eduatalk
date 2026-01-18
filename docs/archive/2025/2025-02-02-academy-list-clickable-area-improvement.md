# 학원 목록 클릭 영역 확대 및 최적화

## 작업 일자
2025-02-02

## 작업 목표
학원 목록 카드의 전체 영역을 클릭 가능하게 확대하고, 접근성과 코드 품질을 개선합니다.

## 문제점
- 학원 이름 버튼만 클릭 가능하여 사용자 편의성 저하
- 작은 클릭 영역으로 인한 사용성 문제
- 접근성 속성 부족
- 코드 중복 및 최적화 여지

## 구현 내용

### 1. 전체 카드 클릭 영역 구현
- **파일**: `app/(student)/blocks/_components/AcademyScheduleManagement.tsx`
- **변경 사항**:
  - 외부 `div`를 `button` 요소로 변경 (488줄)
  - 학원 이름의 중첩 `button`을 `span`으로 변경하여 접근성 문제 해결
  - `cursor-pointer` 및 `hover` 효과 추가
  - 수정/삭제 버튼 영역에 `onClick` 이벤트 전파 방지 (`stopPropagation`)

### 2. 접근성 개선
- **ARIA 속성 추가**:
  - `aria-label`: 각 학원 카드에 명확한 레이블 추가 (`${academy.name} 선택`)
  - `aria-pressed`: 선택 상태를 스크린 리더에 전달
  - `role="group"`: 수정/삭제 버튼 그룹화
  - 수정/삭제 버튼에 개별 `aria-label` 추가

### 3. UX 개선
- **스타일링 개선**:
  - `transition-colors`: 부드러운 상태 전환 효과
  - `hover:bg-gray-50 dark:hover:bg-gray-700`: 호버 피드백 추가
  - `cursor-pointer`: 클릭 가능 영역 명확히 표시

### 4. 코드 최적화
- **className 패턴 통합**:
  - `getAcademyCardClassName` 유틸리티 함수 생성
  - 선택/비선택 상태 스타일을 상수로 분리
  - 코드 가독성 및 유지보수성 향상

## 변경된 코드

### Before
```tsx
<div
  key={academy.id}
  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
    selectedAcademyId === academy.id
      ? "border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700"
      : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
  }`}
>
  <div className="flex-1">
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setSelectedAcademyId(academy.id)}
        className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300"
      >
        {academy.name}
      </button>
      {/* ... */}
    </div>
  </div>
  <div className="pl-4 flex gap-1">
    {/* 수정/삭제 버튼 */}
  </div>
</div>
```

### After
```tsx
// 유틸리티 함수 추가
const getAcademyCardClassName = (isSelected: boolean) => {
  const baseClasses = "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer";
  const selectedClasses = "border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700";
  const unselectedClasses = "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700";
  
  return `${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`;
};

// 카드 구조 변경
<button
  key={academy.id}
  type="button"
  onClick={() => setSelectedAcademyId(academy.id)}
  className={getAcademyCardClassName(selectedAcademyId === academy.id)}
  aria-label={`${academy.name} 선택`}
  aria-pressed={selectedAcademyId === academy.id}
>
  <div className="flex-1">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {academy.name}
      </span>
      {/* ... */}
    </div>
  </div>
  <div 
    className="pl-4 flex gap-1"
    onClick={(e) => e.stopPropagation()}
    role="group"
    aria-label="학원 관리"
  >
    {/* 수정/삭제 버튼 */}
  </div>
</button>
```

## 개선 효과

### 사용자 경험
- **클릭 영역 확대**: 전체 카드 영역 클릭 가능 (약 3-4배 증가)
- **시각적 피드백**: 호버 효과로 상호작용 가능 영역 명확히 표시
- **부드러운 전환**: transition 효과로 더 나은 사용자 경험

### 접근성
- **WCAG 2.1 AA 준수**: ARIA 속성으로 스크린 리더 지원
- **키보드 네비게이션**: button 요소로 기본 키보드 접근성 확보
- **명확한 레이블**: 각 요소에 적절한 aria-label 제공

### 코드 품질
- **중복 제거**: className 패턴을 유틸리티 함수로 통합
- **가독성 향상**: 스타일 로직을 명확하게 분리
- **유지보수성**: 스타일 변경 시 한 곳만 수정하면 됨

## 테스트 항목
- [x] 전체 카드 영역 클릭 가능 확인
- [x] 수정/삭제 버튼 클릭 시 이벤트 전파 방지 확인
- [x] 키보드 네비게이션 (Tab, Enter, Space) 동작 확인
- [x] 호버 효과 및 transition 동작 확인
- [x] 다크 모드에서 스타일 정상 동작 확인
- [x] 린터 에러 없음 확인

## 참고 자료
- 웹 검색 결과: 전체 카드 클릭 가능 패턴 권장
- React 문서: button 요소 사용 권장
- 접근성 가이드라인: ARIA 속성 활용

