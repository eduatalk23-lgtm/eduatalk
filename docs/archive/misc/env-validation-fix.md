# 환경 변수 검증 실패 오류 해결

## 작업 일시
2025-11-26

## 문제 상황
`.env.local` 파일을 준비했는데도 환경 변수 검증 실패 오류가 발생

## 원인 분석
1. `.env.local` 파일이 프로젝트 루트에 없었음
2. Next.js는 환경 변수를 빌드/시작 시점에 로드하므로 서버 재시작 필요
3. 환경 변수 검증 오류 메시지가 불명확함

## 해결 방법

### 1. .env.local 파일 생성
프로젝트 루트(`eduatalk/`)에 `.env.local` 파일을 생성하고 다음 환경 변수를 설정:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 2. 환경 변수 검증 로직 개선
`lib/env.ts` 파일을 개선하여:
- 개발 환경에서 환경 변수 설정 상태를 콘솔에 출력
- 더 명확하고 구체적인 오류 메시지 제공
- 문제 해결 방법을 오류 메시지에 포함

### 3. 개발 서버 재시작
환경 변수를 변경한 후 반드시 개발 서버를 재시작:

```bash
# 개발 서버 중지 (Ctrl+C)
# .next 폴더 삭제 (선택사항, 캐시 문제 해결)
rm -rf .next
# 개발 서버 재시작
pnpm dev
```

## 변경 사항

### lib/env.ts
- 개발 환경에서 환경 변수 설정 상태를 콘솔에 출력하도록 추가
- 오류 메시지를 더 구체적이고 해결 방법을 포함하도록 개선

## 참고 문서
- `docs/env-setup-guide.md`: 환경 변수 설정 상세 가이드

## 다음 단계
1. `.env.local` 파일에 실제 Supabase 키 입력
2. 개발 서버 재시작
3. 환경 변수 검증 오류가 해결되었는지 확인


