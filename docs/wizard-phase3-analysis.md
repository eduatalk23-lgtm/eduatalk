# 🔍 Wizard Phase 3 분석 보고서

**작성일**: 2025년 11월 29일  
**대상**: Step 4+5 통합 (콘텐츠 선택)  
**현재 상태**: 분석 중

---

## 📊 현재 상황 분석

### 기존 구조

| 컴포넌트 | 라인 수 | 역할 | 복잡도 |
|---------|--------|------|--------|
| `Step3Contents.tsx` | 1,364 | 학생 콘텐츠 선택 | 🔴 매우 높음 |
| `Step4RecommendedContents.tsx` | 2,428 | 추천 콘텐츠 | 🔴 극도로 높음 |
| **합계** | **3,792** | | **Phase 2의 1.5배** |

### 복잡도 비교

| Phase | Before 라인 | After 라인 | 감소율 | 복잡도 |
|-------|------------|-----------|--------|--------|
| Phase 2 | 2,465 | 2,190 | -11% | 🟡 높음 |
| **Phase 3** | **3,792** | **미정** | **?** | 🔴 **극도로 높음** |

---

## 🎯 Phase 3 목표

### 1. 통합 목표

**기존**: Step 4 (학생 콘텐츠) → Step 5 (추천 콘텐츠)  
**새로운**: Step 3 (콘텐츠 선택 탭 UI)

```
┌─────────────────────────────────────────┐
│ Step 3: 콘텐츠 선택                       │
├─────────────────────────────────────────┤
│ [학생 콘텐츠] [추천 콘텐츠]  ← 탭 UI    │
├─────────────────────────────────────────┤
│                                         │
│ (활성 탭에 따라 내용 표시)               │
│                                         │
└─────────────────────────────────────────┘
```

### 2. 개선 목표

- ✅ 9개 제한 로직 통합 관리
- ✅ 건너뛰기 로직 제거
- ✅ 진행률 표시 ("8/9개 선택 완료")
- ✅ 탭 간 쉬운 전환
- ✅ 필수 과목 검증 통합

---

## 📁 Step3Contents.tsx 분석 (1,364 라인)

### 주요 기능

1. **콘텐츠 선택** (200 라인)
   - 교재/강의 선택
   - 최대 9개 제한
   - 중복 방지 (master_content_id 기반)

2. **범위 설정** (400 라인)
   - 시작/끝 범위 입력
   - 책: 페이지 번호
   - 강의: 에피소드 번호
   - 상세 정보 조회 (API)

3. **메타데이터 관리** (200 라인)
   - 과목, 학기, 난이도 등
   - 필수 과목 검증
   - 중복 콘텐츠 검증

4. **UI/UX** (564 라인)
   - 콘텐츠 카드 표시
   - 선택/해제 토글
   - 범위 수정 모달
   - 삭제 확인

### 주요 상태

```typescript
- selectedContentIds: Set<string>
- contentRanges: Map<string, { start: string; end: string }>
- contentDetails: Map<string, { details, type }>
- startDetailId: Map<string, string>
- endDetailId: Map<string, string>
- loadingDetails: Set<string>
- contentMetadata: Map<string, { subject, semester, ... }>
```

### API 호출

- `fetchContentMetadataAction()` - 콘텐츠 메타데이터 조회
- 책 상세: `fetch(/api/student-content-details?id=...&type=book)`
- 강의 상세: `fetch(/api/student-content-details?id=...&type=lecture)`

---

## 📁 Step4RecommendedContents.tsx 분석 (2,428 라인)

### 주요 기능

1. **추천 받기** (500 라인)
   - 과목 선택 (국/수/영/과/사)
   - 개수 지정 (과목별)
   - 추천 API 호출
   - 성적 기반 추천

2. **추천 콘텐츠 표시** (600 라인)
   - 우선순위 정렬
   - 추천 사유 표시
   - 성적 상세 정보
   - 난이도 표시

