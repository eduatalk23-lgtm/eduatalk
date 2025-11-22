# /today 페이지 플랜 목록 데이터 흐름

## 데이터 흐름 개요

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

## 상세 데이터 흐름

### 1단계: API 엔드포인트 호출

**위치**: `app/api/today/plans/route.ts`

**요청**: `GET /api/today/plans`

**처리 과정**:
1. 사용자 인증 확인
2. 오늘 날짜 계산 (`YYYY-MM-DD` 형식)
3. 오늘 플랜 조회

### 2단계: 플랜 조회

**함수**: `getPlansForStudent()`

**위치**: `lib/data/studentPlans.ts`

**SQL 쿼리** (실제 실행되는 쿼리):
```sql
SELECT 
  id,
  tenant_id,
  student_id,
  plan_date,
  block_index,
  content_type,
  content_id,
  chapter,
  planned_start_page_or_time,
  planned_end_page_or_time,
  completed_amount,
  progress,
  is_reschedulable,
  plan_group_id,
  start_time,
  end_time,
  actual_start_time,
  actual_end_time,
  total_duration_seconds,
  paused_duration_seconds,
  pause_count,
  plan_number,
  sequence,
  day_type,
  week,
  day,
  is_partial,
  is_continued,
  content_title,
  content_subject,
  content_subject_category,
  content_category,
  memo,
  created_at,
  updated_at
FROM student_plan
WHERE student_id = :studentId
  AND plan_date = :todayDate
  AND (tenant_id = :tenantId OR tenant_id IS NULL)
ORDER BY plan_date ASC, block_index ASC
```

**필터 조건**:
- `student_id`: 현재 로그인한 학생 ID
- `plan_date`: 오늘 날짜 (YYYY-MM-DD)
- `tenant_id`: 테넌트 ID (있는 경우)

**오늘 플랜이 없을 경우**:
1. 30일 범위로 미래 플랜 조회
2. 없으면 180일 범위로 확장 조회
3. 가장 가까운 날짜의 플랜 선택

### 3단계: 콘텐츠 정보 조회

**조회 대상**:
- `books` 테이블 (content_type = "book")
- `lectures` 테이블 (content_type = "lecture")
- `student_custom_contents` 테이블 (content_type = "custom")

**함수**:
- `getBooks(userId, tenantId)`
- `getLectures(userId, tenantId)`
- `getCustomContents(userId, tenantId)`

### 4단계: 진행률 조회

**테이블**: `student_content_progress`

**SQL 쿼리**:
```sql
SELECT 
  content_type,
  content_id,
  progress
FROM student_content_progress
WHERE student_id = :studentId
```

**목적**: 각 콘텐츠의 전체 진행률 조회

### 5단계: 활성 세션 조회

**테이블**: `student_study_sessions`

**SQL 쿼리**:
```sql
SELECT 
  plan_id,
  paused_at,
  resumed_at
FROM student_study_sessions
WHERE student_id = :studentId
  AND ended_at IS NULL
```

**목적**: 현재 진행 중인 학습 세션 확인 (일시정지 상태 포함)

### 6단계: 데이터 변환

**변환 로직**:
```typescript
plans.map((plan) => {
  const contentKey = `${plan.content_type}:${plan.content_id}`;
  const content = contentMap.get(contentKey);
  const progress = progressMap.get(contentKey) ?? null;
  const session = sessionMap.get(plan.id);

  return {
    ...plan,  // 원본 플랜 데이터
    content,  // 콘텐츠 상세 정보
    progress, // 진행률
    session: session ? {
      isPaused: session.isPaused,
      pausedAt: session.pausedAt,
      resumedAt: session.resumedAt,
    } : undefined,
  };
});
```

### 7단계: 그룹화

**함수**: `groupPlansByPlanNumber()`

**위치**: `app/(student)/today/_utils/planGroupUtils.ts`

**로직**: 같은 `plan_number`를 가진 플랜들을 하나의 그룹으로 묶음

## 최종 응답 데이터 구조

```typescript
{
  plans: PlanWithContent[],  // 플랜 목록
  sessions: {                 // 활성 세션 정보
    [planId: string]: {
      isPaused: boolean;
      pausedAt?: string | null;
      resumedAt?: string | null;
    }
  },
  planDate: string,           // 표시 중인 날짜 (YYYY-MM-DD)
  isToday: boolean            // 오늘 날짜인지 여부
}
```

## PlanWithContent 타입 구조

```typescript
type PlanWithContent = Plan & {
  content?: Book | Lecture | CustomContent;  // 콘텐츠 상세 정보
  progress?: number | null;                  // 진행률 (0-100)
  session?: {                                 // 세션 정보
    isPaused: boolean;
    pausedAt?: string | null;
    resumedAt?: string | null;
  };
};
```

## Plan 타입 구조 (주요 필드)

```typescript
{
  id: string;                              // 플랜 ID
  plan_date: string;                       // 플랜 날짜 (YYYY-MM-DD)
  block_index: number;                     // 블록 인덱스
  content_type: "book" | "lecture" | "custom";
  content_id: string;                      // 콘텐츠 ID
  chapter?: string | null;                 // 챕터
  planned_start_page_or_time: number;      // 계획된 시작 페이지/시간
  planned_end_page_or_time: number;        // 계획된 종료 페이지/시간
  completed_amount?: number | null;         // 완료된 양
  progress?: number | null;                 // 진행률
  actual_start_time?: string | null;        // 실제 시작 시간
  actual_end_time?: string | null;          // 실제 종료 시간
  total_duration_seconds?: number | null;   // 총 학습 시간 (초)
  paused_duration_seconds?: number | null;  // 일시정지 시간 (초)
  pause_count?: number | null;              // 일시정지 횟수
  plan_number?: number | null;              // 플랜 번호 (같은 논리적 플랜은 같은 번호)
  sequence?: number | null;                 // 회차
  memo?: string | null;                     // 메모
  // ... 기타 필드
}
```

## 실제 데이터 확인 방법

### 방법 1: 브라우저 개발자 도구

1. 브라우저에서 `/today` 페이지 열기
2. 개발자 도구 열기 (F12)
3. Network 탭 선택
4. `/api/today/plans` 요청 찾기
5. Response 탭에서 JSON 데이터 확인

### 방법 2: API 엔드포인트에 로그 추가

API 엔드포인트에 `console.log`를 추가하여 서버 콘솔에서 확인 가능

### 방법 3: 클라이언트에서 로그 추가

`PlanViewContainer` 컴포넌트에서 데이터를 받은 후 `console.log`로 확인

## 데이터 조회 최적화

1. **병렬 처리**: 콘텐츠 정보 조회를 `Promise.all`로 병렬 처리
2. **조건부 조회**: 필요한 콘텐츠 타입만 조회
3. **인덱스 활용**: `student_id`, `plan_date`, `block_index`에 인덱스 사용
4. **캐싱**: 1초마다 자동 갱신하지만, 불필요한 재조회 방지

## 참고사항

- 플랜 데이터는 `student_plan` 테이블에서 조회
- 콘텐츠 정보는 별도 테이블에서 조회 후 조합
- 진행률은 `student_content_progress` 테이블에서 조회
- 활성 세션은 `student_study_sessions` 테이블에서 조회
- 같은 `plan_number`를 가진 플랜들은 하나의 논리적 플랜으로 그룹화됨

