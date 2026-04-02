# 파이프라인 NEIS 기반 플로우 재설계

## 핵심 원칙

**NEIS(`imported_content`) = 실제 생기부 = 절대적 사실**

- 각 레코드에 `imported_content`가 있으면 **분석 대상** (실 생기부)
- 없으면 **컨설팅 대상** (방향/가이드/가안)
- 이 판정은 **개별 레코드 단위**로 이루어진다
- NEIS가 있으면 컨설턴트 레이어(`content`)는 분석에서 **무시** — 입시관이 보는 것은 NEIS뿐
- 컨설턴트 레이어는 NEIS가 없는 시점에서만 의미 있음 (실제 생기부 나오기 전 준비)

---

## 현재 구조의 문제

### 1. 전역 이진 모드
```
pipelineMode: "analysis" | "prospective"  ← 전체 파이프라인에 하나
```
- 1~2학년 NEIS 있고 3학년만 없어도 전체가 prospective로 빠짐
- 학년/영역별 혼합 상태를 처리할 수 없음

### 2. 잘못된 판정 기준
```typescript
// pipeline-executor.ts:272
const hasRecords = cachedSeteks.some(s => s.content?.trim());
```
- `content`(컨설턴트 편집본) 기준 — NEIS 레이어(`imported_content`)를 안 봄
- NEIS 임포트 후에도 컨설턴트가 편집을 시작하지 않으면 "기록 없음"으로 판정

### 3. 태스크별 분기 중복
- 5개 태스크 러너 + 2개 Phase executor에서 `if (pipelineMode === "prospective")` 분기
- 동일 분기 로직이 7곳에 산재

---

## 새 설계

### 데이터 흐름 원칙

```
레코드 하나에 대해:
  imported_content 있음 → 실 생기부 → imported_content를 분석 입력으로 사용
  imported_content 없음 → 컨설팅 대상 → content(가안/방향)가 있으면 참고, 없으면 신규 생성
```

> NEIS가 있는 레코드에서 content(컨설턴트 편집본)는 무시.
> NEIS가 없는 레코드에서만 content가 유효.

### 전략 레이어

전략/로드맵/면접은 **전체를 종합**하되, 입력의 성격을 구분:
- **분석 결과** (NEIS 기반) = 사실 — "학생이 실제로 보여준 역량"
- **컨설팅 방향** (NEIS 없는 영역) = 계획 — "앞으로 보여줘야 할 방향"
- AI가 사실과 계획을 구분하여 전략을 수립

---

## 시나리오별 동작

### 시나리오 1: 3학년, 1~2학년 NEIS 완료, 3학년 수강계획만

```
1학년 세특 12과목: imported_content ✅ → 분석
1학년 창체 3영역: imported_content ✅ → 분석
1학년 행특:       imported_content ✅ → 분석
2학년 세특 17과목: imported_content ✅ → 분석
2학년 창체 3영역: imported_content ✅ → 분석
2학년 행특:       imported_content ✅ → 분석
3학년:            imported_content 없음 → 수강계획 기반 방향/가이드 생성

역량 분석: 1~2학년 NEIS 데이터 기반
스토리라인: 1~2학년 NEIS에서 추출
엣지 계산: 1~2학년 NEIS 간 연결
AI 진단: 1~2학년 분석(사실) + 3학년 계획 → 통합 진단
세특 방향: 3학년만 생성 (1~2학년은 NEIS가 진실이므로 방향 불필요)
전략: 1~2학년 분석 + 3학년 방향 → 종합 전략
```

### 시나리오 2: 2학년, 1학년 NEIS 완료

```
1학년: imported_content ✅ → 분석
2~3학년: imported_content 없음 → 수강계획 기반 방향/가이드

역량 분석: 1학년 NEIS 기반
전략: 1학년 분석 + 2~3학년 방향 → 종합
```

### 시나리오 3: 1학년 신입생, NEIS 없음

