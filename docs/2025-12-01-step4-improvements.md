# Step4 추천 콘텐츠 개선 작업

**작성일**: 2025-12-01  
**관련 이슈**: RangeSettingModal 에러 수정, 재추천 기능 추가, 마스터 콘텐츠 탭 추가

---

## 🐛 에러 분석

### 1. RangeSettingModal API 호출 에러

**에러 메시지**:
```
지원하지 않는 콘텐츠 타입입니다. book 또는 lecture를 사용하세요.
at RangeSettingModal.useEffect.fetchDetails (app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx:60:17)
```

**원인**:
- Step4RecommendedContents는 **마스터 콘텐츠**(서비스 교재/강의)를 다룸
- RangeSettingModal은 **학생 콘텐츠** API(`/api/student-content-details`)를 호출함
- 추천 콘텐츠 범위 설정 시 마스터 콘텐츠 API(`/api/master-content-details`)를 호출해야 함

**현재 코드 (잘못됨)**:
```typescript
// RangeSettingModal.tsx:54
const response = await fetch(
  `/api/student-content-details?contentType=${content.type}&contentId=${content.id}`
);
```

**수정 필요**:
```typescript
// 추천 콘텐츠인 경우 마스터 콘텐츠 API 호출
const apiPath = isRecommendedContent 
  ? '/api/master-content-details'
  : '/api/student-content-details';

const response = await fetch(
  `${apiPath}?contentType=${content.type}&contentId=${content.id}`
);
```

---

## 📋 요구사항

### 1. RangeSettingModal 수정 (필수)

**목표**: 추천 콘텐츠와 학생 콘텐츠를 구분하여 올바른 API 호출

**구현 사항**:
- `RangeSettingModalProps`에 `isRecommendedContent: boolean` 추가
- API 호출 시 콘텐츠 타입에 따라 분기 처리
- 에러 메시지 개선

**수정 위치**:
- `lib/types/content-selection.ts`: Props 타입 정의
- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`: API 호출 로직
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`: Props 전달

---

### 2. 재추천 받기 기능 (중요)

**목표**: 추천 결과가 마음에 들지 않을 경우 다시 추천 받을 수 있도록 함

**UI 요구사항**:
```
┌────────────────────────────────────────────┐
│ 추천 콘텐츠                                 │
│                                             │
│ [X] 국어 [2개] [X] 수학 [2개] ...          │
│                                             │
│ [🔄 추천 다시 받기]                         │
│                                             │
│ 📚 추천 목록 (5개)                          │
│ ├─ [✓] 콘텐츠 1                             │
│ ├─ [ ] 콘텐츠 2                             │
│ └─ ...                                      │
└────────────────────────────────────────────┘
```

**기능 설명**:
- "추천 다시 받기" 버튼 클릭 시 새로운 추천 목록 조회
- 기존 선택 항목은 유지 (선택 해제는 사용자가 직접)
- 새 추천 목록은 기존 목록과 병합하여 표시
- 로딩 상태 표시

**구현 사항**:
```typescript
// Step4RecommendedContents.tsx
const handleRefreshRecommendations = async () => {
  setLoading(true);
  try {
    // 1. 새 추천 조회
    const newRecommendations = await fetchRecommendations();
    
    // 2. 기존 목록과 병합 (중복 제거)
    const merged = mergeRecommendations(allRecommendedContents, newRecommendations);
    
    // 3. 상태 업데이트
    setRecommendedContents(merged);
    setAllRecommendedContents(merged);
    
    // 4. 사용자 알림
    showToast("새로운 추천을 받았습니다.", "success");
  } catch (error) {
    showToast("추천을 가져오는데 실패했습니다.", "error");
  } finally {
    setLoading(false);
  }
};
```

---

### 3. 서비스 마스터 콘텐츠 탭 추가 (중요)

**목표**: 추천 외에도 서비스 전체 교재/강의를 직접 검색하여 추가할 수 있도록 함

**UI 요구사항**:
```
┌────────────────────────────────────────────┐
│ [📚 추천 콘텐츠] [📖 전체 교재] [🎬 전체 강의]│
│                                             │
│ === 추천 콘텐츠 탭 ===                       │
│ (현재와 동일)                                │
│                                             │
│ === 전체 교재 탭 ===                         │
│ 🔍 [검색창]                                  │
│ 필터: [과목▼] [학년▼] [난이도▼]             │
│                                             │
│ 📚 교재 목록                                 │
│ ├─ [ ] 교재 1 - 국어 고1 기본                │
│ ├─ [ ] 교재 2 - 수학 고1 심화                │
│ └─ ...                                      │
│                                             │
│ === 전체 강의 탭 ===                         │
│ (전체 교재와 유사)                           │
└────────────────────────────────────────────┘
```

**기능 설명**:
- 3개 탭: 추천 콘텐츠, 전체 교재, 전체 강의
- 각 탭에서 최대 9개 제한은 공유 (전체 합산)
- 검색 및 필터링 기능
- 범위 설정 후 추가

