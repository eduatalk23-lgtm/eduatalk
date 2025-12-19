# 캠프 템플릿 삭제 기능 수정

## 📋 작업 개요

캠프 템플릿 삭제 기능이 작동하지 않는 문제를 수정했습니다.

## 🔍 문제 분석

### 기존 문제점

1. **삭제 후 페이지 새로고침 미작동**
   - `router.push("/admin/camp-templates")`를 사용했지만, 서버 컴포넌트가 다시 렌더링되지 않음
   - 삭제된 템플릿이 목록에서 사라지지 않음

2. **에러 메시지 처리 개선 필요**
   - 에러 메시지를 직접 추출하는 방식 대신 `getUserFacingMessage` 함수 사용 필요

## ✅ 해결 방안

### 1. 삭제 후 새로고침 로직 수정

`router.push` 대신 `router.refresh()`를 사용하여 서버 컴포넌트를 다시 렌더링하도록 수정했습니다.

**변경 전:**
```typescript
router.push("/admin/camp-templates"); // 목록 페이지로 이동
```

**변경 후:**
```typescript
// 서버 컴포넌트를 다시 렌더링하기 위해 refresh 사용
router.refresh();
```

### 2. 에러 메시지 처리 개선

`getUserFacingMessage` 함수를 사용하여 일관된 에러 메시지를 표시하도록 개선했습니다.

**변경 전:**
```typescript
const errorMessage =
  error instanceof Error ? error.message : "템플릿 삭제에 실패했습니다.";
```

**변경 후:**
```typescript
const errorMessage = getUserFacingMessage(error);
```

## 📝 변경 사항

### `app/(admin)/admin/camp-templates/_components/TemplateCard.tsx`

1. **삭제 후 새로고침 로직 수정**
   - `router.push` → `router.refresh()`로 변경
   - 서버 컴포넌트가 다시 렌더링되어 삭제된 템플릿이 목록에서 제거됨

2. **에러 메시지 처리 개선**
   - `getUserFacingMessage` 함수 import 추가
   - 삭제 및 상태 변경 에러 처리에서 `getUserFacingMessage` 사용

## 🎯 개선 효과

1. **삭제 후 즉시 목록 업데이트**
   - `router.refresh()`로 서버 컴포넌트가 다시 렌더링되어 삭제된 템플릿이 목록에서 즉시 제거됨

2. **일관된 에러 메시지 표시**
   - `getUserFacingMessage`를 사용하여 프로덕션 환경에서도 안전한 에러 메시지 표시

3. **사용자 경험 개선**
   - 삭제 후 즉시 피드백을 받을 수 있어 사용자 경험이 개선됨

## 🔧 기술적 세부사항

### Next.js 15 App Router의 서버 컴포넌트 새로고침

- `router.push()`: 클라이언트 사이드 네비게이션만 수행, 서버 컴포넌트 재렌더링 없음
- `router.refresh()`: 서버 컴포넌트를 다시 렌더링하여 최신 데이터를 가져옴

### 에러 처리

- `withErrorHandling`으로 래핑된 서버 액션은 에러 발생 시 `AppError`를 throw
- `getUserFacingMessage`는 `AppError`의 `isUserFacing` 속성을 확인하여 적절한 메시지 반환

## ✅ 테스트 체크리스트

- [x] 템플릿 삭제 후 목록에서 즉시 제거되는지 확인
- [x] 삭제 실패 시 에러 메시지가 올바르게 표시되는지 확인
- [x] 상태 변경 시에도 동일한 에러 처리 로직이 작동하는지 확인

## 📚 참고 사항

- Next.js 15 App Router의 서버 컴포넌트 새로고침: `router.refresh()` 사용
- 에러 처리 가이드라인: `docs/error-handling-guidelines.md`
- `getUserFacingMessage` 함수: `lib/errors/handler.ts`

