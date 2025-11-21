# 사이드바 네비게이션이 적용되지 않은 페이지 목록

## 📋 개요

현재 프로젝트에서 사이드바 형식의 카테고리 네비게이션(`CategoryNav`)이 적용되지 않은 페이지들의 목록입니다.

## ✅ 사이드바가 적용된 레이아웃

다음 route group의 레이아웃에는 사이드바가 적용되어 있습니다:

1. **`(admin)/layout.tsx`** - 관리자 영역
   - `/admin/*` 경로의 모든 페이지
   - CategoryNav 사용

2. **`(parent)/layout.tsx`** - 학부모 영역
   - `/parent/*` 경로의 모든 페이지
   - CategoryNav 사용

3. **`(student)/layout.tsx`** - 학생 영역
   - `/dashboard`, `/today`, `/focus` 등 (student) route group 내부 페이지
   - CategoryNav 사용

## ❌ 사이드바가 없는 페이지들

### 1. 인증 및 설정 페이지 (의도적으로 제외 가능)

- `/login` - 로그인 페이지
- `/signup` - 회원가입 페이지
- `/post-login` - 로그인 후 리다이렉트 페이지 (redirect만)
- `/page.tsx` - 루트 페이지 (redirect만)
- `/student-setup` - 학생 정보 설정 페이지

### 2. Route Group 밖의 학생 기능 페이지 (⚠️ 사이드바 적용 필요)

다음 페이지들은 `categoryConfig.ts`에 정의되어 있지만, route group 밖에 있어 사이드바가 없습니다:

#### 학습 계획 관련
- `/plan` - 플랜 목록 페이지
- `/plan/new` - 새 플랜 생성 페이지
- `/plan/[id]` - 플랜 상세 페이지
- `/plan/[id]/edit` - 플랜 수정 페이지
- `/plan/[id]/progress` - 플랜 진행률 페이지
- `/scheduler` - 자동 스케줄러 페이지

#### 콘텐츠 관련
- `/contents` - 콘텐츠 목록 페이지
- `/contents/books` - 책 목록 페이지
- `/contents/books/new` - 책 등록 페이지
- `/contents/books/[id]` - 책 상세 페이지
- `/contents/books/[id]/edit` - 책 수정 페이지
- `/contents/lectures` - 강의 목록 페이지
- `/contents/lectures/new` - 강의 등록 페이지
- `/contents/lectures/[id]` - 강의 상세 페이지
- `/contents/lectures/[id]/edit` - 강의 수정 페이지
- `/contents/custom` - 커스텀 콘텐츠 목록 페이지
- `/contents/custom/new` - 커스텀 콘텐츠 등록 페이지
- `/contents/custom/[id]` - 커스텀 콘텐츠 상세 페이지
- `/contents/custom/[id]/edit` - 커스텀 콘텐츠 수정 페이지

#### 학습 분석 관련
- `/analysis` - 취약 과목 분석 페이지

#### 목표 관련
- `/goals` - 목표 목록 페이지
- `/goals/new` - 새 목표 만들기 페이지
- `/goals/[goalId]` - 목표 상세 페이지
- `/goals/[goalId]/edit` - 목표 수정 페이지

#### 성적 관련
- `/scores` - 성적 관리 페이지
- `/scores/new` - 새 성적 입력 페이지
- `/scores/[id]/edit` - 성적 수정 페이지
- `/scores/dashboard` - 성적 대시보드 페이지
- `/scores/school/[grade]/*` - 내신 성적 관련 페이지들
- `/scores/mock/[grade]/*` - 모의고사 성적 관련 페이지들

#### 스케줄 관련
- `/schedule` - 스케줄 인덱스 페이지 (redirect)
- `/schedule/[date]` - 날짜별 스케줄 페이지

#### 리포트 관련
- `/reports` - 리포트 목록 페이지
- `/report/weekly` - 주간 리포트 페이지
- `/report/monthly` - 월간 리포트 페이지

#### 시간 블록 관련
- `/blocks` - 시간 블록 설정 페이지

### 3. Route Group 밖의 기타 페이지

- `(main)/layout.tsx` - Nav 컴포넌트만 사용 (CategoryNav 아님)
- `(superadmin)/layout.tsx` - 사이드바 없음

## 🔧 해결 방안

### 옵션 1: Route Group으로 이동 (권장)

학생 기능 페이지들을 `(student)` route group으로 이동:

```
app/
  (student)/
    plan/
    contents/
    analysis/
    goals/
    scores/
    schedule/
    reports/
    blocks/
```

### 옵션 2: 공통 레이아웃 생성

route group 밖의 페이지들에 사이드바를 적용할 수 있는 공통 레이아웃을 생성합니다.

### 옵션 3: 개별 레이아웃 적용

각 페이지 디렉토리에 `layout.tsx`를 생성하여 사이드바를 적용합니다.

## 📊 통계

- **사이드바 적용된 페이지**: 약 20개 (route group 내부)
- **사이드바 없는 페이지**: 약 50개 이상
- **인증/설정 페이지**: 5개 (의도적으로 제외 가능)

## 📝 참고

- 사이드바 네비게이션 컴포넌트: `components/navigation/global/CategoryNav.tsx`
- 카테고리 설정: `components/navigation/global/categoryConfig.ts`
- 현재 학생용 카테고리에는 위 페이지들이 모두 정의되어 있으나, 실제 페이지가 route group 밖에 있어 사이드바가 표시되지 않습니다.

