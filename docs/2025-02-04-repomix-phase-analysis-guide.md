# Repomix 단계별 분석 가이드

## 📋 개요

프로젝트 규모가 크기 때문에 (270K+ 줄), repomix 분석을 6단계로 나누어 진행했습니다.

**작업 일시**: 2025-02-04

---

## 📊 분석 결과 요약

| Phase    | 영역      | 파일 수   | 토큰 수       | 파일 크기 | 설명                                |
| -------- | --------- | --------- | ------------- | --------- | ----------------------------------- |
| Phase 1  | 인프라    | 17        | 24,598        | 107KB     | Supabase, 인증 설정                 |
| Phase 2  | 유틸리티  | 79        | 83,688        | 329KB     | 공통 유틸, 타입, UI 컴포넌트        |
| Phase 3  | 학생 핵심 | 279       | 537,870       | 2.3MB     | 플랜, 성적, 메트릭, 목표            |
| Phase 4  | 학생 확장 | 222       | 420,739       | 1.7MB     | 콘텐츠, 오늘의 학습, 대시보드, 캠프 |
| Phase 5  | 관리자    | 232       | 415,173       | 1.8MB     | 관리자 페이지 전체                  |
| Phase 6  | 나머지    | 181       | 227,193       | 919KB     | 부모, 슈퍼관리자, 공통 로직         |
| **합계** | -         | **1,010** | **1,709,261** | **7.1MB** | -                                   |

**참고**: 기존 전체 파일 (`repomix-output.xml`)은 270,302줄로 약 15MB 정도였습니다.

---

## 🔍 Phase별 상세 내용

### Phase 1: 핵심 인프라

**파일**: `repomix-phase1-infrastructure.xml`

**포함 경로**:

- `lib/supabase/` - 데이터베이스 클라이언트 설정
- `lib/auth/` - 인증 관련 유틸리티

**주요 내용**:

- Supabase 클라이언트 생성 (Browser, Server, Admin)
- 인증 헬퍼 함수
- 세션 관리
- Rate limit 처리

**분석 시 활용**: 프로젝트의 기본 인프라 구조를 이해할 때

---

### Phase 2: 공통 유틸리티 및 UI 컴포넌트

**파일**: `repomix-phase2-utils.xml`

**포함 경로**:

- `lib/utils/` - 유틸리티 함수들 (44개 파일)
- `lib/types/` - 타입 정의 (12개 파일)
- `components/ui/` - 기본 UI 컴포넌트

**주요 내용**:

- 날짜 처리, 포맷팅
- 숫자 포맷팅
- 캐싱 전략
- UI 컴포넌트 (Button, Card, Dialog 등)

**분석 시 활용**: 공통 로직과 UI 컴포넌트를 이해할 때

---

### Phase 3: 학생 도메인 핵심 (가장 큰 부분)

**파일**: `repomix-phase3-student-core.xml`

**포함 경로**:

- `app/(student)/plan/` - 학습 계획 생성/관리
- `app/(student)/scores/` - 성적 관리
- `lib/plan/` - 플랜 관련 비즈니스 로직
- `lib/scores/` - 성적 처리 로직
- `lib/metrics/` - 학습 지표 계산
- `lib/goals/` - 목표 관리

**주요 내용**:

- 플랜 그룹 생성 위저드
- 1730 타임테이블 로직
- 성적 분석 및 트렌드
- 학습 지표 계산 (완료율, 학습 시간, 연속 일수 등)
- 목표 설정 및 추적

**분석 시 활용**: 학생의 핵심 학습 관리 기능을 이해할 때

---

### Phase 4: 학생 도메인 확장

**파일**: `repomix-phase4-student-extended.xml`

**포함 경로**:

- `app/(student)/contents/` - 콘텐츠 관리
- `app/(student)/today/` - 오늘의 학습
- `app/(student)/dashboard/` - 대시보드
- `app/(student)/analysis/` - 학습 분석
- `app/(student)/blocks/` - 블록 관리
- `app/(student)/camp/` - 캠프 기능
- `lib/data/` - 데이터 페칭 로직
- `lib/recommendations/` - 추천 엔진

**주요 내용**:

