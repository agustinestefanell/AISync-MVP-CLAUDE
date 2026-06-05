-- Add capture_method to token_usage
-- Distinguishes how usage was captured: 'stream_final' (via finalMessage) or 'response_usage' (via response.usage).

alter table public.token_usage
add column if not exists capture_method text;
