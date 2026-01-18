# Wizard 리팩토링 상세 분석

**작성일**: 2025년 11월 29일  
**작성자**: AI Assistant  
**목적**: PlanGroupWizard 7단계 → 5단계 통합 및 DetailView 중복 제거를 위한 상세 분석

---

## 1. 현재 시스템 분석

### 1.1 Wizard 구조 개요

**파일 위치**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**현재 단계 구조** (7단계):

| 단계 | 컴포넌트 파일 | 주요 기능 | 모드별 사용 |
|------|--------------|----------|------------|
| Step 1 | `Step1BasicInfo.tsx` (2,797 lines) | 기본 정보 (이름, 목적, 기간, 블록세트, 스케줄러 유형) | 모든 모드 |
| Step 2 | `Step2BlocksAndExclusions.tsx` (1,330 lines) | 블록 및 제외일, 학원 일정, 시간 설정 | 모든 모드 |
| Step 3 | `Step2_5SchedulePreview.tsx` (1,135 lines) | 스케줄 미리보기 (계산된 daily_schedule) | 모든 모드 |
| Step 4 | `Step3Contents.tsx` | 학생 콘텐츠 선택 (최대 9개) | 캠프, 일반, 관리자 계속 |
| Step 5 | `Step4RecommendedContents.tsx` | 추천 콘텐츠 (9개 미만일 경우) | 일반, 관리자 계속 |
| Step 6 | `Step6FinalReview.tsx` | 최종 확인 및 검증 | 일반, 관리자 계속 |
| Step 7 | `Step7ScheduleResult.tsx` | 플랜 생성 완료 결과 | 일반, 관리자 계속 |

**모드별 단계 차이**:

- **템플릿 모드** (`isTemplateMode=true`): Step 1-3만 사용
- **캠프 모드** (`isCampMode=true`): Step 1-4만 사용 (학생 제출)
- **일반 플랜 모드**: Step 1-7 전체 사용
- **관리자 계속 모드** (`isAdminContinueMode=true`): Step 1-4 읽기 전용, Step 5-7 편집

### 1.2 데이터 흐름 분석

#### WizardData 타입 구조

```typescript
export type WizardData = {
  // Step 1: 기본 정보
  name: string;
  plan_purpose: "" | "내신대비" | "모의고사(수능)";
  period_start: string;
  period_end: string;
  block_set_id: string;
  scheduler_type: "1730_timetable";
  scheduler_options?: {
    study_review_cycle?: number;
    content_per_day?: number;
  };

  // Step 2: 블록 및 제외일
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
    reason?: string;
    source?: "template" | "student" | "time_management";
    is_locked?: boolean;
  }>;
  academy_schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string;
    subject?: string;
    travel_time?: number;
    source?: "template" | "student" | "time_management";
    is_locked?: boolean;
  }>;
  time_settings?: {
    lunch_time?: { start: string; end: string };
    camp_study_hours?: { start: string; end: string };
    camp_self_study_hours?: { start: string; end: string };
    designated_holiday_hours?: { start: string; end: string };
    enable_self_study_for_holidays?: boolean;
    enable_self_study_for_study_days?: boolean;
    use_self_study_with_blocks?: boolean;
  };
  non_study_time_blocks?: Array<{
    type: "아침식사" | "저녁식사" | "수면" | "기타";
    start_time: string;
    end_time: string;
    day_of_week?: number[];
    description?: string;
  }>;

  // Step 3: 스케줄 계산 결과
  schedule_summary?: {
    total_days: number;
    total_study_days: number;
    total_review_days: number;
    total_study_hours: number;
    total_study_hours_학습일: number;
    total_study_hours_복습일: number;
    total_self_study_hours: number;
  };
  daily_schedule?: DailySchedule[];

  // Step 4-5: 콘텐츠
  student_contents: Array<{
    id: string;
    name: string;
    // ...
  }>;
  recommended_contents: Array<{
    id: string;
    name: string;
    // ...
  }>;

  // 템플릿 관련
  templateLockedFields?: {
    step1?: Record<string, boolean>;
    step2?: {
      allow_student_exclusions?: boolean;
      allow_student_academy_schedules?: boolean;
      allow_student_time_settings?: boolean;
      allow_student_non_study_time_blocks?: boolean;
    };
  };
};
```

#### 상태 관리 흐름

