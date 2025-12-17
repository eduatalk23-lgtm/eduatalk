# 캘린더 접근성 개선 및 URL 상태 동기화

## 작업 일시
2024년 12월 15일

## 구현된 개선 사항

### 1. 접근성 개선 ✅

#### 키보드 네비게이션
- **화살표 키 지원**:
  - `←` / `→`: 날짜 이동 (이전/다음)
  - `↑` / `↓`: 주별/일별 뷰에서 날짜 이동
  - `Home`: 오늘 날짜로 이동
- 입력 필드에 포커스가 있을 때는 키보드 이벤트 무시
- 캘린더 영역에 포커스가 있을 때만 처리

#### ARIA 속성 추가
- `role="application"`: 캘린더 전체 영역
- `role="tablist"` / `role="tab"`: 뷰 전환 버튼
- `role="grid"` / `role="row"` / `role="columnheader"`: 월별 뷰 그리드
- `role="button"`: 날짜 셀
- `role="region"`: 캘린더 뷰 영역
- `aria-label`: 모든 인터랙티브 요소에 설명 추가
- `aria-selected`: 현재 선택된 뷰 표시
- `aria-current="date"`: 오늘 날짜 표시
- `aria-live="polite"`: 날짜 변경 시 스크린 리더 알림
- `aria-disabled`: 비활성화된 버튼 표시
- `aria-pressed`: 토글 버튼 상태 표시

#### 포커스 관리
- 모든 버튼에 `focus:outline-none focus:ring-2 focus:ring-indigo-500` 스타일 추가
- 키보드로 접근 가능한 모든 요소에 `tabIndex` 설정
- 날짜 셀에 `Enter` 및 `Space` 키로 클릭 가능

#### 오늘 날짜 하이라이트
- 오늘 날짜에 `ring-2 ring-indigo-500` 스타일 적용
- 오늘 날짜에 `aria-current="date"` 속성 추가
- 오늘 날짜 숫자 옆에 점(●) 표시
- "오늘" 버튼에 `aria-pressed` 속성으로 현재 상태 표시

### 2. URL 상태 동기화 ✅

#### 구현 내용
- 현재 날짜를 URL 쿼리 파라미터 `date`로 관리
- 현재 뷰를 URL 쿼리 파라미터 `view`로 관리
- `router.replace()`를 사용하여 히스토리 스택에 쌓이지 않도록 처리
- 브라우저 뒤로가기/앞으로가기 지원
- URL 공유 시 현재 상태 유지

#### 동작 방식
1. 날짜 또는 뷰 변경 시 자동으로 URL 업데이트
2. URL에서 날짜/뷰 파라미터 읽어서 초기 상태 설정
3. `scroll: false` 옵션으로 스크롤 위치 유지

#### 사용 예시
```
/plan/calendar?date=2024-12-15&view=month
/plan/calendar?date=2024-12-15&view=week
/plan/calendar?date=2024-12-15&view=day
```

### 3. 날짜 범위 제한 및 경고 ✅

#### 구현 내용
- `minDate` / `maxDate` 범위 체크 함수 추가
- 날짜 이동 시 범위 밖으로 나가면 이동하지 않음
- 이전/다음 버튼 비활성화 (범위 밖일 때)
- 비활성화된 버튼에 시각적 피드백 (opacity, cursor-not-allowed)
- `aria-disabled` 속성으로 스크린 리더 지원

#### UI 피드백
- 비활성화된 버튼: `opacity-50`, `cursor-not-allowed`, `text-gray-300`
- 활성화된 버튼: 정상 스타일 유지

## 기술적 구현 세부사항

### useCallback 활용
- `moveDate`, `goToPrevious`, `goToNext`, `goToToday` 함수 메모이제이션
- `updateURL`, `handleViewChange` 함수 메모이제이션
- 불필요한 리렌더링 방지

### useMemo 활용
- `canGoPrevious`, `canGoNext`: 버튼 활성화 상태 계산
- `isToday`: 오늘 날짜 확인
- `isDateInRange`: 날짜 범위 체크

### useEffect 활용
- 키보드 이벤트 리스너 등록/해제
- URL 동기화 (날짜/뷰 변경 시)

## 접근성 준수 사항

### WCAG 2.1 AA 준수
- ✅ 키보드 접근성: 모든 기능이 키보드로 접근 가능
- ✅ 스크린 리더 지원: ARIA 속성으로 충분한 정보 제공
- ✅ 포커스 관리: 명확한 포커스 표시
- ✅ 명확한 레이블: 모든 인터랙티브 요소에 설명 제공

## 변경된 파일

1. `app/(student)/plan/calendar/_components/PlanCalendarView.tsx`
   - 키보드 네비게이션 추가
   - ARIA 속성 추가
   - URL 상태 동기화
   - 날짜 범위 제한 로직
   - 포커스 스타일 개선

2. `app/(student)/plan/calendar/_components/MonthView.tsx`
   - 날짜 셀에 ARIA 속성 추가
   - 오늘 날짜 하이라이트
   - 키보드 이벤트 핸들러 추가
   - 그리드 구조에 role 속성 추가

3. `app/(student)/plan/calendar/page.tsx`
   - `date` 쿼리 파라미터 타입 추가

## 사용자 경험 개선 효과

1. **접근성 향상**: 키보드 사용자와 스크린 리더 사용자 지원
2. **URL 공유**: 현재 상태를 URL로 공유 가능
3. **브라우저 히스토리**: 뒤로가기/앞으로가기 지원
4. **명확한 피드백**: 날짜 범위 제한 시 시각적 피드백
5. **오늘 날짜 식별**: 명확한 하이라이트로 현재 날짜 파악 용이

## 향후 개선 가능 사항

1. 모바일 터치 제스처 지원 (스와이프)
2. 키보드 단축키 도움말 표시
3. 스크린 리더 전용 숨김 텍스트 추가
4. 포커스 트랩 (모달 내에서)

