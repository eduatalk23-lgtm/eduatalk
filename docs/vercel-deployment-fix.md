# Vercel 배포 오류 수정

## 문제 상황

Vercel 배포 중 `pnpm-lock.yaml`이 `package.json`과 동기화되지 않아 발생한 오류:

```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with <ROOT>/package.json
```

### 원인
- `framer-motion@^12.23.25`가 `package.json`에 추가되었지만 `pnpm-lock.yaml`에는 반영되지 않음
- CI 환경에서는 기본적으로 `--frozen-lockfile` 옵션이 활성화되어 있어 lockfile이 정확히 일치해야 함

## 해결 방법

1. 로컬에서 `pnpm install` 실행하여 lockfile 업데이트
2. 변경된 `pnpm-lock.yaml` 커밋 및 푸시

## 작업 내용

- `pnpm install` 실행하여 `pnpm-lock.yaml` 동기화
- `framer-motion@^12.23.25` 의존성 반영
- 변경사항 커밋: `fix: pnpm-lock.yaml 동기화 - framer-motion 의존성 반영`

## 다음 단계

### 1. Vercel 환경 변수 설정

Vercel 대시보드에서 환경 변수를 설정해야 합니다:

1. [Vercel 대시보드](https://vercel.com/dashboard)에 로그인
2. 프로젝트 `timelevelup01` 선택
3. **Settings** → **Environment Variables** 메뉴로 이동
4. 다음 환경 변수를 추가:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

5. 각 환경 변수에 대해 **Production**, **Preview**, **Development** 환경을 선택
6. **Save** 클릭

### 2. Supabase 키 확인 방법

1. [Supabase 대시보드](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. **Settings** → **API** 메뉴로 이동
4. 다음 정보를 복사:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. 배포 재시도

환경 변수를 설정한 후 배포를 다시 시도:

```bash
npx vercel --prod
```

또는 GitHub에 푸시하면 자동으로 배포가 진행됩니다.

## 참고사항

- CI/CD 환경에서는 lockfile이 항상 최신 상태로 유지되어야 함
- 새로운 의존성을 추가한 후에는 반드시 `pnpm install`을 실행하고 lockfile을 커밋해야 함
- Vercel에서는 환경 변수를 대시보드에서 설정해야 함 (`.env.local` 파일은 로컬 개발용)

