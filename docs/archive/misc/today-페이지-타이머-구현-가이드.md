# Today 페이지 및 타이머 기능 구현 가이드

> Today 페이지의 데이터 흐름, 리팩토링, 타이머 기능을 통합한 종합 가이드 문서입니다.

**작성일**: 2025-01-31  
**버전**: 1.0

---

## 📋 목차

1. [Today 페이지 개요](#today-페이지-개요)
2. [데이터 흐름](#데이터-흐름)
3. [컴포넌트 구조](#컴포넌트-구조)
4. [타이머 기능](#타이머-기능)
5. [성능 최적화](#성능-최적화)
6. [버그 수정 이력](#버그-수정-이력)

---

## Today 페이지 개요

`/today` 페이지는 학생이 오늘 학습할 플랜을 확인하고, 타이머를 통해 학습 시간을 측정하는 페이지입니다.

### 주요 기능
- 플랜 목록 조회 (오늘 날짜 기준)
- 단일 뷰 / 일일 뷰 모드 전환
- 타이머 기능 (시작, 일시정지, 재개, 완료)
- 플랜 완료/미완료 토글
- 실시간 시간 업데이트

### 요구사항
1. ✅ 플랜 1개만 보는 뷰 (단일 뷰)
2. ✅ 날짜에 해당하는 플랜 목록을 다 보는 뷰 (일일 뷰)
3. ✅ 타이머 (학습 시간 측정) 기능
4. ✅ 플랜 완료/미완료 처리

---

## 데이터 흐름

### 전체 데이터 흐름

```
1. 클라이언트 (PlanViewContainer)
   ↓ fetch("/api/today/plans")

2. API 엔드포인트 (/api/today/plans/route.ts)
   ↓ getPlansForStudent()

3. 데이터베이스 (student_plan 테이블)
   ↓ 조회된 플랜 데이터

4. 추가 데이터 조회
   - 콘텐츠 정보 (books, lectures, custom_contents)
   - 진행률 (student_content_progress)
   - 활성 세션 (student_study_sessions)

5. 데이터 변환 및 조합
   ↓ PlanWithContent 형식으로 변환

6. JSON 응답 반환
   ↓ 클라이언트로 전달
```

### API 엔드포인트

**위치**: `app/api/today/plans/route.ts`

**요청**: `GET /api/today/plans`

**처리 과정**:
1. 사용자 인증 확인
2. 오늘 날짜 계산 (`YYYY-MM-DD` 형식)
3. 오늘 플랜 조회
4. 오늘 플랜이 없으면 가장 가까운 미래 날짜의 플랜 조회
5. 콘텐츠 정보 조회
6. 진행률 조회
7. 활성 세션 조회
8. 데이터 조합 및 반환

### 성능 병목 지점

#### 문제점 1: 불필요한 전체 콘텐츠 조회
- `getBooks`, `getLectures`, `getCustomContents`가 학생의 모든 콘텐츠를 조회
- 실제로는 플랜에 사용된 콘텐츠만 필요

**개선 제안**: 플랜에 사용된 콘텐츠 ID만 조회하도록 최적화

#### 문제점 2: 전체 진행률 조회
- `student_content_progress` 테이블에서 학생의 모든 진행률을 조회
- 실제로는 플랜에 사용된 콘텐츠의 진행률만 필요

**개선 제안**: 플랜에 사용된 콘텐츠의 진행률만 조회

---

## 컴포넌트 구조

### 새로운 구조 (2025-01-22 리팩토링)

```
/today 페이지
├── page.tsx (서버 컴포넌트)
│   └── 데이터 페칭만 담당
│
├── PlanViewContainer.tsx (클라이언트)
│   ├── 뷰 모드 전환 (단일/일일)
│   ├── SinglePlanView.tsx
│   │   └── PlanCard.tsx
│   │       └── PlanTimer.tsx
│   └── DailyPlanListView.tsx
│       └── PlanCard.tsx (여러 개)
│           └── PlanTimer.tsx
│
└── API
    └── /api/today/plans/route.ts
        └── 플랜 데이터 조회 API
```

### 주요 컴포넌트

#### 1. `page.tsx`
- 서버 컴포넌트로 데이터 페칭만 담당
- 인증 및 권한 확인
- 진행률 계산

#### 2. `PlanViewContainer.tsx`
- 뷰 모드 전환 (단일/일일)
- 선택된 플랜 상태 관리

#### 3. `SinglePlanView.tsx`
- 단일 플랜 상세 뷰
- 플랜 선택기 포함
- API에서 데이터 로딩
- 1초마다 자동 갱신 (타이머 업데이트)

#### 4. `DailyPlanListView.tsx`
- 일일 플랜 목록 뷰
- 모든 플랜을 카드 형태로 표시
- API에서 데이터 로딩
- 1초마다 자동 갱신 (타이머 업데이트)

#### 5. `PlanCard.tsx`
- 플랜 카드 컴포넌트
- 타이머 기능 포함
- 완료/미완료 토글 기능
- 단일/일일 뷰 모드 지원

#### 6. `PlanTimer.tsx`
- 타이머 UI 및 제어
- 시작/일시정지/재개/완료 버튼
- 실시간 시간 표시
- 컴팩트/전체 모드 지원

---

## 타이머 기능

### 주요 기능

#### 1. 플랜 시작 (타이머 시작)
- 플랜을 시작하면 학습 세션(`student_study_sessions`)이 생성됩니다
- 플랜의 `actual_start_time`이 기록됩니다 (처음 시작하는 경우만)
- 타이머가 시작되어 실시간으로 학습 시간을 표시합니다

#### 2. 일시정지/재개
- 학습 중 언제든지 일시정지를 할 수 있습니다
- 일시정지된 시간은 제외하고 실제 학습 시간만 계산합니다
- 일시정지 횟수(`pause_count`)와 총 일시정지 시간(`paused_duration_seconds`)을 추적합니다

#### 3. 학습 시간 표시
- 실시간으로 경과 시간을 표시합니다 (1초 단위 업데이트)
- 시간 형식:
  - 1시간 미만: `MM:SS` 형식 (예: `45:23`)
  - 1시간 이상: `HH:MM:SS` 형식 (예: `01:23:45`)
- 일시정지 횟수와 일시정지된 시간도 함께 표시됩니다

#### 4. 플랜 완료
- 완료 시 플랜의 `actual_end_time`이 기록됩니다
- 총 학습 시간(`total_duration_seconds`)이 계산되어 저장됩니다
- 실제 학습 시간 = 총 소요 시간 - 일시정지된 시간

### 데이터베이스 구조

#### `student_plan` 테이블
- `actual_start_time`: 플랜 시작 시간
- `actual_end_time`: 플랜 완료 시간
- `total_duration_seconds`: 총 소요 시간 (초 단위)
- `paused_duration_seconds`: 총 일시정지된 시간 (초 단위)
- `pause_count`: 일시정지 횟수

#### `student_study_sessions` 테이블
- `plan_id`: 연결된 플랜 ID
- `started_at`: 세션 시작 시간
- `ended_at`: 세션 종료 시간
- `paused_at`: 일시정지 시작 시간
- `resumed_at`: 재개 시간
- `paused_duration_seconds`: 이 세션에서 일시정지된 시간

### 타이머 버튼 클릭 시 프로세스

#### 시작하기 버튼 클릭 시

**클라이언트 사이드 (UI)**:
1. 사용자가 "시작하기" 버튼 클릭
2. Optimistic Update: 즉시 UI 업데이트
3. 로딩 상태 활성화
4. `startPlan(planId)` 서버 액션 호출

**서버 사이드 (데이터베이스)**:
1. 사용자 인증 확인
2. 플랜 조회
3. `startStudySession(planId)` 호출
   - 기존 활성 세션 확인
   - 기존 세션이 있으면 강제 종료
   - 새 세션 생성 (`student_study_sessions` 테이블에 INSERT)
4. `student_plan` 테이블 업데이트
   - `actual_start_time`: 현재 시간 (처음 시작하는 경우만)

**클라이언트 사이드 (UI 업데이트)**:
1. `startPlan` 성공 응답
2. `router.refresh()` 호출
3. 최신 데이터로 UI 업데이트
4. 로딩 상태 해제

#### 일시정지 버튼 클릭 시

**클라이언트 사이드 (UI)**:
1. 사용자가 "일시정지" 버튼 클릭
2. Optimistic Update: 즉시 UI 업데이트
3. 로딩 상태 활성화
4. `pausePlan(planId)` 서버 액션 호출

**서버 사이드 (데이터베이스)**:
1. 사용자 인증 확인
2. 활성 세션 조회
3. 세션 업데이트
   - `paused_at`: 현재 시간
   - `paused_duration_seconds` 계산 및 업데이트

**클라이언트 사이드 (UI 업데이트)**:
1. `pausePlan` 성공 응답
2. `router.refresh()` 호출
3. 최신 데이터로 UI 업데이트

### 경과 시간 계산

```typescript
const calculateElapsed = () => {
  if (actualStartTime) {
    const start = new Date(actualStartTime);
    const now = new Date();
    const total = Math.floor((now.getTime() - start.getTime()) / 1000);
    const paused = pausedDurationSeconds || 0;
    return Math.max(0, total - paused);
  }
  return 0;
};
```

### 시간 포맷팅

```typescript
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};
```

---

## 성능 최적화

### 현재 성능 지표
- `GET /today`: **1.8-2.4초** (render: 1.8-2.3s)
- `GET /api/today/plans`: **2.2-2.4초** (render: 2.2-2.3s)
- `POST /today`: **2.9-5.4초** (render: 2.9-5.4s)

### 주요 성능 병목 지점

#### 1. `/api/today/plans` API 엔드포인트 (2.2-2.4초)

**문제점**:
- 불필요한 전체 콘텐츠 조회
- 전체 진행률 조회
- 플랜이 없을 때 과도한 범위 조회

**개선 제안**:
- 플랜에 사용된 콘텐츠만 조회
- 플랜에 사용된 콘텐츠의 진행률만 조회
- 플랜이 없을 때 조회 범위 제한

#### 2. 1초마다 전체 API 호출

**문제점**:
- 1초마다 전체 API 호출하여 불필요한 네트워크 요청 발생

**개선 제안**:
- WebSocket 또는 Server-Sent Events 사용 고려
- React Query로 캐싱 및 자동 갱신 관리
- Optimistic Update 활용

---

## 버그 수정 이력

### 2025-01-22
- Today 페이지 재구성 작업 완료
- 컴포넌트 구조 명확화
- 타이머 로직 통합

### 2025-01-15
- 일시정지/재개 버그 수정
- 타임스탬프 누적 문제 해결
- useEffect 의존성 배열 크기 에러 수정

### 2025-01-14
- Optimistic Update 구현
- 타이머 버튼 느린 응답 문제 해결
- 타이머 필드 기반 접근 방식 분석

### 2025-01-13
- 타이머 로그 제거
- 데이터베이스 쿼리 최적화
- 불필요한 router.refresh 제거
- 클라이언트 타임스탬프 사용

---

## 향후 개선 제안

### 1. 성능 최적화
- WebSocket 또는 Server-Sent Events 사용 고려
- React Query로 캐싱 및 자동 갱신 관리
- 불필요한 데이터 조회 최소화

### 2. 사용자 경험 개선
- 로딩 상태 표시 개선
- 에러 처리 개선
- 오프라인 지원

### 3. 기능 추가
- 플랜 필터링 (완료/미완료)
- 플랜 정렬 (시간순, 진행률순)
- 플랜 검색

### 4. 접근성 개선
- 키보드 네비게이션
- 스크린 리더 지원
- ARIA 속성 추가

---

**작성일**: 2025-01-31  
**작성자**: AI Assistant  
**버전**: 1.0