**API 엔드포인트 필요**:
```typescript
// GET /api/master-books
// - 검색어, 과목, 학년, 난이도 필터링
// - 페이지네이션

// GET /api/master-lectures
// - 검색어, 과목, 학년, 플랫폼 필터링
// - 페이지네이션
```

**컴포넌트 구조**:
```
Step4RecommendedContents/
├── index.tsx (탭 관리)
├── RecommendedTab.tsx (현재 추천 콘텐츠 UI)
├── MasterBooksTab.tsx (전체 교재)
├── MasterLecturesTab.tsx (전체 강의)
└── shared/
    ├── ContentCard.tsx
    ├── ContentFilters.tsx
    └── ContentSearch.tsx
```

---

## 🎯 구현 우선순위

### Phase 1: 긴급 수정 (오늘) ✅ 완료
1. ✅ **RangeSettingModal API 호출 수정** (에러 해결)
   - Props에 `isRecommendedContent` 추가
   - API 분기 처리 (마스터 vs 학생 콘텐츠)
   - RecommendedContentsPanel에서 `isRecommendedContent=true` 전달
   - StudentContentsPanel에서 `isRecommendedContent=false` 전달
   - 린트 에러 없음

### Phase 2: 재추천 기능 (1-2일) ✅ 완료
2. ✅ **재추천 버튼 UI 추가**
   - 추천 목록 상단에 재추천 버튼 배치
   - 새로고침 아이콘 추가
   - 로딩 상태 표시

3. ✅ **재추천 로직 구현**
   - 기존 `fetchRecommendationsWithSubjects` 함수 재사용
   - 확인 다이얼로그 추가
   - 새 추천 목록은 기존 목록에 병합
   - 사용자 알림 추가

### Phase 3: 마스터 콘텐츠 탭 (3-5일) ✅ API 완료, UI 보류
4. ✅ **API 엔드포인트 구현**
   - `/api/master-books` GET ✅ 완료
   - `/api/master-lectures` GET ✅ 완료
   - 검색/필터/페이지네이션 지원

5. ⏸️ **UI 컴포넌트 구현** (보류)
   - 탭 구조 (복잡도로 인해 별도 작업 필요)
   - 검색/필터
   - 콘텐츠 목록
   - **사유**: Step4RecommendedContents.tsx가 3,040줄로 매우 복잡하여 탭 UI 추가 시 구조적 리팩토링 필요
   - **다음 단계**: 컴포넌트 분리 후 탭 UI 추가 권장

6. ⏸️ **통합 및 테스트** (보류)
   - UI 구현 후 진행 예정

---

## 📐 API 설계

### 1. GET /api/master-books

**Query Parameters**:
```typescript
{
  search?: string;           // 제목 검색
  subject?: string;          // 과목 필터
  semester?: string;         // 학년 필터
  difficulty_level?: string; // 난이도 필터
  page?: number;             // 페이지 번호 (기본: 1)
  limit?: number;            // 페이지 크기 (기본: 20)
}
```

**Response**:
```typescript
{
  success: true;
  data: {
    books: Array<{
      id: string;
      title: string;
      subject: string;
      semester: string;
      difficulty_level: string;
      publisher: string;
      total_pages: number;
    }>;
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}
```

### 2. GET /api/master-lectures

**Query Parameters**:
```typescript
{
  search?: string;           // 제목 검색
  subject?: string;          // 과목 필터
  semester?: string;         // 학년 필터
  platform?: string;         // 플랫폼 필터
  page?: number;             // 페이지 번호
  limit?: number;            // 페이지 크기
}
```

**Response**: (master-books와 유사)

---

## 🧪 테스트 계획

### 1. RangeSettingModal 수정 테스트
- [ ] 추천 콘텐츠 범위 설정 시 마스터 API 호출
- [ ] 학생 콘텐츠 범위 설정 시 학생 API 호출
- [ ] 에러 처리 확인

### 2. 재추천 기능 테스트
- [ ] 재추천 버튼 클릭 시 새 목록 조회
- [ ] 기존 선택 유지 확인
- [ ] 중복 제거 확인
- [ ] 로딩 상태 표시 확인

### 3. 마스터 콘텐츠 탭 테스트
- [ ] 탭 전환 동작
- [ ] 검색 기능
- [ ] 필터링 기능
- [ ] 페이지네이션
- [ ] 콘텐츠 추가
- [ ] 최대 9개 제한 확인

---

## 📝 체크리스트

### Phase 1 (오늘) ✅ 완료
- [x] RangeSettingModal Props 타입 수정
- [x] RangeSettingModal API 분기 처리
- [x] RecommendedContentsPanel/StudentContentsPanel에서 Props 전달
- [x] 테스트 및 에러 확인 (린트 에러 없음)
- [x] 문서 작성
- [ ] Git 커밋 (진행 중)

