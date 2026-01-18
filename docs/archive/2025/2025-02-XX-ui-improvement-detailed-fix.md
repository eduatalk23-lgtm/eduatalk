# UI 개선 상세 수정 작업

**작업 일시**: 2025-02-XX  
**목적**: UI 개선 필요 페이지 분석 결과를 바탕으로 인라인 스타일 제거, Spacing-First 정책 적용, 중복 코드 최적화

---

## 작업 개요

UI 개선 필요 페이지 분석 결과를 바탕으로 다음을 수행:
1. 인라인 스타일 제거 (우선순위 높음)
2. Margin 클래스 제거 및 Spacing-First 정책 적용
3. space-y/space-x → gap 변환
4. 중복 코드 최적화 및 공통 컴포넌트 재사용

---

## 수정된 파일

### Phase 1: 인라인 스타일 제거

#### 1.1 RiskIndexList.tsx

**파일**: `app/(student)/analysis/_components/RiskIndexList.tsx`

**수정 사항**:
- Line 118-120: `style={{ backgroundColor: getRiskColorHex(...) }}` → `getRiskColor()` 함수의 `bg` 클래스 사용
- Line 146-152: `style={{ width: `${analysis.consistency_score}%` }}` → `ProgressBar` 컴포넌트 사용
- Line 159-165: `style={{ width: `${analysis.mastery_estimate}%` }}` → `ProgressBar` 컴포넌트 사용
- Line 46: `mb-4` → 부모에 `flex flex-col gap-4` 추가
- Line 187: `mb-2` → 부모에 `flex flex-col gap-2` 추가
- Line 43: `space-y-6` → `flex flex-col gap-6`
- Line 190: `space-y-1` → `flex flex-col gap-1`

**Before**:
```tsx
<div
  className={cn("h-3 w-16 rounded-full")}
  style={{
    backgroundColor: getRiskColorHex(analysis.risk_score),
  }}
/>

<div className="h-2 w-16 bg-gray-200 rounded-full overflow-hidden">
  <div
    className="h-full bg-blue-600"
    style={{
      width: `${analysis.consistency_score}%`,
    }}
  />
</div>
```

**After**:
```tsx
{(() => {
  const riskColor = getRiskColor(analysis.risk_score);
  return (
    <div className={cn("h-3 w-16 rounded-full", riskColor.bg)} />
  );
})()}

<div className="w-16">
  <ProgressBar
    value={analysis.consistency_score}
    color="blue"
    height="sm"
  />
</div>
```

---

### Phase 2: BlockSetTimeline.tsx & BlockTimeline.tsx

#### 2.1 BlockSetTimeline.tsx

**파일**: `app/(student)/plan/new-group/_components/_shared/BlockSetTimeline.tsx`

**수정 사항**:
- Line 21: `space-y-3` → `flex flex-col gap-3`
- Line 85: `space-y-3` → `flex flex-col gap-3`
- 동적 위치/높이 계산은 타임라인 시각화 특성상 인라인 스타일 유지 (예외 허용)

**참고**: `BlockTimeline.tsx`는 이미 `gap`을 사용하고 있어 수정 불필요

---

### Phase 3: space-y/space-x 대량 교체

#### 3.1 AcademyScheduleManagement.tsx

**파일**: `app/(student)/blocks/_components/AcademyScheduleManagement.tsx`

