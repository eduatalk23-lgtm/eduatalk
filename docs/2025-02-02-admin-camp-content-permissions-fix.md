# 관리자 모드 콘텐츠 추가 단계 권한 문제 수정

## 작업 일시
2025-02-02

## 문제점 분석

1. **마스터 콘텐츠 검색 권한 오류**: `contentMasterActions.ts`의 모든 함수들이 `user.role !== "student"` 체크를 하고 있어서 관리자/컨설턴트가 접근할 수 없었습니다.
   - `_searchContentMasters`: 마스터 콘텐츠 검색
   - `_getContentMasterById`: 마스터 콘텐츠 상세 조회
   - `_copyMasterToStudentContent`: 마스터 콘텐츠를 학생 콘텐츠로 복사
   - `_getSubjectList`: 과목 목록 조회
   - `_getSemesterList`: 학기 목록 조회

2. **추천 콘텐츠 기능**: `/api/recommended-master-contents` API는 이미 관리자/컨설턴트를 지원하고 있어서 문제 없음.

3. **사용 위치**:
   - `MasterContentsPanel`: `searchContentMastersAction` 사용
   - `ContentMasterSearch`: `searchContentMastersAction`, `copyMasterToStudentContentAction` 사용

## 해결 방안

### Phase 1: contentMasterActions.ts 권한 체크 수정

**파일**: `app/(student)/actions/contentMasterActions.ts`

**변경사항**:
- 모든 함수의 권한 체크를 `user.role !== "student"`에서 `getCurrentUserRole()`을 사용하여 `role !== "student" && role !== "admin" && role !== "consultant"`로 변경
- `getCurrentUserRole` import 추가

### Phase 2: copyMasterToStudentContent에 studentId 파라미터 추가

**파일**: `app/(student)/actions/contentMasterActions.ts`

**변경사항**:
- `_copyMasterToStudentContent` 함수에 `targetStudentId?: string` 파라미터 추가
- 관리자/컨설턴트인 경우 `targetStudentId` 사용, 학생인 경우 자신의 ID 사용

### Phase 3: ContentMasterSearch에 studentId prop 추가

**파일**: `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx`

**변경사항**:
- `ContentMasterSearchProps`에 `studentId?: string` prop 추가
- `copyMasterToStudentContentAction` 호출 시 `studentId` 전달

## 구현 세부사항

### Phase 1: 권한 체크 수정

```typescript
// 변경 전
const user = await getCurrentUser();
if (!user || user.role !== "student") {
  throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
}

// 변경 후
const user = await getCurrentUser();
const { role } = await getCurrentUserRole();
if (!user || (role !== "student" && role !== "admin" && role !== "consultant")) {
  throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
}
```

### Phase 2: copyMasterToStudentContent에 studentId 파라미터 추가

```typescript
async function _copyMasterToStudentContent(
  masterId: string,
  targetStudentId?: string // 관리자 모드에서 사용 시
): Promise<{
  bookId?: string;
  lectureId?: string;
}> {
  const user = await getCurrentUser();
  const { role } = await getCurrentUserRole();
  if (!user || (role !== "student" && role !== "admin" && role !== "consultant")) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 관리자/컨설턴트인 경우 targetStudentId 사용, 학생인 경우 자신의 ID 사용
  const finalStudentId = targetStudentId || user.userId;

  return await copyMasterToStudentContent(
    masterId,
    finalStudentId,
    tenantContext.tenantId
  );
}
```

### Phase 3: ContentMasterSearch에 studentId prop 추가

```typescript
type ContentMasterSearchProps = {
  contentType: "book" | "lecture";
  onContentAdded: (contentId: string, contentType: "book" | "lecture") => void;
  onClose: () => void;
  studentId?: string; // 관리자 모드에서 사용 시
};

// copyMasterToStudentContentAction 호출 시 studentId 전달
const result = await copyMasterToStudentContentAction(masterId, studentId);
```

## 관련 파일

### 수정 파일
- `app/(student)/actions/contentMasterActions.ts`
- `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx`

### 참고 파일
- `app/(student)/plan/new-group/_components/_shared/MasterContentsPanel.tsx`
- `app/api/recommended-master-contents/route.ts` (이미 관리자 지원)
- `app/(student)/actions/contentMetadataActions.ts` (이미 관리자 지원)

## 테스트 체크리스트

- [ ] 관리자 모드에서 마스터 콘텐츠 검색 기능이 정상 작동하는지 확인
- [ ] 관리자 모드에서 추천 콘텐츠 기능이 정상 작동하는지 확인
- [ ] 관리자 모드에서 마스터 콘텐츠를 학생 콘텐츠로 복사하는 기능이 정상 작동하는지 확인
- [ ] 관리자 모드에서 과목 목록 조회가 정상 작동하는지 확인
- [ ] 관리자 모드에서 학기 목록 조회가 정상 작동하는지 확인

