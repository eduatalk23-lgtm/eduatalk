# Wizard 리팩토링 다이어그램

**작성일**: 2025년 11월 29일  
**목적**: 컴포넌트 구조 및 데이터 흐름 시각화

---

## 1. 컴포넌트 구조 비교

### 1.1 기존 7단계 구조

```mermaid
graph TB
    Start[사용자 시작] --> Wizard[PlanGroupWizard]
    
    Wizard --> Step1[Step 1: BasicInfo<br/>기본 정보 입력]
    Wizard --> Step2[Step 2: BlocksAndExclusions<br/>블록 및 제외일]
    Wizard --> Step3[Step 3: SchedulePreview<br/>스케줄 확인]
    Wizard --> Step4[Step 4: Contents<br/>콘텐츠 선택]
    Wizard --> Step5[Step 5: RecommendedContents<br/>추천 콘텐츠]
    Wizard --> Step6[Step 6: FinalReview<br/>최종 확인]
    Wizard --> Step7[Step 7: ScheduleResult<br/>완료]
    
    Step1 --> Nav1{다음}
    Nav1 --> Step2
    Step2 --> Nav2{다음}
    Nav2 --> Step3
    Step3 --> Nav3{다음}
    Nav3 --> Step4
    Step4 --> Nav4{다음}
    Nav4 --> Cond1{콘텐츠 9개?}
    Cond1 -->|예| Step6
    Cond1 -->|아니오| Step5
    Step5 --> Nav5{다음}
    Nav5 --> Step6
    Step6 --> Submit[제출]
    Submit --> Step7
    Step7 --> End[완료]
    
    style Step1 fill:#e3f2fd
    style Step2 fill:#e3f2fd
    style Step3 fill:#fff3e0
    style Step4 fill:#e8f5e9
    style Step5 fill:#f3e5f5
    style Step6 fill:#fce4ec
    style Step7 fill:#e0f2f1
```

### 1.2 새로운 5단계 구조

```mermaid
graph TB
    Start[사용자 시작] --> Wizard[PlanGroupWizard]
    
    Wizard --> NewStep1[Step 1: BasicInfo<br/>기본 정보 입력]
    Wizard --> NewStep2[Step 2: TimeSettingsWithPreview<br/>시간 설정 + 실시간 미리보기]
    Wizard --> NewStep3[Step 3: ContentsSelection<br/>콘텐츠 선택 통합 탭]
    Wizard --> NewStep4[Step 4: FinalReview<br/>최종 확인 간소화]
    Wizard --> NewStep5[Step 5: Completion<br/>완료]
    
    NewStep1 --> Nav1{다음}
    Nav1 --> NewStep2
    NewStep2 --> Nav2{다음}
    Nav2 --> NewStep3
    NewStep3 --> Nav3{다음}
    Nav3 --> NewStep4
    NewStep4 --> Submit[제출]
    Submit --> NewStep5
    NewStep5 --> End[완료]
    
    style NewStep1 fill:#e3f2fd
    style NewStep2 fill:#fff8e1
    style NewStep3 fill:#e8f5e9
    style NewStep4 fill:#fce4ec
    style NewStep5 fill:#e0f2f1
```

### 1.3 컴포넌트 계층 구조

