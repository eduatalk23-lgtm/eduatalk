# 캠프 템플릿 작성 시 마스터 콘텐츠 배지 표시

## 작업 일시
2024년 11월

## 개요
학생 페이지의 캠프 템플릿 작성 시, 학생 콘텐츠 추가 단계(Step 3)에서 콘텐츠 유형 표시 옆에 "마스터에서 가져옴" 배지를 추가했습니다. 콘텐츠 관리 페이지와 동일한 방식으로 마스터에서 가져온 콘텐츠만 표시됩니다.

## 변경 사항

### 1. 데이터 조회 함수 수정

#### `lib/data/planContents.ts`

**ContentItem 타입 확장**
- `master_content_id` 필드 추가

```typescript
export type ContentItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  master_content_id?: string | null; // 추가
};
```

**fetchStudentBooks 함수 수정**
- `master_content_id` 필드를 조회하도록 수정
- 반환 데이터에 `master_content_id` 포함

**fetchStudentLectures 함수 수정**
- `master_content_id` 필드를 조회하도록 수정
- 반환 데이터에 `master_content_id` 포함

### 2. Step3Contents 컴포넌트 수정

#### `app/(student)/plan/new-group/_components/Step3Contents.tsx`

**타입 정의 수정**
- `Step3ContentsProps`의 `contents` 타입에 `master_content_id` 필드 추가

**교재 목록 배지 추가**
- 교재 목록에서 콘텐츠 유형(📚 교재) 옆에 `master_content_id`가 있으면 "📦 마스터에서 가져옴" 배지 표시

**강의 목록 배지 추가**
- 강의 목록에서 콘텐츠 유형(🎧 강의) 옆에 `master_content_id`가 있으면 "📦 마스터에서 가져옴" 배지 표시

**추가된 학생 콘텐츠 목록 배지 추가**
- 추가된 학생 콘텐츠 목록에서도 `master_content_id`가 있으면 "📦 마스터에서 가져옴" 배지 표시
- `contents.books` 또는 `contents.lectures`에서 해당 콘텐츠를 찾아 `master_content_id` 확인

### 3. PlanGroupWizard 타입 수정

#### `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**PlanGroupWizardProps 타입 수정**
- `initialContents`의 `books`와 `lectures` 타입에 `master_content_id` 필드 추가

## UI 변경 사항

### 배지 스타일
콘텐츠 관리 페이지(`ContentCard.tsx`)와 동일한 스타일 사용:
```tsx
<span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
  📦 마스터에서 가져옴
</span>
```

### 표시 위치
1. **교재 목록**: 콘텐츠 유형(📚 교재) 바로 옆
2. **강의 목록**: 콘텐츠 유형(🎧 강의) 바로 옆
3. **추가된 학생 콘텐츠 목록**: 콘텐츠 유형(📚 책/🎧 강의) 바로 옆

## 영향 범위

### 수정된 파일
- `lib/data/planContents.ts`
- `app/(student)/plan/new-group/_components/Step3Contents.tsx`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

### 영향받는 기능
- 캠프 템플릿 작성 시 학생 콘텐츠 추가 단계
- 일반 플랜 그룹 생성 시 학생 콘텐츠 추가 단계
- 플랜 그룹 수정 시 학생 콘텐츠 확인

## 테스트 확인 사항

1. ✅ 마스터에서 가져온 교재가 교재 목록에 "마스터에서 가져옴" 배지와 함께 표시되는지 확인
2. ✅ 마스터에서 가져온 강의가 강의 목록에 "마스터에서 가져옴" 배지와 함께 표시되는지 확인
3. ✅ 마스터에서 가져온 콘텐츠를 추가한 후, 추가된 학생 콘텐츠 목록에도 "마스터에서 가져옴" 배지가 표시되는지 확인
4. ✅ 마스터에서 가져오지 않은 콘텐츠에는 배지가 표시되지 않는지 확인

## 참고
- 콘텐츠 관리 페이지의 배지 표시 로직과 동일한 방식으로 구현
- `ContentCard.tsx`의 배지 스타일을 참고하여 일관성 유지