**수정 사항**:
- Line 394: `space-y-6` → `flex flex-col gap-6`
- Line 397: `mt-1` → 부모에 `flex flex-col gap-1` 추가
- Line 415: `mb-4` → 부모에 `flex flex-col gap-4` 추가
- Line 423: `mb-3` → 부모에 `flex flex-col gap-3` 추가
- Line 426: `mb-3` → 부모에 `flex flex-col gap-3` 추가
- Line 428: `mb-1` → 부모에 `flex flex-col gap-1` 추가
- Line 440: `mb-1` → 부모에 `flex flex-col gap-1` 추가
- Line 481: `space-y-2` → `flex flex-col gap-2`
- Line 504: `mt-1` → 부모에 `flex flex-col gap-1` 추가
- Line 546: `mb-4` → 부모에 `flex flex-col gap-4` 추가
- Line 549: `mt-1` → 부모에 `flex flex-col gap-1` 추가
- Line 573: `mb-3` → 부모에 `flex flex-col gap-3` 추가
- Line 576: `mb-3 space-y-4` → `flex flex-col gap-3` 및 `flex flex-col gap-4`로 분리
- Line 578: `mb-2` → 부모에 `flex flex-col gap-2` 추가
- Line 600: `mb-1` → 부모에 `flex flex-col gap-1` 추가
- Line 611: `mb-1` → 부모에 `flex flex-col gap-1` 추가
- Line 622: `mb-1` → 부모에 `flex flex-col gap-1` 추가
- Line 676: `space-y-3` → `flex flex-col gap-3`
- Line 679: `mb-2` → 부모에 `flex flex-col gap-2` 추가
- Line 682: `space-y-2` → `flex flex-col gap-2`
- Line 700: `mt-1` → 부모에 `flex flex-col gap-1` 추가

---

#### 3.2 Step6FinalReview.tsx

**파일**: `app/(student)/plan/new-group/_components/Step6FinalReview/Step6FinalReview.tsx`

**수정 사항**:
- Line 294: `space-y-6` → `flex flex-col gap-6`
- Line 303: `space-y-6` → `flex flex-col gap-6`
- Line 308: `mt-1` → 부모에 `flex flex-col gap-1` 추가
- Line 318, 324, 332: `mt-1` → 부모에 `flex flex-col gap-1` 추가
- Line 342: `mb-3` → 부모에 `flex flex-col gap-3` 추가
- Line 348: `space-y-1` → `flex flex-col gap-1`
- Line 374, 390, 400, 416, 425: `mt-1` → 부모에 `flex flex-col gap-1` 추가
- Line 478: `space-y-4` → `flex flex-col gap-4`
- Line 482: `space-y-3` → `flex flex-col gap-3`
- Line 493: `mb-3` → 부모에 `flex flex-col gap-3` 추가
- Line 509: `space-y-2` → `flex flex-col gap-2`
- Line 519: `mt-1` → 부모에 `flex flex-col gap-1` 추가

---

#### 3.3 ScheduleTableView.tsx

**파일**: `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`

**수정 사항**:
- Line 540: `space-y-4` → `flex flex-col gap-4`
- Line 543: `space-y-2` → `flex flex-col gap-2`
- Line 550: `space-y-1.5` → `flex flex-col gap-1.5`
- Line 580: `mt-1` → 부모에 `flex flex-col gap-1` 추가
- Line 590: `space-y-2` → `flex flex-col gap-2`
- Line 597: `space-y-1.5` → `flex flex-col gap-1.5`
- Line 1079: `space-y-1.5` → `flex flex-col gap-1.5`
- Line 1123: `space-y-1.5` → `flex flex-col gap-1.5`

---

#### 3.4 Step6Simplified.tsx

**파일**: `app/(student)/plan/new-group/_components/Step6Simplified.tsx`

