-- student_non_study_time 테이블 삭제
-- 모든 비학습시간 데이터는 calendar_events (event_type='non_study_time')로 마이그레이션 완료
-- 코드에서 .from('student_non_study_time') 참조 0건 확인 완료

DROP TABLE IF EXISTS student_non_study_time CASCADE;
