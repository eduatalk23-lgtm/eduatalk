# 플랜 생성 페이지 개선 사항 점검 및 개선 계획

## 📋 현재 문제점 및 개선 사항

### 1. 학습 기간 입력 유형 간 값 공유 문제 ⚠️

**문제점:**
- D-day, 4주, 6주, 직접 선택 간 이동 시 `period_start`와 `period_end`가 공유됨
- 한 유형에서 입력한 값이 다른 유형으로 전환해도 남아있어 혼란 발생

**해결 방안:**
- 각 입력 유형별로 독립적인 상태 관리
- 유형 전환 시 해당 유형의 값만 유지하고 나머지는 초기화
- 최종적으로 선택된 유형의 값만 `wizardData`에 반영

**구현 필요:**
```typescript
// 각 유형별 독립 상태
const [ddayState, setDdayState] = useState({ date: "", calculated: false });
const [weeksState, setWeeksState] = useState({ startDate: "", weeks: 4 });
const [directState, setDirectState] = useState({ start: "", end: "" });

// 유형 전환 시 초기화
const handlePeriodTypeChange = (type: PeriodInputType) => {
  setPeriodInputType(type);
  // 다른 유형의 값은 초기화하되, 현재 유형의 값은 유지
  if (type !== "dday") setDdayState({ date: "", calculated: false });
  if (type !== "4weeks" && type !== "6weeks") setWeeksState({ startDate: "", weeks: 4 });
  if (type !== "direct") setDirectState({ start: "", end: "" });
};
```

---

### 2. 블록 세트 생성 시 시간 블록 기능 통합 필요 🔧

**현재 상태:**
- 블록 세트 이름만 입력하여 생성
- 시간 블록은 별도 페이지(`/blocks`)에서 관리

**요구 사항:**
- 플랜 생성 페이지에서 블록 세트 생성 시 시간 블록도 함께 설정 가능해야 함
- 블록 세트 이름 입력 + 시간 블록 추가 기능 통합

**구현 방안:**
1. 블록 세트 생성 모달/섹션 확장
2. `BlockForm` 컴포넌트 재사용 또는 유사한 UI 통합
3. 블록 세트 생성 시 기본 블록 1개 이상 필수로 설정
4. 생성 후 바로 블록 추가 가능하도록 UX 개선

**UI 구조:**
```
[블록 세트 생성 섹션]
├── 블록 세트 이름 입력
├── 시간 블록 추가 (요일, 시작시간, 종료시간)
├── 추가된 블록 목록 표시
└── 생성 버튼
```

---

### 3. 시간 블록 페이지 역할 변경 📝

**현재 역할:**
- 시간 블록 생성 및 관리
- 블록 세트 관리

**변경 요구 사항:**
- 플랜 생성에서 만든 블록 세트들을 복사/관리하는 페이지로 변경
- 기존 블록 세트 복제 기능
- 블록 세트 간 블록 복사 기능
- 블록 세트 템플릿 관리

**구현 방안:**
1. 블록 세트 목록 표시 (플랜 생성에서 만든 것들 포함)
2. 블록 세트 복제 기능
3. 블록 세트 간 블록 복사 기능
4. 블록 세트 삭제/수정 기능
5. 블록 세트 활성화 기능

**페이지 구조:**
```
[시간 블록 페이지]
├── 블록 세트 목록
│   ├── 플랜 생성에서 만든 블록 세트
│   └── 복사/관리 기능
├── 블록 세트 복제
├── 블록 세트 간 블록 복사
└── 블록 세트 관리 (수정/삭제/활성화)
```

---

### 4. 스케줄러 유형별 조절 옵션 미구현 ⚠️

**현재 상태:**
- 스케줄러 유형 선택만 가능
- 각 유형별 세부 옵션 설정 불가

**요구 사항:**
각 스케줄러 유형별로 조절 옵션 제공:

