# ContentSelector와 ContentCard 표시 방식 통일

## 문제 상황

ContentSelector와 ContentCard에서 같은 콘텐츠를 표시할 때 메타데이터 표시 방식이 달라 일관성이 없었습니다.

### ContentSelector (수정 전)
- 커스텀 탭일 때만 타입 배지 표시
- 교과 그룹명, 세부 과목, 개정교육과정만 표시

### ContentCard
- 항상 콘텐츠 타입 배지 표시 (📚 교재, 🎧 강의, 📄 커스텀)
- 교과 그룹명, 세부 과목, 학기, 개정교육과정, 난이도, 출판사/플랫폼 표시

## 수정 내용

ContentSelector의 메타데이터 표시 방식을 ContentCard와 일관되게 맞췄습니다.

### 변경 사항

1. **콘텐츠 타입 배지 항상 표시**
   - 이전: 커스텀 탭일 때만 표시
   - 수정 후: 모든 탭에서 콘텐츠 타입 배지 표시
     - 교재 탭: 📚 교재
     - 강의 탭: 🎧 강의
     - 커스텀 탭: 📄 커스텀

2. **표시 순서 통일**
   - 콘텐츠 타입 배지
   - 교과 그룹명
   - 세부 과목
   - 개정교육과정

## 수정된 코드

```typescript
{/* 메타데이터 (ContentCard와 동일한 순서) */}
{hasMetadata && (
  <div className="flex flex-wrap items-center gap-2 text-xs">
    {/* 콘텐츠 타입 배지 (ContentCard와 동일) */}
    {activeTab === "book" && (
      <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
        📚 교재
      </span>
    )}
    {activeTab === "lecture" && (
      <span className="rounded bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
        🎧 강의
      </span>
    )}
    {activeTab === "custom" && (
      <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-800">
        📄 커스텀
      </span>
    )}
    {/* 교과 그룹명 */}
    {item.subject_group_name && (
      <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
        {item.subject_group_name}
      </span>
    )}
    {/* 세부 과목 */}
    {item.subject && (
      <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
        {item.subject}
      </span>
    )}
    {/* 개정교육과정 */}
    {item.curriculum_revision_name && (
      <span className="rounded bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
        {item.curriculum_revision_name}
      </span>
    )}
  </div>
)}
```

## 표시 순서

두 컴포넌트 모두 다음 순서로 메타데이터를 표시합니다:

1. **콘텐츠 타입 배지** (항상 표시)
   - 📚 교재 (교재 탭)
   - 🎧 강의 (강의 탭)
   - 📄 커스텀 (커스텀 탭)

2. **교과 그룹명** (있는 경우)
   - 예: "국어", "수학"

3. **세부 과목** (있는 경우)
   - 예: "고전시가", "현대시"

4. **개정교육과정** (있는 경우)
   - 예: "2015 개정"

## 차이점

ContentCard는 추가로 다음 메타데이터도 표시합니다:
- 학기 (semester)
- 난이도 (difficulty)
- 출판사 (publisher) / 플랫폼 (platform)

이러한 추가 정보는 선택된 콘텐츠 카드에서만 표시되며, 선택 목록(ContentSelector)에서는 핵심 정보만 표시합니다.

## 관련 파일

- `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentSelector.tsx`
- `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentCard.tsx`

## 테스트 방법

1. ContentSelector에서 콘텐츠 선택 시 메타데이터가 올바르게 표시되는지 확인
2. 선택된 콘텐츠가 ContentCard에서도 동일한 메타데이터를 표시하는지 확인
3. 교재/강의/커스텀 탭 전환 시 타입 배지가 올바르게 표시되는지 확인

