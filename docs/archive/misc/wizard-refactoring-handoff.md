# Wizard 리팩토링 프로젝트 인수인계 문서

**작성일**: 2025년 11월 29일  
**작성자**: AI Assistant  
**목적**: 개발팀 인수인계를 위한 종합 가이드

---

## 📋 프로젝트 개요

### 목표
PlanGroupWizard의 **7단계 → 5단계 통합** 및 **DetailView 중복 제거**를 통해 코드 품질과 사용자 경험 향상

### 예상 효과
- 코드 라인: 7,500 → 4,500 (**40% 감소**)
- 중복 코드: 1,500 → 150 (**90% 제거**)
- Wizard 단계: 7 → 5 (**30% 감소**)
- 사용자 경험: 실시간 미리보기로 피드백 시간 단축

### 예상 작업 기간
- **총 작업 시간**: 4-5주 (1명 풀타임 기준)
- **복잡도**: 높음
- **우선순위**: Medium (현재 시스템 정상 작동 중)

---

## 📚 완료된 산출물

### 1. Phase 1: 분석 및 설계 문서

| 문서명 | 위치 | 내용 | 라인 수 |
|--------|------|------|---------|
| 상세 분석 | `docs/wizard-refactoring-analysis.md` | 현재 시스템 분석, 새 구조 설계, 로드맵 | 800+ |
| 다이어그램 | `docs/wizard-refactoring-diagrams.md` | 12개 Mermaid 다이어그램 | 400+ |
| 완료 보고서 | `docs/wizard-refactoring-phase1-summary.md` | Phase 1 요약 | 450+ |
| **소계** | | | **1,650+** |

### 2. Phase 2: 구현 가이드

| 문서명 | 위치 | 내용 | 라인 수 |
|--------|------|------|---------|
| 구현 노트 | `docs/wizard-phase2-implementation-note.md` | 상세 구현 가이드 | 350+ |
| 인수인계 | `docs/wizard-refactoring-handoff.md` | 본 문서 | 500+ |
| **소계** | | | **850+** |

### 3. 프로토타입 코드

| 파일명 | 위치 | 내용 |
|--------|------|------|
| TimeSettingsPanel | `app/(student)/plan/new-group/_components/_panels/TimeSettingsPanel.tsx` | 통합 wrapper |

### 총 산출물
- **문서**: 2,500+ 라인
- **다이어그램**: 12개
- **프로토타입 코드**: 1개 파일
- **Git 커밋**: 3개

---

## 🎯 구현 로드맵 (Phase 2-7)

### Phase 2: Step 2+3 통합 (4-5일) 🚧

**목표**: 시간 설정과 스케줄 미리보기를 실시간으로 통합

**구현 필요**:

1. **하위 패널 컴포넌트** (5개, 각 200-400 라인)
   - [ ] `ExclusionsPanel.tsx` - 제외일 관리 (380+ 라인 예상)
   - [ ] `AcademySchedulePanel.tsx` - 학원 일정 관리 (300+ 라인 예상)
   - [ ] `TimeConfigPanel.tsx` - 시간 설정 (250+ 라인 예상)
   - [ ] `NonStudyTimeBlocksPanel.tsx` - 학습 시간 제외 (200+ 라인 예상)
   - [ ] `SchedulePreviewPanel.tsx` - 스케줄 미리보기 (1,135 라인 → 리팩토링)

2. **메인 통합 컴포넌트**
   - [ ] `Step2TimeSettingsWithPreview.tsx` - 좌우 분할 레이아웃

3. **기능 구현**
   - [ ] 실시간 미리보기 로직 (debounce 500ms)
   - [ ] 스케줄 캐싱
   - [ ] 반응형 디자인 (모바일: 상하 배치)
   - [ ] Loading/Error 상태 관리

4. **통합 및 테스트**
   - [ ] PlanGroupWizard에 통합
   - [ ] 모든 모드 테스트 (템플릿, 캠프, 일반, 관리자)
   - [ ] 성능 테스트