- 마스터 북/강의 관리
- 오늘의 학습 계획 표시
- 대시보드 통계
- 학습 패턴 분석
- 콘텐츠 추천 알고리즘

**분석 시 활용**: 학생의 확장 기능 및 추천 시스템을 이해할 때

---

### Phase 5: 관리자 영역

**파일**: `repomix-phase5-admin.xml`

**포함 경로**:

- `app/(admin)/` - 관리자 페이지 전체
- `lib/data/admin/` - 관리자용 데이터 페칭

**주요 내용**:

- 학생 관리
- 캠프 템플릿 관리
- 콘텐츠 메타데이터 관리
- 출석 관리
- SMS 발송
- 통계 및 리포트

**분석 시 활용**: 관리자 기능을 이해할 때

---

### Phase 6: 나머지 영역 및 공통

**파일**: `repomix-phase6-others.xml`

**포함 경로**:

- `app/(parent)/` - 부모 영역
- `app/(superadmin)/` - 슈퍼관리자 영역
- `app/login/`, `app/signup/` - 인증 페이지
- `app/actions/` - Server Actions
- `app/api/` - API 라우트
- `components/navigation/` - 네비게이션 컴포넌트
- `components/layout/` - 레이아웃 컴포넌트
- `lib/domains/` - 도메인 로직
- `lib/coaching/` - 코칭 엔진
- `lib/risk/` - 리스크 분석
- `lib/reschedule/` - 재스케줄링 로직

**주요 내용**:

- 부모 대시보드 및 리포트
- 슈퍼관리자 기능
- 인증 플로우
- API 엔드포인트
- 재스케줄링 엔진
- 코칭 및 리스크 분석

**분석 시 활용**: 부가 기능 및 인프라 관련 로직을 이해할 때

---

## 🚀 사용 방법

### 각 Phase별 분석

```bash
# Phase 1: 인프라
npx repomix lib/supabase lib/auth -o repomix-phase1-infrastructure.xml

# Phase 2: 유틸리티
npx repomix lib/utils lib/types components/ui -o repomix-phase2-utils.xml

# Phase 3: 학생 핵심
npx repomix app/(student)/plan app/(student)/scores lib/plan lib/scores lib/metrics lib/goals -o repomix-phase3-student-core.xml

# Phase 4: 학생 확장
npx repomix app/(student)/contents app/(student)/today app/(student)/dashboard app/(student)/analysis app/(student)/blocks app/(student)/camp lib/data lib/recommendations -o repomix-phase4-student-extended.xml

# Phase 5: 관리자
npx repomix app/(admin) lib/data/admin -o repomix-phase5-admin.xml

# Phase 6: 나머지
npx repomix app/(parent) app/(superadmin) app/login app/signup app/actions app/api components/navigation components/layout lib/domains lib/coaching lib/risk lib/reschedule -o repomix-phase6-others.xml
```

### 전체 재생성 스크립트

`scripts/repomix-phase-analysis.sh` 파일을 생성하여 한 번에 실행 가능합니다.

---

## 📝 분석 전략

### 1. 점진적 이해 (권장)

- Phase 1부터 순서대로 분석
- 각 Phase 완료 후 다음 단계로 진행

### 2. 특정 기능 중심

- 특정 기능만 분석하고 싶을 때 해당 Phase만 사용
- 예: 플랜 기능만 분석 → Phase 3

### 3. 병렬 분석

- 각 Phase는 독립적이므로 동시에 분석 가능
- 여러 AI 세션에서 각각 다른 Phase 분석

---

## 💡 팁

1. **Phase 3가 가장 큽니다** (2.3MB) - 학생 핵심 기능 분석 시 주의
2. **Phase별로 독립적**이므로 필요한 부분만 선택 가능
3. **기존 전체 파일** (`repomix-output.xml`)은 백업 후 삭제 가능
4. 각 Phase의 **토큰 수**를 참고하여 AI 모델의 토큰 제한에 맞춰 분석

---

## 🔄 업데이트

프로젝트가 업데이트되면 필요한 Phase만 재생성하면 됩니다:

```bash
# 예: 학생 플랜 기능만 변경되었을 때
npx repomix app/(student)/plan lib/plan -o repomix-phase3-student-core.xml
```

---

## 📌 참고사항

