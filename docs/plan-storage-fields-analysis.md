# 플랜 저장 필드 분석 및 의도 해석

## 사용자 의도 해석

### 핵심 요구사항

**Step7 타임라인 테이블에 표시되는 모든 정보를 플랜 캘린더에서도 동일하게 표시해야 함**

### Step7 테이블 컬럼 분석

| 컬럼 | 표시 내용 | 저장 필요 여부 | 현재 상태 |
|------|----------|--------------|----------|
| **시간** | `11:18 ~ 12:00` | ✅ 필요 | `start_time`, `end_time` ✅ |
| **교과** | `content_subject_category` | ✅ 필요 | denormalized 필드 ✅ |
| **과목** | `content_subject` | ✅ 필요 | denormalized 필드 ✅ |
| **유형** | 교재/강의 | ✅ 필요 | `content_type`으로 판단 가능 ✅ |
| **이름** | `content_title` | ✅ 필요 | denormalized 필드 ✅ |
| **학습내역** | `chapter` | ✅ 필요 | `chapter` 필드 ✅ |
| **회차** | 계산된 순서 | ⚠️ 고려 필요 | 계산 가능하지만 저장 고려 |
| **학습 분량** | `1-14p` | ✅ 필요 | `planned_start_page_or_time`, `planned_end_page_or_time` ✅ |
| **소요시간** | `(42분)` | ❌ 불필요 | `start_time`, `end_time`으로 계산 가능 |

### 상태뱃지 분석

Step7에서 표시되는 상태뱃지:
- `(일부)` - `isPartial: true`인 경우
- `[이어서]` - `isContinued: true`인 경우 (이전 블록에서 이어지는 경우)

**이 정보는 저장되어야 함** - 캘린더에서 동일하게 표시하기 위해

## 저장해야 할 필드 정리

### 1. 기본 정보 (이미 저장됨)

```typescript
{
  plan_date: string;                    // 날짜 ✅
  content_type: "book" | "lecture";     // 유형 (교재/강의) ✅
  content_id: string;                   // 콘텐츠 ID ✅
  planned_start_page_or_time: number;   // 학습 분량 시작 ✅
  planned_end_page_or_time: number;     // 학습 분량 종료 ✅
  chapter: string | null;               // 학습내역 ✅
}
```

### 2. Denormalized 필드 (이미 저장됨)

```typescript
{
  content_title: string | null;              // 이름 ✅
  content_subject: string | null;            // 과목 ✅
  content_subject_category: string | null;   // 교과 ✅
  content_category: string | null;           // 콘텐츠 카테고리 ✅
}
```

### 3. 시간 정보 (이미 추가됨)

```typescript
{
  start_time: string | null;  // 시작 시간 (HH:mm) ✅
  end_time: string | null;    // 종료 시간 (HH:mm) ✅
}
```

### 4. 상태뱃지 정보 (추가 필요 ⚠️)

```typescript
{
  is_partial: boolean;        // (일부) 표시 여부 - 새로 추가 필요
  is_continued: boolean;      // [이어서] 표시 여부 - 새로 추가 필요
}
```

### 5. 유형 정보 (학습일/복습일/지정휴일) (저장 필요 ✅)

```typescript
{
  day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
  // 날짜별로 계산 가능하지만 조회 성능 및 필터링을 위해 저장 필요
  // plan_groups.daily_schedule에서 가져올 수 있음
}
```

### 6. 주차 정보 (저장 필요 ✅)

```typescript
{
  week: number | null;  // 주차 번호 (1주차, 2주차, ...)
  day: number | null;   // 해당 주의 일차 (1일, 2일, ...)
  // period_start 기준으로 계산 가능하지만 조회 성능을 위해 저장 필요
}
```

#### 주차 계산 방법

현재 코드베이스에는 **두 가지 주차 계산 방법**이 있습니다:

**방법 1: 간단한 주차 계산 (`calculateWeekNumber` in `scheduleTransform.ts`)**
- **규칙**: `period_start`부터 시작하여 7일 단위로 주차 계산
- **공식**: 
  ```typescript
  diffDays = (planDate - periodStart) 일수
  week = Math.floor(diffDays / 7) + 1
  day = (diffDays % 7) + 1
  ```
- **특징**: 
  - 제외일을 고려하지 않음
  - 모든 날짜를 포함하여 계산
  - 예: 시작일이 수요일이면 수요일=1주차-1일, 목요일=1주차-2일, ...

**방법 2: 1730 Timetable 주차 계산 (`calculateWeeksFor1730` in `calculateAvailableDates.ts`)**
- **규칙**: 제외일(휴가, 개인사정, 지정휴일)을 제외한 날짜만으로 7일 단위 주차 계산
- **특징**:
  - 제외일은 주차 계산에서 완전히 제외
  - 제외일이 아닌 날짜만으로 주차 구성
  - 예: 제외일이 2일 있으면, 실제 학습 가능한 날짜만으로 주차 계산

**권장 방법:**
- **1730 Timetable 스케줄러**: 방법 2 사용 (제외일 제외)
- **자동 스케줄러**: 방법 1 사용 (간단한 7일 단위)
- **플랜 저장 시**: `calculateAvailableDates` 결과의 `week_number` 사용 (이미 계산되어 있음)

