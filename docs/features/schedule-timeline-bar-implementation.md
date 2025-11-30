# 스케줄 타임라인 바 그래프 구현

## 개요

스케줄 미리보기 화면(Step 7)의 날짜별 학습시간 영역에 가로 방향 누적 타임라인 바를 추가하여 하루 일정의 시간 구성을 시각적으로 표현합니다.

## 구현 날짜

2025-11-30

## 구현 파일

### 1. TimelineBar 컴포넌트 (신규)

**경로**: `app/(student)/plan/new-group/_components/Step7ScheduleResult/TimelineBar.tsx`

#### 주요 기능

- **가로 누적 바 그래프**: 각 시간 슬롯이 비율에 따라 이어진 형태로 표시
- **색상 매핑**: 각 활동 타입별로 고유한 색상 적용
  - 학습시간: 파란색 (`bg-blue-500`)
  - 점심시간: 주황색 (`bg-orange-400`)
  - 학원일정: 보라색 (`bg-purple-500`)
  - 이동시간: 회색 (`bg-gray-400`)
  - 자율학습: 초록색 (`bg-green-500`)
- **시간 라벨**: 각 세그먼트 안에 시간 표시 (1시간 이상: "1.5h", 1시간 미만: "30m")
- **최소 너비 보장**: 짧은 시간(30분 미만)도 시각적으로 구별 가능하도록 최소 3% 너비 확보
- **범례**: 바 그래프 아래 색상별 활동 타입 안내

#### Props

```typescript
type TimelineBarProps = {
  timeSlots: Array<{
    type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
    start: string; // HH:mm 형식
    end: string;   // HH:mm 형식
    label?: string;
  }>;
  totalHours: number; // 전체 시간 (계산용, 현재는 사용하지 않음)
};
```

#### 반응형 디자인

- **모바일**: 바 높이 24px (`h-6`), 라벨 폰트 10px
- **데스크톱**: 바 높이 32px (`h-8`), 라벨 폰트 12px

#### 접근성

- **aria-label**: 전체 일정 구성을 텍스트로 설명 (스크린 리더용)
- **title 속성**: 각 세그먼트에 마우스 호버 시 상세 정보 표시 (시작/종료 시간 포함)

### 2. ScheduleTableView 수정 (Step 7)

**경로**: `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`

#### 변경 사항

1. **Import 추가**: TimelineBar 컴포넌트 임포트
2. **타임라인 바 통합**: 기존 텍스트 기반 시간 정보 아래에 타임라인 바 추가

```typescript
{/* 타임라인 바 그래프 */}
{schedule.time_slots && schedule.time_slots.length > 0 && (
  <TimelineBar 
    timeSlots={schedule.time_slots}
    totalHours={studyHours + selfStudyHours + travelHours + academyHours}
  />
)}
```

### 3. SchedulePreviewPanel 수정 (Step 2)

**경로**: `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`

#### 변경 사항

1. **Import 추가**: TimelineBar 컴포넌트 임포트
2. **타임라인 바 통합**: Step 2의 주차별 스케줄 미리보기에서 각 날짜 카드에 타임라인 바 추가
3. **시간 계산 로직 추가**: Step 7과 동일한 방식으로 각 시간 타입별 시간 계산

Step 2에서는 주차별로 그룹화된 스케줄을 보여주며, 각 날짜 카드에 타임라인 바가 표시됩니다. 이를 통해 사용자가 시간 설정을 변경할 때 실시간으로 시간 구성을 시각적으로 확인할 수 있습니다.

## 사용 시나리오

### 예시 1: 일반 학습일

**시간 구성**:
- 09:00-12:00: 학습시간 (3시간)
- 12:00-13:00: 점심시간 (1시간)
- 13:00-18:00: 학습시간 (5시간)
- 18:00-21:00: 자율학습 (3시간)

**결과**: 파란색(3h) - 주황색(1h) - 파란색(5h) - 초록색(3h)의 연속된 바로 표시

### 예시 2: 학원이 있는 날

**시간 구성**:
- 09:00-12:00: 학습시간 (3시간)
- 12:00-13:00: 점심시간 (1시간)
- 13:00-14:00: 이동시간 (1시간)
- 14:00-17:00: 학원일정 (3시간)
- 17:00-20:00: 학습시간 (3시간)

**결과**: 파란색(3h) - 주황색(1h) - 회색(1h) - 보라색(3h) - 파란색(3h)의 바로 표시