**참고 파일**:
- 기존: `Step2BlocksAndExclusions.tsx` (1,330 라인)
- 기존: `Step2_5SchedulePreview.tsx` (1,135 라인)
- 프로토타입: `_panels/TimeSettingsPanel.tsx`
- 가이드: `docs/wizard-phase2-implementation-note.md`

**핵심 패턴**:
```typescript
// 실시간 미리보기
const debouncedCalculate = useMemo(
  () => debounce(async (params) => {
    const cached = scheduleCache.get(params);
    if (cached) return cached;
    
    const result = await calculateScheduleAvailability(params);
    scheduleCache.set(params, result);
    return result;
  }, 500),
  []
);

// 레이아웃
<div className="flex flex-col lg:flex-row gap-6">
  <div className="lg:w-[40%]">
    <TimeSettingsPanel />
  </div>
  <div className="lg:w-[60%] lg:sticky lg:top-4">
    <SchedulePreviewPanel />
  </div>
</div>
```

### Phase 3: Step 4+5 통합 (3-4일) ⏳

**목표**: 학생 콘텐츠와 추천 콘텐츠를 탭 UI로 통합

**구현 필요**:
- [ ] `Step3ContentsSelection.tsx` 생성
- [ ] 탭 UI 구현 (학생/추천)
- [ ] 9개 제한 로직 통합
- [ ] 진행률 표시 (8/9)
- [ ] 건너뛰기 로직 제거

**참고 파일**:
- 기존: `Step3Contents.tsx`
- 기존: `Step4RecommendedContents.tsx`

**레이아웃**:
```typescript
<Tabs defaultValue="student">
  <TabsList>
    <TabsTrigger value="student">학생 콘텐츠</TabsTrigger>
    <TabsTrigger value="recommended">추천 콘텐츠</TabsTrigger>
  </TabsList>
  <div className="mb-4">
    <ProgressIndicator completed={selectedCount} total={9} />
  </div>
  <TabsContent value="student">...</TabsContent>
  <TabsContent value="recommended">...</TabsContent>
</Tabs>
```

### Phase 4: Step 6 간소화 (2-3일) ⏳

**목표**: 최종 확인 단계를 접기/펼치기로 간소화

**구현 필요**:
- [ ] `Step4FinalReview.tsx` 리팩토링
- [ ] 섹션별 Collapsible 컴포넌트
- [ ] 수정 버튼 → 해당 Step 이동
- [ ] 요약 정보 추출 로직

**참고 파일**:
- 기존: `Step6FinalReview.tsx`

**패턴**:
```typescript
<Accordion type="multiple">
  <AccordionItem value="basic">
    <AccordionTrigger>기본 정보</AccordionTrigger>
    <AccordionContent>
      {/* 요약 정보 */}
      <Button onClick={() => goToStep(1)}>수정</Button>
    </AccordionContent>
  </AccordionItem>
  {/* 다른 섹션들 */}
</Accordion>
```

### Phase 5: DetailView 통합 (5-6일) ⏳

**목표**: mode prop 패턴으로 편집/읽기 모드 통합

**구현 필요**:
- [ ] 각 Step에 mode prop 추가
- [ ] readonly 모드 구현
- [ ] DetailView 파일 7개 제거
- [ ] 사용처 업데이트 (3개 페이지)

**영향 범위**:
- 플랜 그룹 상세 페이지
- 편집 페이지
- 캠프 제출 완료 페이지

**패턴**:
```typescript
interface StepViewProps {
  data: WizardData;
  mode: "edit" | "readonly";
  onUpdate?: (updates: Partial<WizardData>) => void;
}

function Step1View({ data, mode, onUpdate }: StepViewProps) {
  return (
    <div>
      {mode === "edit" ? (
        <input value={data.name} onChange={(e) => onUpdate?.({ name: e.target.value })} />
      ) : (
        <span>{data.name}</span>
      )}
    </div>
  );
}
```

### Phase 6: 테스트 (3-4일) ⏳

