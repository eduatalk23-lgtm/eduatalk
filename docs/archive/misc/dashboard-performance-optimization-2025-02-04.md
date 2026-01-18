# 대시보드 성능 최적화 작업 문서

**작업일**: 2025-02-04  
**목표**: TTI(Time to Interactive) 단축 및 불필요한 데이터 로딩 제거

## 작업 개요

대시보드 초기 렌더링 속도를 개선하기 위해 경량 쿼리 함수 추가 및 ActiveLearningWidget 지연 로딩을 구현했습니다.

## 구현 내용

### 1. 대시보드 전용 경량 쿼리 함수 작성

**파일**: `app/(student)/dashboard/_utils.ts`

**추가된 함수**: `getDashboardSummary`
- 목적: 대시보드 초기 렌더링에 필요한 최소한의 데이터만 조회
- 조회 컬럼: `id, content_title, progress, actual_start_time, actual_end_time`
- 최적화 포인트:
  - `content_title` (denormalized 필드) 활용하여 콘텐츠 조인 제거
  - `memo`, `content_subject`, `content_subject_category` 등 불필요한 필드 제외
  - 추가 쿼리 없이 denormalized 필드만 사용

**타입 정의**:
```typescript
export type DashboardSummary = {
  id: string;
  title: string;
  progress: number | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
};
```

### 2. ActiveLearningWidget 지연 로딩 구현

**파일**: 
- `app/(student)/dashboard/_utils.ts`: `fetchActivePlanIdOnly` 함수 추가
- `lib/hooks/useActivePlanDetails.ts`: 새로운 React Query 훅 생성
- `app/(student)/dashboard/_components/ActiveLearningWidget.tsx`: 지연 로딩으로 변경

**변경 사항**:
- 서버 사이드: `fetchActivePlanIdOnly`로 `activePlanId`만 확인
- 클라이언트 사이드: `useActivePlanDetails` 훅으로 마운트 후 상세 정보 로드
- 초기 HTML 응답에는 위젯의 스켈레톤만 포함

**구현 세부사항**:
1. `fetchActivePlanIdOnly`: 최소한의 쿼리로 활성 플랜 ID만 조회
2. `useActivePlanDetails`: React Query를 사용하여 클라이언트에서 상세 정보 로드
3. 로딩 상태 표시: 스켈레톤 UI 추가

### 3. fetchActivePlanSimple 최적화

**파일**: `app/(student)/dashboard/_utils.ts`

**최적화 내용**:
- `content_title` 필드를 select에 포함
- 콘텐츠 제목 조회를 개별 쿼리 3회에서 조건부 1회로 감소
- `content_title`이 있는 경우 콘텐츠 테이블 조회 생략

**변경 전**:
- 항상 콘텐츠 테이블에서 제목 조회 (book/lecture/custom 각각 1회씩)

**변경 후**:
- `content_title` 필드가 있으면 사용
- 없을 때만 콘텐츠 테이블에서 조회 (fallback)

### 4. 대시보드 페이지 적용

**파일**: `app/(student)/dashboard/page.tsx`

**변경 사항**:
- `fetchActivePlanSimple` → `fetchActivePlanIdOnly`로 변경
- `ActiveLearningWidget` props 변경: `activePlan` → `activePlanId`
- 초기 데이터 로딩 최소화

### 5. 관련 컴포넌트 업데이트

**파일**: `app/(student)/today/_components/CurrentLearningSection.tsx`

**변경 사항**:
- `fetchActivePlan` → `fetchActivePlanIdOnly`로 변경
- `ActiveLearningWidget` props 변경: `activePlan` → `activePlanId`

## 성능 개선 효과

### 예상 개선 사항

1. **초기 HTML 응답 크기**: 30-50% 감소
   - 불필요한 데이터 제거
   - 지연 로딩으로 위젯 상세 정보 제외

2. **TTI (Time to Interactive)**: 200-300ms 단축
   - 지연 로딩 적용
   - 경량 쿼리 사용

3. **네트워크 전송량**: 40-60% 감소
   - 필요한 컬럼만 select
   - denormalized 필드 활용

4. **서버 부하**: 20-30% 감소
   - 불필요한 조인 제거
   - 콘텐츠 테이블 조회 최소화

## 타입 안전성

모든 함수에 명시적 타입 정의:
- `DashboardSummary`: 대시보드 요약 타입
- `ActivePlanDetails`: 활성 플랜 상세 타입 (훅에서 사용)
- 함수 반환 타입 명시

## 하위 호환성

- `fetchActivePlanSimple`: 기존 함수 유지 (최적화만 적용)
- `fetchActivePlan`: 기존 함수 유지 (다른 곳에서 사용 중)
- `ActiveLearningWidget`: props 변경 (기존 사용처 모두 업데이트)

## 주의사항

1. **캐싱 전략**: React Query의 `staleTime`과 `refetchInterval` 설정으로 불필요한 재요청 방지
2. **에러 처리**: 네트워크 오류, 데이터 없음 등 모든 케이스 처리
3. **로딩 상태**: 스켈레톤 UI로 사용자 경험 개선

## 관련 파일

### 수정된 파일
- `app/(student)/dashboard/_utils.ts`: 경량 쿼리 함수 추가 및 최적화
- `app/(student)/dashboard/page.tsx`: 지연 로딩 적용
- `app/(student)/dashboard/_components/ActiveLearningWidget.tsx`: 지연 로딩으로 변경
- `app/(student)/today/_components/CurrentLearningSection.tsx`: 지연 로딩 적용

### 새로 생성된 파일
- `lib/hooks/useActivePlanDetails.ts`: React Query 훅

## 다음 단계

1. 성능 측정 및 검증
2. 필요시 추가 최적화
3. 다른 페이지에도 동일한 패턴 적용 검토