3. **콘텐츠 선택** (400 라인)
   - 최대 9개 제한 (학생 콘텐츠 포함)
   - 중복 방지
   - 범위 설정 (Step3과 동일)

4. **범위 설정** (500 라인)
   - 시작/끝 범위 입력
   - 상세 정보 조회
   - 자동 배정 옵션

5. **UI/UX** (428 라인)
   - 추천 카드 표시
   - 범위 수정 모달
   - 진행률 표시
   - 필수 과목 검증

### 주요 상태

```typescript
- recommendedContents: RecommendedContent[]
- allRecommendedContents: RecommendedContent[]
- selectedContentIds: Set<string>
- selectedSubjects: Set<string>
- recommendationCounts: Map<string, number>
- autoAssignContents: boolean
- contentDetails: Map<number, { details, type }>
- startDetailId: Map<number, string>
- endDetailId: Map<number, string>
- editingRangeIndex: number | null
- editingRange: { start: string; end: string } | null
```

### API 호출

- `getRecommendedMasterContentsAction()` - 추천 콘텐츠 조회
- `fetchContentMetadataAction()` - 메타데이터 조회
- 책/강의 상세 정보 조회 (Step3과 동일)

---

## 🔄 중복 코드 분석

### 1. 범위 설정 로직 (약 900 라인 중복)

**공통 기능**:
- 시작/끝 범위 선택
- 상세 정보 조회 (API)
- 범위 검증
- 수정 모달

**차이점**:
- Step3: contentId (string) 기반
- Step4: index (number) 기반

### 2. 콘텐츠 카드 UI (약 600 라인 중복)

**공통 기능**:
- 카드 레이아웃
- 선택/해제 토글
- 메타데이터 표시
- 삭제 버튼

**차이점**:
- Step3: 학생 콘텐츠
- Step4: 추천 콘텐츠 (우선순위, 사유 표시)

### 3. 9개 제한 로직 (약 200 라인 중복)

**공통 기능**:
- 선택된 콘텐츠 개수 체크
- 9개 초과 시 경고
- 진행률 표시

**차이점**:
- Step3: student_contents만 체크
- Step4: student_contents + recommended_contents 합산

### 4. 필수 과목 검증 (약 150 라인 중복)

**공통 기능**:
- 국/수/영 필수 확인
- 경고 메시지
- 과목별 개수 표시

---

## 💡 Phase 3 통합 전략

### 방안 1: 탭 UI (권장)

```
┌─────────────────────────────────────────┐
│ [학생 콘텐츠 (5)]  [추천 콘텐츠 (3)]    │
├─────────────────────────────────────────┤
│ 선택된 콘텐츠: 8/9                       │
├─────────────────────────────────────────┤
│                                         │
│ (활성 탭 내용)                           │
│                                         │
└─────────────────────────────────────────┘
```

**장점**:
- 한 화면에서 모든 콘텐츠 관리
- 9개 제한 통합 관리
- 탭 간 쉬운 전환

**단점**:
- 탭 UI 구현 필요
- 상태 관리 복잡

### 방안 2: 아코디언 UI

```
┌─────────────────────────────────────────┐
│ ▼ 학생 콘텐츠 (5/9)                      │
│   - 콘텐츠 1                             │
│   - 콘텐츠 2                             │
│   ...                                   │
├─────────────────────────────────────────┤
│ ▼ 추천 콘텐츠 (4개 추천)                 │
│   - 추천 1 (선택됨)                      │
│   - 추천 2                               │
│   ...                                   │
└─────────────────────────────────────────┘
```

**장점**:
- 동시에 두 섹션 볼 수 있음
- 스크롤로 탐색

**단점**:
- 화면이 길어짐
- 모바일에서 불편

### 방안 3: 분리 유지 (현재)

**장점**: 변경 최소

**단점**: Phase 3 목표 미달성

---

## 🎨 제안하는 새로운 구조