```
전체: imported_content 없음 → 전체 컨설팅 플로우
역량 분석: 스킵 (분석할 실 데이터 없음)
스토리라인: 스킵
전략: 수강계획 기반 방향만으로 초기 전략
```

### 시나리오 4: 3학년 2학기, 전 학년 NEIS 완료

```
전체: imported_content ✅ → 전체 NEIS 기반 분석
컨설턴트 레이어: 전부 무시 (NEIS가 진실)
세특 방향: 생성 불필요 (이미 실제 기록이 있으므로)
전략: 3개년 실 데이터 종합
```

### 시나리오 5: 재실행 — 2학년 NEIS 신규 임포트

```
이전: 1학년 NEIS 분석 + 2~3학년 컨설팅
변경: 2학년 NEIS 추가됨

1학년: imported_content ✅ → 분석
2학년: imported_content ✅ (신규) → 분석 (이전 컨설팅 결과는 NEIS가 대체)
3학년: imported_content 없음 → 컨설팅 유지

전략: 1~2학년 실 분석 + 3학년 방향 → 전략 재수립
```

---

## 변경 범위

### A. 폐기: 전역 pipelineMode

| 파일 | 변경 |
|------|------|
| `pipeline-types.ts:99` | `pipelineMode` 필드 deprecated (하위 호환 유지) |
| `pipeline-executor.ts:242-289` | 전역 모드 판정 → NEIS 기반 resolvedRecords로 대체 |
| `student_record_analysis_pipelines.mode` | DB 컬럼 유지 (기존 결과 참조), 판정에 미사용 |

### B. 신규: 레코드 수준 NEIS 상태 해소

파이프라인 시작 시 한 번만 해소. 이후 모든 태스크가 해소된 데이터를 사용.

#### B-1. PipelineContext 확장

```typescript
interface ResolvedRecord {
  id: string;
  grade: number;
  semester?: number;
  subjectId?: string;
  activityType?: string;       // changche only
  hasNeis: boolean;             // imported_content 존재 여부
  effectiveContent: string;     // NEIS → imported_content, 비NEIS → content
  subjectName?: string;
}

interface ResolvedRecordsByGrade {
  [grade: number]: {
    seteks: ResolvedRecord[];
    changche: ResolvedRecord[];
    haengteuk: ResolvedRecord | null;
    hasAnyNeis: boolean;
  };
}

interface PipelineContext {
  // 기존 필드 유지
  pipelineMode: "analysis" | "prospective";  // deprecated — 하위 호환용
  
  // 신규: NEIS 기반 해소 데이터
  resolvedRecords: ResolvedRecordsByGrade;
  neisGrades: number[];         // NEIS 레코드가 있는 학년
  consultingGrades: number[];   // NEIS 없는 학년
}
```

#### B-2. 데이터 해소 모듈 (신규 파일: `pipeline-data-resolver.ts`)

```typescript
/**
 * 파이프라인 시작 시 1회 실행.
 * 모든 레코드의 NEIS 유무를 판정하고, 유효 콘텐츠를 결정.
 * 이후 태스크들은 이 결과만 소비.
 */
export function resolveRecordData(
  seteks: RecordSetek[],
  changche: RecordChangche[],
  haengteuk: RecordHaengteuk[],
  subjectMap: Map<string, string>,
): ResolvedRecordsByGrade
```

### C. 태스크 모듈화 (타임아웃 방지)

> 핵심: LLM 함수를 하나로 합치지 않는다.
> 분석 모듈과 컨설팅 모듈을 **독립적으로 유지**하고,
> 오케스트레이터(Phase executor)가 학년별로 **적절한 모듈을 호출**한다.

#### 모듈 구조