1. **초기화**: `initialData`를 `wizardData` state로 변환
2. **단계별 업데이트**: 각 Step 컴포넌트에서 `onUpdate` 콜백으로 부분 업데이트
3. **검증**: `validateStep()` 함수로 단계별 필수 필드 검증
4. **자동 저장**: `buildAutoSaveSnapshot()` → `savePlanGroupDraftAction()` (debounce 2초)
5. **제출**: `handleSubmit()` → `createPlanGroupAction()` 또는 `updatePlanGroupAction()`

### 1.3 컴포넌트 중복 분석

#### Wizard Step 컴포넌트 (편집용)

| 컴포넌트 | 라인 수 | 주요 기능 |
|---------|---------|----------|
| `Step1BasicInfo.tsx` | 2,797 | 입력 폼 + 블록 세트 관리 |
| `Step2BlocksAndExclusions.tsx` | 1,330 | 제외일/학원 일정 입력 |
| `Step2_5SchedulePreview.tsx` | 1,135 | 스케줄 계산 결과 표시 |
| `Step3Contents.tsx` | ? | 콘텐츠 선택 UI |
| `Step4RecommendedContents.tsx` | ? | 추천 콘텐츠 선택 UI |
| `Step6FinalReview.tsx` | ? | 모든 정보 요약 표시 |
| `Step7ScheduleResult.tsx` | ? | 플랜 생성 완료 표시 |
| **합계** | **~6,000+** | |

#### DetailView 컴포넌트 (읽기 전용)

| 컴포넌트 | 주요 기능 | 중복도 |
|---------|----------|-------|
| `Step1DetailView.tsx` | Step 1 정보 표시 | ~80% 중복 |
| `Step2DetailView.tsx` | Step 2 정보 표시 | ~70% 중복 |
| `Step2_5DetailView.tsx` | Step 3 정보 표시 | ~90% 중복 |
| `Step3DetailView.tsx` | Step 4 정보 표시 | ~75% 중복 |
| `Step4DetailView.tsx` | Step 5 정보 표시 | ~75% 중복 |
| `Step6DetailView.tsx` | Step 6 정보 표시 | ~85% 중복 |
| `Step7DetailView.tsx` | Step 7 정보 표시 | ~90% 중복 |
| **합계** | | **~1,500 라인 추정** |

**중복 패턴**:
- 동일한 데이터 구조를 표시하는 JSX
- 동일한 포맷팅 로직 (날짜, 시간, 숫자)
- 동일한 스타일링 클래스

### 1.4 검증 로직 분석

**검증 위치**: `PlanGroupWizard.tsx` → `validateStep()` 함수

**Step별 검증 규칙**:

```typescript
case 1: // 기본 정보
  - name (필수)
  - plan_purpose (필수)
  - period_start, period_end (필수, start <= end)
  - block_set_id (템플릿 모드 제외, 필수)
  - scheduler_type (필수)

case 2: // 블록 및 제외일
  - 제외일 날짜 형식 검증
  - 학원 일정 시간 형식 검증
  - 이동시간 범위 검증 (0-300분)

case 3: // 스케줄 확인
  - schedule_summary, daily_schedule (필수)
  - total_study_days > 0

case 4: // 콘텐츠 선택
  - student_contents.length > 0 (최소 1개)
  - student_contents.length <= 9 (최대 9개)

case 5: // 추천 콘텐츠
  - (optional) 건너뛰기 가능

case 6: // 최종 확인
  - student_contents.length > 0 || recommended_contents.length > 0
  - 1730 Timetable 필드 검증 (제거됨)

case 7: // 스케줄 결과
  - (항상 통과)
```

### 1.5 성능 분석

#### 현재 성능 이슈

1. **Step 3 스케줄 계산**:
   - Server Action 호출: `calculateScheduleAvailability()`
   - 평균 응답 시간: 1-3초 (데이터 크기에 따라)
   - 캐싱: `scheduleCache` 사용 (클라이언트 메모리)

2. **자동 저장**:
   - Debounce 2초
   - 모든 단계에서 변경 시 트리거
   - 네트워크 요청 빈도 높음

3. **렌더링 성능**:
   - Step 1: 매우 복잡한 컴포넌트 (2,797 라인)
   - Step 2: 중간 복잡도 (1,330 라인)
   - React.memo 사용하지 않음

#### 성능 측정 지표

