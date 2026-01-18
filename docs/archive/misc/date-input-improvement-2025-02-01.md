# 학습 기간 날짜 선택 필드 개선 작업

**작업 일자**: 2025-02-01  
**작업 범위**: `/plan/new-group` 페이지의 학습 기간 날짜 선택 필드 개선

## 작업 목표

1. 날짜 선택 필드 전체 영역을 클릭 가능하게 개선
2. 중복 코드 제거 및 공통 컴포넌트 생성
3. 사용성 향상

## 구현 내용

### 1. DateInput 공통 컴포넌트 생성

**파일**: `app/(student)/plan/new-group/_components/_shared/DateInput.tsx`

- 날짜 입력 필드의 공통 로직 및 스타일링 통합
- 전체 영역 클릭 가능하도록 CSS 적용
- disabled 상태 처리
- label과 input 연결로 접근성 향상

**주요 기능**:
- `cursor-pointer`로 전체 영역 클릭 가능 표시
- WebKit 브라우저에서 달력 아이콘 크기 및 클릭 영역 확장
- Firefox 및 다른 브라우저 호환성 고려
- TypeScript 타입 안전성 보장

### 2. PeriodSection.tsx 리팩토링

**변경 사항**:
- 6개의 중복된 날짜 입력 필드를 `DateInput` 컴포넌트로 교체
  - D-day 입력 (1개)
  - 주 단위 입력 (1개)
  - 직접 입력 - 시작일 (1개)
  - 직접 입력 - 종료일 (1개)
  - 추가 기간 시작일 (1개)
  - 추가 기간 종료일 (1개)
- disabled 조건 체크 로직 통합
- 스타일링 일관성 확보

### 3. CSS 스타일링 개선

**적용된 스타일**:
- `cursor-pointer`: 전체 영역 클릭 가능 표시
- `[&::-webkit-calendar-picker-indicator]`: WebKit 브라우저에서 달력 아이콘 크기 및 클릭 영역 확장
- `style={{ cursor: 'pointer' }}`: Firefox 및 다른 브라우저 호환성

## 변경된 파일

1. **신규 파일**:
   - `app/(student)/plan/new-group/_components/_shared/DateInput.tsx`
   - `app/(student)/plan/new-group/_components/_shared/index.ts` (DateInput export 추가)

2. **수정된 파일**:
   - `app/(student)/plan/new-group/_components/Step1BasicInfo/PeriodSection.tsx`

## 기술적 고려사항

### HTML5 date input 특성
- 브라우저마다 기본 스타일이 다름
- `::webkit-calendar-picker-indicator`는 WebKit 기반 브라우저에서만 작동
- Firefox는 다른 방식 필요

### 접근성
- label과 input의 `htmlFor`/`id` 연결 유지
- 키보드 네비게이션 지원
- 스크린 리더 호환성

### 타입 안전성
- TypeScript 타입 정의
- Props 검증

## 예상 효과

1. **사용성 향상**: 전체 필드 영역 클릭 가능으로 사용자 경험 개선
2. **코드 품질**: 중복 코드 제거로 유지보수성 향상 (약 200줄 감소)
3. **일관성**: 모든 날짜 입력 필드의 동일한 동작 및 스타일
4. **확장성**: 향후 다른 페이지에서도 재사용 가능

## 테스트 항목

- [x] 각 입력 타입별 동작 확인 (D-day, 주 단위, 직접 입력)
- [x] disabled 상태 확인
- [x] 전체 영역 클릭 가능 여부 확인
- [x] 브라우저 호환성 확인 (Chrome, Safari, Firefox)
- [x] TypeScript 타입 검증
- [x] ESLint 검증

## 참고 사항

- HTML5 date input은 기본적으로 전체 영역이 클릭 가능해야 하지만, 브라우저 스타일링에 따라 달력 아이콘만 클릭 가능한 것처럼 보일 수 있음
- CSS를 통해 전체 영역 클릭 가능성을 명확히 표시
- 공통 컴포넌트로 재사용성 향상

