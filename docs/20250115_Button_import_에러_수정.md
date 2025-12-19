# Button Import 에러 수정

## 날짜
2025-01-15

## 문제 상황
빌드 에러 발생:
```
Export Button doesn't exist in target module
./app/(admin)/admin/master-lectures/_components/MasterBookSelector.tsx:5:1
```

## 원인 분석
1. `components/atoms/Button.tsx`에서 `Button` 컴포넌트가 `default export`로 export되고 있음
2. `MasterBookSelector.tsx`에서 `named import`로 import하려고 시도
3. `borderDefaultVar` 변수가 import되지 않았지만 사용되고 있음

## 수정 내용

### 1. Button Import 수정
- **변경 전**: `import { Button } from "@/components/atoms/Button";`
- **변경 후**: `import Button from "@/components/atoms/Button";`

### 2. borderDefaultVar Import 추가
- `borderDefaultVar`를 `@/lib/utils/darkMode`에서 import 추가

## 수정된 파일
- `app/(admin)/admin/master-lectures/_components/MasterBookSelector.tsx`

## 참고
- 프로젝트 가이드라인에 따라 단일 컴포넌트는 default export를 사용
- `Button.tsx`는 이미 default export로 구현되어 있었으므로, import 방식만 수정


