# 필수과목 진행률 표시 UI 수정

## 문제
콘텐츠 선택 진행률에서 필수과목에 대한 컨트롤 UI가 표시되지 않음

## 원인
- `Step4RecommendedContents` 컴포넌트에서 `ProgressIndicator` 컴포넌트를 사용하지 않고 있음
- 간단한 카운터만 표시하고 있어 필수과목 정보가 표시되지 않음

## 해결
1. `ProgressIndicator` 컴포넌트 import 추가
2. 필수과목 정보를 `ProgressIndicator`에 전달하는 로직 추가
3. 간단한 카운터를 `ProgressIndicator` 컴포넌트로 교체

## 변경 사항

### 파일: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

1. **Import 추가**
```typescript
import { ProgressIndicator } from "./_shared/ProgressIndicator";
```

2. **필수과목 정보 생성 로직 추가**
```typescript
// ProgressIndicator용 필수과목 정보 생성
const progressRequiredSubjects = requiredSubjects.map((req) => {
  let count = 0;
  
  if (req.subject) {
    // 세부 과목이 지정된 경우
    const exactKey = `${req.subject_category}:${req.subject}`;
    count = contentCountBySubject.get(exactKey) || 0;
  } else {
    // 교과만 지정된 경우: 해당 교과의 모든 콘텐츠 카운트
    contentCountBySubject.forEach((cnt, key) => {
      if (key.startsWith(req.subject_category + ":") || key === req.subject_category) {
        count += cnt;
      }
    });
  }
  
  const displayName = req.subject 
    ? `${req.subject_category} - ${req.subject}` 
    : req.subject_category;
  
  return {
    subject: displayName,
    selected: count >= req.min_count,
  };
});
```

3. **UI 교체**
- 기존: 간단한 카운터 (`{totalCount}/9`)
- 변경: `ProgressIndicator` 컴포넌트 사용
  - 전체 진행률 표시
  - 필수과목 체크 상태 표시
  - 경고 메시지 표시

## 결과
- 필수과목이 설정된 경우, `ProgressIndicator`에 필수과목 정보가 표시됨
- 각 필수과목의 선택 여부가 시각적으로 표시됨
- 필수과목 미충족 시 경고 메시지가 표시됨

## 추가 수정 (2025-01-30)

### 필수 교과 설정 UI 항상 표시
- 문제: 필수 교과 설정 UI가 토글 버튼으로 숨겨져 있어 사용자가 필수 교과를 설정할 수 없음
- 해결: 필수 교과 설정 섹션의 토글 버튼을 제거하고 UI를 항상 표시하도록 수정
- 변경 사항:
  - 토글 버튼 제거
  - 조건부 렌더링 제거 (`show_required_subjects_ui` 체크 제거)
  - 필수 교과 설정 UI가 항상 표시되도록 수정

## 테스트
- 필수과목이 설정된 플랜 그룹 편집 페이지에서 확인
- URL: `/plan/group/[id]/edit`
- 필수과목 컨트롤 UI가 "콘텐츠 선택 진행률" 섹션에 표시되는지 확인
- 필수 교과 설정 UI가 항상 표시되는지 확인

