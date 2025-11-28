# 캠프 템플릿 삭제 후 리다이렉트 개선

## 📋 작업 개요

관리자 페이지의 캠프 템플릿 상세보기에서 삭제 버튼을 누르고 다이얼로그에서 삭제를 진행한 후, 상세보기 페이지에서 목록으로 넘어가지 않는 문제를 해결했습니다.

## 🔍 문제 분석

### 원인

1. **삭제 후 리다이렉트 방해**: `router.push`가 실행되는 동안 `useEffect`의 `loadInvitations`가 다시 실행되어 리다이렉트가 방해됨
2. **초대 명단 조회 로직**: 삭제 중일 때도 초대 목록 조회가 계속 실행되어 불필요한 API 호출 발생
3. **비동기 타이밍 이슈**: 삭제 성공 후 `router.push`와 `useEffect`의 실행 순서 문제

### 문제가 발생한 코드

```typescript
// 삭제 전 코드
const handleDelete = async () => {
  // ...
  router.push("/admin/camp-templates"); // 히스토리에 추가만 함
};

useEffect(() => {
  loadInvitations(); // 삭제 중에도 계속 실행됨
}, [loadInvitations]);
```

## ✅ 해결 방법

### 1. `router.push` → `router.replace` 변경

- 히스토리를 교체하여 뒤로가기 시 삭제된 페이지로 돌아가지 않도록 개선

### 2. `useEffect`에 `isDeleting` 체크 추가

- 삭제 중일 때는 초대 목록을 로드하지 않도록 조건 추가

### 3. `loadInvitations` 함수에 `isDeleting` 체크 추가

- 함수 내부에서도 삭제 중일 때는 실행하지 않도록 이중 체크

## 📝 변경 사항

### 파일: `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`

#### 1. `loadInvitations` 함수 개선

```typescript
const loadInvitations = useCallback(async () => {
  // 삭제 중이면 실행하지 않음
  if (isDeleting) {
    return;
  }
  // ... 나머지 로직
}, [template.id, toast, isDeleting]); // isDeleting을 의존성에 추가
```

#### 2. `useEffect`에 조건 추가

```typescript
// 초기 로드 (삭제 중이 아닐 때만 실행)
useEffect(() => {
  if (!isDeleting) {
    loadInvitations();
  }
}, [loadInvitations, isDeleting]);
```

#### 3. `handleDelete` 함수 개선

```typescript
const handleDelete = async () => {
  setIsDeleting(true);
  try {
    const result = await deleteCampTemplateAction(template.id);
    if (result.success) {
      toast.showSuccess("템플릿이 삭제되었습니다.");
      setShowDeleteDialog(false);
      // router.push → router.replace로 변경
      router.replace("/admin/camp-templates");
    }
    // ...
  }
};
```

## 🎯 개선 효과

1. **리다이렉트 안정성 향상**: 삭제 후 목록 페이지로 정상적으로 이동
2. **불필요한 API 호출 방지**: 삭제 중에는 초대 목록 조회를 하지 않음
3. **사용자 경험 개선**: 삭제 후 뒤로가기 시 삭제된 페이지로 돌아가지 않음
4. **성능 최적화**: 불필요한 네트워크 요청 감소

## 🧪 테스트 시나리오

1. ✅ 캠프 템플릿 상세보기 페이지에서 삭제 버튼 클릭
2. ✅ 삭제 확인 다이얼로그에서 삭제 진행
3. ✅ 삭제 성공 후 목록 페이지로 정상 이동 확인
4. ✅ 삭제 중 초대 목록 조회가 실행되지 않음 확인
5. ✅ 뒤로가기 시 삭제된 페이지로 돌아가지 않음 확인

## 📌 관련 파일

- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`
- `app/(admin)/actions/campTemplateActions.ts` (삭제 액션)

## 🔗 참고

- 이전 개선 작업: `docs/camp-template-delete-redirect-fix.md`
- 캠프 초대 명단 조회 로직: `app/(admin)/actions/campTemplateActions.ts`의 `getCampInvitationsForTemplate`
