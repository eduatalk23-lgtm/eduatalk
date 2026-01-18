# date-fns 의존성 추가

## 작업 일시
2024-12-29

## 문제 상황
빌드 에러 발생: `Module not found: Can't resolve 'date-fns'`

### 에러 상세
- 파일: `app/(student)/plan/new-group/_components/_panels/_modals/ExclusionImportModal.tsx`
- 에러 위치: `import { format } from "date-fns";` (5번 라인)
- 원인: `date-fns` 패키지가 `package.json`에 포함되지 않았음

## 해결 방법
`date-fns` 패키지를 프로젝트 의존성에 추가:

```bash
npm install date-fns
```

## 변경 사항
- `package.json`에 `date-fns: ^4.1.0` 의존성 추가
- `ExclusionImportModal.tsx`에서 사용 중인 `date-fns` 기능:
  - `format`: 날짜 포맷팅
  - `ko` locale: 한국어 로케일

## 영향 받는 파일
- `app/(student)/plan/new-group/_components/_panels/_modals/ExclusionImportModal.tsx`
  - 날짜 표시 포맷팅에 `date-fns` 사용 중

## 참고
프로젝트 가이드라인에서는 `date-fns`가 "향후 사용 예정"으로 언급되었지만, 실제로 코드에서 사용되고 있어 의존성 추가가 필요했습니다.

