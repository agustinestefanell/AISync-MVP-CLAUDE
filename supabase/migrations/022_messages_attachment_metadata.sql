-- Add attachment metadata to messages
-- Stores only lightweight metadata for UI reload.
-- Does not store base64 file data.

ALTER TABLE messages
ADD COLUMN attachment_metadata jsonb;
