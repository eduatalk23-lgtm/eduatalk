# Vercel 배포 전 점검 체크리스트

**작성일**: 2025-01-15  
**목적**: Vercel 배포 전 필수 점검 사항 정리

---

## ✅ 완료된 항목

### 1. TypeScript 타입 체크
- [x] `npx tsc --noEmit` 실행 완료
- [x] 타입 에러 없음 확인

### 2. 프로덕션 빌드 테스트
- [x] `pnpm build` 실행 완료
- [x] 빌드 성공 확인

---

## ⚠️ 확인 필요 항목

### 3. ESLint 체크
- [x] `pnpm lint` 실행 완료
- [ ] **결과**: 대부분 경고(warning), 실제 에러는 제한적
  - `supabase/functions/reschedule-worker/index.ts`: `any` 타입 사용 (1개)
  - 대부분의 경고는 `.next` 빌드 파일 및 `serena/` 테스트 파일에서 발생
  - **배포 차단 요소 아님** (경고는 빌드를 막지 않음)

### 4. 환경 변수 확인 (Vercel 대시보드)

**필수 환경 변수**:
- [ ] `NEXT_PUBLIC_SUPABASE_URL` 설정 확인
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정 확인

**선택적 환경 변수** (기능 사용 시 필요):
- [ ] `NEXT_PUBLIC_BASE_URL` (QR 코드 Deep Link용)
- [ ] `PPURIO_ACCOUNT` (SMS 발송 기능 사용 시)
- [ ] `PPURIO_AUTH_KEY` (SMS 발송 기능 사용 시)
- [ ] `PPURIO_SENDER_NUMBER` (SMS 발송 기능 사용 시)
- [ ] `PPURIO_API_BASE_URL` (SMS 발송 기능 사용 시)

**환경 변수 설정 방법**:
1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
2. 각 환경 변수 추가 (Production, Preview, Development 모두 선택)
3. **중요**: 환경 변수 설정 후 반드시 재배포 필요

### 5. Supabase 마이그레이션 상태
- [ ] 프로덕션 데이터베이스에 최신 마이그레이션 적용 확인
- [ ] RLS (Row Level Security) 정책 활성화 확인
- [ ] 데이터베이스 연결 테스트

### 6. 프로덕션 빌드 최적화 확인
- [x] Next.js 이미지 최적화 설정 확인 (`next.config.ts`)
- [x] PWA 설정 확인 (`next-pwa`)
- [x] 번들 최적화 설정 확인 (`optimizePackageImports`)

### 7. 보안 체크
- [ ] 환경 변수에 민감한 정보가 노출되지 않았는지 확인
- [ ] `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 (클라이언트에 노출 금지)
- [ ] RLS 정책이 모든 테이블에 적용되었는지 확인

### 8. 에러 핸들링
- [x] `GlobalErrorBoundary` 설정 확인 (`app/layout.tsx`)
- [ ] 에러 로깅 설정 (선택사항)

### 9. 메타데이터 및 SEO
- [x] 메타데이터 설정 확인 (`app/layout.tsx`)
- [x] PWA 매니페스트 설정 확인
- [x] 아이콘 및 스플래시 이미지 설정 확인

### 10. 미들웨어 확인
- [x] 인증 미들웨어 설정 확인 (`middleware.ts`)
- [x] 역할 기반 접근 제어 확인

---

## 🚀 배포 전 최종 체크리스트

### 필수 확인 사항
- [ ] Vercel 환경 변수 설정 완료
- [ ] 환경 변수 설정 후 재배포 완료
- [ ] 프로덕션 빌드 성공 (`pnpm build`)
- [ ] TypeScript 타입 체크 통과 (`npx tsc --noEmit`)

### 권장 확인 사항
- [ ] 로컬에서 프로덕션 빌드 테스트 (`pnpm build && pnpm start`)
- [ ] 주요 페이지 접근 테스트
- [ ] 인증 플로우 테스트
- [ ] API 엔드포인트 테스트

---

## 📝 배포 후 확인 사항

### 즉시 확인
- [ ] 배포 성공 여부 확인 (Vercel 대시보드)
- [ ] 프로덕션 URL 접근 확인
- [ ] 환경 변수 로드 확인 (브라우저 콘솔에서 에러 없음)

### 기능 테스트
- [ ] 로그인/회원가입 기능
- [ ] 역할별 대시보드 접근
- [ ] 주요 기능 동작 확인

### 성능 확인
- [ ] 페이지 로딩 속도
- [ ] 이미지 최적화 동작
- [ ] PWA 설치 가능 여부

---

## 🔧 문제 해결 가이드

### 환경 변수 오류 발생 시
1. Vercel 대시보드에서 환경 변수 재확인
2. 환경 변수 설정 후 재배포 (Redeploy)
3. 빌드 로그에서 환경 변수 로드 확인

### 빌드 실패 시
1. 로컬에서 `pnpm build` 실행하여 에러 확인
2. TypeScript 타입 에러 확인 (`npx tsc --noEmit`)
3. 의존성 문제 확인 (`pnpm install`)

### 런타임 에러 발생 시
1. Vercel 함수 로그 확인
2. 브라우저 콘솔 에러 확인
3. Supabase 연결 상태 확인

---

## 📚 참고 문서

- [Vercel 배포 가이드](./vercel-deployment-guide.md)
- [환경 변수 설정 가이드](./env-setup-guide.md)
- [Vercel 환경 변수 트러블슈팅](./vercel-env-vars-troubleshooting.md)

---

**다음 단계**: Vercel 대시보드에서 환경 변수를 설정하고 배포를 진행하세요.

