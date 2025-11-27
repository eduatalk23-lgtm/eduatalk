# 환경 변수 설정 가이드

## 문제 상황
환경 변수 검증 실패 오류가 발생하는 경우, `.env.local` 파일이 제대로 설정되지 않았거나 개발 서버가 재시작되지 않았을 수 있습니다.

## 해결 방법

### 1. .env.local 파일 생성

프로젝트 루트 디렉토리(`eduatalk/`)에 `.env.local` 파일을 생성합니다.

```bash
cd /Users/johyeon-u/Desktop/coding/eduatalk
touch .env.local
```

### 2. 환경 변수 설정

`.env.local` 파일에 다음 내용을 추가합니다:

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 3. Supabase 키 확인 방법

1. [Supabase 대시보드](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. **Settings** → **API** 메뉴로 이동
4. 다음 정보를 복사:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** 키 → `SUPABASE_SERVICE_ROLE_KEY` (선택사항)

### 4. 필수 환경 변수

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL (필수)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 공개 API 키 (필수)

### 5. 선택적 환경 변수

- `SUPABASE_SERVICE_ROLE_KEY`: 서비스 역할 키 (선택사항, 권장)
  - 관리자 기능 사용 시 필요
  - RLS 우회가 필요한 경우 사용

### 6. 개발 서버 재시작

환경 변수를 변경한 후에는 **반드시 개발 서버를 재시작**해야 합니다:

```bash
# 개발 서버 중지 (Ctrl+C)
# 그 다음 다시 시작
pnpm dev
```

## 주의사항

1. **NEXT_PUBLIC_ 접두사**: 클라이언트에서 접근 가능한 환경 변수는 `NEXT_PUBLIC_` 접두사가 필요합니다.
2. **서버 전용 변수**: `SUPABASE_SERVICE_ROLE_KEY`는 `NEXT_PUBLIC_` 접두사가 없습니다. 이는 서버에서만 사용되며 클라이언트에 노출되면 안 됩니다.
3. **.gitignore**: `.env.local` 파일은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다.
4. **환경 변수 검증**: `lib/env.ts`에서 앱 시작 시 자동으로 검증됩니다.

## 문제 해결

### 환경 변수 검증 실패 오류가 계속 발생하는 경우

1. `.env.local` 파일이 `eduatalk/` 디렉토리에 있는지 확인
2. 환경 변수 이름이 정확한지 확인 (대소문자 구분)
3. 값에 따옴표가 없는지 확인 (따옴표 불필요)
4. 개발 서버를 완전히 중지하고 재시작
5. `.next` 폴더 삭제 후 재시작:
   ```bash
   rm -rf .next
   pnpm dev
   ```

## 예시

올바른 `.env.local` 파일 예시:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.example
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjE5MzE4MTUwMjJ9.example
```

잘못된 예시 (따옴표 사용):

```env
# ❌ 잘못됨 - 따옴표 사용하지 않음
NEXT_PUBLIC_SUPABASE_URL="https://abcdefghijklmnop.supabase.co"
```


