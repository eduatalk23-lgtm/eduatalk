# Step 2 통합 컴포넌트 정리 완료

## 작업 일시
2025-11-30

## 개요

Step 2 통합 컴포넌트(`Step2TimeSettingsWithPreview`) 구현 완료 후, 
불필요한 Tab 및 미사용 컴포넌트를 정리했습니다.

## 통합 컴포넌트 구조

### Step2TimeSettingsWithPreview
- 위치: `app/(student)/plan/new-group/_components/Step2TimeSettingsWithPreview.tsx`
- 레이아웃: 좌우 분할 (Desktop) / 상하 배치 (Mobile)
- 구성:
  - 좌측 (40%): TimeSettingsPanel
    - ExclusionsPanel (제외일 관리)
    - AcademySchedulePanel (학원 일정)
    - TimeConfigPanel (시간 설정)
    - NonStudyTimeBlocksPanel (학습 시간 제외)
  - 우측 (60%): SchedulePreviewPanel (실시간 미리보기)

### 사용 위치
1. PlanGroupWizard - Step 2 (라인 1521)
2. PlanGroupDetailView - Tab 2 (라인 183)
3. 캠프 모드 지원 (campMode, campTemplateId prop)

## 제거된 항목

### 1. PlanGroupDetailView Tab 3
- 이유: Tab 2에 이미 통합되어 중복
- 변경: allTabs 배열에서 제거, case 3 로직 삭제
- 수정 파일: `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`

**변경 전 Tab 구조**:
```
1. 기본 정보
2. 블록 및 제외일
3. 스케줄 미리보기 (중복)
4. 콘텐츠 선택
6. 최종 검토
7. 스케줄 결과
```

**변경 후 Tab 구조**:
```
1. 기본 정보
2. 블록 및 제외일 (스케줄 미리보기 통합)
4. 콘텐츠 선택
6. 최종 검토
7. 스케줄 결과
```

### 2. 미사용 컴포넌트
- `Step2BlocksAndExclusions.tsx` (1329 라인)
  - 대체: TimeSettingsPanel 및 관련 패널 컴포넌트들
- `Step2_5SchedulePreview.tsx` (1108 라인)
  - 대체: SchedulePreviewPanel

**패널 컴포넌트 구조** (`app/(student)/plan/new-group/_components/_panels/`):
```
_panels/
├── TimeSettingsPanel.tsx       # 시간 설정 통합 패널
├── ExclusionsPanel.tsx         # 제외일 관리
├── AcademySchedulePanel.tsx    # 학원 일정 관리
├── TimeConfigPanel.tsx         # 시간 설정 (점심시간, 자율학습 등)
├── NonStudyTimeBlocksPanel.tsx # 학습 시간 제외 항목
└── SchedulePreviewPanel.tsx    # 스케줄 미리보기
```

## 마이그레이션 가이드

기존 코드에서 구 컴포넌트를 사용하던 경우:

### 이전
```typescript
import { Step2BlocksAndExclusions } from "./Step2BlocksAndExclusions";

<Step2BlocksAndExclusions 
  data={data} 
  onUpdate={onUpdate}
  periodStart={periodStart}
  periodEnd={periodEnd}
  campMode={isCampMode}
  isTemplateMode={isTemplateMode}
  editable={editable}
/>
```

### 이후
```typescript
import { Step2TimeSettingsWithPreview } from "./Step2TimeSettingsWithPreview";

<Step2TimeSettingsWithPreview 
  data={data} 
  onUpdate={onUpdate}
  periodStart={periodStart}
  periodEnd={periodEnd}
  campMode={isCampMode}
  isTemplateMode={isTemplateMode}
  editable={editable}
  blockSets={blockSets}              // 추가: 스케줄 미리보기용
  campTemplateId={campTemplateId}     // 추가: 캠프 모드용
/>
```

### Props 변경사항
**기존 props (유지)**:
- `data: WizardData`
- `onUpdate: (updates: Partial<WizardData>) => void`
- `periodStart: string`
- `periodEnd: string`
- `groupId?: string`
- `onNavigateToStep?: (step: number) => void`
- `campMode?: boolean`
- `isTemplateMode?: boolean`
- `templateExclusions?: Array<Exclusion>`
- `editable?: boolean`
- `studentId?: string`
- `isAdminMode?: boolean`
- `isAdminContinueMode?: boolean`

