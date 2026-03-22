# 가이드 유형별 섹션 구조 리팩토링 설계서

## 1. 현재 문제

모든 가이드 유형(5종)이 동일한 6섹션 구조를 강제 사용:
```
동기 → 이론(2~5) → 고찰 → 느낀점 → 요약 → 후속탐구
```

실제로는 유형별로 완전히 다른 섹션 구조가 필요하며,
특히 실험탐구(재료/방법/결과), 교과수행(수행목표/자기평가), 프로그램(활동내용/성과물)은
현재 구조로 표현이 불가능하다.

---

## 2. 설계 원칙

1. **Config 기반** — 유형별 섹션 구성을 상수 객체로 정의, 코드 변경 없이 섹션 추가/삭제/순서 변경 가능
2. **하위 호환** — 기존 7,836건 가이드가 깨지지 않도록 기존 필드 유지 + 신규 필드 추가
3. **DB 스키마 최소 변경** — JSONB 유연성 활용, 테이블 추가 없음
4. **단계적 마이그레이션** — 기존 데이터는 자동 변환, 신규 데이터는 새 구조 적용

---

## 3. 핵심 설계: Section Config 시스템

### 3.1 섹션 정의 상수

```typescript
// lib/domains/guide/section-config.ts

export interface SectionDefinition {
  key: string;                    // DB 저장 키 (content_sections[].key)
  label: string;                  // UI 표시명
  editorType: "rich_text" | "text_list" | "key_value" | "plain_text";
  required: boolean;
  adminOnly?: boolean;            // true면 학생에게 미노출
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  order: number;                  // 기본 표시 순서
}

export const GUIDE_SECTION_CONFIG: Record<GuideType, SectionDefinition[]> = {

  // ──────────────────────────────────────
  // 독서탐구
  // ──────────────────────────────────────
  reading: [
    { key: "motivation", label: "탐구 동기", editorType: "rich_text", required: true, order: 1,
      placeholder: "왜 이 책을 읽게 되었는지 학생 시점에서 작성", minLength: 150, maxLength: 300 },
    { key: "book_description", label: "도서 소개", editorType: "rich_text", required: true, order: 2,
      placeholder: "핵심 내용과 학문적 가치", minLength: 200, maxLength: 400 },
    { key: "content_sections", label: "탐구 이론", editorType: "rich_text", required: true, order: 3,
      placeholder: "책의 핵심 개념/논점 분석", minLength: 500, maxLength: 2000 },
    { key: "reflection", label: "탐구 고찰", editorType: "rich_text", required: true, order: 4,
      placeholder: "책을 통해 발견한 점, 분석 결과", minLength: 200, maxLength: 500 },
    { key: "impression", label: "느낀점", editorType: "rich_text", required: true, order: 5,
      placeholder: "학문적/개인적 감상", minLength: 150, maxLength: 300 },
    { key: "summary", label: "탐구 요약", editorType: "rich_text", required: true, order: 6,
      placeholder: "전체 내용 핵심 정리", minLength: 200, maxLength: 400 },
    { key: "follow_up", label: "후속 탐구", editorType: "rich_text", required: false, order: 7,
      placeholder: "관련 도서, 심화 연구 방향" },
    { key: "setek_examples", label: "세특 예시", editorType: "text_list", required: false, order: 8,
      adminOnly: true, placeholder: "교사용 기록 예시 (200자 내외)" },
  ],

  // ──────────────────────────────────────
  // 주제탐구
  // ──────────────────────────────────────
  topic_exploration: [
    { key: "motivation", label: "탐구 동기", editorType: "rich_text", required: true, order: 1 },
    { key: "content_sections", label: "탐구 이론", editorType: "rich_text", required: true, order: 2 },
    { key: "reflection", label: "탐구 고찰", editorType: "rich_text", required: true, order: 3 },
    { key: "impression", label: "느낀점", editorType: "rich_text", required: true, order: 4 },
    { key: "summary", label: "탐구 요약", editorType: "rich_text", required: true, order: 5 },
    { key: "follow_up", label: "후속 탐구", editorType: "rich_text", required: false, order: 6 },
    { key: "setek_examples", label: "세특 예시", editorType: "text_list", required: false, order: 7, adminOnly: true },
  ],

  // ──────────────────────────────────────
  // 실험탐구
  // ──────────────────────────────────────
  experiment: [
    { key: "objective", label: "실험 목적", editorType: "rich_text", required: true, order: 1,
      placeholder: "무엇을 검증/관찰하려는지" },
    { key: "background", label: "배경 이론", editorType: "rich_text", required: true, order: 2,
      placeholder: "관련 과학 원리, 선행 연구" },
    { key: "hypothesis", label: "가설", editorType: "rich_text", required: false, order: 3,
      placeholder: "예상되는 결과" },
    { key: "materials", label: "실험 재료 및 기구", editorType: "text_list", required: true, order: 4,
      placeholder: "실험에 필요한 재료와 기구 목록" },
    { key: "method", label: "실험 방법", editorType: "rich_text", required: true, order: 5,
      placeholder: "단계별 실험 절차" },
    { key: "results", label: "실험 결과", editorType: "rich_text", required: true, order: 6,
      placeholder: "관찰/측정 데이터, 표/그래프 가이드" },
    { key: "analysis", label: "결과 분석", editorType: "rich_text", required: true, order: 7,
      placeholder: "데이터 해석, 가설 검증 여부" },
    { key: "reflection", label: "탐구 고찰", editorType: "rich_text", required: true, order: 8,
      placeholder: "실험의 의의, 한계, 오차 원인" },
    { key: "impression", label: "느낀점", editorType: "rich_text", required: true, order: 9 },
    { key: "follow_up", label: "후속 탐구", editorType: "rich_text", required: false, order: 10,
      placeholder: "개선된 실험 설계, 변인 변경 방안" },
    { key: "setek_examples", label: "세특 예시", editorType: "text_list", required: false, order: 11, adminOnly: true },
  ],

  // ──────────────────────────────────────
  // 교과수행
  // ──────────────────────────────────────
  subject_performance: [
    { key: "objective", label: "수행 목표", editorType: "rich_text", required: true, order: 1,
      placeholder: "이 수행평가에서 달성할 목표" },
    { key: "background", label: "관련 교과 개념", editorType: "rich_text", required: true, order: 2,
      placeholder: "교과서 단원 연계 이론" },
    { key: "method", label: "수행 방법", editorType: "rich_text", required: true, order: 3,
      placeholder: "조사/발표/보고서 등 수행 절차" },
    { key: "results", label: "수행 결과", editorType: "rich_text", required: true, order: 4,
      placeholder: "산출물 내용 정리" },
    { key: "self_assessment", label: "자기 평가", editorType: "rich_text", required: true, order: 5,
      placeholder: "수행 과정 성찰, 역량 분석" },
    { key: "curriculum_link", label: "교과 연계 분석", editorType: "rich_text", required: false, order: 6,
      placeholder: "교육과정 성취기준과의 연결" },
    { key: "impression", label: "느낀점", editorType: "rich_text", required: true, order: 7 },
    { key: "follow_up", label: "후속 활동", editorType: "rich_text", required: false, order: 8 },
    { key: "setek_examples", label: "세특 예시", editorType: "text_list", required: false, order: 9, adminOnly: true },
  ],

  // ──────────────────────────────────────
  // 프로그램
  // ──────────────────────────────────────
  program: [
    { key: "overview", label: "프로그램 개요", editorType: "key_value", required: true, order: 1,
      placeholder: "프로그램명, 기관, 기간, 목적" },
    { key: "motivation", label: "참여 동기", editorType: "rich_text", required: true, order: 2 },
    { key: "content_sections", label: "활동 내용", editorType: "rich_text", required: true, order: 3,
      placeholder: "주차/세션별 활동 기술" },
    { key: "deliverables", label: "성과물", editorType: "rich_text", required: false, order: 4,
      placeholder: "보고서, 발표, 작품 등" },
    { key: "learning", label: "배운 점", editorType: "rich_text", required: true, order: 5,
      placeholder: "프로그램을 통해 얻은 역량/지식" },
    { key: "impression", label: "느낀점", editorType: "rich_text", required: true, order: 6 },
    { key: "follow_up", label: "후속 활동", editorType: "rich_text", required: false, order: 7 },
    { key: "setek_examples", label: "세특 예시", editorType: "text_list", required: false, order: 8, adminOnly: true },
  ],
};
```

