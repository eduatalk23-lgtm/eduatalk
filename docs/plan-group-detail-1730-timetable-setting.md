# 플랜그룹 상세페이지 블록 및 제외일 탭에 1730 Timetable 전용설정 UI 추가

## 작업 개요

플랜그룹 목록의 상세페이지에서 "블록 및 제외일" 탭에 1730 Timetable 전용설정의 "자율학습시간 사용 가능" 체크 여부를 표시하는 UI를 추가했습니다.

## 변경 사항

### 수정된 파일

- `app/(student)/plan/group/[id]/_components/Step2DetailView.tsx`

### 주요 변경 내용

1. **1730 Timetable 전용 설정 섹션 추가**
   - `scheduler_type`이 `"1730_timetable"`인 경우에만 표시되는 섹션 추가
   - `scheduler_options`에서 `time_settings` 추출 로직 추가
   - "자율학습시간 사용 가능" 체크 여부 표시

2. **UI 구조**
   - 제목 섹션 아래에 1730 Timetable 전용 설정 섹션 배치
   - 블록 세트 정보 섹션 위에 위치
   - `Step2_5DetailView.tsx`와 동일한 스타일 및 구조 적용

3. **표시 조건**
   - `group.scheduler_type === "1730_timetable"`인 경우에만 표시
   - `use_self_study_with_blocks` 값이 `undefined`가 아닌 경우에만 표시
   - 체크된 경우: "✓ 사용 가능" (녹색)
   - 체크되지 않은 경우: "✗ 사용 안 함" (회색)

## 구현 세부사항

```typescript
// scheduler_options에서 time_settings 추출
const schedulerOptions = (group.scheduler_options as any) || {};
const timeSettings = {
  lunch_time: schedulerOptions.lunch_time,
  camp_study_hours: schedulerOptions.camp_study_hours,
  camp_self_study_hours: schedulerOptions.camp_self_study_hours,
  designated_holiday_hours: schedulerOptions.designated_holiday_hours,
  use_self_study_with_blocks: schedulerOptions.use_self_study_with_blocks,
};

// 1730 Timetable 전용 설정 표시
{group.scheduler_type === "1730_timetable" && (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
    <h3 className="mb-2 text-sm font-semibold text-gray-900">1730 Timetable 전용 설정</h3>
    <div className="space-y-2 text-sm text-gray-700">
      {timeSettings.use_self_study_with_blocks !== undefined && (
        <div className="flex items-center gap-2">
          <span className="font-medium">자율학습시간 사용 가능:</span>
          <span className={timeSettings.use_self_study_with_blocks ? "text-green-600" : "text-gray-500"}>
            {timeSettings.use_self_study_with_blocks ? "✓ 사용 가능" : "✗ 사용 안 함"}
          </span>
        </div>
      )}
    </div>
  </div>
)}
```

## 테스트 방법

1. 플랜그룹 목록에서 1730 Timetable을 사용하는 플랜그룹 선택
2. 상세페이지에서 "블록 및 제외일" 탭 클릭
3. "1730 Timetable 전용 설정" 섹션이 표시되는지 확인
4. "자율학습시간 사용 가능" 체크 여부가 올바르게 표시되는지 확인
5. 자동스케줄러를 사용하는 플랜그룹에서는 해당 섹션이 표시되지 않는지 확인

## 관련 파일

- `app/(student)/plan/group/[id]/_components/Step2_5DetailView.tsx` - 스케줄 미리보기 탭 (동일한 설정 표시)
- `app/(student)/plan/new-group/_components/Step2BlocksAndExclusions.tsx` - 플랜그룹 생성 시 설정 입력

## 참고사항

- `Step2_5DetailView.tsx`와 동일한 로직 및 스타일을 사용하여 일관성 유지
- 1730 Timetable이 아닌 스케줄러 타입에서는 해당 설정이 표시되지 않음
- `use_self_study_with_blocks` 값이 `undefined`인 경우 표시하지 않음

