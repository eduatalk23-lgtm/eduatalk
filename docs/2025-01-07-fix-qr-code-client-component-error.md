# QR 코드 클라이언트 컴포넌트 에러 수정

## 문제 상황

관리자 페이지의 QR 코드 기능에서 다음과 같은 에러가 발생했습니다:

```
Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server". Or maybe you meant to call this function rather than return it.
```

## 원인 분석

`QRCodeDisplay` 컴포넌트에서 `loadQRCode` 함수가 `useEffect`의 의존성 배열에 포함되지 않아 발생한 문제였습니다. React의 규칙에 따라 `useEffect` 내부에서 사용하는 함수는 의존성 배열에 포함되어야 합니다.

### 문제가 있던 코드

```typescript
const loadQRCode = async () => {
  // ...
};

useEffect(() => {
  loadQRCode();
}, []); // loadQRCode가 의존성 배열에 없음
```

## 해결 방법

`loadQRCode` 함수를 `useCallback`으로 메모이제이션하고, `useEffect`의 의존성 배열에 포함시켰습니다.

### 수정된 코드

```typescript
const loadQRCode = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const result = await generateQRCodeAction();
    if (result.success && result.qrCodeUrl) {
      setQrCodeUrl(result.qrCodeUrl);
    } else {
      setError(result.error || "QR 코드 생성에 실패했습니다.");
    }
  } catch (err: any) {
    setError(err.message || "QR 코드 생성에 실패했습니다.");
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  loadQRCode();
}, [loadQRCode]); // loadQRCode를 의존성 배열에 포함
```

## 수정된 파일

- `app/(admin)/admin/attendance/qr-code/_components/QRCodeDisplay.tsx`

## 변경 사항

1. `useCallback` import 추가
2. `loadQRCode` 함수를 `useCallback`으로 메모이제이션
3. `useEffect`의 의존성 배열에 `loadQRCode` 추가

## 결과

- React의 규칙을 준수하여 에러가 해결되었습니다
- 함수가 매번 새로 생성되지 않아 성능도 개선되었습니다
- `useEffect`의 의존성 배열이 올바르게 설정되어 React의 경고가 사라졌습니다

## 참고 사항

- `useCallback`을 사용하면 함수가 의존성이 변경되지 않는 한 재생성되지 않습니다
- `useEffect`의 의존성 배열에 함수를 포함시키면 React가 함수의 변경을 추적할 수 있습니다
- 서버 액션(`generateQRCodeAction`)은 "use server"로 표시되어 있어 클라이언트 컴포넌트에서 직접 호출할 수 있습니다