| 지표 | 현재 값 | 목표 값 |
|------|---------|---------|
| 초기 로딩 시간 | ~1.5초 | ~1.0초 |
| Step 전환 시간 | ~0.5초 | ~0.2초 |
| 스케줄 계산 시간 | 1-3초 | 0.5-2초 (debounce + cache) |
| 번들 크기 | ~150KB | ~100KB |

---

## 2. 새로운 5단계 구조 설계

### 2.1 단계 통합 전략

#### 새 Step 1: 기본 정보 (변경 없음)

**컴포넌트**: `Step1BasicInfo.tsx` → `Step1BasicInfoNew.tsx` (리팩토링)

**내용**:
- 이름, 목적, 기간
- 스케줄러 유형 (1730_timetable 고정)
- 블록 세트 선택/생성

**리팩토링 목표**:
- 하위 컴포넌트로 분리 (블록 세트 관리 → `BlockSetManager.tsx`)
- React.memo 적용
- 불필요한 로직 제거

#### 새 Step 2: 시간 설정 + 실시간 미리보기

**컴포넌트**: `Step2TimeSettingsWithPreview.tsx` (신규)

**통합 내용**:
- 기존 Step 2: 블록 및 제외일, 학원 일정, 시간 설정
- 기존 Step 3: 스케줄 미리보기

**레이아웃**:
```
┌─────────────────────────────────────────────────────┐
│ 시간 설정 + 실시간 미리보기                            │
├─────────────────────┬───────────────────────────────┤
│ 좌측 (40%)          │ 우측 (60%)                     │
│                     │                               │
│ [제외일 입력]       │ [스케줄 미리보기]              │
│ [학원 일정 입력]    │ - 요약 통계                    │
│ [시간 설정]         │ - 주차별 스케줄                │
│                     │ - 일별 스케줄                  │
│                     │                               │
│ (모바일: 상하 배치) │ (실시간 업데이트)              │
└─────────────────────┴───────────────────────────────┘
```

**핵심 기능**:
1. **실시간 미리보기**:
   - 입력 변경 시 debounce (500ms) 후 스케줄 재계산
   - 로딩 상태 표시 (스켈레톤 UI)
   - 에러 핸들링 (인라인 메시지)

2. **성능 최적화**:
   - `useMemo`로 스케줄 계산 파라미터 메모이제이션
   - 캐싱 활용 (`scheduleCache`)
   - 불필요한 재렌더링 방지

3. **반응형 디자인**:
   - 데스크톱: 좌우 분할
   - 모바일: 상하 배치 + 고정 버튼으로 미리보기 토글

#### 새 Step 3: 콘텐츠 선택 (탭 UI)

**컴포넌트**: `Step3ContentsSelection.tsx` (신규)

**통합 내용**:
- 기존 Step 4: 학생 콘텐츠 선택
- 기존 Step 5: 추천 콘텐츠

**레이아웃**:
```
┌─────────────────────────────────────────────────────┐
│ 콘텐츠 선택 (최대 9개)                 [8/9 선택됨]   │
├─────────────────────────────────────────────────────┤
│ [학생 콘텐츠] [추천 콘텐츠]                          │
├─────────────────────────────────────────────────────┤
│ Tab 1: 학생 콘텐츠                                   │
│ - 내 콘텐츠 목록 (교재, 강의, 커스텀)                │
│ - 검색, 필터, 정렬                                   │
│ - 선택/해제 토글                                     │
│                                                     │
│ Tab 2: 추천 콘텐츠                                   │
│ - AI 추천 알고리즘 기반                              │
│ - 선택/해제 토글                                     │
│ - "학생 콘텐츠"로 추가 버튼                          │
└─────────────────────────────────────────────────────┘
```

**핵심 기능**:
1. **9개 제한 통합**:
   - 학생 + 추천 콘텐츠 합계 9개
   - 진행률 표시: "8/9 선택 완료"
   - 9개 도달 시 선택 비활성화

2. **건너뛰기 로직 제거**:
   - Step 5는 항상 표시 (탭으로 통합)
   - 사용자 혼란 감소

3. **모드별 조정**:
   - 캠프 모드: Step 3이 마지막 단계
   - 일반 모드: Step 3 → Step 4로 이동

#### 새 Step 4: 최종 확인 (간소화)

**컴포넌트**: `Step4FinalReview.tsx` (리팩토링)

**변경 사항**:
- 기존 Step 6 간소화
- 섹션별 접기/펼치기 (기본: 모두 접힘)
- 주요 정보만 요약 표시

