# 점진적 진행 권장 사항 검토

**작성 일시**: 2025-01-XX  
**목적**: 점진적 진행 권장 사항 구체화 및 실행 가능한 작업 식별

---

## 📋 검토 개요

점진적 진행 권장 사항을 구체적으로 검토하고, 실제로 진행 가능한 작업들을 식별했습니다.

---

## 🔍 검토 결과

### 1. 색상 시스템 표준화

#### 현재 상태
- 4개 파일에서 하드코딩된 색상 값 사용 중
- 대부분 `gray-*`, `indigo-*`, `blue-*` 등의 Tailwind 색상 클래스

#### 발견된 파일 및 패턴

**1. BaseBookSelector.tsx**
- `gray-300`, `gray-700`, `gray-800`, `gray-900`: 테두리, 배경, 텍스트
- `indigo-600`, `indigo-500`: 버튼 배경, 포커스 링
- **우선순위**: 중간
- **작업량**: 약 15-20분

**2. UnifiedContentFilter.tsx**
- `indigo-600`: 검색 버튼 배경
- **우선순위**: 낮음
- **작업량**: 약 5분

**3. SchoolSelect.tsx**
- `gray-400`: 로딩 스피너
- `indigo-50`, `indigo-100`, `indigo-600`: 호버 배경, 선택 배경, 텍스트
- **우선순위**: 중간
- **작업량**: 약 10분

**4. SchoolMultiSelect.tsx**
- `amber-50`, `indigo-50`, `indigo-200`, `indigo-800`, `indigo-600`: 배경, 배지, 텍스트
- `blue-600`: 캠퍼스 정보 텍스트
- **우선순위**: 중간
- **작업량**: 약 15분

#### 매핑 규칙
- `gray-*` → `secondary-*` 또는 `text-[var(--text-primary)]`, `text-[var(--text-secondary)]` 등 (구체적인 변수명 사용)
- `indigo-*` → `primary-*`
- `blue-*` → `info-*`
- `amber-*` → `warning-*`

#### 권장 사항
- **즉시 진행 가능**: 4개 파일 수정 (약 45분)
- **영향도**: 중간 (일관성 향상)
- **ROI**: 중간

---

### 2. 접근성 개선

#### 현재 상태
- 대부분의 주요 컴포넌트에 ARIA 속성 적용됨
- Button 컴포넌트는 아이콘만 있는 버튼에 자동으로 `aria-label` 추가
- Dialog, FormField, Toast 등 주요 컴포넌트 접근성 속성 구현됨

#### 발견된 개선 사항

**1. Tabs 컴포넌트**
- 탭 버튼에 `aria-selected` 속성 추가 가능
- 탭 패널에 `role="tabpanel"` 추가 가능
- **우선순위**: 중간
- **작업량**: 약 10분

**2. EmptyState 컴포넌트**
- 이미 적절한 시맨틱 태그 사용
- 추가 개선 여지 적음

**3. 기타 컴포넌트**
- 대부분 적절한 접근성 속성 보유
- 추가 개선은 점진적으로 진행

#### 권장 사항
- **점진적 진행**: 컴포넌트 수정 시 기회가 생기면 개선
- **영향도**: 높음 (접근성 향상)
- **ROI**: 높음

---

### 3. 반응형 디자인 개선

#### 현재 상태
- 대부분의 컴포넌트에서 반응형 클래스 사용 (`sm:`, `md:`, `lg:`)
- 일부 모달 및 테이블에서 모바일 레이아웃 개선 여지

#### 발견된 개선 사항
- 문서에서 언급된 개선 사항들이 있으나, `components` 디렉토리 내에서는 대부분 적절히 구현됨
- 페이지 레벨에서 개선이 필요한 부분들이 있을 수 있음

#### 권장 사항
- **점진적 진행**: 페이지 레벨에서 개선 필요 시 진행
- **영향도**: 중간
- **ROI**: 중간

---

## 🎯 실행 가능한 작업 제안

### 우선순위 1: 색상 시스템 표준화 (즉시 진행 가능)