**테스트 항목**:
- [ ] 단위 테스트 (각 패널 컴포넌트)
- [ ] 통합 테스트 (Step 전체 흐름)
- [ ] 모드별 테스트
  - [ ] 템플릿 모드 (Step 1-2)
  - [ ] 캠프 모드 (Step 1-3)
  - [ ] 일반 모드 (Step 1-5)
  - [ ] 관리자 계속 모드 (Step 1-3 읽기, 4-5 편집)
- [ ] 반응형 테스트 (모바일, 태블릿, 데스크톱)
- [ ] 성능 테스트 (debounce, cache)
- [ ] 접근성 테스트 (키보드, 스크린리더)

### Phase 7: 배포 (2-3일) ⏳

**배포 절차**:
- [ ] Feature flag 설정
- [ ] Staged rollout (10% → 50% → 100%)
- [ ] 모니터링 설정
- [ ] 사용자 피드백 수집
- [ ] 버그 핫픽스
- [ ] 문서 업데이트

---

## 🛠 구현 가이드

### 1. 개발 환경 설정

```bash
# 브랜치 생성
git checkout -b feature/wizard-refactoring

# 의존성 확인
npm install  # 또는 pnpm install

# 개발 서버 실행
npm run dev
```

### 2. 파일 구조

```
app/(student)/plan/new-group/_components/
├── PlanGroupWizard.tsx (기존)
├── _panels/ (신규 - Phase 2)
│   ├── TimeSettingsPanel.tsx ✅ (생성됨)
│   ├── ExclusionsPanel.tsx ⏳
│   ├── AcademySchedulePanel.tsx ⏳
│   ├── TimeConfigPanel.tsx ⏳
│   ├── NonStudyTimeBlocksPanel.tsx ⏳
│   └── SchedulePreviewPanel.tsx ⏳
├── Step1BasicInfo.tsx (기존 → Phase 5에서 mode prop 추가)
├── Step2TimeSettingsWithPreview.tsx ⏳ (신규 - Phase 2)
├── Step3ContentsSelection.tsx ⏳ (신규 - Phase 3)
├── Step4FinalReview.tsx ⏳ (리팩토링 - Phase 4)
└── Step5Completion.tsx (기존 Step7 → 번호 변경)
```

### 3. 구현 순서

**권장**: 하나씩 완성하고 테스트하는 점진적 접근

```
Phase 2:
1. ExclusionsPanel 구현 → 테스트
2. AcademySchedulePanel 구현 → 테스트
3. TimeConfigPanel 구현 → 테스트
4. NonStudyTimeBlocksPanel 구현 → 테스트
5. SchedulePreviewPanel 리팩토링 → 테스트
6. Step2TimeSettingsWithPreview 통합 → 테스트
7. PlanGroupWizard 통합 → 전체 테스트

Phase 3-7:
각 Phase마다 위와 동일한 점진적 접근
```

### 4. 코딩 규칙

#### 컴포넌트 구조
```typescript
"use client";

import React from "react";
import { WizardData } from "../PlanGroupWizard";

type PanelProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  // ... 기타 props
};

/**
 * 패널 설명
 * - 주요 기능 1
 * - 주요 기능 2
 */
export const PanelName = React.memo(function PanelName({
  data,
  onUpdate,
  // ...
}: PanelProps) {
  // 로컬 상태 (UI 전용)
  const [localState, setLocalState] = useState();
  
  // 핸들러
  const handleChange = (value) => {
    onUpdate({ field: value });
  };
  
  return (
    <div className="flex flex-col gap-4">
      {/* 컴포넌트 내용 */}
    </div>
  );
});
```

#### 성능 최적화
- React.memo로 컴포넌트 래핑
- useMemo로 무거운 계산 캐싱
- useCallback로 핸들러 안정화
- Debounce로 빈번한 업데이트 제어

#### 에러 처리
- 사용자 친화적 메시지
- 재시도 버튼 제공
- 에러 상태에서도 UI 유지

