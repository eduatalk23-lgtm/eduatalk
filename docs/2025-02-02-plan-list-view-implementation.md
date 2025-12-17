# 배치된 플랜 테이블 뷰 구현 및 코드 최적화

## 작업 일자
2025년 2월 2일

## 작업 개요
배치된 플랜만 보는 전용 테이블 뷰 컴포넌트를 생성하고, 중복된 포맷팅 함수를 공통 유틸리티로 추출하여 코드를 최적화했습니다.

## 구현 내용

### 1. 공통 포맷팅 유틸리티 함수 추출

**파일**: `lib/utils/planFormatting.ts` (신규 생성)

다음 함수들을 공통 유틸리티로 추출했습니다:

- `formatPlanTime(minutes: number): string` - 소요시간 포맷팅 (예: "1시간 30분")
- `formatPlanLearningAmount(plan): string` - 학습 분량 포맷팅 (예: "10-50p (41쪽)", "8-10강 (3강)")
- `formatPlanDate(date: string): string` - 날짜 포맷팅 요일 포함 (예: "2024년 1월 15일 (월)")
- `formatPlanDateShort(date: string): string` - 간단한 날짜 포맷팅 (예: "1월 15일 (월)")

**영향 받는 파일**:
- `app/(student)/plan/new-group/_components/_features/scheduling/components/PlanTable.tsx` - formatTime, formatLearningAmount 제거 및 공통 유틸리티 사용
- `app/(student)/plan/group/[id]/_components/PlanPreviewDialog.tsx` - formatTime, formatLearningAmount 제거 및 공통 유틸리티 사용

### 2. PlanListView 컴포넌트 생성

**파일**: `app/(student)/plan/group/[id]/_components/PlanListView.tsx` (신규 생성)

**주요 기능**:
- 배치된 플랜만 필터링 (학원, 이동, 점심, 자율 제외)
  - `content_type !== 'custom'` 필터링
  - `start_time`과 `end_time`이 모두 있는 플랜만 표시
- 날짜/시간 순 정렬 (기본값)
- TanStack Table을 활용한 정렬, 검색 기능
- 가상 스크롤링으로 성능 최적화 (100개 이상일 때 자동 활성화)
- 스켈레톤 UI 추가

**컬럼 구성**:
- 날짜 (plan_date)
- 시간 (start_time ~ end_time)
- 교과 (content_subject_category)
- 과목 (content_subject)
- 유형 (content_type: 교재/강의)
- 콘텐츠명 (content_title)
- 학습내역 (chapter 또는 contentEpisode)
- 회차 (sequence)
- 학습 분량 (planned_start_page_or_time ~ planned_end_page_or_time)
- 소요시간 (계산값)

### 3. TanStack Table 통합

**의존성**: `@tanstack/react-table`, `@tanstack/react-virtual` (신규 설치)

**특징**:
- 정렬 가능한 컬럼 (날짜, 시간, 교과, 과목 등)
- 가상 스크롤링 (100개 이상일 때 자동 활성화)
- 반응형 디자인

### 4. PlanScheduleView에 통합

**파일**: `app/(student)/plan/group/[id]/_components/PlanScheduleView.tsx`

- 탭 전환 방식으로 일별 스케줄과 플랜 테이블 뷰 전환
- "일별 스케줄" / "플랜 테이블" 버튼으로 뷰 전환

## 성능 최적화

- 100개 미만: 일반 렌더링
- 100개 이상: 가상 스크롤링 자동 활성화
- 정렬/필터링 시 메모이제이션 활용
- React Query 캐시 활용 (이미 구현됨)

## 사용된 기술

- **TanStack Table**: 테이블 데이터 관리 및 정렬
- **TanStack Virtual**: 가상 스크롤링
- **React Query**: 서버 상태 관리
- **TypeScript**: 타입 안전성

## 파일 변경 사항

### 신규 생성
- `lib/utils/planFormatting.ts` - 공통 포맷팅 유틸리티
- `app/(student)/plan/group/[id]/_components/PlanListView.tsx` - 플랜 테이블 뷰 컴포넌트

### 수정
- `app/(student)/plan/new-group/_components/_features/scheduling/components/PlanTable.tsx` - 공통 유틸리티 사용
- `app/(student)/plan/group/[id]/_components/PlanPreviewDialog.tsx` - 공통 유틸리티 사용
- `app/(student)/plan/group/[id]/_components/PlanScheduleView.tsx` - PlanListView 통합

### 패키지 설치
- `@tanstack/react-table` - 테이블 데이터 관리
- `@tanstack/react-virtual` - 가상 스크롤링

## 향후 개선 사항

1. 검색 기능 추가 (컬럼별 필터링)
2. 컬럼 표시/숨김 기능
3. CSV 내보내기 기능
4. 가상 스크롤링 성능 최적화 (현재 기본 구현)

