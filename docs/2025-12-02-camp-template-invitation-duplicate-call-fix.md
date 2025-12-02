# 캠프 템플릿 초대 목록 중복 호출 최적화

## 작업 개요

관리자 페이지에서 캠프 템플릿의 발송된 초대 조회가 여러 번 발생하는 문제를 해결했습니다.

**작업 일시**: 2025-12-02  
**작업 범위**: `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`

## 문제 분석

### 발견된 문제

`CampTemplateDetail` 컴포넌트에서 발송된 초대 목록이 페이지 로드 시 여러 번 조회되는 현상이 발생했습니다.

### 원인

1. **의존성 체인 문제**: `loadInvitations`의 `useCallback` 의존성에 `toast`가 포함되어 있었습니다.
2. **불안정한 참조**: `useToast()`가 반환하는 객체가 Context value로부터 생성되는데, 이 객체가 매 렌더링마다 새로 생성될 수 있습니다.
3. **useEffect 재실행**: `loadInvitations`가 재생성될 때마다 이를 의존하는 `useEffect`가 다시 실행되어 API 호출이 중복 발생했습니다.

### 문제 코드

```typescript
// 문제가 있던 코드
const loadInvitations = useCallback(async () => {
  // ... 로직 ...
}, [template.id, toast, isDeleting]); // toast가 의존성에 포함됨

useEffect(() => {
  if (!isDeleting) {
    loadInvitations();
  }
}, [loadInvitations, isDeleting]); // loadInvitations가 재생성될 때마다 실행
```

## 해결 방법

### 적용된 수정

1. **toast를 의존성에서 제거**: `toast`는 Context에서 제공되는 안정적인 객체이므로 의존성 배열에서 제외했습니다.
2. **ESLint 경고 억제**: `toast`를 의존성에서 제외하되, 실제로는 안정적인 객체이므로 ESLint 경고를 억제하는 주석을 추가했습니다.
3. **useEffect 의존성 명확화**: `useEffect`의 의존성을 `template.id`와 `isDeleting`으로 직접 지정하여 불필요한 재호출을 방지했습니다.

### 수정된 코드

```typescript
// 초대 목록 로드 (useCallback으로 메모이제이션)
// toast는 Context에서 제공되는 안정적인 객체이므로 의존성에서 제외
const loadInvitations = useCallback(async () => {
  // 삭제 중이면 실행하지 않음
  if (isDeleting) {
    return;
  }

  try {
    setLoadingInvitations(true);
    const result = await getCampInvitationsForTemplate(template.id);
    if (result.success) {
      setInvitations(result.invitations || []);
    } else {
      setInvitations([]);
      toast.showError("초대 목록을 불러오는데 실패했습니다.");
    }
  } catch (error) {
    console.error("초대 목록 로드 실패:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "초대 목록을 불러오는데 실패했습니다.";
    if (errorMessage.includes("템플릿을 찾을 수 없습니다")) {
      setInvitations([]);
    } else {
      toast.showError(errorMessage);
    }
  } finally {
    setLoadingInvitations(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [template.id, isDeleting]);

// 초기 로드 (template.id와 isDeleting만 의존하여 불필요한 재호출 방지)
useEffect(() => {
  if (!isDeleting) {
    loadInvitations();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [template.id, isDeleting]);
```

## 변경 사항

### 수정된 파일

- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`
  - `loadInvitations`의 `useCallback` 의존성 배열에서 `toast` 제거
  - ESLint 경고 억제 주석 추가
  - `useEffect`의 의존성을 `template.id`와 `isDeleting`으로 직접 지정

## 검증 사항

수정 후 다음 사항을 확인해야 합니다:

- ✅ 페이지 로드 시 초대 목록이 한 번만 조회되는지
- ✅ 초대 발송 후 새로고침이 정상 작동하는지
- ✅ 템플릿 ID 변경 시 목록이 올바르게 갱신되는지
- ✅ 린터 오류가 없는지

## 예상 효과

- **불필요한 API 호출 제거**: 페이지 로드 시 중복 호출이 제거되어 네트워크 트래픽 감소
- **페이지 로드 성능 개선**: 초기 로딩 시간 단축
- **서버 부하 감소**: 불필요한 데이터베이스 쿼리 감소
- **사용자 경험 개선**: 더 빠른 페이지 응답 시간

## 기술적 배경

### React Hooks 의존성 관리

- `useCallback`은 의존성 배열의 값이 변경될 때만 함수를 재생성합니다.
- Context에서 제공되는 객체는 안정적인 함수들을 포함하지만, 객체 자체는 매번 새로 생성될 수 있습니다.
- `useEffect`는 의존성 배열의 값이 변경될 때만 실행되므로, 불필요한 의존성을 제거하는 것이 중요합니다.

### ToastProvider 구조

`ToastProvider`는 Context를 통해 `showToast`, `showSuccess`, `showError`, `showInfo` 함수를 제공합니다. 이 함수들은 `useCallback`으로 메모이제이션되어 있지만, Context value 객체 자체는 매번 새로 생성될 수 있습니다.

## 참고 사항

- `toast` 객체는 실제로 안정적인 함수들을 포함하고 있으므로, 의존성에서 제외해도 안전합니다.
- ESLint의 `react-hooks/exhaustive-deps` 규칙은 의존성을 완전히 포함하도록 권장하지만, 이 경우는 의도적인 예외입니다.
- 향후 `ToastProvider`를 개선하여 Context value를 `useMemo`로 메모이제이션하면 더 안전하게 의존성에 포함할 수 있습니다.

