# 성적 대시보드 테스트 스크립트 개선

## 작업 일시
2024년 11월

## 작업 내용

### testScoreDashboard.ts 스크립트 개선

**파일**: `scripts/testScoreDashboard.ts`

**개선 사항**:
1. **인자 없이 실행 시 학생 목록 표시**
   - 데이터베이스에서 사용 가능한 학생 목록 조회
   - 각 학생의 ID, Tenant ID, Term ID 정보 표시
   - 바로 사용할 수 있는 테스트 명령어 제공

2. **사용법 안내 개선**
   - 더 명확한 사용법 메시지
   - 예시 명령어 제공
   - 더미 데이터 생성 방법 안내

3. **환경 변수 확인**
   - Service Role Key가 없어도 기본 사용법은 표시
   - 학생 목록 조회는 Service Role Key 필요

## 사용 방법

### 1. 학생 목록 확인

인자 없이 실행하면 사용 가능한 학생 목록이 표시됩니다:

```bash
npx tsx scripts/testScoreDashboard.ts
```

출력 예시:
```
📋 사용 가능한 학생 목록 (최근 10명):

  👤 더미학생C_균형형 (ID: a5502255-cec9-4a94-bd83-f71027925436)
     - Tenant ID: 84b71a5d-5681-4da3-88d2-91e75ef89015
     - 학년: 2
     - 학기: 2025년 2학년 1학기
     - Term ID: fff7a412-0613-4ecc-971e-918f21a34b07
     - 테스트 명령어:
       npx tsx scripts/testScoreDashboard.ts a5502255-cec9-4a94-bd83-f71027925436 84b71a5d-5681-4da3-88d2-91e75ef89015 fff7a412-0613-4ecc-971e-918f21a34b07
```

### 2. API 테스트 실행

출력된 명령어를 복사하여 실행하거나, 직접 인자를 제공:

```bash
npx tsx scripts/testScoreDashboard.ts <studentId> <tenantId> [termId]
```

### 3. 더미 데이터 생성

테스트용 더미 데이터가 없으면 생성:

```bash
npx tsx scripts/seedScoreDashboardDummy.ts
```

## 주요 변경 사항

### Before
- 인자 없이 실행 시 단순 오류 메시지만 표시
- 사용자가 어떤 값을 사용해야 할지 알기 어려움

### After
- 인자 없이 실행 시 사용 가능한 학생 목록 표시
- 각 학생에 대한 테스트 명령어 자동 생성
- 더미 데이터 생성 방법 안내

## 테스트 결과

✅ 인자 없이 실행 시 학생 목록 정상 표시
✅ 각 학생의 정보 및 테스트 명령어 정상 생성
✅ 환경 변수 미설정 시에도 기본 사용법 표시

