# React Hooks 에러 수정

## 작성 일자
2025-01-30

## 문제 상황
`Step4RecommendedContents` 컴포넌트에서 "Rendered more hooks than during the previous render" 에러가 발생했습니다.

## 원인 분석

### 1. 무한 루프 문제
- `fetchRecommendations`와 `fetchRecommendationsWithSubjects` 함수의 dependency array에 `allRecommendedContents`가 포함되어 있었습니다.
- 이 함수들이 내부에서 `setAllRecommendedContents`를 호출하여 상태를 업데이트합니다.
- 상태 업데이트 → 함수 재생성 → useEffect 재실행 → 상태 업데이트의 무한 루프가 발생했습니다.

### 2. useEffect dependency 문제
- `useEffect`의 dependency array에 `fetchRecommendations`가 포함되어 있었습니다.
- `fetchRecommendations`가 자주 재생성되면서 `useEffect`가 계속 실행되어 hooks의 개수가 달라질 수 있었습니다.

## 수정 내용

### 1. `fetchRecommendations` 함수 수정
- dependency array에서 `allRecommendedContents` 제거
- `propStudentId`를 dependency에 추가 (함수 내부에서 사용)
- `allRecommendedContents` 사용 부분을 함수형 업데이트로 변경하여 stale closure 문제 해결
- 중복 제거 로직을 `data.recommended_contents`를 직접 사용하도록 변경

### 2. `fetchRecommendationsWithSubjects` 함수 수정
- dependency array에서 `allRecommendedContents` 제거
- `propStudentId`를 dependency에 추가
- 중복 제거 로직을 `data.recommended_contents`를 직접 사용하도록 변경

### 3. `useEffect` dependency 수정
- `fetchRecommendations`를 dependency에서 제거
- `isEditMode`만 dependency로 사용
- eslint-disable 주석 추가 (의도적인 제외)

### 4. 코드 순서 수정
- `filteredRecommendations` 변수가 정의되기 전에 사용되는 문제 수정
- 변수 정의 순서를 올바르게 재배치

## 수정된 파일
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

## 결과
- React Hooks 에러 해결
- 무한 루프 문제 해결
- Linter 오류 없음

