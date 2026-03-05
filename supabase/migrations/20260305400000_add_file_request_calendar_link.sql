-- Link file requests to calendar events
-- 파일 요청 기한을 캘린더 이벤트로 연결

ALTER TABLE public.file_requests
ADD COLUMN calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL;

CREATE INDEX idx_file_requests_calendar_event ON public.file_requests(calendar_event_id)
WHERE calendar_event_id IS NOT NULL;
