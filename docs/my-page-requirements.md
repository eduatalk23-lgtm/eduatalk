# 마이페이지 기능 요구사항 정리

## 📋 사용자 의도 정리

### 핵심 요구사항

1. **개인 기본 정보**
   - 학교
   - 학년 (중3 ~ 고3 지원)
   - 생년월일
   - 성별
   - 연락처 (본인)
   - 모 연락처 (보호자)
   - 부 연락처 (보호자)

2. **입시 관련 정보**
   - **입시년도**: 학년 기준 자동 계산 + 수동 수정 가능
     - 예: 중3 → 2028년, 고1 → 2027년, 고2 → 2026년, 고3 → 2025년
   - **개정교육과정**: 년도 및 학년 기준 자동 계산 + 수동 수정 가능
     - 개정교육과정에 따라 성적, 교재, 강의의 교과/과목 위계가 달라짐
     - 예: 2022 개정 교육과정 (2024년 중1부터 적용)

3. **진로 정보**
   - 진학 희망 대학교 (1순위, 2순위, 3순위)
   - 희망 진로 계열

### 특별 고려사항

- **중학생 지원**: 중3이 최저 학년 (중1, 중2는 제외)
- **개정교육과정의 영향**: 
  - 이후 성적 입력 시 교과/과목 구조가 개정교육과정에 맞춰 표시
  - 교재 및 강의의 교과/과목 위계도 개정교육과정 기준으로 표시

---

## 🎯 마이페이지에 포함되어야 할 항목 추천

### 1. 기본 정보 섹션

#### 1.1 개인 정보
- ✅ 이름 (이미 존재)
- ✅ 학년 (이미 존재, 중3~고3 선택 가능하도록)
- ✅ 생년월일 (이미 존재)
- ✅ 성별 (신규 추가 필요)
- ✅ 학교 (신규 추가 필요)
- ✅ 반 (이미 존재)
- ✅ 연락처 (본인) (신규 추가 필요)
- ✅ 모 연락처 (신규 추가 필요)
- ✅ 부 연락처 (신규 추가 필요)

#### 1.2 입시 정보
- ✅ 입시년도 (신규 추가 필요)
  - 자동 계산: 현재 학년 기준으로 계산
  - 수동 수정 가능
  - 예시: 중3 → 2028년, 고1 → 2027년, 고2 → 2026년, 고3 → 2025년
- ✅ 개정교육과정 (신규 추가 필요)
  - 자동 계산: 입학년도와 현재 학년 기준으로 계산
  - 수동 수정 가능
  - 옵션: "2009 개정", "2015 개정", "2022 개정" 등

### 2. 진로 정보 섹션

#### 2.1 진학 희망 대학교
- ✅ 1순위 대학교 (신규 추가 필요)
- ✅ 2순위 대학교 (신규 추가 필요)
- ✅ 3순위 대학교 (신규 추가 필요)
- 대학교 검색/선택 기능 필요

#### 2.2 희망 진로 계열
- ✅ 희망 진로 계열 (신규 추가 필요)
- 선택 옵션:
  - 인문계열
  - 사회계열
  - 자연계열
  - 공학계열
  - 의약계열
  - 예체능계열
  - 교육계열
  - 농업계열
  - 해양계열
  - 기타

### 3. 추가 추천 항목

#### 3.1 학습 관련 정보
- 📌 목표 대학 입시 전형 방식 (일반전형, 수시전형, 특별전형 등)
- 📌 관심 있는 전공 분야 (상세)
- 📌 학습 스타일 (시각형, 청각형, 읽기형 등)
- 📌 주 학습 시간대

#### 3.2 계정 정보
- 📌 이메일 (auth.users에서 가져오기)
- 📌 가입일
- 📌 최근 로그인 일시
- 📌 비밀번호 변경

#### 3.3 알림 설정
- 📌 이메일 알림 수신 여부
- 📌 SMS 알림 수신 여부
- 📌 학습 리포트 수신 주기

#### 3.4 통계 요약 (읽기 전용)
- 📌 총 학습 시간
- 📌 완료한 교재 수
- 📌 완료한 강의 수
- 📌 입력한 성적 수
- 📌 목표 달성률

---

## 📚 한국 교육과정 개정 이력

### 개정 교육과정 적용 시기

| 개정 교육과정 | 적용 시작 | 적용 학년 | 비고 |
|------------|---------|---------|------|
| 2009 개정 | 2009년 | 초1, 중1, 고1 | |
| 2015 개정 | 2015년 | 초1, 중1, 고1 | |
| 2022 개정 | 2024년 | 초1, 중1, 고1 | 현재 적용 중 |

### 개정 교육과정 자동 계산 로직