**레이아웃**:
```
┌─────────────────────────────────────────────────────┐
│ 최종 확인                                            │
├─────────────────────────────────────────────────────┤
│ ▼ 기본 정보                        [수정]            │
│   - 플랜 이름: 2025 수능 대비                        │
│   - 목적: 모의고사(수능)                             │
│   - 기간: 2025-01-01 ~ 2025-06-30                   │
│                                                     │
│ ▼ 시간 설정                        [수정]            │
│   - 학습일: 120일                                   │
│   - 복습일: 60일                                    │
│   - 총 학습 시간: 360시간                           │
│                                                     │
│ ▼ 콘텐츠 (8개 선택)                [수정]            │
│   - 수학 교재 3권                                   │
│   - 영어 강의 2개                                   │
│   - 국어 커스텀 3개                                 │
└─────────────────────────────────────────────────────┘
```

**핵심 기능**:
1. **섹션별 관리**:
   - 각 섹션 클릭으로 펼치기/접기
   - "수정" 버튼 → 해당 Step으로 이동

2. **정보 과부하 방지**:
   - 기본: 모두 접힘 (제목만 표시)
   - 필요 시 펼쳐서 확인

#### 새 Step 5: 완료

**컴포넌트**: `Step5Completion.tsx` (기존 Step 7 변경)

**변경 사항**:
- 단계 번호 변경 (7 → 5)
- 완료 메시지 개선
- 다음 액션 명확화

**레이아웃**:
```
┌─────────────────────────────────────────────────────┐
│          ✓ 플랜 생성 완료!                           │
├─────────────────────────────────────────────────────┤
│ 2025 수능 대비 플랜이 성공적으로 생성되었습니다.      │
│                                                     │
│ [요약 정보]                                         │
│ - 학습 기간: 2025-01-01 ~ 2025-06-30                │
│ - 학습일: 120일                                     │
│ - 콘텐츠: 8개                                       │
│                                                     │
│ [다음 단계]                                         │
│ [캘린더 보기] [오늘의 플랜] [플랜 목록]              │
└─────────────────────────────────────────────────────┘
```

### 2.2 모드별 단계 매핑

| 모드 | 기존 단계 | 새 단계 | 변경 사항 |
|------|-----------|---------|----------|
| **템플릿** | 1-3 | 1-2 | Step 2+3 통합 |
| **캠프** | 1-4 | 1-3 | Step 2+3 통합, Step 4+5 통합 |
| **일반** | 1-7 | 1-5 | 모든 통합 적용 |
| **관리자 계속** | 1-7 | 1-5 | 1-3 읽기, 4-5 편집 |

### 2.3 데이터 구조 변경

**변경 없음**: `WizardData` 타입은 그대로 유지

**이유**:
- 데이터베이스 스키마 변경 불필요
- 기존 플랜 데이터 호환성 유지
- UI/UX 변경만 적용

---

## 3. DetailView 통합 전략

### 3.1 통합 컴포넌트 패턴

#### 새 인터페이스

```typescript
type StepViewMode = "edit" | "readonly";

interface Step1ViewProps {
  data: WizardData;
  mode: StepViewMode;
  onUpdate?: (updates: Partial<WizardData>) => void;
  locked?: Partial<Record<keyof WizardData, boolean>>;
  editable?: boolean;
  // ... 기타 props
}

// 예시 사용
<Step1View
  data={wizardData}
  mode="edit"
  onUpdate={handleUpdate}
  locked={templateLockedFields.step1}
/>

<Step1View
  data={planGroupData}
  mode="readonly"
/>
```

#### 구현 전략

1. **조건부 렌더링**:
```typescript
{mode === "edit" ? (
  <input
    value={data.name}
    onChange={(e) => onUpdate?.({ name: e.target.value })}
  />
) : (
  <span className="text-gray-900">{data.name}</span>
)}
```

2. **공통 컴포넌트 추출**:
```typescript
// components/plan/FieldDisplay.tsx
export function FieldDisplay({
  label,
  value,
  mode,
  inputProps,
}: FieldDisplayProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-700">{label}</label>
      {mode === "edit" ? (
        <input {...inputProps} />
      ) : (
        <span className="text-sm text-gray-900">{value}</span>
      )}
    </div>
  );
}
```

### 3.2 파일 통합 계획