### 7. 회차 정보 (계산 가능하지만 저장 고려)

```typescript
{
  sequence: number | null;  // 같은 콘텐츠의 순서 - 계산 가능하지만 저장 고려
}
```

## 의도 해석 요약

### 사용자가 원하는 것

1. **Step7에서 보여주는 모든 정보를 캘린더에서도 동일하게 표시**
2. **시간 정보는 `start_time`, `end_time`으로 저장** (이미 완료)
3. **상태뱃지(`일부`, `이어서`) 정보도 저장 필요** ⚠️
4. **소요시간은 저장 불필요** (start_time, end_time으로 계산 가능)
5. **회차는 계산 가능하지만, 성능을 위해 저장 고려 가능**

### 추가로 필요한 작업

1. **상태뱃지 필드 추가**
   - `is_partial`: 플랜이 일부만 배치된 경우 (예: 첫 번째 블록에서 일부만 배치)
   - `is_continued`: 이전 블록에서 이어서 배치된 경우 (예: 두 번째 블록에서 이어서)

2. **플랜 생성 시 상태뱃지 정보 저장**
   - `assignPlanTimes` 함수에서 `isPartial`, `isContinued` 정보를 함께 반환
   - `_generatePlansFromGroup`에서 이 정보를 저장

3. **캘린더 표시 시 상태뱃지 표시**
   - 저장된 `is_partial`, `is_continued` 정보를 기반으로 뱃지 표시

## 저장 필드 최종 정리

### 필수 저장 필드

```typescript
{
  // 기본 정보
  plan_date: string;
  plan_group_id: string;
  block_index: number;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  chapter: string | null;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  
  // 시간 정보
  start_time: string | null;  // HH:mm
  end_time: string | null;    // HH:mm
  
  // 상태뱃지 정보 (새로 추가 필요)
  is_partial: boolean;         // (일부) 표시 여부
  is_continued: boolean;       // [이어서] 표시 여부
  
  // 날짜 유형 정보 (새로 추가 필요)
  day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
  
  // 주차 정보 (새로 추가 필요)
  week: number | null;  // 주차 번호
  day: number | null;   // 해당 주의 일차
  
  // Denormalized 필드
  content_title: string | null;
  content_subject: string | null;
  content_subject_category: string | null;
  content_category: string | null;
}
```

### 필수 저장 필드 (추가 필요)

```typescript
{
  day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
  // 캘린더에서 날짜별 스타일링 및 필터링에 필요
  
  week: number | null;  // 주차 번호 (1주차, 2주차, ...)
  day: number | null;   // 해당 주의 일차 (1일, 2일, ...)
  // 캘린더에서 주차별 그룹화 및 표시에 필요
}
```

### 선택적 저장 필드 (성능 최적화용)

```typescript
{
  sequence: number | null;                // 계산 가능하지만 조회 성능 향상
  estimated_duration_minutes: number | null;  // 소요시간 (분) - 계산 가능하지만 조회 성능 향상
}
```

## 구현 우선순위

### 1단계: 필수 필드 추가 (즉시 구현)

1. **상태뱃지 필드 추가**
   - `is_partial`, `is_continued` 컬럼 추가 (마이그레이션)
   - `assignPlanTimes` 함수에서 상태뱃지 정보 반환
   - `_generatePlansFromGroup`에서 상태뱃지 정보 저장
   - 캘린더 표시 시 상태뱃지 표시

2. **날짜 유형 필드 추가**
   - `day_type` 컬럼 추가 (마이그레이션)
   - `plan_groups.daily_schedule`에서 날짜별 `day_type` 정보 가져오기
   - `_generatePlansFromGroup`에서 `day_type` 저장
   - 캘린더 표시 시 날짜별 스타일링 적용

3. **주차 정보 필드 추가**
   - `week`, `day` 컬럼 추가 (마이그레이션)
   - **주차 계산 방법 선택**:
     - 1730 Timetable: `calculateAvailableDates` 결과의 `week_number` 사용 (제외일 제외)
     - 자동 스케줄러: `calculateWeekNumber` 함수 사용 (간단한 7일 단위)
   - `_generatePlansFromGroup`에서 주차 정보 저장
   - 캘린더 표시 시 주차별 그룹화 및 표시

### 2단계: 선택적 필드 추가 (성능 최적화)

1. `day_type`, `sequence`, `estimated_duration_minutes` 컬럼 추가 검토
2. 플랜 생성 시 계산하여 저장
3. 캘린더 조회 시 계산 로직 제거하여 성능 향상

## 결론

**사용자의 핵심 의도:**
- Step7 타임라인 테이블의 모든 정보를 캘린더에서도 동일하게 표시
- 시간 정보는 이미 저장됨 ✅
- **상태뱃지 정보(`일부`, `이어서`)는 새로 추가 필요** ⚠️
- 소요시간은 저장 불필요 (계산 가능)
- 회차는 계산 가능하지만 성능을 위해 저장 고려 가능

