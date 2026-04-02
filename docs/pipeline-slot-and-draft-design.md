# 파이프라인 슬롯 자동 생성 + AI 가안 채우기 설계

## 목표

파이프라인 실행 시 NEIS가 없는 학년에 대해:
1. 생기부 모형(슬롯)을 자동 생성
2. 각 슬롯의 AI 레이어(`ai_draft_content`)를 채움
3. 컨설턴트가 열었을 때 3학년 생기부 모형이 이미 채워져 있는 상태

수강계획 유무와 무관하게 동작. 있으면 활용, 없으면 진로/전공 기반 추론.

## 현재 상태

### 이미 있는 것
- 세특/창체/행특 3개 테이블 모두 4레이어 컬럼 구조:
  `ai_draft_content` → `content` → `confirmed_content` → `imported_content`
- AI 가안 생성 함수: `generateSetekDraft`, `generateChangcheDraft`, `generateHaengteukDraft`
- 수강계획 확정 → 세특 슬롯 생성: `syncConfirmedToSeteks()`
- 파이프라인 course_recommendation 태스크: 추천 과목 생성

### 없는 것
- 파이프라인에서 슬롯 자동 생성
- 파이프라인에서 AI 가안 채우기
- 창체/행특 슬롯 자동 생성 (수강계획과 무관)
- 수강계획 없을 때 진로 기반 교과 추론 → 슬롯 생성

## 설계

### 파이프라인이 NEIS 없는 학년을 만나면

```
1. 슬롯 확보
   세특: 수강계획 있으면 → 해당 과목 슬롯
         수강계획 없으면 → course_recommendation 결과(추천 과목) 슬롯
         둘 다 있으면 → 합산 (중복 제거)
   창체: 자율/동아리/진로 3개 슬롯 (고정)
   행특: 1개 슬롯 (고정)

2. 방향 가이드 생성 (기존 파이프라인 — 이미 구현됨)
   setek_guide → 과목별 방향
   changche_guide → 영역별 방향
   haengteuk_guide → 행특 방향

3. AI 가안 생성 (신규)
   각 슬롯에 대해 ai_draft_content 채우기:
   - 방향 가이드(2번 결과)를 컨텍스트로 활용
   - generateSetekDraft / generateChangcheDraft / generateHaengteukDraft 호출
   - ai_draft_status = 'done'으로 마킹
```

### 슬롯 생성 상세

#### 세특 슬롯

```typescript
// 파이프라인 내에서 실행
async function ensureSetekSlots(
  studentId: string, tenantId: string, 
  grade: number, schoolYear: number,
  coursePlans: CoursePlanWithSubject[],  // 수강계획 (있으면)
  recommendedSubjects: RecommendedSubject[],  // course_recommendation 결과 (있으면)
) {
  // 1. 수강계획 과목 + 추천 과목 합산 (subject_id 기준 중복 제거)
  // 2. 이미 존재하는 세특 레코드 확인 (upsert conflict 방지)
  // 3. 없는 과목만 빈 슬롯 생성 (content: "", status: "draft")
}
```

#### 창체 슬롯

```typescript
async function ensureChangcheSlots(
  studentId: string, tenantId: string,
  grade: number, schoolYear: number,
) {
  // 자율/동아리/진로 3개 고정
  // 이미 존재하면 스킵, 없으면 생성
  const types = ["autonomy", "club", "career"];
  for (const type of types) {
    await upsertChangche({ ..., activity_type: type, content: "", status: "draft" });
  }
}
```

#### 행특 슬롯

```typescript
async function ensureHaengteukSlot(
  studentId: string, tenantId: string,
  grade: number, schoolYear: number,
) {
  // 학년당 1건 고정
  // 이미 존재하면 스킵, 없으면 생성
  await upsertHaengteuk({ ..., content: "", status: "draft" });
}
```

### AI 가안 생성 상세

방향 가이드(setek_guide 등)가 생성된 후, 해당 방향을 컨텍스트로 활용하여 실제 세특/창체/행특 초안을 생성.

```
방향 가이드: "이 과목에서 물리·천문 진로와 연결하여 이런 방향으로"
      ↓
AI 가안: "실험 수업에서 케플러 법칙을 활용한 행성 궤도 시뮬레이션을 설계하여..."
         (실제 세특에 들어갈 수 있는 형태의 초안)
```