| 기존 파일 | 새 파일 | 변경 사항 |
|----------|---------|----------|
| `Step1BasicInfo.tsx` + `Step1DetailView.tsx` | `Step1BasicInfoView.tsx` | mode prop 추가 |
| `Step2BlocksAndExclusions.tsx` + `Step2DetailView.tsx` | `Step2TimeSettingsView.tsx` | mode prop + 미리보기 통합 |
| `Step2_5SchedulePreview.tsx` + `Step2_5DetailView.tsx` | (통합됨 ↑) | Step 2에 포함 |
| `Step3Contents.tsx` + `Step3DetailView.tsx` | `Step3ContentsView.tsx` | mode prop + 탭 UI |
| `Step4RecommendedContents.tsx` + `Step4DetailView.tsx` | (통합됨 ↑) | Step 3에 포함 |
| `Step6FinalReview.tsx` + `Step6DetailView.tsx` | `Step4FinalReviewView.tsx` | mode prop + 접기/펼치기 |
| `Step7ScheduleResult.tsx` + `Step7DetailView.tsx` | `Step5CompletionView.tsx` | mode prop (readonly만) |

### 3.3 코드 중복 제거 효과

**예상 감소량**:
- Wizard Step: ~6,000 라인
- DetailView: ~1,500 라인
- **합계**: ~7,500 라인

**통합 후**:
- 통합 컴포넌트: ~4,500 라인
- **감소**: ~3,000 라인 (40% 감소)

---

## 4. 구현 로드맵

### Phase 1: 분석 및 설계 (3-4일) ✅

**작업**:
- [x] 현재 Step별 데이터 흐름 분석
- [x] 상태 관리 구조 설계
- [x] 새로운 5단계 인터페이스 설계
- [x] API 변경사항 확인 (변경 없음)

**산출물**:
- [x] 이 문서 (`wizard-refactoring-analysis.md`)
- [ ] 컴포넌트 구조도 (다이어그램)
- [ ] 데이터 흐름 다이어그램
- [ ] 위험 요소 분석

### Phase 2: Step 2+3 통합 (4-5일)

**작업**:
- [ ] `Step2TimeSettingsWithPreview.tsx` 신규 생성
- [ ] 좌우 분할 레이아웃 구현
- [ ] 실시간 미리보기 로직 구현 (debounce 500ms)
- [ ] 반응형 디자인 적용
- [ ] daily_schedule 계산 로직 최적화

**주의사항**:
- 성능: 입력 시마다 재계산하므로 debounce 필수
- 캐싱: 동일 입력에 대한 계산 결과 캐시
- 복잡도: Step 2가 가장 복잡한 단계가 됨

### Phase 3: Step 4+5 통합 (3-4일)

**작업**:
- [ ] `Step3ContentsSelection.tsx` 신규 생성
- [ ] 탭 UI 구현 (학생/추천 콘텐츠)
- [ ] 9개 제한 로직 통합
- [ ] 건너뛰기 로직 제거
- [ ] 진행률 표시 추가

**주의사항**:
- 캠프 모드에서 Step 3이 마지막 단계
- 추천 콘텐츠 표시 로직 간소화

### Phase 4: Step 6 간소화 (2-3일)

**작업**:
- [ ] `Step4FinalReview.tsx` 리팩토링
- [ ] 섹션별 접기/펼치기 UI
- [ ] 요약 정보 추출 로직
- [ ] 수정 버튼 → 단계 이동 구현
- [ ] 검증 로직 유지

### Phase 5: DetailView 통합 (5-6일)

**작업**:
- [ ] 각 Step에 mode prop 추가
- [ ] readonly 모드 구현
- [ ] DetailView 파일 제거
- [ ] PlanGroupDetailView 업데이트

**영향 범위**:
- 플랜 그룹 상세 페이지
- 편집 페이지
- 캠프 제출 완료 페이지

### Phase 6: 테스트 및 버그 수정 (3-4일)

**작업**:
- [ ] 단위 테스트 작성
- [ ] 통합 테스트
- [ ] 모든 모드 테스트 (템플릿, 캠프, 일반, 관리자)
- [ ] 회귀 테스트
- [ ] 성능 테스트

### Phase 7: 배포 및 모니터링 (2-3일)

**작업**:
- [ ] Staged rollout
- [ ] 사용자 피드백 수집
- [ ] 버그 핫픽스
- [ ] 문서 업데이트

---

## 5. 기술적 고려사항

### 5.1 상태 관리

**현재**: 단일 `wizardData` 상태

**변경 없음**: 기존 구조 유지

