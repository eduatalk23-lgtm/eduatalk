# 관리자 플랜 생성 및 학생 배정 플로우 문서

> 작성일: 2026-01-02
> 상태: Phase 2 완료 (AI 플랜 생성 관리자 전용 구현)

## 목표
관리자가 플랜을 생성하고 학생에게 배정하는 UI/UX 및 기능 플로우 문서화

---

## 1. 전체 시스템 구조

### 1.1 플랜 배정 경로 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                     플랜 생성/배정 경로                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [관리자]                              [학생]                    │
│                                                                  │
│  ┌───────────────────┐                ┌───────────────────┐     │
│  │ 개별 학생 플랜 관리 │                │ 자기 플랜 생성     │     │
│  │ /admin/students/  │                │ /plan/new-group   │     │
│  │ [id]/plans        │                │ (7단계 위자드)     │     │
│  │                   │                │ 🔒 AI 생성 차단    │     │
│  │ · AddContentModal │                └───────────────────┘     │
│  │ · AddAdHocModal   │                                          │
│  │ · Drag-and-Drop   │                                          │
│  │ ✅ AI 생성 지원    │                                          │
│  └───────────────────┘                                          │
│           │                                                      │
│           ▼                                                      │
│  ┌───────────────────┐                ┌───────────────────┐     │
│  │ 캠프 일괄 배정     │                │ 플랜 목록 확인     │     │
│  │ /admin/camp-      │ ─────────────▶ │ /plan             │     │
│  │ templates/[id]/   │                │                   │     │
│  │ participants      │                │ · Plan Groups     │     │
│  │                   │                │ · 필터/검색        │     │
│  │ · BatchPlanWizard │                └───────────────────┘     │
│  │ ✅ AI 옵션 지원    │                                          │
│  └───────────────────┘                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 데이터 모델

```
Students (1) ───────┬────────────── Plan Groups (N)
                    │                    │
                    │                    ├── plan_contents (콘텐츠 선택)
                    │                    ├── plan_exclusions (제외일)
                    │                    ├── academy_schedules (학원 일정)
                    │                    └── student_plan (실행 플랜)
                    │
                    └── Camp Invitations (캠프 초대)
                              │
                              └── camp_template_id (캠프 설정)
```

---

## 2. 개별 학생 플랜 관리 (Admin)

### 2.1 진입점 및 플로우

```
Admin Dashboard
    │
    ▼
Student Detail (/admin/students/[id])
    │
    ▼
Plan Management Tab (/admin/students/[id]/plans?date=YYYY-MM-DD)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                  AdminPlanManagement                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ Header ─────────────────────────────────────────────┐  │
│  │ [Carryover] [Shortcuts] [← Date →] [Today]           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ PlanStatsCards ─────────────────────────────────────┐  │
│  │ 미완료: N개 │ 주간 완료율: X% │ 일평균 학습: Yh     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ UnfinishedDock ─────────────────────────────────────┐  │
│  │ [이전 미완료 플랜들] → Move to Daily/Weekly/Delete    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ WeeklyCalendar ─┐  ┌─ DailyDock ────────────────────┐  │
│  │ [  Calendar  ]   │  │ [+ 콘텐츠 추가] [+ 일회성 추가] │  │
│  │                  │  │ ────────────────────────────── │  │
│  └──────────────────┘  │ [Plan Item 1] [Complete][Edit] │  │
│                        │ [Plan Item 2] [Redistribute]   │  │
│  ┌─ WeeklyDock ─────┐  └────────────────────────────────┘  │
│  │ [주간 유동 플랜]  │                                      │
│  │ Drag-drop 가능   │                                      │
│  └──────────────────┘                                      │
│                                                              │
│  ┌─ SummaryDashboard + PlanHistoryViewer ───────────────┐  │
│  │ 진행 메트릭 │ 이벤트 로그                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 주요 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| AdminPlanManagement | `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx` | 메인 허브, 상태 관리 |
| AddContentModal | `_components/AddContentModal.tsx` | 콘텐츠/교재 기반 플랜 추가 |
| AddAdHocModal | `_components/AddAdHocModal.tsx` | 일회성 과제 추가 |
| RedistributeModal | `_components/RedistributeModal.tsx` | 볼륨 재분배 |
| DailyDock | `_components/DailyDock.tsx` | 일일 플랜 표시 |
| WeeklyDock | `_components/WeeklyDock.tsx` | 주간 유동 플랜 |
| UnfinishedDock | `_components/UnfinishedDock.tsx` | 미완료 플랜 관리 |

### 2.3 키보드 단축키

| 키 | 기능 |
|---|------|
| ← / → | 날짜 이동 |
| T | 오늘로 이동 |
| R | 새로고침 |
| N | 콘텐츠 추가 모달 |
| A | 일회성 플랜 추가 |
| Shift+? | 단축키 도움말 |

### 2.4 서버 액션

```
lib/domains/admin-plan/actions/
├── flexibleContent.ts    # flexible_contents CRUD
├── adHocPlan.ts          # ad_hoc_plans CRUD
├── containerOperations.ts # 컨테이너 간 이동
├── carryover.ts          # 미완료 플랜 이월
└── planEvents.ts         # 이벤트 로깅
```

---

## 3. 캠프 기반 일괄 배정 (Admin)

### 3.1 플로우

```
Camp Template Detail (/admin/camp-templates/[id])
    │
    ▼
