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
- ✅ 타이포그래피 시스템 사용 가이드 작성

### 3. Button 컴포넌트 개선
- ✅ 디자인 시스템 컬러 적용
- ✅ 다크모드 지원 개선

---

## 📋 다음 작업 제안

### 우선순위 1: FormInput 개선 (중간 규모)

#### 현재 상태
- `components/ui/FormInput.tsx`: 타이포그래피 시스템 미적용
- `text-sm`, `text-xs` 사용 중
- 디자인 시스템 컬러 부분 적용

#### 개선 사항
1. 타이포그래피 시스템 적용
   - `text-sm` → `text-body-2`
   - `text-xs` → `text-body-2` (에러 메시지)
2. 스타일 일관성 개선
   - `atoms/Input`과 스타일 통일
   - 디자인 시스템 컬러 완전 적용

#### 예상 작업량
- 1개 파일 수정
- 사용처 테스트 (2개 파일)

---

### 우선순위 2: 타이포그래피 시스템 확대 적용 (대규모)

#### 현재 상태
- `components` 디렉토리에서 `text-lg`, `text-xl`, `text-2xl` 등 사용 중
- 타이포그래피 시스템 사용률 낮음

#### 발견된 파일 (10개)
- `components/ui/Dialog.tsx`
- `components/ui/InstallPrompt.tsx`
- `components/molecules/StatCard.tsx`
- `components/ui/FormMessage.tsx`
- `components/errors/ErrorBoundary.tsx`
- `components/ui/ErrorState.tsx`
- `components/navigation/global/navStyles.ts`
- `components/admin/ExcelImportDialog.tsx`
- `components/ui/TimeRangeInput.tsx`

#### 개선 방안
1. 주요 컴포넌트부터 적용
   - `Dialog.tsx`
   - `ErrorState.tsx`
   - `FormMessage.tsx`
2. 점진적 확대
   - 새로운 컴포넌트 작성 시 필수 적용
   - 기존 컴포넌트는 리팩토링 시 적용

#### 예상 작업량
- 10개 파일 수정
- 각 파일당 10-20분

---

### 우선순위 3: Margin 클래스 제거 (대규모)

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

### 우선순위 4: 기타 컴포넌트 개선 (소규모)

#### ErrorState 컴포넌트
- 타이포그래피 시스템 적용
- 디자인 시스템 컬러 완전 적용

#### FormMessage 컴포넌트
- 타이포그래피 시스템 적용
- 스타일 일관성 개선

#### Dialog 컴포넌트
- 타이포그래피 시스템 적용 (제목, 설명)

---

## 🎯 권장 작업 순서

### Phase 1: FormInput 개선 (1-2시간)
1. `FormInput` 컴포넌트 수정
2. 타이포그래피 시스템 적용
3. 스타일 일관성 개선
4. 테스트 및 커밋

### Phase 2: 주요 컴포넌트 타이포그래피 적용 (2-3시간)
1. `Dialog.tsx` 수정
2. `ErrorState.tsx` 수정
3. `FormMessage.tsx` 수정
4. 테스트 및 커밋

### Phase 3: Margin 클래스 정리 (1-2시간)
1. 가능한 부분만 수정
2. 특수 케이스는 예외 처리
3. 테스트 및 커밋

### Phase 4: 나머지 컴포넌트 개선 (점진적)
1. 컴포넌트 수정 시 기회가 생기면 적용
2. 새로운 컴포넌트 작성 시 필수 적용

---

## 📊 작업 우선순위 매트릭스

| 작업 | 우선순위 | 작업량 | 영향도 | ROI |
|------|----------|--------|--------|-----|
| FormInput 개선 | 높음 | 중간 | 중간 | 높음 |
| 타이포그래피 확대 | 중간 | 대규모 | 높음 | 중간 |
| Margin 클래스 제거 | 낮음 | 대규모 | 낮음 | 낮음 |
| 기타 컴포넌트 개선 | 낮음 | 소규모 | 낮음 | 중간 |

---

## 💡 권장 사항

### 즉시 진행 권장
1. **FormInput 개선** - 빠르게 완료 가능하고 영향도 높음
2. **주요 컴포넌트 타이포그래피 적용** - Dialog, ErrorState 등 자주 사용되는 컴포넌트

### 점진적 진행 권장
1. **Margin 클래스 제거** - 컴포넌트 수정 시 기회가 생기면 적용
2. **타이포그래피 시스템 확대** - 새로운 컴포넌트 작성 시 필수 적용

---

## 📚 참고 자료

- 타이포그래피 시스템 가이드: `docs/ui-typography-system-guide.md`
- 컴포넌트 통합 계획: `docs/component-consolidation-plan.md`
- 컴포넌트 통합 완료 보고서: `docs/component-consolidation-completed.md`
- UI 개선 작업: `docs/ui-improvement-2025-01-XX.md`

---

**작성 일시**: 2025-01-XX