```mermaid
graph TD
    PlanGroupWizard[PlanGroupWizard<br/>상태 관리 & 네비게이션]
    
    PlanGroupWizard --> Step1[Step1BasicInfoView]
    PlanGroupWizard --> Step2[Step2TimeSettingsView]
    PlanGroupWizard --> Step3[Step3ContentsView]
    PlanGroupWizard --> Step4[Step4FinalReviewView]
    PlanGroupWizard --> Step5[Step5CompletionView]
    
    Step1 --> BlockSetManager[BlockSetManager<br/>블록 세트 관리]
    Step1 --> DateRangePicker[DateRangePicker<br/>기간 선택]
    
    Step2 --> TimeSettingsPanel[TimeSettingsPanel<br/>시간 설정 입력]
    Step2 --> SchedulePreviewPanel[SchedulePreviewPanel<br/>실시간 미리보기]
    
    TimeSettingsPanel --> ExclusionsPanel[ExclusionsPanel<br/>제외일 관리]
    TimeSettingsPanel --> AcademyPanel[AcademyPanel<br/>학원 일정 관리]
    TimeSettingsPanel --> TimeConfigPanel[TimeConfigPanel<br/>시간 설정]
    
    SchedulePreviewPanel --> SummaryStats[SummaryStats<br/>요약 통계]
    SchedulePreviewPanel --> WeeklySchedule[WeeklySchedule<br/>주차별 스케줄]
    SchedulePreviewPanel --> DailySchedule[DailySchedule<br/>일별 스케줄]
    
    Step3 --> TabPanel[TabPanel<br/>탭 전환]
    TabPanel --> StudentContents[StudentContentsTab<br/>학생 콘텐츠]
    TabPanel --> RecommendedContents[RecommendedContentsTab<br/>추천 콘텐츠]
    
    Step4 --> CollapsibleSections[CollapsibleSections<br/>접기/펼치기 섹션]
    CollapsibleSections --> BasicInfoSection[BasicInfoSection]
    CollapsibleSections --> TimeSettingsSection[TimeSettingsSection]
    CollapsibleSections --> ContentsSection[ContentsSection]
    
    Step5 --> CompletionMessage[CompletionMessage<br/>완료 메시지]
    Step5 --> NextActions[NextActions<br/>다음 액션]
    
    style PlanGroupWizard fill:#e8eaf6
    style Step1 fill:#e3f2fd
    style Step2 fill:#fff8e1
    style Step3 fill:#e8f5e9
    style Step4 fill:#fce4ec
    style Step5 fill:#e0f2f1
```

---

## 2. 데이터 흐름 다이어그램

### 2.1 Wizard 데이터 흐름 (전체)

```mermaid
sequenceDiagram
    participant User as 사용자
    participant Wizard as PlanGroupWizard
    participant Step as Step Component
    participant Cache as Cache (Memory)
    participant Server as Server Actions
    participant DB as Supabase DB
    
    User->>Wizard: 플랜 생성 시작
    Wizard->>DB: initialData 로드
    DB-->>Wizard: 기존 데이터 (편집 모드)
    Wizard->>Wizard: setState(wizardData)
    
    loop 각 Step
        Wizard->>Step: wizardData, onUpdate
        User->>Step: 입력 변경
        Step->>Wizard: onUpdate(partialData)
        Wizard->>Wizard: setState(merge)
        Wizard->>Wizard: debounce(autoSave, 2s)
        Wizard->>Server: saveDraftAction
        Server->>DB: 임시 저장
    end
    
    User->>Wizard: 제출
    Wizard->>Wizard: validateAllSteps()
    Wizard->>Server: createPlanGroupAction
    Server->>DB: 플랜 그룹 생성
    Server->>Server: generatePlans()
    Server->>DB: 개별 플랜 저장
    DB-->>Server: 성공
    Server-->>Wizard: 완료
    Wizard->>Step: Step 5 (완료)
```

### 2.2 Step 2 실시간 미리보기 흐름

```mermaid
sequenceDiagram
    participant User as 사용자
    participant Panel as TimeSettingsPanel
    participant Preview as SchedulePreviewPanel
    participant Cache as scheduleCache
    participant Server as calculateScheduleAvailability
    participant DB as Supabase DB
    
    User->>Panel: 제외일 추가
    Panel->>Preview: onChange(wizardData)
    Preview->>Preview: debounce(500ms)
    Preview->>Cache: get(params)
    
    alt 캐시 히트
        Cache-->>Preview: cachedResult
        Preview->>Preview: setResult(cachedResult)
    else 캐시 미스
        Preview->>Server: calculateScheduleAvailability(params)
        Server->>DB: 블록 세트 조회
        Server->>Server: 스케줄 계산 로직
        Server-->>Preview: result
        Preview->>Cache: set(params, result)
        Preview->>Preview: setResult(result)
    end
    
    Preview->>Preview: render(result)
    User->>Preview: 스케줄 확인
```