Participants Tab
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                  CampParticipantsList                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ Toolbar ────────────────────────────────────────────┐  │
│  │ [검색] [필터] [☑ 전체선택] [일괄 설정 및 플랜 생성]   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ ParticipantsTable ──────────────────────────────────┐  │
│  │ ☐ 학생명 │ 상태 │ 초대일 │ 플랜 생성 여부 │ 액션    │  │
│  │ ☐ 김철수 │ 수락 │ 01/01 │ ✅ 생성됨      │ [보기]  │  │
│  │ ☐ 이영희 │ 대기 │ 01/02 │ ❌ 미생성      │ [생성]  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
    │
    ▼ [일괄 설정 및 플랜 생성] 클릭
    │
┌─────────────────────────────────────────────────────────────┐
│                  BatchPlanWizard (4단계)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 1: 콘텐츠 추천 설정                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 과목별 콘텐츠 개수 설정                                │  │
│  │ 국어: [2] 수학: [3] 영어: [2] 과학: [1]              │  │
│  │ ☐ 기존 콘텐츠 대체                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Step 2: 범위 조정                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 학생별 콘텐츠 범위 수동 조정                          │  │
│  │ 콘텐츠A: 시작 [1] ~ 끝 [100]                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Step 3: 플랜 미리보기                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ☑ 김철수 ☑ 이영희 ☐ 박민수                          │  │
│  │ [선택한 학생들의 플랜 생성]                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Step 4: 결과 확인                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ✅ 성공: 15명 │ ❌ 실패: 2명                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 주요 컴포넌트

| 컴포넌트 | 파일 |
|---------|------|
| CampParticipantsList | `app/(admin)/admin/camp-templates/[id]/participants/CampParticipantsList.tsx` |
| BatchPlanWizard | `_components/BatchPlanWizard.tsx` |
| ContentRecommendation | `_components/steps/ContentRecommendation.tsx` |
| RangeAdjustment | `_components/steps/RangeAdjustment.tsx` |

### 3.3 서버 액션

```
lib/domains/camp/actions/progress/bulk.ts
├── bulkCreatePlanGroupsForCamp()      # plan_groups 일괄 생성
├── bulkApplyRecommendedContents()     # 추천 콘텐츠 적용
├── bulkAdjustPlanRanges()             # 범위 일괄 조정
├── bulkGeneratePlans()                # student_plan 일괄 생성
└── batchUpdateCampPlanGroupStatus()   # 상태 일괄 업데이트
```

