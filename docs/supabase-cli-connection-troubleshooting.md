# Supabase CLI 연결 문제 해결 가이드

## 문제 상황

```
failed to connect to postgres: dial error (dial tcp [2406:da1a:6b0:f600:39a5:4fac:237e:9e42]:5432: connect: no route to host)
```

이 오류는 Supabase CLI가 데이터베이스에 연결할 수 없을 때 발생합니다.

## 원인

1. **IPv6 연결 문제**: 네트워크가 IPv6를 지원하지 않거나 라우팅 문제
2. **방화벽/프록시**: 회사 네트워크나 방화벽이 PostgreSQL 포트(5432)를 차단
3. **네트워크 불안정**: 일시적인 네트워크 문제

## 해결 방법

### 방법 1: Supabase Studio에서 직접 실행 (권장) ⭐

CLI 연결 문제가 있을 때 가장 확실한 방법입니다.

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택: `eduatalk23-lgtm's Project`

2. **SQL Editor 열기**
   - 좌측 메뉴 → "SQL Editor"
   - "New query" 클릭

3. **마이그레이션 SQL 실행**
   - 파일 열기: `supabase/migrations/20251128000000_remove_schools_add_unified_view.sql`
   - 전체 내용 복사 후 SQL Editor에 붙여넣기
   - "Run" 버튼 클릭 또는 `Ctrl+Enter`

4. **실행 결과 확인**
   - 성공 메시지 확인
   - 에러 발생 시 에러 메시지 확인

### 방법 2: 네트워크 설정 확인

#### IPv4로 강제 연결 시도

```bash
# 환경 변수로 IPv4만 사용하도록 설정
export SUPABASE_DB_IPV4_ONLY=1
npx supabase db push
```

#### 네트워크 연결 테스트

```bash
# PostgreSQL 포트 연결 테스트
nc -zv db.yiswawnxsrdmvvihhpne.supabase.co 5432

# 또는 telnet 사용
telnet db.yiswawnxsrdmvvihhpne.supabase.co 5432
```

### 방법 3: VPN/프록시 확인

- 회사 네트워크를 사용 중이라면 VPN 연결 확인
- 프록시 설정이 있다면 Supabase CLI가 프록시를 우회하도록 설정

### 방법 4: Supabase CLI 재인증

```bash
# 로그아웃 후 재로그인
supabase logout
supabase login

# 프로젝트 재연결
supabase link --project-ref yiswawnxsrdmvvihhpne
```

### 방법 5: 디버그 모드로 상세 정보 확인

```bash
# 디버그 모드로 실행하여 상세 오류 확인
npx supabase db push --debug
```

## 현재 상태

- ✅ Supabase CLI 로그인: 완료
- ✅ 프로젝트 연결: `eduatalk23-lgtm's Project` (yiswawnxsrdmvvihhpne)
- ❌ 데이터베이스 연결: 실패 (IPv6 라우팅 문제)

## 권장 조치

**즉시 실행 가능한 방법**: Supabase Studio에서 직접 SQL 실행

1. https://supabase.com/dashboard 접속
2. 프로젝트 선택
3. SQL Editor에서 마이그레이션 SQL 실행

이 방법은 네트워크 문제와 무관하게 항상 작동합니다.

## 참고

- 마이그레이션 파일: `supabase/migrations/20251128000000_remove_schools_add_unified_view.sql`
- 실행 가이드: `docs/school-migration-execution-guide.md`
- 확인 스크립트: `pnpm tsx scripts/check-students-school-columns.ts`

