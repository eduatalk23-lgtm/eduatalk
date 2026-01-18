# Step3ContentSelection 읽기 전용 모드 통합 뷰 구현

## 목표

읽기 전용 모드(`editable=false`)에서 Step3ContentSelection의 탭 UI를 숨기고, 학생 콘텐츠와 추천 콘텐츠를 합쳐서 구분 표시하는 통합 리스트 뷰로 변경합니다.

## 구현 내용

### 1. UnifiedContentsView 컴포넌트 생성

**파일**: `app/(student)/plan/new-group/_components/_shared/UnifiedContentsView.tsx`

- 학생 콘텐츠와 추천 콘텐츠를 섹션으로 구분하여 표시
- 각 섹션에 제목과 개수 표시
- `ContentCard` 컴포넌트 재사용
- 읽기 전용 모드이므로 편집 기능 비활성화 (`readOnly={true}`)

**주요 기능**:
- 메타데이터 자동 로드 및 캐싱
- 학생 콘텐츠 섹션: "학생 콘텐츠" 제목과 개수 표시
- 추천 콘텐츠 섹션: "추천 콘텐츠" 제목과 개수 표시
- 각 섹션이 비어있으면 해당 섹션 숨김
- 콘텐츠가 하나도 없으면 빈 상태 메시지 표시

### 2. Step3ContentSelection 수정

**파일**: `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`

**변경 사항**:
- 탭 UI 조건부 렌더링: `editable={false}`일 때 탭 UI 숨김
- 탭 내용 조건부 렌더링:
  - `editable={true}`: 기존 탭별 표시 (학생 콘텐츠/추천 콘텐츠/마스터 콘텐츠)
  - `editable={false}`: `UnifiedContentsView` 표시

**코드 구조**:
```typescript
{/* 탭 UI - 읽기 전용 모드에서는 숨김 */}
{editable && (
  <div className="flex gap-2 border-b border-gray-200">
    {/* 탭 버튼들 */}
  </div>
)}

{/* 탭 내용 또는 통합 뷰 */}
<div>
  {editable ? (
    // 편집 모드: 탭별 표시
    // ...
  ) : (
    // 읽기 전용 모드: 통합 뷰
    <UnifiedContentsView
      studentContents={data.student_contents}
      recommendedContents={data.recommended_contents}
      contents={contents}
      allRecommendedContents={allRecommendedContents}
      isCampMode={isCampMode}
    />
  )}
</div>
```

### 3. Export 추가

**파일**: `app/(student)/plan/new-group/_components/_shared/index.ts`

- `UnifiedContentsView` export 추가

## 사용자 경험

### 편집 모드 (`editable={true}`)
- 3개의 탭 (학생 콘텐츠/추천 콘텐츠/마스터 콘텐츠) 표시
- 각 탭에서 해당 콘텐츠만 표시
- 콘텐츠 추가/삭제/수정 가능

### 읽기 전용 모드 (`editable={false}`)
- 탭 UI 숨김
- 학생 콘텐츠와 추천 콘텐츠를 섹션으로 구분하여 하나의 리스트로 표시
- 각 섹션에 제목과 개수 표시
- 모든 편집 기능 비활성화 (읽기 전용)

## 관련 파일

- `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx` - 탭 UI 조건부 렌더링 및 통합 뷰 통합
- `app/(student)/plan/new-group/_components/_shared/UnifiedContentsView.tsx` - 새로 생성한 통합 뷰 컴포넌트
- `app/(student)/plan/new-group/_components/_shared/ContentCard.tsx` - 기존 ContentCard 재사용
- `app/(student)/plan/new-group/_components/_shared/index.ts` - Export 추가

## 참고

- 읽기 전용 모드이므로 모든 편집 기능(추가/삭제/수정) 비활성화
- `ContentCard`의 `readOnly={true}` prop 사용
- 메타데이터는 자동으로 로드되며 캐싱됨
- 추천 콘텐츠의 경우 `allRecommendedContents`에서 원본 추천 정보를 찾아 표시

---

**작업 일자**: 2025년 12월 5일  
**상태**: 완료 ✅

