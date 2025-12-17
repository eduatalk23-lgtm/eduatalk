# 다음 UI 개선 작업 검토

**작성 일시**: 2025-01-XX  
**목적**: 완료된 작업 검토 및 다음 우선순위 작업 제안

---

## ✅ 완료된 작업 요약

### 1. 컴포넌트 통합
- ✅ Button 컴포넌트 통합 완료 (`atoms/Button`으로 통일)
- ✅ EmptyState 컴포넌트 통합 완료 (`molecules/EmptyState`로 통일)
- ✅ Deprecated 컴포넌트 삭제 완료

### 2. 타이포그래피 시스템 적용
- ✅ SectionHeader 컴포넌트 적용
- ✅ EmptyState 컴포넌트 적용
- ✅ Card 컴포넌트 적용
- ✅ **FormInput 컴포넌트 적용** (완료)
- ✅ **Dialog 컴포넌트 적용** (완료)
- ✅ **ErrorState 컴포넌트 적용** (완료)
- ✅ **FormMessage 컴포넌트 적용** (완료)
- ✅ 타이포그래피 시스템 사용 가이드 작성

### 3. 컴포넌트 개선
- ✅ Button 컴포넌트: 디자인 시스템 컬러 적용
- ✅ **FormInput 컴포넌트: 스타일 일관성 개선, forwardRef 추가**

---

## 📋 다음 작업 제안

### 우선순위 1: 타이포그래피 시스템 확대 적용 (대규모)

#### 현재 상태
- `components` 디렉토리에서 `text-lg`, `text-xl`, `text-2xl` 등 사용 중
- 타이포그래피 시스템 사용률: 약 30% (주요 컴포넌트는 완료)

#### 발견된 파일 (28개)
**우선순위 높음:**
- `components/ui/InstallPrompt.tsx`
- `components/molecules/StatCard.tsx`
- `components/ui/TimeRangeInput.tsx`
- `components/ui/StickySaveButton.tsx`
- `components/ui/SchoolSelect.tsx`
- `components/ui/SchoolMultiSelect.tsx`

**우선순위 중간:**
- `components/molecules/SearchModal.tsx`
- `components/molecules/Tabs.tsx`
- `components/organisms/DataTable.tsx`
- `components/filters/UnifiedContentFilter.tsx`
- `components/forms/BaseBookSelector.tsx`

**우선순위 낮음:**
- `components/errors/ErrorBoundary.tsx`
- `components/navigation/global/navStyles.ts`
- `components/admin/ExcelImportDialog.tsx`
- 기타 15개 파일

#### 개선 방안
1. 우선순위 높은 컴포넌트부터 적용
   - `InstallPrompt.tsx` (PWA 설치 프롬프트)
   - `StatCard.tsx` (통계 카드)
   - `TimeRangeInput.tsx` (시간 범위 입력)
   - `StickySaveButton.tsx` (저장 버튼)
2. 점진적 확대
   - 새로운 컴포넌트 작성 시 필수 적용
   - 기존 컴포넌트는 리팩토링 시 적용

#### 예상 작업량
- 우선순위 높음: 6개 파일 (각 10-20분)
- 우선순위 중간: 5개 파일 (각 15-25분)
- 우선순위 낮음: 점진적 적용

---

### 우선순위 2: Margin 클래스 제거 (점진적)

#### 현재 상태
- `components` 디렉토리에서 17개 파일에서 margin 클래스 사용
- 대부분 특수 케이스 (아이콘 정렬, 리스트 들여쓰기 등)

#### 발견된 파일 (10개)
- `components/ui/LoadingSkeleton.tsx`
- `components/ui/InstallPrompt.tsx`
- `components/errors/ErrorBoundary.tsx`
- `components/navigation/global/navStyles.ts`
- `components/admin/ExcelImportDialog.tsx`
- `components/errors/GlobalErrorBoundary.tsx`
- `components/ui/FormCheckbox.tsx`
- `components/navigation/global/CategoryNav.tsx`
- `components/ui/DropdownMenu.tsx`
- `components/navigation/global/LogoSection.tsx`