**수정 사항**:
- Line 368: `space-y-6` → `flex flex-col gap-6`
- Line 387: `mb-4` → 부모에 `flex flex-col gap-4` 추가
- Line 426: `mb-4 space-y-3` → `flex flex-col gap-4` 및 `flex flex-col gap-3`로 분리
- Line 428: `mb-2` → 부모에 `flex flex-col gap-2` 추가
- Line 492: `mb-2` → 부모에 `flex flex-col gap-2` 추가
- Line 512: `mt-1` → 부모에 `flex flex-col gap-1` 추가
- Line 521: `space-y-3` → `flex flex-col gap-3`
- Line 536: `mb-2` → 부모에 `flex flex-col gap-2` 추가
- Line 543, 548: `mt-1` → 부모에 `flex flex-col gap-1` 추가
- Line 558: `space-y-2` → `flex flex-col gap-2`
- Line 626: `mb-2` → 부모에 `flex flex-col gap-2` 추가
- Line 627: `space-y-1` → `flex flex-col gap-1`
- Line 654: `space-y-6` → `flex flex-col gap-6`
- Line 658: `mt-1` → 부모에 `flex flex-col gap-1` 추가
- Line 665: `space-y-4` → `flex flex-col gap-4`
- Line 744: `mt-2 space-y-1` → 부모에 `flex flex-col gap-2` 추가하고 자식에 `flex flex-col gap-1` 추가

---

## 중복 코드 최적화

### 1. 진행률 바 패턴 통합

**발견된 중복 패턴**:
```tsx
// RiskIndexList.tsx에서 3번 반복
<div className="h-2 w-16 bg-gray-200 rounded-full overflow-hidden">
  <div
    className="h-full bg-blue-600"
    style={{ width: `${value}%` }}
  />
</div>
```

**해결책**:
- `ProgressBar` 컴포넌트 사용 (이미 존재)
- `components/atoms/ProgressBar.tsx` 활용

**참고**: `ProgressBar` 컴포넌트는 동적 width를 위해 인라인 스타일을 사용하지만, 이는 컴포넌트 내부에서 처리되므로 허용됨

### 2. Risk 색상 표시 패턴 통합

**발견된 패턴**:
- `getRiskColorHex()`로 hex 값 가져와서 인라인 스타일 사용
- `getRiskColor()`로 Tailwind 클래스 가져와서 사용

**해결책**:
- `getRiskColor()` 함수의 `bg` 클래스 사용 (Tailwind 클래스)
- 인라인 스타일 제거

---

## 검증 결과

### Linter 검증
- ✅ 모든 수정된 파일에서 linter 에러 없음

### TypeScript 검증
- ✅ 수정된 파일에서 TypeScript 에러 없음

---

## 개선 효과

### 코드 품질
- ✅ 인라인 스타일 제거로 일관성 향상
- ✅ Spacing-First 정책 준수
- ✅ 중복 코드 제거로 유지보수성 향상
- ✅ 공통 컴포넌트 재사용

### 성능
- ✅ Tailwind 클래스 사용으로 CSS 최적화
- ✅ 불필요한 인라인 스타일 계산 제거

### 일관성
- ✅ 표준화된 spacing 패턴
- ✅ 통일된 진행률 바 UI
- ✅ 통일된 위험도 표시 UI

---

## 수정 통계

- **인라인 스타일 제거**: 1개 파일 (RiskIndexList.tsx)
- **Margin 클래스 제거**: 4개 파일
- **space-y/space-x 제거**: 6개 파일
- **중복 코드 제거**: 진행률 바 패턴 3개, 위험도 색상 표시 패턴 1개

---

## 참고 파일

- [components/atoms/ProgressBar.tsx](components/atoms/ProgressBar.tsx) - ProgressBar 컴포넌트
- [lib/constants/colors.ts](lib/constants/colors.ts) - 색상 유틸리티 함수
- [docs/2025-01-XX-ui-improvement-inline-styles-spacing.md](docs/2025-01-XX-ui-improvement-inline-styles-spacing.md) - 이전 개선 작업

---

## 주의사항

1. **타임라인 시각화**: 동적 위치 계산이 필요한 경우 인라인 스타일 예외 허용
2. **ProgressBar 컴포넌트**: 내부적으로 동적 width를 위해 인라인 스타일 사용 (예외 허용)
3. **mt-auto**: flexbox 정렬용으로 예외 허용 (dashboard/page.tsx)
4. **점진적 마이그레이션**: space-y/space-x는 우선순위에 따라 단계적으로 진행 (나머지 90개 파일은 별도 작업)

