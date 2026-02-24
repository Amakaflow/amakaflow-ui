-- Training Rules Table
-- Stores configurable rules for the Smart Planner engine
CREATE TABLE training_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('hard', 'soft', 'suggest')),
  category TEXT NOT NULL CHECK (category IN (
    'muscle_recovery', 'running', 'load_management', 
    'hrv_recovery', 'scheduling', 'hyrox', 'custom'
  )),
  version INTEGER DEFAULT 1,
  enabled BOOLEAN DEFAULT TRUE,
  conditions JSONB NOT NULL DEFAULT '[]',
  prevents JSONB DEFAULT '[]',
  suggests JSONB DEFAULT '[]',
  reason TEXT,
  sources JSONB DEFAULT '[]',
  priority INTEGER DEFAULT 100,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Status Table
-- Tracks recovery status per user per day
CREATE TABLE daily_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  recovery_status TEXT CHECK (recovery_status IN ('green', 'yellow', 'red', 'blue')),
  recovery_score INTEGER CHECK (recovery_score >= 0 AND recovery_score <= 100),
  hrv DECIMAL,
  resting_hr INTEGER,
  sleep_hours DECIMAL,
  sleep_quality TEXT CHECK (sleep_quality IN ('poor', 'fair', 'good', 'excellent')),
  daily_load INTEGER DEFAULT 0,
  weekly_load INTEGER DEFAULT 0,
  notes TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'apple_health', 'whoop', 'garmin', 'calculated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Add block_type and anchor_type to workout_events
ALTER TABLE workout_events 
ADD COLUMN IF NOT EXISTS block_type TEXT DEFAULT 'workout' 
CHECK (block_type IN (
  'strength', 'run', 'hyrox', 'recovery', 'mobility',
  'gym_class', 'pt_session', 'social_workout', 'imported', 'workout'
));

ALTER TABLE workout_events
ADD COLUMN IF NOT EXISTS anchor_type TEXT DEFAULT 'none'
CHECK (anchor_type IN ('hard', 'soft', 'none'));

ALTER TABLE workout_events
ADD COLUMN IF NOT EXISTS load_score INTEGER DEFAULT 0;

ALTER TABLE workout_events
ADD COLUMN IF NOT EXISTS skipped_dates JSONB DEFAULT '[]';

-- Update is_anchor based on anchor_type for consistency
CREATE OR REPLACE FUNCTION sync_anchor_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_anchor = (NEW.anchor_type != 'none');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_anchor_status ON workout_events;

CREATE TRIGGER trigger_sync_anchor_status
BEFORE INSERT OR UPDATE ON workout_events
FOR EACH ROW
EXECUTE FUNCTION sync_anchor_status();

-- Indexes
CREATE INDEX idx_training_rules_category ON training_rules(category);
CREATE INDEX idx_training_rules_type ON training_rules(type);
CREATE INDEX idx_training_rules_enabled ON training_rules(enabled) WHERE enabled = TRUE;
CREATE INDEX idx_daily_status_user_date ON daily_status(user_id, date);
CREATE INDEX IF NOT EXISTS idx_workout_events_block_type ON workout_events(block_type);
CREATE INDEX IF NOT EXISTS idx_workout_events_anchor_type ON workout_events(anchor_type);

-- RLS Policies
ALTER TABLE training_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_status ENABLE ROW LEVEL SECURITY;

-- Training rules are readable by all authenticated users
CREATE POLICY select_training_rules ON training_rules
  FOR SELECT USING (true);

-- Only system/admin can modify rules (for now)
CREATE POLICY insert_training_rules ON training_rules
  FOR INSERT WITH CHECK (created_by = 'system');

-- Daily status - users can only see/modify their own
CREATE POLICY select_own_daily_status ON daily_status
  FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY insert_own_daily_status ON daily_status
  FOR INSERT WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY update_own_daily_status ON daily_status
  FOR UPDATE USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Insert default rules
INSERT INTO training_rules (rule_id, name, description, type, category, conditions, prevents, suggests, reason, priority) VALUES

