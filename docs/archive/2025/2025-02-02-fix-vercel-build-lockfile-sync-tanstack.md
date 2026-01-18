# Vercel 빌드 에러 해결 - pnpm-lock.yaml 동기화 (TanStack 의존성)

**작성일**: 2025-02-02  
**문제**: Vercel 배포 시 pnpm-lock.yaml 동기화 에러

---

## 문제 상황

Vercel 배포 시 다음 에러 발생:

```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with <ROOT>/package.json

specifiers in the lockfile don't match specifiers in package.json:
* 2 dependencies were added: @tanstack/react-table@^8.21.3, @tanstack/react-virtual@^3.13.13
```

## 원인

- `package.json`에 `@tanstack/react-table@^8.21.3`과 `@tanstack/react-virtual@^3.13.13` 의존성이 추가됨
- `pnpm-lock.yaml`이 업데이트되지 않아 CI 환경에서 frozen-lockfile 모드로 설치 실패

## 해결 방법

로컬에서 `pnpm install` 실행하여 lockfile 업데이트:

```bash
pnpm install
```

## 변경 사항

- `pnpm-lock.yaml` 파일 업데이트
  - `@tanstack/react-table@^8.21.3` 의존성 추가
  - `@tanstack/react-virtual@^3.13.13` 의존성 추가
  - 관련 하위 의존성 업데이트

## 설치 결과

```
Packages: +10 -5
dependencies:
+ @tanstack/react-table 8.21.3
+ @tanstack/react-virtual 3.13.13
```

## 참고 사항

- Vercel CI 환경에서는 기본적으로 `--frozen-lockfile` 플래그가 활성화됨
- `package.json` 변경 시 항상 `pnpm-lock.yaml`을 함께 커밋해야 함
- 다른 패키지 매니저(npm, yarn)와 혼용하지 않도록 주의
- 로컬에서 의존성을 추가한 후 반드시 `pnpm install`을 실행하여 lockfile을 업데이트해야 함

---

**다음 단계**: 변경사항을 커밋하고 푸시하여 Vercel 배포를 재시도하세요.

