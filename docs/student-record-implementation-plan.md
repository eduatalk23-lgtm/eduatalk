# 생기부(학교생활기록부) 모형 구현 계획

> 작성일: 2026-02-23
> 최종 수정: 2026-03-17
> 상태: 미구현 (계획 v5 — 컨설팅 현장 보완 + 안정성 강화)

## 1. 개요

TimeLevelUp에 **생기부 기록 + 역량 진단 + 설계 로드맵 + 지원전략** 기능을 추가한다.
학원/컨설팅 환경에서의 실제 업무 흐름을 반영하여, 단순 CRUD를 넘어 **4단계 컨설팅 파이프라인**을 구현한다.

### 1.1 컨설팅 워크플로우 (4단계 + AI 레이어)

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  1.입력  │ →  │  2.진단  │ →  │  3.설계  │ →  │  4.전략  │
│ Record   │    │ Diagnose │    │ Roadmap  │    │ Strategy │
└────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
     │              │              │              │
 ┌───┴───┐    ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
 │AI: PDF │    │AI: 역량  │   │AI: 보완  │   │SQL: 졸업│
 │Import  │    │태그 제안 │   │전략 제안 │   │생 검색  │
 │(Gemini │    │진단 생성 │   │(Grounding│   │배치분석 │
 │멀티모달)│    │이수적합도│   │최신트렌드)│   │(공식)   │
 └───────┘    │경보 확장 │   └─────────┘   └─────────┘
               └─────────┘
```

- **입력**: 수동 입력 + AI PDF Import (Gemini 멀티모달)
- **진단**: 역량 태그 자동 제안 + 종합 진단 생성 + 교과 이수 적합도 + 조기 경보
- **설계**: 보완전략 AI 제안 (Gemini Grounding 웹 검색)
- **전략**: 모평 배치 분석 (규칙 기반) + 졸업생 유사도 검색 (SQL 기반)

### 1.2 참고 문서 (에듀엣톡 실제 컨설팅 자료)

| 문서 | 설명 | 핵심 데이터 |
|------|------|-------------|
| `Eeyore_2024년_진단_Report_이다은.xlsx` | 진단 보고서 (20개 시트) | 성적분석, 역량분석, 정성평가, 보완전략, 목표대학 |
| `학생부 종합 설계로드맵_이다은.docx` | 3년치 생기부 설계 | 학년별 자율/동아리/진로/세특/행특 내용 + 역량 태그 |
| `학교생활기록부-변환기.zip` | PDF→구조화 변환 (AI Studio) | Gemini 멀티모달 파싱, 창체/세특/행특 추출 |
| `NEW 학생 양식/` (7개 템플릿) | 표준 컨설팅 키트 | 로드맵(19표), 요약(8표), 수시Report, 독서기록장 |
| `ㅎ.생기부레벨업/` 전체 | 84명 학생 × 6개 코호트 | 졸업생 합격결과, 학년별 서류, 참조 데이터 |

### 1.3 표준 컨설팅 템플릿 워크플로우

```
0. 진로적성검사 (중등/예비고1)  →  학생 온보딩 시
0. 독서기록장                  →  상시 관리
0. 고교프로파일 분석            →  학교 선택/분석 시
1. 학교생활설계 로드맵 (19표)   →  최초 상담 시 작성, 지속 업데이트
2. 학교생활기록 요약 (8표)      →  정기 점검 시 갱신
3. 어디가 성적분석 입력         →  성적 입력 후 대학 매칭
4. 수시 Report (진단 보고서)    →  진단 분석 완료 후 발행
5. 기초 모의면접 질문           →  3학년 면접 대비 시
```

---

## 2. 실제 생기부 구조 (NEIS 기준)

### 2.1 공식 항목

| 번호 | 항목 | 기재 단위 | 대입 반영 | 비고 |
|------|------|-----------|-----------|------|
| 1 | 인적·학적사항 | - | O | students 테이블에 이미 존재 |
| 2 | 출결상황 | 학년(연간) | O | attendance 시스템 존재 |
| 3 | 수상경력 | - | **X** (2021~) | 컨설팅 기록용 **신규 구현** |
| 4 | 자격증·인증 | - | **X** (2022~) | 구현 제외 |
| 5 | 창의적 체험활동 | 학년(연간) | O | **신규 구현** |
| 6 | 교과학습 발달상황 | 학기별 | O | 성적: 기존, 세특: **신규 구현** |
| 7 | 자유학기활동 | - | - | 중학교만, 구현 제외 |
| 8 | 독서활동 | 학년(연간) | **X** (2021~) | 기록 관리 차원 **신규 구현** |
| 9 | 행동특성 및 종합의견 | 학년(연간) | O | **신규 구현** |

### 2.2 글자수 제한 (NEIS 바이트 기준)

| 항목 | 2025학년도 이전 | 2026학년도~ | NEIS 바이트 |
|------|----------------|-------------|-------------|
| 자율활동 | 500자 | 500자 | 1,500B |
| 동아리활동 | 500자 | 500자 | 1,500B |
| 진로활동 | **700자** | **500자** | 2,100B→1,500B |
| 교과 세특 (과목당) | 500자 | 500자 | 1,500B |
| 개인 세특 (학교자율과정) | 500자 | 500자 | 1,500B |
| 행동특성 및 종합의견 | **500자** | **300자** | 1,500B→900B |

> NEIS 바이트 계산: 한글 1자=3B, 영문/숫자/특수문자=1B

### 2.3 2025-2026 주요 변경사항

#### 세특 기재 단위
- 세특은 여전히 **과목×학기** 단위로 기재
- 마감 방식만 변경: 학기 마감 → **학년 말 통합 마감** (2026~)
- 2022 개정교육과정(2025 고1~): 공통과목이 학기별 별개 과목으로 분리
  - 예: 공통국어1(1학기) + 공통국어2(2학기) = 별개 레코드, **합산 500자 제한**

#### 창체 영역 변경 (2025 고1~)
- 4개 영역 → **3개 영역**: 자율·자치, 동아리, 진로 (봉사활동 독립 영역 폐지)

#### 성적 등급 체계
- 9등급 → **5등급** (2025 고1~)

---

## 3. 포함 항목

### 3.1 단계 1: 기록(Record) — 생기부 데이터 입력/편집

| 우선순위 | 항목 | 데이터 소스 | 구현 |
|----------|------|-------------|------|
| P0 | 교과 세특 | `student_record_seteks` (신규) | 과목별 textarea 에디터 |
| P0 | 개인 세특 | `student_record_personal_seteks` (신규) | 학교자율과정 textarea |
| P0 | 창체 | `student_record_changche` (신규) | 자율/동아리/진로 textarea + 시간 |
| P0 | 행특 | `student_record_haengteuk` (신규) | 단일 textarea |
| P1 | 교과 성적 | `student_internal_scores` (기존) | 읽기전용 뷰 통합 |
| P1 | 모의고사 추이 | `student_mock_scores` (기존) | 읽기전용 뷰 통합 (학년/월별) |
| P1 | 학교 출결 | `student_record_attendance` (신규) | NEIS 기준 세분화 입력 |
| P2 | 독서활동 | `student_record_reading` (신규) | 테이블 형태 행 추가/삭제 |
| P2 | 수상경력 | `student_record_awards` (신규) | 대입 미반영이나 컨설팅 기록용 |
| P2 | 봉사활동 | `student_record_volunteer` (신규) | 일자/장소/내용/시간/누계 |
| P2 | 징계사항 | `student_record_disciplinary` (신규) | 조치일자/사항 |

### 3.2 단계 2: 진단(Diagnose) — 역량 평가 + 정성 분석

| 우선순위 | 항목 | 데이터 소스 | 구현 |
|----------|------|-------------|------|
| P1 | 역량 종합 등급 | `student_record_competency_scores` (신규) | 3대 역량 × 10개 항목 등급 |
| P1 | 활동별 역량 태그 | `student_record_activity_tags` (신규) | 세특/창체에 역량 태그 연결 |
| P1 | 활동별 평가 | `student_record_activity_evals` (신규) | 긍정/부정/확인필요 분류 |
| P2 | 종합 총평 | `student_record_diagnosis` (신규) | 종합등급, 방향성, 장단점 |

### 3.3 단계 3: 설계(Roadmap) — 보완전략 수립

| 우선순위 | 항목 | 데이터 소스 | 구현 |
|----------|------|-------------|------|
| P2 | 보완전략 | `student_record_strategies` (신규) | 학년별 영역별 보완계획 textarea |
| P2 | 추천 독서 | `student_record_reading`에 `is_recommended` 필드 | 추천 vs 실제 읽은 책 구분 |

### 3.4 단계 4: 전략(Strategy) — 대학 지원전략

| 우선순위 | 항목 | 데이터 소스 | 구현 |
|----------|------|-------------|------|
| P2 | 지원 결과 추적 | `student_record_applications` (신규) | 대학/학과/전형/합격여부 기록 |
| P2 | 수능최저기준 | `student_record_diagnosis` 확장 | 과목별 달성 가능성 메모 |
| P2 | **모평 배치 분석** | `student_mock_scores` + 대학 기준점 | 대학별 합격가능성 판정 (위험/불안/소신/가능/안정) |
| P3 | 목표 대학/학과 | `students.target_major` 등 (기존) | 기존 필드 활용 |
| P3 | 지원전략 메모 | `student_record_diagnosis.strategy_notes` | 지원팁 저장 |

> 지원 결과(applications)는 졸업생 합격 DB로도 활용 — 후배 컨설팅 시 참고자료.
> 모평 배치 분석은 Phase 8에서 대학 DB 연동 시 자동화. 현재는 수동 메모로 구현.

---

## 4. 핵심 설계 결정

| 결정 | 근거 |
|------|------|
| `student_terms`를 부모 앵커로 활용 (별도 parent 테이블 X) | 이미 `student_id + school_year + grade + semester + curriculum_revision_id` 존재, `getOrCreateStudentTerm()` 재사용 |
| 공통과목 쌍 제약은 앱 레벨에서 검증 | DB CHECK로 구현 시 subject pair 조회 필요 → 복잡, 마이그레이션 부담 |
| 성적·출결은 기존 테이블에서 JOIN (비정규화 X) | 이미 존재하는 데이터, 동기화 이슈 방지 |
| 학생 뷰는 admin 컴포넌트 `readOnly` prop 재사용 | NEIS 레이아웃 렌더러 중복 방지 |
| RLS는 `rls_check_admin_tenant()` SECURITY DEFINER 헬퍼 패턴 사용 | 프로젝트 최신 패턴. initplan 최적화 함수 레벨에서 달성. `20260316_unify_rls` 마이그레이션 기준 |
| updated_at 트리거는 테이블별 독립 함수 | `update_{table}_updated_at()` + `tr_{table}_updated_at` 패턴. 공유 함수 X |
| 역량 평가는 별도 테이블 (students 확장 X) | 학년별 누적 관리 필요, students 테이블 비대화 방지 |
| 역량 태그는 junction 테이블 (string[] X) | 코드베이스는 `tags: string[]` 패턴이지만, `evaluation`(긍정/부정) + `evidence_summary` 필드가 필요하므로 junction 정당. 단순 태그가 아닌 **평가 데이터** |
| 개인세특은 교과세특과 별도 테이블 | 교과세특은 subject_id FK 필수, 개인세특은 자유 주제 |
| `students.target_major` 등 기존 진로 필드 재활용 | 이미 `target_major`, `target_major_2`, `desired_career_field`, `desired_university_ids` 존재. 신규 진로 테이블 불필요 |
| `student_internal_scores` 조회만 (신규 테이블 X) | `estimated_percentile`, `adjusted_grade` 이미 존재. ScoreSummaryView는 SELECT만 |
| `student_mock_scores` 조회만 (신규 테이블 X) | `standard_score`, `percentile` 이미 존재. MockScoreTrendView는 SELECT만 |
| 문서 저장은 기존 `files` + `custom_file_categories` 활용 | Drive 시스템에 '생기부', '상장', '봉사증서' 카테고리 추가. 별도 저장 테이블 불필요 |
| `university_admissions`는 `tenant_id NULL` (시스템 공유) | `school_info`, `career_fields`와 동일 패턴. 26,777건 × 테넌트 중복 방지 |

### 4.1 기존 인프라 활용 (신규 테이블 불필요)

인프라 점검(2026-03-17)에서 확인된 기존 테이블/시스템 재활용:

| 용도 | 기존 테이블/시스템 | 활용 방식 | 신규 테이블 불필요 이유 |
|------|-------------------|-----------|----------------------|
| **교과 성적 뷰** | `student_internal_scores` | SELECT 조회 → ScoreSummaryView (읽기전용) | `estimated_percentile`, `adjusted_grade`, `achievement_ratio_*` 이미 존재 |
| **모의고사 추이** | `student_mock_scores` | SELECT 조회 → MockScoreTrendView (읽기전용) | `standard_score`, `percentile`, `grade_score` 이미 존재 |
| **진로 목표** | `students.target_major` 등 + `student_career_field_preferences` | 기존 필드 그대로 활용 | `target_major`, `target_major_2`, `desired_career_field`, `desired_university_ids`, `career_notes` 이미 존재 |
| **문서 저장** | `files` + `custom_file_categories` (Drive 시스템) | 생기부 PDF, 상장, 봉사증서 등 원본 문서 저장 | 파일 업로드/버전관리/카테고리 이미 구현 |
| **학원 출결** | `attendance_records` | 학원 입실/퇴실 (QR/위치/수동) | 학교 NEIS 출결(`student_record_attendance`)과 **용도 구분** — 병행 사용 |
| **학기 추적** | `student_terms` | 세특의 `student_term_id` FK 앵커 | `getOrCreateStudentTerm()` 재사용 |
| **교과 체계** | `subjects` + `subject_groups` + `subject_types` | 세특의 `subject_id` FK | 교육과정별 과목 DB 이미 구축 |

---

## 5. 크로스커팅 설계 (보안, 성능, UX, 데이터 정합성)

### 5.1 Vercel 타임아웃 + 비동기 처리

| 작업 | 예상 소요 | 처리 방식 | 기존 인프라 |
|------|-----------|-----------|-------------|
| 세특/창체 CRUD | <1초 | 일반 Server Action | - |
| AI 태그 제안 | 3~10초 | 일반 Server Action | Gemini fast |
| AI 진단 생성 | 10~30초 | SSE 스트리밍 | `streamPlan.ts` 패턴 |
| **PDF Import 파싱** | **30초~2분** | **SSE 스트리밍 (ReadableStream)** | `batch-plan/stream` 패턴 |
| Excel 이관 (26,777건) | 수 분 | **스크립트 (CLI)** or **DB queue + cron** | `cold-start-batch.ts` 패턴 |
| adiga.kr PDF 갱신 | 수 분 | **SSE + 진행률** | 동일 |

**Vercel Hobby 제약**: `maxDuration = 300` (5분). PDF Import는 SSE 스트리밍으로 처리 가능 (기존 배치 스트리밍과 동일 패턴).

```typescript
// app/api/admin/student-record/import/stream/route.ts
export const maxDuration = 300;

export async function POST(request: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send('progress', { step: 'extracting', message: '이미지 추출 중...' });
      // ... Gemini 호출 ...
      send('progress', { step: 'parsing', message: 'AI 분석 중...' });
      // ... 매핑 + 저장 ...
      send('complete', { result });
      controller.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
}
```

**5분 초과 시 fallback**: 2단계 처리
1. 클라이언트에서 PDF → 이미지 추출 (`pdfjs-dist`, 클라이언트 측)
2. 이미지 base64를 Server Action으로 전송 → Gemini 파싱만 서버에서 처리 (30초~1분)

### 5.2 보안 및 개인정보 보호

#### LLM 데이터 처리 정책

| 프로바이더 | 학습 배제 | 근거 |
|-----------|-----------|------|
| **Anthropic Claude** | ✅ API 사용 데이터 학습 안 함 | API Terms of Service (기본 정책) |
| **Google Gemini** | ⚠️ Free Tier는 학습에 사용될 수 있음 | 유료 API(pay-as-you-go) 사용 필수 |
| **OpenAI GPT** | ✅ API 사용 데이터 학습 안 함 (2023.03~) | API Terms of Service |

**필수 조치**:
- Gemini Free Tier 사용 시 **학생 실명/개인정보 마스킹** 후 전송
- 프로덕션에서는 **Gemini 유료 API** 또는 **Claude API** 사용 (학습 배제 보장)
- 프롬프트에 개인식별정보(이름, 학교명, 주민번호) 제거 로직 추가
- `LLM_PROVIDER` 환경변수로 프로바이더 전환 가능 (이미 구현됨)

#### Server Action 권한 체크

```typescript
// 모든 생기부 쓰기 액션
export async function upsertSetek(data: SetekInput) {
  const { userId, role, tenantId } = await requireAdminOrConsultant();
  // ... 반드시 tenantId 필터 포함
}

