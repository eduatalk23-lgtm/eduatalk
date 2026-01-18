# Step4RecommendedContents React Child 에러 수정

## 작업 개요

캠프 템플릿 상세 페이지에서 플랜 그룹 위저드를 계속 진행할 때 발생하는 React 에러를 수정했습니다.

## 에러 내용

```
Objects are not valid as a React child (found: object with keys {min_count, subject_category}). 
If you meant to render a collection of children, use an array instead.
```

**에러 위치**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx:1455`

## 문제 분석

`requiredSubjects`는 `{min_count, subject_category}` 형태의 객체 배열인데, 여러 곳에서 문자열 배열처럼 사용되고 있었습니다:

1. **814번 줄**: `requiredSubjects.map((subject) => {`에서 `subject`를 직접 렌더링하려고 시도
   - `subject`는 객체이므로 React child로 사용할 수 없음
   
2. **654번 줄**: `requiredSubjects.indexOf(a)` 사용
   - 객체 배열에서 문자열을 찾으려고 시도하여 제대로 작동하지 않음
   
3. **1448번 줄**: `requiredSubjects.includes(subject)` 사용
   - 객체 배열에서 문자열을 찾으려고 시도하여 제대로 작동하지 않음

## 해결 방안

`requiredSubjectCategories`라는 별도 변수를 만들어서 `subject_category`만 추출한 배열을 저장하고, 렌더링 및 검증에 사용하도록 수정했습니다.

## 수정 내용

### 파일: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

#### 1. `requiredSubjectCategories` 변수 추가

```typescript
// 필수 과목의 subject_category 배열 (렌더링 및 검증용)
const requiredSubjectCategories = requiredSubjects.map((req) => req.subject_category);
```

#### 2. 필수 과목 우선 정렬 수정 (654번 줄)

**변경 전:**
```typescript
const sortedSubjects = Array.from(contentsBySubject.keys()).sort((a, b) => {
  const aIndex = requiredSubjects.indexOf(a);
  const bIndex = requiredSubjects.indexOf(b);
  // ...
});
```

**변경 후:**
```typescript
const sortedSubjects = Array.from(contentsBySubject.keys()).sort((a, b) => {
  const aIndex = requiredSubjectCategories.indexOf(a);
  const bIndex = requiredSubjectCategories.indexOf(b);
  // ...
});
```

#### 3. 필수 과목 안내 렌더링 수정 (814번 줄)

**변경 전:**
```typescript
{requiredSubjects.map((subject) => {
  const isIncluded = selectedSubjectCategories.has(subject);
  return (
    <div key={subject}>
      <span className="text-gray-700">{subject}</span>
```

**변경 후:**
```typescript
{requiredSubjects.map((req) => {
  const subjectCategory = req.subject_category;
  const isIncluded = selectedSubjectCategories.has(subjectCategory);
  return (
    <div key={subjectCategory}>
      <span className="text-gray-700">{subjectCategory}</span>
```

#### 4. 필수 과목 체크 수정 (1448번 줄)

**변경 전:**
```typescript
const isRequired = requiredSubjects.includes(subject);
```

**변경 후:**
```typescript
const isRequired = requiredSubjectCategories.includes(subject);
```

## 주요 변경사항

1. **`requiredSubjectCategories` 변수 추가**
   - `requiredSubjects`에서 `subject_category`만 추출한 배열
   - 렌더링 및 검증에 사용

2. **렌더링 수정**
   - 객체를 직접 렌더링하지 않고 `subject_category` 속성을 사용

3. **검증 로직 수정**
   - `indexOf`, `includes` 등 배열 메서드를 올바르게 사용

## 테스트 시나리오

1. ✅ 캠프 템플릿 상세 페이지에서 "계속하기" 버튼 클릭
2. ✅ Step 4 (추천 콘텐츠) 단계로 이동
3. ✅ 필수 과목 안내가 올바르게 표시되는지 확인
4. ✅ 필수 과목 우선 정렬이 올바르게 작동하는지 확인
5. ✅ React 에러가 발생하지 않는지 확인

## 관련 파일

- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx` - 에러 수정

## 작업 일시

2025-01-XX

