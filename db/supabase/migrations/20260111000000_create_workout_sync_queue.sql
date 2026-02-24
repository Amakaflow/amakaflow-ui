-- Create workout_sync_queue table for tracking sync state (AMA-307)
-- Tracks pending/synced/failed state for workouts synced to mobile devices.
-- Replaces the misleading ios_companion_synced_at timestamp approach.

CREATE TABLE IF NOT EXISTS workout_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,  -- Clerk user ID

  -- Device info
  device_type TEXT NOT NULL CHECK (device_type IN ('ios', 'android', 'garmin')),
  device_id TEXT NOT NULL DEFAULT '',  -- Empty string means "any device of this type"

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),

  -- Timestamps
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Error info for failed syncs
  error_message TEXT,

  -- Prevent duplicate queue entries for same workout/device
  UNIQUE(workout_id, device_type, device_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON workout_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON workout_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_device_type ON workout_sync_queue(device_type);
CREATE INDEX IF NOT EXISTS idx_sync_queue_workout ON workout_sync_queue(workout_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON workout_sync_queue(user_id, device_type) WHERE status = 'pending';

-- Comments for documentation
COMMENT ON TABLE workout_sync_queue IS 'Tracks sync state for workouts pushed to mobile devices (AMA-307)';
COMMENT ON COLUMN workout_sync_queue.device_type IS 'Target device platform: ios, android, or garmin';
COMMENT ON COLUMN workout_sync_queue.device_id IS 'Device identifier for multi-device support (empty string = any device)';
COMMENT ON COLUMN workout_sync_queue.status IS 'Sync state: pending (queued), synced (confirmed), failed (error)';
COMMENT ON COLUMN workout_sync_queue.queued_at IS 'When workout was queued for sync (web push action)';
COMMENT ON COLUMN workout_sync_queue.synced_at IS 'When device confirmed successful download';
COMMENT ON COLUMN workout_sync_queue.failed_at IS 'When device reported download failure';

-- Enable RLS
ALTER TABLE workout_sync_queue ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see their own sync queue entries
CREATE POLICY "Users can view their own sync queue"
  ON workout_sync_queue
  FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS policy: Service role can do everything
CREATE POLICY "Service role has full access to sync queue"
  ON workout_sync_queue
  FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Migrate existing ios_companion_synced_at data to sync queue
-- Any workout with ios_companion_synced_at set is considered already synced
INSERT INTO workout_sync_queue (workout_id, user_id, device_type, device_id, status, queued_at, synced_at)
SELECT
  id AS workout_id,
  profile_id AS user_id,
  'ios' AS device_type,
  '' AS device_id,
  'synced' AS status,
  ios_companion_synced_at AS queued_at,
  ios_companion_synced_at AS synced_at
FROM workouts
WHERE ios_companion_synced_at IS NOT NULL
ON CONFLICT (workout_id, device_type, device_id) DO NOTHING;

-- Migrate existing android_companion_synced_at data
INSERT INTO workout_sync_queue (workout_id, user_id, device_type, device_id, status, queued_at, synced_at)
SELECT
  id AS workout_id,
  profile_id AS user_id,
  'android' AS device_type,
  '' AS device_id,
  'synced' AS status,
  android_companion_synced_at AS queued_at,
  android_companion_synced_at AS synced_at
FROM workouts
WHERE android_companion_synced_at IS NOT NULL
ON CONFLICT (workout_id, device_type, device_id) DO NOTHING;