---

## 4. 학생 뷰 (배정받은 플랜 확인)

### 4.1 플로우

```
Student Dashboard (/dashboard)
    │
    ▼
Plan List (/plan)
    │
┌─────────────────────────────────────────────────────────────┐
│                     PlanGroupListContainer                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ 필터 ───────────────────────────────────────────────┐  │
│  │ 상태: [전체 ▼] 기간: [최근 1개월 ▼] 목적: [전체 ▼]  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Plan Group Card ────────────────────────────────────┐  │
│  │ 📚 겨울방학 학습 계획                                  │  │
│  │ 기간: 2025.01.06 ~ 2025.01.31                        │  │
│  │ 상태: 활성 │ 진행률: 45%                              │  │
│  │ [상세 보기]                                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [+ 새 플랜 만들기] ────────────────────────────────────────│
│                                                              │
└─────────────────────────────────────────────────────────────┘
    │
    ▼ [상세 보기] 클릭
    │
┌─────────────────────────────────────────────────────────────┐
│              Plan Group Detail (/plan/group/[id])            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ 뷰 전환 ────────────────────────────────────────────┐  │
│  │ [캘린더] [타임라인] [테이블] [리스트]                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ 플랜 목록 ──────────────────────────────────────────┐  │
│  │ 01/06 (월) ─────────────────────────────────         │  │
│  │   09:00 수학 p.1-20  [완료] [타이머]                 │  │
│  │   10:00 영어 1-2강   [진행중]                        │  │
│  │                                                       │  │
│  │ 01/07 (화) ─────────────────────────────────         │  │
│  │   09:00 수학 p.21-40 [대기]                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 주요 컴포넌트

| 컴포넌트 | 파일 |
|---------|------|
| PlanGroupListContainer | `app/(student)/plan/page.tsx` |
| PlanGroupDetailView | `app/(student)/plan/group/[id]/page.tsx` |
| ViewSwitcher | `components/plan/ViewSwitcher.tsx` |
| PlanListItem | `components/plan/PlanListItem.tsx` |

---

## 5. AI 플랜 생성 플로우

### 5.1 현재 상태 (2026-01-02 업데이트)

> ✅ **완료**: AI 플랜 생성 기능은 **컨설턴트/관리자 전용**
>
> Phase 2 완료: 관리자 인터페이스에 AI 플랜 생성 기능 추가

| 영역 | AI 지원 | 상태 | 비고 |
|------|---------|------|------|
| 학생 플랜 위자드 (Step 3) | ✅ 구현됨 | ✅ 차단됨 | `canUseAI` 조건으로 관리자만 접근 |
| 관리자 개별 학생 관리 | ✅ 구현됨 | ✅ 완료 | `AdminAIPlanModal` 컴포넌트 추가 |
| 관리자 캠프 일괄 배정 | ✅ 구현됨 | ✅ 완료 | `Step3PlanPreview` AI 모드 토글 추가 |

### 5.2 AI 플랜 생성 플로우 (관리자/컨설턴트 전용)

```
Plan Creation Wizard (/plan/new-group)
    │
    ▼
Step 3: Content Selection
    │
    ▼ [AI로 플랜 생성] 버튼 클릭 (관리자/컨설턴트만 표시)
    │