```
각 영역(세특/창체/행특)에 대해:

  분석 모듈: analyzeSetekFromNeis(grade, neisRecords)    ← NEIS 기반
  컨설팅 모듈: generateSetekDirection(grade, coursePlan)  ← 수강계획 기반
  
  이 두 모듈은 독립적이고, 개별 호출 가능하며, 각각 타임아웃 안전.
```

| 현재 | 변경 |
|------|------|
| `generateSetekGuide()` (analysis 내장) | `analyzeSetekGuide(grade, neisData)` — NEIS 분석 모듈 |
| `generateProspectiveSetekGuide()` | `generateSetekDirection(grade, coursePlan)` — 컨설팅 모듈 |
| `generateChangcheGuide()` | `analyzeChangcheGuide(grade, neisData)` |
| `generateProspectiveChangcheGuide()` | `generateChangcheDirection(grade, coursePlan)` |
| `generateHaengteukGuide()` | `analyzeHaengteukGuide(grade, neisData)` |
| `generateProspectiveHaengteukGuide()` | `generateHaengteukDirection(grade, coursePlan)` |
| `generateAiDiagnosis()` | 유지 — 입력으로 NEIS 분석 결과 + 컨설팅 방향 모두 받음 |
| `generateProspectiveDiagnosis()` | 제거 — 통합 진단이 NEIS 없는 경우도 처리 |

#### 오케스트레이터 (Phase executor)

```typescript
// Phase 5 예시 (세특 방향)
async function executePhase5(ctx: PipelineContext) {
  for (const grade of allGrades) {
    const gradeData = ctx.resolvedRecords[grade];
    if (!gradeData) continue;
    
    if (gradeData.hasAnyNeis) {
      // NEIS 있는 학년 → 분석 모듈 호출
      await analyzeSetekGuide(grade, gradeData.seteks);
    } else {
      // NEIS 없는 학년 → 컨설팅 모듈 호출
      await generateSetekDirection(grade, ctx.coursePlanData);
    }
  }
}
```

각 모듈 호출은 **1학년분 × 1영역** = 개별 LLM 호출 1회.
학년 수 × 영역 수만큼 순차 호출하되, 각 호출이 독립적이므로 타임아웃 안전.

### D. CachedSetek/CachedChangche/CachedHaengteuk 확장

```typescript
// 현재
interface CachedSetek {
  id: string;
  content: string;
  grade: number;
  subject: { name: string } | null;
}

// 변경 — imported_content 추가
interface CachedSetek {
  id: string;
  content: string;
  imported_content: string | null;
  grade: number;
  subject: { name: string } | null;
}
```

SELECT 쿼리에서 `imported_content`도 함께 조회.

### E. Phase 구조 변경

#### Phase 1~3 (역량/스토리/엣지)
```
현재: prospective면 전체 스킵
변경: neisGrades 레코드만 대상으로 실행
      NEIS 없는 학년은 자연스럽게 스킵 (데이터가 없으므로)
      → 모드 분기 제거, 데이터 유무로 자연 결정
```

#### Phase 4 (진단)
```
현재: prospective → generateProspectiveDiagnosis() / analysis → generateAiDiagnosis()
변경: 통합 진단 모듈 — 입력을 두 그룹으로 받음
      - neisGrades 분석 결과 (역량, 스토리라인, 엣지) = 사실
      - consultingGrades 수강계획 = 계획
      → AI가 두 입력을 구분하여 진단
```

#### Phase 5 (세특 방향)
```
현재: setek_guide 1회 호출 (내부에서 전체 모드 판정)
변경: 학년별 루프 — NEIS 학년은 분석 모듈, 비NEIS 학년은 컨설팅 모듈
```

#### Phase 6 (창체/행특)
```
현재: prospective → 학년별 루프(setek+changche+haengteuk)
      analysis → changche→haengteuk 순차

변경: 전체 학년 순회 — 각 학년에서:
      NEIS 있음 → analyzeChangcheGuide + analyzeHaengteukGuide
      NEIS 없음 → generateChangcheDirection + generateHaengteukDirection
      
      Phase 6에서 setek을 다시 생성하지 않음 (Phase 5에서 완료)
```