### 2.3 Step 3 콘텐츠 선택 흐름

```mermaid
sequenceDiagram
    participant User as 사용자
    participant TabPanel as TabPanel
    participant StudentTab as StudentContentsTab
    participant RecommendedTab as RecommendedContentsTab
    participant Wizard as PlanGroupWizard
    
    User->>TabPanel: "학생 콘텐츠" 탭 선택
    TabPanel->>StudentTab: render
    StudentTab->>StudentTab: 콘텐츠 목록 표시
    
    User->>StudentTab: 콘텐츠 선택 (클릭)
    StudentTab->>Wizard: onUpdate({ student_contents: [...] })
    Wizard->>Wizard: 선택 개수 확인 (8/9)
    
    User->>TabPanel: "추천 콘텐츠" 탭 선택
    TabPanel->>RecommendedTab: render
    RecommendedTab->>RecommendedTab: AI 추천 콘텐츠 표시
    
    User->>RecommendedTab: 추천 콘텐츠 선택
    RecommendedTab->>Wizard: onUpdate({ recommended_contents: [...] })
    Wizard->>Wizard: 총 선택 개수 확인 (9/9)
    Wizard->>Wizard: 9개 도달 → 추가 선택 비활성화
```

### 2.4 모드별 흐름 차이

```mermaid
graph TB
    Start[Wizard 시작] --> ModeCheck{모드 확인}
    
    ModeCheck -->|템플릿 모드| Template[Step 1-2만]
    ModeCheck -->|캠프 모드| Camp[Step 1-3만]
    ModeCheck -->|일반 모드| Normal[Step 1-5 전체]
    ModeCheck -->|관리자 계속| AdminContinue[Step 1-3 읽기<br/>Step 4-5 편집]
    
    Template --> TS1[Step 1: 기본 정보]
    Template --> TS2[Step 2: 시간 설정 + 미리보기]
    TS2 --> TSubmit[템플릿 저장]
    TSubmit --> TEnd[완료]
    
    Camp --> CS1[Step 1: 기본 정보]
    Camp --> CS2[Step 2: 시간 설정 + 미리보기]
    Camp --> CS3[Step 3: 콘텐츠 선택]
    CS3 --> CSubmit[학생 제출]
    CSubmit --> CEnd[관리자 검토 대기]
    
    Normal --> NS1[Step 1: 기본 정보]
    Normal --> NS2[Step 2: 시간 설정 + 미리보기]
    Normal --> NS3[Step 3: 콘텐츠 선택]
    Normal --> NS4[Step 4: 최종 확인]
    Normal --> NS5[Step 5: 완료]
    NS4 --> NSubmit[플랜 생성]
    NSubmit --> NS5
    NS5 --> NEnd[완료]
    
    AdminContinue --> AS1[Step 1: 기본 정보 읽기]
    AdminContinue --> AS2[Step 2: 시간 설정 읽기]
    AdminContinue --> AS3[Step 3: 콘텐츠 읽기]
    AdminContinue --> AS4[Step 4: 최종 확인 편집]
    AdminContinue --> AS5[Step 5: 플랜 생성]
    AS4 --> ASubmit[관리자 제출]
    ASubmit --> AS5
    AS5 --> AEnd[캠프 플랜 완료]
    
    style Template fill:#e3f2fd
    style Camp fill:#fff8e1
    style Normal fill:#e8f5e9
    style AdminContinue fill:#fce4ec
```

---

## 3. 상태 관리 구조

### 3.1 WizardData 상태 구조

