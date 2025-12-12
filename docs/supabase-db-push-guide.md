# Supabase DB Push 가이드

## 문제 상황

`npx supabase db push` 실행 시 다음 에러 중 하나가 발생할 수 있습니다:

### 에러 1: Unauthorized
```
unexpected login role status 401: {"message":"Unauthorized"}
Connect to your database by setting the env var: SUPABASE_DB_PASSWORD
```

### 에러 2: Link Unauthorized
```
Unexpected error retrieving remote project status: {"message":"Unauthorized"}
```
이 에러는 Supabase CLI에 로그인이 되어 있지 않을 때 발생합니다.

### 에러 3: Password Authentication Failed
```
failed to connect to postgres: failed to connect to `host=aws-1-ap-south-1.pooler.supabase.com user=postgres.yiswawnxsrdmvvihhpne database=postgres`: failed SASL auth (FATAL: password authentication failed for user "postgres" (SQLSTATE 28P01))
```
이 에러는 데이터베이스 비밀번호가 잘못되었거나 변경되었을 때 발생합니다.

## 원인

원격 Supabase 프로젝트에 마이그레이션을 푸시하려면:
1. **Supabase CLI 로그인** (필수)
2. **프로젝트 링크** (필수)
3. **데이터베이스 비밀번호** 설정 (필수)

## 해결 방법 (단계별)

### ⚠️ 중요: 순서대로 진행하세요

### 1단계: Supabase CLI 로그인 (필수)

터미널에서 직접 실행하세요:

```bash
npx supabase login
```

**실행 방법:**
1. 브라우저가 자동으로 열립니다
2. Supabase 계정으로 로그인
3. "Generate new token" 버튼 클릭 또는 기존 토큰 복사
4. 터미널에 Access Token 붙여넣기 후 Enter

**로그인 확인:**
```bash
npx supabase projects list
```
위 명령어가 성공하면 로그인이 완료된 것입니다.

### 2단계: 프로젝트 링크

로그인 후 프로젝트를 링크합니다:

```bash
npx supabase link --project-ref yiswawnxsrdmvvihhpne
```

**링크 시 입력 정보:**
- Database password: Supabase Dashboard에서 확인한 데이터베이스 비밀번호
  - Dashboard → 프로젝트 → Settings → Database → Database password
  - 비밀번호를 모르면 "Reset database password"로 새로 설정

### 3단계: 마이그레이션 푸시

```bash
npx supabase db push
```

## 대안 방법

### 방법 A: 환경 변수로 비밀번호 설정 후 링크

프로젝트 루트의 `.env.local` 파일에 다음을 추가:

```env
# Supabase 데이터베이스 비밀번호
SUPABASE_DB_PASSWORD=your-database-password-here
```

그 다음 프로젝트 링크:

```bash
npx supabase link --project-ref yiswawnxsrdmvvihhpne
```

### 방법 B: Access Token을 환경 변수로 설정

```bash
# .env.local 파일에 추가
# SUPABASE_ACCESS_TOKEN=your-access-token-here

# 또는 터미널에서 직접 설정
export SUPABASE_ACCESS_TOKEN=your-access-token-here
```

## 이전 방법 (참고)

### 방법 1: Supabase CLI 로그인 후 프로젝트 링크 (권장)

터미널에서 직접 실행하세요 (비TTY 환경에서는 자동 로그인이 불가합니다):

```bash
# 1. Supabase CLI에 로그인
npx supabase login

# 브라우저가 열리면 Supabase 계정으로 로그인 후 Access Token 복사
# 토큰을 터미널에 붙여넣기

# 2. 프로젝트 링크
npx supabase link --project-ref yiswawnxsrdmvvihhpne

# 프로젝트 비밀번호 입력 (Supabase Dashboard에서 확인)
# Settings → Database → Database password
```

### 방법 2: 환경 변수로 데이터베이스 비밀번호 설정

프로젝트 루트의 `.env.local` 파일에 다음을 추가:

```env
# Supabase 데이터베이스 비밀번호
SUPABASE_DB_PASSWORD=your-database-password-here
```

