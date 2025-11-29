# 🚀 Wizard Phase 3 킥오프

**날짜**: 2025년 11월 29일  
**Phase**: 3 - Step 4+5 통합 (콘텐츠 선택)  
**예상 시간**: 36시간 (약 4.5일)  
**상태**: 시작

---

## 🎯 Phase 3 목표

### 통합 대상

**Before**:
- Step 4: 학생 콘텐츠 선택 (1,364 라인)
- Step 5: 추천 콘텐츠 (2,428 라인)
- **합계**: 3,792 라인

**After**:
- Step 3: 콘텐츠 선택 탭 UI
- 예상: 2,350 라인 (**38% 감소**)

### 주요 개선

- ✅ 탭 UI로 통합 (학생/추천)
- ✅ 9개 제한 로직 통합
- ✅ 건너뛰기 로직 제거
- ✅ 진행률 표시
- ✅ 필수 과목 검증 통합
- ✅ 중복 코드 80% 제거

---

## 📊 분석 요약

### 중복 코드 (1,850 라인, 50%)

1. **범위 설정 로직**: ~900 라인
2. **콘텐츠 카드 UI**: ~600 라인
3. **9개 제한 로직**: ~200 라인
4. **필수 과목 검증**: ~150 라인

### 복잡도: 🔴 극도로 높음

- Phase 2의 1.5배
- 가장 큰 리팩토링 작업
- 36시간 예상

---

## 🏗 제안하는 구조

```
Step3ContentSelection.tsx (메인, 150 라인)
├── ContentSelectionTabs.tsx (탭 UI, 100 라인)
├── StudentContentsPanel.tsx (600 라인)
│   ├── ContentSelector.tsx
│   └── _shared/ (공통 컴포넌트 사용)
├── RecommendedContentsPanel.tsx (800 라인)
│   ├── RecommendationSettings.tsx
│   ├── RecommendedContentCard.tsx
│   └── _shared/ (공통 컴포넌트 사용)
└── _shared/ (공통 컴포넌트, 700 라인)
    ├── ContentCard.tsx (200 라인)
    ├── RangeSettingModal.tsx (300 라인)
    ├── ContentRangeInput.tsx (150 라인)
    └── ProgressIndicator.tsx (50 라인)

총: 8개 컴포넌트, 2,350 라인
```

---

## ⏱️ 작업 일정 (36시간)

| Phase | 작업 | 시간 | 누적 | 상태 |
|-------|------|------|------|------|
| 3.1 | 상세 설계 | 4h | 4h | ⏳ 시작 |
| 3.2 | 공통 컴포넌트 | 7h | 11h | ⏸️ |
| 3.3 | StudentContentsPanel | 6h | 17h | ⏸️ |
| 3.4 | RecommendedContentsPanel | 8h | 25h | ⏸️ |
| 3.5 | 메인 통합 | 3h | 28h | ⏸️ |
| 3.6 | Wizard 통합 | 2h | 30h | ⏸️ |
| 3.7 | 테스트 | 4h | 34h | ⏸️ |
| 3.8 | 문서화 | 2h | 36h | ⏸️ |

---

## 📋 Phase 3.1: 상세 설계 (4시간)

### 작업 내용

1. **컴포넌트 인터페이스 정의** (1h)
   - Props 타입
   - 이벤트 핸들러
   - 공통 인터페이스

2. **상태 관리 전략** (1h)
   - 전역 vs 로컬 상태
   - 데이터 흐름
   - 동기화 방법

3. **API 호출 플로우** (1h)
   - 기존 API 분석
   - 호출 타이밍
   - 에러 처리

4. **다이어그램 작성** (1h)
   - 컴포넌트 구조도
   - 데이터 흐름도
   - 상태 관리도

---

## 🎯 첫 작업: 컴포넌트 인터페이스 정의

### 공통 타입 정의

