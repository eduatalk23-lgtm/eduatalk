# 플랜 위자드 개선 작업 완료 보고서

## 작업 일시
2024년 11월 30일

## 주요 변경사항

### 1. 시간 관리 불러오기 개편

#### 1.1 학습 제외일 선택 등록 구현
- **변경 전**: 자동 병합 방식 (중복 제거)
- **변경 후**: 모달 선택 등록 방식
- **새 파일**: `app/(student)/plan/new-group/_components/_panels/_modals/ExclusionImportModal.tsx`
- **주요 기능**:
  - 플랜 기간 내 제외일 목록 표시
  - 체크박스로 다중 선택
  - 같은 날짜 중복 방지
  - 이미 등록된 항목 비활성화 표시

#### 1.2 학원 일정 선택 등록 구현
- **변경 전**: 자동 병합 방식 (요일+시간 키 비교)
- **변경 후**: 모달 선택 등록 + 시간대 겹침 검증
- **새 파일**: 
  - `app/(student)/plan/new-group/_components/_panels/_modals/AcademyScheduleImportModal.tsx`
  - `lib/validation/scheduleValidator.ts`
- **주요 기능**:
  - 요일별 그룹화된 학원 일정 목록
  - 체크박스로 다중 선택
  - 이동시간 포함한 실제 시간대 겹침 검증
  - 겹치는 일정 경고 표시

### 2. 학원 일정 시간대 겹침 검증

#### 새 유틸리티 함수
**파일**: `lib/validation/scheduleValidator.ts`

**주요 함수**:
```typescript
validateAcademyScheduleOverlap(
  newSchedule: AcademySchedule,
  existingSchedules: AcademySchedule[]
): { isValid: boolean; conflictSchedules: AcademySchedule[] }
```

**검증 로직**:
- 이동시간 포함한 실제 제외 시간 계산
- 같은 요일 내 시간대 겹침 확인
- 겹치는 일정 목록 반환

**적용 위치**:
- `AcademySchedulePanel`: 수동 추가 시
- `AcademyScheduleImportModal`: 불러오기 선택 시

### 3. Step 2와 Step 3 분리

#### 3.1 Step 구조 재정의

**변경 전**:
- Step 1: 기본 정보
- Step 2: 블록 및 제외일 + 스케줄 미리보기 (통합)
- Step 3: 콘텐츠 선택 (실제 Step 4)
- Step 4: 최종 확인 (실제 Step 6)
- Step 5: 스케줄 결과 (실제 Step 7)

**변경 후**:
- Step 1: 기본 정보
- Step 2: 블록 및 제외일 설정
- Step 3: 스케줄 미리보기
- Step 4: 콘텐츠 선택
- Step 5: 최종 확인
- Step 6: 스케줄 결과

#### 3.2 컴포넌트 변경

**파일 변경**:
- `Step2TimeSettingsWithPreview.tsx` → `Step2TimeSettings.tsx`
- 좌우 분할 레이아웃 제거
- 설정 패널만 표시

**새 파일**:
- `Step3SchedulePreview.tsx`
- 전체 화면 스케줄 미리보기
- 편집 버튼으로 Step 2 이동 가능

#### 3.3 진행률 계산 업데이트

**Step별 가중치**:
```typescript
const stepWeights: Record<WizardStep, number> = {
  1: 16.67,  // 기본 정보 (1/6)
  2: 16.67,  // 블록 및 제외일 (2/6)
  3: 16.67,  // 스케줄 확인 (3/6)
  4: 16.67,  // 콘텐츠 선택 (4/6)
  5: 16.67,  // 추천 콘텐츠 (5/6)
  6: 16.65,  // 최종 확인 (6/6)
  7: 0,      // 스케줄 결과 (완료 후)
};
```

## 수정된 파일 목록

### 새로 생성된 파일
1. `app/(student)/plan/new-group/_components/_panels/_modals/ExclusionImportModal.tsx`
2. `app/(student)/plan/new-group/_components/_panels/_modals/AcademyScheduleImportModal.tsx`
3. `app/(student)/plan/new-group/_components/Step3SchedulePreview.tsx`
4. `lib/validation/scheduleValidator.ts`

### 수정된 파일
1. `app/(student)/plan/new-group/_components/_panels/ExclusionsPanel.tsx`
   - 모달 통합 및 선택 등록 방식 적용
2. `app/(student)/plan/new-group/_components/_panels/AcademySchedulePanel.tsx`
   - 모달 통합 및 겹침 검증 적용
3. `app/(student)/plan/new-group/_components/Step2TimeSettings.tsx` (이전 Step2TimeSettingsWithPreview.tsx)
   - 미리보기 제거, 설정 전용으로 변경
4. `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
   - Step 구조 및 진행률 업데이트
   - 새 Step 컴포넌트 통합

## 주요 개선사항 요약

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 제외일 불러오기 | 자동 병합 | 모달 선택 등록 |
| 학원 일정 불러오기 | 자동 병합 | 모달 선택 등록 |
| 학원 일정 중복 검증 | 요일+시간 키 비교 | 시간대 겹침 검증 (이동시간 포함) |
| Step 2/3 레이아웃 | 좌우 분할 통합 | 별도 단계 분리 |
| 총 Step 수 | 5단계 (실제 7) | 6단계 (명확한 7단계) |

## 사용자 경험 개선

1. **명확한 선택 과정**: 불러오기 시 자동으로 추가되지 않고, 사용자가 선택할 수 있음
2. **중복 방지**: 이미 등록된 항목은 명확히 표시되고 선택 불가
3. **겹침 경고**: 학원 일정 등록 시 시간이 겹치면 즉시 경고 표시
4. **단계별 집중**: 설정과 미리보기를 분리하여 각 단계에 집중 가능
5. **유연한 편집**: 미리보기 단계에서 바로 설정 수정 가능

## 테스트 권장 사항

### 제외일 기능
- [ ] 플랜 기간 내 제외일만 표시되는지 확인
- [ ] 이미 등록된 제외일은 비활성화되는지 확인
- [ ] 같은 날짜 중복 등록이 방지되는지 확인

### 학원 일정 기능
- [ ] 시간대가 겹치는 일정 등록 시 경고 표시 확인
- [ ] 이동시간이 포함된 실제 시간대 계산 확인
- [ ] 요일별 그룹화가 잘 되는지 확인

### Step 구조
- [ ] Step 2에서 설정만 가능한지 확인
- [ ] Step 3에서 스케줄 미리보기만 표시되는지 확인
- [ ] Step 3에서 "설정 수정" 버튼으로 Step 2 이동 가능한지 확인
- [ ] 진행률이 올바르게 계산되는지 확인

## 호환성

- **기존 데이터**: 모든 기존 플랜 그룹 데이터와 호환
- **템플릿 모드**: 템플릿 모드 동작 유지
- **캠프 모드**: 캠프 모드 동작 유지
- **관리자 모드**: 관리자 모드 동작 유지

## 향후 개선 사항 제안

1. 학원 일정 수정 시에도 겹침 검증 적용
2. 제외일 범위 선택 시 겹침 경고
3. 드래그 앤 드롭으로 학원 일정 시간 조정
4. 주간 뷰에서 학원 일정 시각화