┌─────────────────────────────────────────────────────────────┐
│                  AIPlanGeneratorPanel                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Phase 1: Config (설정)                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 일일 학습 시간: [━━━━━○━━━━] 180분                    │  │
│  │ 제외 요일: [일][월][화][수][목][금][토]               │  │
│  │ ☑ 취약 과목 우선 배치                                 │  │
│  │ ☑ 복습 포함  복습 비율: [━━○━━━━━] 20%               │  │
│  │ 모델: [빠른생성] [표준] [정밀]                         │  │
│  │ 추가 지시사항: [                    ]                 │  │
│  │                              [생성 시작]              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Phase 2: Generating (스트리밍)                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━] 45%               │  │
│  │ ① ─ ② ─ ● ─ ○ ─ ○                                   │  │
│  │      AI 생성 중...                                    │  │
│  │ ┌─────────────────────────────────────────────────┐ │  │
│  │ │ {"weeklyMatrices":[{"weekNumber":1,...}]}       │ │  │
│  │ └─────────────────────────────────────────────────┘ │  │
│  │                              [취소]                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Phase 3: Preview (결과 미리보기)                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 총 플랜: 24개 │ 주차: 2주 │ 신뢰도: 95% │ $0.02     │  │
│  │                                                       │  │
│  │ 💡 학습 팁                                            │  │
│  │ · 수학은 오전 집중력이 높을 때 학습하세요            │  │
│  │                                                       │  │
│  │ ▼ 1주차 (01/06 ~ 01/12) - 12개 플랜                 │  │
│  │   수학 우선 배치, 복습 포함                           │  │
│  │                                                       │  │
│  │           [다시 생성] [적용]                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 AI 시스템 구성

```
UI Layer
├── AIModeButton.tsx          # 진입 버튼
├── AIPlanGeneratorPanel.tsx  # 메인 패널
├── StreamingProgress.tsx     # 실시간 진행 UI
└── PartialRegenerateModal.tsx # 부분 재생성

Hook Layer
├── useAIPlanGeneration.ts    # AI 상태 관리
└── useStreamingGeneration.ts # 스트리밍 처리

Server Action Layer
└── lib/domains/plan/llm/actions/
    ├── generatePlan.ts       # 비스트리밍
    ├── streamPlan.ts         # 스트리밍 (SSE)
    └── regeneratePartial.ts  # 부분 재생성

LLM Layer
└── lib/domains/plan/llm/
    ├── client.ts             # Anthropic API
    ├── prompts/              # 시스템/사용자 프롬프트
    ├── transformers/         # 요청/응답 변환
    └── types.ts              # 타입 정의
```

### 5.4 권한 체크 구현

`Step3ContentSelection.tsx`에서 다음과 같이 구현:

```typescript
import { useAuth } from "@/lib/contexts/AuthContext";
import { isAdminRole } from "@/lib/auth/isAdminRole";

// 컴포넌트 내부
const { user } = useAuth();
const canUseAI = isAdminRole(user?.role ?? null);

// AI 관련 UI는 canUseAI 조건으로 렌더링
{canUseAI && (
  <AIModeButton ... />
)}
```

---

## 6. 발견된 이슈 및 개선 기회

### 6.1 사용자가 언급한 문제점

| 문제 | 현재 상태 | 영향 |
|------|----------|------|
| **플랜 생성 복잡** | AddContentModal → flexible_contents만 생성, plan_group 직접 생성 불가 | 관리자가 학생 대신 완전한 플랜 그룹 생성 어려움 |
| **학생이 플랜 못 찾음** | /plan 페이지에서 필터/검색 있으나 진입점 분산 | 대시보드에서 바로 보이지 않을 수 있음 |
| **캠프/개별 분리** | 완전히 다른 두 경로 존재 | 관리자 혼란, 일관성 부족 |
| **AI 플랜 생성 위치** | ~~학생 위자드에 구현됨~~ ✅ 수정됨 | 관리자/컨설턴트 전용으로 제한 |

### 6.2 기술적 갭

| ID | 이슈 | 상세 |
|----|------|------|
| G1 | flexible_contents → student_plan 연결 불명확 | AddContentModal에서 생성된 flexible_contents가 어떻게 student_plan으로 변환되는지 불분명 |
| G2 | 관리자 plan_group 직접 생성 없음 | 학생 7단계 위자드만 존재, 관리자용 간소화 버전 없음 |
| G3 | 알림 시스템 부재 | 플랜 배정 시 학생에게 알림 없음 |
| G4 | activePlanGroupId 필수 | AddAdHocModal은 plan_group이 없으면 사용 불가 |

