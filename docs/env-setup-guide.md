# 환경 변수 설정 가이드

## 📋 필수 환경 변수

프로젝트를 실행하기 위해 다음 환경 변수들이 **필수**입니다:

### 1. `NEXT_PUBLIC_SUPABASE_URL`
- **설명**: Supabase 프로젝트 URL
- **형식**: `https://xxxxx.supabase.co`
- **확인 방법**: Supabase 대시보드 > Settings > API > Project URL

### 2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **설명**: Supabase Anon Key (공개 키)
- **확인 방법**: Supabase 대시보드 > Settings > API > Project API keys > anon public
- **참고**: 이 키는 공개되어도 안전합니다. RLS(Row Level Security)로 보호됩니다.

## 🔧 선택적 환경 변수

### `SUPABASE_SERVICE_ROLE_KEY`
- **설명**: Supabase Service Role Key (관리자 권한)
- **확인 방법**: Supabase 대시보드 > Settings > API > Project API keys > service_role
- **주의**: 
  - 이 키는 RLS를 우회하므로 **절대 공개하지 마세요!**
  - Admin 기능을 사용하는 경우에만 필요합니다.
  - 없어도 기본 기능은 정상 작동합니다.

## 📝 설정 방법

### 1. `.env.local` 파일 생성

프로젝트 루트 디렉토리에 `.env.local` 파일을 생성합니다.

**Windows (PowerShell):**
```powershell
New-Item -Path .env.local -ItemType File
```

**Mac/Linux:**
```bash
touch .env.local
```

### 2. 환경 변수 추가

`.env.local` 파일을 열고 다음 내용을 추가합니다:

```env
# 필수 환경 변수
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# 선택적 환경 변수 (Admin 기능 사용 시)
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 3. 실제 값으로 교체

Supabase 대시보드에서 확인한 실제 값으로 교체하세요.

## 🔍 Supabase 대시보드에서 확인하는 방법

1. [Supabase 대시보드](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **Settings** 클릭
4. **API** 메뉴 클릭
5. 다음 정보 확인:
   - **Project URL**: `NEXT_PUBLIC_SUPABASE_URL`에 사용
   - **Project API keys** 섹션:
     - **anon public**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 사용
     - **service_role** (선택): `SUPABASE_SERVICE_ROLE_KEY`에 사용

## ✅ 확인 방법

환경 변수가 제대로 설정되었는지 확인:

```bash
# 개발 서버 실행
npm run dev

# 또는 예시 데이터 생성 스크립트 실행
npm run seed:master
```

성공적으로 실행되면 환경 변수가 올바르게 설정된 것입니다.

## ⚠️ 주의사항

1. **`.env.local` 파일은 Git에 커밋하지 마세요**
   - `.gitignore`에 포함되어 있어 자동으로 제외됩니다.
   - 환경 변수는 민감한 정보이므로 절대 공유하지 마세요.

2. **프로덕션 환경**
   - Vercel, Netlify 등 배포 플랫폼의 환경 변수 설정을 사용하세요.
   - `.env.local`은 로컬 개발용입니다.

3. **보안**
   - `SUPABASE_SERVICE_ROLE_KEY`는 특히 주의하세요.
   - 이 키는 데이터베이스의 모든 데이터에 접근할 수 있습니다.

## 📚 참고 파일

- `.env.local.example`: 환경 변수 예시 템플릿
- `lib/env.ts`: 환경 변수 검증 로직