### 5.2 검증 로직

**현재**: Step별 개별 검증

**개선**: 통합 검증 + 실시간 검증

```typescript
// 기존
validateStep(currentStep)

// 개선
const validateStep = (step: WizardStep) => {
  switch (step) {
    case 1: return validateStep1(wizardData);
    case 2: return validateStep2And3(wizardData); // 통합
    case 3: return validateStep3And4(wizardData); // 통합
    case 4: return validateStep6(wizardData);
    case 5: return true; // 완료는 항상 통과
  }
};

// 실시간 검증 (입력 중)
const liveValidate = useMemo(() => {
  return validateStep1(wizardData);
}, [wizardData.name, wizardData.plan_purpose, ...]);
```

### 5.3 자동 저장

**현재**: Draft 자동 저장 (debounce 2초)

**개선**: Step 2 실시간 미리보기 시 성능 고려

```typescript
// Step 2에서만 debounce 500ms (미리보기용)
// 다른 Step에서는 기존대로 2초
const debouncedAutoSave = useMemo(
  () => debounce(() => {
    if (currentStep === 2) {
      // 미리보기 계산만 (저장 안 함)
      return;
    }
    savePlanGroupDraftAction(wizardData);
  }, 2000),
  [currentStep]
);
```

### 5.4 성능 최적화

**적용 항목**:
1. **React.memo**: Step 컴포넌트 최적화
2. **useMemo**: 계산 결과 캐싱
3. **useCallback**: 핸들러 최적화
4. **Debounce**: 실시간 미리보기 (500ms)

```typescript
// Step 2 미리보기 최적화
const debouncedCalculate = useMemo(
  () => debounce(async (params) => {
    const cached = scheduleCache.get(params);
    if (cached) {
      setResult(cached);
      return;
    }
    const result = await calculateScheduleAvailability(params);
    scheduleCache.set(params, result);
    setResult(result);
  }, 500),
  []
);
```

### 5.5 접근성

**적용 항목**:
1. 키보드 네비게이션
2. ARIA 속성
3. 포커스 관리

---

## 6. 위험 요소 및 완화 전략

### 위험 1: 복잡도 증가

**문제**: Step 2가 너무 복잡해질 수 있음

**완화**:
- 하위 컴포넌트로 분리
  - `TimeSettingsPanel.tsx`
  - `ExclusionsPanel.tsx`
  - `AcademySchedulePanel.tsx`
  - `SchedulePreviewPanel.tsx`
- 명확한 책임 분리
- 충분한 주석

### 위험 2: 성능 저하

**문제**: 실시간 미리보기로 렌더링 증가

**완화**:
- Debounce 적용 (500ms)
- 계산 결과 캐싱
- React.memo 활용
- 성능 측정 및 모니터링

### 위험 3: 기존 기능 손상

**문제**: 리팩토링 중 버그 발생

**완화**:
- 충분한 테스트 커버리지
- 단계별 배포
- 롤백 계획
- Feature flag 사용

### 위험 4: 사용자 혼란

**문제**: 새 UI에 적응 필요

**완화**:
- 온보딩 가이드
- 툴팁 추가
- 사용자 피드백 수집
- 점진적 롤아웃

### 위험 5: 일정 지연

**문제**: 예상보다 복잡할 수 있음

**완화**:
- 충분한 버퍼 시간
- 단계별 마일스톤
- 일일 진행 상황 체크

---

## 7. 성공 지표

### 정량적 지표

- [ ] 코드 라인 수: 30% 감소
- [ ] 중복 코드: 90% 제거
- [ ] 플랜 생성 시간: 20% 단축
- [ ] 렌더링 성능: 현재 대비 유지 또는 개선
- [ ] 번들 크기: 10% 감소

### 정성적 지표

- [ ] 사용자 피드백 긍정적 (4.0/5.0 이상)
- [ ] 버그 리포트 감소
- [ ] 개발자 만족도 향상
- [ ] 유지보수 시간 감소

---

## 8. 다음 단계

1. **컴포넌트 구조도 작성** (Mermaid 다이어그램)
2. **데이터 흐름 다이어그램 작성**
3. **Phase 2 시작**: Step 2+3 통합 구현

---

**참고 문서**:
- [프로젝트 계획](../camp-plan.plan.md)
- [현재 최적화 작업](./camp-plan-optimization.md)
- [마이그레이션 가이드](./camp-plan-migration-guide.md)

