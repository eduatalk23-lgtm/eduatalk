# Exemplar (합격 생기부 레퍼런스) Domain Rules

## Scope
합격 생기부 PDF → OCR/파싱 → 구조화 저장 → 벡터 임베딩 → 세특/창체/행특 가이드 few-shot 예시 → 역량 벤치마크

## Architecture
```
exemplar/
├── types.ts              # 60+ 타입 (ExemplarParsedData, ExemplarFullRecord 등)
├── constants.ts          # 교육과정별 구조, 대학 약칭, 품질 임계값
├── repository.ts         # DB CRUD (Supabase admin client)
├── service.ts            # 비즈니스 로직 (익명화, 품질 점수 산출)
├── import/
│   ├── parser.ts         # PDF → ExemplarParsedData (Claude API multimodal)
│   ├── metadata-extractor.ts  # 파일명/폴더명 → 대학/학과 메타데이터
│   ├── subject-matcher.ts     # subject_name → subjects.id 매칭
│   └── importer.ts       # ExemplarParsedData → DB 저장 (배치)
├── search/
│   ├── vector-search.ts  # 임베딩 생성 + search_exemplar_narratives RPC 호출
│   └── text-search.ts    # 전문검색 (pg_trgm)
└── CLAUDE.md
```

## Enforced Rules

1. **기존 학생 데이터와 완전 분리**: exemplar_* 테이블은 students 테이블 미참조. 별도 네임스페이스.
2. **익명화 필수**: 실명 저장 금지. `anonymous_id = SHA-256(이름+학교+입학년도)`. 주민번호, 주소, 사진 정보 파싱하지 않음.
3. **raw_content 필수 저장**: 재파싱 대비 전체 OCR 텍스트를 raw_content/raw_content_by_page에 보존.
4. **교육과정 버전 인식**: `constants.ts`의 `CURRICULUM_SECTIONS`으로 교육과정별 차이 처리. `getCurriculumRevision(enrollmentYear)` 사용.
5. **과목명 TEXT 저장**: matched_subject_id는 optional FK. 2009 개정 폐지 과목도 원본 텍스트로 보존.
6. **tenant_id는 root만**: child 테이블은 exemplar_records FK로 tenant 귀속. RLS는 서브쿼리 JOIN.
7. **임베딩**: 세특/창체/행특/독서만 대상. `EMBEDDABLE_SOURCES` 상수 참조. Gemini text-embedding-004 (768d).

## 교육과정별 핵심 차이
| 항목 | 2009 | 2015 | 2022 |
|------|------|------|------|
| 진로희망 | ✅ | ❌ (2018~) | ❌ |
| 창체 봉사 | ✅ | ✅ | ❌ (별도) |
| 자치활동 | autonomy에 포함 | autonomy에 포함 | self_governance 분리 |
| 성적 체계 | 9등급 | 9등급 + 진로A/B/C | 5등급A~E + 9등급 |
| 행특 제한 | ~500자 | 500자 | 300자 |
| 수상/독서 대입반영 | ✅ | ❌ (2021/2024~) | ❌ |

## Tests
```bash
pnpm test lib/domains/exemplar
```

## Related Domains
- `student-record`: 기존 학생 기록 시스템 — 타입 패턴 참고, 데이터 분리
- `guide`: 탐구 가이드 setek_examples — exemplar_guide_links로 연결
- `guide/vector`: 임베딩 서비스 — 동일 인프라 (pgvector, Gemini, rate limiter)
