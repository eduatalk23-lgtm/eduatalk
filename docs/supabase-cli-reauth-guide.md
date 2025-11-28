# Supabase CLI 재인증 가이드

## 📋 개요

Supabase CLI 인증 문제가 발생하거나, 토큰을 갱신해야 할 때 재인증 절차입니다.

## 🔧 재인증 방법

### 방법 1: 명령어로 재인증 (권장)

터미널에서 다음 명령어를 순서대로 실행합니다:

```bash
# 1. 현재 로그아웃
npx supabase logout

# 2. 다시 로그인
npx supabase login
```

로그인 시 브라우저가 자동으로 열리고, Supabase 계정으로 로그인하면 자동으로 인증됩니다.

### 방법 2: Access Token 사용

비대화형 환경이나 CI/CD 환경에서는 Access Token을 사용할 수 있습니다:

```bash
# 환경 변수로 Access Token 설정
export SUPABASE_ACCESS_TOKEN=your-access-token-here

# 또는 .env.local 파일에 추가
echo "SUPABASE_ACCESS_TOKEN=your-access-token-here" >> .env.local
```

#### Access Token 생성 방법

1. [Supabase 대시보드](https://app.supabase.com)에 로그인
2. 프로필 아이콘 클릭 → **Account Settings**
3. **Access Tokens** 메뉴로 이동
4. **Generate new token** 클릭
5. 토큰 이름 입력 후 생성
6. 생성된 토큰 복사 (한 번만 표시되므로 저장)

### 방법 3: 프로젝트 재연결

특정 프로젝트와의 연결만 갱신하려면:

```bash
# 프로젝트 연결 해제
npx supabase unlink

# 프로젝트 다시 연결
npx supabase link --project-ref your-project-ref
```

## 🔍 현재 인증 상태 확인

### 프로젝트 목록 확인

```bash
npx supabase projects list
```

정상적으로 프로젝트 목록이 표시되면 인증이 되어 있는 것입니다.

### 현재 연결된 프로젝트 확인

```bash
cat supabase/.temp/project-ref
```

또는

```bash
npx supabase status
```

## 🚨 문제 해결

### 문제: "Cannot use automatic login flow inside non-TTY environments"

**원인:** 비대화형 환경(스크립트, CI/CD)에서 실행 중

**해결 방법:**

1. **Access Token 사용** (방법 2 참고)
2. **터미널에서 직접 실행**:
   ```bash
   # 터미널에서 직접 실행 (비대화형 환경이 아닌 곳에서)
   npx supabase login
   ```

### 문제: "failed to connect to postgres"

**원인:** 인증은 되었지만 데이터베이스 연결 실패

**해결 방법:**

1. **Connection Pooler 사용** (포트 6543)
2. **네트워크 연결 확인**
3. **프로젝트 설정 확인**

자세한 내용은 [Supabase CLI 연결 오류 해결 가이드](./supabase-cli-connection-fix.md)를 참고하세요.

### 문제: 프로젝트 목록이 표시되지 않음

**해결 방법:**

1. 재인증 진행:
   ```bash
   npx supabase logout
   npx supabase login
   ```

2. 올바른 계정으로 로그인했는지 확인

3. 프로젝트 권한 확인 (Supabase 대시보드에서)

## 📝 단계별 재인증 절차

### 1. 현재 상태 확인

```bash
# 프로젝트 목록 확인
npx supabase projects list

# 연결된 프로젝트 확인
cat supabase/.temp/project-ref
```

### 2. 로그아웃

```bash
npx supabase logout
```

확인 메시지가 나타나면 `y` 입력

### 3. 로그인

```bash
npx supabase login
```

브라우저가 열리면:
1. Supabase 계정으로 로그인
2. 권한 승인
3. 브라우저에서 "인증 완료" 메시지 확인

### 4. 인증 확인

```bash
# 프로젝트 목록 다시 확인
npx supabase projects list

# 연결 테스트
npx supabase status
```

## ✅ 체크리스트

재인증 후 확인사항:

- [ ] `npx supabase projects list` 명령어가 정상 작동
- [ ] 프로젝트 목록이 표시됨
- [ ] 연결된 프로젝트 확인 (`cat supabase/.temp/project-ref`)
- [ ] `npx supabase status` 명령어가 정상 작동
- [ ] 데이터베이스 연결 테스트 (`npx supabase db push --dry-run`)

## 🔐 보안 주의사항

1. **Access Token 보안**
   - `.env.local` 파일에 저장 (`.gitignore`에 포함되어 있어 Git에 커밋되지 않음)
   - 공개 저장소에 커밋하지 않도록 주의
   - 정기적으로 토큰 갱신

2. **토큰 권한**
   - 필요한 최소 권한만 부여
   - 사용하지 않는 토큰은 삭제

## 📚 참고 자료

- [Supabase CLI 문서](https://supabase.com/docs/reference/cli)
- [Supabase CLI 인증 가이드](https://supabase.com/docs/guides/cli/managing-environments#authentication)
- [Access Token 관리](https://supabase.com/docs/guides/platform/access-tokens)

## 💡 빠른 재인증

터미널에서 바로 실행:

```bash
npx supabase logout && npx supabase login
```

브라우저에서 로그인 후 인증이 완료됩니다.

