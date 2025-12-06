# Vercel 배포 가이드

## 개요

이 문서는 TimeLevelUp 프로젝트를 Vercel에 배포하는 방법을 안내합니다.

## 사전 준비사항

1. Vercel 계정 생성 및 로그인
2. GitHub 저장소 연결
3. Supabase 프로젝트 설정 완료

## 배포 단계

### 1. Vercel 프로젝트 생성

```bash
npx vercel
```

프롬프트에 따라 다음 정보 입력:

- 프로젝트 이름: `timelevelup01` (또는 원하는 이름)
- 디렉토리: `./`
- 설정 수정: `no` (기본 Next.js 설정 사용)

### 2. 환경 변수 설정

**중요**: Vercel에서는 `.env.local` 파일이 아닌 대시보드에서 환경 변수를 설정해야 합니다.

#### Vercel 대시보드에서 설정

1. [Vercel 대시보드](https://vercel.com/dashboard)에 로그인
2. 프로젝트 선택 (`timelevelup01`)
3. **Settings** → **Environment Variables** 메뉴로 이동
4. 다음 환경 변수를 추가:

   | 변수 이름                       | 값                                 | 설명                  |
   | ------------------------------- | ---------------------------------- | --------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`      | `https://your-project.supabase.co` | Supabase 프로젝트 URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...`                      | Supabase 공개 API 키  |

5. 각 환경 변수에 대해 다음 환경을 선택:

   - ✅ Production
   - ✅ Preview
   - ✅ Development

6. **Save** 클릭

**⚠️ 중요**: 환경 변수를 설정한 후에는 **반드시 배포를 다시 트리거**해야 합니다. Vercel은 환경 변수 변경 시 자동으로 재배포하지 않습니다.

#### 환경 변수 설정 후 배포 재시작

환경 변수를 설정한 후 다음 중 하나의 방법으로 배포를 재시작하세요:

**방법 1: Vercel 대시보드에서 재배포**

1. Vercel 대시보드 → 프로젝트 → **Deployments** 탭
2. 최신 배포 항목의 **⋯** 메뉴 클릭
3. **Redeploy** 선택
4. **Redeploy** 버튼 클릭

**방법 2: GitHub에 푸시**

```bash
# 빈 커밋으로 재배포 트리거
git commit --allow-empty -m "chore: trigger redeploy after env vars update"
git push origin main
```

**방법 3: Vercel CLI 사용**

```bash
npx vercel --prod
```

#### Supabase 키 확인 방법

1. [Supabase 대시보드](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. **Settings** → **API** 메뉴로 이동
4. 다음 정보를 복사:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`에 입력
   - **anon public** 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 입력

### 3. 배포 실행

환경 변수를 설정한 후 배포를 실행:

```bash
# 프로덕션 배포
npx vercel --prod

# 또는 GitHub에 푸시하면 자동 배포
git push origin main
```

## 일반적인 오류 및 해결 방법

### 1. pnpm-lock.yaml 동기화 오류

**오류 메시지**:

```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile"
```

**해결 방법**:

```bash
# 로컬에서 lockfile 업데이트
pnpm install

# 변경사항 커밋
git add pnpm-lock.yaml
git commit -m "fix: pnpm-lock.yaml 동기화"
git push
```

### 2. 환경 변수 검증 실패

**오류 메시지**:

```
Error: 환경 변수 검증 실패:
- NEXT_PUBLIC_SUPABASE_URL: Invalid input: expected string, received undefined
- NEXT_PUBLIC_SUPABASE_ANON_KEY: Invalid input: expected string, received undefined
```

**해결 방법**:

1. **환경 변수 확인**:

   - Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
   - `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 올바르게 설정되었는지 확인
   - 값이 비어있지 않은지 확인 (공백만 있는 경우도 오류 발생)

2. **환경 변수 이름 확인**:

   - 정확한 이름: `NEXT_PUBLIC_SUPABASE_URL` (대소문자 정확히 일치)
   - 정확한 이름: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (대소문자 정확히 일치)

3. **환경 선택 확인**:

   - Production, Preview, Development 환경 모두 선택했는지 확인
   - 각 환경 변수마다 개별적으로 환경을 선택해야 함

4. **배포 재시작**:

   - 환경 변수를 설정한 후 **반드시 배포를 재시작**해야 함
   - Vercel 대시보드 → Deployments → 최신 배포 → Redeploy
   - 또는 GitHub에 푸시하여 자동 배포 트리거

5. **빌드 로그 확인**:
   - 배포 실패 시 Vercel 대시보드에서 빌드 로그 확인
   - 환경 변수가 제대로 로드되었는지 확인

### 3. 빌드 실패

**원인**:

- 의존성 설치 실패
- TypeScript 오류
- 환경 변수 누락

**해결 방법**:

1. 로컬에서 빌드 테스트:
   ```bash
   pnpm run build
   ```
2. 오류 메시지 확인 및 수정
3. 변경사항 커밋 및 푸시

## 배포 확인

배포가 완료되면:

1. Vercel 대시보드에서 배포 상태 확인
2. 배포된 URL로 접속하여 동작 확인
3. 브라우저 콘솔에서 오류 확인

## 자동 배포 설정

GitHub 저장소와 연결된 경우:

- `main` 브랜치에 푸시 → Production 배포
- Pull Request 생성 → Preview 배포
- 다른 브랜치에 푸시 → Preview 배포

## 환경 변수 관리

### 프로덕션 환경 변수

- Vercel 대시보드에서 직접 설정
- Production 환경에만 적용 가능

### 개발 환경 변수

- 로컬: `.env.local` 파일 사용
- Vercel: 대시보드에서 Development 환경 변수 설정

### 주의사항

- `NEXT_PUBLIC_` 접두사가 있는 변수는 클라이언트에 노출됨
- 민감한 정보는 `NEXT_PUBLIC_` 접두사 없이 설정 (서버 전용)
- 환경 변수 변경 후 배포 재시작 필요

## 참고 문서

- [Vercel 공식 문서](https://vercel.com/docs)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [환경 변수 설정 가이드](./env-setup-guide.md)
- [Vercel 배포 오류 수정](./vercel-deployment-fix.md)
