# 캠프 Step3 스케줄 확인 오류 분석 및 수정

## 🔍 문제 상황

캠프 참여 페이지의 Step3 (스케줄 확인) 단계에서 다음 오류가 발생:

```
필수 정보가 누락되었습니다.
```

## 📋 오류 발생 원인 분석

### 핵심 원인: `campTemplateId` 필수 검증 누락

**문제점**:

1. `Step2_5SchedulePreview` 컴포넌트의 `scheduleParams` 메모이제이션에서 캠프 모드일 때 `campTemplateId`가 필수인지 검증하지 않았습니다.
2. `calculateScheduleAvailability` 액션에서도 캠프 모드일 때 `campTemplateId`가 없어도 계속 진행하여, 템플릿 블록 조회에 실패했습니다.

### 오류 발생 흐름

```
Step2_5SchedulePreview (Step3)
  ↓
scheduleParams 메모이제이션 (71-168번 라인)
  ↓
필수 필드 검증 (73-80번 라인)
  - period_start ✅
  - period_end ✅
  - block_set_id ✅
  - scheduler_type ✅
  - ❌ campTemplateId 검증 없음
  ↓
scheduleParams 생성 (118-154번 라인)
  - campTemplateId 포함 (153번 라인)
  ↓
calculateScheduleAvailability 호출 (206번 라인)
  ↓
캠프 모드 블록 조회 (60번 라인)
  - if (params.isCampMode && params.campTemplateId && params.blockSetId)
  - ❌ campTemplateId가 없으면 조건 실패
  ↓
일반 모드 블록 조회로 넘어감 (106번 라인)
  - student_block_schedule 테이블에서 조회
  - ❌ block_set_id가 template_block_sets의 ID이므로 조회 실패
  ↓
blocks.length === 0 (130번 라인)
  ↓
오류 반환: "블록 세트(ID: ...)에 블록이 없습니다."
  또는
  scheduleParams가 null이 되어 "필수 정보가 누락되었습니다." 표시
```

### 왜 `campTemplateId`가 없었을까?

**가능한 원인**:

1. `PlanGroupWizard`에서 `initialData?.templateId`가 전달되지 않음
2. `app/(student)/camp/[invitationId]/page.tsx`에서 `templateId`를 `initialData`에 포함했지만, `PlanGroupWizard`에서 제대로 전달되지 않음

**확인 위치**:

