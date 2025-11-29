# Wizard Phase 2 구현 노트

**작성일**: 2025년 11월 29일  
**상태**: 구현 시작 (프로토타입 단계)

---

## 🎯 Phase 2 목표

Step 2 (BlocksAndExclusions, 1,330 라인) + Step 3 (SchedulePreview, 1,135 라인)을 통합하여 실시간 미리보기가 있는 단일 Step으로 만들기

---

## 📋 구현 계획

### 1단계: 컴포넌트 분리 ✅ (시작됨)

**생성된 파일**:
- `_panels/TimeSettingsPanel.tsx` - 메인 패널 (통합 wrapper)

**생성 예정**:
- `_panels/ExclusionsPanel.tsx` - 제외일 관리 (300+ 라인 예상)
- `_panels/AcademySchedulePanel.tsx` - 학원 일정 관리 (300+ 라인 예상)
- `_panels/TimeConfigPanel.tsx` - 시간 설정 (200+ 라인 예상)
- `_panels/NonStudyTimeBlocksPanel.tsx` - 학습 시간 제외 (200+ 라인 예상)
- `_panels/SchedulePreviewPanel.tsx` - 스케줄 미리보기 (1,135 라인 → 리팩토링)

### 2단계: 레이아웃 구현

**목표 구조**:
```
┌───────────────────────────────────────────────────────┐
│ Step 2: 시간 설정 + 실시간 미리보기                    │
├─────────────────────┬─────────────────────────────────┤
│ TimeSettingsPanel   │ SchedulePreviewPanel            │
│ (좌측 40%)          │ (우측 60%)                       │
│                     │                                 │
│ - ExclusionsPanel   │ - 요약 통계 (카드)              │
│ - AcademySchedule   │ - 주차별 스케줄 (접기/펼치기)   │
│ - TimeConfig        │ - 일별 스케줄 (상세 정보)       │
│ - NonStudyBlocks    │                                 │
│                     │ [실시간 업데이트]               │
│ (스크롤 가능)       │ (스크롤 가능)                    │
└─────────────────────┴─────────────────────────────────┘

모바일:
┌──────────────────────┐
│ TimeSettingsPanel    │
│ (상단, 접기 가능)    │
├──────────────────────┤
│ SchedulePreviewPanel │
│ (하단, 고정 버튼)    │
└──────────────────────┘
```

**레이아웃 컴포넌트**:
```typescript
// Step2TimeSettingsWithPreview.tsx
export function Step2TimeSettingsWithPreview(props) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* 좌측: 설정 패널 */}
      <div className="lg:w-[40%] flex-shrink-0">
        <TimeSettingsPanel {...props} />
      </div>
      
      {/* 우측: 미리보기 패널 */}
      <div className="lg:w-[60%] flex-shrink-0 lg:sticky lg:top-4 lg:h-fit">
        <SchedulePreviewPanel {...props} />
      </div>
    </div>
  );
}
```

### 3단계: 실시간 미리보기 로직

**핵심 기능**:
1. **Debounce**: 500ms 후 스케줄 재계산
2. **Caching**: 동일 파라미터 재사용
3. **Loading State**: 계산 중 스켈레톤 UI
4. **Error Handling**: 인라인 에러 메시지

**구현 패턴**:
```typescript
// SchedulePreviewPanel.tsx
export function SchedulePreviewPanel({ data, onUpdate, ... }) {
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 스케줄 계산 파라미터 메모이제이션
  const scheduleParams = useMemo(() => ({
    periodStart: data.period_start,
    periodEnd: data.period_end,
    blockSetId: data.block_set_id,
    exclusions: data.exclusions,
    academySchedules: data.academy_schedules,
    timeSettings: data.time_settings,
    // ...
  }), [
    data.period_start,
    data.period_end,
    data.block_set_id,
    data.exclusions,
    data.academy_schedules,
    data.time_settings,
  ]);
  
  // Debounced 스케줄 계산
  const debouncedCalculate = useMemo(
    () => debounce(async (params) => {
      // 캐시 확인
      const cached = scheduleCache.get(params);
      if (cached) {
        setResult(cached);
        setLoading(false);
        return;
      }
      
      // 서버 계산
      setLoading(true);
      setError(null);
      try {
        const result = await calculateScheduleAvailability(params);
        scheduleCache.set(params, result);
        setResult(result);
        
        // WizardData에 결과 저장
        onUpdate({
          schedule_summary: result.summary,
          daily_schedule: result.daily_schedule,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 500),
    [onUpdate]
  );
  
  // 파라미터 변경 시 재계산
  useEffect(() => {
    if (isValidParams(scheduleParams)) {
      debouncedCalculate(scheduleParams);
    }
  }, [scheduleParams, debouncedCalculate]);
  
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold">스케줄 미리보기</h3>
      {loading && <ScheduleSkeleton />}
      {error && <ErrorMessage message={error} />}
      {result && <ScheduleDisplay result={result} />}
    </div>
  );
}
```

### 4단계: 반응형 디자인