### 1. 컴포넌트 분리

```
Step3ContentSelection.tsx (메인)
├── ContentSelectionTabs.tsx (탭 UI)
├── StudentContentsPanel.tsx (학생 콘텐츠)
│   ├── ContentCard.tsx (공통)
│   ├── RangeSettingModal.tsx (공통)
│   └── ContentSelector.tsx
├── RecommendedContentsPanel.tsx (추천 콘텐츠)
│   ├── RecommendationSettings.tsx
│   ├── RecommendedContentCard.tsx
│   ├── ContentCard.tsx (공통)
│   └── RangeSettingModal.tsx (공통)
└── _shared/ (공통 컴포넌트)
    ├── ContentCard.tsx
    ├── RangeSettingModal.tsx
    ├── ContentRangeInput.tsx
    └── ProgressIndicator.tsx
```

### 2. 공통 컴포넌트 추출

#### ContentCard.tsx (공통)

```typescript
type ContentCardProps = {
  content: {
    id: string;
    title: string;
    subject: string;
    semester?: string;
    difficulty?: string;
  };
  selected: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  onEditRange?: () => void;
  range?: { start: string; end: string };
  recommended?: {
    priority: number;
    reason: string;
  };
};
```

#### RangeSettingModal.tsx (공통)

```typescript
type RangeSettingModalProps = {
  open: boolean;
  onClose: () => void;
  content: {
    id: string;
    type: "book" | "lecture";
    title: string;
  };
  currentRange?: { start: string; end: string };
  onSave: (range: { start: string; end: string }) => void;
};
```

### 3. 상태 관리 통합

```typescript
type ContentSelectionState = {
  // 학생 콘텐츠
  studentContents: SelectedContent[];
  
  // 추천 콘텐츠
  recommendedContents: RecommendedContent[];
  selectedRecommendedIds: Set<string>;
  
  // 공통
  totalSelected: number; // student + recommended
  maxContents: number; // 9
  
  // 필수 과목
  requiredSubjects: Set<"국어" | "수학" | "영어">;
  selectedSubjects: Map<string, number>;
};
```

---

## 📊 예상 작업 규모

### 컴포넌트 분리

| 컴포넌트 | 예상 라인 | 난이도 | 시간 |
|---------|---------|--------|------|
| Step3ContentSelection | 150 | 🟡 중간 | 2h |
| ContentSelectionTabs | 100 | 🟢 낮음 | 1h |
| StudentContentsPanel | 600 | 🟡 중간 | 6h |
| RecommendedContentsPanel | 800 | 🔴 높음 | 8h |
| ContentCard (공통) | 200 | 🟢 낮음 | 2h |
| RangeSettingModal (공통) | 300 | 🟡 중간 | 3h |
| ContentRangeInput | 150 | 🟢 낮음 | 2h |
| ProgressIndicator | 50 | 🟢 낮음 | 1h |
| **합계** | **2,350** | | **25h** |

### Phase 3 예상 일정

| 단계 | 작업 | 시간 | 누적 |
|------|------|------|------|
| 3.1 | 분석 및 설계 | 4h | 4h |
| 3.2 | 공통 컴포넌트 | 7h | 11h |
| 3.3 | StudentContentsPanel | 6h | 17h |
| 3.4 | RecommendedContentsPanel | 8h | 25h |
| 3.5 | 메인 통합 | 3h | 28h |
| 3.6 | Wizard 통합 | 2h | 30h |
| 3.7 | 테스트 | 4h | 34h |
| 3.8 | 문서화 | 2h | 36h |
| **합계** | | **36h** | **4.5일** |

---

## 🎯 예상 성과

### 코드 품질

| 지표 | Before | After (예상) | 개선 |
|------|--------|------------|------|
| 총 라인 | 3,792 | 2,350 | **-38%** |
| 컴포넌트 | 2 | 8 | **+300%** |
| 중복 코드 | 약 50% | 약 10% | **-80%** |

