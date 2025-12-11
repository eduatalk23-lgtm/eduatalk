# 통합 테스트 설정 가이드

## 개요

이 문서는 플랜 그룹 관련 통합 테스트를 실행하기 위한 설정 가이드입니다.

## 필수 요구사항

1. 테스트용 Supabase 프로젝트
2. 테스트 데이터베이스 마이그레이션
3. 환경 변수 설정

## 설정 단계

### 1. 테스트용 Supabase 프로젝트 생성

1. Supabase 대시보드에서 새 프로젝트 생성
2. 프로젝트 설정에서 API 키 확인
3. 데이터베이스 마이그레이션 실행

### 2. 환경 변수 설정

`.env.test` 파일 생성:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-test-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NODE_ENV=test
```

### 3. 데이터베이스 마이그레이션 실행

```bash
# 테스트 데이터베이스에 마이그레이션 실행
supabase db push --db-url "postgresql://postgres:[password]@[host]:[port]/postgres"
```

### 4. 테스트 실행

```bash
# 통합 테스트만 실행
npm test -- __tests__/integration/

# 특정 테스트 파일 실행
npm test -- __tests__/integration/planGroupTimeBlock.test.ts
```

## 테스트 헬퍼 함수

`__tests__/helpers/supabase.ts`에 다음 헬퍼 함수가 제공됩니다:

- `createTestSupabaseClient()`: 테스트용 Supabase 클라이언트 생성
- `cleanupTestData()`: 테스트 데이터 정리
- `createTestTenant()`: 테스트용 테넌트 생성
- `createTestStudent()`: 테스트용 학생 생성
- `createTestBlockSet()`: 테스트용 블록 세트 생성

## 주의사항

1. **테스트 데이터 격리**: 각 테스트는 독립적으로 실행되도록 데이터를 정리해야 합니다.
2. **환경 변수**: 테스트 환경에서만 사용되는 환경 변수를 설정해야 합니다.
3. **마이그레이션**: 테스트 데이터베이스에 최신 마이그레이션이 적용되어 있어야 합니다.

## CI/CD 통합

CI/CD 파이프라인에서 통합 테스트를 실행하려면:

1. 테스트용 Supabase 프로젝트 설정
2. 환경 변수를 CI/CD 시크릿으로 설정
3. 테스트 실행 전 마이그레이션 실행

## 참고 파일

- `__tests__/integration/planGroupTimeBlock.test.ts` - 통합 테스트 예시
- `__tests__/helpers/supabase.ts` - 테스트 헬퍼 함수

