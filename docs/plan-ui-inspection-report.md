# Plan 페이지 UI 점검 결과 보고서

**점검 일시**: 2024년 12월  
**점검 범위**: `/plan` 페이지 및 하위 페이지, 모달 컴포넌트

---

## 📋 점검 개요

### 점검 대상

#### 페이지
- ✅ `/plan` - 메인 플랜 목록 페이지
- ✅ `/plan/new-group` - 새 플랜 그룹 생성 페이지
- ✅ `/plan/group/[id]` - 플랜 그룹 상세 페이지
- ✅ `/plan/group/[id]/edit` - 플랜 그룹 편집 페이지
- ✅ `/plan/calendar` - 캘린더 뷰 페이지

#### 모달 컴포넌트
- ✅ `PlanGroupDeleteDialog` - 플랜 그룹 삭제 확인
- ✅ `PlanGroupActiveToggleDialog` - 활성화/비활성화 토글
- ✅ `PlanGroupBulkDeleteDialog` - 다중 삭제
- ✅ `PlanGroupActivationDialog` - 플랜 그룹 활성화
- ✅ `PlanPreviewDialog` - 플랜 미리보기
- ✅ `RangeSettingModal` - 범위 설정 모달
- ✅ `DayTimelineModal` - 일별 타임라인 모달
- ✅ `ExclusionImportModal` - 제외일 불러오기
- ✅ `AcademyScheduleImportModal` - 학원 일정 불러오기

---

## 🔍 점검 결과

### 1. 스타일링 일관성

#### ✅ 잘된 점
- 대부분의 컴포넌트에서 Tailwind 유틸리티 클래스를 적절히 사용
- 디자인 시스템 컬러 사용 (gray, blue, green, red 등)
- 일관된 border-radius (`rounded-lg`, `rounded-xl`)

#### ❌ 개선 필요 사항

##### 1.1 인라인 스타일 사용 (9개 파일)

**위반 파일:**
1. `app/(student)/plan/new-group/_components/Step7ScheduleResult/TimelineBar.tsx:92`
   ```tsx
   style={{ width: `${displayPercentage}%` }}
   ```

2. `app/(student)/plan/new-group/_components/Step3Contents.tsx:705`
   ```tsx
   style={{ width: `${(totalCount / 9) * 100}%` }}
   ```

3. `app/(student)/plan/new-group/_components/_summary/LearningVolumeSummary.tsx:198`
   ```tsx
   style={{ ... }}
   ```

4. `app/(student)/plan/new-group/_components/_shared/ProgressIndicator.tsx:79`
   ```tsx
   style={{ width: `${Math.min(percentage, 100)}%` }}
   ```

5. `app/(student)/plan/new-group/_components/_shared/BlockSetTimeline.tsx:141`
   ```tsx
   style={{ top: `${(i / 24) * 100}%` }}
   ```

6. `app/(student)/plan/group/[id]/_components/PlanGroupProgressCard.tsx:65`
   ```tsx
   style={{ width: `${progressPercentage}%` }}
   ```

7. `app/(student)/plan/calendar/_components/PlanCard.tsx:188`
   ```tsx
   style={{ width: `${progressPercentage}%` }}
   ```

8. `app/(student)/plan/calendar/_components/DayView.tsx:514`
   ```tsx
   style={{ width: `${progressPercentage}%` }}
   ```

**개선 방안:**
- 동적 width 계산은 CSS 변수와 Tailwind의 `w-[var(--width)]` 패턴 사용
- 또는 `calc()` 함수를 활용한 Tailwind 클래스 사용
- 진행률 바는 별도 컴포넌트로 추상화하여 일관성 확보

**예시:**
```tsx
// Before
<div style={{ width: `${progressPercentage}%` }} />

// After
<div 
  className="h-full bg-blue-600 transition-all"
  style={{ '--width': `${progressPercentage}%` } as React.CSSProperties}
  className="w-[var(--width)]"
/>
```

##### 1.2 Spacing-First 정책 위반 (매우 많은 파일)