### 사용자 경험

| 항목 | Before | After (예상) | 개선 |
|------|--------|------------|------|
| 콘텐츠 선택 | 2단계 분리 | 1단계 통합 | **단순화** |
| 9개 제한 | 분산 관리 | 통합 관리 | **명확화** |
| 진행률 | 보이지 않음 | 항상 표시 | **가시성** |

---

## ⚠️ 위험 요소

### 1. 복잡도

**문제**: Phase 2보다 1.5배 많은 코드 (3,792 라인)

**완화**:
- 충분한 분석 시간 (4시간)
- 단계별 구현
- 작은 컴포넌트로 분리

### 2. API 의존성

**문제**: 추천 API 호출 로직 복잡

**완화**:
- 기존 로직 최대한 유지
- API 호출 캡슐화

### 3. 상태 관리

**문제**: 두 탭 간 상태 동기화

**완화**:
- 단일 상태 관리
- 명확한 데이터 흐름

### 4. 일정 지연

**문제**: 36시간 예상 (약 4.5일)

**완화**:
- Phase 2 경험 활용
- 프로토타입 먼저 구현

---

## 💡 Phase 3 진행 방식

### Option A: 즉시 시작 (권장하지 않음)

- 36시간 대형 작업
- 여러 컨텍스트 윈도우 필요
- 피로도 높음

### Option B: 별도 세션으로 진행 (권장)

- Phase 1-2 완료 리뷰
- Phase 3 킥오프 미팅
- 충분한 준비 후 시작

### Option C: 프로토타입 먼저

- 탭 UI만 먼저 구현
- 기존 Step3/4 그대로 탭에 임베드
- 점진적 개선

---

## 🎯 다음 단계 제안

### 즉시 실행 가능

1. **Phase 2 정리** (1-2시간)
   - 기존 Step2/Step3 파일 백업
   - 전체 플로우 테스트
   - 버그 수정

2. **Phase 3 상세 설계** (2-3시간)
   - 컴포넌트 인터페이스 정의
   - 상태 관리 전략
   - API 호출 플로우

3. **프로토타입 구현** (4-5시간)
   - 탭 UI만 구현
   - 기존 컴포넌트 임베드

### 권장 진행 방식

```
현재 세션: Phase 2 완료 ✅
─────────────────────────
다음 세션: Phase 3 분석 + 설계 (4h)
다음 세션: Phase 3 구현 (30h)
다음 세션: Phase 3 테스트 + 문서화 (6h)
```

---

## 📝 현재 결정 필요

### Q1. Phase 3 진행 여부?

- A. 즉시 시작 (36시간 작업)
- B. 다음 세션에 시작
- C. Phase 2 테스트 먼저
- D. 다른 우선순위 작업

### Q2. 통합 방식?

- A. 탭 UI (권장)
- B. 아코디언 UI
- C. 분리 유지

### Q3. 구현 방식?

- A. 처음부터 완전 구현
- B. 프로토타입 먼저
- C. 공통 컴포넌트부터

---

## 🏆 결론

### Phase 3 특징

- **규모**: Phase 2의 1.5배 (3,792 → 2,350 라인)
- **복잡도**: 🔴 극도로 높음
- **기간**: 약 4.5일 (36시간)
- **난이도**: Phase 2보다 어려움

### 권장 사항

1. ✅ Phase 2 완전 종료 및 리뷰
2. ✅ Phase 3 상세 설계 세션
3. ✅ 충분한 휴식 후 시작
4. ✅ 프로토타입 접근 고려

### 최종 의견

**Phase 3는 Phase 2보다 훨씬 복잡합니다.**

- 즉시 시작하기보다는
- 충분한 준비 후
- 별도 세션에서 시작 권장

---

**작성일**: 2025년 11월 29일  
**분석 시간**: 1시간  
**다음 단계**: 사용자 결정 대기  
**상태**: 분석 완료, 설계 대기

