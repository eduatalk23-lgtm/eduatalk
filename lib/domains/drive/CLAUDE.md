# Drive Domain Rules

## Scope
통합 파일 저장소 시스템. 파일 업로드/다운로드, 학생별 쿼터(50MB), 워크플로우(요청-제출-승인/반려), 자료 배포(관리자->학생), 커스텀 카테고리, 채팅 첨부파일 저장, 만료 파일 자동 정리.

## Architecture
```
drive/
├── types.ts              # 타입/상수 (DriveFile, FileRequest, FileDistribution, MIME 등)
├── repository.ts         # DB CRUD (files, file_contexts, file_requests, file_distributions, request_templates, file_categories)
├── storage.ts            # Supabase Storage (drive-files 버킷): signed URL, upload, delete
├── validation.ts         # 파일 크기/MIME 검증, sanitizeFileName
├── quota.ts              # 학생별 50MB 쿼터 관리
├── cleanup.ts            # 만료 파일 배치 삭제 (Storage + DB)
├── bulk-download.ts      # 클라이언트 전용: JSZip 다운로드 (브라우저)
├── actions/              # Server Actions
│   ├── files.ts          # 업로드, 조회, 삭제, signed URL, 쿼터 조회
│   ├── workflow.ts       # 요청 CRUD, 제출, 승인/반려, 일괄 요청, 템플릿
│   ├── distribution.ts   # 자료 배포, 회수, 열람/다운로드 추적
│   ├── categories.ts     # 커스텀 카테고리 CRUD
│   └── chat-save.ts      # 채팅 첨부 -> 드라이브 복사 (cross-bucket)
└── services/
    └── upload.ts         # 업로드 핵심 로직 (검증 -> MIME 확인 -> 쿼터 -> 버전 -> Storage -> DB)
```

## Enforced Rules

1. **Storage는 반드시 Private 버킷 + Signed URL**: `drive-files` 버킷은 비공개. 파일 접근은 항상 `storage.ts`의 `createSignedUrl()`로 임시 URL 생성. 공개 URL 직접 노출 금지.
2. **업로드는 services/upload.ts 경유 필수**: 모든 업로드 경로(일반/워크플로우/배포/채팅)는 `uploadDriveFile()` 사용. 검증-MIME-쿼터-버전-Storage-DB 파이프라인 우회 금지.
3. **DB 실패 시 Storage 고아 파일 정리**: `upload.ts`에서 DB insert 실패 시 이미 업로드된 Storage 파일을 삭제 (line 116-118). 이 패턴 유지 필수.
4. **쿼터 에러는 throw**: `getStudentDriveUsage()`는 DB 에러 시 0이 아닌 throw. 0 반환 시 쿼터 우회 가능하므로 throw로 업로드 차단.
5. **만료 기반 파일 관리**: 모든 파일에 `expires_at` 설정 (기본 7일). `cleanup.ts`가 만료 파일을 배치 삭제. 조회 시 항상 `gt("expires_at", now)` 필터.
6. **배포 파일의 student_id는 null**: 배포 원본 파일은 특정 학생에 속하지 않음. `insertDistributionSourceFile()`로 student_id=null 삽입. 학생 쿼터에 미포함.
7. **XSS 방지**: 사용자 입력(제목, 설명, 반려 사유)은 `<`/`>` 이스케이프 + 길이 제한. 새 액션 추가 시 동일 패턴 적용.

## Tests
```bash
# 테스트 파일 없음 — 신규 기능 추가 시 테스트 작성 권장
pnpm test lib/domains/drive
```

## Related Domains
- `chat`: MIME magic bytes 검증 (`verifyMimeType`), 첨부파일 드라이브 저장
- `calendar`: 워크플로우 마감일 캘린더 이벤트 연동
- `admin-plan`: 캘린더 이벤트 생성 (`createCalendarEventAction`)
