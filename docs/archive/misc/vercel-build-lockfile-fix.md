# Vercel 빌드 에러 수정: pnpm-lock.yaml 동기화

## 📅 작업 일시
2025년 1월 (Vercel 빌드 실패 후)

## 🔍 문제 상황

Vercel 빌드 중 다음 에러 발생:

```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with <ROOT>/package.json

Failure reason:
specifiers in the lockfile don't match specifiers in package.json:
* 1 dependencies were removed: supabase@^2.58.5
```

## 🔧 원인 분석

- `package.json`에서 `supabase@^2.58.5` 패키지가 제거되었지만
- `pnpm-lock.yaml`에는 여전히 해당 패키지 정보가 남아있어서
- CI 환경에서 `--frozen-lockfile` 옵션으로 인해 설치 실패

## ✅ 해결 방법

1. 로컬에서 `pnpm install` 실행하여 lockfile 업데이트
2. 제거된 `supabase` 패키지가 lockfile에서 정리됨
3. 변경사항 커밋 및 푸시

## 📝 변경 내용

- `pnpm-lock.yaml`: 177줄 삭제 (제거된 의존성 정리)

## 🎯 결과

- `pnpm-lock.yaml`이 `package.json`과 완전히 동기화됨
- Vercel 빌드가 정상적으로 진행될 수 있도록 수정됨

## 💡 향후 주의사항

의존성을 추가/제거할 때는 반드시:
1. `package.json` 수정
2. 로컬에서 `pnpm install` 실행하여 lockfile 업데이트
3. 변경사항 모두 커밋하여 동기화 상태 유지