```mermaid
graph TD
    WizardData[WizardData State]
    
    WizardData --> BasicInfo[Step 1: 기본 정보]
    WizardData --> TimeSettings[Step 2: 시간 설정]
    WizardData --> Schedule[Step 2: 스케줄 결과]
    WizardData --> Contents[Step 3: 콘텐츠]
    WizardData --> Template[템플릿 설정]
    
    BasicInfo --> name[name: string]
    BasicInfo --> purpose[plan_purpose: enum]
    BasicInfo --> period[period_start/end: string]
    BasicInfo --> blockSet[block_set_id: string]
    BasicInfo --> scheduler[scheduler_type: enum]
    
    TimeSettings --> exclusions[exclusions: array]
    TimeSettings --> academy[academy_schedules: array]
    TimeSettings --> timeConfig[time_settings: object]
    TimeSettings --> nonStudy[non_study_time_blocks: array]
    
    Schedule --> summary[schedule_summary: object]
    Schedule --> daily[daily_schedule: array]
    
    Contents --> student[student_contents: array]
    Contents --> recommended[recommended_contents: array]
    
    Template --> locked[templateLockedFields: object]
    
    style WizardData fill:#e8eaf6
    style BasicInfo fill:#e3f2fd
    style TimeSettings fill:#fff8e1
    style Schedule fill:#fff8e1
    style Contents fill:#e8f5e9
    style Template fill:#fce4ec
```

### 3.2 검증 흐름

```mermaid
graph TB
    UserAction[사용자 입력] --> OnChange[onChange 이벤트]
    OnChange --> OnUpdate[onUpdate callback]
    OnUpdate --> WizardState[WizardData 업데이트]
    
    WizardState --> LiveValidate{실시간 검증}
    LiveValidate -->|통과| EnableNext[다음 버튼 활성화]
    LiveValidate -->|실패| ShowError[에러 메시지 표시]
    
    UserAction --> ClickNext[다음 버튼 클릭]
    ClickNext --> ValidateStep[validateStep 호출]
    ValidateStep --> CheckRequired{필수 필드 확인}
    
    CheckRequired -->|모두 입력됨| CheckFormat{형식 검증}
    CheckRequired -->|누락| ShowRequiredError[필수 항목 에러]
    
    CheckFormat -->|올바름| CheckLogic{비즈니스 로직 검증}
    CheckFormat -->|잘못됨| ShowFormatError[형식 에러]
    
    CheckLogic -->|통과| NextStep[다음 단계 이동]
    CheckLogic -->|실패| ShowLogicError[로직 에러]
    
    style EnableNext fill:#c8e6c9
    style ShowError fill:#ffcdd2
    style ShowRequiredError fill:#ffcdd2
    style ShowFormatError fill:#ffcdd2
    style ShowLogicError fill:#ffcdd2
    style NextStep fill:#c8e6c9
```

---

## 4. DetailView 통합 구조

### 4.1 mode prop 패턴

```mermaid
graph TD
    StepView[StepView Component]
    
    StepView --> ModeCheck{mode prop}
    
    ModeCheck -->|edit| EditMode[편집 모드]
    ModeCheck -->|readonly| ReadonlyMode[읽기 모드]
    
    EditMode --> InputFields[Input/Select 필드]
    EditMode --> OnChange[onChange 핸들러]
    EditMode --> UpdateState[상태 업데이트]
    
    ReadonlyMode --> TextDisplay[텍스트 표시]
    ReadonlyMode --> NoHandler[핸들러 없음]
    ReadonlyMode --> StaticData[정적 데이터]
    
    style EditMode fill:#e3f2fd
    style ReadonlyMode fill:#fff3e0
```

### 4.2 통합 전후 비교

