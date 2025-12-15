# 스케줄 미리보기 패널 최적화 작업

**작업 일자**: 2025-02-04  
**작업 내용**: SchedulePreviewPanel.tsx의 스케줄링 로직 서버 이관 및 최적화

## 개요

브라우저 메인 스레드 블로킹을 방지하고 사용자 경험을 개선하기 위해 스케줄 계산 로직을 최적화했습니다.

## 주요 변경사항

### 1. useDebounce 커스텀 훅 생성

**파일**: `lib/hooks/useDebounce.ts`

- React 훅으로 debounce 기능 제공
- 지연 시간을 파라미터로 받아 유연하게 설정 가능 (기본 500ms)
- TypeScript 타입 안전성 보장
- 컴포넌트 언마운트 시 타이머 자동 정리

**사용 예시**:
```typescript
const debouncedValue = useDebounce(value, 750);
```

### 2. SchedulePreviewPanel.tsx 리팩토링

**주요 변경사항**:

1. **useDebounce 적용**
   - 기존 `useEffect` + `setTimeout` 로직 제거
   - `useDebounce` 훅을 사용하여 750ms 지연 후 서버 계산 요청
   - debounce 시간을 500ms~1s 범위로 설정 (현재 750ms)

2. **성능 최적화**
   - JSON.stringify 비교 로직을 `compareScheduleData` 함수로 최적화
   - 불필요한 전체 객체 비교 대신 핵심 필드만 비교
   - `scheduleDataRef`를 사용하여 의존성 배열 최적화

3. **스켈레톤 UI 개선**
   - 기존 단순 로더를 상세 스켈레톤으로 교체
   - 실제 콘텐츠 구조와 유사한 스켈레톤 디자인:
     - 요약 통계 카드 스켈레톤 (5개)
     - 주차별 스케줄 리스트 스켈레톤 (3개)

### 3. 코드 최적화

**최적화 포인트**:

1. **값 비교 로직 개선**
   - `JSON.stringify` 사용을 최소화
   - 핵심 필드만 비교하여 성능 향상
   - 첫 번째와 마지막 날짜만 확인하여 대용량 데이터 처리 최적화

2. **메모이제이션 강화**
   - `compareScheduleData` 함수를 `useCallback`으로 메모이제이션
   - `scheduleDataRef`를 사용하여 불필요한 재계산 방지

3. **의존성 배열 최적화**
   - `calculateSchedule` 함수의 의존성 배열 최적화
   - `scheduleDataRef`를 통해 비교용 데이터 참조 안정화

## 파일 변경 내역

### 신규 파일
- `lib/hooks/useDebounce.ts`: debounce 기능을 제공하는 React 훅

### 수정 파일
- `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`
  - useDebounce 훅 적용
  - useEffect + setTimeout 로직 제거
  - 스켈레톤 UI 개선
  - 성능 최적화

## 성능 개선 효과

1. **브라우저 메인 스레드 블로킹 감소**
   - 서버 사이드 계산으로 클라이언트 부하 감소
   - debounce를 통한 불필요한 요청 감소

2. **사용자 경험 향상**
   - 상세 스켈레톤 UI로 로딩 상태 명확화
   - 더 빠른 응답 시간 (debounce 최적화)

3. **코드 가독성 향상**
   - useDebounce 훅 사용으로 코드 간결화
   - 명확한 의도 표현

## 기술 스택

- **Next.js 16.0.3**: Server Actions 활용
- **React 19.2.0**: 커스텀 훅 패턴
- **TypeScript 5**: 타입 안전성 보장

## 테스트 체크리스트

- [x] debounce가 정상적으로 작동하는지 확인 (750ms)
- [x] 스켈레톤 UI가 로딩 중에 표시되는지 확인
- [x] 캐시가 정상적으로 작동하는지 확인
- [x] 입력값 변경 시 불필요한 재계산이 발생하지 않는지 확인
- [x] 에러 상태가 정상적으로 표시되는지 확인
- [x] 타입 안전성 검증 완료
- [x] 린터 에러 없음

## 향후 개선 사항

1. **캐시 전략 개선**
   - 서버 사이드 캐싱 고려
   - 캐시 무효화 전략 개선

2. **에러 처리 강화**
   - 재시도 로직 추가
   - 사용자 친화적 에러 메시지

3. **성능 모니터링**
   - 계산 시간 측정
   - 사용자 경험 지표 추적

