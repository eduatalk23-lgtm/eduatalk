# 캠프 모드 프로세스 절차 개선

## 작업 일시
2024년 11월

## 개요

캠프 모드의 4-7단계 프로세스를 정리하고, 제약 조건 검증을 6단계 이전으로 이동하여 6단계는 학습 분량 조절만, 7단계에서 플랜 생성 마무리하도록 개선했습니다.

## 개선 전 문제점

1. **Step 6에서 제약 조건 검증과 학습 분량 조절이 동시에 이루어짐**
   - 제약 조건 검증이 학습 분량 수정 전에 이루어져야 하는데 현재는 혼재되어 있음
   - 사용자가 학습 분량을 조절한 후 제약 조건 검증을 실패하면 다시 수정해야 하는 불편함

2. **플랜 생성 시점이 불명확함**
   - Step 6에서 플랜 생성이 이루어지지만, 7단계에서 마무리하는 것이 더 명확함
   - Step 6과 Step 7의 역할 구분이 불명확

## 개선 후 프로세스

### 단계별 역할 재정의

#### Step 4: 학생 콘텐츠 선택
- 학생이 직접 선택한 콘텐츠 추가
- 구현 파일: `app/(student)/plan/new-group/_components/Step3Contents.tsx` (이름은 Step3이지만 실제로는 Step 4)

#### Step 5: 추천 콘텐츠 추가 및 제약 조건 검증 ⭐ 신규
- **추천 콘텐츠 추가** (기존 기능 유지)
- **취약과목/전략과목 설정 UI 추가** (관리자용)
- **제약 조건 검증 수행**:
  - `subject_allocations` 설정 여부 확인
  - `subject_allocations`의 모든 과목이 콘텐츠에 포함되어 있는지 확인
  - `subject_constraints`의 `required_subjects` 검증
  - `subject_constraints`의 `excluded_subjects` 검증
- Step 5 완료 시 검증 수행 및 에러 표시

#### Step 6: 학습 분량 조절 ⭐ 개선
- 콘텐츠 범위(`start_range`, `end_range`) 수정만 가능
- 제약 조건 검증은 이미 Step 5에서 완료된 상태
- 제약 조건 검증 결과를 읽기 전용으로 표시
- 학습 분량 조절 후 데이터만 저장 (플랜 생성하지 않음)

#### Step 7: 플랜 생성 및 결과 확인 ⭐ 개선
- Step 6에서 저장된 데이터로 플랜 생성 실행
- 플랜이 없으면 자동으로 생성
- 생성된 플랜 결과 확인

## 주요 변경 사항

### 1. WizardValidator 개선

**파일**: `lib/validation/wizardValidator.ts`

#### `validateStep5` 개선
- 제약 조건 검증 로직 추가:
  - `subject_allocations` 검증
  - `subject_constraints` 검증
  - 콘텐츠와 `subject_allocations` 일치 검증
  - `study_review_cycle` 검증

#### `validateStep6` 개선
- 제약 조건 검증 제거
- 학습 분량 관련 검증만 유지:
  - 최소 1개 이상의 콘텐츠 필요
  - 학습 분량 범위 검증 (`start_range < end_range`, 범위 >= 0)

### 2. Step4RecommendedContents.tsx 개선

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

#### 추가된 기능
- 취약과목/전략과목 설정 UI 추가 (캠프 모드이고 1730_timetable인 경우)
- 선택된 콘텐츠의 과목 목록 자동 추출
- 각 과목별로 취약과목/전략과목 설정 가능
- 전략과목인 경우 주당 배정 일수 설정 (2일, 3일, 4일)

### 3. Step6FinalReview.tsx 개선

**파일**: `app/(student)/plan/new-group/_components/Step6FinalReview.tsx`

#### 변경 사항
- 제약 조건 검증 UI 제거 (편집 가능한 부분)
- 제약 조건 검증 결과를 읽기 전용으로 표시:
  - 전략과목/취약과목 설정 결과 (읽기 전용)
  - 교과 제약 조건 결과 (읽기 전용)
- 학습 분량 조절 기능만 유지