// 학생 본인 조회
export async function getStudentRecord(studentId: string) {
  const auth = await resolveAuthContext({ studentId });
  // auth.studentId === studentId 검증 (RLS + 앱 레벨 이중 검증)
}
```

#### 데이터 민감도 분류

| 데이터 | 민감도 | 보호 수단 |
|--------|--------|-----------|
| 세특/창체/행특 텍스트 | **높음** (교육정보) | RLS + 역할 기반 접근 |
| 성적 (등급, 원점수) | **매우 높음** | RLS + admin/student만 |
| 진단/역량 평가 | **높음** | RLS + admin/consultant만 |
| 대학 입시 DB | **낮음** (공개 데이터) | 읽기 전체 허용 |

### 5.3 데이터 정합성

#### Server-side NEIS 바이트 검증

클라이언트 검증 우회 방지를 위해 Server Action에서도 동일 검증:

```typescript
// validation.ts
function countNeisBytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code >= 0xAC00 && code <= 0xD7A3) bytes += 3;      // 한글 완성형
    else if (code >= 0x3131 && code <= 0x318E) bytes += 3;  // 한글 자모
    else if (code === 0x000D || code === 0x000A) bytes += 1; // CR/LF 각 1B
    else if (code <= 0x007F) bytes += 1;                     // ASCII
    else bytes += 3;                                          // 기타 (CJK 등)
  }
  return bytes;
}

// actions/record.ts
export async function upsertSetek(data: SetekInput) {
  await requireAdminOrConsultant();
  const bytes = countNeisBytes(data.content);
  const limit = data.charLimit * 3; // NEIS 바이트 = 글자수 × 3 (최대)
  if (bytes > limit) {
    throw new AppError(`NEIS 바이트 초과: ${bytes}B / ${limit}B`, ErrorCode.VALIDATION, 400);
  }
  // ... DB 저장
}
```

#### 공통과목 쌍 합산 검증

2022 개정교육과정 공통과목 쌍(공통국어1 + 공통국어2)의 합산 500자 검증:

```typescript
// service.ts
async function validateSubjectPairLimit(
  studentId: string, schoolYear: number, subjectId: string, newContent: string
) {
  const pair = await findSubjectPair(subjectId);
  if (!pair) return; // 쌍 없으면 검증 불필요

  const pairSetek = await getSetekBySubject(studentId, schoolYear, pair.pairedSubjectId);
  const totalChars = newContent.length + (pairSetek?.content.length ?? 0);
  if (totalChars > pair.sharedCharLimit) {
    throw new AppError(
      `공통과목 쌍 합산 ${totalChars}자 / ${pair.sharedCharLimit}자 초과`,
      ErrorCode.VALIDATION, 400
    );
  }
}
```

#### 낙관적 잠금 (Optimistic Locking)

동시 편집 충돌 방지:

```sql
-- 세특 저장 시 updated_at 비교
UPDATE student_record_seteks
SET content = $1, updated_at = now()
WHERE id = $2 AND updated_at = $3  -- 마지막 조회 시점의 updated_at
RETURNING *;
-- 0 rows affected → 다른 사람이 수정함 → 충돌 알림
```

### 5.4 UX 성능 최적화

#### 자동 저장 (Autosave)

기존 `useAutoSave.ts` 훅 재사용:

```typescript
// SetekEditor 내부
const { status, triggerSave } = useAutoSave({
  data: { content, subjectId },
  saveFn: async (data) => await upsertSetekAction(data),
  options: {
    debounceMs: 2000,           // 2초 디바운스
    enabled: recordStatus === 'draft', // draft 상태만 자동 저장
  },
});
// status: 'idle' | 'saving' | 'saved' | 'error'
```

#### 바이트 카운터 실시간 표시

```typescript
// CharacterCounter.tsx
function CharacterCounter({ content, charLimit }: Props) {
  const bytes = countNeisBytes(content);
  const maxBytes = charLimit * 3;
  const chars = content.length;
  const isOver = chars > charLimit;

  return (
    <span className={cn("text-xs", isOver ? "text-red-500 font-bold" : "text-gray-400")}>
      {chars}/{charLimit}자 ({bytes}/{maxBytes}B)
    </span>
  );
}
```

#### React Hook Form + FormProvider

기존 프로젝트 패턴(`CreateStudentForm`, `SettingsPageClient`) 따라 FormProvider 사용:
- 세특 에디터는 textarea별 독립 필드 → 리렌더링 최소화
- `useWatch`로 개별 필드 변경 감지 → 바이트 카운터만 업데이트

### 5.5 이력 관리 (Versioning) 대비

Phase 10(향후)의 버전 관리를 위해 현재 단계에서 준비할 최소 사항:

```sql
-- 세특/창체/행특에 soft delete 컬럼 추가 (Phase 1에서 미리 생성)
ALTER TABLE student_record_seteks ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE student_record_changche ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE student_record_haengteuk ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- 활성 레코드만 조회하는 인덱스 (student_plan 패턴 동일)
CREATE INDEX idx_srs_active ON student_record_seteks(student_id, school_year)
  WHERE deleted_at IS NULL;
```

- `deleted_at IS NULL` 조건을 repository의 모든 SELECT에 기본 적용
- 본격 버전 이력은 Phase 10에서 `student_record_history` 이벤트 로그 테이블로 확장

### 5.6 AI 비용 추정 (월간)

학생 84명 기준, 프로바이더별 월간 비용 예상:

| AI 작업 | 빈도 | 프로바이더 | 단가 (추정) | 월간 비용 |
|---------|------|-----------|------------|-----------|
| PDF Import 파싱 | 학생당 1회/학기 → 14회/월 | Gemini 멀티모달 | $0.5~1/건 | $7~14 |
| 역량 태그 제안 | 학생당 ~3과목/월 → 250회/월 | Gemini fast | $0.003/건 | $0.75 |
| 종합 진단 생성 | 학생당 1회/학기 → 14회/월 | Claude standard | $0.3/건 | $4.2 |
| 보완전략 제안 | 학생당 1회/학기 → 14회/월 | Gemini Grounding | $0.1/건 | $1.4 |
| 세특 초안 생성 | 학생당 ~3과목/월 → 250회/월 | Claude advanced | $0.1/건 | $25 |
| 면접 질문 생성 | 학생당 1회/학기 → 14회/월 | Claude standard | $0.2/건 | $2.8 |
| **CMS: 가이드 AI 생성** | 월 10~20건 | Claude standard | $1/건 | $10~20 |
| **CMS: 적대적 검증** | 월 10~20건 | Claude standard | $0.5/건 | $5~10 |
| **총 월간 비용** | | | | **$56~78** |

> **Vercel Hobby($0) + Supabase Free + AI $56~78/월** = 총 운영비 $56~78/월
> LLM 캐시 적용 시 30~50% 절감 가능 → 실질 $30~50/월
> 학생 수 200명 초과 시 유료 플랜 전환 + 비용 재추정 필요

**비용 모니터링**: 기존 `llm/metrics/` 인프라로 프로바이더별 토큰/비용 자동 추적. 월간 비용 $100 초과 시 관리자 대시보드 경고.

### 5.7 테스트 자동화 전략

125+ 파일, 29개 테이블 규모에 맞는 테스트 전략. 수동 UI 테스트만으로는 불충분하므로 계층별 자동 테스트 필수.

| 계층 | 대상 | 도구 | 테스트 수 (예상) | Phase |
|------|------|------|-----------------|-------|
| **단위 테스트** | validation.ts (NEIS 바이트, 공통과목 쌍) | Vitest | 30+ | 2 |
| **단위 테스트** | grade-normalizer.ts (9↔5등급 환산) | Vitest | 15+ | 2 |
| **단위 테스트** | min-score-simulator.ts (최저 계산) | Vitest | 20+ | 2 |
| **단위 테스트** | calculator.ts (정시 환산점수) | Vitest | 25+ | 8.2 |
| **단위 테스트** | eligibility.ts (결격사유 체크) | Vitest | 15+ | 8.2 |
| **통합 테스트** | Repository CRUD (happy path + edge case) | Vitest + Supabase local | 40+ | 2 |
| **통합 테스트** | RLS 정책 (다른 tenant/역할 접근 차단) | Vitest + Supabase local | 20+ | 1c |
| **통합 테스트** | AI 응답 파싱 (extractJSON malformed 처리) | Vitest (mock) | 10+ | 5.5 |
| **E2E 테스트** | 세특 입력 → 저장 → 조회 사이클 | Playwright (선택적) | 5+ | 3 |

```typescript
// 결정론적 엔진은 100% 자동 테스트 가능 — 수동 테스트 불필요
// validation.test.ts 예시
describe('countNeisBytes', () => {
  it('한글 1자 = 3B', () => expect(countNeisBytes('가')).toBe(3));
  it('영문 1자 = 1B', () => expect(countNeisBytes('A')).toBe(1));
  it('혼합', () => expect(countNeisBytes('가A')).toBe(4));
  it('500자 한글 = 1500B', () => expect(countNeisBytes('가'.repeat(500))).toBe(1500));
  it('CRLF = 2B', () => expect(countNeisBytes('\r\n')).toBe(2));
  it('이모지 = 4B + 경고', () => expect(countNeisBytes('😀')).toBe(4));
});

// min-score-simulator.test.ts 예시
describe('simulateMinScores', () => {
  it('3합6 충족 (1+2+3=6)', () => {
    const result = simulate({ subjects: ['국어','수학','영어'], count: 3, maxSum: 6 },
                            { '국어': 1, '수학': 2, '영어': 3 });
    expect(result.isMet).toBe(true);
    expect(result.gradeSum).toBe(6);
  });
  it('3합6 미달 (2+3+3=8)', () => {
    const result = simulate({ subjects: ['국어','수학','영어'], count: 3, maxSum: 6 },
                            { '국어': 2, '수학': 3, '영어': 3 });
    expect(result.isMet).toBe(false);
    expect(result.gap).toBe(-2);
  });
});
```

### 5.8 마이그레이션 롤백 전략

29개 테이블을 안전하게 배포하기 위한 단계별 전략.

#### Phase 1 세분화 (19개 → 3개 서브 Phase)

| Sub-Phase | 테이블 | 의존 관계 | 독립 rollback |
|-----------|--------|-----------|---------------|
| **1a** 핵심 기록 | seteks, personal_seteks, changche, haengteuk, reading, subject_pairs | subjects, student_terms 참조 | ✅ 가능 |
| **1b** 보조 기록 | attendance, awards, volunteer, disciplinary, applications | students 참조만 | ✅ 가능 |
| **1c** 확장 기능 | storylines, storyline_links, roadmap_items, reading_links, interview_questions, min_score_targets, min_score_simulations, school_profiles | 1a 참조 | ✅ 1a 이후 |

#### 롤백 원칙

```
1. 각 Sub-Phase = 독립 마이그레이션 파일 (supabase/migrations/)
2. 각 마이그레이션에 대응하는 down SQL 사전 작성
3. Phase 간 데이터 의존성:
   Phase 1a ← Phase 1c (storyline_links가 seteks 참조)
   Phase 1a ← Phase 5 (activity_tags가 seteks 참조)
   Phase 5  ← Phase 6~7 (진단이 역량 데이터 필요)
   Phase 8.1 ← Phase 8.2~8.6 (환산 엔진이 입시 DB 필요)
4. 롤백 시: 해당 Phase의 UI 컴포넌트도 함께 비활성화 (feature flag)
5. 프로덕션 배포 전 Supabase 브랜치에서 마이그레이션 테스트
```

#### down 마이그레이션 예시

```sql
-- down_phase_1a.sql
DROP TABLE IF EXISTS student_record_subject_pairs CASCADE;
DROP TABLE IF EXISTS student_record_reading CASCADE;
DROP TABLE IF EXISTS student_record_haengteuk CASCADE;
DROP TABLE IF EXISTS student_record_changche CASCADE;
DROP TABLE IF EXISTS student_record_personal_seteks CASCADE;
DROP TABLE IF EXISTS student_record_seteks CASCADE;
-- 트리거 + 함수도 함께 삭제
DROP FUNCTION IF EXISTS public.update_student_record_seteks_updated_at();
-- ... 기타
```

### 5.9 다형 참조(Polymorphic Reference) 무결성 보호

`activity_tags`, `storyline_links`, `reading_links`의 `record_type + record_id` 패턴은 FK 제약이 불가능하므로, **삭제 시 고아 참조를 정리하는 트리거**를 설치한다.

```sql
-- 범용 고아 참조 정리 함수
CREATE OR REPLACE FUNCTION public.cleanup_polymorphic_refs()
RETURNS TRIGGER AS $$
BEGIN
  -- activity_tags 정리
  DELETE FROM student_record_activity_tags
    WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
  -- storyline_links 정리
  DELETE FROM student_record_storyline_links
    WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
  -- reading_links 정리 (reading만 해당)
  IF TG_ARGV[0] IN ('setek', 'personal_setek', 'changche') THEN
    DELETE FROM student_record_reading_links
      WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 각 원본 테이블에 트리거 설치
CREATE TRIGGER tr_cleanup_setek_refs
  AFTER DELETE ON student_record_seteks
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_polymorphic_refs('setek');

CREATE TRIGGER tr_cleanup_personal_setek_refs
  AFTER DELETE ON student_record_personal_seteks
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_polymorphic_refs('personal_setek');

CREATE TRIGGER tr_cleanup_changche_refs
  AFTER DELETE ON student_record_changche
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_polymorphic_refs('changche');

CREATE TRIGGER tr_cleanup_haengteuk_refs
  AFTER DELETE ON student_record_haengteuk
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_polymorphic_refs('haengteuk');
```

### 5.10 JSONB 인덱싱

`university_score_formulas`의 JSONB 컬럼 검색 최적화:

```sql
-- restrictions 필드 검색 (결격사유 필터)
CREATE INDEX idx_usf_restrictions ON university_score_formulas
  USING GIN (restrictions);

-- subjects_config 필드 검색 (반영 영역 필터)
CREATE INDEX idx_usf_subjects ON university_score_formulas
  USING GIN (subjects_config);