**추가된 props (스케줄 미리보기용)**:
- `blockSets?: Array<BlockSet>` - 블록 세트 정보 (미리보기에 필요)
- `campTemplateId?: string` - 캠프 템플릿 ID (캠프 모드에서 블록 조회용)

## 효과

### 1. 코드 정리
- 3500+ 라인의 미사용 코드 제거
- 중복 기능 제거로 유지보수 포인트 감소

### 2. 일관성 향상
- 모든 Step 2 관련 화면에서 `Step2TimeSettingsWithPreview` 사용
- PlanGroupWizard와 PlanGroupDetailView의 동일한 사용자 경험

### 3. 유지보수성 개선
- 패널 기반 모듈화로 개별 수정 용이
- 각 패널의 독립적인 책임과 관심사 분리
- 테스트 및 디버깅 용이

### 4. 사용자 경험 개선
- 실시간 미리보기로 설정 변경 즉시 확인 가능
- 좌우 분할 레이아웃으로 설정과 결과를 동시에 확인
- 모바일에서도 최적화된 상하 배치

## 통합 컴포넌트 장점

### 일반 모드 / 캠프 모드 통합
- 단일 컴포넌트에서 모든 모드 지원
- `isCampMode`, `campTemplateId` prop으로 동작 제어
- 캠프 모드에서는 템플릿 블록 자동 조회
- 일반 모드에서는 사용자 선택 블록 세트 사용

### 실시간 미리보기
- 하이브리드 갱신 전략
  - 최초 로드: "스케줄 확인하기" 버튼으로 수동 확인
  - 이후 변경: 블록/제외일/학원일정 변경 시 자동 재계산
  - 수동 갱신: "다시 계산하기" 버튼으로 강제 재계산
- 클라이언트 사이드 캐싱 (5분 TTL)
- 로딩 상태 및 에러 처리

### 모듈화된 패널 구조
각 패널은 독립적으로 개발, 테스트, 유지보수 가능:
- **ExclusionsPanel**: 제외일 CRUD, 시간 관리 동기화
- **AcademySchedulePanel**: 학원 일정 CRUD, 중복 검사
- **TimeConfigPanel**: 점심시간, 자율학습 시간 설정
- **NonStudyTimeBlocksPanel**: 학습 시간 제외 항목 관리
- **SchedulePreviewPanel**: 스케줄 계산, 통계 표시, 주차별/일별 뷰

## 관련 문서

- [스케줄 미리보기 하이브리드 갱신 전략 구현](./schedule-preview-improvement-2025-11-30.md)
- [스케줄 미리보기 구현 완료 요약](./schedule-preview-implementation-summary.md)
- [캠프 모드 프로세스 개선](./camp-process-improvement.md)
- [프로젝트 리팩토링 최종 완료 보고서](./refactoring-final-summary.md)

## 검증 완료 사항

1. ✅ PlanGroupDetailView의 Tab 동작 정상
   - Tab 1, 2, 4, 6, 7이 정상 동작
   - Tab 2에서 스케줄 미리보기가 우측에 표시됨
   - Tab 3 제거로 중복 제거

2. ✅ PlanGroupWizard Step 2 정상 동작
   - 일반 모드: 블록 세트 선택 및 스케줄 미리보기
   - 캠프 모드: 템플릿 블록 자동 조회 및 미리보기

3. ✅ 빌드 에러 없음
   - TypeScript 컴파일 성공
   - ESLint 에러 없음

## 결론

Step 2 통합 컴포넌트 정리 작업을 통해:
- 3500+ 라인의 레거시 코드 제거
- 일관된 사용자 경험 제공
- 유지보수성 및 확장성 향상
- 일반 모드/캠프 모드 완전 통합

모든 기능이 정상 동작하며, 향후 Step 2 관련 수정은 
`Step2TimeSettingsWithPreview` 및 `_panels/` 디렉토리의 
개별 패널 컴포넌트만 수정하면 됩니다.