### 파이프라인 Phase 구조 변경

기존 14 태스크에 2개 추가:

| 신규 태스크 | Phase | 위치 | 역할 |
|------------|-------|------|------|
| `slot_generation` | Phase 4.5 (진단 후, 가이드 전) | course_recommendation 다음 | NEIS 없는 학년의 세특/창체/행특 슬롯 자동 생성 |
| `draft_generation` | Phase 6.5 (가이드 후, 요약 전) | 가이드 생성 완료 후 | 각 슬롯의 ai_draft_content 채우기 |

```
Phase 1~3: 역량/스토리/엣지 (NEIS 학년 분석)
Phase 4:   진단 + 수강추천
Phase 4.5: 슬롯 생성 (NEIS 없는 학년)  ← 신규
Phase 5:   세특 방향 가이드
Phase 6:   창체/행특 방향 가이드
Phase 6.5: AI 가안 생성               ← 신규
Phase 7:   활동 요약 + 전략
Phase 8:   면접 + 로드맵 + 완료
```

### slot_generation 상세

```
입력:
  - consultingGrades (NEIS 없는 학년 목록)
  - coursePlanData (수강계획 — 있으면)
  - course_recommendation 결과 (추천 과목 — 있으면)
  - student.target_major (진로)

처리:
  for each grade in consultingGrades:
    1. 세특: 수강계획 과목 + 추천 과목으로 슬롯 생성
    2. 창체: 자율/동아리/진로 3개 슬롯 생성
    3. 행특: 1개 슬롯 생성

출력:
  - 생성된 슬롯 수 (preview: "3학년 세특 5과목 + 창체 3영역 + 행특 1건 슬롯 생성")
```

### draft_generation 상세

```
입력:
  - consultingGrades의 슬롯 목록
  - 방향 가이드 (setek_guide, changche_guide, haengteuk_guide)
  - 진단 결과 (improvements, weaknesses)

처리:
  for each slot in consultingGrades:
    1. 해당 슬롯의 방향 가이드를 DB에서 조회
    2. 방향 + 진단 컨텍스트로 AI 가안 생성
    3. ai_draft_content, ai_draft_at, ai_draft_status 업데이트

  학년별 → 영역별 순차 (타임아웃 안전):
    세특 과목1 → 과목2 → ... → 창체 자율 → 동아리 → 진로 → 행특

출력:
  - 생성된 가안 수 (preview: "3학년 AI 가안 9건 생성")
```

### 타임아웃 고려

- slot_generation: DB 작업만 → 빠름 (별도 Phase 불필요, Phase 4 끝에 포함 가능)
- draft_generation: LLM 호출 × N건 → 별도 Phase 필요
  - 세특 5과목 + 창체 3 + 행특 1 = 9건 LLM 호출
  - 각 호출 ~10~20초 → 총 ~90~180초
  - 한 Phase에서 처리하기 무거울 수 있음 → Phase 분할 또는 배치 처리 검토

### PIPELINE_TASK_KEYS 변경

```typescript
// 현재 14개
export const PIPELINE_TASK_KEYS = [
  "competency_analysis", "storyline_generation", "edge_computation",
  "ai_diagnosis", "course_recommendation", "guide_matching",
  "bypass_analysis", "setek_guide", "changche_guide", "haengteuk_guide",
  "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation",
] as const;

// 변경 16개
export const PIPELINE_TASK_KEYS = [
  "competency_analysis", "storyline_generation", "edge_computation",
  "ai_diagnosis", "course_recommendation",
  "slot_generation",      // ← 신규: 컨설팅 학년 슬롯 생성
  "guide_matching",
  "bypass_analysis", "setek_guide", "changche_guide", "haengteuk_guide",
  "draft_generation",     // ← 신규: AI 가안 생성
  "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation",
] as const;
```

### 구현 순서

1. **slot_generation 태스크**: 슬롯 생성 함수 + 태스크 러너 + Phase 4 연결
2. **draft_generation 태스크**: AI 가안 생성 오케스트레이터 + Phase 6.5 연결
3. **PIPELINE_TASK_KEYS 확장**: 16개로 + DB 초기값 업데이트
4. **Phase executor 업데이트**: 새 Phase 추가
5. **컨텍스트 그리드 확인**: 생성된 슬롯이 정상 표시되는지
