-- calendar_events 실시간 동기화 활성화
-- 학생↔관리자 간 이벤트 변경 실시간 반영

-- 1. Replica Identity를 FULL로 변경 (필터 기반 구독이 동작하려면 필수)
ALTER TABLE calendar_events REPLICA IDENTITY FULL;

-- 2. supabase_realtime publication에 추가
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