- 모든 분석 파일은 `.gitignore`에 추가하는 것을 권장합니다
- 파일 크기가 크므로 필요할 때만 생성하세요
- 각 Phase는 약 1-2분 정도 소요됩니다

---

## 📝 Phase별 개선 요청 프롬프트 템플릿

### Phase 1: 인프라 개선 프롬프트

#### 일반적인 개선 요청

```
repomix-phase1-infrastructure.xml 파일을 분석하고, Supabase 클라이언트 설정과 인증 관련 코드를 검토해주세요.

다음 항목을 중심으로 개선점을 제안해주세요:
1. 에러 핸들링 패턴의 일관성
2. 타입 안전성 (any 타입 사용 여부)
3. Rate limit 처리의 효율성
4. 세션 관리 로직의 보안성
5. 코드 중복 제거 가능성
```

#### 구체적인 개선 항목

```
repomix-phase1-infrastructure.xml의 인증 시스템을 분석하고:
- getCurrentUser, getCurrentUserRole 함수의 성능 최적화
- Rate limit 처리 로직의 개선 (더 효율적인 캐싱 전략)
- 에러 메시지의 일관성 및 사용자 친화성 개선
- Supabase 클라이언트 생성 시 중복 코드 제거 방안
```

#### 보안 검토

```
repomix-phase1-infrastructure.xml의 보안 관점에서 검토해주세요:
- 인증 토큰 처리 방식
- 세션 관리 보안 취약점
- Rate limit 우회 가능성
- 민감 정보 노출 위험
```

---

### Phase 2: 유틸리티 개선 프롬프트

#### 일반적인 개선 요청

```
repomix-phase2-utils.xml을 분석하고, 공통 유틸리티 함수와 UI 컴포넌트를 검토해주세요.

다음 항목을 중심으로 개선점을 제안해주세요:
1. 유틸리티 함수의 재사용성 및 범용성
2. 타입 정의의 완성도 및 문서화
3. UI 컴포넌트의 접근성 (a11y)
4. 스타일링 일관성 (Tailwind 사용 패턴)
5. 함수 단위 테스트 가능성
```

---

### Phase 3: 학생 핵심 기능 개선 프롬프트

#### 일반적인 개선 요청

```
repomix-phase3-student-core.xml을 분석하고, 학생의 핵심 학습 관리 기능을 검토해주세요.

다음 항목을 중심으로 개선점을 제안해주세요:
1. 플랜 생성 위저드의 사용자 경험 (UX)
2. 성적 분석 로직의 정확성 및 성능
3. 1730 타임테이블 로직의 복잡도 관리
4. 학습 지표 계산의 정확성
5. 코드 구조 및 모듈화 개선
```

---

### Phase 4: 학생 확장 기능 개선 프롬프트

#### 일반적인 개선 요청

```
repomix-phase4-student-extended.xml을 분석하고, 학생의 확장 기능을 검토해주세요.

다음 항목을 중심으로 개선점을 제안해주세요:
1. 콘텐츠 추천 알고리즘의 정확성
2. 대시보드 성능 최적화 (데이터 페칭)
3. 오늘의 학습 페이지의 로딩 시간 개선
4. 콘텐츠 필터링 기능의 사용성
5. 캠프 기능의 코드 구조
```

---

### Phase 5: 관리자 영역 개선 프롬프트

#### 일반적인 개선 요청

```
repomix-phase5-admin.xml을 분석하고, 관리자 기능을 검토해주세요.

다음 항목을 중심으로 개선점을 제안해주세요:
1. 학생 관리 기능의 UX 개선
2. 캠프 템플릿 관리의 사용성
3. 대량 작업 (Bulk operations) 성능
4. 권한 관리 로직의 안전성
5. 통계 대시보드의 성능
```

---

### Phase 6: 나머지 영역 개선 프롬프트

#### 일반적인 개선 요청

```
repomix-phase6-others.xml을 분석하고, 공통 기능 및 부가 영역을 검토해주세요.

다음 항목을 중심으로 개선점을 제안해주세요:
1. 인증 플로우의 UX 개선
2. API 엔드포인트의 에러 처리
3. 재스케줄링 로직의 성능
4. 네비게이션 컴포넌트의 접근성
5. 코칭 엔진 알고리즘 개선
```