```mermaid
graph LR
    subgraph 기존 구조 7개 파일
        Old1[Step1BasicInfo.tsx<br/>편집 전용]
        Old2[Step1DetailView.tsx<br/>읽기 전용]
        Old3[Step2BlocksAndExclusions.tsx<br/>편집 전용]
        Old4[Step2DetailView.tsx<br/>읽기 전용]
        Old5[Step3Contents.tsx<br/>편집 전용]
        Old6[Step3DetailView.tsx<br/>읽기 전용]
        Old7[...]
    end
    
    subgraph 새 구조 1개 파일
        New1[Step1BasicInfoView.tsx<br/>mode=edit/readonly]
        New2[Step2TimeSettingsView.tsx<br/>mode=edit/readonly]
        New3[Step3ContentsView.tsx<br/>mode=edit/readonly]
        New4[...]
    end
    
    Old1 -.통합.-> New1
    Old2 -.통합.-> New1
    Old3 -.통합.-> New2
    Old4 -.통합.-> New2
    Old5 -.통합.-> New3
    Old6 -.통합.-> New3
    
    style Old1 fill:#ffcdd2
    style Old2 fill:#ffcdd2
    style Old3 fill:#ffcdd2
    style Old4 fill:#ffcdd2
    style Old5 fill:#ffcdd2
    style Old6 fill:#ffcdd2
    style New1 fill:#c8e6c9
    style New2 fill:#c8e6c9
    style New3 fill:#c8e6c9
```

---

## 5. 성능 최적화 구조

### 5.1 렌더링 최적화

```mermaid
graph TB
    ParentWizard[PlanGroupWizard<br/>wizardData state]
    
    ParentWizard --> Memo1[React.memo<br/>Step1BasicInfoView]
    ParentWizard --> Memo2[React.memo<br/>Step2TimeSettingsView]
    ParentWizard --> Memo3[React.memo<br/>Step3ContentsView]
    
    Memo1 --> PropsCheck1{props 변경?}
    PropsCheck1 -->|예| Render1[리렌더링]
    PropsCheck1 -->|아니오| Skip1[건너뛰기]
    
    Memo2 --> PropsCheck2{props 변경?}
    PropsCheck2 -->|예| Render2[리렌더링]
    PropsCheck2 -->|아니오| Skip2[건너뛰기]
    
    Memo3 --> PropsCheck3{props 변경?}
    PropsCheck3 -->|예| Render3[리렌더링]
    PropsCheck3 -->|아니오| Skip3[건너뛰기]
    
    style Render1 fill:#e3f2fd
    style Render2 fill:#e3f2fd
    style Render3 fill:#e3f2fd
    style Skip1 fill:#c8e6c9
    style Skip2 fill:#c8e6c9
    style Skip3 fill:#c8e6c9
```

### 5.2 스케줄 계산 캐싱

```mermaid
graph TB
    UserInput[사용자 입력 변경]
    
    UserInput --> Debounce[debounce 500ms]
    Debounce --> CalcParams[계산 파라미터 생성]
    
    CalcParams --> CacheCheck{캐시 확인}
    
    CacheCheck -->|히트| CacheHit[캐시에서 반환]
    CacheCheck -->|미스| ServerCall[서버 API 호출]
    
    ServerCall --> Calculate[스케줄 계산<br/>1-3초]
    Calculate --> SaveCache[캐시 저장]
    SaveCache --> Return[결과 반환]
    
    CacheHit --> DisplayResult[결과 표시<br/>즉시]
    Return --> DisplayResult
    
    style CacheHit fill:#c8e6c9
    style ServerCall fill:#fff3e0
    style Calculate fill:#ffcdd2
    style DisplayResult fill:#e3f2fd
```

---

## 6. 구현 단계별 다이어그램

### Phase 2: Step 2+3 통합

```mermaid
graph TD
    Phase2[Phase 2 시작]
    
    Phase2 --> Create[Step2TimeSettingsWithPreview.tsx 생성]
    Create --> Split[좌우 분할 레이아웃]
    
    Split --> LeftPanel[좌측 패널<br/>TimeSettingsPanel]
    Split --> RightPanel[우측 패널<br/>SchedulePreviewPanel]
    
    LeftPanel --> Exclusions[ExclusionsPanel]
    LeftPanel --> Academy[AcademyPanel]
    LeftPanel --> TimeConfig[TimeConfigPanel]
    
    RightPanel --> Debounce[Debounce 로직<br/>500ms]
    Debounce --> Cache[캐싱 로직]
    Cache --> Preview[미리보기 표시]
    
    Preview --> Mobile[반응형 디자인<br/>모바일: 상하 배치]
    
    Mobile --> Test[테스트]
    Test --> Done[Phase 2 완료]
    
    style Done fill:#c8e6c9
```

