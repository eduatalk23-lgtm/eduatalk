# 관리자 플래너 플랜 관리: 빠른 추가와 단발성 추가 분석 및 통합 개선

**작성일**: 2026-01-15  
**분석 범위**: 관리자 영역 플래너 하위 플랜 관리의 빠른 추가와 단발성 추가 기능  
**목적**: 두 기능의 차이점 분석 및 통합 개선 방안 제시

---

## 📋 목차

1. [현재 구현 분석](#현재-구현-분석)
2. [기능 비교](#기능-비교)
3. [데이터 흐름 분석](#데이터-흐름-분석)
4. [문제점 도출](#문제점-도출)
5. [통합 개선 방안](#통합-개선-방안)
6. [구현 우선순위](#구현-우선순위)

---

## 현재 구현 분석

### 1. 빠른 추가 (Quick Add)

**컴포넌트**: `AdminQuickPlanModal.tsx`  
**위치**: `app/(admin)/admin/students/[id]/plans/_components/AdminQuickPlanModal.tsx`

**주요 특징**:
- ✅ 간단한 폼 (제목, 날짜, 예상 소요시간, 학습 유형)
- ✅ 자유 학습 타입 선택 (자유 학습, 독서, 운동, 복습, 과제, 테스트, 기타)
- ✅ `createQuickPlanForStudent` Server Action 사용
- ✅ `student_plan` 테이블에 직접 저장
- ✅ `plannerId` 필수 (플랜 그룹 자동 생성)
- ✅ 자유 학습인 경우 `flexible_contents` 자동 생성

**UI 구성**:
```typescript
// 필수 필드
- 제목 (필수)
- 학습 유형 (자유 학습, 독서, 운동, 복습, 과제, 테스트, 기타)
- 날짜
- 예상 소요시간 (기본값: 30분, 빠른 선택: 15/30/60/90분)

// 테마
- Amber 색상 (warning-500)
- Zap 아이콘
```

**액션 함수**: `createQuickPlanForStudent`
- **위치**: `lib/domains/plan/actions/contentPlanGroup/quickCreate.ts`
- **기능**:
  1. 자유 학습인 경우 `flexible_contents` 생성
  2. 플래너 기반 플랜 그룹 선택/생성
  3. `student_plan` 테이블에 플랜 저장
  4. `content_type`: 자유 학습인 경우 "free" 또는 선택한 타입

**키보드 단축키**: `q`

---

### 2. 단발성 추가 (Ad-hoc Add)

**컴포넌트**: `AddAdHocModal.tsx`  
**위치**: `app/(admin)/admin/students/[id]/plans/_components/AddAdHocModal.tsx`

**주요 특징**:
- ✅ 간단한 폼 (제목, 날짜, 예상 소요시간, 메모)
- ✅ `createAdHocPlan` Server Action 사용
- ✅ `ad_hoc_plans` 테이블에 저장
- ✅ `plannerId` 필수 (플랜 그룹 자동 생성)
- ✅ `planGroupId` 선택적 (없으면 자동 생성)
- ✅ 메모 필드 제공

**UI 구성**:
```typescript
// 필수 필드
- 제목 (필수)
- 날짜
- 예상 소요시간 (선택, 빠른 선택: 15/30/60/90분)
- 메모 (선택)

// 테마
- Purple 색상
- CalendarPlus 아이콘
```

**액션 함수**: `createAdHocPlan`
- **위치**: `lib/domains/admin-plan/actions/adHocPlan.ts`
- **기능**:
  1. 플랜 그룹 자동 생성 (없는 경우)
  2. `ad_hoc_plans` 테이블에 플랜 저장
  3. 이벤트 로깅 (`adhoc_created`)

**키보드 단축키**: `a`

---

## 기능 비교

### 공통점

| 항목 | 빠른 추가 | 단발성 추가 |
|------|----------|------------|
| **목적** | 빠르게 플랜 추가 | 한 번만 수행할 학습 항목 추가 |
| **필수 입력** | 제목, 날짜 | 제목, 날짜 |
| **예상 소요시간** | ✅ (기본값: 30분) | ✅ (선택) |
| **날짜 선택** | ✅ | ✅ |
| **플래너 의존성** | ✅ `plannerId` 필수 | ✅ `plannerId` 필수 |
| **플랜 그룹 자동 생성** | ✅ | ✅ |
| **키보드 단축키** | `q` | `a` |

### 차이점

| 항목 | 빠른 추가 | 단발성 추가 |
|------|----------|------------|
| **저장 테이블** | `student_plan` | `ad_hoc_plans` |
| **학습 유형 선택** | ✅ (7가지 타입) | ❌ |
| **메모 필드** | ❌ | ✅ |
| **UI 테마** | Amber (warning) | Purple |
| **아이콘** | Zap (⚡) | CalendarPlus (📅) |
| **콘텐츠 연결** | 자유 학습 콘텐츠 자동 생성 | ❌ |
| **이벤트 로깅** | ❌ | ✅ (`adhoc_created`) |

### 데이터 구조 비교

#### 빠른 추가 (student_plan)

```typescript
{
  student_id: string;
  tenant_id: string;
  plan_group_id: string;
  plan_date: string;
  content_type: "free" | "custom";
  content_id: string; // flexible_contents.id
  content_title: string;
  container_type: "daily";
  status: "pending";
  flexible_content_id: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
}
```

#### 단발성 추가 (ad_hoc_plans)

```typescript
{
  tenant_id: string;
  student_id: string;
  plan_group_id: string; // 필수
  title: string;
  description: string | null;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  container_type: "daily";
  estimated_minutes: number | null;
  content_type: string | null;
  flexible_content_id: string | null;
  page_range_start: number | null;
  page_range_end: number | null;
  recurrence_rule: string | null;
  created_by: string;
}
```

---

## 데이터 흐름 분석

### 빠른 추가 플로우

```
[AdminQuickPlanModal]
  └── createQuickPlanForStudent({
        studentId,
        tenantId,
        plannerId, // 필수
        title,
        planDate,
        estimatedMinutes,
        isFreeLearning: true,
        freeLearningType,
        containerType: 'daily'
      })
        │
        ├── [1] flexible_contents 생성 (자유 학습인 경우)
        │   └── content_type: "free"
        │   └── item_type: freeLearningType
        │
        ├── [2] 플랜 그룹 선택/생성
        │   └── selectPlanGroupForPlanner(plannerId)
        │   └── 또는 createPlanGroupForPlanner(plannerId)
        │
        └── [3] student_plan 저장
            └── content_type: "free" | "custom"
            └── flexible_content_id: flexible_contents.id
```

### 단발성 추가 플로우

```
[AddAdHocModal]
  └── createAdHocPlan({
        tenant_id,
        student_id,
        plan_group_id, // 자동 생성 가능
        plan_date,
        title,
        description,
        estimated_minutes,
        container_type: 'daily'
      })
        │
        ├── [1] 플랜 그룹 자동 생성 (없는 경우)
        │   └── createAutoContentPlanGroupAction({
        │         plannerId,
        │         planPurpose: 'adhoc'
        │       })
        │
        ├── [2] ad_hoc_plans 저장
        │
        └── [3] 이벤트 로깅
            └── createPlanEvent({
                  event_type: 'adhoc_created'
                })
```

---

## 문제점 도출

### 1. 기능 중복

**문제**:
- 두 기능이 거의 동일한 목적을 수행
- 사용자가 어떤 기능을 사용해야 할지 혼란스러울 수 있음
- UI와 데이터 저장 방식만 다름

**영향**:
- 사용자 경험 저하
- 유지보수 복잡도 증가
- 기능 선택의 모호성

### 2. 데이터 저장 방식 불일치

**문제**:
- 빠른 추가: `student_plan` 테이블
- 단발성 추가: `ad_hoc_plans` 테이블
- 두 테이블의 스키마가 다름

**영향**:
- 데이터 조회 시 두 테이블 모두 확인 필요
- 통계 및 분석 시 복잡도 증가
- 데이터 일관성 문제 가능성

### 3. 기능 차이점 불명확

**문제**:
- 빠른 추가: 학습 유형 선택 가능
- 단발성 추가: 메모 필드 제공
- 하지만 두 기능의 본질적 차이는 없음

**영향**:
- 사용자가 기능 선택 기준을 알기 어려움
- 기능별 장단점이 명확하지 않음

### 4. 이벤트 로깅 불일치

**문제**:
- 빠른 추가: 이벤트 로깅 없음
- 단발성 추가: `adhoc_created` 이벤트 로깅

**영향**:
- 플랜 생성 이력 추적 불일치
- 감사(Audit) 로그 불완전

### 5. 플랜 그룹 생성 로직 중복

**문제**:
- 두 기능 모두 플랜 그룹 자동 생성 로직 포함
- 하지만 구현 방식이 다름

**영향**:
- 코드 중복
- 유지보수 어려움

---

## 통합 개선 방안

### 방안 1: 단일 모달로 통합 (권장)

**개념**: 빠른 추가와 단발성 추가를 하나의 모달로 통합하고, 옵션으로 기능을 선택

**장점**:
- ✅ 사용자 혼란 감소
- ✅ 코드 중복 제거
- ✅ 유지보수 용이
- ✅ 일관된 사용자 경험

**구현 방안**:

```typescript
// 통합 모달 컴포넌트
export function UnifiedQuickAddModal({
  studentId,
  tenantId,
  plannerId,
  targetDate,
  onClose,
  onSuccess,
}: UnifiedQuickAddModalProps) {
  const [mode, setMode] = useState<'quick' | 'adhoc'>('quick');
  const [title, setTitle] = useState('');
  const [planDate, setPlanDate] = useState(targetDate);
  const [estimatedMinutes, setEstimatedMinutes] = useState('30');
  
  // 빠른 추가 모드 전용
  const [freeLearningType, setFreeLearningType] = useState<string>('free');
  
  // 단발성 추가 모드 전용
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'quick') {
      // 빠른 추가 로직
      await createQuickPlanForStudent({ ... });
    } else {
      // 단발성 추가 로직
      await createAdHocPlan({ ... });
    }
  };

  return (
    <Modal>
      {/* 모드 선택 탭 */}
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList>
          <TabsTrigger value="quick">빠른 추가</TabsTrigger>
          <TabsTrigger value="adhoc">단발성 추가</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 공통 필드 */}
      <Input label="제목" value={title} onChange={...} />
      <DatePicker value={planDate} onChange={...} />
      <TimeInput value={estimatedMinutes} onChange={...} />

      {/* 모드별 필드 */}
      {mode === 'quick' && (
        <FreeLearningTypeSelector
          value={freeLearningType}
          onChange={setFreeLearningType}
        />
      )}
      {mode === 'adhoc' && (
        <Textarea
          label="메모"
          value={description}
          onChange={setDescription}
        />
      )}
    </Modal>
  );
}
```

**데이터 저장 통합 방안**:

옵션 A: `student_plan`으로 통합
- `ad_hoc_plans` 테이블 제거
- 모든 플랜을 `student_plan`에 저장
- `is_adhoc` 플래그로 구분

옵션 B: `ad_hoc_plans`로 통합
- `student_plan`의 단순 플랜을 `ad_hoc_plans`로 저장
- 기존 플랜 그룹 기반 플랜만 `student_plan` 유지

옵션 C: 현재 구조 유지 (권장)
- 빠른 추가: `student_plan` (기존 플랜 그룹과 통합)
- 단발성 추가: `ad_hoc_plans` (독립적인 단발성 플랜)
- 명확한 사용 사례 구분

---

### 방안 2: 기능 차이점 명확화

**개념**: 두 기능의 차이점을 명확히 하고, 각각의 사용 사례를 정의

**빠른 추가 (Quick Add)**:
- **목적**: 자유 학습 항목을 빠르게 추가
- **특징**: 학습 유형 선택 가능, 플랜 그룹과 통합
- **사용 사례**: 일상적인 자유 학습 항목 추가

**단발성 추가 (Ad-hoc Add)**:
- **목적**: 특별한 일회성 학습 항목 추가
- **특징**: 메모 필드 제공, 독립적인 플랜
- **사용 사례**: 특강 준비, 특별 과제 등

**UI 개선**:
- 각 모달에 사용 사례 설명 추가
- 도움말 툴팁 제공
- 아이콘과 색상으로 시각적 구분 유지

---

### 방안 3: 단계적 통합

**Phase 1: UI 통합**
- 두 모달을 하나의 컴포넌트로 통합
- 탭 또는 토글로 모드 선택
- 데이터 저장 방식은 유지

**Phase 2: 데이터 저장 통합**
- 하나의 테이블로 통합
- 마이그레이션 스크립트 작성
- 기존 데이터 호환성 유지

**Phase 3: 기능 통합**
- 단일 액션 함수로 통합
- 옵션으로 기능 선택
- 이벤트 로깅 통일

---

## 구현 우선순위

### 우선순위 1: 기능 차이점 명확화 (즉시)

**작업 내용**:
1. 각 모달에 사용 사례 설명 추가
2. 도움말 툴팁 추가
3. 문서화 업데이트

**예상 시간**: 2-3시간

**영향**:
- 사용자 혼란 감소
- 기능 선택 기준 명확화

---

### 우선순위 2: 이벤트 로깅 통일 (단기)

**작업 내용**:
1. 빠른 추가에도 이벤트 로깅 추가
2. 이벤트 타입 정의 (`quick_plan_created`)
3. 감사 로그 완성도 향상

**예상 시간**: 1-2시간

**영향**:
- 플랜 생성 이력 추적 완성
- 감사 로그 일관성

---

### 우선순위 3: UI 통합 (중기)

**작업 내용**:
1. 통합 모달 컴포넌트 생성
2. 탭 또는 토글로 모드 선택
3. 기존 모달 컴포넌트 교체

**예상 시간**: 4-6시간

**영향**:
- 사용자 경험 개선
- 코드 중복 제거

---

### 우선순위 4: 데이터 저장 통합 (장기)

**작업 내용**:
1. 데이터 저장 방식 통합 검토
2. 마이그레이션 스크립트 작성
3. 기존 데이터 호환성 유지
4. 테스트 및 검증

**예상 시간**: 1-2일

**영향**:
- 데이터 일관성 향상
- 유지보수 용이

---

## 권장 사항

### 즉시 적용 가능한 개선

1. **기능 설명 추가**
   - 각 모달에 사용 사례 설명 추가
   - 도움말 아이콘 클릭 시 상세 설명 표시

2. **이벤트 로깅 통일**
   - 빠른 추가에도 이벤트 로깅 추가
   - 이벤트 타입: `quick_plan_created`

3. **키보드 단축키 안내**
   - 모달에 단축키 안내 추가
   - 도움말 모달에 통합

### 중장기 개선

1. **UI 통합**
   - 단일 모달로 통합
   - 탭 또는 토글로 모드 선택

2. **데이터 저장 통합 검토**
   - 현재 구조의 장단점 재평가
   - 통합 필요성 재검토

---

## 참고 문서

- [관리자 플래너-플랜 관리 플로우 분석](./2026-01-15-admin-planner-plan-management-flow-analysis.md)
- [플래너 콘텐츠 추가 시 스케줄러 및 타임라인 기능 연계](./2026-01-15-planner-content-addition-scheduler-timeline-integration.md)
- [관리자 플랜 생성 구조 분석](./2026-01-15-admin-plan-creation-structure-analysis-and-improvements.md)

---

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**버전**: 1.0  
**상태**: 분석 완료, 개선 방안 제시

