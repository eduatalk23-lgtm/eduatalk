# 중첩된 Button 오류 수정

## 날짜
2025-02-02

## 문제
`AcademyScheduleManagement` 컴포넌트에서 `<button>` 안에 `<button>`이 중첩되어 있어 hydration 오류가 발생했습니다.

### 에러 메시지
```
In HTML, <button> cannot be a descendant of <button>.
This will cause a hydration error.
```

### 원인
- 497번째 줄: 학원 선택을 위한 외부 `<button>` 요소
- 524번째 줄: 수정/삭제를 위한 내부 `<button>` 요소들

HTML 표준에 따르면 `<button>` 요소는 다른 `<button>` 요소의 자식이 될 수 없습니다.

## 해결 방법
외부 `<button>` 요소를 `<div>`로 변경하고, 접근성을 위해 다음 속성들을 추가했습니다:

1. **`role="button"`**: 스크린 리더를 위한 역할 지정
2. **`tabIndex={0}`**: 키보드 포커스 가능하도록 설정
3. **`onKeyDown`**: Enter 및 Space 키로 클릭 가능하도록 처리
4. **`aria-label` 및 `aria-pressed`**: 접근성 속성 유지

### 변경 전
```tsx
<button
  key={academy.id}
  type="button"
  onClick={() => setSelectedAcademyId(academy.id)}
  className={getAcademyCardClassName(selectedAcademyId === academy.id)}
  aria-label={`${academy.name} 선택`}
  aria-pressed={selectedAcademyId === academy.id}
>
  {/* 내부에 수정/삭제 button들이 있음 */}
</button>
```

### 변경 후
```tsx
<div
  key={academy.id}
  onClick={() => setSelectedAcademyId(academy.id)}
  className={getAcademyCardClassName(selectedAcademyId === academy.id)}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedAcademyId(academy.id);
    }
  }}
  aria-label={`${academy.name} 선택`}
  aria-pressed={selectedAcademyId === academy.id}
>
  {/* 내부에 수정/삭제 button들이 있음 */}
</div>
```

## 수정된 파일
- `app/(student)/blocks/_components/AcademyScheduleManagement.tsx`

## 결과
- ✅ 중첩된 button 오류 해결
- ✅ 접근성 유지 (키보드 네비게이션 지원)
- ✅ 기존 기능 유지 (클릭 동작 동일)
- ✅ 린터 오류 없음

