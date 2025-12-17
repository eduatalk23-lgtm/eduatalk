# Phase 2: 주요 페이지 개선 설계 문서

**작성일**: 2025년 12월 17일  
**목표**: 사용자 경험에 직접적인 영향을 주는 주요 페이지의 컴포넌트 개선

---

## 📋 개선 대상 페이지

### 1. 대시보드 페이지

**파일 위치**:
- `app/(student)/dashboard/page.tsx`
- `app/(student)/dashboard/_components/`

**개선 대상 컴포넌트**:
- ActiveLearningWidget
- MonthlyReportSection
- TimeStatistics
- RecommendationCard (이미 Phase 1에서 완료)

**예상 작업**:
- Shadow/Elevation 시스템 적용
- Transition 시스템 적용
- 반응형 디자인 개선

---

### 2. 학습 계획 페이지

**파일 위치**:
- `app/(student)/plan/` 관련 페이지들
- `app/(student)/today/` 페이지

**개선 대상 컴포넌트**:
- PlanCard (이미 Phase 1에서 완료)
- PlanGroupCard (이미 Phase 1에서 완료)
- 기타 계획 관련 컴포넌트

**예상 작업**:
- 컴포넌트 일관성 개선
- 접근성 속성 추가
- Shadow/Elevation 시스템 적용

---

### 3. 성적 관리 페이지

**파일 위치**:
- `app/(student)/scores/` 관련 페이지들

**개선 대상 컴포넌트**:
- ScoreCard (이미 Phase 1에서 완료)
- BaseScoreCard (이미 개선 완료)
- 기타 성적 관련 컴포넌트

**예상 작업**:
- Shadow/Elevation 시스템 적용
- Transition 시스템 적용

---

## 🎯 개선 전략

### 우선순위

1. **높음**: 자주 사용되는 위젯/컴포넌트
2. **중간**: 페이지 레벨 컴포넌트
3. **낮음**: 특수한 경우의 컴포넌트

### 개선 기준

- Shadow 사용 빈도가 높은 컴포넌트
- 사용자 인터랙션이 많은 컴포넌트
- 시각적 피드백이 중요한 컴포넌트

---

## 📝 구현 계획

### Step 1: 대시보드 페이지 개선

**대상 파일**:
- `app/(student)/dashboard/_components/ActiveLearningWidget.tsx`
- `app/(student)/dashboard/_components/MonthlyReportSection.tsx`
- `app/(student)/dashboard/_components/TimeStatistics.tsx`

**예상 변경**:
- `shadow-sm`, `shadow-md`, `shadow-lg` → Elevation 시스템
- `transition-*` → Transition 시스템

---

### Step 2: 학습 계획 페이지 개선

**대상 파일**:
- `app/(student)/plan/` 하위 컴포넌트들
- `app/(student)/today/` 하위 컴포넌트들

**예상 변경**:
- 남은 Shadow 클래스 → Elevation 시스템
- Transition 일관성 개선

---

### Step 3: 성적 관리 페이지 개선

**대상 파일**:
- `app/(student)/scores/` 하위 컴포넌트들

**예상 변경**:
- 남은 Shadow 클래스 → Elevation 시스템
- Transition 일관성 개선

---

## ✅ 체크리스트

### 대시보드 페이지
- [x] ActiveLearningWidget 개선
- [x] MonthlyReportSection 개선
- [x] TimeStatistics 개선
- [x] dashboard/page.tsx 개선

### 학습 계획 페이지
- [x] PlanGroupListItem 개선
- [x] TimelineItem 개선
- [x] Shadow/Elevation 시스템 적용
- [x] Transition 시스템 적용

### 성적 관리 페이지
- [x] MockScoreCard 개선
- [x] Shadow/Elevation 시스템 적용

---

## 📊 완료 현황

### 개선된 컴포넌트 (총 7개)

1. ✅ **ActiveLearningWidget**
   - Elevation 및 Transition 적용

2. ✅ **MonthlyReportSection**
   - Elevation 적용 (3곳)

3. ✅ **TimeStatistics**
   - Elevation 적용

4. ✅ **dashboard/page.tsx**
   - 메인 카드 Elevation 적용
   - QuickActionCard Transition 및 Hover 효과 개선

5. ✅ **PlanGroupListItem**
   - Elevation 및 Transition 적용
   - Selected/Hover 상태 Elevation 조정
   - Tooltip Elevation 적용

6. ✅ **TimelineItem**
   - Elevation 및 Transition 적용
   - 상태 배지 Elevation 적용

7. ✅ **MockScoreCard**
   - 등급 배지 Elevation 적용

### 적용된 개선 사항

- **Elevation 시스템**: 모든 `shadow-sm`, `shadow-md`, `shadow-lg` → `shadow-[var(--elevation-1)]`, `shadow-[var(--elevation-2)]` 등으로 변경
- **Transition 시스템**: 모든 `transition-all duration-200` → `transition-base`로 변경
- **Hover 효과**: 일관된 Elevation 증가

---

**작성자**: AI Assistant  
**최종 업데이트**: 2025년 12월 17일  
**상태**: ✅ 완료

