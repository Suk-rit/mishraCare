-- IT Support Comments System
-- Allows chat-like conversation on IT support tickets

-- Create comments table
CREATE TABLE IF NOT EXISTS it_support_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES it_support_requests(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_it_support_comments_ticket ON it_support_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_it_support_comments_created ON it_support_comments(created_at DESC);

-- Disable RLS for now - application-level access control will handle security
ALTER TABLE it_support_comments DISABLE ROW LEVEL SECURITY;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_it_support_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_update_it_support_comments_updated_at ON it_support_comments;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_it_support_comments_updated_at
  BEFORE UPDATE ON it_support_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_it_support_comments_updated_at();

-- Add comments
COMMENT ON TABLE it_support_comments IS 'Comments/conversation on IT support tickets';
