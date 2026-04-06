# Score Domain Rules

## Scope
내신(student_internal_scores) 및 모의고사(student_mock_scores) 성적 CRUD, Zod 검증, 산출 엔진(백분위 추정, 조정등급, 표준편차 추정, 9/5등급 변환).

## Architecture
```
score/
├── index.ts          # Public API (types + validation + actions re-export)
├── types.ts          # DB 파생 타입 (InternalScore, MockScore) + 서비스 입력/필터/결과 타입
├── validation.ts     # Zod 스키마 (createSchoolScoreSchema, createMockScoreSchema 등)
├── service.ts        # 비즈니스 로직 (CRUD 래퍼 + 평균등급/추이/과목별GPA)
├── repository.ts     # Supabase 쿼리 전용 (find*, insert*, update*, delete*)
├── computation.ts    # 순수 산출 엔진 (클라이언트/서버 양용, Supabase 의존 없음)
├── actions/
│   ├── index.ts          # Actions barrel export
│   ├── core.ts           # Server Actions (내신/모의 CRUD + 배치 + 산출값 자동계산)
│   ├── student.ts        # Student-facing FormData 기반 Actions (redirect 포함)
│   └── fetchScoreData.ts # 성적 패널 데이터 일괄 조회 (curriculum hierarchy 포함)
└── __tests__/
    └── computation.test.ts  # 산출 엔진 단위 테스트
```

## Enforced Rules

1. **Actions -> Service -> Repository 레이어 분리**: Actions에서 Supabase 직접 쿼리 금지 (fetchComputationMeta 등 메타조회 제외). 비즈니스 로직은 service.ts, 데이터 접근은 repository.ts.
2. **student_term 자동 생성**: 성적 삽입 시 `getOrCreateStudentTerm()`으로 student_term_id를 반드시 세팅. 모의고사는 실패 시 NULL 허용, 내신은 필수.
3. **산출 엔진은 순수 함수**: `computation.ts`는 Supabase/서버 의존 없는 순수 계산 라이브러리. 클라이언트 컴포넌트에서도 직접 import 가능. DB 호출 절대 금지.
4. **등급 범위 검증 필수**: 등급(grade_score/rank_grade)은 1-9, 백분위는 0-100, 학년은 1-3, 학기는 1-2. Zod 스키마 + service 이중 검증.
5. **레거시 타입 사용 금지**: `SchoolScore`, `CreateSchoolScoreInput` 등 `@deprecated` 타입 대신 `InternalScore`, `CreateInternalScoreInput` 사용.
6. **캐시 무효화**: 성적 변경 후 `revalidatePath("/scores/...")` 필수. student.ts는 redirect 전에 무효화.
7. **gradeSystem 판별**: `determineGradeSystem(curriculumYear)`로 5/9등급 체계 결정. 정본은 `student-record/grade-normalizer.ts`, score 도메인은 re-export.

## Tests
```bash
pnpm test lib/domains/score/__tests__/computation.test.ts
```

## Related Domains
- `student-record`: 생기부 파이프라인에서 성적 데이터 참조, `grade-normalizer.ts` 공유
- `analysis`: 성적 변경 시 `recalculateRiskIndex()` 호출
- `admission`: 정시 환산 엔진에서 모의고사 성적 참조
- `bypass-major`: 우회학과 파이프라인에서 성적 데이터 참조