**문제점:**
- `mt-`, `mb-`, `ml-`, `mr-`, `mx-`, `my-` 클래스가 광범위하게 사용됨
- 형제 요소 간 간격을 margin으로 처리하는 패턴이 많음

**주요 위반 파일:**
- `app/(student)/plan/page.tsx` - `mt-1`, `mt-2` 등 다수
- `app/(student)/plan/_components/PlanGroupStatsCard.tsx:25` - `mt-1`
- `app/(student)/plan/group/[id]/page.tsx` - `mt-1` 다수
- `app/(student)/plan/new-group/_components/Step6FinalReview.tsx` - `mt-`, `mb-`, `ml-` 매우 많음
- `app/(student)/plan/calendar/_components/PlanCard.tsx` - `mt-` 사용

**개선 방안:**
- 부모 컨테이너에 `gap-*` 클래스 추가
- 형제 요소 간 간격은 `gap`으로 통일
- 외곽 여백만 `padding` 사용

**예시:**
```tsx
// Before
<div>
  <h3 className="mb-3">제목</h3>
  <p className="mt-1">내용</p>
</div>

// After
<div className="flex flex-col gap-3">
  <h3>제목</h3>
  <p>내용</p>
</div>
```

##### 1.3 디자인 시스템 타이포그래피 미사용

**문제점:**
- 프로젝트 가이드라인에 정의된 타이포그래피 클래스(`text-h1`, `text-body-1` 등) 미사용
- 직접 `text-xl`, `text-sm` 등 사용

**개선 방안:**
- `globals.css`에 정의된 타이포그래피 클래스 사용
- 또는 디자인 시스템 문서 확인 후 일관성 확보

---

### 2. 모달 구조 및 UX

#### ✅ 잘된 점
- 대부분의 모달이 `Dialog` 컴포넌트 사용
- ESC 키 닫기 기능 구현됨
- 백드롭 클릭 처리 구현됨

#### ❌ 개선 필요 사항

##### 2.1 모달 컴포넌트 일관성

**문제점:**
- `RangeSettingModal`, `ExclusionImportModal`, `AcademyScheduleImportModal`은 커스텀 구현
- `Dialog` 컴포넌트를 사용하지 않고 직접 구현

**위반 파일:**
- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`
- `app/(student)/plan/new-group/_components/_panels/_modals/ExclusionImportModal.tsx`
- `app/(student)/plan/new-group/_components/_panels/_modals/AcademyScheduleImportModal.tsx`

**개선 방안:**
- 모든 모달을 `Dialog` 컴포넌트로 통일
- 일관된 모달 구조 및 스타일 적용

**예시:**
```tsx
// Before (RangeSettingModal)
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
  <div className="relative w-full max-w-2xl rounded-xl bg-white">
    {/* ... */}
  </div>
</div>

// After
<Dialog open={open} onOpenChange={onClose} title="범위 설정" maxWidth="2xl">
  <DialogContent>
    {/* ... */}
  </DialogContent>
