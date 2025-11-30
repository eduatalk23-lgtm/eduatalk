# 플랜 그룹 상세보기 스케줄 미리보기 Props 수정 (2025-11-30)

## 개요

`PlanGroupDetailView` 컴포넌트에서 `Step2TimeSettingsWithPreview`를 사용할 때 필수 props가 누락되어 스케줄 미리보기가 작동하지 않던 문제를 수정했습니다.

## 문제 상황

### 증상
- 플랜 그룹 상세보기 페이지의 Tab 2 (블록 및 제외일)에서 스케줄 미리보기가 표시되지 않음
- 우측 패널에 "스케줄 미리보기" 섹션이 비어있거나 "필수 정보 미입력" 메시지만 표시됨
- 최근 개선사항(하이브리드 갱신 전략, 캐시 인디케이터, 학습시간 계산 개선)이 반영되지 않음

### 근본 원인

`PlanGroupDetailView.tsx`의 Tab 2에서 `Step2TimeSettingsWithPreview` 컴포넌트 호출 시 다음 props가 누락됨:

**수정 전 (라인 179-188)**:
```typescript
<Step2TimeSettingsWithPreview 
  data={wizardData}
  onUpdate={() => {}} 
  editable={false}
  isCampMode={false}              // ❌ 잘못된 prop 이름
  studentId={group.student_id}
  blockSets={blockSets}
  campTemplateId={campTemplateId || undefined}
  // ❌ periodStart 누락
  // ❌ periodEnd 누락
/>
```

### 왜 문제가 발생했나?

`SchedulePreviewPanel` 컴포넌트는 스케줄 계산을 위해 다음 조건을 필수로 요구합니다:

```typescript
// SchedulePreviewPanel.tsx:97-109
const scheduleParams = useMemo<ScheduleCalculationParams | null>(() => {
  if (
    !data.period_start ||          // ❌ 누락됨
    !data.period_end ||             // ❌ 누락됨
    !data.scheduler_type ||
    (!isTemplateMode && !data.block_set_id)
  ) {
    return null;  // null 반환으로 스케줄 계산 실행 안됨
  }
  
  if (isCampMode && !campTemplateId) {
    return null;
  }
  
  // ... 스케줄 계산 파라미터 생성
}, [/* dependencies */]);
```

`PlanGroupDetailView`에서 `periodStart`, `periodEnd` props를 전달하지 않았기 때문에 `data.period_start`, `data.period_end`가 `undefined`가 되어 `scheduleParams`가 `null`을 반환하고 스케줄 계산이 실행되지 않았습니다.

## 수정 내용

### 파일: `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`

**수정 후 (라인 179-189)**:
```typescript
<Step2TimeSettingsWithPreview 
  data={wizardData}
  onUpdate={() => {}} // 읽기 전용 - 변경 불가
  periodStart={group.period_start}        // ✅ 추가
  periodEnd={group.period_end}            // ✅ 추가
  editable={false} // 완전히 읽기 전용
  campMode={!!campTemplateId}             // ✅ isCampMode → campMode로 수정
  isTemplateMode={false}
  studentId={group.student_id}
  blockSets={blockSets}
  campTemplateId={campTemplateId || undefined}
/>
```

### 변경 사항 요약

1. **`periodStart` 추가**: `group.period_start` 전달
2. **`periodEnd` 추가**: `group.period_end` 전달
3. **`campMode` 수정**: `isCampMode={false}` → `campMode={!!campTemplateId}`
   - 캠프 템플릿 ID가 있으면 캠프 모드로 동작
   - 템플릿 블록 조회 및 캠프 전용 로직 활성화

## 영향 분석

### 수정 파일
- `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx` (1개 파일, 3줄 추가)

### 영향받는 화면
- ✅ **플랜 그룹 상세보기 - Tab 2 (블록 및 제외일)**
  - 스케줄 미리보기 패널이 이제 정상 작동
  - 최근 개선사항 모두 반영

### 영향받지 않는 화면
- ✅ **PlanGroupWizard**: 이미 올바르게 props 전달 중 (변경 없음)
- ✅ **캠프 템플릿 생성/수정**: 별도 컴포넌트 사용 (변경 없음)
- ✅ **Step7 스케줄 결과**: 독립적인 컴포넌트 (변경 없음)

## 적용된 최근 개선사항

이 수정으로 `PlanGroupDetailView`에서도 다음 최근 개선사항들이 정상적으로 적용됩니다:

### 1. 하이브리드 갱신 전략 ([schedule-preview-improvement-2025-11-30.md](./schedule-preview-improvement-2025-11-30.md))
- ✅ 최초 진입 시 "스케줄 확인하기" 버튼 표시
- ✅ 블록/제외일/학원일정 변경 시 자동 재계산
- ✅ "다시 계산하기" 버튼 (Shift+클릭으로 캐시 무시)

