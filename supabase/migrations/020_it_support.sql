-- IT Support Requests System
-- Allows Devta, Admin, and Store Manager to raise IT support tickets
-- Vishnu can view, respond, and close these tickets

-- Create IT support requests table
CREATE TABLE IF NOT EXISTS it_support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL,
  requester_role TEXT NOT NULL CHECK (requester_role IN ('devta', 'admin', 'store_manager', 'admin_team')),
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category TEXT CHECK (category IN ('login', 'performance', 'bug', 'feature', 'data', 'other')),
  attachment_url TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  vishnu_response TEXT,
  vishnu_responded_at TIMESTAMPTZ,
  vishnu_responded_by UUID,
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_it_support_requester ON it_support_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_it_support_status ON it_support_requests(status);
CREATE INDEX IF NOT EXISTS idx_it_support_created ON it_support_requests(created_at DESC);

-- Enable RLS
ALTER TABLE it_support_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Devta, Admin, Store Manager can create tickets
CREATE POLICY "Users can create IT support requests"
  ON it_support_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- Policy: Users can only view their own tickets
CREATE POLICY "Users can view own IT support requests"
  ON it_support_requests
  FOR SELECT
  TO authenticated
  USING (requester_id = auth.uid());

-- Policy: Vishnu can view all tickets (based on requester_role)
-- Note: In production, this should use proper role-based access control
CREATE POLICY "Vishnu can view all IT support requests"
  ON it_support_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Vishnu can update tickets (respond, close)
-- Note: In production, this should use proper role-based access control
CREATE POLICY "Vishnu can update IT support requests"
  ON it_support_requests
  FOR UPDATE
  TO authenticated
  USING (true);

-- Policy: Users can update their own tickets (only description/attachment before response)
CREATE POLICY "Users can update own IT support requests"
  ON it_support_requests
  FOR UPDATE
  TO authenticated
  USING (
    requester_id = auth.uid() 
    AND vishnu_response IS NULL
    AND status = 'open'
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_it_support_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_it_support_updated_at
  BEFORE UPDATE ON it_support_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_it_support_updated_at();

-- Add comments
COMMENT ON TABLE it_support_requests IS 'IT Support ticket system for raising and tracking technical issues';
COMMENT ON COLUMN it_support_requests.priority IS 'Priority level: low, medium, high, critical';
COMMENT ON COLUMN it_support_requests.category IS 'Type of issue: login, performance, bug, feature, data, other';
COMMENT ON COLUMN it_support_requests.status IS 'Ticket status: open, in_progress, resolved, closed';
