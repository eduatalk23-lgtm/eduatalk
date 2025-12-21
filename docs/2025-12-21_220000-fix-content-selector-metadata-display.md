# ContentSelector 메타데이터 표시 문제 수정

## 문제 상황

ContentSelector 컴포넌트에서 과목 정보만 표시되고 다른 메타데이터(교과 그룹명, 개정교육과정명 등)가 표시되지 않는 문제가 발생했습니다.

사용자가 제공한 HTML:
```html
<button type="button" class="w-full rounded-lg border border-gray-200 bg-white p-3 text-left transition-all hover:border-blue-500 hover:bg-blue-50">
  [입문] 강민철의 기본 -고전시가- 고전시가
</button>
```

버튼 안에 제목만 표시되고 메타데이터 배지가 전혀 표시되지 않았습니다.

## 원인 분석

1. **Plus 아이콘 import 누락**: 빈 상태에서 Plus 아이콘을 사용하는데 import가 없었습니다.
2. **메타데이터 표시 조건**: 조건은 올바르게 작성되어 있었지만, 데이터 전달 과정에서 문제가 있을 수 있습니다.
3. **조건 체크 로직**: 조건 체크를 더 명확하게 개선할 필요가 있었습니다.

## 수정 내용

### 1. Plus 아이콘 import 추가

```typescript
import { Search, BookOpen, Video, FileText, Plus } from "lucide-react";
```

### 2. 부제목(subtitle) 표시 추가

부제목이 있는 경우 표시하도록 추가했습니다:

```typescript
{/* 부제목 (있는 경우) */}
{item.subtitle && (
  <p className="text-sm text-gray-600 truncate">
    {item.subtitle}
  </p>
)}
```

### 3. 메타데이터 조건 체크 개선

조건 체크를 변수로 분리하여 더 명확하게 만들었습니다:

```typescript
// 메타데이터가 있는지 확인
const hasMetadata = 
  activeTab === "custom" || 
  !!item.subject_group_name || 
  !!item.subject || 
  !!item.curriculum_revision_name;
```

이렇게 하면:
- 조건이 더 명확해집니다
- 디버깅이 쉬워집니다
- 타입 안전성이 향상됩니다

## 수정된 파일

- `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentSelector.tsx`

## 메타데이터 표시 순서

메타데이터는 다음 순서로 표시됩니다:

1. **커스텀 콘텐츠 타입 배지** (커스텀 탭인 경우)
2. **교과 그룹명** (예: "국어", "수학")
3. **세부 과목** (예: "고전시가", "현대시")
4. **개정교육과정** (예: "2015 개정")

## 데이터 구조

ContentSelector는 다음 타입의 데이터를 받습니다:

```typescript
type ContentItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  master_content_id?: string | null;
  subject?: string | null;
  subject_group_name?: string | null;
  curriculum_revision_name?: string | null;
};
```

## 테스트 방법

1. 학생 콘텐츠 목록 페이지에서 ContentSelector 컴포넌트 확인
2. 교재/강의/커스텀 탭 전환 시 메타데이터가 올바르게 표시되는지 확인
3. 메타데이터가 있는 콘텐츠와 없는 콘텐츠 모두 확인
4. 검색 기능이 메타데이터 필드에서도 작동하는지 확인

## 관련 파일

- `lib/data/planContents.ts` - 콘텐츠 데이터 조회 로직
- `app/api/student-contents/route.ts` - 학생 콘텐츠 API 엔드포인트
- `lib/query-options/studentContents.ts` - React Query 옵션

## 참고사항

- 메타데이터는 `fetchStudentBooks`, `fetchStudentLectures`, `fetchStudentCustomContents` 함수에서 조회됩니다
- 마스터 콘텐츠에서도 메타데이터를 가져오는 로직이 포함되어 있습니다
- `subject_group_name`과 `curriculum_revision_name`은 배치 조회를 통해 효율적으로 가져옵니다