### 3.2 유형 변경 시 자동 반영

```
GUIDE_SECTION_CONFIG 상수 수정
  → AI 프롬프트 자동 반영 (config에서 섹션 목록 읽음)
  → 에디터 UI 자동 반영 (config에서 필드 렌더링)
  → 프리뷰 자동 반영 (config에서 순서/라벨 읽음)
  → 학생 뷰 자동 반영 (config에서 adminOnly 필터링)
  → Zod 스키마 자동 반영 (config에서 required/optional 도출)
```

---

## 4. DB 스키마 변경

### 4.1 exploration_guide_content 확장

```sql
-- 기존 theory_sections (유지, 하위 호환)
theory_sections JSONB NOT NULL DEFAULT '[]'

-- 신규: 유형별 섹션 데이터 (config key 기반)
ALTER TABLE exploration_guide_content
  ADD COLUMN content_sections JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN exploration_guide_content.content_sections IS
  '유형별 섹션 데이터 [{key, label, content, content_format, images}]';
```

### 4.2 content_sections JSONB 구조

```typescript
interface ContentSection {
  key: string;           // SectionDefinition.key와 매칭
  label: string;         // 표시명 (config에서 복사)
  content: string;       // HTML 또는 plain text
  content_format: "html" | "plain";
  images?: TheorySectionImage[];
  items?: string[];      // text_list 타입용 (재료 목록 등)
  metadata?: Record<string, string>;  // key_value 타입용 (프로그램 개요 등)
}
```

