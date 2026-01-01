# TimeLevelUp Python 분석 환경

학습 데이터 분석 및 ML 기반 추천을 위한 Python 패키지입니다.

## 설치

### 1. UV 설치 (권장)

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# 프로젝트 의존성 설치
cd python
uv sync
```

### 2. pip 설치 (대안)

```bash
cd python
pip install -e .
```

## 환경 설정

프로젝트 루트의 `.env.local` 파일에 Supabase 정보가 필요합니다:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

## 사용법

### Jupyter 노트북

```bash
cd python
uv run jupyter lab
```

또는

```bash
jupyter lab
```

### 주요 노트북

- `notebooks/learning_pattern_analysis.ipynb` - 학습 패턴 분석
- `notebooks/score_trend_analysis.ipynb` - 성적 트렌드 분석

### Python 코드에서 사용

```python
from src.db_connector import get_connector
from src.analysis import analyze_learning_patterns, analyze_score_trends

# DB 연결
db = get_connector()

# 학생 데이터 조회
scores = db.get_student_scores("student-uuid")
plans = db.get_student_plans("student-uuid")

# 분석 실행
pattern_analysis = analyze_learning_patterns(plans)
score_analysis = analyze_score_trends(scores)
```

## 모듈 구조

```
python/
├── pyproject.toml          # 프로젝트 설정
├── README.md
├── notebooks/              # Jupyter 노트북
│   ├── learning_pattern_analysis.ipynb
│   └── score_trend_analysis.ipynb
├── src/                    # 소스 코드
│   ├── __init__.py
│   ├── config.py          # 설정 및 상수
│   ├── db_connector.py    # Supabase 연결
│   └── analysis.py        # 분석 유틸리티
└── tests/                  # 테스트
```

## 주요 기능

### 학습 패턴 분석
- 요일별/시간대별 학습량 분포
- 과목별 학습 시간 분석
- 완료율 및 이행률 분석
- 다음 주 학습량 예측

### 성적 트렌드 분석
- 전체 성적 추이 (이동평균 포함)
- 과목별 성적 분포
- 등급별 분포
- 취약 과목 분석
- 학습-성적 상관관계

## 향후 계획

### Phase 3b: ML API 서비스
- FastAPI 기반 REST API
- 성적 예측 모델 (XGBoost)
- 콘텐츠 추천 시스템 (협업 필터링)
- 자동 플랜 최적화

## 라이선스

Private - TimeLevelUp
