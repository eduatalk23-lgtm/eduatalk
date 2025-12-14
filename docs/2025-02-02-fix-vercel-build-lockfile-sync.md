# Vercel 빌드 에러 해결 - pnpm-lock.yaml 동기화

## 문제 상황

Vercel 배포 시 다음 에러 발생:

```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with <ROOT>/package.json

specifiers in the lockfile don't match specifiers in package.json:
* 2 dependencies were added: react-markdown@^10.1.0, remark-gfm@^4.0.1
```

## 원인

- `package.json`에 `react-markdown@^10.1.0`과 `remark-gfm@^4.0.1` 의존성이 추가됨
- `pnpm-lock.yaml`이 업데이트되지 않아 CI 환경에서 frozen-lockfile 모드로 설치 실패

## 해결 방법

로컬에서 `pnpm install` 실행하여 lockfile 업데이트:

```bash
pnpm install
```

## 변경 사항

- `pnpm-lock.yaml` 파일 업데이트
  - `react-markdown@^10.1.0` 의존성 추가
  - `remark-gfm@^4.0.1` 의존성 추가
  - 총 874줄 추가

## 커밋

- 커밋 해시: `acc6eed`
- 커밋 메시지: "fix: pnpm-lock.yaml 동기화 - react-markdown, remark-gfm 의존성 추가"

## 참고 사항

- Vercel CI 환경에서는 기본적으로 `--frozen-lockfile` 플래그가 활성화됨
- `package.json` 변경 시 항상 `pnpm-lock.yaml`을 함께 커밋해야 함
- 다른 패키지 매니저(npm, yarn)와 혼용하지 않도록 주의

