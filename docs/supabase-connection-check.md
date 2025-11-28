# Supabase 연결 확인 작업

## 작업 일시
2024년 11월

## 작업 내용

### 1. Supabase 연결 테스트 스크립트 개선

**파일**: `scripts/test-supabase-connection.ts`

**개선 사항**:
- 환경 변수 미설정 시 친절한 안내 메시지 표시
- `env.ts` 의존성 제거로 독립적인 스크립트로 변경
- 여러 테이블을 시도하여 하나라도 성공하면 OK 처리
- 더 상세한 에러 정보 표시 (코드, 힌트, 상세)

**주요 변경**:
- `@/lib/env` import 제거
- `process.env` 직접 사용
- `createClient` 직접 사용 (Supabase JS SDK)
- 환경 변수 미설정 시 안내 메시지 및 종료

### 2. Supabase 연결 가이드 문서 작성

**파일**: `docs/supabase-connection-guide.md`

**내용**:
- 환경 변수 설정 방법
- Supabase 프로젝트 정보 확인 방법
- 연결 테스트 방법
- 문제 해결 가이드
- 보안 주의사항

## 사용 방법

### 연결 테스트 실행

```bash
npx tsx scripts/test-supabase-connection.ts
```

### 환경 변수 설정

프로젝트 루트에 `.env.local` 파일 생성:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here  # 선택사항
```

## 테스트 결과

현재 환경 변수가 설정되지 않은 상태로, 스크립트는 다음과 같이 동작합니다:

1. ✅ 환경 변수 확인
2. ✅ 미설정 시 친절한 안내 메시지 표시
3. ✅ 해결 방법 제시
4. ✅ 가이드 문서 참조 안내

## 다음 단계

1. `.env.local` 파일 생성
2. Supabase 프로젝트 정보 입력
3. 스크립트 재실행하여 연결 확인

