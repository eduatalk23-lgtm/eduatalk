"""
설정 및 상수 정의
"""

from pathlib import Path

# 프로젝트 경로
PROJECT_ROOT = Path(__file__).parent.parent.parent
PYTHON_ROOT = Path(__file__).parent.parent
NOTEBOOKS_DIR = PYTHON_ROOT / "notebooks"
DATA_DIR = PYTHON_ROOT / "data"

# 과목 분류
SUBJECTS = {
    "국어": ["국어", "화법과작문", "언어와매체", "독서", "문학"],
    "수학": ["수학", "수학I", "수학II", "미적분", "확률과통계", "기하"],
    "영어": ["영어", "영어I", "영어II", "영어독해"],
    "과학": ["물리학I", "물리학II", "화학I", "화학II", "생명과학I", "생명과학II", "지구과학I", "지구과학II"],
    "사회": ["한국사", "세계사", "동아시아사", "경제", "정치와법", "사회문화", "생활과윤리", "윤리와사상", "세계지리", "한국지리"],
    "탐구": [],  # 사회/과학 통합
}

# 학년별 기본 학습 시간 (분)
DEFAULT_STUDY_MINUTES = {
    1: 180,  # 고1
    2: 240,  # 고2
    3: 300,  # 고3
}

# 콘텐츠 타입
CONTENT_TYPES = ["book", "lecture", "video", "custom"]

# 난이도
DIFFICULTY_LEVELS = ["easy", "medium", "hard"]

# 성적 관련 상수
GRADE_BOUNDARIES = {
    1: (96, 100),
    2: (89, 95),
    3: (77, 88),
    4: (60, 76),
    5: (40, 59),
    6: (23, 39),
    7: (11, 22),
    8: (4, 10),
    9: (0, 3),
}

# ML 모델 파라미터
ML_CONFIG = {
    "score_prediction": {
        "model": "xgboost",
        "features": [
            "previous_scores",
            "study_hours",
            "completion_rate",
            "subject_distribution",
        ],
        "target": "next_score",
    },
    "content_recommendation": {
        "model": "collaborative_filtering",
        "features": ["content_type", "subject", "difficulty", "user_history"],
    },
}
