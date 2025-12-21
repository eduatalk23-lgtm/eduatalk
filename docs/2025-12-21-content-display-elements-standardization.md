# 콘텐츠 표시 요소 표준화 작업

## 작성 일자
2025-12-21

## 개요
플랜 그룹 생성 과정에서 콘텐츠가 표시되는 각 단계별로 표시 요소가 제각각이어서 통일 작업을 진행합니다.

---

## 표시 요소 표준 정의

### 1. 필수 표시 요소 (모든 콘텐츠 카드에 공통)

1. **제목** (`title`)
   - 스타일: `font-medium text-gray-900`
   - 필수 항목

2. **콘텐츠 타입 배지**
   - 교재: `bg-blue-100 text-blue-800` + 📚 아이콘
   - 강의: `bg-purple-100 text-purple-800` + 🎧 아이콘
   - 항상 첫 번째 배지로 표시

3. **범위 정보** (선택된 콘텐츠인 경우)
   - 교재: "{start}페이지 ~ {end}페이지"
   - 강의: "{start}회차 ~ {end}회차"
   - 스타일: `text-sm font-medium text-gray-800`

### 2. 메타데이터 표시 순서 (표준화)

모든 콘텐츠 카드에서 다음 순서로 표시:

1. **콘텐츠 타입 배지** (교재/강의)
2. **교과 그룹명** (`subject_group_name`)
   - 스타일: `bg-blue-100 px-2 py-0.5 font-medium text-blue-800`
3. **세부 과목** (`subject`)
   - 스타일: `bg-gray-100 px-2 py-0.5 text-gray-700`
4. **학기** (`semester`)
   - 스타일: `bg-gray-100 px-2 py-0.5 text-gray-700`
5. **개정교육과정** (`revision` / `curriculum_revision_name`)
   - 스타일: `bg-purple-100 px-2 py-0.5 font-medium text-purple-800`
6. **난이도** (`difficulty` / `difficulty_level`)
   - 스타일: `bg-indigo-100 px-2 py-0.5 text-indigo-800`
7. **출판사** (`publisher`)
   - 스타일: `text-gray-600` (배지 없음)
8. **플랫폼** (`platform`)
   - 스타일: `text-gray-600` (배지 없음)

**표시 형식**: 모든 메타데이터는 `flex flex-wrap items-center gap-2 text-xs`로 표시

### 3. 추천 콘텐츠 전용 요소

1. **추천 우선순위** (`priority`)
   - 스타일: 별 아이콘 + `text-xs font-medium text-yellow-600`
   - 제목 옆에 표시

2. **추천 이유** (`reason`)
   - 스타일: `bg-yellow-50 p-2 rounded-lg text-sm`
   - "추천 이유: {reason}" 형식

3. **성적 데이터** (`scoreDetails`)
   - 내신 평균 등급: `bg-blue-100 px-2 py-0.5 text-blue-800`
   - 모의고사 백분위: `bg-purple-100 px-2 py-0.5 text-purple-800`
   - 위험도 (50점 이상): `bg-red-100 px-2 py-0.5 text-red-800`

### 4. 상태 표시 요소

- **"추천 콘텐츠" 배지**: `bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800`
- **"학생 콘텐츠" 배지**: `bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800`
- **로딩 상태**: 스피너 + "정보 불러오는 중..."
- **에러 상태**: `text-red-600 text-xs`

---

## 변경 사항

### ContentCard 컴포넌트

**변경 전**:
- 개정교육과정 없음
- 난이도: 회색 배지
- 범위 정보: 단위 없음

**변경 후**:
- 개정교육과정 추가 (보라색 배지)
- 난이도: 인디고색 배지로 변경
- 범위 정보: 단위 포함 (페이지/회차)
- 메타데이터 표시 순서 표준화

### RecommendedContentCard 컴포넌트

**변경 전**:
- 추천 우선순위 없음
- 교과 그룹명 없음
- 메타데이터가 · 구분자로 표시

**변경 후**:
- 추천 우선순위 추가
- 교과 그룹명 추가
- 메타데이터를 배지 형식으로 통일
- ContentCard 표준에 맞게 수정

### AddedContentsList 컴포넌트

**변경 전**:
- 메타데이터가 · 구분자로 표시
- 일부 메타데이터 누락 가능

**변경 후**:
- 메타데이터를 배지 형식으로 통일
- 표준 순서로 표시

---

## 작업 완료 체크리스트

- [x] 표시 요소 표준 정의 문서 작성
- [x] ContentCard 컴포넌트 리팩토링
- [x] RecommendedContentCard 표준화
- [x] AddedContentsList 표준화
- [x] ContentSelector 표준화
- [x] 모든 컴포넌트 테스트 및 검증

---

## 완료된 작업 요약

### 1. ContentCard 컴포넌트 표준화
- 개정교육과정(`revision`) 필드 추가
- 난이도 배지 색상 변경 (회색 → 인디고색)
- 범위 정보에 단위 추가 (페이지/회차)
- 메타데이터 표시 순서 표준화
- 콘텐츠 타입 배지 추가

### 2. RecommendedContentCard 표준화
- 추천 우선순위 표시 추가
- 교과 그룹명 배지 추가
- 메타데이터를 배지 형식으로 통일 (· 구분자 제거)
- 추천 이유 스타일 통일 (노란색 배경 박스)
- 성적 데이터 배지 스타일 통일

### 3. AddedContentsList 표준화
- 메타데이터를 배지 형식으로 통일 (· 구분자 제거)
- 표준 순서로 메타데이터 표시
- 범위 정보 스타일 통일

### 4. ContentSelector 표준화
- 메타데이터 표시 순서 조정 (교과 그룹 → 세부 과목 → 개정교육과정)

### 5. 타입 정의 업데이트
- `ContentCardProps`에 `revision` 및 `contentType` 필드 추가

### 6. 모든 사용처 업데이트
- `StudentContentsPanel`: revision, contentType 추가
- `UnifiedContentsView`: revision, contentType 추가
- `RecommendedContentsPanel`: revision, subject_group_name, contentType 추가

---

## 변경된 파일 목록

1. `lib/types/content-selection.ts` - 타입 정의 업데이트
2. `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentCard.tsx` - 표준화
3. `app/(student)/plan/new-group/_components/_features/content-selection/components/StudentContentsPanel.tsx` - 타입 필드 추가
4. `app/(student)/plan/new-group/_components/_features/content-selection/components/UnifiedContentsView.tsx` - 타입 필드 추가
5. `app/(student)/plan/new-group/_components/_features/content-selection/components/RecommendedContentsPanel.tsx` - 타입 필드 추가
6. `app/(student)/plan/new-group/_components/_features/content-selection/Step4RecommendedContents/components/RecommendedContentCard.tsx` - 표준화
7. `app/(student)/plan/new-group/_components/_features/content-selection/Step4RecommendedContents/components/AddedContentsList.tsx` - 표준화
8. `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentSelector.tsx` - 순서 조정