### 4. PlanGroupWizard.tsx 개선

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

#### 변경 사항
- `handleSubmit` 함수에 `generatePlans` 파라미터 추가
- Step 6에서 호출 시: 데이터만 저장하고 Step 7로 이동 (플랜 생성하지 않음)
- Step 7에서 호출 시: 플랜 생성 실행
- 캠프 모드 검증 로직 개선:
  - Step 5: 추천 콘텐츠 및 제약 조건 검증
  - Step 6: 학습 분량 검증만

### 5. Step7ScheduleResult.tsx 개선

**파일**: `app/(student)/plan/new-group/_components/Step7ScheduleResult.tsx`

#### 변경 사항
- Step 7 진입 시 플랜 존재 여부 확인
- 플랜이 없으면 자동으로 생성
- 플랜 생성 중 로딩 상태 표시

## 검증 시점 정리

### Step 5 검증 항목
1. ✅ 최소 1개 이상의 콘텐츠 필요
2. ✅ 추천 콘텐츠 범위 검증
3. ✅ 필수 과목 검증 (템플릿 설정에 따라)
4. ✅ `subject_allocations` 설정 여부 확인
5. ✅ `subject_allocations`의 모든 과목이 콘텐츠에 포함되어 있는지 확인
6. ✅ `subject_constraints`의 `required_subjects` 검증
7. ✅ `subject_constraints`의 `excluded_subjects` 검증
8. ✅ `study_review_cycle` 검증

### Step 6 검증 항목
1. ✅ 최소 1개 이상의 콘텐츠 필요
2. ✅ 학습 분량 범위 검증 (`start_range < end_range`, 범위 >= 0)

## 플랜 생성 시점

### 이전
- Step 6에서 플랜 생성 실행
- Step 7에서 결과만 확인

### 개선 후
- Step 6에서 데이터만 저장하고 Step 7로 이동
- Step 7에서 플랜 생성 실행 및 결과 확인

## 사용자 플로우

### 캠프 모드 (관리자 남은 단계 진행)

1. **Step 1-4**: 학생이 진행 (템플릿 기반 정보 입력 + 콘텐츠 선택)
2. **Step 5**: 관리자가 진행
   - 추천 콘텐츠 추가
   - 취약과목/전략과목 설정
   - 제약 조건 검증 수행
   - 검증 통과 시 다음 단계로 진행
3. **Step 6**: 관리자가 진행
   - 제약 조건 검증 결과 확인 (읽기 전용)
   - 학습 분량 조절
   - 데이터 저장 후 Step 7로 이동
4. **Step 7**: 관리자가 진행
   - 플랜 자동 생성 (없는 경우)
   - 생성된 플랜 결과 확인
   - 완료 후 참여자 목록으로 이동

## 주요 파일 변경 내역

1. `lib/validation/wizardValidator.ts` - Step 5, 6 검증 로직 수정
2. `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx` - Step 5 검증 추가
3. `app/(student)/plan/new-group/_components/Step6FinalReview.tsx` - Step 6 검증 제거
4. `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - 플랜 생성 시점 변경
5. `app/(student)/plan/new-group/_components/Step7ScheduleResult.tsx` - 플랜 생성 실행 로직 추가

## 테스트 체크리스트

- [ ] Step 5에서 취약과목/전략과목 설정 UI 표시 확인
- [ ] Step 5에서 제약 조건 검증 수행 확인
- [ ] Step 6에서 제약 조건 검증 결과 읽기 전용 표시 확인
- [ ] Step 6에서 학습 분량 조절 가능 확인
- [ ] Step 6에서 플랜 생성하지 않고 데이터만 저장 확인
- [ ] Step 7에서 플랜 자동 생성 확인
- [ ] Step 7에서 생성된 플랜 결과 확인 가능 확인

## 향후 개선 사항

1. Step 5에서 제약 조건 검증 실패 시 구체적인 안내 메시지 개선
2. Step 6에서 학습 분량 조절 시 실시간 검증 피드백 추가
3. Step 7에서 플랜 생성 실패 시 재시도 기능 추가

