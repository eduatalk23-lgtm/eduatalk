# Content Domain Rules

## Scope
학생/관리자 콘텐츠(교재, 강의, 커스텀, 자유학습) CRUD, 마스터 콘텐츠 검색/복사, 메타데이터 조회, 추천, 템플릿 관리.

## Architecture
```
content/
├── index.ts              # Public API (types + actions re-export)
├── types.ts              # CustomContent, FreeLearningItem 타입 + DB 로우 변환 함수
├── utils.ts              # parseNaturalInput (자연어 파싱)
└── actions/
    ├── index.ts           # 전체 액션 통합 export
    ├── student.ts         # 학생 콘텐츠 CRUD (교재/강의/커스텀) — lib/data/studentContents 위임
    ├── custom.ts          # Enhanced 커스텀 콘텐츠 CRUD + 템플릿 (student_custom_contents)
    ├── freeItems.ts       # 자유 학습 아이템 CRUD (flexible_contents)
    ├── details.ts         # 교재 상세정보/강의 회차 저장
    ├── master-search.ts   # 마스터 콘텐츠 검색 + 학생 콘텐츠로 복사
    ├── master-admin.ts    # 마스터 콘텐츠 관리자 CRUD (requireAdminOrConsultant)
    ├── metadata.ts        # 개정교육과정, 출판사, 플랫폼, 교과 그룹 조회
    ├── fetch.ts           # 콘텐츠 메타데이터 일괄 조회
    ├── recommendations.ts # 추천 마스터 콘텐츠
    └── student-master-ids.ts # 학생 콘텐츠의 master_content_id 조회 (중복 방지)
```

**DB 테이블:**
- `student_books`, `student_lectures`, `student_custom_contents` — 학생 개인 콘텐츠
- `flexible_contents` — 자유 학습 아이템 (`content_type = 'free'`)
- `custom_content_templates` — 커스텀 콘텐츠 템플릿
- `master_books`, `master_lectures`, `master_custom_contents` — 공용 마스터 콘텐츠
- `student_book_details`, `student_lecture_episodes` — 교재/강의 상세

**데이터 레이어:** `lib/data/studentContents.ts`, `lib/data/contentMasters.ts`, `lib/data/contentMetadata.ts`

## Enforced Rules

1. **camelCase <-> snake_case 변환 필수**: 도메인 객체는 camelCase, DB 로우는 snake_case. 반드시 `types.ts`의 `toCustomContent()`, `toFreeLearningItem()` 등 변환 함수 사용. 수동 매핑 금지.
2. **삭제 전 플랜 참조 확인**: 교재/강의/커스텀 삭제 시 `getPlansForStudent()`로 plan 참조 확인 후 삭제. 참조가 있으면 에러 반환.
3. **교재 삭제는 Soft Delete**: `deleteBook()`은 `softDeleteBookData()`를 사용하여 `is_active = false`로 설정 (TOCTOU 방지). 강의/커스텀은 Hard Delete.
4. **마스터 콘텐츠 관리자 전용**: `master-admin.ts` 액션은 반드시 `requireAdminOrConsultant()` 가드 사용. 학생이 마스터 콘텐츠를 직접 수정 불가.
5. **에러 로깅 패턴**: 모든 Supabase 에러는 `logActionError({ domain: "content", action: "..." }, error)` 형태로 기록. 에러를 삼키지 말 것.
6. **revalidatePath 호출**: 콘텐츠 변경 후 `/contents`와 관련 경로(`/plan`, `/plan/calendar`) 반드시 무효화.
7. **flexible_contents 필터**: 자유 학습 아이템 조회 시 반드시 `.eq('content_type', 'free')` 필터 포함. 테이블이 다른 content_type과 공유됨.

## Tests
```bash
pnpm test __tests__/plan/contentDuration
pnpm test __tests__/lib/plan/contentResolver
pnpm test __tests__/lib/domains/plan/llm/services/contentDifficultyService
```
> 현재 content 도메인 전용 테스트 없음. 관련 테스트는 plan 도메인에 존재.

## Related Domains
- `master-content`: 마스터 콘텐츠 임포트/익스포트 (books, lectures)
- `content-metadata`: 난이도, 교과 분류, 커스텀 콘텐츠 메타데이터
- `plan`: 학습 플랜이 콘텐츠를 참조 (content_id)
- `drive`: 파일 첨부/업로드 시스템