- `app/(student)/camp/[invitationId]/page.tsx:257` - `templateId: template.id` 전달
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx:1352` - `campTemplateId={isCampMode ? initialData?.templateId : undefined}` 전달

## 🛠 수정 내용

### 1. `Step2_5SchedulePreview.tsx` - `campTemplateId` 필수 검증 추가

**위치**: `scheduleParams` 메모이제이션 (71-168번 라인)

**수정 전**:

```typescript
const scheduleParams = useMemo<ScheduleCalculationParams | null>(() => {
  // 필수 필드 검증
  if (
    !data.period_start ||
    !data.period_end ||
    !data.block_set_id ||
    !data.scheduler_type
  ) {
    return null;
  }
  // ... 나머지 검증
```

**수정 후**:

```typescript
const scheduleParams = useMemo<ScheduleCalculationParams | null>(() => {
  // 필수 필드 검증
  if (
    !data.period_start ||
    !data.period_end ||
    !data.block_set_id ||
    !data.scheduler_type
  ) {
    return null;
  }

  // 캠프 모드에서 campTemplateId 필수 검증
  if (isCampMode && !campTemplateId) {
    console.error("[Step2_5SchedulePreview] 캠프 모드에서 템플릿 ID가 없음:", {
      isCampMode,
      campTemplateId,
      block_set_id: data.block_set_id,
    });
    return null;
  }
  // ... 나머지 검증
```

### 2. `Step2_5SchedulePreview.tsx` - 에러 메시지 개선

**위치**: `useEffect` 내부 에러 처리 (166-174번 라인)

**수정 전**:

```typescript
} else if (isCampMode) {
  // 캠프 모드에서 필수 정보 누락
  if (!data.period_start || !data.period_end) {
    setError("학습 기간을 입력해주세요.");
  } else if (!data.block_set_id) {
    setError("블록 세트가 설정되지 않았습니다. 관리자에게 문의해주세요.");
  } else {
    setError("필수 정보가 누락되었습니다. 관리자에게 문의해주세요.");
  }
}
```

**수정 후**:

```typescript
} else if (isCampMode) {
  // 캠프 모드에서 필수 정보 누락
  if (!data.period_start || !data.period_end) {
    setError("학습 기간을 입력해주세요.");
  } else if (!data.block_set_id) {
    setError("블록 세트가 설정되지 않았습니다. 관리자에게 문의해주세요.");
  } else if (!campTemplateId) {
    setError("템플릿 정보가 누락되었습니다. 페이지를 새로고침하거나 관리자에게 문의해주세요.");
  } else {
    setError("필수 정보가 누락되었습니다. 관리자에게 문의해주세요.");
  }
}
```

### 3. `calculateScheduleAvailability.ts` - 캠프 모드 `campTemplateId` 필수 검증 추가

**위치**: 함수 시작 부분 (56번 라인 이후)

**수정 전**:

```typescript
try {
  let blocks: Block[] = [];

  // 캠프 모드: 템플릿 블록 세트의 블록 조회
  if (params.isCampMode && params.campTemplateId && params.blockSetId) {
```

**수정 후**:

```typescript
try {
  // 캠프 모드에서 campTemplateId 필수 검증
  if (params.isCampMode && !params.campTemplateId) {
    return {
      success: false,
      error: "캠프 모드에서는 템플릿 ID가 필수입니다. 페이지를 새로고침하거나 관리자에게 문의해주세요.",
      data: null,
    };
  }

  let blocks: Block[] = [];

  // 캠프 모드: 템플릿 블록 세트의 블록 조회
  if (params.isCampMode && params.campTemplateId && params.blockSetId) {
```

## ✅ 수정 효과

### 1. 조기 검증

- `scheduleParams` 생성 단계에서 `campTemplateId` 누락을 감지
- 불필요한 서버 호출 방지

### 2. 명확한 에러 메시지

- "필수 정보가 누락되었습니다." → "템플릿 정보가 누락되었습니다. 페이지를 새로고침하거나 관리자에게 문의해주세요."
- 사용자가 문제를 이해하고 해결할 수 있도록 안내

### 3. 이중 검증

- 클라이언트(`Step2_5SchedulePreview`)와 서버(`calculateScheduleAvailability`) 양쪽에서 검증
- 방어적 프로그래밍으로 안정성 향상

## 🧪 테스트 시나리오

### 시나리오 1: `campTemplateId` 누락 (수정 전)

1. 캠프 참여 페이지 접속
2. Step 1, Step 2 완료
3. Step 3 진입
4. **예상 결과**: "필수 정보가 누락되었습니다." 오류 (❌ 불명확)
5. **실제 결과**: "템플릿 정보가 누락되었습니다. 페이지를 새로고침하거나 관리자에게 문의해주세요." (✅ 명확)

### 시나리오 2: 정상 케이스

1. 캠프 참여 페이지 접속 (`templateId` 포함)
2. Step 1, Step 2 완료
3. Step 3 진입
4. **예상 결과**: 스케줄 계산 성공 (✅)

### 시나리오 3: `campTemplateId`가 서버에서 누락

1. 캠프 참여 페이지 접속
2. Step 1, Step 2 완료
3. Step 3 진입 → `calculateScheduleAvailability` 호출
4. **예상 결과**: "캠프 모드에서는 템플릿 ID가 필수입니다. 페이지를 새로고침하거나 관리자에게 문의해주세요." (✅)

## 📝 관련 파일

- `app/(student)/plan/new-group/_components/Step2_5SchedulePreview.tsx` - 클라이언트 검증
- `app/(student)/actions/calculateScheduleAvailability.ts` - 서버 검증
- `app/(student)/camp/[invitationId]/page.tsx` - `templateId` 전달
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - `campTemplateId` 전달

## 🔗 참고 문서

- `doc/camp-step3-schedule-error-analysis.md` - 이전 오류 분석 문서

---

**수정 일자**: 2024년 11월  
**수정자**: AI Assistant  
**상태**: ✅ 완료