**비밀번호 확인 방법:**
1. [Supabase Dashboard](https://app.supabase.com) 로그인
2. 프로젝트 선택
3. **Settings** → **Database** 메뉴로 이동
4. **Database password** 섹션에서 비밀번호 확인
   - 비밀번호를 모르는 경우 "Reset database password"로 새로 설정 가능

### 방법 3: Access Token 사용

```bash
# 환경 변수로 Access Token 설정
export SUPABASE_ACCESS_TOKEN=your-access-token-here

# 또는 .env.local 파일에 추가
# SUPABASE_ACCESS_TOKEN=your-access-token-here

# 프로젝트 링크
npx supabase link --project-ref yiswawnxsrdmvvihhpne
```

**Access Token 확인 방법:**
1. Supabase CLI 로그인: `npx supabase login`
2. 브라우저에서 토큰 복사
3. 환경 변수로 설정

## 마이그레이션 푸시 실행

프로젝트 링크 또는 환경 변수 설정 후:

```bash
npx supabase db push
```

## 문제 해결

### 로그인 상태 확인

```bash
# 프로젝트 목록 조회 (로그인 필요)
npx supabase projects list

# 에러 발생 시: 로그인 필요
npx supabase login
```

### 링크 상태 확인

```bash
# 현재 링크된 프로젝트 확인
cat .supabase/project-ref

# 프로젝트가 링크되지 않은 경우
# 1단계와 2단계를 다시 진행하세요
```

### 비밀번호 인증 실패 해결

에러 메시지에 `password authentication failed`가 포함된 경우:

#### 방법 A: 비밀번호 확인 및 `.env.local` 업데이트 (권장)

1. **Supabase Dashboard에서 데이터베이스 비밀번호 확인/재설정**
   - [Supabase Dashboard](https://app.supabase.com) 로그인
   - 프로젝트 선택 → Settings → Database
   - "Database password" 섹션에서:
     - 비밀번호를 아는 경우: 복사하여 사용
     - 비밀번호를 모르는 경우: **"Reset database password"** 클릭하여 새로 설정
       - 새 비밀번호를 안전한 곳에 기록 (한 번만 표시됨)

2. **`.env.local` 파일 업데이트**
   ```bash
   # .env.local 파일 수정
   SUPABASE_DB_PASSWORD=새로운_비밀번호
   ```

3. **프로젝트 재링크**
   ```bash
   # 기존 링크 제거 (선택사항)
   rm -rf .supabase
   
   # 프로젝트 재링크 (환경 변수의 비밀번호 사용)
   npx supabase link --project-ref yiswawnxsrdmvvihhpne
   ```

4. **마이그레이션 푸시**
   ```bash
   npx supabase db push
   ```

#### 방법 B: 환경 변수 없이 직접 입력

환경 변수의 비밀번호를 사용하지 않고 링크 시 직접 입력받으려면:

1. **임시로 환경 변수 제거 또는 이름 변경**
   ```bash
   # .env.local에서 SUPABASE_DB_PASSWORD 라인을 주석 처리하거나 삭제
   # 또는 다른 이름으로 변경
   ```

2. **프로젝트 링크 (비밀번호 직접 입력)**
   ```bash
   npx supabase link --project-ref yiswawnxsrdmvvihhpne
   # 비밀번호를 입력하라는 프롬프트가 나타남
   ```

3. **마이그레이션 푸시**
   ```bash
   npx supabase db push
   ```

### 프로젝트 참조 확인

```bash
# 현재 링크된 프로젝트 확인
cat .supabase/project-ref

# 프로젝트 상태 확인
npx supabase projects list
```

### 링크 해제 후 재링크

```bash
# 기존 링크 해제
rm -rf .supabase

# 프로젝트 재링크
npx supabase link --project-ref yiswawnxsrdmvvihhpne
```

### 디버그 모드로 실행

문제가 계속되면 디버그 모드로 실행하여 상세한 에러 메시지 확인:

```bash
npx supabase link --project-ref yiswawnxsrdmvvihhpne --debug
npx supabase db push --debug
```

## 참고 자료

- [Supabase CLI 문서](https://supabase.com/docs/reference/cli/introduction)
- [Supabase 마이그레이션 가이드](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [프로젝트 링크 가이드](https://supabase.com/docs/reference/cli/supabase-link)

---

**마지막 업데이트**: 2025-02-01

