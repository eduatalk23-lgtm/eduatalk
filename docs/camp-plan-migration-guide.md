# 캠프 및 플랜 최적화 마이그레이션 가이드

## 개요

이 문서는 기존 카드 컴포넌트를 새로운 통합 컴포넌트로 마이그레이션하는 방법을 안내합니다.

## 마이그레이션 전략

### 점진적 마이그레이션
새 컴포넌트는 `*New.tsx` 파일명으로 생성되어 기존 코드와 병행하여 사용할 수 있습니다.
충분한 테스트 후 기존 컴포넌트를 교체하세요.

## 컴포넌트별 마이그레이션

### 1. PlanGroupListItem → PlanGroupListItemNew

#### Before
```tsx
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";

// 많은 중복 코드와 인라인 스타일
<li className="rounded-xl border ...">
  <div className="flex flex-col gap-3">
    <Badge variant="info" size="sm">플랜 생성 완료</Badge>
    <h3>{group.name}</h3>
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
      <ProgressBar value={percentage} />
    </div>
  </div>
</li>
```

#### After
```tsx
import { PlanGroupCard, StatusBadge } from "../_shared";

<PlanGroupCard
  title={group.name}
  status={group.status}
  badges={[{ label: "플랜 생성 완료", variant: "info" }]}
  progress={{ completed, total }}
  metadata={[
    { label: "목적", value: planPurpose },
    { label: "기간", value: period }
  ]}
  actions={actionButtons}
/>
```

#### 변경 사항
- 코드 라인 수: 385줄 → 280줄 (27% 감소)
- 중복 로직 제거
- 일관된 디자인 자동 적용

### 2. CampInvitationCard → CampInvitationCardNew

#### Before
```tsx
// 복잡한 상태 판단 로직
{(() => {
  const status = invitation.planGroupStatus;
  if (invitation.status === "pending" && status === "draft") {
    return <span className="bg-yellow-100 ...">작성 중</span>;
  }
  // ... 많은 조건문
})()}
```

#### After
```tsx
import { CampCard, StepProgress } from "../../plan/_shared";

<CampCard
  title={template.name}
  badges={badges}
  metadata={metadata}
  actions={<CampInvitationActions />}
>
  <StepProgress steps={steps} />
</CampCard>
```

#### 변경 사항
- 진행 단계 시각화 추가 (StepProgress)
- 상태 로직 단순화
- 일관된 뱃지 표시

### 3. TemplateCard → TemplateCardNew

#### Before
```tsx
<div className="group relative rounded-lg border ...">
  <Link href={...}>
    {currentStatus === "draft" && (
      <span className="bg-gray-100 text-gray-800 ...">초안</span>
    )}
    {currentStatus === "active" && (
      <span className="bg-green-100 text-green-800 ...">활성</span>
    )}
    // ... 반복적인 코드
  </Link>
</div>
```

#### After
```tsx
import { TemplateCard } from "@/app/(student)/plan/_shared";

<TemplateCard
  title={template.name}
  subtitle={template.program_type}
  description={template.description}
  href={`/admin/camp-templates/${template.id}`}
  status={currentStatus}
  createdAt={template.created_at}
  actions={statusActions}
/>
```

#### 변경 사항
- 상태 뱃지 자동 처리
- 액션 버튼 그룹화
- 일관된 호버 효과

### 4. FilterBar 마이그레이션

#### Before
```tsx
// 각 페이지마다 중복된 필터 로직
<form className="...">
  <select name="planPurpose" ...>
    <option value="">전체</option>
    <option value="내신대비">내신대비</option>
    // ...
  </select>
  <div className="flex gap-2">
    <Link href="?sortOrder=desc" className={...}>최신순</Link>
    <Link href="?sortOrder=asc" className={...}>오래된순</Link>
  </div>
</form>
```

#### After
```tsx
import { FilterBar, planPurposeFilter, sortOrderFilter } from "../_shared";

<FilterBar
  filters={[planPurposeFilter, sortOrderFilter]}
  basePath="/plan"
/>
```

#### 변경 사항
- Preset 필터 재사용
- 코드 중복 제거
- 쉬운 확장성

## 새로운 기능 활용

### 1. 캠프 진행 상태 시각화

```tsx
import { CampFlowIndicator } from "@/app/(student)/camp/_components/CampFlowIndicator";

// 상세 페이지에서
<CampFlowIndicator
  currentStep="review"
  invitation={invitation}
/>

// 카드에서 (컴팩트)
import { CampFlowCompact } from "@/app/(student)/camp/_components/CampFlowIndicator";

<CampFlowCompact invitation={invitation} />
```

### 2. Step Progress

```tsx
import { StepProgress } from "@/app/(student)/plan/_shared";

const steps = [
  { label: "① 참여 정보 제출", isActive: false, isCompleted: true },
  { label: "② 플랜 생성", isActive: true, isCompleted: false },
  { label: "③ 학습 시작", isActive: false, isCompleted: false },
];

<StepProgress steps={steps} />
```

## 성능 최적화

모든 새 컴포넌트는 React.memo로 최적화되어 있습니다:

```tsx
// 자동으로 불필요한 리렌더링 방지
<StatusBadge variant="active">활성</StatusBadge>
<ProgressIndicator completed={5} total={10} />
<PlanCard title="..." />
```

## 마이그레이션 체크리스트

### Phase 1: 준비
- [ ] 새 공통 컴포넌트 파일 확인
- [ ] 기존 컴포넌트 백업
- [ ] 타입 정의 확인

### Phase 2: 테스트
- [ ] 개발 환경에서 New 컴포넌트 테스트
- [ ] 기존 기능 동일성 확인
- [ ] 반응형 동작 확인
- [ ] 성능 측정

### Phase 3: 배포
- [ ] Staged rollout (10% → 50% → 100%)
- [ ] 모니터링
- [ ] 롤백 계획 준비

### Phase 4: 정리
- [ ] 기존 컴포넌트 제거
- [ ] New.tsx 파일명 변경
- [ ] 미사용 import 정리
- [ ] 문서 업데이트

## 롤백 계획

문제 발생 시 즉시 롤백 가능:

1. `*New.tsx` 파일을 사용하는 import 제거
2. 기존 컴포넌트 import로 복원
3. 배포

```tsx
// 롤백 예시
// import { CampInvitationCard } from "./_components/CampInvitationCardNew"; // 새 버전
import { CampInvitationCard } from "./_components/CampInvitationCard"; // 기존 버전
```

## 문제 해결

### Q1: 기존 스타일이 깨짐
**A**: PlanCard의 className prop으로 추가 스타일 적용 가능

```tsx
<PlanCard className="your-custom-class" ... />
```

### Q2: 특정 기능이 없음
**A**: children prop으로 커스텀 콘텐츠 추가

```tsx
<PlanCard ...>
  <YourCustomComponent />
</PlanCard>
```

### Q3: 성능 이슈
**A**: 모든 컴포넌트는 React.memo 적용됨. props가 자주 변경되지 않는지 확인

```tsx
// Bad: 매번 새 객체 생성
<PlanCard badges={[{ label: "test", variant: "info" }]} />

// Good: 객체 재사용
const badges = useMemo(() => [{ label: "test", variant: "info" }], []);
<PlanCard badges={badges} />
```

## 추가 리소스

- [작업 기록](./camp-plan-optimization.md)
- [공통 컴포넌트 API](../app/(student)/plan/_shared/README.md)
- [디자인 시스템](../DESIGN_SYSTEM.md)

## 지원

질문이나 문제가 있으면 개발팀에 문의하세요.