### 2. 캐시 시스템
- ✅ 캐시 사용 시: 회색 배지 "캐시 (N분 전)"
- ✅ 새로 계산 시: 초록색 배지 "새로 계산됨"
- ✅ 상대 시간 표시 (초/분/시간/일 단위)

### 3. 로딩 상태 개선
- ✅ 진행 단계 표시 ("블록 조회 중..." → "스케줄 계산 중..." → "완료")
- ✅ 스켈레톤 UI (5개 통계 카드)
- ✅ 예상 소요 시간 안내

### 4. 학습시간 계산 개선 ([step3-학습시간-계산-개선-가이드.md](./step3-학습시간-계산-개선-가이드.md))
- ✅ 순수 학습시간과 자율학습 시간 구분 표시
- ✅ 제외일 통계 표시 (주차별 섹션)

### 5. 에러 처리 개선
- ✅ 사용자 친화적 에러 메시지
- ✅ 일반 모드/캠프 모드 구분 안내
- ✅ 개발 모드 디버그 로깅

## 동작 확인

### 일반 플랜 그룹 상세보기
1. 일반 플랜 그룹 상세 페이지 접근
2. Tab 2 (블록 및 제외일) 클릭
3. ✅ 우측에 "스케줄 미리보기" 섹션 표시
4. ✅ 최초 진입 시 "스케줄 확인하기" 버튼 표시
5. 버튼 클릭
6. ✅ 로딩 단계 표시 ("블록 조회 중..." → "스케줄 계산 중...")
7. ✅ 통계 카드 4개 표시:
   - 총 기간 (일)
   - 제외일 (일)
   - 학습일 (일)
   - 총 학습시간 (시간)
8. ✅ 주차별 스케줄 아코디언 표시
9. ✅ 각 주차 확장 시 일별 상세 정보 표시
   - 날짜
   - 일자 유형 (학습일/복습일/지정휴일 등) 배지
   - 학습시간

### 캠프 플랜 그룹 상세보기
1. 캠프 플랜 그룹 상세 페이지 접근
2. Tab 2 클릭
3. ✅ `campMode={true}`로 템플릿 블록 자동 조회
4. ✅ 캠프 템플릿의 제외일 정보 반영
5. ✅ 템플릿 블록 기반 스케줄 계산
6. ✅ 일반 모드와 동일한 UI/UX

### 캐시 동작
1. Tab 2에서 "스케줄 확인하기" 클릭
2. 스케줄 계산 완료 → "새로 계산됨" 배지
3. Tab 1로 이동
4. Tab 2로 복귀
5. ✅ 캐시된 결과 즉시 표시
6. ✅ "캐시 (N분 전)" 배지 표시
7. "다시 계산하기" 클릭 → 재계산
8. Shift+클릭 → 캐시 무시하고 강제 재계산

## 기술적 세부사항

### Props 전달 흐름

```
PlanGroupDetailView
  ├─ group (PlanGroup 객체)
  │   ├─ period_start: "2025-01-01"
  │   ├─ period_end: "2025-03-31"
  │   └─ camp_template_id: string | null
  │
  └─ Step2TimeSettingsWithPreview
      ├─ periodStart={group.period_start}  ✅
      ├─ periodEnd={group.period_end}      ✅
      ├─ campMode={!!campTemplateId}       ✅
      └─ ...other props
          │
          └─ SchedulePreviewPanel
              ├─ data.period_start (from periodStart prop)  ✅
              ├─ data.period_end (from periodEnd prop)      ✅
              └─ scheduleParams 생성 성공 → 스케줄 계산 실행
```

### 캠프 모드 감지 로직

```typescript
// PlanGroupDetailView.tsx:183
campMode={!!campTemplateId}

// 설명:
// - campTemplateId가 있으면 (truthy) → campMode={true}
// - campTemplateId가 null/undefined → campMode={false}
// - 캠프 모드에서는 템플릿 블록 조회, 일반 모드에서는 선택된 블록 세트 사용
```

### SchedulePreviewPanel 내부 검증

```typescript
// SchedulePreviewPanel.tsx:97-109
const scheduleParams = useMemo<ScheduleCalculationParams | null>(() => {
  // 1. 필수 필드 검증
  if (
    !data.period_start ||     // ✅ group.period_start에서 전달됨
    !data.period_end ||       // ✅ group.period_end에서 전달됨
    !data.scheduler_type ||
    (!isTemplateMode && !data.block_set_id)
  ) {
    return null;
  }

  // 2. 캠프 모드 추가 검증
  if (isCampMode && !campTemplateId) {
    return null;
  }

  // 3. 검증 통과 → 스케줄 계산 파라미터 생성
  return {
    periodStart: data.period_start,
    periodEnd: data.period_end,
    schedulerType: data.scheduler_type as "1730_timetable",
    blockSetId: data.block_set_id || "default",
    exclusions: data.exclusions || [],
    academySchedules: data.academy_schedules || [],
    schedulerOptions: data.scheduler_options,
    timeSettings: data.time_settings,
  };
}, [/* dependencies */]);
```

