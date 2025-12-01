# 콘텐츠 선택 기능 개선

## 개선 날짜
2025-01-30

## 개요
플랜 그룹 위저드의 콘텐츠 선택 프로세스를 개선하여 필수 교과 설정, 전략/취약과목 세부 조절, 세부 과목 검증 기능을 추가합니다.

## 주요 개선사항

### 1. 데이터 구조 변경

#### WizardContent 타입 확장 (`lib/types/wizard.ts`)
- `subject` 필드 추가: 세부 과목 정보 저장 (예: "화법과 작문", "미적분")

#### WizardData 타입 확장 (`app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`)
- `show_required_subjects_ui`: 필수 교과 설정 UI 표시 여부
- `content_allocations`: 콘텐츠별 전략/취약 설정 배열
- `allocation_mode`: 전략/취약 설정 모드 ("subject" | "content")
- `student_contents`, `recommended_contents`에 `subject` 필드 추가

### 2. Server Actions 추가

#### `app/(student)/actions/fetchDetailSubjects.ts`
- 특정 교과의 세부 과목 목록 조회
- `master_books`, `master_lectures`에서 중복 제거 후 정렬하여 반환

#### `app/(student)/actions/fetchContentDetailsForValidation.ts`
- 콘텐츠 ID 목록으로 상세 정보 조회 (검증용)
- `subject_category`, `subject` 정보 반환

### 3. 플랜 생성 로직 개선

#### 폴백 메커니즘 (`lib/plan/1730TimetableLogic.ts`)
- `getContentAllocation()` 함수 추가
- 우선순위:
  1. `content_allocations` (콘텐츠별 설정)
  2. `subject_allocations` (교과별 설정)
  3. 기본값 (취약과목)

### 4. 검증 로직 강화

#### `lib/validation/wizardValidator.ts`
- `validateStep5()` 수정: `detail_subject` 필드 포함하여 검증

#### `lib/plan/1730TimetableLogic.ts`
- `validateSubjectConstraints()` 수정:
  - 세부 과목까지 검증 가능
  - 교과만 검증하는 경우와 세부 과목까지 검증하는 경우 분리
  - 최소 개수(`min_count`) 검증 추가

## 구현 상태

### 완료 ✅
- [x] WizardData 타입 확장
- [x] WizardContent 타입에 `subject` 필드 추가
- [x] Server Actions 추가 (fetchDetailSubjects, fetchContentDetailsForValidation)
- [x] 플랜 생성 시 폴백 메커니즘 구현
- [x] 세부 과목 검증 로직 강화

### 진행 중 🚧
- [ ] Step 4: 필수 교과 설정 UI 추가 (토글 방식)
- [ ] Step 4: 실시간 검증 강화 (세부 과목 포함)
- [ ] Step 6: 전략/취약 설정 UI 모드 전환 (교과별/콘텐츠별)
- [ ] Step 6: 콘텐츠별 설정 UI 구현

## 사용 예시

### 1. 세부 과목 조회
```typescript
import { fetchDetailSubjects } from "@/app/(student)/actions/fetchDetailSubjects";

const subjects = await fetchDetailSubjects("국어");
// ["화법과 작문", "독서", "문학", ...]
```

### 2. 콘텐츠별 전략/취약 설정
```typescript
const wizardData: WizardData = {
  // ...
  content_allocations: [
    {
      content_type: "book",
      content_id: "book-123",
      subject_type: "strategy",
      weekly_days: 3
    },
    {
      content_type: "lecture",
      content_id: "lecture-456",
      subject_type: "weakness"
    }
  ],
  allocation_mode: "content"
};
```

### 3. 필수 교과 설정 (세부 과목 포함)
```typescript
const wizardData: WizardData = {
  // ...
  subject_constraints: {
    enable_required_subjects_validation: true,
    required_subjects: [
      {
        subject_category: "국어",
        subject: "화법과 작문", // 세부 과목 지정
        min_count: 2
      },
      {
        subject_category: "수학",
        // subject 생략 시 모든 세부 과목 포함
        min_count: 3
      }
    ],
    constraint_handling: "warning"
  }
};
```

### 4. 폴백 메커니즘 사용
```typescript
import { getContentAllocation } from "@/lib/plan/1730TimetableLogic";

const allocation = getContentAllocation(
  { content_type: "book", content_id: "book-123", subject_category: "국어" },
  wizardData.content_allocations,
  wizardData.subject_allocations
);
// { subject_type: "strategy" | "weakness", weekly_days?: number }
```

## 하위 호환성

- 기존 `subject_allocations`만 있는 데이터: 정상 동작
- `content_allocations` 추가 시: 우선 사용
- `show_required_subjects_ui` 없는 경우: 기본값 `false`
- `allocation_mode` 없는 경우: 기본값 `"subject"`
- `subject` 필드 없는 콘텐츠: 교과만으로 검증

## 향후 작업

### Step 4 개선
1. 필수 교과 설정 UI 추가
   - 토글 버튼으로 UI 표시/숨김
   - 교과별 최소 개수 설정
   - 세부 과목 선택 (선택사항)
   - 제약 조건 처리 방식 선택

2. 실시간 검증 강화
   - 콘텐츠 선택 시 즉시 검증
   - 필수 교과 부족 시 경고 배지 표시
   - 세부 과목 포함 검증

### Step 6 개선
1. 전략/취약 설정 모드 전환
   - 교과별 설정 / 콘텐츠별 설정 토글
   - 부드러운 애니메이션

2. 콘텐츠별 설정 UI
   - 개별 콘텐츠 카드 형태
   - 전략/취약 라디오 버튼
   - 전략과목 시 주당 배정 일수 선택
   - 그리드 레이아웃 (반응형)

## 참고 문서
- [Phase 2 구현 완료](./2025-01-30-phase2-implementation.md)
- [플랜 그룹 위저드 개발 가이드](../timetable/1730Timetable-PRD.md)