</Dialog>
```

##### 2.2 모달 반응형 처리

**문제점:**
- 일부 모달의 최대 너비가 고정값 (`max-w-2xl`, `max-w-4xl`)
- 모바일에서 스크롤 처리 미흡

**개선 방안:**
- `Dialog` 컴포넌트의 `maxWidth` prop 활용
- 모바일에서 `p-4` 패딩으로 여백 확보

##### 2.3 포커스 트랩 미구현

**문제점:**
- 모달 내부에서 Tab 키로 포커스가 모달 밖으로 나가는 경우 있음
- 포커스 트랩(Focus Trap) 미구현

**개선 방안:**
- `Dialog` 컴포넌트에 포커스 트랩 기능 추가
- 또는 `focus-trap-react` 라이브러리 활용

##### 2.4 모달 내 스크롤 처리

**문제점:**
- 일부 모달에서 `max-h-[60vh]` 사용하지만 일관성 부족
- 스크롤 영역이 명확하지 않은 경우 있음

**개선 방안:**
- `DialogContent` 내부 스크롤 영역 명확히 구분
- 일관된 최대 높이 설정

---

### 3. 컴포넌트 구조

#### ✅ 잘된 점
- 대부분의 컴포넌트가 단일 책임 원칙 준수
- Export 규칙 대체로 준수 (default export for pages, named export for components)

#### ❌ 개선 필요 사항

##### 3.1 불필요한 추상화

**문제점:**
- `FilterBar` 컴포넌트가 단순히 `SharedFilterBar`를 래핑만 함
- 의미 없는 컨테이너 컴포넌트 가능성

**위반 파일:**
- `app/(student)/plan/_components/FilterBar.tsx`

**개선 방안:**
- 직접 `SharedFilterBar` 사용하거나
- 실제 로직이 필요한 경우에만 래퍼 유지

##### 3.2 Export 규칙 일관성

**문제점:**
- 대부분 준수하지만 일부 컴포넌트에서 혼용

**개선 방안:**
- 페이지 컴포넌트: `export default`
- UI 컴포넌트: `export function` (named export)
- 유틸리티: `export function` (named export)

##### 3.3 네이밍 규칙

**문제점:**
- 대부분 준수하지만 일부 파일명이 일관되지 않음

**개선 방안:**
- 컴포넌트 파일명: PascalCase (`PlanGroupList.tsx`)
- 유틸리티 파일명: camelCase (`planGroupTransform.ts`)
- 타입 파일명: camelCase 또는 kebab-case

---

### 4. 접근성

#### ✅ 잘된 점
- 일부 컴포넌트에서 키보드 네비게이션 구현 (`PlanGroupDetailTabs`)
- `aria-label` 일부 사용

#### ❌ 개선 필요 사항

##### 4.1 ARIA 속성 부족

**문제점:**
- 대부분의 버튼에 `aria-label` 없음
- 모달에 `aria-labelledby`, `aria-describedby` 없음
- 폼 요소에 `aria-required`, `aria-invalid` 없음

**개선 방안:**
- 모든 인터랙티브 요소에 적절한 ARIA 속성 추가
- 모달은 `Dialog` 컴포넌트에서 자동 처리되도록 개선

**예시:**
```tsx
// Before
<button onClick={handleDelete}>
  <Trash2 className="h-4 w-4" />
</button>

// After
<button 
  onClick={handleDelete}
  aria-label="플랜 그룹 삭제"
  title="삭제"
>
  <Trash2 className="h-4 w-4" />