#### 개선 방안
1. 가능한 부분만 수정
   - Spacing-First 정책 위반 부분만
   - 특수 케이스는 예외 처리
2. 점진적 적용
   - 컴포넌트 수정 시 기회가 생기면 적용

#### 예상 작업량
- 10개 파일 검토 및 수정
- 각 파일당 5-15분

---

### 우선순위 3: 기타 컴포넌트 개선 (점진적)

#### FormField 컴포넌트
- 에러 메시지: `text-xs` → `text-body-2`
- 힌트 메시지: `text-xs` → `text-body-2`

#### Input 컴포넌트
- sizeClasses의 `text-xs`, `text-sm`, `text-base` 검토
- 타이포그래피 시스템과의 일관성 확보

#### 기타 컴포넌트
- `InstallPrompt.tsx`: 타이포그래피 시스템 적용
- `StatCard.tsx`: 타이포그래피 시스템 적용
- `TimeRangeInput.tsx`: 타이포그래피 시스템 적용

---

## 🎯 권장 작업 순서

### Phase 1: 우선순위 높은 컴포넌트 타이포그래피 적용 (2-3시간)
1. `InstallPrompt.tsx` 수정
2. `StatCard.tsx` 수정
3. `TimeRangeInput.tsx` 수정
4. `StickySaveButton.tsx` 수정
5. `SchoolSelect.tsx` 수정
6. `SchoolMultiSelect.tsx` 수정
7. 테스트 및 커밋

### Phase 2: FormField 컴포넌트 개선 (30분-1시간)
1. 에러/힌트 메시지 타이포그래피 적용
2. 테스트 및 커밋

### Phase 3: Margin 클래스 정리 (점진적)
1. 가능한 부분만 수정
2. 특수 케이스는 예외 처리
3. 컴포넌트 수정 시 기회가 생기면 적용

### Phase 4: 나머지 컴포넌트 개선 (점진적)
1. 컴포넌트 수정 시 기회가 생기면 적용
2. 새로운 컴포넌트 작성 시 필수 적용

---

## 📊 작업 우선순위 매트릭스

| 작업 | 우선순위 | 작업량 | 영향도 | ROI | 상태 |
|------|----------|--------|--------|-----|------|
| FormInput 개선 | 높음 | 중간 | 중간 | 높음 | ✅ 완료 |
| Dialog/ErrorState/FormMessage | 높음 | 소규모 | 높음 | 높음 | ✅ 완료 |
| 타이포그래피 확대 (우선순위 높음) | 중간 | 중간 | 높음 | 높음 | ⏳ 진행 중 |
| FormField 개선 | 중간 | 소규모 | 중간 | 중간 | ⏳ 대기 |
| Margin 클래스 제거 | 낮음 | 대규모 | 낮음 | 낮음 | ⏳ 점진적 |
| 기타 컴포넌트 개선 | 낮음 | 소규모 | 낮음 | 중간 | ⏳ 점진적 |

---

## 💡 권장 사항

### 즉시 진행 권장
1. **우선순위 높은 컴포넌트 타이포그래피 적용** (6개 파일)
   - InstallPrompt, StatCard, TimeRangeInput 등
   - 자주 사용되는 컴포넌트
2. **FormField 컴포넌트 개선**
   - 빠르게 완료 가능
   - FormField는 자주 사용됨

### 점진적 진행 권장
1. **Margin 클래스 제거** - 컴포넌트 수정 시 기회가 생기면 적용
2. **나머지 컴포넌트 타이포그래피 적용** - 새로운 컴포넌트 작성 시 필수 적용

---

## 📚 참고 자료

- 타이포그래피 시스템 가이드: `docs/ui-typography-system-guide.md`
- 컴포넌트 통합 계획: `docs/component-consolidation-plan.md`
- 컴포넌트 통합 완료 보고서: `docs/component-consolidation-completed.md`
- UI 개선 작업: `docs/ui-improvement-2025-01-XX.md`

---

**작성 일시**: 2025-01-XX

