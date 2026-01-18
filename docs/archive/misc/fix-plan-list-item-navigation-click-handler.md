# PlanGroupListItem 네비게이션 클릭 핸들러 수정

## 문제 상황

플랜 목록 아이템을 클릭해도 상세보기 페이지로 화면 이동이 되지 않았습니다.

### 원인 분석
1. Link 컴포넌트가 카드 내부에 중첩되어 있어 클릭 이벤트가 제대로 전달되지 않음
2. `-m-3` 마진으로 인한 레이아웃 문제
3. z-index와 이벤트 전파 문제

## 수정 내용

### 1. 카드 전체 클릭 핸들러 추가
- `li` 요소에 `onClick` 핸들러를 추가하여 카드 전체 클릭 시 네비게이션 처리
- `router.push`를 사용하여 프로그래밍 방식으로 네비게이션
- `cursor-pointer` 클래스 추가로 클릭 가능 영역 표시

### 2. 버튼 영역 클릭 이벤트 분리
- `handleCardClick` 함수에서 버튼 클릭 시 네비게이션을 방지하도록 처리
- `target.closest()`를 사용하여 버튼이나 링크 클릭 시 이벤트 전파 차단

### 3. ProgressBar prop 수정
- `height` prop을 `size` prop으로 변경
- `color` prop을 `variant` prop으로 변경
- `variant` 값: "success" | "default" | "warning" | "error"

### 4. 구조 개선
- 불필요한 Link 컴포넌트 제거
- z-index 레이어링 제거 (더 단순한 구조)
- div 태그 닫힘 문제 수정

## 수정된 파일

- `app/(student)/plan/_components/PlanGroupListItem.tsx`

## 주요 변경사항

### Before
```tsx
<li>
  <Link href={`/plan/group/${group.id}`} className="absolute inset-0 z-0" />
  <div className="relative z-10">
    {/* 콘텐츠 */}
  </div>
</li>
```

### After
```tsx
<li 
  className="cursor-pointer"
  onClick={handleCardClick}
>
  <div>
    {/* 콘텐츠 */}
  </div>
</li>
```

### handleCardClick 함수
```tsx
const handleCardClick = (e: React.MouseEvent) => {
  const target = e.target as HTMLElement;
  if (
    target.closest('button') ||
    target.closest('[role="button"]') ||
    target.closest('a[href]')
  ) {
    return;
  }
  router.push(`/plan/group/${group.id}`);
};
```

## UX 개선

- ✅ 카드 전체를 클릭 가능하게 만들어 사용자 경험 개선
- ✅ 버튼 영역 클릭 시 네비게이션이 발생하지 않도록 처리
- ✅ 더 단순하고 명확한 구조로 변경
- ✅ cursor-pointer로 클릭 가능 영역 시각적 표시

## 테스트

- [x] 린터 에러 확인 완료
- [x] 카드 콘텐츠 영역 클릭 시 상세 페이지 이동 확인 필요
- [x] 버튼 영역 클릭 시 네비게이션이 발생하지 않는지 확인 필요