### 4.3 마이그레이션 전략

```
Phase 1: content_sections 컬럼 추가 (빈 배열 기본값)
Phase 2: 기존 데이터 변환 스크립트
  - motivation → { key: "motivation", content: motivation }
  - theory_sections → { key: "content_sections", content: ... } (복수)
  - reflection → { key: "reflection", content: reflection }
  - ... 각 기존 필드를 content_sections 배열로 변환
Phase 3: 신규 가이드는 content_sections만 사용
Phase 4: (장기) 기존 필드 deprecate
```

---

## 5. AI 프롬프트 자동화

### 5.1 Config 기반 프롬프트 빌더

```typescript
function buildTypeSpecificPrompt(guideType: GuideType): string {
  const sections = GUIDE_SECTION_CONFIG[guideType];

  return `## 가이드 구조 (${GUIDE_TYPE_LABELS[guideType]})
${sections
  .filter(s => !s.adminOnly || s.key === "setek_examples")
  .map(s => `- **${s.label}**${s.required ? " (필수)" : " (선택)"}: ${s.placeholder ?? ""}`)
  .join("\n")}`;
}
```

### 5.2 유형별 Zod 스키마 자동 생성

```typescript
function buildGuideSchema(guideType: GuideType) {
  const sections = GUIDE_SECTION_CONFIG[guideType];

  const sectionSchema = z.object({
    key: z.string(),
    label: z.string(),
    content: z.string(),
  });

  return z.object({
    title: z.string(),
    guideType: z.literal(guideType),
    sections: z.array(sectionSchema)
      .min(sections.filter(s => s.required).length),
  });
}
```