**브레이크포인트**:
- Desktop (lg: 1024px+): 좌우 분할
- Tablet (md: 768-1023px): 좌우 분할 (비율 조정)
- Mobile (<768px): 상하 배치

**모바일 최적화**:
```typescript
// 모바일에서 미리보기를 하단 고정 버튼으로
const [isPreviewOpen, setIsPreviewOpen] = useState(false);

return (
  <>
    {/* 설정 패널 (항상 표시) */}
    <TimeSettingsPanel {...props} />
    
    {/* 모바일: 미리보기 토글 버튼 */}
    <div className="lg:hidden fixed bottom-4 right-4">
      <button
        onClick={() => setIsPreviewOpen(!isPreviewOpen)}
        className="rounded-full bg-indigo-600 px-6 py-3 text-white shadow-lg"
      >
        {isPreviewOpen ? "설정으로" : "미리보기"}
      </button>
    </div>
    
    {/* 모바일: 미리보기 모달 */}
    {isPreviewOpen && (
      <div className="lg:hidden fixed inset-0 z-50 bg-white">
        <SchedulePreviewPanel {...props} />
      </div>
    )}
  </>
);
```

---

## 🚧 현재 상태

### 완료된 작업
- [x] Phase 2 구현 계획 수립
- [x] `TimeSettingsPanel` 구조 생성 (wrapper)
- [x] 하위 패널 구조 설계

### 진행 중
- [ ] 하위 패널 컴포넌트 구현
  - [ ] `ExclusionsPanel.tsx`
  - [ ] `AcademySchedulePanel.tsx`
  - [ ] `TimeConfigPanel.tsx`
  - [ ] `NonStudyTimeBlocksPanel.tsx`
- [ ] `SchedulePreviewPanel.tsx` 리팩토링

### 대기 중
- [ ] `Step2TimeSettingsWithPreview.tsx` 메인 컴포넌트
- [ ] Wizard 통합
- [ ] 반응형 디자인 테스트
- [ ] 성능 최적화 (debounce, cache)

---

## 📊 예상 작업량

| 작업 | 예상 시간 | 복잡도 |
|------|-----------|--------|
| ExclusionsPanel | 3-4시간 | 중간 |
| AcademySchedulePanel | 3-4시간 | 중간 |
| TimeConfigPanel | 2-3시간 | 낮음 |
| NonStudyTimeBlocksPanel | 2-3시간 | 낮음 |
| SchedulePreviewPanel 리팩토링 | 4-5시간 | 높음 |
| Step2TimeSettingsWithPreview | 2-3시간 | 중간 |
| 레이아웃 및 반응형 | 3-4시간 | 중간 |
| 실시간 로직 구현 | 4-5시간 | 높음 |
| Wizard 통합 및 테스트 | 4-5시간 | 높음 |
| **총계** | **27-36시간** | **3-5일** |

---

## 💡 구현 팁

### 1. 점진적 구현
- 하나의 패널씩 완성하고 테스트
- 기존 Step2 컴포넌트를 참고하되 개선
- 각 패널은 독립적으로 동작하도록 설계

### 2. 상태 관리
- 모든 상태는 부모(Wizard)에서 관리
- 패널은 `data`와 `onUpdate`만 사용
- 로컬 상태는 UI 전용 (접기/펼치기 등)

### 3. 성능 최적화
- React.memo로 불필요한 리렌더링 방지
- useMemo로 계산 결과 캐싱
- useCallback로 핸들러 안정화

### 4. 에러 처리
- 사용자 친화적 에러 메시지
- 재시도 버튼 제공
- 에러 상태에서도 UI 유지

### 5. 접근성
- 키보드 네비게이션
- ARIA 속성
- 스크린 리더 지원

---

## 🔄 다음 단계

### 옵션 A: 프로토타입 계속 구현
- ExclusionsPanel 먼저 완성
- 하나씩 패널 추가
- 점진적으로 통합

### 옵션 B: 전체 구조 먼저 완성
- 모든 패널 골격 생성
- 기본 기능만 구현
- 이후 세부 기능 추가

### 옵션 C: 별도 브랜치에서 장기 작업
- `feature/wizard-step2-3-integration` 브랜치
- 충분한 시간을 가지고 구현
- 완성 후 리뷰 및 머지

---

## 📝 권장 사항

Phase 2는 **27-36시간**(3-5일)의 작업이 필요한 **대규모 리팩토링**입니다.

**권장 접근**:
1. ✅ **별도 feature 브랜치** 생성 (`feature/wizard-step2-3-integration`)
2. ✅ **점진적 구현**: 하나의 패널씩 완성
3. ✅ **테스트 주도**: 각 패널 완성 후 테스트
4. ✅ **코드 리뷰**: 중간 단계마다 리뷰
5. ✅ **문서화**: 구현하면서 문서 업데이트

**현재 세션에서**:
- 구조 설계 및 프로토타입 완료 ✅
- 구현 가이드 문서 작성 ✅
- 실제 구현은 별도 작업 세션에서 진행 권장

---

**작성일**: 2025년 11월 29일  
**상태**: 설계 완료, 구현 대기  
**다음 작업**: 별도 브랜치에서 패널별 구현 시작

