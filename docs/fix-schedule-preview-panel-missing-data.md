# 스케줄 미리보기 패널 데이터 전달 수정

## 문제 상황

스케줄 미리보기 탭에서 시간블록 계산이나 통계, 제외일/학습일 등의 계산이 보이지 않았습니다.

### 원인
- `SchedulePreviewPanel`에 `blockSets` prop이 전달되지 않았음
- `campTemplateId`가 전달되지 않아 캠프 모드에서 계산이 실패할 수 있었음
- `SchedulePreviewPanel`이 스케줄 계산을 수행하려면 `blockSets`가 필요함

## 수정 내용

### 1. SchedulePreviewPanel에 blockSets 전달
- `PlanGroupDetailView`에서 `SchedulePreviewPanel`을 호출할 때 `blockSets` prop 전달
- `blockSets`는 `PlanGroupDetailPage`에서 조회하여 전달

### 2. campTemplateId 추가
- `PlanGroupDetailViewProps`에 `campTemplateId` prop 추가
- 캠프 모드일 때 `group.camp_template_id`를 전달하여 템플릿 블록 조회 가능하도록 수정

### 3. isCampMode 전달
- `campSubmissionMode`를 `isCampMode`로 전달하여 캠프 모드 여부 확인

## 수정된 파일

- `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`
- `app/(student)/plan/group/[id]/page.tsx`

## 주요 변경사항

### Before
```tsx
<SchedulePreviewPanel 
  data={wizardData}
  onUpdate={() => {}}
  editable={false}
  studentId={group.student_id}
/>
```

### After
```tsx
<SchedulePreviewPanel 
  data={wizardData}
  onUpdate={() => {}} // 읽기 전용 - 변경 불가
  blockSets={blockSets}
  isCampMode={campSubmissionMode}
  campTemplateId={campTemplateId || undefined}
/>
```

## 동작 방식

### SchedulePreviewPanel 계산 과정
1. `blockSets`에서 선택된 블록 세트의 블록 데이터 추출
2. `wizardData`에서 필요한 파라미터 추출:
   - `period_start`, `period_end`
   - `scheduler_type`
   - `block_set_id`
   - `exclusions`
   - `academy_schedules`
   - `scheduler_options`
   - `time_settings`
3. `calculateScheduleAvailability`를 호출하여 스케줄 계산
4. 계산 결과 표시:
   - 총 기간, 제외일, 학습일, 총 학습 시간 통계
   - 주차별 스케줄 미리보기

## 테스트

- [x] 린터 에러 확인 완료
- [x] blockSets prop 전달 확인
- [x] campTemplateId prop 전달 확인
- [ ] 스케줄 계산 결과 표시 확인 필요