---

## 🎯 범용 프롬프트 템플릿

### 코드 리뷰 프롬프트

```
[Phase 파일명]을 분석하고 다음 관점에서 코드 리뷰를 진행해주세요:

1. **코드 품질**
   - SOLID 원칙 준수 여부
   - 함수/컴포넌트 단일 책임 원칙
   - 코드 중복 제거

2. **타입 안전성**
   - any 타입 사용 여부
   - null 체크 적절성
   - 타입 정의 완성도

3. **성능**
   - 불필요한 리렌더링
   - 데이터 페칭 최적화
   - 메모리 누수 가능성

4. **유지보수성**
   - 코드 가독성
   - 주석 및 문서화
   - 테스트 가능성

5. **프로젝트 가이드라인 준수**
   - 네이밍 규칙
   - 스타일링 정책 (Spacing-First)
   - Export 규칙
```

### 리팩토링 요청 프롬프트

```
[Phase 파일명]에서 다음 리팩토링을 진행해주세요:

**목표**: [개선하고 싶은 구체적인 목표]

**요구사항**:
1. 기존 기능은 유지하면서 코드 구조 개선
2. 타입 안전성 향상
3. 프로젝트 가이드라인 준수
4. 변경 사항에 대한 설명 문서 작성

**중점 검토 영역**:
- [특정 파일/함수/컴포넌트]
- [특정 패턴 또는 로직]
```

---

## 🔬 Phase 1 구체적인 시나리오 예시

### 시나리오 1: Supabase 클라이언트 생성 로직 개선

**상황**: 프로젝트에서 Supabase 클라이언트가 여러 곳에서 생성되며, 일관성 부족과 중복 코드 문제가 있습니다.

**프롬프트**:

```
repomix-phase1-infrastructure.xml을 분석하고, Supabase 클라이언트 생성 로직을 개선해주세요.

**현재 문제점**:
1. Browser, Server, Admin 클라이언트 생성 로직이 각각 다른 파일에 분산되어 있음
2. 에러 처리 방식이 일관되지 않음
3. Rate limit 처리 로직이 중복되어 있음

**개선 요구사항**:
1. 클라이언트 생성 로직의 일관성 확보
2. 공통 에러 처리 로직 추출
3. Rate limit 처리를 중앙화
4. 타입 안전성 강화 (any 타입 제거)
5. Next.js 15의 쿠키 제약사항 고려

**출력 형식**:
- 현재 구조 분석
- 개선 방안 제시
- 구체적인 코드 변경 제안
- 마이그레이션 가이드
```

### 시나리오 2: 인증 함수의 성능 최적화

**상황**: `getCurrentUser`, `getCurrentUserRole` 함수가 자주 호출되는데, 매번 새로운 쿼리를 실행하여 성능 문제가 발생합니다.

**프롬프트**:

```
repomix-phase1-infrastructure.xml의 인증 관련 함수들을 분석하고, 성능을 최적화해주세요.

**대상 함수**:
- getCurrentUser
- getCurrentUserRole
- getTenantInfo
- 기타 세션 관련 함수들

**최적화 목표**:
1. 불필요한 데이터베이스 쿼리 감소
2. 적절한 캐싱 전략 적용
3. 세션 데이터 재사용
4. 동일한 요청 내에서 중복 호출 방지

**제약사항**:
- 기존 API 인터페이스 유지
- 타입 안전성 보장
- Next.js Server Components 환경 고려

**출력 형식**:
- 현재 성능 병목 지점 분석
- 캐싱 전략 제안
- 구체적인 최적화 코드
- 성능 측정 방법
```

### 시나리오 3: Rate Limit 처리 개선

**상황**: Rate limit 처리가 여러 곳에 흩어져 있고, 일관된 방식으로 처리되지 않아 보안 취약점이 있을 수 있습니다.

**프롬프트**:

