# 1730 Timetable 학습일/복습일 토글 UI 개선

## 작성 일자
2025-12-01

## 작업 내용

### 변경 사항
Step1 기본 정보에서 1730 Timetable 스케줄러 옵션의 학습일/복습일 설정을 개선했습니다.

### 주요 개선 사항

#### 1. UI 변경: Range Input → 토글 버튼
- **기존**: 슬라이더(range input) 형식
- **변경**: 증가/감소 버튼 + 숫자 표시 형식
- 학습 주수 설정 UI와 동일한 패턴 적용으로 일관성 향상

#### 2. 제약 조건 추가
- **학습일 + 복습일 = 7일 고정**
  - 학습일 변경 시 복습일 자동 조정
  - 복습일 변경 시 학습일 자동 조정
- **복습일 최소값: 1일** (0일 불가)
- 학습일 범위: 1~6일
- 복습일 범위: 1~6일

#### 3. 복습 범위 항목 제거
- `review_scope` (부분 복습/전체 복습) 선택 옵션 제거
- 1730 Timetable 설명에서 복습 범위 관련 내용 제거
- 설명 텍스트 간소화 및 7일 제약 조건 명시

### 기본값
- 학습일: 6일
- 복습일: 1일

## 수정 파일

### `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

#### 변경 내용
1. **학습일 수 입력 UI** (라인 1790-1829)
   - Range input → 토글 버튼 (감소/증가)
   - 학습일 변경 시 복습일 자동 계산 (7 - 학습일)
   - 최소값: 1일, 최대값: 6일

2. **복습일 수 입력 UI** (라인 1830-1873)
   - Range input → 토글 버튼 (감소/증가)
   - 복습일 변경 시 학습일 자동 계산 (7 - 복습일)
   - 최소값: 1일, 최대값: 6일
   - 안내 문구 변경: "학습일 + 복습일 = 7일로 고정됩니다. 복습일은 최소 1일이어야 합니다."

3. **복습 범위 항목 제거** (기존 라인 1874-1900)
   - `review_scope` select 요소 완전 제거

4. **설명 텍스트 개선** (라인 1749-1761)
   - 복습 범위 관련 설명 제거
   - 7일 제약 조건 명시
   - "학습일과 복습일의 비율을 조절하여 자신에게 맞는 학습 패턴을 설정할 수 있습니다. (학습일 + 복습일 = 7일)"

## 구현 로직

### 학습일 변경 로직
```typescript
const newStudyDays = Math.max(1, currentStudyDays - 1); // 또는 +1
const newReviewDays = 7 - newStudyDays;
onUpdate({
  scheduler_options: {
    ...data.scheduler_options,
    study_days: newStudyDays,
    review_days: newReviewDays,
  },
  study_review_cycle: {
    study_days: newStudyDays,
    review_days: newReviewDays,
  },
});
```

### 복습일 변경 로직
```typescript
const newReviewDays = Math.max(1, currentReviewDays - 1); // 또는 +1
const newStudyDays = 7 - newReviewDays;
onUpdate({
  scheduler_options: {
    ...data.scheduler_options,
    study_days: newStudyDays,
    review_days: newReviewDays,
  },
  study_review_cycle: {
    study_days: newStudyDays,
    review_days: newReviewDays,
  },
});
```

## 검증 사항

### ✅ 완료된 검증
- [x] 학습일 + 복습일 = 7일 항상 유지
- [x] 복습일이 0일이 될 수 없음 (최소 1일)
- [x] 학습일 변경 시 복습일 자동 조정
- [x] 복습일 변경 시 학습일 자동 조정
- [x] 기본값이 올바르게 설정됨 (학습일 6일, 복습일 1일)
- [x] 복습 범위 항목이 완전히 제거됨
- [x] 캠프 모드에서의 권한 체크 정상 동작
- [x] Linting 오류 없음

## 사용자 경험 개선
1. **직관적인 UI**: 버튼 클릭으로 간편하게 값 조절 가능
2. **명확한 제약**: 7일 구성이 명확하게 표시됨
3. **일관성**: 다른 설정(학습 주수)과 동일한 UI 패턴 사용
4. **실시간 반영**: 한쪽 값 변경 시 다른 쪽 자동 업데이트

## 관련 파일
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`
- `lib/types/plan.ts` (타입 정의 - 변경 없음)
- `lib/plan/scheduler.ts` (스케줄러 로직 - 변경 없음)

## 향후 고려사항
- 현재 `scheduler_options`의 `review_scope` 필드는 데이터베이스에 남아있을 수 있음
- 필요시 마이그레이션으로 해당 필드 제거 고려
- 기존 플랜 그룹의 `review_scope` 값은 무시됨 (UI에서 제거됨)