```typescript
// 예시 로직
function calculateCurriculumRevision(entranceYear: number, currentGrade: string): string {
  const currentYear = new Date().getFullYear();
  const gradeNumber = parseInt(currentGrade.replace(/[^0-9]/g, ''));
  
  // 중학교 기준
  if (currentGrade.includes('중')) {
    const middleSchoolStartYear = entranceYear + 3; // 초등학교 6년 후
    // 2022 개정: 2024년 중1부터
    if (middleSchoolStartYear >= 2024) return '2022 개정';
    // 2015 개정: 2015년 중1부터
    if (middleSchoolStartYear >= 2015) return '2015 개정';
    return '2009 개정';
  }
  
  // 고등학교 기준
  if (currentGrade.includes('고')) {
    const highSchoolStartYear = entranceYear + 6; // 초등학교 6년 + 중학교 3년 후
    // 2022 개정: 2027년 고1부터 (예상)
    if (highSchoolStartYear >= 2027) return '2022 개정';
    // 2015 개정: 2018년 고1부터
    if (highSchoolStartYear >= 2018) return '2015 개정';
    return '2009 개정';
  }
  
  return '2022 개정'; // 기본값
}
```

### 입시년도 자동 계산 로직

```typescript
// 예시 로직
function calculateExamYear(currentGrade: string): number {
  const currentYear = new Date().getFullYear();
  const gradeNumber = parseInt(currentGrade.replace(/[^0-9]/g, ''));
  
  if (currentGrade.includes('중')) {
    // 중3 → 3년 후 (고등학교 3년)
    return currentYear + (4 - gradeNumber);
  }
  
  if (currentGrade.includes('고')) {
    // 고1 → 2년 후, 고2 → 1년 후, 고3 → 올해
    return currentYear + (4 - gradeNumber);
  }
  
  return currentYear + 1; // 기본값
}
```

---

## 🎓 희망 진로 계열 상세 정보

### 계열별 세부 분류

#### 1. 인문계열
- 국어국문학, 영어영문학, 철학, 역사학, 종교학 등

#### 2. 사회계열
- 경영학, 경제학, 정치외교학, 사회학, 심리학, 법학 등

#### 3. 자연계열
- 수학, 물리학, 화학, 생물학, 지구과학 등

#### 4. 공학계열
- 컴퓨터공학, 전기전자공학, 기계공학, 화학공학, 건축학 등

#### 5. 의약계열
- 의학, 약학, 간호학, 수의학, 치의학 등

#### 6. 예체능계열
- 미술, 음악, 무용, 체육, 연극영화 등

#### 7. 교육계열
- 초등교육, 중등교육, 유아교육, 특수교육 등

#### 8. 농업계열
- 농학, 임학, 축산학, 식품공학 등

#### 9. 해양계열
- 해양학, 수산학, 해양공학 등

#### 10. 기타
- 기타 계열 또는 미정

---

## 🔄 데이터베이스 스키마 변경 필요 사항

### students 테이블에 추가해야 할 컬럼

```sql
-- 기본 정보
ALTER TABLE students ADD COLUMN IF NOT EXISTS school text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('남', '여', '기타'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_phone text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS father_phone text;

-- 입시 정보
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_year integer;
ALTER TABLE students ADD COLUMN IF NOT EXISTS curriculum_revision text; -- '2009 개정', '2015 개정', '2022 개정'

-- 진로 정보
ALTER TABLE students ADD COLUMN IF NOT EXISTS desired_university_1 text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS desired_university_2 text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS desired_university_3 text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS desired_career_field text; -- 진로 계열
```

---

## ✅ 구현 우선순위

### Phase 1: 필수 항목 (즉시 구현)
1. 기본 정보 섹션
   - 학교, 성별, 연락처 (본인, 모, 부)
2. 입시 정보 섹션
   - 입시년도 (자동 계산 + 수동 수정)
   - 개정교육과정 (자동 계산 + 수동 수정)
3. 진로 정보 섹션
   - 진학 희망 대학교 (1, 2, 3순위)
   - 희망 진로 계열

### Phase 2: 추가 기능 (선택)
1. 학습 관련 정보
2. 계정 정보
3. 알림 설정
4. 통계 요약

---

## 📝 참고사항

1. **중학생 지원**: 중3만 지원하므로 학년 선택 시 "중3", "고1", "고2", "고3"만 표시
2. **개정교육과정 영향**: 
   - 성적 입력 시 교과/과목 선택 옵션이 개정교육과정에 맞춰 표시
   - 교재 및 강의의 교과/과목 위계도 개정교육과정 기준으로 필터링
3. **입시년도 계산**: 
   - 중3 → 고등학교 입학 후 3년 = 현재년도 + 4년
   - 고1 → 현재년도 + 3년
   - 고2 → 현재년도 + 2년
   - 고3 → 현재년도 + 1년