### 예시 3: 지정휴일

**시간 구성**:
- 09:00-21:00: 자율학습 (12시간)

**결과**: 초록색(12h)의 단일 바로 표시

## 기술적 특징

### 1. 시간 계산

- `timeToMinutes()` 함수: HH:mm 형식의 시간을 분으로 변환
- 각 슬롯의 duration을 계산하여 비율 산출
- 전체 시간 대비 백분율로 너비 결정

### 2. 최소 너비 보장

```typescript
const minWidthPercentage = 3; // 최소 3%
const displayPercentage = Math.max(percentage, minWidthPercentage);
```

짧은 시간 슬롯도 시각적으로 표현되도록 최소 3% 너비 보장

### 3. 라벨 표시 조건

```typescript
const showLabel = slot.durationMinutes >= 30;
```

30분 이상의 슬롯에만 시간 라벨 표시 (공간 제약 고려)

### 4. 시간 포맷

- 1시간 이상: "1.5h", "3.0h" 형식
- 1시간 미만: "30m", "45m" 형식

## 스타일링 가이드

### Tailwind CSS 클래스

- **컨테이너**: `flex h-6 md:h-8 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm`
- **세그먼트**: `flex items-center justify-center {color} text-white transition-all`
- **라벨**: `text-[10px] md:text-xs font-semibold truncate px-1`
- **범례**: `mt-1.5 flex flex-wrap gap-2 text-[10px] text-gray-600`

### 색상 팔레트

| 활동 타입 | Tailwind 클래스 | 용도 |
|----------|----------------|------|
| 학습시간 | `bg-blue-500` | 계획된 학습 시간 |
| 점심시간 | `bg-orange-400` | 식사 시간 |
| 학원일정 | `bg-purple-500` | 학원 수업 시간 |
| 이동시간 | `bg-gray-400` | 학원 이동 시간 |
| 자율학습 | `bg-green-500` | 자율적인 학습 시간 |

## 향후 개선 가능 사항

1. **실시간 시간 표시**: 현재 시간을 바 위에 표시하여 진행 상황 시각화
2. **인터랙티브 기능**: 세그먼트 클릭 시 해당 시간대 플랜 상세 정보 표시
3. **애니메이션**: 바 그래프 렌더링 시 부드러운 애니메이션 효과
4. **커스터마이징**: 사용자가 색상 테마 변경 가능하도록 설정 추가
5. **비교 뷰**: 여러 날짜의 타임라인을 나란히 비교할 수 있는 뷰 제공

## 테스트 케이스

### 정상 케이스

- [x] 다양한 시간 구성 (학습, 점심, 학원, 이동, 자율)
- [x] 긴 학습 시간 (8시간 이상)
- [x] 짧은 학습 시간 (30분 미만)
- [x] 단일 슬롯 (지정휴일 등)
- [x] 여러 슬롯의 조합

### 엣지 케이스

- [x] time_slots가 없는 경우 (null 처리)
- [x] time_slots가 빈 배열인 경우
- [x] 매우 짧은 슬롯 (5분, 10분)
- [x] 24시간 전체가 하나의 슬롯인 경우

### 반응형 테스트

- [x] 모바일 화면 (작은 너비)
- [x] 태블릿 화면
- [x] 데스크톱 화면 (큰 너비)

## 관련 파일

- `lib/types/plan.ts`: DailyScheduleInfo 타입 정의
- `app/(student)/plan/calendar/_utils/timelineUtils.ts`: 타임라인 관련 유틸리티 함수
- `app/(student)/plan/calendar/_components/`: 캘린더 뷰에서도 유사한 타임라인 구현

## 참고 사항

- 이 구현은 스케줄 생성 마법사의 **Step 2 (시간 설정 및 스케줄 확인)**와 **Step 7 (스케줄 결과)** 두 곳에 적용됩니다.
- Step 2: 실시간 미리보기 패널에서 주차별 스케줄 확인 시 각 날짜별 타임라인 바 표시
- Step 7: 최종 스케줄 결과 테이블에서 각 날짜별 타임라인 바 표시
- 캘린더 뷰(`/plan/calendar`)에는 별도의 타임라인 표시 방식이 이미 구현되어 있습니다.
- 색상 스키마는 기존 시스템과 일관성을 유지하도록 설계되었습니다.