#### 4.1 성적 기반 배정
- **필요 옵션:**
  - 난이도 가중치 (0-100)
  - 진행률 가중치 (0-100)
  - 성적 가중치 (0-100)
  - 취약과목 집중도 (낮음/보통/높음)
  - 시험 임박도 반영 여부

#### 4.2 1730 Timetable
- **필요 옵션:**
  - 학습일 수 (기본 6일)
  - 복습일 수 (기본 1일)
  - 복습 범위 (전체/부분)

#### 4.3 전략/취약과목 학습일 조정
- **필요 옵션:**
  - 전략과목 주당 학습일 (2-4일)
  - 취약과목 집중 기간 (주 단위)
  - 과목 분류 설정

#### 4.4 커스텀
- **필요 옵션:**
  - 사용자 정의 규칙 설정
  - 우선순위 규칙
  - 배정 패턴 설정

**구현 방안:**
1. `WizardData`에 `scheduler_options` 필드 추가
2. 스케줄러 유형 선택 시 해당 옵션 UI 표시
3. 옵션 값 검증 및 저장
4. 스케줄러 로직에 옵션 반영

**UI 구조:**
```
[스케줄러 유형 선택]
└── [선택된 유형별 옵션 섹션]
    ├── 옵션 1 (슬라이더/입력)
    ├── 옵션 2
    └── ...
```

---

## 🎯 구현 우선순위

### Phase 1: 긴급 수정 (즉시)
1. ✅ 학습 기간 입력 유형 간 값 초기화 문제 해결
2. ✅ 스케줄러 유형별 기본 옵션 UI 추가

### Phase 2: 핵심 기능 (단기)
3. ✅ 블록 세트 생성 시 시간 블록 기능 통합
4. ✅ 스케줄러 옵션 저장 및 적용

### Phase 3: 개선 사항 (중기)
5. ✅ 시간 블록 페이지 역할 변경
6. ✅ 블록 세트 복제/관리 기능

---

## 📐 데이터 구조 변경 사항

### WizardData 타입 확장
```typescript
export type WizardData = {
  // ... 기존 필드
  scheduler_options?: {
    // 성적 기반
    difficulty_weight?: number;
    progress_weight?: number;
    score_weight?: number;
    weak_subject_focus?: "low" | "medium" | "high";
    exam_urgency_enabled?: boolean;
    
    // 1730 Timetable
    study_days?: number;
    review_days?: number;
    review_scope?: "full" | "partial";
    
    // 전략/취약과목
    strategy_subject_days_per_week?: number;
    weak_subject_focus_weeks?: number;
    
    // 커스텀
    custom_rules?: any;
  };
};
```

### PlanGroupCreationData 타입 확장
```typescript
export type PlanGroupCreationData = {
  // ... 기존 필드
  scheduler_options?: Record<string, any>;
};
```

---

## 🔄 마이그레이션 계획

### 데이터베이스
- `plan_groups` 테이블에 `scheduler_options` JSONB 컬럼 추가 (선택사항)
- 기존 데이터는 NULL로 유지

### 코드 마이그레이션
1. 타입 정의 업데이트
2. 컴포넌트에 옵션 UI 추가
3. 스케줄러 로직에 옵션 반영
4. 검증 로직 추가

---

## 📝 참고 사항

### 기존 스케줄러 로직
- `lib/plan/scheduler.ts`에 스케줄러 구현
- 각 스케줄러 함수에 옵션 파라미터 추가 필요

### 블록 관리
- `app/actions/blocks.ts`에 블록 CRUD 로직
- `app/(student)/blocks/`에 블록 관리 UI
- 블록 세트 관련 로직은 `app/actions/blockSets.ts`에 있음

### 스케줄러 옵션 참고
- `app/actions/autoSchedule.ts`에 유사한 옵션 로직 존재
- `difficulty_weight`, `progress_weight`, `score_weight` 등 참고 가능

