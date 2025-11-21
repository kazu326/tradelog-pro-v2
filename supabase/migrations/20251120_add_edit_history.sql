-- Add edit_history column to trades table
-- JSONB type is used to store array of edit history objects
ALTER TABLE trades ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb;

-- Optional: Add comment to the column
COMMENT ON COLUMN trades.edit_history IS 'Array of audit logs for trade modifications';

