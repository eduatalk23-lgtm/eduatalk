# 첫 사용자 인터랙티브 튜토리얼 구현 계획

> **작성일**: 2026-01-05
> **상태**: 계획 완료, 구현 대기
> **우선순위**: Critical (신규 사용자 전환율 영향)

---

## 개요

신규 사용자가 TimeLevelUp의 핵심 기능을 쉽게 이해할 수 있도록 인터랙티브 튜토리얼을 제공합니다.

### 요구사항
- **범위**: 핵심 3페이지 (대시보드 → 오늘 학습 → 플랜 생성)
- **저장**: DB (user_consents 테이블)
- **트리거**: 첫 로그인 자동 시작

---

## 컴포넌트 아키텍처

```
TutorialProvider (Context)
├── TutorialOverlay (Portal to body)
│   ├── Backdrop (spotlight cutout)
│   ├── Highlight (pulse animation)
│   └── TutorialTooltip (positioned content)
│       ├── StepIndicator (progress dots)
│       ├── StepContent (title, description)
│       └── NavigationButtons (prev, next, skip)
└── useTutorial() hook
```

---

## 파일 구조

```
lib/tutorial/
├── TutorialProvider.tsx      # 메인 컨텍스트 + 상태 관리
├── TutorialOverlay.tsx       # 스포트라이트 오버레이
├── TutorialTooltip.tsx       # 툴팁 UI
├── useTutorial.ts            # 제어 훅
├── useTutorialTrigger.ts     # 자동 시작 훅
├── types.ts                  # 타입 정의
├── steps/
│   ├── dashboardSteps.ts     # 대시보드 단계
│   ├── todaySteps.ts         # 오늘 학습 단계
│   └── planCreationSteps.ts  # 플랜 생성 단계
└── index.ts                  # 배럴 export

lib/data/
└── userConsents.ts           # 수정: checkTutorialCompleted, markTutorialCompleted 추가

supabase/migrations/
└── YYYYMMDDHHMMSS_add_tutorial_consent_type.sql
```

---

## 단계 설정 형식

```typescript
interface TutorialStep {
  id: string;
  targetSelector: string;        // CSS 선택자
  title: string;
  description: string;
  icon?: string;                 // 이모지
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlightShape?: 'rectangle' | 'circle' | 'pill';
  highlightPadding?: number;
  action?: { label: string; href?: string; onClick?: () => void };
  skipIf?: () => boolean;
  waitForElement?: boolean;
}

interface TutorialFlow {
  id: string;
  name: string;
  route: string;
  steps: TutorialStep[];
  nextFlowId?: string;
}
```

---

## 튜토리얼 단계 (총 11단계)

### Dashboard Flow (3단계)
1. **환영 인사** - 튜토리얼 소개
2. **진행률 표시** - 오늘의 학습 진행 상황
3. **빠른 액션** - 주요 기능 바로가기 → 오늘 학습으로 이동

### Today Flow (4단계)
4. **플랜 목록** - 오늘의 학습 계획
5. **타이머 컨트롤** - 시작/일시정지/완료
6. **완료 버튼** - 학습 완료 방법
7. **새 플랜 추가** - 플랜 생성으로 이동

### Plan Creation Flow (4단계)
8. **위저드 소개** - 플랜 생성 마법사
9. **기본 정보** - 이름, 기간 설정
10. **스케줄 설정** - 학습 시간 설정
11. **완료** - 튜토리얼 종료 축하

---

## DB 마이그레이션

```sql
-- user_consents 테이블에 tutorial_completed 타입 추가
ALTER TABLE user_consents
DROP CONSTRAINT IF EXISTS user_consents_consent_type_check;

ALTER TABLE user_consents
ADD CONSTRAINT user_consents_consent_type_check
CHECK (consent_type IN ('terms', 'privacy', 'marketing', 'tutorial_completed'));

CREATE INDEX IF NOT EXISTS idx_user_consents_tutorial
ON user_consents(user_id)
WHERE consent_type = 'tutorial_completed';
```

