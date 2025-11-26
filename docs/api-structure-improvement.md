# API 라우트 구조 개선안

## 📅 작성일: 2024년 11월 26일

---

## 1. 현재 API 구조 분석

### 1.1 현재 구조

```
app/api/
├── admin/
│   └── check-student-scores/route.ts
├── auth/
│   └── check-superadmin/route.ts
├── goals/
│   └── list/route.ts
├── master-content-details/route.ts
├── master-content-info/route.ts
├── recommended-master-contents/route.ts
├── schools/
│   ├── auto-register/route.ts
│   └── search/route.ts
├── student-content-details/route.ts
├── student-content-info/route.ts
├── tenants/
│   ├── [id]/route.ts
│   └── route.ts
├── test-supabase/route.ts  ❌ 삭제 필요
└── today/
    ├── plans/route.ts
    └── progress/route.ts
```

### 1.2 문제점

1. **네이밍 불일치**
   - kebab-case: `master-content-details`, `check-student-scores`
   - 단수/복수 혼용: `schools/search` vs `goals/list`

2. **RESTful 미준수**
   - `/goals/list` → GET `/goals` 로 변경 권장
   - `/schools/auto-register` → POST `/schools` 내부 로직으로 처리

3. **역할 불명확**
   - Server Actions와 API Route 역할 구분 없음
   - 일부 API는 Server Action으로 대체 가능

4. **도메인 분산**
   - 콘텐츠 관련 API가 여러 곳에 분산

---

## 2. 개선된 API 구조

### 2.1 권장 구조

```
app/api/
├── v1/                           # 버전 관리
│   ├── auth/
│   │   └── superadmin/
│   │       └── route.ts          # GET: 슈퍼관리자 확인
│   │
│   ├── admin/
│   │   └── scores/
│   │       └── check/
│   │           └── route.ts      # GET: 학생 성적 확인
│   │
│   ├── schools/
│   │   └── route.ts              # GET: 검색, POST: 자동등록
│   │
│   ├── contents/
│   │   ├── master/
│   │   │   ├── route.ts          # GET: 마스터 콘텐츠 목록
│   │   │   ├── details/
│   │   │   │   └── route.ts      # GET: 상세 정보
│   │   │   └── recommended/
│   │   │       └── route.ts      # GET: 추천 콘텐츠
│   │   └── student/
│   │       ├── route.ts          # GET: 학생 콘텐츠 목록
│   │       └── details/
│   │           └── route.ts      # GET: 상세 정보
│   │
│   ├── goals/
│   │   └── route.ts              # GET: 목표 목록
│   │
│   ├── tenants/
│   │   ├── route.ts              # GET: 목록, POST: 생성
│   │   └── [id]/
│   │       └── route.ts          # GET, PUT, DELETE: 단건 처리
│   │
│   └── today/
│       ├── plans/
│       │   └── route.ts          # GET: 오늘 플랜
│       └── progress/
│           └── route.ts          # GET, POST: 진행률
```

### 2.2 네이밍 규칙

| 항목 | 규칙 | 예시 |
|------|------|------|
| 엔드포인트 | kebab-case | `/master-contents` |
| 리소스 | 복수형 | `/schools`, `/contents` |
| 파라미터 | camelCase | `?subjectGroup=국어` |
| 동작 | HTTP 메서드 | GET, POST, PUT, DELETE |

### 2.3 HTTP 메서드 규칙

| 동작 | 메서드 | 경로 예시 |
|------|--------|-----------|
| 목록 조회 | GET | `/schools` |
| 단건 조회 | GET | `/schools/[id]` |
| 생성 | POST | `/schools` |
| 수정 | PUT | `/schools/[id]` |
| 삭제 | DELETE | `/schools/[id]` |
| 검색 | GET + query | `/schools?q=서울` |

---

## 3. API vs Server Actions 역할 분리

### 3.1 API Route 사용 케이스

| 케이스 | 이유 |
|--------|------|
| 외부 시스템 연동 | Webhook, 외부 서비스 호출 |
| 클라이언트 사이드 데이터 페칭 | React Query 등 |
| 실시간 데이터 조회 | 폴링, SSE |
| 파일 업로드/다운로드 | 스트리밍 지원 |
| 공개 API | 인증 없는 엔드포인트 |

### 3.2 Server Actions 사용 케이스

| 케이스 | 이유 |
|--------|------|
| 폼 제출 | Next.js 최적화 |
| 인증된 사용자 작업 | 자동 CSRF 보호 |
| 리다이렉트 필요 시 | redirect() 지원 |
| revalidation 필요 시 | revalidatePath() 지원 |

### 3.3 마이그레이션 대상

| 현재 API | 권장 방식 | 이유 |
|----------|-----------|------|
| `/schools/auto-register` | Server Action | 폼 제출 후 리다이렉트 |
| `/goals/list` | Server Action 또는 서버 컴포넌트 직접 조회 | 인증된 사용자 전용 |
| `/admin/check-student-scores` | Server Action | 관리자 전용 |

---

## 4. 즉시 적용 가능한 개선

### 4.1 삭제 대상

```
app/api/test-supabase/route.ts  ← 개발용, 삭제 필요
```

### 4.2 네이밍 통일 (점진적)

현재는 기존 클라이언트 코드 호환성을 위해 유지하고,
새로운 API 추가 시 RESTful 규칙을 따릅니다.

### 4.3 문서화

각 API Route에 JSDoc 주석 추가:

```typescript
/**
 * 학교 검색 API
 * 
 * @route GET /api/schools
 * @query q - 검색어
 * @query type - 학교 타입 (중학교, 고등학교, 대학교)
 * @returns { schools: School[] }
 */
export async function GET(request: NextRequest) {
  // ...
}
```

---

## 5. 향후 계획

### Phase 1: 정리 (현재)
- [x] test-supabase 삭제
- [ ] API 문서화 주석 추가
- [ ] 불필요한 API 식별

### Phase 2: 구조 개선 (다음)
- [ ] v1 폴더 구조 도입
- [ ] 콘텐츠 API 통합
- [ ] RESTful 네이밍 적용

### Phase 3: 최적화 (장기)
- [ ] 캐싱 전략 적용
- [ ] Rate limiting 추가
- [ ] API 모니터링 설정

---

## 6. 참고

- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [RESTful API 설계 가이드](https://restfulapi.net/)