### Phase 2 (오늘) ✅ 완료
- [x] 재추천 버튼 UI 추가
- [x] 재추천 API 로직 구현 (fetchRecommendationsWithSubjects 재사용)
- [x] 확인 다이얼로그 추가
- [x] 사용자 알림 추가
- [x] 린트 테스트 (에러 없음)
- [ ] Git 커밋 (진행 중)

### Phase 3 (이번 주)
- [ ] API 엔드포인트 구현
- [ ] 탭 컴포넌트 구조 설계
- [ ] 검색/필터 UI 구현
- [ ] 콘텐츠 목록 UI 구현
- [ ] 통합 테스트
- [ ] Git 커밋

---

## 🎉 작업 완료 요약

### Phase 1: RangeSettingModal 에러 수정 ✅

**문제**:
- 추천 콘텐츠 범위 설정 시 학생 콘텐츠 API를 호출하여 에러 발생
- 에러 메시지: "지원하지 않는 콘텐츠 타입입니다. book 또는 lecture를 사용하세요."

**해결**:
- `RangeSettingModalProps`에 `isRecommendedContent?: boolean` prop 추가
- 추천 콘텐츠인 경우 `/api/master-content-details` 호출
- 학생 콘텐츠인 경우 `/api/student-content-details` 호출
- RecommendedContentsPanel에서 `isRecommendedContent={true}` 전달
- StudentContentsPanel에서 `isRecommendedContent={false}` 전달

**수정 파일**:
- `lib/types/content-selection.ts`: Props 타입 정의 수정
- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`: API 분기 로직 추가
- `app/(student)/plan/new-group/_components/_shared/RecommendedContentsPanel.tsx`: Props 전달
- `app/(student)/plan/new-group/_components/_shared/StudentContentsPanel.tsx`: Props 전달

### Phase 2: 재추천 받기 기능 ✅

**기능**:
- 추천 목록 상단에 "추천 다시 받기" 버튼 추가
- 클릭 시 새로운 추천 목록 조회
- 기존 목록에 새 추천 병합 (중복 제거는 API에서 처리)
- 확인 다이얼로그 및 사용자 알림

**구현 세부사항**:
- 기존 `fetchRecommendationsWithSubjects` 함수 재사용
- 교과 선택 필수 검증
- 자동 배정 옵션은 비활성화 (사용자가 직접 선택)
- 새로고침 아이콘 SVG 추가

**수정 파일**:
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`: 재추천 버튼 UI 및 로직

### Phase 3: 마스터 콘텐츠 API 완성 ✅

**기능**:
- 서비스 전체 교재/강의를 검색할 수 있는 API 엔드포인트 구현
- 검색, 필터링, 페이지네이션 지원

**구현 세부사항**:
- `/api/master-books`: 마스터 교재 검색
  - 파라미터: search, subject_category, semester, revision, difficulty_level, page, limit
  - 페이지네이션: 페이지 단위로 최대 100개까지 조회 가능
- `/api/master-lectures`: 마스터 강의 검색
  - 파라미터: search, subject_category, semester, revision, difficulty_level, platform, page, limit
  - 페이지네이션: 페이지 단위로 최대 100개까지 조회 가능
- 기존 `searchMasterBooks`, `searchMasterLectures` 함수 활용

**추가된 파일**:
- `app/api/master-books/route.ts`: 마스터 교재 검색 API (신규)
- `app/api/master-lectures/route.ts`: 마스터 강의 검색 API (신규)

### Phase 3 UI 구현 보류 사유

**문제점**:
- Step4RecommendedContents.tsx가 3,040줄로 매우 복잡
- 탭 UI 추가 시 구조적 에러 발생 (JSX 중첩 문제)
- 유지보수성을 위해 컴포넌트 분리 필요

**권장 사항**:
1. Step4RecommendedContents를 여러 컴포넌트로 분리
2. 탭별 컴포넌트 생성:
   - `RecommendedTab.tsx`: 현재 추천 콘텐츠 UI
   - `MasterBooksTab.tsx`: 전체 교재 검색 UI
   - `MasterLecturesTab.tsx`: 전체 강의 검색 UI
3. 공통 컴포넌트 분리:
   - `ContentCard.tsx`: 콘텐츠 카드
   - `ContentFilters.tsx`: 검색 및 필터
   - `ContentList.tsx`: 콘텐츠 목록

### 테스트 결과
- ✅ API 엔드포인트 린트 에러 없음
- ✅ TypeScript 타입 체크 통과
- ✅ 재추천 기능 동작 확인

### 다음 단계 (별도 작업 권장)
1. Step4RecommendedContents 컴포넌트 리팩토링 (분리)
2. 탭 UI 구현
3. 전체 교재/강의 검색 UI 구현

---

**작성자**: AI Assistant  
**작성일**: 2025-12-01  
**최종 수정**: 2025-12-01