---

## 구현 순서

### Phase 1: 기반 (1일)
- [ ] DB 마이그레이션 적용
- [ ] `lib/tutorial/types.ts` 생성
- [ ] `lib/data/userConsents.ts`에 함수 추가
  - `checkTutorialCompleted(userId)`
  - `markTutorialCompleted(userId)`

### Phase 2: 핵심 컴포넌트 (2일)
- [ ] `TutorialProvider.tsx` - 컨텍스트 + 상태
- [ ] `TutorialOverlay.tsx` - 스포트라이트 효과
- [ ] `TutorialTooltip.tsx` - 툴팁 UI
- [ ] `useTutorial.ts` - 제어 훅

### Phase 3: 단계 설정 (1일)
- [ ] `steps/dashboardSteps.ts`
- [ ] `steps/todaySteps.ts`
- [ ] `steps/planCreationSteps.ts`

### Phase 4: 통합 (1일)
- [ ] `app/(student)/layout.tsx`에 TutorialProvider 추가
- [ ] 대상 요소에 `data-tutorial` 속성 추가
- [ ] `useTutorialTrigger.ts` - 첫 로그인 자동 시작
- [ ] 설정 페이지에 "튜토리얼 다시 보기" 추가

### Phase 5: 마무리 (0.5일)
- [ ] 애니메이션 적용 (Framer Motion)
- [ ] 접근성 (키보드 네비게이션, ARIA)
- [ ] 모바일 반응형

---

## 핵심 파일 경로

| 용도 | 파일 |
|-----|------|
| 참고: 툴팁 | `components/ui/Tooltip.tsx` |
| 참고: 다이얼로그 | `components/ui/Dialog.tsx` |
| 참고: 토스트 | `components/ui/ToastProvider.tsx` |
| 수정: 동의 데이터 | `lib/data/userConsents.ts` |
| 수정: 학생 레이아웃 | `app/(student)/layout.tsx` |
| 수정: 대시보드 | `app/(student)/dashboard/page.tsx` |
| 수정: 오늘 학습 | `app/(student)/today/page.tsx` |
| 수정: 플랜 위저드 | `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` |

---

## 주요 패턴

### 스포트라이트 효과 (CSS clip-path)
```typescript
style={{
  clipPath: `polygon(
    0% 0%, 0% 100%,
    ${left}px 100%, ${left}px ${top}px,
    ${right}px ${top}px, ${right}px ${bottom}px,
    ${left}px ${bottom}px, ${left}px 100%,
    100% 100%, 100% 0%
  )`
}}
```

### 자동 시작 로직
```typescript
// useTutorialTrigger.ts
useEffect(() => {
  if (pathname !== '/dashboard') return;
  const completed = await checkTutorialCompleted(userId);
  if (!completed) {
    setTimeout(() => start('dashboard'), 1000);
  }
}, [pathname, userId]);
```

### 페이지 간 이동
```typescript
// 다음 페이지로 이동 시 nextFlowId로 연결
action: {
  label: '오늘 학습으로 이동',
  href: '/today',
}
// → router.push 후 새 페이지에서 nextFlowId 플로우 자동 시작
```

---

## 활용 가능한 기존 컴포넌트

1. **Tooltip.tsx** - 뷰포트 인식 위치 지정, 다양한 변형, 포털 렌더링
2. **Dialog.tsx** - 포커스 관리, 접근성, 포털 렌더링
3. **SlideOver.tsx** - 스택 가능한 슬라이드 패널 시스템
4. **ToastProvider.tsx** - 컨텍스트 기반 알림 패턴
5. **Framer Motion** - 애니메이션 라이브러리 (v12.23.25)

---

## 예상 소요 시간

**총 5-6일**

---

## 관련 문서

- [사용자 경험 Gap 분석](./2025-02-02-user-experience-gap-analysis.md)
- [온보딩 플로우 문서](./onboarding-flow.md)

---

**문서 버전**: 1.0
**최종 업데이트**: 2026-01-05
