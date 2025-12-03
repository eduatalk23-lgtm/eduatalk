# 학생 페이지 교과 그룹 조회 권한 오류 수정

## 문제 상황

학생 페이지에서 교재/강의 등록 중에 "관리자 권한이 필요합니다" 에러가 발생했습니다.

### 에러 메시지
```
관리자 권한이 필요합니다.
at getSubjectGroupsAction (app/(admin)/actions/subjectActions.ts:16:11)
```

### 원인
- 학생 페이지(`app/(student)/contents/books/new/page.tsx`, `app/(student)/contents/lectures/new/page.tsx`)에서 관리자 전용 액션(`getSubjectGroupsAction`, `getSubjectsByGroupAction`)을 직접 호출
- 해당 액션들은 `app/(admin)/actions/subjectActions.ts`에 정의되어 있으며, 관리자/컨설턴트만 사용 가능하도록 제한됨

## 해결 방법

### 1. 학생용 액션 추가
`app/(student)/actions/contentMetadataActions.ts`에 학생용 교과 그룹 및 과목 조회 액션을 추가했습니다.

```typescript
/**
 * 교과 그룹 목록 조회 (학생용)
 * @param curriculumRevisionId 개정교육과정 ID (선택사항)
 */
export const getSubjectGroupsAction = withErrorHandling(_getSubjectGroups);

/**
 * 교과 그룹에 속한 과목 목록 조회 (학생용)
 * @param subjectGroupId 교과 그룹 ID
 */
export const getSubjectsByGroupAction = withErrorHandling(_getSubjectsByGroup);
```

### 2. 학생 페이지에서 학생용 액션 사용
- `app/(student)/contents/books/new/page.tsx`: 관리자 액션 import를 학생용 액션으로 변경
- `app/(student)/contents/lectures/new/page.tsx`: 관리자 액션 import를 학생용 액션으로 변경

### 3. Deprecated 함수 수정
기존 deprecated 함수들(`_getSubjectCategories`, `_getSubjects`)도 관리자 액션 대신 학생용 함수를 직접 호출하도록 수정했습니다.

## 변경된 파일

1. `app/(student)/actions/contentMetadataActions.ts`
   - 학생용 `getSubjectGroupsAction` 추가
   - 학생용 `getSubjectsByGroupAction` 추가
   - Deprecated 함수들이 관리자 액션 대신 학생용 함수 사용하도록 수정

2. `app/(student)/contents/books/new/page.tsx`
   - Import 경로 변경: `@/app/(admin)/actions/subjectActions` → `@/app/(student)/actions/contentMetadataActions`

3. `app/(student)/contents/lectures/new/page.tsx`
   - Import 경로 변경: `@/app/(admin)/actions/subjectActions` → `@/app/(student)/actions/contentMetadataActions`

## 테스트

다음 시나리오에서 정상 동작 확인:
- [ ] 학생 로그인 후 교재 등록 페이지 접근
- [ ] 개정교육과정 선택 시 교과 그룹 목록 로드
- [ ] 교과 그룹 선택 시 과목 목록 로드
- [ ] 학생 로그인 후 강의 등록 페이지 접근
- [ ] 개정교육과정 선택 시 교과 그룹 목록 로드
- [ ] 교과 그룹 선택 시 과목 목록 로드

## 참고사항

- 학생용 액션은 `lib/data/subjects.ts`의 함수를 직접 호출하여 데이터를 조회합니다.
- 관리자 액션과 달리 권한 체크가 로그인 여부만 확인하므로, 학생도 교과 그룹과 과목 목록을 조회할 수 있습니다.
- 데이터 조회는 읽기 전용 작업이므로 학생에게도 허용되는 것이 적절합니다.