#### 작업 목록
1. **BaseBookSelector.tsx** 색상 표준화
   - `gray-*` → `secondary-*` 또는 CSS 변수
   - `indigo-*` → `primary-*`
   - 예상 작업량: 15-20분

2. **UnifiedContentFilter.tsx** 색상 표준화
   - `indigo-600` → `primary-600`
   - 예상 작업량: 5분

3. **SchoolSelect.tsx** 색상 표준화
   - `gray-400` → `secondary-400` 또는 CSS 변수
   - `indigo-*` → `primary-*`
   - 예상 작업량: 10분

4. **SchoolMultiSelect.tsx** 색상 표준화
   - `amber-*` → `warning-*`
   - `indigo-*` → `primary-*`
   - `blue-*` → `info-*`
   - 예상 작업량: 15분

#### 총 예상 작업량
- **4개 파일**: 약 45-50분
- **영향도**: 중간 (일관성 향상)
- **ROI**: 중간

---

### 우선순위 2: 접근성 개선 (점진적)

#### 작업 목록
1. **Tabs 컴포넌트** 접근성 개선
   - `aria-selected` 속성 추가
   - `role="tabpanel"` 추가
   - 예상 작업량: 10분

#### 총 예상 작업량
- **1개 컴포넌트**: 약 10분
- **영향도**: 높음 (접근성 향상)
- **ROI**: 높음

---

## 📊 작업 우선순위 매트릭스

| 작업 | 우선순위 | 작업량 | 영향도 | ROI | 실행 가능성 |
|------|----------|--------|--------|-----|------------|
| 색상 시스템 표준화 (4개 파일) | 중간 | 소규모 | 중간 | 중간 | ✅ 즉시 가능 |
| Tabs 접근성 개선 | 중간 | 소규모 | 높음 | 높음 | ✅ 즉시 가능 |
| 반응형 디자인 개선 | 낮음 | 중간 | 중간 | 중간 | ⏳ 점진적 |

---

## 💡 권장 작업 순서

### 즉시 진행 권장
1. **색상 시스템 표준화** (4개 파일)
   - BaseBookSelector.tsx
   - UnifiedContentFilter.tsx
   - SchoolSelect.tsx
   - SchoolMultiSelect.tsx
   - **예상 시간**: 45-50분
   - **효과**: 디자인 시스템 일관성 향상

2. **Tabs 접근성 개선**
   - `aria-selected`, `role="tabpanel"` 추가
   - **예상 시간**: 10분
   - **효과**: 접근성 향상

### 점진적 진행 권장
1. **기타 접근성 개선**
   - 컴포넌트 수정 시 기회가 생기면 개선
   - 새로운 컴포넌트 작성 시 필수 적용

2. **반응형 디자인 개선**
   - 페이지 레벨에서 필요 시 개선
   - 모바일 레이아웃 최적화

---

## 📝 색상 매핑 가이드

### 텍스트 색상
- `text-gray-700` → `text-[var(--text-secondary)]`
- `text-gray-900` → `text-[var(--text-primary)]`
- `text-gray-500` → `text-[var(--text-tertiary)]`
- `text-indigo-600` → `text-primary-600`
- `text-blue-600` → `text-info-600`

### 배경 색상
- `bg-gray-50` → `bg-[rgb(var(--color-secondary-50))]`
- `bg-gray-800` → `bg-[rgb(var(--color-secondary-800))]`
- `bg-indigo-600` → `bg-primary-600`
- `bg-indigo-50` → `bg-primary-50`
- `bg-amber-50` → `bg-warning-50`

### 테두리 색상
- `border-gray-300` → `border-[rgb(var(--color-secondary-300))]`
- `border-gray-700` → `border-[rgb(var(--color-secondary-700))]`

---

## 🔄 다음 단계

### 즉시 진행 가능한 작업
1. ✅ 색상 시스템 표준화 (4개 파일)
2. ✅ Tabs 접근성 개선

### 점진적 진행 작업
1. ⏳ 기타 접근성 개선
2. ⏳ 반응형 디자인 개선
3. ⏳ 새로운 컴포넌트 작성 시 가이드라인 준수

---

**작성 일시**: 2025-01-XX