```
repomix-phase1-infrastructure.xml의 Rate limit 처리 로직을 분석하고 개선해주세요.

**현재 상태 분석**:
1. Rate limit 구현 방식 (토큰 버킷, 슬라이딩 윈도우 등)
2. 적용 범위 및 제한 설정
3. 에러 처리 및 사용자 피드백
4. 로깅 및 모니터링

**개선 요구사항**:
1. 중앙화된 Rate limit 미들웨어/헬퍼
2. 역할별/엔드포인트별 차등 제한
3. 더 정확한 제한 로직 (Redis 등 외부 저장소 활용 검토)
4. Rate limit 초과 시 명확한 에러 메시지
5. 개발 환경에서는 제한 완화 옵션

**출력 형식**:
- 현재 구현 분석
- 개선된 Rate limit 아키텍처 제안
- 구현 코드
- 테스트 케이스
```

### 시나리오 4: 타입 안전성 강화

**상황**: 인프라 코드에서 `any` 타입이 사용되고 있고, Supabase 응답 타입이 명시적으로 정의되지 않은 부분이 있습니다.

**프롬프트**:

```
repomix-phase1-infrastructure.xml을 분석하고, 타입 안전성을 강화해주세요.

**검토 항목**:
1. any 타입 사용 위치 및 대안
2. Supabase 응답 타입의 명시적 정의
3. null/undefined 체크 누락 지점
4. 타입 단언(as)의 적절성
5. 제네릭 활용 가능성

**개선 요구사항**:
1. 모든 any 타입을 구체적인 타입으로 교체
2. Supabase 타입 자동 생성 활용
3. 타입 가드 함수 추가
4. Optional chaining 및 nullish coalescing 적절 활용
5. 타입 에러 없이 컴파일 가능하도록 수정

**출력 형식**:
- any 타입 사용 현황 리포트
- 타입 정의 제안
- 수정된 코드
- 타입 체크 결과
```

### 시나리오 5: 보안 취약점 점검 및 개선

**상황**: 인증 및 세션 관리 로직의 보안 취약점을 점검하고 개선하고 싶습니다.

**프롬프트**:

```
repomix-phase1-infrastructure.xml을 보안 관점에서 종합적으로 검토하고 개선해주세요.

**검토 영역**:
1. 인증 토큰 저장 및 전송 방식
2. 세션 관리 보안 (세션 하이재킹 방지)
3. CSRF/XSS 공격 방어
4. 민감 정보 로깅 여부
5. Rate limit 우회 가능성
6. SQL Injection 방어 (Supabase 사용 시)
7. 권한 검증 로직의 완전성

**개선 요구사항**:
1. 발견된 보안 취약점 리포트
2. 우선순위별 개선 방안
3. 보안 모범 사례 적용
4. 추가 보안 조치 제안

**출력 형식**:
- 보안 취약점 리스트
- 위험도 평가
- 개선 코드
- 보안 체크리스트
```

### 시나리오 6: 에러 처리 통일화

**상황**: 에러 처리 방식이 파일마다 다르고, 일관된 에러 응답 형식이 없습니다.

**프롬프트**:

```
repomix-phase1-infrastructure.xml의 에러 처리 로직을 분석하고 통일화해주세요.

**현재 문제점**:
1. 에러 처리 방식이 함수/파일마다 상이함
2. 에러 메시지 형식이 일관되지 않음
3. 사용자에게 보여줄 에러와 내부 에러 구분이 명확하지 않음
4. 에러 로깅이 체계적이지 않음

**개선 요구사항**:
1. 통일된 에러 클래스/타입 정의
2. 에러 처리 미들웨어/헬퍼 함수
3. 사용자 친화적 에러 메시지 매핑
4. 에러 로깅 표준화
5. 에러 추적 및 모니터링 연동 가능성

**출력 형식**:
- 현재 에러 처리 패턴 분석
- 통일된 에러 처리 아키텍처
- 에러 타입 정의
- 에러 처리 헬퍼 함수
- 마이그레이션 가이드
```

---

## 💡 프롬프트 작성 팁

1. **구체적으로 작성**: "개선해주세요"보다 "성능을 개선해주세요"가 더 효과적
2. **컨텍스트 제공**: 어떤 파일/기능을 다루는지 명시
3. **우선순위 명시**: 여러 개선 사항이 있을 때 우선순위 표시
4. **제약사항 명시**: 유지해야 할 기능이나 고려해야 할 사항 명시
5. **출력 형식 요청**: 필요하면 구체적인 출력 형식 요청 (예: 체크리스트, 코드 예시 등)
