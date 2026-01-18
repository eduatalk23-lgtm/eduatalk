# Supabase CLI 연결 오류 해결 가이드

## 🚨 문제 상황

Supabase CLI로 데이터베이스에 연결할 때 다음과 같은 오류가 발생:

```
failed to connect to postgres: failed to connect to `host=db.yiswawnxsrdmvvihhpne.supabase.co user=cli_login_postgres database=postgres`: dial error (dial tcp [2406:da1a:6b0:f600:39a5:4fac:237e:9e42]:5432: connect: no route to host)
```

**원인:**
- IPv6 주소로 연결 시도
- 네트워크 라우팅 문제
- 방화벽 또는 네트워크 설정 문제

## 🔧 해결 방법

### 방법 1: Connection Pooler 사용 (권장)

Supabase CLI는 기본적으로 직접 연결(포트 5432)을 사용합니다. Connection Pooler(포트 6543)를 사용하면 연결 문제를 해결할 수 있습니다.

#### 1. Supabase 대시보드에서 Pooler URL 확인

1. [Supabase 대시보드](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. **Settings** → **Database** 메뉴로 이동
4. **Connection Pooler** 섹션에서 **Connection string** 복사
   - 형식: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0.[REGION].pooler.supabase.com:6543/postgres`

#### 2. Supabase CLI 연결 설정

`supabase/config.toml` 파일이 없다면 생성:

```bash
# Supabase 프로젝트 초기화 (이미 되어 있다면 생략)
npx supabase init
```

#### 3. Connection Pooler URL 설정

`.env.local` 또는 환경 변수에 설정:

```env
# Connection Pooler URL (포트 6543)
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0.[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

또는 `supabase/.temp/pooler-url` 파일에 저장된 URL 사용:

```bash
# pooler URL 확인
cat supabase/.temp/pooler-url
```

### 방법 2: IPv4 강제 사용

IPv6 연결 문제를 해결하기 위해 IPv4로 강제 연결:

#### 환경 변수 설정

```bash
# IPv4만 사용하도록 설정
export SUPABASE_DB_IPV4_ONLY=true
```

또는 `.env.local`에 추가:

```env
SUPABASE_DB_IPV4_ONLY=true
```

### 방법 3: 네트워크 연결 테스트

연결 가능 여부를 먼저 확인:

```bash
# IPv4 연결 테스트
ping -4 db.yiswawnxsrdmvvihhpne.supabase.co

# IPv6 연결 테스트
ping -6 db.yiswawnxsrdmvvihhpne.supabase.co

# 포트 연결 테스트
nc -zv db.yiswawnxsrdmvvihhpne.supabase.co 5432
nc -zv db.yiswawnxsrdmvvihhpne.supabase.co 6543
```

### 방법 4: Supabase CLI 재인증

인증 토큰 문제일 수 있으므로 재인증:

```bash
# Supabase CLI 로그아웃
npx supabase logout

# Supabase CLI 로그인
npx supabase login

# 프로젝트 연결 확인
npx supabase projects list
```

### 방법 5: 직접 연결 대신 Pooler 사용

`supabase db push` 명령어에 Pooler URL 사용:

```bash
# Pooler URL을 환경 변수로 설정
export DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0.[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# 또는 .env.local에 설정 후
npx supabase db push --db-url "$DATABASE_URL"
```

## 📋 체크리스트

연결 문제 해결을 위한 단계별 확인:

- [ ] Supabase 대시보드에서 Connection Pooler 활성화 확인
- [ ] Pooler URL 복사 및 확인
- [ ] `supabase/.temp/pooler-url` 파일 확인
- [ ] 네트워크 연결 테스트 (ping, nc)
- [ ] IPv4/IPv6 연결 가능 여부 확인
- [ ] Supabase CLI 재인증
- [ ] 환경 변수 설정 확인
- [ ] `npx supabase db push --debug`로 상세 로그 확인

## 🔍 디버깅

### 상세 로그 확인

```bash
# 디버그 모드로 실행
npx supabase db push --debug

# 연결 정보 확인
npx supabase status
```

### 연결 정보 확인

```bash
# 프로젝트 정보 확인
cat supabase/.temp/project-ref

# Pooler URL 확인
cat supabase/.temp/pooler-url 2>/dev/null || echo "Pooler URL 없음"
```

## 💡 권장 해결 순서

1. **Connection Pooler 사용** (가장 권장)
   - Supabase 대시보드에서 Pooler URL 확인
   - `DATABASE_URL` 환경 변수에 Pooler URL 설정
   - `?pgbouncer=true` 파라미터 추가

2. **IPv4 강제 사용**
   - `SUPABASE_DB_IPV4_ONLY=true` 환경 변수 설정

3. **네트워크 확인**
   - 방화벽 설정 확인
   - 회사/학교 네트워크에서 프록시 필요 여부 확인

4. **Supabase CLI 재인증**
   - `npx supabase logout` 후 `npx supabase login`

## 📚 참고 자료

- [Supabase CLI 문서](https://supabase.com/docs/reference/cli)
- [Connection Pooling 가이드](./supabase-connection-pooler-guide.md)
- [Supabase Database 연결 문제 해결](https://supabase.com/docs/guides/database/connecting-to-postgres#troubleshooting)

## ⚠️ 주의사항

- Connection Pooler를 사용할 때는 `?pgbouncer=true` 파라미터가 필요합니다 (Prisma 등 일부 도구에서)
- 직접 연결(포트 5432)은 연결 수 제한이 있으므로 Pooler(포트 6543) 사용을 권장합니다
- IPv6 연결 문제는 네트워크 환경에 따라 다를 수 있습니다