## 관련 컴포넌트 구조

```
PlanGroupDetailView.tsx (수정됨)
  └─ Step2TimeSettingsWithPreview.tsx
      ├─ TimeSettingsPanel.tsx (좌측 40%)
      │   ├─ ExclusionsPanel
      │   ├─ AcademySchedulePanel
      │   ├─ TimeConfigPanel
      │   └─ NonStudyTimeBlocksPanel
      │
      └─ SchedulePreviewPanel.tsx (우측 60%, 이제 작동함!)
          ├─ 스케줄 확인하기 버튼
          ├─ 로딩 상태 (단계별)
          ├─ 캐시 인디케이터
          ├─ 통계 카드 4개
          └─ 주차별 스케줄 아코디언
```

## 테스트 가이드

### 수동 테스트 시나리오

#### 1. 일반 플랜 그룹 (필수)
```
전제조건: 일반 플랜 그룹 생성 완료
1. 플랜 목록에서 일반 플랜 그룹 클릭
2. Tab 2 "블록 및 제외일" 클릭
3. 우측 "스케줄 미리보기" 섹션 확인
4. "스케줄 확인하기" 버튼 클릭
5. 로딩 → 통계 카드 4개 표시 확인
6. 주차별 스케줄 확장/축소 동작 확인
7. "다시 계산하기" 버튼 동작 확인
8. Tab 이동 후 복귀 → 캐시 배지 확인
```

#### 2. 캠프 플랜 그룹 (권장)
```
전제조건: 캠프 템플릿 생성 및 학생 참여 완료
1. 캠프 플랜 그룹 상세보기 접근
2. Tab 2 클릭
3. 템플릿 블록으로 스케줄 계산 확인
4. 캠프 템플릿의 제외일 반영 확인
```

#### 3. 에러 케이스 (선택)
```
전제조건: 블록 세트가 없는 플랜 그룹
1. 블록 세트 미설정 플랜 그룹 접근
2. Tab 2 클릭
3. "필수 정보가 누락되었습니다" 메시지 확인
```

### 회귀 테스트

다른 Tab들이 정상 동작하는지 확인:
- ✅ Tab 1: 기본 정보
- ✅ Tab 2: 블록 및 제외일 (수정됨)
- ✅ Tab 4: 콘텐츠 선택
- ✅ Tab 6: 최종 검토
- ✅ Tab 7: 스케줄 결과

## 향후 개선 사항

### 1. Props 타입 안전성 강화 (Low Priority)
```typescript
// Step2TimeSettingsWithPreview.tsx Props 정의 개선
type Step2TimeSettingsWithPreviewProps = {
  // ... 기존 props
  periodStart: string;  // optional 제거
  periodEnd: string;    // optional 제거
};
```

### 2. 읽기 전용 모드 개선 (Medium Priority)
- 현재: `onUpdate={() => {}}` 빈 함수 전달
- 개선안: `readonly?: boolean` prop 추가하여 내부에서 조건부 렌더링

### 3. 캠프 모드 자동 감지 (Low Priority)
- 현재: `campMode={!!campTemplateId}`로 수동 계산
- 개선안: `Step2TimeSettingsWithPreview` 내부에서 `data.camp_template_id` 확인하여 자동 감지

## 관련 문서

- [스케줄 미리보기 하이브리드 갱신 전략](./schedule-preview-improvement-2025-11-30.md)
- [Step2 통합 컴포넌트 정리](./step2-integration-completion.md)
- [학습시간 계산 개선](./step3-학습시간-계산-개선-가이드.md)
- [캠프 프로세스 개선](./camp-process-improvement.md)

## 결론

간단한 props 누락 문제였지만, 이로 인해 플랜 그룹 상세보기에서 최근 개선된 모든 스케줄 미리보기 기능이 작동하지 않았습니다. 

이번 수정으로:
- ✅ `PlanGroupDetailView`에서 스케줄 미리보기 정상 작동
- ✅ 최근 개선사항 모두 반영 (하이브리드 갱신, 캐시, 로딩 상태, 학습시간 계산)
- ✅ 일반 모드/캠프 모드 모두 지원
- ✅ 일관된 사용자 경험 제공

모든 플랜 그룹 관련 화면에서 동일한 스케줄 미리보기 UX를 제공하게 되었습니다.