#### Phase 7~8 (전략/면접/로드맵)
```
변경: 프롬프트에 분석 결과(사실)과 컨설팅 방향(계획)을 명시적으로 구분 전달
```

---

## 구현 순서

### Step 1: 데이터 해소 레이어 (긴급)

1. `pipeline-data-resolver.ts` 신규 — `resolveRecordData()` 함수
2. CachedSetek/CachedChangche/CachedHaengteuk에 `imported_content` 추가
3. pipeline-executor SELECT 쿼리에 `imported_content` 포함
4. PipelineContext에 `resolvedRecords`, `neisGrades`, `consultingGrades` 추가
5. `pipelineMode` 판정을 해소 데이터 기반으로 변경 (하위 호환)

### Step 2: Phase 1~3 전환 (분석 태스크)

6. competency_analysis — `resolvedRecords`에서 NEIS 레코드만 분석
7. storyline_generation — 동일
8. edge_computation — 동일
9. `if (pipelineMode === "prospective")` 분기 3곳 제거

### Step 3: Phase 4 진단 통합

10. ai_diagnosis — NEIS 분석 결과 + 수강계획 → 통합 진단
11. `generateProspectiveDiagnosis` 폐기, 통합 진단이 양쪽 입력 모두 처리

### Step 4: Phase 5~6 모듈화

12. 세특 분석 모듈 (`analyzeSetekGuide`) + 세특 컨설팅 모듈 (`generateSetekDirection`) 분리
13. 창체 분석/컨설팅 모듈 분리
14. 행특 분석/컨설팅 모듈 분리
15. Phase 5 오케스트레이터 — 학년별 적절한 모듈 호출
16. Phase 6 오케스트레이터 — 학년별 적절한 모듈 호출
17. Phase 6 prospective 루프 제거 → 통합 루프

### Step 5: 전략 레이어 고도화

18. ai_strategy — 분석(사실) vs 방향(계획) 구분 프롬프트
19. roadmap_generation — 동일
20. interview_generation — 동일
21. activity_summary — NEIS 데이터 기반으로 전환

### Step 6: 정리

22. `pipelineMode` 분기 전체 제거 확인 (7곳)
23. Phase 6 prospective 전용 코드 제거
24. 레거시 함수(generateProspective*) 제거
25. DB `mode` 컬럼 — deprecated 마이그레이션

---

## 하위 호환

- DB `mode` 컬럼: 유지 (기존 파이프라인 결과 참조). 신규 실행 시 `neisGrades` 유무로 자동 결정.
- 기존 `prompt_version` 값: 유지. 생성 기반 추적용 (`guide_v1` = NEIS 기반, `guide_v1_prospective` = 수강계획 기반).
- 기존 파이프라인 결과: 재실행 시 새 로직으로 덮어쓰기.

---

## 점검: 맥락 정합성

| 원칙 | 설계 반영 |
|------|----------|
| NEIS = 절대적 사실 | NEIS 있으면 `imported_content`만 사용, `content` 무시 |
| 컨설턴트 레이어는 NEIS 이전에만 유효 | NEIS 없는 레코드에서만 `content` 참조 |
| 판정은 레코드 단위 | `resolveRecordData`가 개별 레코드별 `hasNeis` 판정 |
| 학년/영역/시점 무관하게 동작 | 전역 모드 없음, 데이터 상태가 플로우를 결정 |
| 전략은 사실+계획 종합 | 프롬프트에 분석 결과(사실) vs 컨설팅 방향(계획) 구분 전달 |
| 타임아웃 안전 | LLM 함수 합치지 않음, 학년×영역별 독립 모듈로 개별 호출 |
| 재실행 시 NEIS가 컨설팅 대체 | NEIS 도입된 학년은 자동으로 분석 플로우 전환 |