-- HARD RULES (Must follow)
('no_heavy_legs_back_to_back', 
 'Heavy Legs Recovery', 
 'Prevent heavy lower body work on consecutive days',
 'hard', 
 'muscle_recovery',
 '[{"field": "previous_day.primary_muscle", "operator": "in", "value": ["lower", "full_body"]}, {"field": "previous_day.intensity", "operator": ">=", "value": 2}]',
 '[{"block_type": "strength", "primary_muscle": ["lower", "full_body"], "intensity": [2, 3]}]',
 '[{"block_type": "strength", "primary_muscle": "upper", "reason": "Lower body needs 48hr recovery after heavy session"}, {"block_type": "recovery", "reason": "Active recovery aids muscle repair"}, {"block_type": "mobility", "reason": "Mobility work helps leg recovery"}]',
 'Heavy lower body work causes significant muscle damage requiring 48-72hr recovery',
 100
),

('no_hard_run_after_legs',
 'No Hard Run After Legs',
 'Prevent tempo/interval runs after heavy leg day',
 'hard',
 'running',
 '[{"field": "previous_day.primary_muscle", "operator": "in", "value": ["lower", "full_body"]}, {"field": "previous_day.intensity", "operator": ">=", "value": 2}]',
 '[{"block_type": "run", "intensity": [2, 3]}]',
 '[{"block_type": "run", "intensity": 1, "reason": "Easy run only - legs need recovery"}, {"block_type": "strength", "primary_muscle": "upper", "reason": "Upper body work while legs recover"}]',
 'Running hard on fatigued legs increases injury risk and reduces performance',
 100
),

('hard_run_recovery',
 'Hard Run Recovery',
 'Easy or rest day after hard running efforts',
 'hard',
 'running',
 '[{"field": "previous_day.block_type", "operator": "==", "value": "run"}, {"field": "previous_day.intensity", "operator": ">=", "value": 2}]',
 '[{"block_type": "run", "intensity": [2, 3]}, {"block_type": "strength", "primary_muscle": ["lower"], "intensity": [2, 3]}]',
 '[{"block_type": "run", "intensity": 1, "reason": "Easy run promotes recovery"}, {"block_type": "recovery", "reason": "Full recovery day optimal"}, {"block_type": "mobility", "reason": "Mobility aids running recovery"}]',
 'Hard running efforts require easy/rest days to adapt and prevent overtraining',
 100
),

('long_run_recovery',
 'Long Run Recovery',
 'No heavy work same day as long run, easy next day',
 'hard',
 'running',
 '[{"field": "previous_day.block_type", "operator": "==", "value": "run"}, {"field": "previous_day.title", "operator": "contains", "value": "long"}]',
 '[{"block_type": "strength", "primary_muscle": ["lower", "full_body"]}, {"block_type": "run", "intensity": [2, 3]}, {"block_type": "hyrox"}]',
 '[{"block_type": "mobility", "reason": "Post-long run mobility speeds recovery"}, {"block_type": "recovery", "reason": "Active recovery recommended"}, {"block_type": "run", "intensity": 1, "reason": "Easy shake-out run OK"}]',
 'Long runs deplete glycogen and cause muscle damage - avoid loading legs for 24-48hr',
 100
),

('sled_recovery',
 'Sled Push/Pull Recovery',
 'Extended recovery after heavy sled work',
 'hard',
 'hyrox',
 '[{"field": "previous_day.block_type", "operator": "==", "value": "hyrox"}, {"field": "previous_day.intensity", "operator": ">=", "value": 2}]',
 '[{"block_type": "strength", "primary_muscle": ["lower", "full_body"], "for_hours": 48}, {"block_type": "hyrox", "for_hours": 72}]',
 '[{"block_type": "strength", "primary_muscle": "upper", "reason": "Upper body while legs recover from sled"}, {"block_type": "run", "intensity": 1, "reason": "Easy run aids recovery"}, {"block_type": "mobility", "reason": "Hip and leg mobility essential"}]',
 'Sled work causes significant eccentric leg fatigue requiring extended recovery',
 100
),