```

---

## 6. AI 레이어 설계

### 6.1 AI 적용 영역 총괄

| # | 영역 | AI 유형 | 프로바이더 | 기존 인프라 | Phase | 성격 |
|---|------|---------|-----------|-------------|-------|------|
| A | PDF → 구조화 파싱 | LLM 멀티모달 | Gemini | provider + rate limiter + quota | 4.5 | 자동화 |
| B | 역량 태그 자동 제안 | LLM structured output | Gemini fast | extractJSON + LLM cache | 5.5 | **제안** (컨설턴트 확인) |
| C | 교과 이수 적합도 | 규칙 기반 | - | constants.ts | 5 | 자동 계산 |
| D | 종합 진단 생성 | LLM 분석 | Claude standard | provider + LLM cache | 6 | **제안** (컨설턴트 수정) |
| E | 조기 경보 확장 | 규칙 기반 | - | earlyWarningService | 6.5 | 자동 감지 |
| F | 보완전략 제안 | LLM + 웹검색 | Gemini Grounding | Grounding + cold start 패턴 | 7 | **제안** (컨설턴트 채택) |
| G | 모평 배치 분석 | 규칙 기반 | - | - (공식 계산) | 8.5 | 자동 계산 |
| H | 졸업생 유사도 매칭 | **SQL 기반** | TypeScript + SQL | alumni-search.ts | 8.6 | 검색 |
| I | 세특 초안 생성 | LLM 생성 | Claude advanced | provider + streaming | 9 | **초안** (컨설턴트 편집) |
| J | 수시 Report 생성 | 템플릿 + LLM | 전체 통합 | NEISLayoutRenderer + HTML | 9 | 자동 생성 |

### 6.2 AI 설계 원칙

1. **제안(Suggestion), 강제(Force) 아님**: LLM 출력은 항상 컨설턴트 확인/수정 후 확정. 자동 저장 없음.
2. **Graceful degradation**: rate limit/에러 시 빈 결과 반환, 수동 작업 가능. AI 없어도 모든 기능 동작.
3. **기존 프로바이더 재사용**: 새 프로바이더 추가 없이 `getProvider()` 팩토리 경유. 메트릭 자동 추적.
4. **LLM 캐시 활용**: 동일 입력 재요청 시 캐시 반환. 작업별 TTL 설정.
5. **비용 최적화**: 태그 제안은 Gemini fast (저렴), 진단/초안은 Claude standard/advanced (품질).
6. **규칙 우선**: 교과이수적합도, 모평배치, 결격체크는 LLM 불필요. 결정론적 계산.

### 6.3 프롬프트 설계 원칙

```
- 한국 교육 도메인 전문 용어 사용 (세특, 창체, 행특, 석차등급 등)
- Structured output (JSON schema) 강제 → extractJSON<T>() 파싱
- 글자수 제한 명시 (세특 500자, 행특 300자 등 NEIS 바이트 기준)
- 역량 항목 코드(academic_achievement 등) 그대로 사용 → 매핑 불필요
- 평가 근거(evidence) 반드시 포함 → 컨설턴트 판단 보조
```

### 6.4 LLM 캐시 operation 등록

| operation | TTL | 설명 |
|-----------|-----|------|
| `competency_tagging` | 24h | 세특/창체 텍스트 → 역량 태그 (내용 변경 시 무효화) |
| `diagnosis_generation` | 168h (7일) | 종합 진단 (역량 데이터 변경 시 무효화) |
| `strategy_recommendation` | 48h | 보완전략 제안 (Grounding 결과 포함) |
| `setek_draft` | 1h | 세특 초안 (짧은 TTL, 매번 새 생성 가능) |
| `record_import` | 24h | PDF Import 파싱 결과 (동일 파일 재업로드 시) |

---

## 7. 역량 평가 체계

### 7.1 3대 역량 × 10개 평가항목

에듀엣톡 진단 Report 기준, 대입 학생부종합전형 평가 기준 반영:

| 역량 | 항목 | 코드 | 평가 대상 |
|------|------|------|-----------|
| **학업역량** | 학업성취도 | `academic_achievement` | 성적 추이, 전공 관련 교과 성취 |
| | 학업태도 | `academic_attitude` | 수업 참여, 과제 성실성, 질문 태도 |
| | 탐구력 | `academic_inquiry` | 교과 심화 탐구, 보고서, 발표 |
| **진로역량** | 전공 관련 교과 이수 노력 | `career_course_effort` | 과목 선택의 적합성 |
| | 전공 관련 교과 성취도 | `career_course_achievement` | 전공 관련 과목 성적 |
| | 진로 탐색 활동과 경험 | `career_exploration` | 진로 관련 창체·세특 활동 |
| **공동체역량** | 협업과 소통능력 | `community_collaboration` | 팀 프로젝트, 발표, 토론 |
| | 나눔과 배려 | `community_caring` | 멘토링, 봉사, 동료 지원 |
| | 성실성과 규칙준수 | `community_integrity` | 출결, 과제, 기타과목 관리 |
| | 리더십 | `community_leadership` | 임원, 부장, 자치활동 |

### 7.2 평가 세부질문 (루브릭) — Excel 이름정의 시트 기준

각 평가항목에 대해 컨설턴트가 판단할 때 참고하는 42개 질문:

| 항목 | 세부질문 |
|------|---------|
| **학업성취도** | 기본 교과목의 교과성적은 적절한가? / 기본 교과목 이외 과목 성적은? / 유난히 소홀한 과목이 있는가? / 학기별·학년별 성적 추이는? |
| **학업태도** | 성취동기와 목표의식을 가지고 자발적으로 학습하려는 의지가 있는가? / 새로운 지식 획득을 위해 자기주도적으로 노력하고 있는가? / 교과 수업에 적극 참여하여 이해하려는 태도와 열정이 있는가? |
| **탐구력** | 교과와 각종 탐구활동 등을 통해 지식을 확장하려고 노력하고 있는가? / 교과와 탐구활동에서 구체적인 성과를 보이고 있는가? / 교내 활동에서 학문에 대한 열의와 지적 관심이 드러나고 있는가? |
| **전공관련 교과이수** | 전공 관련 과목을 적절하게 선택하고 이수한 과목은 얼마나 되는가? / 이수하기 위하여 추가적인 노력을 하였는가? / 선택과목은 교과목 학습단계에 따라 이수하였는가? |
| **전공관련 성취도** | 전공 관련 과목의 성취수준은 적절한가? / 동일 교과 내 일반선택 대비 진로선택 성취수준은? |
| **진로탐색** | 자신의 관심 분야나 흥미와 관련한 다양한 활동에 참여하여 노력한 경험이 있는가? / 교과 활동이나 창체에서 전공에 대한 관심을 가지고 탐색한 경험이 있는가? |
| **협업과 소통** | 단체 활동에서 서로 돕고 함께 행동하는 모습이 보이는가? / 공동의 과제를 수행하고 완성한 경험이 있는가? / 타인의 의견에 공감·수용하며 자신의 정보와 생각을 잘 전달하는가? |
| **나눔과 배려** | 학교생활 속에서 나눔을 실천하고 생활화한 경험이 있는가? / 타인을 위하여 양보하거나 배려를 실천한 구체적 경험이 있는가? / 상대를 이해하고 존중하는 노력을 기울이고 있는가? |
| **성실성과 규칙준수** | 교내 활동에서 자신이 맡은 역할에 최선을 다하려고 노력한 경험이 있는가? / 자신이 속한 공동체가 정한 규칙과 규정을 준수하고 있는가? |
| **리더십** | 공동체의 목표를 달성하기 위해 계획하고 실행을 주도한 경험이 있는가? / 구성원들의 인정과 신뢰를 바탕으로 참여를 이끌어내고 조율한 경험이 있는가? |

> 이 질문들은 `constants.ts`에 상수로 정의하여 CompetencyScoreCard UI에서 도움말로 표시.

### 7.3 등급 체계

| 등급 | 점수 | 설명 | 역량별 루브릭 (학업역량 기준) |
|------|------|------|------------------------------|
| A+ | 93~94 | 탁월함, 높은 이해력, 차별적 성취 | 학업 수행 능력이 충분히 확인되며, 심화 학습과 차별적 성취가 드러남 |
| A- | 87 | 부정적 평가 없으나 심화 학습 부족 | 대학 입학 후 학업을 수행할 수 있는 능력이 충분히 확인됨 |
| B+ | 83~85 | 평균 이상, 교과 간 편차 있음 | 학업을 충실히 수행할 수 있는 기초 수학 능력을 꾸준히 발전시킴 |
| B | 평균 수준, 성취도 편차 큼 |
| B- | 77 | 평균 수준, 이해와 준비도 부족 | 학업 역량이 다소 부족하며, 전공에 대한 이해와 준비도가 부족함 |
| C | 66~68 | 평균 이하, 자율적 탐구활동 없음 | 대학에서 학업을 충실히 수행하기 위한 학업 능력이 다소 부족함 |

> 역량별(학업/진로/공동체) 각각 A/B/C 루브릭 텍스트가 다름. `constants.ts`에 전체 정의.

### 7.4 점수↔등급 환산표 — Excel 이름정의 시트 기준

성적 분석 시 사용하는 점수→등급 환산:

| 등급 | 점수 | z점수 | 석차백분위 | 조정등급 | 세부등급 |
|------|------|-------|-----------|---------|---------|
| A+ | 93~94 | 3.0 | 0.13% | 1.08 | 1 |
| A- | 87 | 2.8 | 0.26% | 1.22 | 3 |
| B+ | 83~85 | 2.1~2.5 | 1.79~0.62% | 1.71~1.43 | 4~5 |
| B | 80~82 | 1.8~2.0 | 3.59~2.28% | 1.92~1.78 | 6 |
| B- | 77~79 | 1.3~1.5 | 9.68~6.68% | 2.93~2.49 | 7~8 |
| C | 66~72 | 0.2~1.0 | 42.07~15.87% | 5.05~3.49 | 9 |

> `constants.ts`에 환산표 정의. ScoreSummaryView에서 성적 등급 산출 시 활용.

### 7.5 전공 계열별 추천 교과목 — Excel 이름정의 시트 기준

진로역량 "전공 관련 교과 이수 노력" 평가 시 참조. 15+ 계열별 일반선택/진로선택 추천 목록:

| 계열 | 일반선택 | 진로선택 |
|------|---------|---------|
| 법·행정 | 확률과통계, 생활과윤리, 윤리와사상, 경제, 정치와법, 사회·문화, 한문Ⅰ | 사회문제탐구 |
| 경영·경제 | 미적분, 확률과통계, 세계지리, 세계사, 경제, 정치와법, 사회·문화, 제2외국어Ⅰ | 경제수학, 사회문제탐구, 영어권문화, 제2외국어Ⅱ |
| 심리 | 확률과통계, 생활과윤리, 윤리와사상, 경제, 정치와법, 사회·문화, 생명과학Ⅰ | 사회문제탐구, 생명과학Ⅱ |
| 사회복지 | 확률과통계, 생활과윤리, 윤리와사상, 경제, 정치와법, 사회·문화 | 사회문제탐구 |
| 교육 | 확률과통계, 전공관련 일반선택, 교육학 | 사회문제탐구, 전공관련 진로선택 |
| 국어 | 윤리와사상, 한국지리, 사회·문화, 한문Ⅰ | 심화국어, 고전과윤리, 한문Ⅱ |
| 외국어 | 윤리와사상, 세계지리, 동아시아사, 세계사, 제2외국어Ⅰ, 한문Ⅰ | 영어권문화, 영미문학읽기, 제2외국어Ⅱ, 한문Ⅱ |
| 사학·철학 | 확률과통계, 윤리와사상, 한국지리, 세계지리, 세계사, 동아시아사, 사회·문화, 제2외국어Ⅰ, 한문Ⅰ | 고전읽기, 고전과윤리, 제2외국어Ⅱ, 한문Ⅱ |
| 언론·홍보 | 확률과통계, 세계지리, 세계사, 동아시아사, 경제, 정치와법, 사회·문화, 윤리와사상 | 고전과윤리, 사회문제탐구 |
| 정치·외교 | 확률과통계, 생활과윤리, 윤리와사상, 경제, 정치와법, 사회·문화, 제2외국어Ⅰ, 한문Ⅰ | 영어권문화, 사회문제탐구, 제2외국어Ⅱ |
| 수리·통계 | 미적분, 확률과통계, 경제, 정보 | 기하, 수학과제탐구, 인공지능수학 |
| 물리·천문 | 미적분, 확률과통계, 물리학Ⅰ, 화학Ⅰ, 생명과학Ⅰ, 지구과학Ⅰ | 기하, 수학과제탐구, 물리학Ⅱ, 화학Ⅱ, 지구과학Ⅱ, 과학사 |
| 생명·바이오 | 미적분, 확률과통계, 물리학Ⅰ, 화학Ⅰ, 생명과학Ⅰ, 생활과윤리 | 물리학Ⅱ, 화학Ⅱ, 생명과학Ⅱ, 과학사 |
| 의학·약학 | 미적분, 확률과통계, 물리학Ⅰ, 화학Ⅰ, 생명과학Ⅰ, 생활과윤리, 정치와법, 보건 | 화학Ⅱ, 생명과학Ⅱ |
| 컴퓨터·정보 | 미적분, 확률과통계, 물리학Ⅰ, 생활과윤리, 정보 | 기하, 인공지능수학, 수학과제탐구, 물리학Ⅱ, 인공지능기초 |
| 기계·자동차·로봇 | 미적분, 확률과통계, 물리학Ⅰ, 화학Ⅰ, 정보 | 기하, 수학과제탐구, 인공지능수학, 물리학Ⅱ, 화학Ⅱ, 융합과학, 인공지능기초 |
| 화학·신소재·에너지 | 미적분, 확률과통계, 물리학Ⅰ, 화학Ⅰ, 생명과학Ⅰ | 기하, 물리학Ⅱ, 화학Ⅱ, 생명과학Ⅱ, 과학사, 생활과과학 |
| 건축·사회시스템 | 미적분, 확률과통계, 한국지리, 세계지리, 물리학Ⅰ, 화학Ⅰ, 지구과학Ⅰ | 기하, 물리학Ⅱ, 화학Ⅱ, 지구과학Ⅱ |

> `constants.ts` 또는 시드 데이터로 정의. 학생의 `target_major`와 실제 이수 과목을 비교하여 "교과 이수 적합도" 자동 산출에 활용.

### 7.6 활동 평가 분류

각 세특/창체/행특 기록에 대해:

| 평가 | 코드 | 의미 |
|------|------|------|
| 긍정요소 | `positive` | 해당 역량의 강점으로 작용 |
| 부정요소 | `negative` | 보완 필요, 약점으로 작용 |
| 확인필요 | `needs_review` | 내용 확인 또는 보강 필요 |

---

## 8. DB 스키마

### 8.1 `student_record_seteks` (교과 세특)

```sql
CREATE TABLE IF NOT EXISTS student_record_seteks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_term_id  uuid REFERENCES student_terms(id) ON DELETE SET NULL,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  semester         integer NOT NULL CHECK (semester IN (1, 2)),
  subject_id       uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  content          text NOT NULL DEFAULT '',
  content_bytes    integer GENERATED ALWAYS AS (octet_length(content)) STORED,
  char_limit       integer NOT NULL DEFAULT 500,
  status           varchar(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'review', 'final')),
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz DEFAULT NULL,
  UNIQUE(tenant_id, student_id, school_year, grade, semester, subject_id)
);
```

### 8.2 `student_record_personal_seteks` (개인 세특 — 학교자율과정)

교과세특과 달리 `subject_id` 없이 자유 주제로 기록.

```sql
CREATE TABLE IF NOT EXISTS student_record_personal_seteks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  title            varchar(200) NOT NULL DEFAULT '',
  content          text NOT NULL DEFAULT '',
  content_bytes    integer GENERATED ALWAYS AS (octet_length(content)) STORED,
  char_limit       integer NOT NULL DEFAULT 500,
  status           varchar(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'review', 'final')),
  sort_order       integer NOT NULL DEFAULT 0,
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
-- 개인세특은 학교자율과정 주제별 복수 레코드 허용 (교과세특과 달리 UNIQUE 제약 없음)
-- sort_order로 순서 관리
```

### 8.3 `student_record_changche` (창체)

```sql
CREATE TABLE IF NOT EXISTS student_record_changche (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  activity_type    varchar(20) NOT NULL
                     CHECK (activity_type IN ('autonomy', 'club', 'career')),
  hours            numeric(5,1),           -- 활동 시간 (로드맵 템플릿 필수 항목)
  content          text NOT NULL DEFAULT '',
  content_bytes    integer GENERATED ALWAYS AS (octet_length(content)) STORED,
  char_limit       integer NOT NULL DEFAULT 500,
  status           varchar(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'review', 'final')),
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz DEFAULT NULL,
  UNIQUE(tenant_id, student_id, school_year, grade, activity_type)
);
```

### 8.4 `student_record_haengteuk` (행특)

```sql
CREATE TABLE IF NOT EXISTS student_record_haengteuk (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  content          text NOT NULL DEFAULT '',
  content_bytes    integer GENERATED ALWAYS AS (octet_length(content)) STORED,
  char_limit       integer NOT NULL DEFAULT 500,
  status           varchar(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'review', 'final')),
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz DEFAULT NULL,
  UNIQUE(tenant_id, student_id, school_year, grade)
);
```

### 8.5 `student_record_reading` (독서활동)

```sql
CREATE TABLE IF NOT EXISTS student_record_reading (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  subject_area     varchar(50) NOT NULL,
  book_title       varchar(200) NOT NULL,
  author           varchar(100),
  notes            text,
  is_recommended   boolean NOT NULL DEFAULT false,
  recommendation_reason text,
  post_reading_activity text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

### 8.6 `student_record_subject_pairs` (공통과목 쌍 참조)

```sql
CREATE TABLE IF NOT EXISTS student_record_subject_pairs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_revision_id uuid NOT NULL REFERENCES curriculum_revisions(id) ON DELETE CASCADE,
  subject_id_1           uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  subject_id_2           uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  shared_char_limit      integer NOT NULL DEFAULT 500,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE(curriculum_revision_id, subject_id_1, subject_id_2)
);
```

### 8.7 `student_record_competency_scores` (역량 평가)

```sql
CREATE TABLE IF NOT EXISTS student_record_competency_scores (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  scope            varchar(20) NOT NULL DEFAULT 'yearly'
                     CHECK (scope IN ('yearly', 'cumulative')),
  competency_area  varchar(30) NOT NULL
                     CHECK (competency_area IN ('academic', 'career', 'community')),
  competency_item  varchar(40) NOT NULL
                     CHECK (competency_item IN (
                       'academic_achievement', 'academic_attitude', 'academic_inquiry',
                       'career_course_effort', 'career_course_achievement', 'career_exploration',
                       'community_collaboration', 'community_caring',
                       'community_integrity', 'community_leadership'
                     )),
  grade_value      varchar(5) NOT NULL
                     CHECK (grade_value IN ('A+', 'A-', 'B+', 'B', 'B-', 'C')),
  notes            text,
  evaluated_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  evaluated_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, student_id, school_year, scope, competency_item)
);
```

### 8.8 `student_record_activity_tags` (활동별 역량 태그)

세특/창체/행특 기록에 역량 태그를 연결하는 junction 테이블.

```sql
CREATE TABLE IF NOT EXISTS student_record_activity_tags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  -- 다형 참조: record_type + record_id로 원본 테이블 식별
  record_type      varchar(30) NOT NULL
                     CHECK (record_type IN (
                       'setek', 'personal_setek', 'changche', 'haengteuk'
                     )),
  record_id        uuid NOT NULL,
  competency_item  varchar(40) NOT NULL,
  evaluation       varchar(20) NOT NULL DEFAULT 'positive'
                     CHECK (evaluation IN ('positive', 'negative', 'needs_review')),
  evidence_summary text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

### 8.9 `student_record_diagnosis` (종합 진단)

학생별 학년도 단위 종합 진단 보고서.

```sql
CREATE TABLE IF NOT EXISTS student_record_diagnosis (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id            uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year           integer NOT NULL,
  overall_grade         varchar(5) NOT NULL DEFAULT 'B'
                          CHECK (overall_grade IN ('A+', 'A-', 'B+', 'B', 'B-', 'C')),
  record_direction      varchar(50),
  direction_strength    varchar(20) DEFAULT 'moderate'
                          CHECK (direction_strength IN ('strong', 'moderate', 'weak')),
  strengths             text[] NOT NULL DEFAULT '{}',
  weaknesses            text[] NOT NULL DEFAULT '{}',
  recommended_majors    text[] NOT NULL DEFAULT '{}',
  strategy_notes        text,
  evaluated_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  evaluated_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, student_id, school_year)
);
```

### 8.10 `student_record_strategies` (보완전략)

학년별 영역별 보완전략. 컨설턴트가 작성하는 가이드.

```sql
CREATE TABLE IF NOT EXISTS student_record_strategies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  target_area      varchar(30) NOT NULL
                     CHECK (target_area IN (
                       'autonomy', 'club', 'career',
                       'setek', 'personal_setek', 'reading',
                       'haengteuk', 'score', 'general'
                     )),
  target_subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  strategy_content  text NOT NULL DEFAULT '',
  priority          varchar(20) DEFAULT 'medium'
                      CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status            varchar(20) NOT NULL DEFAULT 'planned'
                      CHECK (status IN ('planned', 'in_progress', 'done')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

### 8.11 `student_record_attendance` (학교 출결 — NEIS 기준)

학원 출결(`attendance_records`)과 별도. NEIS 기준 질병/미인정/기타 세분화.

```sql
CREATE TABLE IF NOT EXISTS student_record_attendance (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id            uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year           integer NOT NULL,
  grade                 integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  school_days           integer,              -- 수업일수
  -- 결석
  absence_sick          integer DEFAULT 0,    -- 질병 결석
  absence_unauthorized  integer DEFAULT 0,    -- 미인정 결석
  absence_other         integer DEFAULT 0,    -- 기타 결석
  -- 지각
  lateness_sick         integer DEFAULT 0,
  lateness_unauthorized integer DEFAULT 0,
  lateness_other        integer DEFAULT 0,
  -- 조퇴
  early_leave_sick      integer DEFAULT 0,
  early_leave_unauthorized integer DEFAULT 0,
  early_leave_other     integer DEFAULT 0,
  -- 결과
  class_absence_sick    integer DEFAULT 0,
  class_absence_unauthorized integer DEFAULT 0,
  class_absence_other   integer DEFAULT 0,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, student_id, school_year, grade)
);
```

### 8.12 `student_record_applications` (지원 결과)

졸업생 합격 데이터 + 현재 학생 지원 추적. 후배 컨설팅 참고자료로 활용.

```sql
CREATE TABLE IF NOT EXISTS student_record_applications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  round            varchar(30) NOT NULL
                     CHECK (round IN (
                       -- 수시
                       'early_comprehensive',    -- 학생부종합
                       'early_subject',          -- 학생부교과
                       'early_essay',            -- 논술
                       'early_practical',        -- 실기/실적
                       'early_special',          -- 특별전형 (농어촌, 기회균형 등)
                       'early_other',            -- 기타 수시
                       -- 정시
                       'regular_ga',             -- 정시 가군
                       'regular_na',             -- 정시 나군
                       'regular_da',             -- 정시 다군
                       -- 기타
                       'additional',             -- 추가모집
                       'special_quota'           -- 정원외전형
                     )),
  university_name  varchar(100) NOT NULL,
  department       varchar(100) NOT NULL,
  admission_type   varchar(100),
  result           varchar(20) NOT NULL DEFAULT 'pending'
                     CHECK (result IN ('pending', 'accepted', 'waitlisted', 'rejected', 'registered')),
  waitlist_number  integer,
  -- 일정 관리 (면접일 겹침 체크 + 전형 캘린더)
  application_deadline  date,              -- 원서접수 마감일
  interview_date        date,              -- 면접일
  interview_time        time,              -- 면접 시간
  result_date           date,              -- 합격자 발표일
  registration_deadline date,              -- 등록금 납부 마감일
  -- 정시 전용: 가채점/실채점 구분
  score_type       varchar(20)
                     CHECK (score_type IN ('estimated', 'actual')), -- 가채점/실채점
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

### 8.13 `student_record_awards` (수상경력)

대입 미반영(2021~)이지만 컨설팅 기록/분석용.

```sql
CREATE TABLE IF NOT EXISTS student_record_awards (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  award_name       varchar(200) NOT NULL,
  award_level      varchar(50),
  award_date       date,
  awarding_body    varchar(100),
  participants     varchar(50),
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

### 8.14 `student_record_volunteer` (봉사활동)

2022 개정에서 창체 독립 영역 폐지되었지만 기록 관리.

```sql
CREATE TABLE IF NOT EXISTS student_record_volunteer (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  activity_date    varchar(50),
  location         varchar(200),
  description      text,
  hours            numeric(5,1) NOT NULL,
  cumulative_hours numeric(6,1),
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

### 8.15 `student_record_disciplinary` (징계사항)

```sql
CREATE TABLE IF NOT EXISTS student_record_disciplinary (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  decision_date    date,
  action_type      varchar(100) NOT NULL,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

### 8.16 인덱스

```sql
-- seteks
CREATE INDEX IF NOT EXISTS idx_srs_student_year ON student_record_seteks(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srs_tenant ON student_record_seteks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_srs_status ON student_record_seteks(status) WHERE status != 'final';

-- personal_seteks
CREATE INDEX IF NOT EXISTS idx_srps_student_year ON student_record_personal_seteks(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srps_tenant ON student_record_personal_seteks(tenant_id);

-- changche
CREATE INDEX IF NOT EXISTS idx_src_student_year ON student_record_changche(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_src_tenant ON student_record_changche(tenant_id);

-- haengteuk
CREATE INDEX IF NOT EXISTS idx_srh_student_year ON student_record_haengteuk(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srh_tenant ON student_record_haengteuk(tenant_id);

-- reading
CREATE INDEX IF NOT EXISTS idx_srr_student_year ON student_record_reading(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srr_tenant ON student_record_reading(tenant_id);

-- subject_pairs
CREATE INDEX IF NOT EXISTS idx_srsp_curriculum ON student_record_subject_pairs(curriculum_revision_id);

-- competency_scores
CREATE INDEX IF NOT EXISTS idx_srcs_student_year ON student_record_competency_scores(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srcs_tenant ON student_record_competency_scores(tenant_id);

-- activity_tags
CREATE INDEX IF NOT EXISTS idx_srat_record ON student_record_activity_tags(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_srat_student ON student_record_activity_tags(student_id);
CREATE INDEX IF NOT EXISTS idx_srat_tenant ON student_record_activity_tags(tenant_id);

-- diagnosis
CREATE INDEX IF NOT EXISTS idx_srd_student_year ON student_record_diagnosis(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srd_tenant ON student_record_diagnosis(tenant_id);

-- strategies
CREATE INDEX IF NOT EXISTS idx_srst_student_year ON student_record_strategies(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srst_tenant ON student_record_strategies(tenant_id);

-- attendance (NEIS)
CREATE INDEX IF NOT EXISTS idx_sratt_student_year ON student_record_attendance(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_sratt_tenant ON student_record_attendance(tenant_id);

-- applications
CREATE INDEX IF NOT EXISTS idx_srap_student_year ON student_record_applications(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srap_tenant ON student_record_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_srap_result ON student_record_applications(result) WHERE result = 'accepted';

-- awards
CREATE INDEX IF NOT EXISTS idx_sraw_student_year ON student_record_awards(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_sraw_tenant ON student_record_awards(tenant_id);

-- volunteer
CREATE INDEX IF NOT EXISTS idx_srv_student_year ON student_record_volunteer(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srv_tenant ON student_record_volunteer(tenant_id);

-- disciplinary
CREATE INDEX IF NOT EXISTS idx_srdi_student_year ON student_record_disciplinary(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srdi_tenant ON student_record_disciplinary(tenant_id);
```

### 8.17 RLS — SECURITY DEFINER 헬퍼 패턴

프로젝트 최신 패턴(`20260316_unify_rls_security_definer` 기준) 적용.
기존 `rls_check_admin_tenant()` 등 헬퍼 함수를 재사용한다.

```sql
-- tenant_id NOT NULL 테이블 (student_record_* 전체)
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{table}_admin_all" ON {table}
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- 학생 본인 조회 (읽기전용)
CREATE POLICY "{table}_student_select" ON {table}
  FOR SELECT
  USING (public.rls_check_student_own(student_id));
```

```sql
-- tenant_id NULL 테이블 (university_admissions, university_score_formulas)
-- 시스템 공유 데이터 → 전체 읽기 허용, 쓰기는 admin만
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{table}_read_all" ON {table}
  FOR SELECT USING (true);

CREATE POLICY "{table}_admin_write" ON {table}
  FOR ALL
  USING (public.rls_check_any_admin())
  WITH CHECK (public.rls_check_any_admin());
```

### 8.18 updated_at 트리거 — 테이블별 독립 함수

프로젝트 패턴: `update_{table}_updated_at()` + `tr_{table}_updated_at` (테이블별 독립).

```sql
-- 각 테이블마다 독립 함수 + 트리거 생성 (예시: seteks)
CREATE OR REPLACE FUNCTION public.update_student_record_seteks_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_student_record_seteks_updated_at
  BEFORE UPDATE ON student_record_seteks
  FOR EACH ROW EXECUTE FUNCTION public.update_student_record_seteks_updated_at();

-- 동일 패턴 적용 대상 (updated_at 있는 테이블):
-- student_record_seteks, student_record_personal_seteks,
-- student_record_changche, student_record_haengteuk,
-- student_record_reading, student_record_attendance,
-- student_record_applications, student_record_competency_scores,
-- student_record_diagnosis, student_record_strategies,
-- university_admissions, university_score_formulas
```

---

## 9. 학년 구분 구조

생기부는 **학년 단위**로 누적 기록된다:

```
고1 (2024학년도)          고2 (2025학년도)          고3 (2026학년도)
├─ 출결상황 (연간,NEIS) ├─ 출결상황 (연간,NEIS) ├─ 출결상황 (연간,NEIS)
├─ 수상경력              ├─ 수상경력              ├─ 수상경력
├─ 징계사항              ├─ 징계사항              ├─ 징계사항
├─ 창체 (연간+시간)      ├─ 창체 (연간+시간)      ├─ 창체 (연간+시간)
│  ├─ 자율 500자         │  ├─ 자율 500자         │  ├─ 자율 500자
│  ├─ 동아리 500자       │  ├─ 동아리 500자       │  ├─ 동아리 500자
│  └─ 진로 700→500자     │  └─ 진로 700→500자     │  └─ 진로 500자
├─ 봉사활동              ├─ 봉사활동              ├─ 봉사활동
├─ 교과학습 (학기별)     ├─ 교과학습 (학기별)     ├─ 교과학습 (학기별)
│  ├─ 1학기 성적+세특    │  ├─ 1학기 성적+세특    │  ├─ 1학기 성적+세특
│  └─ 2학기 성적+세특    │  └─ 2학기 성적+세특    │  └─ 2학기 성적+세특
├─ 개인세특 (학년)       ├─ 개인세특 (학년)       ├─ 개인세특 (학년)
├─ 독서활동 (연간)       ├─ 독서활동 (연간)       ├─ 독서활동 (연간)
├─ 모의고사 추이         ├─ 모의고사 추이         ├─ 모의고사 추이
├─ 행특 500→300자        ├─ 행특 500→300자        ├─ 행특 300자
├─ ── 진단 레이어 ──     ├─ ── 진단 레이어 ──     ├─ ── 진단 레이어 ──
├─ 역량 평가 (10항목)    ├─ 역량 평가 (10항목)    ├─ 역량 평가 (10항목)
├─ 활동별 역량 태그      ├─ 활동별 역량 태그      ├─ 활동별 역량 태그
├─ 종합 진단             ├─ 종합 진단             ├─ 종합 진단
├─ 보완전략              ├─ 보완전략              ├─ 보완전략
└─ 지원 결과             └─ 지원 결과             └─ 지원 결과
```

### 기존 테이블 연결

- `student_terms` (학기 단위): 세특의 `student_term_id`로 연결
- `student_internal_scores`: 성적 데이터 (기존) — `estimated_percentile`, `adjusted_grade` 활용
- `students`: `grade`, `school_type`, `target_major`, `desired_career_field`, `desired_university_ids`
- `curriculum_revisions`: 2015/2022 개정교육과정 구분

### 교육과정별 분기

| 구분 | 2015 개정 (현 고2·고3) | 2022 개정 (2025 고1~) |
|------|------------------------|------------------------|
| 과목 편성 | 공통과목 1년 단위 | 공통국어1(1학기)+공통국어2(2학기) 별개 |
| 세특 | 과목당 500자 (연간) | 과목별 500자, **공통과목 쌍 합산 500자** |
| 창체 | 4영역 (자율/동아리/봉사/진로) | 3영역 (자율·자치/동아리/진로) |
| 등급 | 9등급 | 5등급 |

---

## 10. PDF Import 파이프라인 (생기부 변환기 통합)

### 10.1 개요

NEIS에서 출력한 생기부 PDF를 업로드하면 AI가 구조화된 데이터로 파싱하여 DB에 일괄 저장한다.
기존 독립 앱(`학교생활기록부-변환기`)의 핵심 로직을 TimeLevelUp에 통합.

```
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐
│ PDF 업로드 │ →  │ 페이지별   │ →  │ Gemini AI │ →  │ 미리보기 + │ →  │ DB 일괄   │
│ (드래그&   │    │ 이미지 추출│    │ 구조화    │    │ 매핑 확인  │    │ 저장      │
│  드롭)     │    │ (pdfjs)   │    │ 파싱      │    │ (관리자)   │    │ (upsert)  │
└──────────┘    └───────────┘    └──────────┘    └───────────┘    └──────────┘
```

### 10.2 지원 입력 형식

| 형식 | 처리 방식 |
|------|-----------|
| PDF (NEIS 출력물) | `pdfjs-dist`로 페이지별 이미지 추출 → Gemini 멀티모달 |
| HTML (나이스 웹 저장) | 텍스트 직접 전달 → Gemini 텍스트 파싱 |
| 이미지 (사진/스캔) | base64 직접 전달 → Gemini 멀티모달 |

### 10.3 AI 파싱 스키마 (Gemini Structured Output)

기존 변환기의 스키마를 확장하여 성적·출결·독서활동도 추출:

```typescript
type RecordImportData = {
  // ── 기존 변환기 출력 ──
  fullHtml: string;
  fullText: string;
  creativeActivities: {
    grade: string;              // "1학년", "2학년", "3학년"
    category: string;           // "자율활동", "동아리활동", "진로활동"
    content: string;
  }[];
  detailedCompetencies: {
    grade: string;
    semester: string;           // "1학기", "2학기" (신규 추가)
    subject: string;            // "국어", "수학" 등
    content: string;
  }[];
  behavioralCharacteristics: {
    grade: string;
    content: string;
  }[];

  // ── 확장 필드 ──
  grades: {                     // 교과 성적
    grade: string;
    semester: string;
    subject: string;
    subjectType: string;        // "일반선택", "진로선택", "공통" 등
    creditHours: number;
    rawScore: number;
    classAverage: number;
    standardDeviation: number;
    achievementLevel: string;   // A, B, C, D, E
    totalStudents: number;
    rankGrade: number;
  }[];
  attendance: {                 // 출결
    grade: string;
    authorizedAbsence: number;  // 인정결석
    sickAbsence: number;        // 질병결석
    unauthorizedAbsence: number;// 미인정결석
    lateness: number;
    earlyLeave: number;
    classAbsence: number;       // 수업결손
  }[];
  readingActivities: {          // 독서활동
    grade: string;
    subjectArea: string;        // 교과 또는 공통
    bookTitle: string;
    author: string;
  }[];
  studentInfo: {                // 인적사항
    name: string;
    schoolName: string;
    schoolYear: number;         // 입학년도
  };
};
```

### 10.4 과목명 → subject_id 매칭

PDF에서 추출된 과목명(문자열)을 DB의 `subjects.id`에 매칭하는 로직:

```typescript
// lib/domains/student-record/import/subject-matcher.ts

/**
 * 1. 정확 매칭: subjects.name = parsedSubject
 * 2. 정규화 매칭: 공백/특수문자 제거 후 비교 (e.g. "수학Ⅰ" → "수학1")
 * 3. 미매칭: unmatchedSubjects[]에 수집 → 미리보기에서 수동 매핑 UI 제공
 */
async function matchSubjects(
  parsedSubjects: string[],
  curriculumRevisionId: string,
  tenantId: string
): Promise<Map<string, { subjectId: string; confidence: number }>> { ... }
```

### 10.5 Import 플로우 (관리자 UI)

```
1. "생기부 PDF 가져오기" 버튼 클릭 → 모달 오픈
2. 파일 드래그&드롭 (PDF/HTML/이미지)
3. "분석 시작" → 프로그레스 표시 (이미지 추출 → AI 파싱, ~30초~2분)
4. 파싱 결과 미리보기:
   ┌─────────────────────────────────────────────┐
   │  📄 이다은_생기부.pdf  분석 완료             │
   │                                               │
   │  ✅ 창체: 9건 (자율3, 동아리3, 진로3)        │
   │  ✅ 세특: 24건 (국어4, 수학4, 영어4, ...)    │
   │  ✅ 행특: 2건                                 │
   │  ⚠️ 성적: 34건 (2건 과목 미매칭 → 수동 선택) │
   │  ✅ 독서: 8건                                 │
   │  ✅ 출결: 2건                                 │
   │                                               │
   │  ⚠️ 미매칭 과목:                              │
   │  "기술·가정" → [드롭다운: 과목 선택]          │
   │  "과학탐구실험" → [드롭다운: 과목 선택]       │
   │                                               │
   │  [기존 데이터 덮어쓰기 ☐]  [취소] [저장]     │
   └─────────────────────────────────────────────┘
5. "저장" → DB upsert (기존 데이터 있으면 확인 후 덮어쓰기)
6. 완료 → 생기부 탭 새로고침 → 데이터 반영 확인
```

### 10.6 기존 인프라 재사용

| 항목 | 재사용 대상 | 비고 |
|------|-------------|------|
| Gemini API 호출 | `lib/domains/plan/llm/` 의 rate limit + quota 관리 | `getGeminiQuotaStatus()` 재사용 |
| Rate limit fallback | cold start의 DB fallback 패턴 | Import는 fallback 불가 → 재시도 안내 |
| PDF 처리 | `pdfjs-dist` (변환기에서 가져옴) | 클라이언트에서 이미지 추출 후 Server Action 전달 |
| 과목 DB | `subjects` + `subject_groups` + `subject_types` | fuzzy 매칭 |
| Auth | `requireAdminOrConsultant` | Import는 관리자/컨설턴트만 가능 |

### 10.7 제약 및 주의사항

- **Gemini 토큰 소비**: 생기부 PDF는 보통 4~8페이지, scale 2.0 이미지 기준 대량 토큰 소비 → 쿼타 주의
- **파싱 정확도**: AI 기반이므로 100% 정확하지 않음 → 미리보기에서 반드시 확인 필요
- **기존 데이터 보호**: 이미 입력된 기록이 있으면 덮어쓰기 전 경고 + 확인 필요
- **성적 데이터**: `student_internal_scores`에 이미 성적이 있으면 Import 대상에서 제외 옵션
- **NEIS 바이트 검증**: Import된 content도 글자수 제한 검증 적용 (원본 초과 시 경고만, 차단 X)

---

## 11. 도메인 레이어 구조

```
lib/domains/student-record/
├── types.ts                  # DB 파생 타입, 집계 타입
├── constants.ts              # 역량 항목, 등급, 글자수 제한, 루브릭 질문, 환산표, 계열별 추천교과
├── validation.ts             # 글자수/바이트 제한 룰, NEIS 바이트 카운팅
├── repository.ts             # Supabase CRUD (throw on error)
├── competency-repository.ts  # 역량 평가 CRUD
├── diagnosis-repository.ts   # 진단/전략 CRUD
├── service.ts                # 비즈니스 로직 (char limit 검증, subject pair 체크)
├── course-adequacy.ts        # 교과 이수 적합도 (규칙 기반, AI 불필요)
├── import/                   # PDF Import 파이프라인 [AI: Gemini 멀티모달]
│   ├── types.ts              # RecordImportData, ImportResult
│   ├── parser.ts             # Gemini AI 호출 + 구조화 파싱
│   ├── subject-matcher.ts    # 과목명 → subject_id 매칭
│   ├── mapper.ts             # ParsedData → DB 엔티티 변환
│   └── importer.ts           # DB upsert 오케스트레이션
├── llm/                      # AI 분석 레이어
│   ├── prompts/
│   │   ├── competencyTagging.ts    # 역량 태그 자동 제안 프롬프트
│   │   ├── diagnosisGeneration.ts  # 종합 진단 생성 프롬프트
│   │   ├── strategyRecommend.ts    # 보완전략 제안 프롬프트 (Grounding)
│   │   └── setekDraft.ts           # 세특 초안 생성 프롬프트
│   ├── actions/
│   │   ├── suggestTags.ts          # [AI] 세특/창체 → 역량 태그 + 평가 제안
│   │   ├── generateDiagnosis.ts    # [AI] 역량 데이터 → 종합 진단 자동 생성
│   │   ├── suggestStrategies.ts    # [AI] 진단 + 부족역량 → 보완전략 제안
│   │   └── draftSetek.ts           # [AI] 활동키워드 → 세특 초안 (Phase 9)
│   └── types.ts                    # AI 응답 타입 (TagSuggestion, DiagnosisResult 등)
├── warnings/                 # 조기 경보 확장
│   └── recordWarnings.ts     # 생기부 관련 경고 룰 (기존 earlyWarningService 확장)
├── actions/
│   ├── index.ts              # Re-exports
│   ├── record.ts             # "use server" 세특/창체/행특/독서 CRUD
│   ├── import.ts             # "use server" PDF Import 액션
│   ├── competency.ts         # "use server" 역량 평가 CRUD
│   ├── diagnosis.ts          # "use server" 진단/전략 CRUD
│   ├── ai.ts                 # "use server" AI 제안 액션 (태그/진단/전략)
│   └── student.ts            # "use server" 학생 조회 (resolveAuthContext)
└── index.ts                  # Domain barrel

lib/domains/admission/            # Phase 8 대학 입시 도메인
├── types.ts                      # 대학/전형/입결 타입
├── repository.ts                 # university_admissions CRUD
├── calculator.ts                 # [규칙] 정시 환산점수 계산 엔진
├── eligibility.ts                # [규칙] 결격사유 체크
├── placement.ts                  # [규칙] 모평 배치 판정 (위험~안정)
├── alumni-search.ts              # [SQL] 졸업생 유사도 검색 (TypeScript + SQL)
├── api/
│   └── datagokr.ts               # data.go.kr API 클라이언트
├── actions/
│   ├── search.ts                 # "use server" 대학/입결 검색
│   ├── placement.ts              # "use server" 배치 분석
│   └── sync.ts                   # "use server" 데이터 갱신
└── index.ts
```

### 핵심 타입

```typescript
// ── 1단계: 기록 ──
type StudentRecordYear = {
  schoolYear: number;
  grade: number;
  seteks: RecordSetek[];
  personalSeteks: RecordPersonalSetek[];
  changche: RecordChangche[];           // hours 포함
  haengteuk: RecordHaengteuk | null;
  readings: RecordReading[];
  scores: InternalScore[];
  mockScores: MockScore[];              // 모의고사 추이
  schoolAttendance: RecordAttendance | null; // NEIS 출결
  awards: RecordAward[];
  volunteer: RecordVolunteer[];
  disciplinary: RecordDisciplinary[];
};

// ── 2단계: 진단 ──
type CompetencyScore = {
  competencyArea: 'academic' | 'career' | 'community';
  competencyItem: CompetencyItemCode;
  gradeValue: CompetencyGrade;
  notes?: string;
};

type ActivityTag = {
  recordType: 'setek' | 'personal_setek' | 'changche' | 'haengteuk';
  recordId: string;
  competencyItem: CompetencyItemCode;
  evaluation: 'positive' | 'negative' | 'needs_review';
  evidenceSummary?: string;
};

type Diagnosis = {
  overallGrade: CompetencyGrade;
  recordDirection: string;        // e.g. "법·행정 분야"
  directionStrength: 'strong' | 'moderate' | 'weak';
  strengths: string[];
  weaknesses: string[];
  recommendedMajors: string[];
  strategyNotes?: string;
};

// ── 3단계: 보완전략 ──
type Strategy = {
  targetArea: StrategyArea;
  targetSubjectId?: string;
  strategyContent: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'planned' | 'in_progress' | 'done';
};

// ── 4단계: 지원 결과 ──
type ApplicationRound =
  | 'early_comprehensive' | 'early_subject' | 'early_essay'
  | 'early_practical' | 'early_special' | 'early_other'
  | 'regular_ga' | 'regular_na' | 'regular_da'
  | 'additional' | 'special_quota';

type Application = {
  round: ApplicationRound;
  universityName: string;
  department: string;
  admissionType?: string;
  result: 'pending' | 'accepted' | 'waitlisted' | 'rejected' | 'registered';
  waitlistNumber?: number;
  // 일정
  applicationDeadline?: string;
  interviewDate?: string;
  interviewTime?: string;
  resultDate?: string;
  registrationDeadline?: string;
  // 정시 전용
  scoreType?: 'estimated' | 'actual';  // 가채점/실채점
  notes?: string;
};

// ── 면접일 겹침 체크 ──
type InterviewConflict = {
  applicationId1: string;
  applicationId2: string;
  university1: string;
  university2: string;
  conflictDate: string;
};

// ── 수시 6장 전략 뷰 ──
type ApplicationStrategy = {
  earlySlots: Application[];       // 수시 6장 (최대)
  regularSlots: {
    ga: Application | null;        // 가군 1장
    na: Application | null;        // 나군 1장
    da: Application | null;        // 다군 1장
  };
  additional: Application[];
  totalEarly: number;              // 수시 지원 수 (max 6 체크)
  hasConflict: boolean;            // 군별 중복 체크
  interviewConflicts: InterviewConflict[];
};

// ── 통합 뷰는 사용하지 않음 — 탭별 lazy loading 사용 (섹션 13 참조) ──
// type StudentRecordFull은 deprecated. 대신 RecordTabData, DiagnosisTabData,
// StrategyTabData, StorylineTabData를 탭 전환 시 개별 로드한다.

// ── 상수 ──
type CompetencyItemCode =
  | 'academic_achievement' | 'academic_attitude' | 'academic_inquiry'
  | 'career_course_effort' | 'career_course_achievement' | 'career_exploration'
  | 'community_collaboration' | 'community_caring'
  | 'community_integrity' | 'community_leadership';

type CompetencyGrade = 'A+' | 'A-' | 'B+' | 'B' | 'B-' | 'C';
```

### 글자수 제한 룰

```typescript
const CHAR_LIMITS = {
  setek: { default: 500 },
  personalSetek: { default: 500 },
  autonomy: { default: 500 },
  club: { default: 500 },
  career: { before2026: 700, from2026: 500 },
  haengteuk: { before2026: 500, from2026: 300 },
};

// countNeisBytes는 validation.ts의 정본 구현을 사용 (섹션 5.3 참조)
// TextEncoder.encode().length는 이모지 등 edge case에서 결과가 다를 수 있음
import { countNeisBytes } from './validation';

// ── 루브릭 질문 (42개) ──
const COMPETENCY_RUBRIC_QUESTIONS: Record<CompetencyItemCode, string[]> = {
  academic_achievement: [
    "대학 수학에 필요한 기본 교과목의 교과성적은 적절한가?",
    "기본 교과목 이외 과목 성적은 어느 정도인가?",
    "유난히 소홀한 과목이 있는가?",
    "학기별/학년별 성적의 추이는 어떠한가?",
  ],
  // ... 나머지 9개 항목 (섹션 5.2 참조)
};

// ── 등급 루브릭 텍스트 (역량별 A/B/C 설명) ──
const COMPETENCY_GRADE_RUBRICS: Record<'academic'|'career'|'community', Record<'A'|'B'|'C', string>> = {
  academic: {
    A: "대학 입학 후 학업을 수행할 수 있는 능력이 충분히 확인됨.",
    B: "학업을 충실히 수행할 수 있는 기초 수학 능력을 꾸준히 발전시킴.",
    C: "대학에서 학업을 충실히 수행하기 위한 학업 능력이 다소 부족함.",
  },
  // ... career, community
};

// ── 점수↔등급 환산표 ──
const GRADE_CONVERSION_TABLE = [
  { grade: 'A+', score: [93, 94], zScore: 3.0, percentile: 0.13, adjustedGrade: 1.08 },
  { grade: 'A-', score: [87, 87], zScore: 2.8, percentile: 0.26, adjustedGrade: 1.22 },
  // ... (섹션 5.4 참조)
];

// ── 전공 계열별 추천 교과목 (18개 계열) ──
const MAJOR_RECOMMENDED_COURSES: Record<string, { general: string[]; career: string[] }> = {
  "법·행정": {
    general: ["확률과통계", "생활과윤리", "윤리와사상", "경제", "정치와법", "사회·문화", "한문Ⅰ"],
    career: ["사회문제탐구"],
  },
  // ... (섹션 5.5 참조, 18개 계열)
};

// ── 모평 배치 판정 기준 ──
type PlacementLevel = 'danger' | 'unstable' | 'bold' | 'possible' | 'safe';
// 위험 < 불안 < 소신 < 가능 < 안정
// 내점수 vs 대학별 기준점 비교로 산출 (Phase 8에서 자동화)
```

---

## 12. UI 컴포넌트 구조

### 관리자 UI

```
app/(admin)/admin/students/[id]/_components/student-record/
├── StudentRecordSection.tsx          # Server Component (데이터 fetch)
├── StudentRecordClient.tsx           # Client Component (학년 선택 + 탭 전환)
├── StudentRecordSkeleton.tsx         # Suspense fallback
│
│  ── 1단계: 기록 탭 ──
├── RecordYearSelector.tsx            # 학년도 드롭다운
├── SetekEditor.tsx                   # 교과별 세특 textarea + 바이트 카운터
├── PersonalSetekEditor.tsx           # 개인세특 textarea (제목 + 내용)
├── ChangcheEditor.tsx                # 자율/동아리/진로 3개 textarea
├── HaengteukEditor.tsx               # 행특 textarea
├── ReadingEditor.tsx                 # 독서활동 테이블 (행 추가/삭제 + 추천 구분)
├── ScoreSummaryView.tsx              # 성적 통합 뷰 (읽기전용, 백분위/조정등급 포함)
├── MockScoreTrendView.tsx            # 모의고사 추이 뷰 (학년/월별 표)
├── SchoolAttendanceEditor.tsx        # NEIS 출결 입력 (질병/미인정/기타 세분화)
├── AwardsEditor.tsx                  # 수상경력 행 추가/삭제
├── VolunteerEditor.tsx               # 봉사활동 행 추가/삭제 (시간/누계)
├── DisciplinaryEditor.tsx            # 징계사항 입력
├── ApplicationsEditor.tsx            # 지원 결과 (대학/전형/합격여부)
├── CharacterCounter.tsx              # 바이트/글자수 카운터
├── RecordStatusBadge.tsx             # draft/review/final 뱃지
├── NEISLayoutRenderer.tsx            # NEIS 양식 레이아웃 (admin/student 공유)
│
│  ── PDF Import ──
├── ImportButton.tsx                  # "생기부 PDF 가져오기" 버튼
├── ImportModal.tsx                   # Import 전체 플로우 모달
├── ImportDropzone.tsx                # 파일 드래그&드롭 영역
├── ImportProgress.tsx                # 이미지 추출 + AI 파싱 프로그레스
├── ImportPreview.tsx                 # 파싱 결과 미리보기 (항목별 건수)
├── ImportSubjectMatcher.tsx          # 미매칭 과목 수동 매핑 드롭다운
├── ImportConflictWarning.tsx         # 기존 데이터 덮어쓰기 경고
│
│  ── 2단계: 진단 탭 ──
├── CompetencyScoreCard.tsx           # 3대 역량 × 10항목 등급 입력 카드
├── CompetencyRadarChart.tsx          # 역량 레이더 차트 시각화
├── ActivityTagManager.tsx            # 활동에 역량 태그 부착/제거 UI
├── ActivityEvalBadge.tsx             # 긍정/부정/확인필요 뱃지
├── DiagnosisSummaryEditor.tsx        # 종합 진단: 총평등급, 방향성, 장단점
│
│  ── 3단계: 보완전략 탭 ──
├── StrategyEditor.tsx                # 영역별 보완전략 textarea + 우선순위
├── StrategyStatusTracker.tsx         # 전략 진행상황 (planned/in_progress/done)
└── RecommendedReadingList.tsx        # 추천 독서 목록
```

### 학생 UI

```
app/(student)/student-record/
├── page.tsx                          # Server Component
└── _components/
    ├── StudentRecordViewClient.tsx    # NEISLayoutRenderer readOnly={true}
    └── CompetencyOverview.tsx         # 역량 평가 결과 요약 (읽기전용)
```

### 수정할 기존 파일

| 파일 | 변경 |
|------|------|
| `StudentDetailTabs.tsx` | `TabKey`에 `"student-record"` 추가 |
| `page.tsx` (admin student detail) | 생기부 탭 조건부 렌더링 추가 |
| `database.types.ts` | 마이그레이션 후 재생성 |
| `package.json` | `pdfjs-dist` 의존성 추가 |

---

## 13. React Query — 탭별 Lazy Loading

`StudentRecordFull`은 15+ 테이블을 조인하므로, **탭별로 분리하여 lazy load**한다.
사용자가 선택한 탭의 데이터만 fetch하여 초기 로딩 시간을 1/3로 줄인다.

```typescript
// lib/query-options/studentRecord.ts
export const studentRecordKeys = {
  all: ["studentRecord"] as const,
  // ── 탭별 분리 키 ──
  recordTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "record", studentId, schoolYear] as const,
  diagnosisTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "diagnosis", studentId, schoolYear] as const,
  strategyTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "strategy", studentId, schoolYear] as const,
  storylineTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "storyline", studentId, schoolYear] as const,
  admissionTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "admission", studentId, schoolYear] as const,
  interviewTab: (studentId: string) =>
    [...studentRecordKeys.all, "interview", studentId] as const,
};

// ── 탭별 쿼리 옵션 ──

/** 기록 탭: seteks + changche + haengteuk + reading + attendance */
export function recordTabQueryOptions(studentId: string, schoolYear: number) {
  return queryOptions({
    queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
    queryFn: () => getRecordTabAction(studentId, schoolYear),
    staleTime: 1000 * 300,
  });
}

/** 진단 탭: competency + tags + diagnosis */
export function diagnosisTabQueryOptions(studentId: string, schoolYear: number) {
  return queryOptions({
    queryKey: studentRecordKeys.diagnosisTab(studentId, schoolYear),
    queryFn: () => getDiagnosisTabAction(studentId, schoolYear),
    staleTime: 1000 * 300,
  });
}

/** 전략 탭: strategies + applications + min_score */
export function strategyTabQueryOptions(studentId: string, schoolYear: number) {
  return queryOptions({
    queryKey: studentRecordKeys.strategyTab(studentId, schoolYear),
    queryFn: () => getStrategyTabAction(studentId, schoolYear),
    staleTime: 1000 * 300,
  });
}

/** 스토리라인 탭: storylines + roadmap_items */
export function storylineTabQueryOptions(studentId: string, schoolYear: number) {
  return queryOptions({
    queryKey: studentRecordKeys.storylineTab(studentId, schoolYear),
    queryFn: () => getStorylineTabAction(studentId, schoolYear),
    staleTime: 1000 * 300,
  });
}
```

### 탭별 데이터 구조

```typescript
// ── 기록 탭 (기본 탭, 최초 로드) ──
type RecordTabData = {
  seteks: RecordSetek[];
  personalSeteks: RecordPersonalSetek[];
  changche: RecordChangche[];
  haengteuk: RecordHaengteuk | null;
  readings: RecordReading[];
  schoolAttendance: RecordAttendance | null;
  scores: InternalScore[];          // 읽기전용
  mockScores: MockScore[];          // 읽기전용
};

// ── 진단 탭 (선택 시 로드) ──
type DiagnosisTabData = {
  competencyScores: CompetencyScore[];
  activityTags: ActivityTag[];
  diagnosis: Diagnosis | null;
  courseAdequacy: CourseAdequacyResult | null;
};

// ── 전략 탭 (선택 시 로드) ──
type StrategyTabData = {
  strategies: Strategy[];
  applications: Application[];
  minScoreTargets: MinScoreTarget[];
  minScoreSimulations: MinScoreSimulation[];
  interviewDateConflicts: InterviewConflict[]; // 면접일 겹침
};

// ── 스토리라인 탭 (선택 시 로드) ──
type StorylineTabData = {
  storylines: Storyline[];
  roadmapItems: RoadmapItem[];
  orphanedActivities: { recordType: string; recordId: string; title: string }[];
};
```

---

## 14. 구현 순서

### 생기부 트랙 (메인)

| Phase | 내용 | AI 유형 | 마이그레이션 | 파일 |
|-------|------|---------|-------------|------|
| **1a** | DB: 핵심 기록 6개 (seteks, personal_seteks, changche, haengteuk, reading, subject_pairs) + RLS + 트리거 + 다형참조 정리 트리거 | - | `001_core_records.sql` | 1 |
| **1b** | DB: 보조 기록 5개 (attendance, awards, volunteer, disciplinary, applications) + RLS + 트리거 | - | `002_supplementary_records.sql` | 1 |
| **1c** | DB: 확장 기능 8개 (storylines, storyline_links, roadmap_items, reading_links, interview_questions, min_score_targets, min_score_simulations, school_profiles) + RLS + 트리거 | - | `003_extended_features.sql` | 1 |
| **2** | 도메인 레이어 (types, constants, validation, repository, service) + **자동 테스트 (validation, grade-normalizer, min-score-simulator)** | - | - | ~15 |
| **3** | React Query (탭별 lazy loading) + 관리자 UI 기록 탭 + 스토리라인 트래커 + 로드맵 UI | - | - | ~25 |
| **3.5** | P2 기록 UI (수상/봉사/징계) + 지원결과 탭 (수시 6장 카드 + 정시 군별 + **면접일 겹침 체크**) | - | - | ~10 |
| **4** | 학생 뷰 + 학부모 뷰 + 수능최저 시뮬레이션 UI + 고교 프로파일 뷰 | - | - | ~12 |
| **4.5** | **PDF Import**: 파싱 파이프라인 + 과목 매칭 + Import UI | **Gemini 멀티모달** | - | ~12 | ✅ **완료** |
| **5** | DB: 진단 4개 + 도메인 레이어 + 교과이수적합도 (school_profiles 연동) + **RLS 통합 테스트** | **규칙 기반** | `004_diagnosis.sql` | ~10 |
| **5.5** | **AI 역량 태그 자동 제안** + 프롬프트 + UI + **AI 응답 파싱 테스트** | **Gemini fast** | - | ~8 |
| **6** | 관리자 UI 진단 탭 + **AI 종합 진단 생성** + **AI 스토리라인 분석** | **Claude standard** | - | ~10 |
| **6.5** | **조기 경보 확장** (스토리라인+최저 경고) + **AI 면접 예상 질문** | **규칙+Claude** | - | ~8 |
| **7** | 보완전략 탭 + **AI 전략 제안** + 학생 역량 뷰 | **Gemini Grounding** | - | ~7 |
| **8.1** | 대학 입시 DB 이관 (26,777건) + 교과전형 내신 산출 공식 구조화 | - | `005_admission_db.sql` | ~5 |
| **8.2** | 정시 환산 엔진 + 결격사유 + **자동 테스트 (calculator, eligibility)** | **규칙 기반** | - | ~8 |
| **8.3** | data.go.kr API 연동 | - | - | ~4 |
| **8.4** | 연간 4단계 갱신 사이클 + **전형 변경 알림** | **Gemini 멀티모달** | - | ~6 |
| **8.5** | 모평 배치 자동 분석 + **가채점/실채점 분리** + **6장 최적 배분 시뮬레이션** | **규칙 기반** | - | ~6 |
| **8.6** | 졸업생 검색 (**SQL 기반**, Python ML 삭제) | - | - | ~3 |
| **9** | AI 활동 지원 3모드 + 수시 Report 자동 생성 | **Claude advanced** | - | ~10 |
| **10** | 버전 이력, 일괄 상태 변경, ML 졸업생 매칭 (규모 확장 시) | - | - | - |

### CMS 트랙 (독립, 생기부 트랙과 병행)

> 탐구 가이드 CMS는 **생기부 시스템과 독립적인 별도 프로젝트 규모**이므로, 별도 트랙으로 분리하여 진행한다. 생기부 트랙의 Phase 3 이후에 시작 가능하며, 인터페이스(guide_assignments ↔ 생기부 기록 연결)만 공유.

| Phase | 내용 | AI 유형 | 마이그레이션 | 파일 |
|-------|------|---------|-------------|------|
| **C1** | DB: 탐구DB 이관 (exploration_guides 3분할 + guide_assignments + guide_usage_history) + Access 7,836건 마이그레이션 | - | `C01_guide_tables.sql` | ~6 |
| **C2** | 가이드 CRUD UI + 리치 텍스트 에디터 (수식/이미지/단계별) — Access 대체 | - | - | ~15 |
| **C3** | AI 가이드 생성 (5가지 소스) + 적대적 검증 + 유사도 탐지 + SSE | **Claude+Gemini** | - | ~12 |
| **C4** | 버전 관리 + 품질 시스템 + 학생 피드백 + guide_feedback 테이블 | - | `C02_guide_feedback.sql` | ~10 |
| **C5** | 학생 APP 가이드 뷰 + 모드 A/B/C AI 생성 + 생기부 연동 | **Claude standard** | - | ~8 |

총 새 파일 약 **170개+** (생기부 ~120 + CMS ~50), DB 테이블 **17+12 = 29개**.

### Phase 구분 근거

- **Phase 1a~1c (기록 DB)**: 3단계로 분리하여 마이그레이션 위험 분산. 각 단계 독립 rollback 가능
- **Phase 2 (도메인 + 테스트)**: 결정론적 엔진(validation, simulator, normalizer)의 자동 테스트를 Phase 2에서 확보
- **Phase 3~4 (UI)**: 탭별 lazy loading으로 초기 로딩 최적화. 학부모 뷰/최저 시뮬레이션을 4로 앞당김
- **Phase 4.5 (PDF Import)**: 첫 번째 AI 적용점. Gemini 멀티모달로 데이터 입력 자동화
- **Phase 5~5.5 (진단 + AI 태깅)**: 규칙 기반(교과이수적합도) → LLM 기반(역량태그) 순서로 점진 적용
- **Phase 6~6.5 (진단 UI + AI 진단 + 경보)**: 종합 진단 자동 생성은 역량 데이터 축적 후에 의미 있음
- **Phase 7 (전략 + AI 제안)**: Gemini Grounding으로 최신 교육 트렌드 반영한 전략 제안
- **Phase 8 (대학 DB + 배치)**: 보유 데이터 이관 → 환산 엔진 → API 연동 → 배치 분석
- **Phase 9 (고도화 AI)**: 세특 초안 생성 + 수시 Report 자동 생성 (전체 파이프라인 통합)

### AI 유형별 기존 인프라 재사용

| AI 유형 | 기존 인프라 | 재사용 대상 | 신규 작업 |
|---------|-------------|-------------|-----------|
| **Gemini 멀티모달** | `providers/gemini.ts` | rate limiter, quota tracker, retry | 프롬프트 + 스키마만 작성 |
| **Gemini fast** | `providers/gemini.ts` (fast tier) | 동일 + extractJSON | 프롬프트만 작성 |
| **Gemini Grounding** | `providers/gemini.ts` (googleSearch) | 웹 검색 통합 | 프롬프트만 작성 |
| **Claude standard** | `providers/anthropic.ts` | provider factory, cache | 프롬프트만 작성 |
| **Claude advanced** | `providers/anthropic.ts` (advanced tier) | 동일 | 프롬프트만 작성 |
| **규칙 기반** | - | constants.ts (계열별 추천교과) | course-adequacy.ts, calculator.ts |
| **SQL 검색** | alumni-search.ts | Server Action 내부 처리 | 추가 인프라 불필요 |
| **조기 경보** | `earlyWarningService.ts` | 기존 경보 프레임워크 | 생기부 경고 룰 추가만 |
| **LLM 캐시** | `llmCacheService.ts` | TTL 기반 캐시 | 새 operation type 등록만 |
| **메트릭** | `llm/metrics/` | 토큰/비용/성공률 추적 | 자동 적용 (provider 경유) |

### Phase 4.5 세부 단계 (✅ 완료)

```
4.5.1  ✅ pdfjs-dist 설치 + PDF→이미지 추출
4.5.2  ✅ import/types.ts — RecordImportData 타입 (세특/창체/행특/성적/출결/독서/수상/봉사/학반정보)
4.5.3  ✅ import/parser.ts — Gemini AI 파싱 (PDF/이미지)
4.5.4  ✅ import/html-parser.ts — NEIS HTML 직접 파싱 (AI 없이 즉시)
       - 3가지 성적 테이블 모드 (general/elective/pe_art)
       - 학기 번호 추적, P(pass/fail) 평가, 성취도별 분포비율 파싱
       - 입학연도 정규식 (2024년 03월 01일 형식 지원)
4.5.5  ✅ import/subject-matcher.ts — 과목명 매칭
       - 유니코드 Ⅰ ↔ 아스키 I 정규화
       - 미매칭 시 세분화된 교과 그룹으로 자동 생성
       - 교과 그룹: 체육, 예술, 기술·가정/정보, 제2외국어, 한문, 교양
       - 동명 과목 중복 매칭 방지
4.5.6  ✅ import/mapper.ts — ParsedData → DB 엔티티 변환
       - 수상/봉사/학반정보 매퍼 추가
       - 출결에 학반정보(담임/반/번호) 병합
       - 성취도별 분포비율(A~E) 전달
4.5.7  ✅ import/importer.ts — DB 저장 오케스트레이션
       - 덮어쓰기 시 기존 데이터 삭제 후 insert (누적 방지)
       - N+1 쿼리 방지 (school_year별 캐시)
4.5.8  ✅ UI: ImportDialog (파일 드롭존 + 프로그레스 + 미리보기 + 수동 매핑)
4.5.9  ✅ 미리보기: 세특/창체/행특/출결/성적/수상/봉사/학반 건수 배지
4.5.10 ✅ 통합 테스트: 실제 NEIS HTML → 파싱 → 저장 → 기록 탭 확인 완료
```

### Phase 4.6 세부 단계 (✅ 완료 — 이번 작업)

```
4.6.1  ✅ 생기부 별도 페이지 분리 (/admin/students/[id]/record)
       - 기존 상세보기 탭에서 독립 페이지로 (플래너 패턴)
       - StudentFormPanel에 생기부 버튼 추가
4.6.2  ✅ UI NEIS 원본 레이아웃 적용
       - 교과학습 3분할: 일반과목 → 진로선택 → 체육·예술(/과학탐구실험)
       - 각 영역별 성적 테이블 + 이수학점 합계 + 세특 순서 배치
       - RecordGradesDisplay variant prop (general/elective/pe_art)
       - 2022 개정 자동 감지: 입학년도≥2025 → 섹션 제목 변경
4.6.3  ✅ 성적 테이블 학년 컬럼, 세특 학년 컬럼, 수상경력 학년/학기 컬럼 분리
4.6.4  ✅ AutoResizeTextarea (JS scrollHeight 기반) — 테이블 내 스크롤 방지
4.6.5  ✅ useEffect prop→state 동기화 (Import 후 즉시 반영)
4.6.6  ✅ 세특 토글 제거 → 항상 편집 가능 textarea
4.6.7  ✅ DB: 교과 그룹 세분화 (기술·가정/정보, 제2외국어, 한문, 교양)
4.6.8  ✅ DB: 과학탐구실험 subject_type = 공통(성취평가), is_achievement_only=true
4.6.9  ✅ DB: attendance 테이블에 homeroom_teacher, class_name, student_number 추가
```

### Phase 5.5 세부 단계 — AI 역량 태그 자동 제안

```
5.5.1  llm/types.ts — TagSuggestion, DiagnosisResult 타입 정의
5.5.2  llm/prompts/competencyTagging.ts — 시스템 프롬프트 + 10개 역량항목 스키마
         - 입력: 과목명 + 세특/창체 텍스트
         - 출력: { competencyItem, evaluation, evidenceSummary }[]
         - 프로바이더: Gemini fast (비용 절감, 태그 추출은 간단)
5.5.3  llm/actions/suggestTags.ts — Server Action (createMessage → extractJSON)
         - LLM cache 등록 (operation: 'competency_tagging', TTL: 24h)
         - rate limit 초과 시 빈 배열 반환 (강제 아닌 제안이므로)
5.5.4  UI: ActivityTagSuggestionPanel — 자동 제안 결과 표시 + 수락/거절 버튼
5.5.5  통합: SetekEditor/ChangcheEditor에 "AI 태그 제안" 버튼 연결
```

### Phase 6 세부 단계 — AI 종합 진단 생성

```
6.1  llm/prompts/diagnosisGeneration.ts — 시스템 프롬프트
       - 입력: 10개 역량등급 + 활동태그(긍정/부정) + 성적추이 + 진로목표
       - 출력: { overallGrade, recordDirection, strengths[], weaknesses[], recommendedMajors[] }
       - 프로바이더: Claude standard (분석·판단 품질 중요)
6.2  llm/actions/generateDiagnosis.ts — Server Action
       - LLM cache 등록 (operation: 'diagnosis_generation', TTL: 168h)
       - 동일 학생 데이터 변경 없으면 캐시 재사용
6.3  UI: DiagnosisGenerateButton — "AI 진단 생성" 버튼
       - 결과를 DiagnosisSummaryEditor에 프리필 → 컨설턴트 수정 후 확정
```

### Phase 6.5 세부 단계 — 조기 경보 확장

```
6.5.1  warnings/recordWarnings.ts — 생기부 관련 경고 룰 정의
         - missing_career_activity: 2학년까지 진로활동 0건 (severity: high)
         - major_subject_decline: 전공교과 2학기 연속 하락 (severity: medium)
         - changche_empty: 현재 학년 창체 미작성, 학기 50% 경과 (severity: high)
         - haengteuk_draft: 전년도 행특 draft 방치 (severity: medium)
         - reading_insufficient: 학년당 독서 2건 미만 (severity: low)
         - course_inadequacy: 교과이수적합도 50% 미만 (severity: high)
6.5.2  earlyWarningService 확장: student-record 도메인 경고 통합
6.5.3  관리자 대시보드에 생기부 경고 카드 추가
```

### Phase 7 세부 단계 — AI 보완전략 제안

```
7.1  llm/prompts/strategyRecommend.ts — 시스템 프롬프트
       - 입력: 진단 weaknesses + 부족역량 + 학년 + 학기
       - 출력: { targetArea, strategyContent, priority }[]
       - 프로바이더: Gemini + Grounding (최신 교육 트렌드 웹 검색)
7.2  llm/actions/suggestStrategies.ts — Server Action
       - Grounding 결과 포함 (출처 URL 등)
7.3  UI: StrategySuggestionPanel — AI 제안 목록 + 채택 버튼
```

### Phase 9 세부 단계 — 세특 초안 + Report 자동 생성

```
9.1  llm/prompts/setekDraft.ts — 시스템 프롬프트
       - 입력: 과목, 학년, 활동 키워드, 역량 태그, 글자수 제한(500/300자)
       - 출력: NEIS 바이트 준수 세특 초안 텍스트
       - 프로바이더: Claude advanced (텍스트 생성 품질)
       - 바이트 카운터 검증 포함 (초과 시 자동 축약 재시도)
9.2  llm/actions/draftSetek.ts — Server Action + streaming 지원
9.3  UI: SetekDraftButton — SetekEditor 내 "AI 초안 생성" 버튼
9.4  수시 Report 자동 생성: StudentRecordFull → PDF/Word 출력
       - 기존 변환기의 downloadWordDoc() 패턴 참고 (HTML → .doc)
       - NEIS 레이아웃 렌더러(NEISLayoutRenderer) HTML → PDF 변환
```

### Phase 8 세부 단계

#### 8.1 대학 입시 DB 구축 (보유 데이터 이관)

```
8.1.1  university_admissions 테이블 + university_score_formulas 테이블 마이그레이션
8.1.2  Excel 파싱 스크립트: 추천선택(26,777행) → JSON → bulk insert
8.1.3  DATA1(816행) → 대학별 환산점수 기준(상단컷/하단컷/평균) 이관
8.1.4  정시 미적분기하 지정(173행) → 대학별 수학 지정과목 이관
8.1.5  데이터 정합성 검증 (대학명/학과명 정규화, 중복 제거)
```

**데이터 소스**: 보유 Excel (수시 Report 추천선택 시트)

```sql
-- 대학 입시 DB (수시/정시 통합)
CREATE TABLE IF NOT EXISTS university_admissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- tenant_id 없음: 시스템 공유 데이터 (school_info, career_fields 패턴)
  data_year           integer NOT NULL,         -- 이 데이터의 기준년도 (2026 등)
  -- 대학 기본
  region              varchar(20),
  university_name     varchar(100) NOT NULL,
  department_type     varchar(20),              -- 인문/자연/통합/예체능
  department_name     varchar(200) NOT NULL,
  -- 전형 정보
  admission_type      varchar(50),              -- 학생부종합, 학생부교과, 실기/실적 등
  admission_name      varchar(100),             -- 전형명
  eligibility         text,
  recruitment_count   integer,
  year_change         varchar(20),
  change_details      text,
  min_score_criteria  text,                     -- 최저학력기준
  selection_method    text,                     -- 전형방법
  required_docs       text,
  dual_application    varchar(10),
  grade_weight        text,
  subjects_reflected  text,
  career_subjects     text,
  -- 3개년 경쟁률
  competition_2024    numeric(6,2),
  competition_2023    numeric(6,2),
  competition_2022    numeric(6,2),
  competition_change  numeric(6,2),
  -- 3개년 입결
  result_basis_2024   text,                     -- 기준 (최종등록자평균 등)
  result_grade_2024   numeric(4,2),
  result_score_2024   numeric(10,2),
  replacement_2024    integer,
  notes_2024          text,
  result_basis_2023   text,
  result_grade_2023   numeric(4,2),
  result_score_2023   numeric(10,2),
  replacement_2023    integer,
  result_grade_2022   text,
  replacement_2022    integer,
  -- 기타
  exam_date           text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ua_univ ON university_admissions(university_name);
CREATE INDEX idx_ua_dept ON university_admissions(department_name);
CREATE INDEX idx_ua_type ON university_admissions(admission_type);
CREATE INDEX idx_ua_year ON university_admissions(data_year);
```

#### 8.2 정시 환산 엔진

고속성장분석기(25MB Excel)의 핵심 로직을 포팅:

```
8.2.1  university_score_formulas 테이블: 대학별 환산 공식 저장
8.2.2  COMPUTE 시트 → 대학별 환산점수 계산 함수
8.2.3  RESTRICT 시트 → 결격사유 체크 (수학/탐구 미응시, 등급합, 지정과목)
8.2.4  PERCENTAGE/SUBJECT 시트 → 과목별 반영 비율 데이터
8.2.5  lib/domains/admission/calculator.ts — 수능점수 입력 → 대학별 환산점수 산출
8.2.6  lib/domains/admission/eligibility.ts — 결격사유 자동 체크
```

```sql
CREATE TABLE IF NOT EXISTS university_score_formulas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_year           integer NOT NULL,
  university_name     varchar(100) NOT NULL,
  formula_key         varchar(100) NOT NULL,    -- e.g. "가천의학", "고려사국"
  department_type     varchar(20),              -- 인문/자연
  -- 반영 영역 및 비율
  subjects_config     jsonb NOT NULL,           -- { "국어": 0.3, "수학": 0.3, ... }
  score_type          varchar(20),              -- "표준점수", "백분위", "표+백"
  -- 기준점
  cutoff_score        numeric(10,2),
  -- 결격 조건
  restrictions        jsonb,                    -- { "수학지정": "미적분/기하", "등급합": 8, ... }
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(data_year, formula_key)
);
```

#### 8.3 data.go.kr API 연동

```
8.3.1  data.go.kr API 키 발급 (자동 승인)
8.3.2  lib/domains/admission/api/datagokr.ts — API 클라이언트
8.3.3  대학알리미 대학 기본 정보 (15037507) → universities 시드
8.3.4  대학별 학과정보 (15116892) → departments 시드
8.3.5  대학별 입학정원정보 (15107731) → recruitment_count 보정
8.3.6  university_admissions.university_name → universities.id FK 연결
8.3.7  관리자 UI: "대학 DB 동기화" 버튼 (수동 트리거)
```

#### 8.4 연간 갱신 파이프라인

```
8.4.1  adiga.kr 자료실 PDF 다운로드 (지역별, 매년 4~7월 공개)
8.4.2  Gemini 멀티모달 파싱 (PDF Import 파이프라인 재활용)
8.4.3  파싱 결과 → university_admissions diff → upsert
8.4.4  수시 Report Excel 업로드 → 추천선택 시트 파싱 → diff → upsert
8.4.5  관리자 UI: "입시 데이터 갱신" 모달 (파일 업로드 + 파싱 + 미리보기 + 저장)
8.4.6  갱신 이력 로깅 (언제, 어떤 소스로, 몇 건 갱신)
```

**데이터 소스 우선순위**:
1. 에듀엣톡 수시 Report Excel (가장 정확, 이미 수작업 검증됨)
2. adiga.kr 자료실 PDF (공식 데이터, 표준 형식)
3. data.go.kr API (메타데이터 보완)

#### 8.5 모평 배치 자동 분석

```
8.5.1  학생 모의고사 점수(student_mock_scores) × 대학별 환산 공식 → 환산점수 산출
8.5.2  환산점수 vs 대학별 기준점(입결) → 배치 판정
8.5.3  판정 로직: danger(위험) < unstable(불안) < bold(소신) < possible(가능) < safe(안정)
8.5.4  UI: PlacementAnalysisView — 학생별 모평 기반 배치표 자동 생성
8.5.5  UI: 대학/학과 필터 + 판정 수준별 색상 표시
8.5.6  결격사유 자동 경고 (수학 지정과목 미응시, 탐구 과목 제한 등)
```

```
┌───────────────────────────────────────────────────────────┐
│  이다은 — 6월 모평 배치 분석                              │
│                                                             │
│  국어 133/96/1등급  수학 121/83/3등급  영어 3등급          │
│  한국사 1등급  정치와법 65/90/2등급  사회문화 66/98/1등급   │
│                                                             │
│  🔴 위험  고려대 심리학부     기준 683.1  내 651.6  (-31.5) │
│  🟠 불안  성균관대 사회과학   기준 658.4  내 652.2  (-6.2)  │
│  🟡 소신  이화여대 뇌인지     기준 898.4  내 896.0  (-2.4)  │
│  🟢 가능  한국외대 행정       기준 623.4  내 627.0  (+3.6)  │
│  🔵 안정  서울시립대 도시행정 기준 885.3  내 892.7  (+7.4)  │
│                                                             │
│  ⚠️ 결격: 서울대 기계공학부 (물리+화학 미응시)             │
└───────────────────────────────────────────────────────────┘
```

#### 8.6 졸업생 합격 DB 검색

```
8.6.1  student_record_applications(result='accepted') + student_internal_scores 조인
8.6.2  검색 UI: 학교/성적대/계열/대학 조건으로 "비슷한 학생 중 합격자" 검색
8.6.3  검색 결과: 졸업생 이름, 학교, 전체 평균등급, 전공교과 등급, 합격 대학/학과/전형
8.6.4  현재 학생과 졸업생 성적 비교 뷰
```

---

## 15. 검증 방법

### 기록 (Phase 1~4)
1. `supabase db push` → 12개 기록 테이블 생성 확인
2. `npx supabase gen types typescript --local` → 타입 재생성
3. `pnpm lint` → 타입 에러 없음
4. `pnpm build` → 빌드 성공
5. 관리자: 학생 상세 → 생기부 탭 → 세특/개인세특/창체(+시간)/행특 입력 → 저장 → 새로고침 유지
6. 학생: `/student-record` → 본인 데이터 읽기전용 표시
7. 글자수: 한도 초과 시 카운터 빨간색 + 저장 차단
8. RLS: 다른 tenant 데이터 접근 불가
9. NEIS 출결: 질병/미인정/기타 세분화 입력 → 저장
10. 모의고사 추이: 학년/월별 뷰 렌더링
11. 수상/봉사/징계: 행 추가/삭제 동작
12. 지원 결과: 대학/전형/합격여부 입력 → 저장

### PDF Import (Phase 4.5)
9. PDF 업로드 → 이미지 추출 프로그레스 표시
10. Gemini 파싱 → 구조화된 미리보기 (창체/세특/행특 건수 표시)
11. 과목 미매칭 → 수동 매핑 드롭다운 동작
12. 저장 → DB 반영 → 기록 탭에서 데이터 확인
13. 기존 데이터 있는 학생 → 덮어쓰기 경고 표시
14. HTML 파일 / 이미지 파일도 동일 파이프라인 동작

### 진단 (Phase 5~6)
15. 역량 평가: 10개 항목 등급 입력 → 저장 → 레이더 차트 렌더링
16. 활동 태그: 세특 기록에 역량 태그 부착 → 태그별 필터링 동작
17. 종합 진단: 총평등급 + 방향성 + 장단점 저장 → 학생 뷰에 표시

### AI 역량 태그 + 진단 (Phase 5.5~6.5)
18. AI 태그 제안: 세특 입력 후 "AI 태그 제안" → 역량항목+평가 자동 표시 → 수락/거절
19. 교과 이수 적합도: target_major 설정 → 이수과목 대비 적합도 점수 + 미이수 추천 표시
20. AI 진단 생성: "AI 진단 생성" 클릭 → DiagnosisSummaryEditor에 프리필 → 수정 후 확정
21. 조기 경보: 생기부 경고 (창체 미작성, 진로활동 0건 등) → 관리자 대시보드에 표시
22. LLM 캐시: 동일 세특에 재요청 → 캐시 히트 확인
23. Rate limit: Gemini 쿼터 초과 시 빈 제안 반환 (에러 아닌 graceful 처리)

### 보완전략 + AI 제안 (Phase 7)
24. 보완전략: 영역별 전략 작성 → 우선순위 정렬 → 상태 변경 (planned→done)
25. AI 전략 제안: "AI 전략 제안" → Grounding 웹 검색 결과 포함한 탐구주제 표시
26. 추천 독서: 추천 도서 등록 → 학생 독서목록에 표시

### 대학 DB + 배치 분석 (Phase 8)
20. Excel 이관: 26,777건 bulk insert → university_admissions 조회 동작
21. 대학명/학과명 검색 → 3개년 입결 표시 (경쟁률, 등급, 환산점수, 충원)
22. data.go.kr API: 대학 메타데이터 동기화 → universities/departments 테이블 갱신
23. 정시 환산: 모의고사 점수 입력 → 대학별 환산점수 산출 → 입결 대비 배치 판정
24. 결격사유 체크: 수학 지정과목, 탐구 제한, 등급합 → 자동 경고
25. 모평 배치표: 위험/불안/소신/가능/안정 색상별 표시
26. 졸업생 검색: "전체 평균 2.5~3.0, 사회계열, 서울권" → 합격자 목록 조회
27. 연간 갱신: Excel/PDF 업로드 → 파싱 → diff 미리보기 → upsert
28. 졸업생 매칭: Python ML API 호출 → 유사 졸업생 Top 5 + 합격 대학 표시

### AI 고도화 (Phase 9)
29. 세특 초안: "AI 초안 생성" → 500자 NEIS 바이트 준수 텍스트 생성 → SetekEditor에 삽입
30. 바이트 초과: 자동 축약 재시도 → 500자 이내 확인
31. 수시 Report: StudentRecordFull → HTML → Word/PDF 자동 생성 + 다운로드

---

## 16. 참고 서비스

| 서비스 | 유형 | 핵심 기능 |
|--------|------|-----------|
| 세특PRO (setk.pro) | 교사용 AI 작성 | NEIS 연동, AI 세특 생성, 연 5만원 |
| Inline AI (inline-ai.com) | 교사용 AI 작성 | 세특+창체+행특 완성형 생성 |
| 바이브온 (vibeon.ai) | 학생용 분석 | 생기부 업로드 → 30p 리포트, 합격가능성 진단 |
| 그들의 생기부 (saenggibu.com) | 합격생 열람 | 27,500장+ 합격생 생기부 DB |
| 진학사 학생부 AI | 학생용 분석 | 비교과/교과 AI 점수화 |
| 임팩터스 | 교사용 올인원 | 수업관리 + AI 평가 + 세특 연동 |

---

## 17. 부록: 에듀엣톡 진단 Report 시트 매핑

실제 진단 Report Excel **전 20개 시트** 시스템 매핑 (전수 점검 완료):

| # | Excel 시트 | 상태 | 시스템 매핑 | 구현 Phase |
|---|------------|------|-------------|-----------|
| 1 | 교과성적입력 (48×17) | ✅ | `student_internal_scores` (기존) | 3 (읽기전용 뷰) |
| 2 | 정성평가입력 (50×7) | ✅ | `competency_scores` + `activity_tags` | 5~6 |
| 3 | 성적분석 (5×28) | ✅ | ScoreSummaryView | 3 |
| 4 | 역량분석 (42×32) | ✅ | `activity_tags` 집계 뷰 | 6 |
| 5 | 모평분석 (94×45) | ✅ | MockScoreTrendView | 3 |
| 6 | 모평배치입력 (49×35) | ✅ | `student_mock_scores` (기존) | 3 |
| 7 | P표지 (132×12) | ✅ | 레이아웃 전용 | 8 (PDF) |
| 8 | P교과분석 (91×16) | ✅ | 성적 추이 차트 (표준백분위/조정등급) | 3 |
| 9 | **P정성평가 (120×8)** | ✅ | 역량별 루브릭 + 상세 평가 보고서 뷰 → `constants.ts` 루브릭 + CompetencyScoreCard | 5~6 |
| 10 | P정성평가(총평) (49×15) | ✅ | `diagnosis` | 6 |
| 11 | **P모평배치 (77×15)** | ✅ | 모평→대학 배치 분석 (위험/불안/소신/가능/안정) → Phase 8 자동화, 현재 메모 | 7→8 |
| 12 | P목표 (136×54) | ✅ | `applications` + `diagnosis.strategy_notes` | 3.5~7 |
| 13 | P최종선택 (1×1) | ✅ | 빈 시트 | - |
| 14 | P속지 (44×12) | ✅ | 레이아웃 전용 | 8 (PDF) |
| 15 | P보완전략 (47×13) | ✅ | `strategies` | 7 |
| 16 | P뒷표지 (44×12) | ✅ | 레이아웃 전용 | 8 (PDF) |
| 17 | **이름정의 (65×68)** | ✅ | 마스터 참조 → `constants.ts` (42개 루브릭, 환산표, 18개 계열별 추천교과) | 2 (상수), 5~6 (UI) |
| 18 | 추천선택 (26,777×34) | ⏭️ | 대학 입시 DB (외부 데이터) | 8 |
| 19 | DATA1 (816×60) | ⏭️ | 점수 환산/대학별 기준점 참조 데이터 | 8 |
| 20 | chart (1×1) | ✅ | 차트 참조 셀 | - |

> **전 20개 시트 반영 완료.** 추천선택/DATA1은 대학 DB 연동(Phase 8)에서 구현.

### 설계로드맵 Word 매핑

| Word 항목 | 시스템 매핑 | 구현 Phase |
|-----------|-------------|-----------|
| 진로 목표 | `students.target_major` (기존) | - (이미 존재) |
| 자율/동아리/진로활동 | `student_record_changche` | 1~3 |
| 교과 세특 (과목별) | `student_record_seteks` | 1~3 |
| 개인세특 (학교자율과정) | `student_record_personal_seteks` | 1~3 |
| 행동특성 | `student_record_haengteuk` | 1~3 |
| 역량 태그 [학업역량_탐구력] 등 | `student_record_activity_tags` | 5~6 |
| [확인 要] 마크 | `activity_tags.evaluation = 'needs_review'` | 5~6 |

### 생기부 변환기 원본 참조

| 원본 파일 | 역할 | 통합 대상 |
|-----------|------|-----------|
| `src/pdfUtils.ts` | PDF → 페이지별 base64 이미지 (pdfjs-dist, scale 2.0) | `import/` 파이프라인에 포팅 |
| `src/App.tsx` processFile() | Gemini 호출 + structured output 스키마 | `import/parser.ts` |
| `src/App.tsx` ParsedData | 5개 필드 (fullHtml, fullText, creative, detailed, behavioral) | `import/types.ts` (확장) |
| `src/App.tsx` downloadWordDoc() | HTML → .doc 변환 | Phase 8 PDF 내보내기에서 참고 |

- **원본 위치**: `~/Downloads/학교생활기록부-변환기.zip` (Google AI Studio 앱)
- **Gemini 모델**: `gemini-3.1-pro-preview` (변환기 기준, 프로젝트에서는 사용 가능한 최신 모델 적용)
- **핵심 기법**: PDF를 이미지로 렌더링 후 멀티모달 입력 → structured JSON output

### 로드맵 템플릿 (19표) → 시스템 매핑

| 표 | 내용 | 시스템 매핑 | 비고 |
|---|------|------------|------|
| 표1 | 학적사항 (학년/반/담임) | `students` + `student_terms` | 기존 |
| 표2 | 인적정보 | `students`/`user_profiles` | 기존 |
| 표3 | 출결 (질병/미인정/기타 세분화) | `student_record_attendance` | **신규** |
| 표4 | 수상경력 | `student_record_awards` | **신규** |
| 표5 | 징계사항 | `student_record_disciplinary` | **신규** |
| 표6~8 | 창체 (영역별 시간+특기사항) | `student_record_changche` (+hours) | **hours 추가** |
| 표9 | 봉사활동 | `student_record_volunteer` | **신규** |
| 표10,12,15 | 세특 (학업태도/수행/탐구력) | `student_record_seteks` + `activity_tags` | OK |
| 표11,14,17 | 성적 | `student_internal_scores` | 기존 |
| 표18 | 개인세특 | `student_record_personal_seteks` | OK |
| 표19 | 행특 | `student_record_haengteuk` | OK |

### 요약 템플릿 (8표) → 시스템 매핑

| 표 | 내용 | 시스템 매핑 | 비고 |
|---|------|------------|------|
| 표1~2 | 기본정보 + 희망진로/관심주제 | `students` | 기존 |
| 표3 | 창체 요약 | `student_record_changche` | OK |
| 표4 | 역량 요약 (학업/진로 × 학년 + 총평) | `competency_scores` + `diagnosis` | OK |
| 표5 | 모의고사 추이 (학년/월별) | `student_mock_scores` | 기존, 뷰 통합 필요 |
| 표6 | 학기별 성적 추이 | `student_internal_scores` | 기존 |
| 표7 | 전체/전공 성취도 + 수능최저기준 | `diagnosis` 확장 | 수능최저 메모 |
| 표8 | 지원 결과 (대학/전형/합격여부) | `student_record_applications` | **신규** |

### Drive 폴더 구조 → 시스템 코호트 매핑

| Drive 폴더 | 학생 수 | 시스템 매핑 |
|------------|---------|------------|
| `2024년 3학년(졸)/` | 4명 | 졸업생 → `applications.result` = accepted/rejected |
| `2025년 3학년(졸)/` | 17명 | 졸업생 → 합격 DB로 활용 |
| `2026년 1학년/` | 8명 | 현재생 → 기록+진단+설계 |
| `2026년 2학년/` | 25명 | 현재생 → 기록+진단+설계 |
| `2026년 3학년/` | 29명 | 현재생 → 기록+진단+설계+전략 |
| `2026년 중등/` | 1명 | 예비고1 → 진로적성 중심 |
| **총 84명** | | 6개 코호트 |

### DB 테이블 총괄표

#### 신규 테이블 (17개)

| # | 테이블 | 용도 | tenant_id | Phase |
|---|--------|------|-----------|-------|
| 1 | `student_record_seteks` | 교과 세특 | NOT NULL | 1 |
| 2 | `student_record_personal_seteks` | 개인 세특 (학교자율과정) | NOT NULL | 1 |
| 3 | `student_record_changche` | 창체 (자율/동아리/진로 + 시간) | NOT NULL | 1 |
| 4 | `student_record_haengteuk` | 행동특성 및 종합의견 | NOT NULL | 1 |
| 5 | `student_record_reading` | 독서활동 | NOT NULL | 1 |
| 6 | `student_record_subject_pairs` | 공통과목 쌍 참조 | - (참조) | 1 |
| 7 | `student_record_attendance` | 학교 출결 (NEIS 기준) | NOT NULL | 1 |
| 8 | `student_record_awards` | 수상경력 | NOT NULL | 1 |
| 9 | `student_record_volunteer` | 봉사활동 | NOT NULL | 1 |
| 10 | `student_record_disciplinary` | 징계사항 | NOT NULL | 1 |
| 11 | `student_record_applications` | 지원 결과 | NOT NULL | 1 |
| 12 | `student_record_competency_scores` | 역량 평가 (3대 역량 × 10항목) | NOT NULL | 5 |
| 13 | `student_record_activity_tags` | 활동별 역량 태그 (junction, 평가+근거) | NOT NULL | 5 |
| 14 | `student_record_diagnosis` | 종합 진단 | NOT NULL | 5 |
| 15 | `student_record_strategies` | 보완전략 | NOT NULL | 5 |
| 16 | `university_admissions` | 대학 입시 DB (26,777건 3개년 입결) | **NULL** (공유) | 8.1 |
| 17 | `university_score_formulas` | 대학별 정시 환산 공식 + 결격사유 | **NULL** (공유) | 8.2 |

#### Phase 1 서브 Phase별 테이블 배치

| Sub-Phase | 테이블 | Rollback 단위 |
|-----------|--------|---------------|
| **1a** | #1~6 (seteks, personal_seteks, changche, haengteuk, reading, subject_pairs) | `001_core_records.sql` |
| **1b** | #7~11 (attendance, awards, volunteer, disciplinary, applications) | `002_supplementary_records.sql` |
| **1c** | 확장 설계 문서의 테이블 (#18~25) | `003_extended_features.sql` |

> 각 서브 Phase 마이그레이션은 독립 파일이며, 이전 서브 Phase의 성공을 전제로 한다.
> 1a 실패 시: 1b/1c 진행 불가. 1b 실패 시: 1c는 진행 가능 (보조 기록과 확장 기능은 독립적).

#### 기존 테이블 활용 (신규 생성 X, 조회/확장만)

| 기존 테이블 | 활용 방식 | 변경사항 |
|-------------|-----------|----------|
| `student_internal_scores` | ScoreSummaryView에서 SELECT | 없음 |
| `student_mock_scores` | MockScoreTrendView에서 SELECT | 없음 |
| `students` | 진로 목표 필드 조회 | 없음 |
| `student_career_field_preferences` | 계열 선호도 조회 | 없음 |
| `student_terms` | 세특 `student_term_id` FK 앵커 | 없음 |
| `subjects` / `subject_groups` | 세특 `subject_id` FK | 없음 |
| `attendance_records` | 학원 출결 (별도 유지) | 없음 |
| `files` / `custom_file_categories` | 생기부 PDF 등 문서 저장 | 카테고리 추가만 |

### 데이터 소스 총괄표

| 데이터 | 소스 | 규모 | 갱신 주기 | Phase |
|--------|------|------|-----------|-------|
| 3개년 입결 (수시) | 보유 Excel 추천선택 시트 | 26,777행 | 연 1회 (Report 갱신 시) | 8.1 |
| 대학별 환산점수 기준 | 보유 Excel DATA1 시트 | 816행 | 연 1회 | 8.1 |
| 정시 환산 공식 | 보유 Excel 고속성장분석기 | 13개 시트 | 연 1회 (수능 후) | 8.2 |
| 정시 수학 지정과목 | 보유 Excel | 173행 | 연 1회 | 8.2 |
| 대학 메타데이터 | data.go.kr API (무료) | ~200개 대학 | 연 1회 | 8.3 |
| 학과 정보 | data.go.kr API (무료) | ~10,000개 학과 | 연 1회 | 8.3 |
| 신규 입결 (차년도) | adiga.kr 자료실 PDF | 지역별 파일 | 연 1회 (4~7월) | 8.4 |
| 졸업생 합격 결과 | 시스템 내 applications | 누적 | 실시간 | 8.6 |
