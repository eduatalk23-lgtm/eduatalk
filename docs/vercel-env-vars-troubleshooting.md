# Vercel 환경 변수 설정 후 오류 해결 가이드

## 문제 상황

환경 변수를 Vercel에 설정했는데도 같은 오류가 발생하는 경우:

```
Error: 환경 변수 검증 실패:
- NEXT_PUBLIC_SUPABASE_URL: Invalid input: expected string, received undefined
- NEXT_PUBLIC_SUPABASE_ANON_KEY: Invalid input: expected string, received undefined
```

## 원인

Vercel에서는 환경 변수를 설정한 후 **자동으로 재배포되지 않습니다**. 환경 변수는 새 배포가 시작될 때만 로드됩니다.

## 해결 방법

### 1. 환경 변수 확인

Vercel 대시보드에서 환경 변수가 올바르게 설정되었는지 확인:

1. [Vercel 대시보드](https://vercel.com/dashboard) → 프로젝트 선택
2. **Settings** → **Environment Variables** 메뉴
3. 다음 항목 확인:
   - ✅ `NEXT_PUBLIC_SUPABASE_URL` 존재 여부
   - ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` 존재 여부
   - ✅ 값이 비어있지 않은지 확인
   - ✅ Production, Preview, Development 환경 모두 선택되었는지 확인

### 2. 배포 재시작 (필수)

환경 변수를 설정한 후 **반드시 배포를 재시작**해야 합니다.

#### 방법 1: Vercel 대시보드에서 재배포 (권장)

1. Vercel 대시보드 → 프로젝트 → **Deployments** 탭
2. 최신 배포 항목의 **⋯** (점 3개) 메뉴 클릭
3. **Redeploy** 선택
4. **Redeploy** 버튼 클릭

#### 방법 2: GitHub에 푸시

```bash
# 빈 커밋으로 재배포 트리거
git commit --allow-empty -m "chore: trigger redeploy after env vars update"
git push origin main
```

#### 방법 3: Vercel CLI 사용

```bash
npx vercel --prod
```

### 3. 빌드 로그 확인

재배포 후 빌드 로그를 확인하여 환경 변수가 제대로 로드되었는지 확인:

1. Vercel 대시보드 → **Deployments** 탭
2. 최신 배포 클릭
3. **Build Logs** 확인
4. 환경 변수 관련 오류가 없는지 확인

## 체크리스트

환경 변수 오류 해결을 위한 체크리스트:

- [ ] Vercel 대시보드에서 환경 변수가 설정되어 있는지 확인
- [ ] 환경 변수 이름이 정확한지 확인 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- [ ] 환경 변수 값이 비어있지 않은지 확인
- [ ] Production, Preview, Development 환경 모두 선택했는지 확인
- [ ] 환경 변수 설정 후 배포를 재시작했는지 확인
- [ ] 빌드 로그에서 환경 변수 관련 오류가 없는지 확인

## 추가 참고사항

### 환경 변수 설정 위치

- **로컬 개발**: `.env.local` 파일 사용
- **Vercel 배포**: Vercel 대시보드 → Settings → Environment Variables

### 환경 변수 적용 시점

- 환경 변수는 **새 배포가 시작될 때** 로드됩니다
- 기존 배포에는 환경 변수 변경이 자동으로 반영되지 않습니다
- 환경 변수를 변경한 후에는 **반드시 재배포**해야 합니다

### Supabase 키 확인

Supabase 키는 다음 위치에서 확인할 수 있습니다:

1. [Supabase 대시보드](https://app.supabase.com) 로그인
2. 프로젝트 선택
3. **Settings** → **API** 메뉴
4. 다음 정보 복사:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 관련 문서

- [Vercel 배포 가이드](./vercel-deployment-guide.md)
- [환경 변수 설정 가이드](./env-setup-guide.md)