### 6.3 개선 기회 (우선순위)

| 우선순위 | 개선 항목 | 상태 |
|---------|----------|------|
| **CRITICAL** | 학생 AI 접근 차단 | ✅ 완료 |
| **CRITICAL** | 관리자 개별 학생 관리 AI 추가 | 🔜 예정 |
| **CRITICAL** | BatchPlanWizard AI 옵션 통합 | 🔜 예정 |
| HIGH | 학생 플랜 발견성 | 대시보드에 오늘 플랜 위젯 추가 |
| MEDIUM | 관리자 간소화 위자드 | 학생 대신 plan_group 생성하는 간소화 UI |
| MEDIUM | 플랜 알림 시스템 | 배정/변경 시 알림 발송 |
| LOW | 캠프/개별 통합 뷰 | 통합 플랜 관리 대시보드 |

---

## 7. 핵심 파일 참조

### 관리자 개별 학생 관리
```
app/(admin)/admin/students/[id]/plans/
├── page.tsx
└── _components/
    ├── AdminPlanManagement.tsx
    ├── AddContentModal.tsx
    ├── AddAdHocModal.tsx
    ├── DailyDock.tsx
    ├── WeeklyDock.tsx
    └── UnfinishedDock.tsx
```

### 캠프 일괄 배정
```
app/(admin)/admin/camp-templates/[id]/participants/
├── CampParticipantsList.tsx
└── _components/
    ├── BatchPlanWizard.tsx
    └── steps/
```

### 학생 플랜 뷰
```
app/(student)/plan/
├── page.tsx                    # 플랜 그룹 목록
├── group/[id]/page.tsx         # 플랜 그룹 상세
└── new-group/_components/      # 플랜 생성 위자드
    └── _features/ai-mode/      # AI 플랜 생성
```

### 서버 액션
```
lib/domains/
├── admin-plan/actions/         # 관리자 플랜 액션
├── plan/actions/plan-groups/   # 플랜 그룹 액션
├── plan/llm/                   # AI 플랜 생성
└── camp/actions/progress/      # 캠프 일괄 액션
```

---

## 8. 결론

### 현재 시스템 상태
- ✅ 학생 자가 플랜 생성: 완전 구현
- ✅ 학생 위자드 AI 접근 차단: **완료** (관리자/컨설턴트만 사용 가능)
- ✅ 캠프 일괄 배정: 구현됨 (AI 미포함)
- ⚠️ 관리자 개별 학생 관리: 부분 구현 (flexible_contents/ad_hoc만)
- 🔜 관리자/컨설턴트 AI 플랜 생성: 예정

### 완료된 개선 작업

#### Phase 1: 학생 AI 접근 차단 ✅
- [x] `Step3ContentSelection.tsx`에서 AI 관련 버튼/패널 권한 체크 추가
- [x] 학생 역할 확인 후 AI 기능 렌더링 조건부 처리
- 수정 파일: `app/(student)/plan/new-group/_components/_features/content-selection/Step3ContentSelection.tsx`

#### Phase 2: 관리자 AI 플랜 생성 추가 (예정)
- [ ] 개별 학생 관리 (`/admin/students/[id]/plans`)에 AI 플랜 생성 버튼 추가
- [ ] `BatchPlanWizard`에 AI 옵션 통합
- [ ] 기존 AI 컴포넌트 재사용 (AIPlanGeneratorPanel, StreamingProgress 등)

### 권장 다음 단계
1. **관리자 개별 학생 관리에 AI 추가** - AdminPlanManagement에 AI 버튼 통합
2. **BatchPlanWizard AI 옵션** - 캠프 일괄 배정에 AI 생성 옵션 추가
3. **학생 플랜 발견성 개선** - 대시보드에 오늘 플랜 위젯
4. **알림 시스템** - 플랜 배정 시 알림

---

*최종 업데이트: 2026-01-02*
