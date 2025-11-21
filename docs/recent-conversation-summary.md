# 최근 대화 요약 및 구현 계획

## 대화 요약

### 1. 문제 발견: Step7 타임라인 시간 정보 저장

**사용자 요구사항:**
- Step7 타임라인 테이블에 표시되는 시간 정보(예: "10:00 ~ 11:18")를 `student_plan` 테이블에 저장
- 현재는 `studyTimeSlots`의 전체 시간 범위를 저장하여 Step7 표시와 불일치

**해결 방안:**
- Step7의 `TimeSlotsWithPlans` 로직을 서버 액션에 통합
- 플랜의 실제 소요시간을 계산하여 정확한 시작/종료 시간 저장

### 2. 쪼개진 플랜 처리 문제

**발견:**
- 하나의 플랜이 여러 블록에 걸쳐 쪼개져서 표시됨 (예: "10:00 ~ 11:18", "11:18 ~ 12:00")
- 현재는 하나의 레코드로만 저장하여 두 번째 블록 이후의 시간 정보 손실

**해결 방안:**
- 하나의 플랜을 여러 레코드로 쪼개서 저장
- 각 레코드는 동일한 `plan_group_id`, `plan_date`, `content_id`, `planned_start_page_or_time`, `planned_end_page_or_time`을 가짐
- 각 레코드는 다른 `block_index`, `start_time`, `end_time`을 가짐
- 식별 방법: 위 5개 필드 조합으로 같은 논리적 플랜 식별

### 3. 저장해야 할 필드 정리

**Step7 테이블 컬럼 분석:**
- 시간: `start_time`, `end_time` ✅ (이미 추가됨)
- 교과/과목/이름: denormalized 필드 ✅ (이미 있음)
- 학습내역: `chapter` ✅ (이미 있음)
- 학습 분량: `planned_start_page_or_time`, `planned_end_page_or_time` ✅ (이미 있음)
- 상태뱃지: `(일부)`, `[이어서]` ⚠️ (추가 필요)
- 날짜 유형: 학습일/복습일/지정휴일 ⚠️ (추가 필요)
- 주차 정보: 주차 번호, 해당 주의 일차 ⚠️ (추가 필요)
- 소요시간: 저장 불필요 (계산 가능)
- 회차: 계산 가능하지만 저장 고려

### 4. 주차 계산 방법 정리

**두 가지 방법:**
1. **간단한 방법** (`calculateWeekNumber`): 7일 단위, 제외일 포함
2. **1730 Timetable 방법** (`calculateWeeksFor1730`): 제외일 제외한 7일 단위

**권장:**
- `calculateAvailableDates` 결과의 `week_number` 사용 (이미 계산되어 있음)
- 스케줄러 타입에 따라 일차(day) 계산 방법 선택

## 구현 완료 사항

### ✅ 1. 데이터베이스 마이그레이션 생성
- `day_type`, `week`, `day`, `is_partial`, `is_continued` 컬럼 추가
- 인덱스 추가 (조회 성능 최적화)

### ✅ 2. 날짜별 메타데이터 매핑 생성
- `calculateAvailableDates` 결과에서 `day_type`, `week_number` 추출
- 주차별 날짜 목록 구성 (일차 계산용)

### ✅ 3. 주차별 일차(day) 계산 로직 구현
- 1730 Timetable: 같은 주차의 날짜 목록에서 순서 계산
- 자동 스케줄러: 간단한 7일 단위 계산

### ✅ 4. 플랜 저장 시 정보 포함
- `day_type`, `week`, `day` 정보 저장
- `is_partial`, `is_continued` 필드 추가 (현재는 false, 추후 assignPlanTimes에서 계산)

## 다음 단계

### ⏳ 남은 작업

1. **상태뱃지 정보 계산 및 저장**
   - `assignPlanTimes` 함수 구현 (Step7 로직 이식)
   - 플랜의 실제 소요시간 계산
   - 쪼개진 플랜 처리 (`is_partial`, `is_continued` 계산)
   - 각 쪼개진 부분마다 별도 레코드 생성

2. **쪼개진 플랜 처리 로직 구현**
   - 하나의 플랜이 여러 블록에 걸쳐 배치되는 경우 처리
   - 각 쪼개진 부분의 정확한 시간 계산

3. **캘린더 표시 로직 업데이트**
   - 저장된 `day_type`, `week`, `day` 정보 사용
   - 상태뱃지 표시 (`is_partial`, `is_continued`)

## 최종 저장 필드

```typescript
{
  // 기본 정보
  plan_date, plan_group_id, block_index,
  content_type, content_id, chapter,
  planned_start_page_or_time, planned_end_page_or_time,
  
  // 시간 정보
  start_time, end_time,
  
  // 날짜 유형 및 주차 정보 ✅ (구현 완료)
  day_type,  // 학습일/복습일/지정휴일/휴가/개인일정
  week,      // 주차 번호
  day,       // 해당 주의 일차
  
  // 상태뱃지 정보 (필드 추가 완료, 계산 로직 필요)
  is_partial,    // (일부) 표시 여부
  is_continued, // [이어서] 표시 여부
  
  // Denormalized 필드
  content_title, content_subject, content_subject_category
}
```