---

## 6. UI 변경

### 6.1 GuideContentEditor — Config 기반 렌더링

```
현재: 하드코딩된 8개 필드
변경: GUIDE_SECTION_CONFIG[guideType].map(section => renderEditor(section))
```

```typescript
function GuideContentEditor({ guideType, sections, onChange }) {
  const config = GUIDE_SECTION_CONFIG[guideType];

  return config.map(def => {
    switch (def.editorType) {
      case "rich_text":
        return <RichTextEditor key={def.key} label={def.label} ... />;
      case "text_list":
        return <TextListEditor key={def.key} label={def.label} ... />;
      case "key_value":
        return <KeyValueEditor key={def.key} label={def.label} ... />;
    }
  });
}
```

### 6.2 GuidePreview / StudentGuideDetail — 동일 패턴

```typescript
function renderSections(guideType, sections, isStudent) {
  const config = GUIDE_SECTION_CONFIG[guideType]
    .filter(def => !isStudent || !def.adminOnly);

  return config.map(def => {
    const section = sections.find(s => s.key === def.key);
    if (!section?.content) return null;
    return <ContentBlock key={def.key} label={def.label} content={section.content} />;
  });
}
```

---

## 7. 구현 단계

### Phase A: 기반 (1일)
- [ ] `section-config.ts` — 5유형 섹션 정의 상수
- [ ] DB 마이그레이션 — `content_sections JSONB` 컬럼 추가
- [ ] 타입 — `ContentSection` 인터페이스

### Phase B: 저장/조회 (1일)
- [ ] Repository — content_sections CRUD
- [ ] 서버 액션 — content_sections 저장/조회 지원
- [ ] 하위 호환 — 기존 필드와 content_sections 양쪽 지원

### Phase C: AI 프롬프트 (1일)
- [ ] 프롬프트 빌더 — config 기반 유형별 프롬프트 자동 생성
- [ ] Zod 스키마 — config 기반 유형별 스키마 자동 생성
- [ ] 생성 결과 → content_sections로 저장

### Phase D: UI (2일)
- [ ] GuideContentEditor — config 기반 동적 렌더링
- [ ] GuidePreview — config 기반 동적 렌더링
- [ ] StudentGuideDetail — config 기반 + adminOnly 필터
- [ ] GuideMetaForm — 유형 변경 시 에디터 리셋 확인

### Phase E: 데이터 마이그레이션 (1일)
- [ ] 기존 7,836건 변환 스크립트
- [ ] 검증 쿼리
- [ ] Rollback 계획

### Phase F: 검증 (1일)
- [ ] 유형별 가이드 생성 테스트
- [ ] 기존 가이드 열람 테스트 (하위 호환)
- [ ] 학생 뷰 테스트
- [ ] AI 리뷰 호환성 테스트
- [ ] 빌드 + 배포

---

## 8. 하위 호환 전략

```
기존 가이드 (content_sections = []):
  → 기존 필드(motivation, theory_sections, reflection...) 사용
  → 에디터/프리뷰에서 기존 필드 렌더링

신규 가이드 (content_sections = [...]):
  → content_sections 사용
  → 에디터/프리뷰에서 config 기반 렌더링

판별 로직:
  if (guide.content.content_sections.length > 0) {
    // 새 구조 사용
    renderFromConfig(guideType, content_sections);
  } else {
    // 기존 구조 (레거시)
    renderLegacy(motivation, theory_sections, reflection, ...);
  }
```

---

## 9. 기대 효과

1. **유형별 최적 구조** — 실험탐구에 재료/방법/결과, 교과수행에 수행목표/자기평가
2. **운영 유연성** — config 상수 수정만으로 섹션 추가/삭제/순서 변경
3. **AI 품질 향상** — 유형별 프롬프트로 구조화된 콘텐츠 생성
4. **확장성** — 새 가이드 유형 추가 시 config에 정의만 추가