```typescript
// types/content-selection.ts

export type ContentType = "book" | "lecture";

export type SelectedContent = {
  content_type: ContentType;
  content_id: string;
  start_range: number;
  end_range: number;
  start_detail_id?: string | null;
  end_detail_id?: string | null;
  title?: string;
  subject_category?: string;
  master_content_id?: string | null;
};

export type ContentMetadata = {
  subject?: string | null;
  semester?: string | null;
  revision?: string | null;
  difficulty_level?: string | null;
  publisher?: string | null;
  platform?: string | null;
};

export type ContentDetail = {
  id: string;
  page_number?: number;
  episode_number?: number;
  major_unit?: string | null;
  minor_unit?: string | null;
  episode_title?: string | null;
};

export type ContentSelectionState = {
  studentContents: SelectedContent[];
  recommendedContents: SelectedContent[];
  totalSelected: number;
  maxContents: number;
  requiredSubjects: Set<"국어" | "수학" | "영어">;
  selectedSubjects: Map<string, number>;
};
```

### ContentCard 인터페이스

```typescript
export type ContentCardProps = {
  content: {
    id: string;
    title: string;
    subject?: string;
    semester?: string;
    difficulty?: string;
    publisher?: string;
    platform?: string;
  };
  selected: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  onEditRange?: () => void;
  range?: { start: string; end: string };
  recommended?: {
    priority: number;
    reason: string;
    scoreDetails?: any;
  };
  disabled?: boolean;
  readOnly?: boolean;
};
```

### RangeSettingModal 인터페이스

```typescript
export type RangeSettingModalProps = {
  open: boolean;
  onClose: () => void;
  content: {
    id: string;
    type: ContentType;
    title: string;
  };
  currentRange?: {
    start: string;
    end: string;
    start_detail_id?: string;
    end_detail_id?: string;
  };
  onSave: (range: {
    start: string;
    end: string;
    start_detail_id?: string;
    end_detail_id?: string;
  }) => void;
  loading?: boolean;
};
```

---

## 📈 예상 성과

| 지표 | Before | After | 개선 |
|------|--------|-------|------|
| 코드 라인 | 3,792 | 2,350 | **-38%** |
| 컴포넌트 | 2 | 8 | **+300%** |
| 중복 코드 | 50% | 10% | **-80%** |
| 재사용성 | 낮음 | 높음 | **대폭 개선** |

---

## 💡 Phase 3 성공 전략

### 1. 충분한 설계 (4시간)

- 서두르지 말기
- 인터페이스 먼저
- 다이어그램 활용

### 2. 공통 컴포넌트부터

- ContentCard 먼저
- RangeSettingModal 다음
- 나머지는 공통 컴포넌트 활용

### 3. 작은 단위로 커밋

- 1-2시간마다
- 의미 있는 단위
- 롤백 가능하게

### 4. 테스트 병행

- 컴포넌트 완성 즉시
- 통합 전 개별 테스트
- 버그 즉시 수정

---

## 🚨 주의사항

### Phase 2보다 복잡

- 1.5배 많은 코드
- API 호출 많음
- 상태 관리 복잡

### 충분한 휴식

- 2-3시간마다 휴식
- 피로 누적 방지
- 최적의 코드 품질 유지

### 단계별 진행

- 한 번에 하나씩
- 완성 후 다음 단계
- 서두르지 말기

---

## ✅ 킥오프 체크리스트

### 준비 확인

- [x] Phase 2 완료
- [x] Phase 3 분석 완료
- [x] 인계 문서 리뷰
- [x] 개발 환경 준비
- [x] 일정 확보 (36시간)

### 첫 작업 시작

- [ ] 컴포넌트 인터페이스 정의
- [ ] 상태 관리 전략
- [ ] API 호출 플로우
- [ ] 다이어그램 작성

---

## 📝 다음 단계

**즉시 시작**: Phase 3.1 상세 설계 (4시간)

1. 타입 정의 문서 작성
2. 컴포넌트 인터페이스 설계
3. 상태 관리 다이어그램
4. API 호출 플로우 차트

---

**작성일**: 2025년 11월 29일  
**상태**: Phase 3 킥오프 완료 ✅  
**다음**: Phase 3.1 상세 설계 시작  
**예상 완료**: 4시간 후

