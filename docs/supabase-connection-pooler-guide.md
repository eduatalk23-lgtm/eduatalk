# Supabase Connection Pooler 설정 가이드

## 📋 개요

Supabase Connection Pooler를 사용하면 데이터베이스 연결을 효율적으로 관리하고, 동시 연결 수 제한을 해결할 수 있습니다.

## 🔧 Connection Pooler 사용 방법

### 1. Supabase 대시보드에서 설정

1. [Supabase 대시보드](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. **Settings** → **Database** 메뉴로 이동
4. **Connection Pooler** 섹션에서 **"Use connection pooler"** 활성화
5. Pooler URL 복사

### 2. 포트 번호 차이

Supabase는 두 가지 연결 방식을 제공합니다:

| 연결 방식 | 포트 | 용도 |
|---------|------|------|
| **Direct Connection** | `5432` | 직접 PostgreSQL 연결 (제한적) |
| **Connection Pooler** | `6543` | 연결 풀링 (권장) |

### 3. DATABASE_URL 설정 (Prisma 사용 시)

Prisma를 사용하는 경우, `.env` 파일의 `DATABASE_URL`을 다음과 같이 설정:

```env
# ❌ 직접 연결 (포트 5432) - 연결 수 제한 있음
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# ✅ Connection Pooler 사용 (포트 6543) - 권장
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0.[REGION].pooler.supabase.com:6543/postgres
```

**핵심 차이점:**
- 포트: `5432` → `6543`
- 호스트: `db.[PROJECT-REF].supabase.co` → `aws-0.[REGION].pooler.supabase.com`
- 사용자: `postgres` → `postgres.[PROJECT-REF]`

### 4. 현재 프로젝트 (Supabase JS 클라이언트 사용)

이 프로젝트는 **Supabase JS 클라이언트**를 사용하므로, 직접적인 PostgreSQL 연결이 아닌 **REST API**를 통해 연결합니다.

따라서:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`: HTTP/HTTPS URL 사용 (포트 설정 불필요)
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 공개 API 키
- ✅ `SUPABASE_SERVICE_ROLE_KEY`: 서비스 역할 키

**현재 설정 예시:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 🚨 문제 해결

### 문제: "Too many connections" 오류

**원인:**
- 직접 PostgreSQL 연결(포트 5432) 사용 시 연결 수 제한 초과

**해결책:**
1. Connection Pooler 활성화 (Supabase 대시보드)
2. DATABASE_URL의 포트를 `5432`에서 `6543`으로 변경
3. 호스트를 pooler URL로 변경

### 문제: Prisma 연결 실패

**해결책:**
```env
# .env 파일
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0.[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**주의사항:**
- `?pgbouncer=true` 파라미터 추가 (Prisma에서 pooler 사용 시 필요)
- 사용자 이름 형식: `postgres.[PROJECT-REF]` (점 포함)

## 📚 참고 자료

- [Supabase Connection Pooling 문서](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Prisma + Supabase 가이드](https://supabase.com/docs/guides/integrations/prisma)

## ✅ 체크리스트

- [ ] Supabase 대시보드에서 Connection Pooler 활성화
- [ ] Pooler URL 확인
- [ ] DATABASE_URL 포트를 6543으로 변경 (Prisma 사용 시)
- [ ] `?pgbouncer=true` 파라미터 추가 (Prisma 사용 시)
- [ ] 연결 테스트

## 🔍 현재 프로젝트 상태

이 프로젝트는 **Supabase JS 클라이언트**를 사용하므로:
- ✅ Connection Pooler는 Supabase 측에서 자동 관리
- ✅ 추가 설정 불필요
- ✅ `NEXT_PUBLIC_SUPABASE_URL`만 올바르게 설정하면 됨

**참고:** 향후 Prisma나 직접 PostgreSQL 연결을 사용하는 경우에만 위의 설정이 필요합니다.