</button>
```

##### 4.2 키보드 네비게이션

**문제점:**
- 일부 컴포넌트만 키보드 네비게이션 지원
- 모달 내부 포커스 관리 미흡

**개선 방안:**
- 모든 인터랙티브 요소에 키보드 이벤트 핸들러 추가
- Tab 순서 논리적으로 구성

##### 4.3 포커스 관리

**문제점:**
- 모달이 열릴 때 첫 번째 포커스 가능 요소로 자동 포커스 이동 없음
- 모달이 닫힐 때 이전 포커스 위치로 복귀 없음

**개선 방안:**
- 모달 열릴 때 첫 번째 입력 요소로 포커스 이동
- 모달 닫힐 때 트리거 버튼으로 포커스 복귀

##### 4.4 시맨틱 HTML

**문제점:**
- 일부 컴포넌트에서 `<div>` 남용
- `<button>` 대신 `<div>` + `onClick` 사용하는 경우 있음

**개선 방안:**
- 적절한 시맨틱 태그 사용 (`<button>`, `<nav>`, `<main>` 등)
- 클릭 가능한 요소는 반드시 `<button>` 또는 `<a>` 사용

---

### 5. 반응형 디자인

#### ✅ 잘된 점
- 대부분의 컴포넌트에서 반응형 클래스 사용 (`sm:`, `md:`, `lg:`)
- 그리드 레이아웃에서 `grid-cols-*` 반응형 처리

#### ❌ 개선 필요 사항

##### 5.1 모바일 레이아웃

**문제점:**
- 일부 모달이 모바일에서 너무 넓음
- 테이블이 모바일에서 가로 스크롤 없이 잘림

**위반 파일:**
- `app/(student)/plan/group/[id]/_components/PlanPreviewDialog.tsx` - 테이블이 모바일에서 문제

**개선 방안:**
- 모바일에서 테이블을 카드 형태로 변환
- 또는 가로 스크롤 영역 명확히 표시

##### 5.2 브레이크포인트 일관성

**문제점:**
- 일부 컴포넌트는 `sm:` 사용, 일부는 `md:` 사용
- 브레이크포인트 선택 기준이 일관되지 않음

**개선 방안:**
- 프로젝트 표준 브레이크포인트 정의
- 일관된 브레이크포인트 사용 (모바일 우선)

---

## 📊 우선순위별 개선 사항

### 🔴 높은 우선순위 (즉시 수정)

1. **Spacing-First 정책 위반** (매우 많은 파일)
   - 형제 요소 간 간격을 `gap`으로 변경
   - 외곽 여백만 `padding` 사용
   - 예상 작업량: 대규모 리팩토링 필요

2. **모달 컴포넌트 통일**
   - 커스텀 모달을 `Dialog` 컴포넌트로 변경
   - 일관된 모달 구조 적용
   - 예상 작업량: 중간 규모

3. **접근성 개선 (ARIA 속성)**
   - 모든 인터랙티브 요소에 `aria-label` 추가
   - 모달에 적절한 ARIA 속성 추가
   - 예상 작업량: 중간 규모

### 🟡 중간 우선순위 (단계적 수정)

4. **인라인 스타일 제거**
   - 동적 width 계산을 CSS 변수로 변경
   - 진행률 바 컴포넌트 추상화
   - 예상 작업량: 소규모

5. **포커스 관리 개선**
   - 모달 포커스 트랩 구현
   - 모달 열림/닫힘 시 포커스 이동
   - 예상 작업량: 소규모

6. **반응형 디자인 개선**
   - 모바일 테이블 레이아웃 개선
   - 브레이크포인트 일관성 확보
   - 예상 작업량: 소규모

### 🟢 낮은 우선순위 (선택적 개선)

7. **타이포그래피 클래스 통일**
   - 디자인 시스템 타이포그래피 클래스 사용
   - 예상 작업량: 소규모

8. **컴포넌트 구조 개선**
   - 불필요한 래퍼 컴포넌트 제거
   - Export 규칙 일관성 확보
   - 예상 작업량: 소규모

---

## 📝 개선 작업 체크리스트

### Phase 1: 긴급 수정 (1주)

- [ ] Spacing-First 정책 적용 (주요 페이지부터)
  - [ ] `/plan` 페이지
  - [ ] `/plan/group/[id]` 페이지
  - [ ] 주요 컴포넌트
- [ ] 모달 컴포넌트 통일
  - [ ] `RangeSettingModal` → `Dialog` 사용
  - [ ] `ExclusionImportModal` → `Dialog` 사용
  - [ ] `AcademyScheduleImportModal` → `Dialog` 사용
- [ ] 접근성 기본 개선
  - [ ] 모든 버튼에 `aria-label` 추가
  - [ ] 모달에 ARIA 속성 추가

### Phase 2: 중요 개선 (2주)

- [ ] 인라인 스타일 제거
  - [ ] 진행률 바 컴포넌트 추상화
  - [ ] CSS 변수 패턴 적용
- [ ] 포커스 관리 개선
  - [ ] 포커스 트랩 구현
  - [ ] 포커스 이동 로직 추가
- [ ] 반응형 디자인 개선
  - [ ] 모바일 테이블 레이아웃
  - [ ] 브레이크포인트 통일

### Phase 3: 정리 작업 (1주)

- [ ] 타이포그래피 클래스 통일
- [ ] 컴포넌트 구조 정리
- [ ] 문서화 및 가이드 업데이트

---

## 🎯 결론

전반적으로 코드 품질은 양호하나, **Spacing-First 정책 위반**과 **모달 컴포넌트 일관성** 문제가 가장 크게 발견되었습니다. 

우선순위에 따라 단계적으로 개선하면 사용자 경험과 코드 유지보수성이 크게 향상될 것입니다.

---

**작성자**: AI Assistant  
**검토 필요**: 개발팀 리뷰 권장