### Phase 3: Step 4+5 통합

```mermaid
graph TD
    Phase3[Phase 3 시작]
    
    Phase3 --> CreateTab[Step3ContentsSelection.tsx 생성]
    CreateTab --> TabUI[탭 UI 구현]
    
    TabUI --> Tab1[학생 콘텐츠 탭]
    TabUI --> Tab2[추천 콘텐츠 탭]
    
    Tab1 --> Search[검색/필터/정렬]
    Tab1 --> Select1[선택/해제 토글]
    
    Tab2 --> AIRecommend[AI 추천 로직]
    Tab2 --> Select2[선택/해제 토글]
    
    Select1 --> LimitCheck[9개 제한 확인]
    Select2 --> LimitCheck
    
    LimitCheck --> Progress[진행률 표시 8/9]
    Progress --> DisableCheck{9개 도달?}
    
    DisableCheck -->|예| Disable[추가 선택 비활성화]
    DisableCheck -->|아니오| Continue[계속 선택 가능]
    
    Disable --> Test[테스트]
    Continue --> Test
    Test --> Done[Phase 3 완료]
    
    style Done fill:#c8e6c9
```

### Phase 5: DetailView 통합

```mermaid
graph TD
    Phase5[Phase 5 시작]
    
    Phase5 --> AddMode[각 Step에 mode prop 추가]
    AddMode --> Readonly[readonly 모드 구현]
    
    Readonly --> ConditionalRender[조건부 렌더링<br/>mode === 'edit' ? input : text]
    ConditionalRender --> RemoveDetail[DetailView 파일 제거]
    
    RemoveDetail --> UpdateUsage[사용처 업데이트]
    UpdateUsage --> Usage1[플랜 그룹 상세 페이지]
    UpdateUsage --> Usage2[편집 페이지]
    UpdateUsage --> Usage3[캠프 제출 완료 페이지]
    
    Usage1 --> Test[테스트]
    Usage2 --> Test
    Usage3 --> Test
    
    Test --> Done[Phase 5 완료]
    
    style Done fill:#c8e6c9
```

---

## 7. 에러 핸들링 구조

```mermaid
graph TB
    UserAction[사용자 액션]
    
    UserAction --> TryCatch[try-catch 블록]
    TryCatch --> ServerCall[서버 API 호출]
    
    ServerCall --> Success{성공?}
    
    Success -->|예| UpdateState[상태 업데이트]
    Success -->|아니오| ErrorType{에러 타입}
    
    ErrorType -->|네트워크 에러| NetworkError[네트워크 에러 처리]
    ErrorType -->|검증 에러| ValidationError[검증 에러 처리]
    ErrorType -->|비즈니스 에러| BusinessError[비즈니스 에러 처리]
    ErrorType -->|알 수 없음| UnknownError[일반 에러 처리]
    
    NetworkError --> ShowToast1[Toast 메시지: 네트워크 연결 확인]
    ValidationError --> ShowToast2[Toast 메시지: 입력 확인]
    BusinessError --> ShowToast3[Toast 메시지: 비즈니스 규칙]
    UnknownError --> ShowToast4[Toast 메시지: 일반 에러]
    
    ShowToast1 --> Retry{재시도 가능?}
    ShowToast2 --> Retry
    ShowToast3 --> Retry
    ShowToast4 --> Retry
    
    Retry -->|예| RetryButton[재시도 버튼 표시]
    Retry -->|아니오| ManualFix[사용자 수정 필요]
    
    UpdateState --> Success2[성공 처리]
    
    style Success2 fill:#c8e6c9
    style NetworkError fill:#ffcdd2
    style ValidationError fill:#ffcdd2
    style BusinessError fill:#ffcdd2
    style UnknownError fill:#ffcdd2
```

---

**참고 문서**:
- [상세 분석 문서](./wizard-refactoring-analysis.md)
- [프로젝트 계획](../camp-plan.plan.md)