#### 접근성
- 키보드 네비게이션 지원
- ARIA 속성 추가
- 포커스 관리

---

## 📊 성공 지표

### 정량적 지표

| 지표 | 현재 | 목표 | 측정 방법 |
|------|------|------|----------|
| 코드 라인 수 | 7,500 | 4,500 | `wc -l` |
| 중복 코드 | 1,500 | 150 | 중복 코드 분석 도구 |
| Wizard 단계 | 7 | 5 | UI 플로우 카운트 |
| 플랜 생성 시간 | 기준 | -20% | 사용자 테스트 |
| 렌더링 성능 | 기준 | 유지/개선 | React DevTools Profiler |
| 번들 크기 | 기준 | -10% | webpack-bundle-analyzer |

### 정성적 지표
- [ ] 사용자 피드백 긍정적 (4.0/5.0 이상)
- [ ] 버그 리포트 감소
- [ ] 개발자 만족도 향상
- [ ] 유지보수 시간 감소

---

## ⚠️ 주의사항

### 1. 하위 호환성
- 데이터베이스 스키마 변경 없음
- 기존 플랜 데이터 호환성 유지
- WizardData 타입 구조 유지

### 2. 점진적 배포
- Feature flag 사용
- 새 컴포넌트와 기존 컴포넌트 병행 운영 가능
- 문제 발생 시 즉시 롤백 가능

### 3. 테스트 커버리지
- 각 Phase 완료 후 충분한 테스트
- 회귀 테스트 필수
- 모든 모드 검증

### 4. 성능 모니터링
- 실시간 미리보기 성능 측정
- 메모리 누수 체크
- 번들 크기 지속 모니터링

---

## 🔄 롤백 계획

### 즉시 롤백 시나리오
- 심각한 버그 발견
- 성능 크게 저하
- 사용자 불만 급증

### 롤백 방법
1. Feature flag로 기존 버전 활성화
2. 긴급 핫픽스 배포
3. 문제 분석 및 수정
4. 재배포

---

## 📞 지원 및 문의

### 문서 위치
- 모든 문서: `docs/wizard-refactoring-*.md`
- 프로토타입: `app/(student)/plan/new-group/_components/_panels/`

### Git 이력
```bash
# Phase 1-2 커밋 확인
git log --oneline --grep="wizard"
```

### 질문/이슈
- 분석 문서를 먼저 확인
- 다이어그램으로 전체 흐름 파악
- Phase 2 구현 노트로 상세 가이드 확인

---

## 🎯 다음 단계

1. **팀 검토 미팅**
   - Phase 1 결과물 공유
   - Phase 2-7 일정 논의
   - 우선순위 결정

2. **리소스 배정**
   - 개발자 1명 풀타임 (4-5주)
   - 디자이너 0.2명 (UI 검토)
   - QA 0.3명 (테스트)

3. **킥오프**
   - 상세 계획 공유
   - Q&A 세션
   - 환경 준비

4. **구현 시작**
   - Phase 2부터 순차 진행
   - 주간 진행 상황 체크
   - 단계별 코드 리뷰

---

## 📝 결론

**Wizard 리팩토링 프로젝트**는 코드 품질, 사용자 경험, 유지보수성을 크게 향상시킬 **전략적 프로젝트**입니다.

### 현재까지 달성한 것
✅ 완전한 분석 및 설계 (2,500+ 라인 문서)  
✅ 명확한 구현 로드맵  
✅ 프로토타입 시작  
✅ 상세한 구현 가이드

### 남은 작업
⏳ Phase 2-7 구현 (4-5주)  
⏳ 테스트 및 배포  
⏳ 모니터링 및 피드백

이 문서를 기반으로 **자신감 있게 구현을 시작**할 수 있습니다. 모든 설계가 완료되었고, 각 Phase마다 상세한 가이드가 제공됩니다.

**성공을 기원합니다!** 🚀

---

**작성일**: 2025년 11월 29일  
**버전**: 1.0  
**상태**: 인수인계 준비 완료