-- SOFT RULES (Should follow)
('weekly_load_cap',
 'Weekly Load Management',
 'Warn when weekly training load exceeds threshold',
 'soft',
 'load_management',
 '[{"field": "week.total_load", "operator": ">", "value": 800}]',
 '[]',
 '[{"block_type": "recovery", "reason": "Weekly load is high - prioritize recovery"}, {"block_type": "mobility", "reason": "Active recovery to manage fatigue"}]',
 'High weekly training load increases injury risk and reduces adaptation',
 80
),

('max_hard_sessions',
 'Max Hard Sessions Per Week',
 'Limit consecutive hard training days',
 'soft',
 'load_management',
 '[{"field": "week.hard_sessions", "operator": ">=", "value": 3}, {"field": "previous_day.intensity", "operator": ">=", "value": 2}]',
 '[{"intensity": [3]}]',
 '[{"block_type": "recovery", "reason": "Multiple hard days - recovery needed"}, {"intensity": 1, "reason": "Keep intensity low today"}]',
 'More than 2-3 hard sessions back-to-back impairs recovery',
 80
),

('one_rest_day_per_week',
 'Weekly Rest Day',
 'Ensure at least one full rest day per week',
 'soft',
 'load_management',
 '[{"field": "week.rest_days", "operator": "<", "value": 1}, {"field": "week.day_number", "operator": ">=", "value": 5}]',
 '[]',
 '[{"block_type": "recovery", "reason": "No rest day yet this week - consider today"}, {"action": "rest", "reason": "Full rest day recommended"}]',
 'At least one rest day per week optimizes adaptation and prevents burnout',
 70
),

('am_pm_balance',
 'AM/PM Session Balance',
 'Keep PM session easy if AM was hard',
 'soft',
 'scheduling',
 '[{"field": "current_day.am_session.intensity", "operator": ">=", "value": 2}]',
 '[{"time_of_day": "pm", "intensity": [2, 3]}]',
 '[{"block_type": "mobility", "time_of_day": "pm", "reason": "PM mobility after hard AM session"}, {"block_type": "recovery", "time_of_day": "pm", "reason": "Easy PM work only"}]',
 'Two hard sessions same day is excessive for most athletes',
 60
),

-- SUGGESTION RULES (Nice to have)
('post_run_mobility',
 'Post-Run Mobility',
 'Suggest mobility after running sessions',
 'suggest',
 'running',
 '[{"field": "current_day.has_run", "operator": "==", "value": true}]',
 '[]',
 '[{"block_type": "mobility", "duration": 15, "time_of_day": "pm", "reason": "15-20min mobility improves running recovery"}]',
 'Regular mobility work improves running economy and reduces injury risk',
 50
),

('core_on_easy_days',
 'Core Work Suggestion',
 'Suggest core work on easier training days',
 'suggest',
 'scheduling',
 '[{"field": "current_day.intensity", "operator": "<=", "value": 1}, {"field": "week.core_sessions", "operator": "<", "value": 2}]',
 '[]',
 '[{"block_type": "strength", "primary_muscle": "core", "duration": 15, "reason": "Core work pairs well with easy days"}]',
 'Core strength benefits all training without significant fatigue cost',
 40
),

('upper_lower_split',
 'Upper/Lower Split',
 'Suggest alternating upper and lower focus',
 'suggest',
 'muscle_recovery',
 '[{"field": "previous_day.primary_muscle", "operator": "==", "value": "upper"}]',
 '[]',
 '[{"block_type": "strength", "primary_muscle": "lower", "reason": "Lower body day - upper had yesterday"}, {"block_type": "run", "reason": "Running works well after upper day"}]',
 'Alternating muscle groups optimizes recovery between sessions',
 40
);

-- Updated at triggers (only create if function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
    CREATE TRIGGER update_training_rules_updated_at
    BEFORE UPDATE ON training_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

    CREATE TRIGGER update_daily_status_updated_at
    BEFORE UPDATE ON daily_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
