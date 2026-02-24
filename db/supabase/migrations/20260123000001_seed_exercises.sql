-- Seed canonical exercises table (AMA-299)
-- ~50 common exercises covering major muscle groups and equipment types

INSERT INTO exercises (id, name, aliases, primary_muscles, secondary_muscles, equipment, default_weight_source, supports_1rm, one_rm_formula, category, movement_pattern) VALUES

-- CHEST (Compound)
('barbell-bench-press', 'Barbell Bench Press', ARRAY['Bench Press', 'Flat Bench Press', 'BB Bench'], ARRAY['chest'], ARRAY['anterior_deltoid', 'triceps'], ARRAY['barbell', 'bench'], 'barbell', true, 'brzycki', 'compound', 'push'),
('incline-barbell-bench-press', 'Incline Barbell Bench Press', ARRAY['Incline Bench Press', 'Incline BB Bench'], ARRAY['chest'], ARRAY['anterior_deltoid', 'triceps'], ARRAY['barbell', 'incline_bench'], 'barbell', true, 'brzycki', 'compound', 'push'),
('dumbbell-bench-press', 'Dumbbell Bench Press', ARRAY['DB Bench Press', 'Flat DB Press'], ARRAY['chest'], ARRAY['anterior_deltoid', 'triceps'], ARRAY['dumbbell', 'bench'], 'dumbbell', true, 'brzycki', 'compound', 'push'),
('incline-dumbbell-press', 'Incline Dumbbell Press', ARRAY['Incline DB Press', 'Incline Dumbbell Bench'], ARRAY['chest'], ARRAY['anterior_deltoid', 'triceps'], ARRAY['dumbbell', 'incline_bench'], 'dumbbell', true, 'brzycki', 'compound', 'push'),
('incline-smith-machine-press', 'Incline Smith Machine Press', ARRAY['Smith Machine Incline Press', 'Incline Smith Press'], ARRAY['chest'], ARRAY['anterior_deltoid', 'triceps'], ARRAY['smith_machine', 'incline_bench'], 'machine', true, 'brzycki', 'compound', 'push'),
('push-up', 'Push-Up', ARRAY['Pushup', 'Push Up', 'Press Up'], ARRAY['chest'], ARRAY['anterior_deltoid', 'triceps', 'core'], ARRAY['bodyweight'], 'bodyweight', false, NULL, 'compound', 'push'),

-- CHEST (Isolation)
('dumbbell-fly', 'Dumbbell Fly', ARRAY['DB Fly', 'Dumbbell Flye', 'Chest Fly'], ARRAY['chest'], ARRAY[]::TEXT[], ARRAY['dumbbell', 'bench'], 'dumbbell', false, NULL, 'isolation', 'push'),
('cable-fly', 'Cable Fly', ARRAY['Cable Crossover', 'Cable Chest Fly'], ARRAY['chest'], ARRAY[]::TEXT[], ARRAY['cable'], 'cable', false, NULL, 'isolation', 'push'),
('pec-deck', 'Pec Deck', ARRAY['Pec Deck Machine', 'Butterfly Machine', 'Chest Fly Machine'], ARRAY['chest'], ARRAY[]::TEXT[], ARRAY['machine'], 'machine', false, NULL, 'isolation', 'push'),

-- BACK (Compound)
('barbell-row', 'Barbell Row', ARRAY['Bent Over Row', 'BB Row', 'Bent Over Barbell Row'], ARRAY['lats', 'rhomboids'], ARRAY['biceps', 'posterior_deltoid', 'traps'], ARRAY['barbell'], 'barbell', true, 'brzycki', 'compound', 'pull'),
('dumbbell-row', 'Dumbbell Row', ARRAY['DB Row', 'One Arm Row', 'Single Arm DB Row'], ARRAY['lats', 'rhomboids'], ARRAY['biceps', 'posterior_deltoid'], ARRAY['dumbbell', 'bench'], 'dumbbell', true, 'brzycki', 'compound', 'pull'),
('pull-up', 'Pull-Up', ARRAY['Pullup', 'Pull Up', 'Chin Up'], ARRAY['lats'], ARRAY['biceps', 'rhomboids', 'posterior_deltoid'], ARRAY['pull_up_bar', 'bodyweight'], 'bodyweight', false, NULL, 'compound', 'pull'),
('lat-pulldown', 'Lat Pulldown', ARRAY['Cable Pulldown', 'Wide Grip Pulldown'], ARRAY['lats'], ARRAY['biceps', 'rhomboids'], ARRAY['cable'], 'cable', true, 'brzycki', 'compound', 'pull'),
('seated-cable-row', 'Seated Cable Row', ARRAY['Cable Row', 'Seated Row'], ARRAY['lats', 'rhomboids'], ARRAY['biceps', 'posterior_deltoid'], ARRAY['cable'], 'cable', true, 'brzycki', 'compound', 'pull'),
('t-bar-row', 'T-Bar Row', ARRAY['T Bar Row', 'Landmine Row'], ARRAY['lats', 'rhomboids'], ARRAY['biceps', 'posterior_deltoid', 'traps'], ARRAY['barbell'], 'barbell', true, 'brzycki', 'compound', 'pull'),

-- BACK (Deadlift Variations)
('conventional-deadlift', 'Conventional Deadlift', ARRAY['Deadlift', 'Barbell Deadlift'], ARRAY['lower_back', 'glutes', 'hamstrings'], ARRAY['traps', 'forearms', 'quadriceps'], ARRAY['barbell'], 'barbell', true, 'brzycki', 'compound', 'hinge'),
('romanian-deadlift', 'Romanian Deadlift', ARRAY['RDL', 'Stiff Leg Deadlift'], ARRAY['hamstrings', 'glutes'], ARRAY['lower_back'], ARRAY['barbell'], 'barbell', true, 'brzycki', 'compound', 'hinge'),
('dumbbell-romanian-deadlift', 'Dumbbell Romanian Deadlift', ARRAY['DB RDL', 'Dumbbell RDL'], ARRAY['hamstrings', 'glutes'], ARRAY['lower_back'], ARRAY['dumbbell'], 'dumbbell', true, 'brzycki', 'compound', 'hinge'),

-- SHOULDERS (Compound)
('overhead-press', 'Overhead Press', ARRAY['OHP', 'Military Press', 'Shoulder Press', 'Barbell Shoulder Press'], ARRAY['anterior_deltoid'], ARRAY['triceps', 'lateral_deltoid'], ARRAY['barbell'], 'barbell', true, 'brzycki', 'compound', 'push'),
('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', ARRAY['DB Shoulder Press', 'Seated DB Press', 'Arnold Press'], ARRAY['anterior_deltoid'], ARRAY['triceps', 'lateral_deltoid'], ARRAY['dumbbell'], 'dumbbell', true, 'brzycki', 'compound', 'push'),
('machine-shoulder-press', 'Machine Shoulder Press', ARRAY['Shoulder Press Machine'], ARRAY['anterior_deltoid'], ARRAY['triceps', 'lateral_deltoid'], ARRAY['machine'], 'machine', true, 'brzycki', 'compound', 'push'),

-- SHOULDERS (Isolation)
('dumbbell-lateral-raise', 'Dumbbell Lateral Raise', ARRAY['Lateral Raise', 'Side Raise', 'DB Lateral Raise'], ARRAY['lateral_deltoid'], ARRAY['traps'], ARRAY['dumbbell'], 'dumbbell', false, NULL, 'isolation', 'push'),
('cable-lateral-raise', 'Cable Lateral Raise', ARRAY['Cable Side Raise'], ARRAY['lateral_deltoid'], ARRAY['traps'], ARRAY['cable'], 'cable', false, NULL, 'isolation', 'push'),
('rear-delt-fly', 'Rear Delt Fly', ARRAY['Reverse Fly', 'Rear Delt Raise', 'Bent Over Lateral Raise'], ARRAY['posterior_deltoid'], ARRAY['rhomboids', 'traps'], ARRAY['dumbbell'], 'dumbbell', false, NULL, 'isolation', 'pull'),
('face-pull', 'Face Pull', ARRAY['Cable Face Pull', 'Rope Face Pull'], ARRAY['posterior_deltoid'], ARRAY['rhomboids', 'traps', 'lateral_deltoid'], ARRAY['cable'], 'cable', false, NULL, 'isolation', 'pull'),

-- ARMS - Biceps
('barbell-curl', 'Barbell Curl', ARRAY['BB Curl', 'Standing Barbell Curl'], ARRAY['biceps'], ARRAY['forearms'], ARRAY['barbell'], 'barbell', false, NULL, 'isolation', 'pull'),
('dumbbell-curl', 'Dumbbell Curl', ARRAY['DB Curl', 'Bicep Curl'], ARRAY['biceps'], ARRAY['forearms'], ARRAY['dumbbell'], 'dumbbell', false, NULL, 'isolation', 'pull'),
('hammer-curl', 'Hammer Curl', ARRAY['DB Hammer Curl', 'Neutral Grip Curl'], ARRAY['biceps'], ARRAY['forearms'], ARRAY['dumbbell'], 'dumbbell', false, NULL, 'isolation', 'pull'),
('preacher-curl', 'Preacher Curl', ARRAY['Scott Curl', 'EZ Bar Preacher Curl'], ARRAY['biceps'], ARRAY[]::TEXT[], ARRAY['barbell', 'bench'], 'barbell', false, NULL, 'isolation', 'pull'),
('cable-curl', 'Cable Curl', ARRAY['Cable Bicep Curl'], ARRAY['biceps'], ARRAY['forearms'], ARRAY['cable'], 'cable', false, NULL, 'isolation', 'pull'),

-- ARMS - Triceps
('tricep-pushdown', 'Tricep Pushdown', ARRAY['Cable Pushdown', 'Rope Pushdown', 'Tricep Pressdown'], ARRAY['triceps'], ARRAY[]::TEXT[], ARRAY['cable'], 'cable', false, NULL, 'isolation', 'push'),
('skull-crusher', 'Skull Crusher', ARRAY['Lying Tricep Extension', 'EZ Bar Skull Crusher'], ARRAY['triceps'], ARRAY[]::TEXT[], ARRAY['barbell', 'bench'], 'barbell', false, NULL, 'isolation', 'push'),
('overhead-tricep-extension', 'Overhead Tricep Extension', ARRAY['Tricep Overhead Extension', 'French Press'], ARRAY['triceps'], ARRAY[]::TEXT[], ARRAY['dumbbell'], 'dumbbell', false, NULL, 'isolation', 'push'),
('dip', 'Dip', ARRAY['Tricep Dip', 'Parallel Bar Dip'], ARRAY['triceps'], ARRAY['chest', 'anterior_deltoid'], ARRAY['dip_station', 'bodyweight'], 'bodyweight', false, NULL, 'compound', 'push'),
('weighted-dip', 'Weighted Dip', ARRAY['Weighted Tricep Dip'], ARRAY['triceps'], ARRAY['chest', 'anterior_deltoid'], ARRAY['dip_station', 'bodyweight'], 'bodyweight', true, 'brzycki', 'compound', 'push'),
('bench-dip', 'Bench Dip', ARRAY['Tricep Bench Dip'], ARRAY['triceps'], ARRAY['anterior_deltoid'], ARRAY['bench', 'bodyweight'], 'bodyweight', false, NULL, 'isolation', 'push'),

-- LEGS - Quadriceps
('barbell-back-squat', 'Barbell Back Squat', ARRAY['Back Squat', 'Squat', 'BB Squat'], ARRAY['quadriceps', 'glutes'], ARRAY['hamstrings', 'core', 'lower_back'], ARRAY['barbell'], 'barbell', true, 'brzycki', 'compound', 'squat'),
('front-squat', 'Front Squat', ARRAY['Barbell Front Squat'], ARRAY['quadriceps'], ARRAY['glutes', 'core'], ARRAY['barbell'], 'barbell', true, 'brzycki', 'compound', 'squat'),
('goblet-squat', 'Goblet Squat', ARRAY['DB Goblet Squat', 'Kettlebell Goblet Squat'], ARRAY['quadriceps', 'glutes'], ARRAY['core'], ARRAY['dumbbell', 'kettlebell'], 'dumbbell', true, 'brzycki', 'compound', 'squat'),
('leg-press', 'Leg Press', ARRAY['Machine Leg Press', '45 Degree Leg Press'], ARRAY['quadriceps', 'glutes'], ARRAY['hamstrings'], ARRAY['machine'], 'machine', true, 'brzycki', 'compound', 'squat'),
('hack-squat', 'Hack Squat', ARRAY['Machine Hack Squat'], ARRAY['quadriceps'], ARRAY['glutes'], ARRAY['machine'], 'machine', true, 'brzycki', 'compound', 'squat'),
('leg-extension', 'Leg Extension', ARRAY['Quad Extension', 'Machine Leg Extension'], ARRAY['quadriceps'], ARRAY[]::TEXT[], ARRAY['machine'], 'machine', false, NULL, 'isolation', 'squat'),
('lunge', 'Lunge', ARRAY['Walking Lunge', 'Forward Lunge'], ARRAY['quadriceps', 'glutes'], ARRAY['hamstrings'], ARRAY['bodyweight'], 'bodyweight', false, NULL, 'compound', 'squat'),
('dumbbell-lunge', 'Dumbbell Lunge', ARRAY['DB Lunge', 'Walking DB Lunge'], ARRAY['quadriceps', 'glutes'], ARRAY['hamstrings'], ARRAY['dumbbell'], 'dumbbell', true, 'brzycki', 'compound', 'squat'),
('bulgarian-split-squat', 'Bulgarian Split Squat', ARRAY['Rear Foot Elevated Split Squat', 'BSS'], ARRAY['quadriceps', 'glutes'], ARRAY['hamstrings'], ARRAY['dumbbell', 'bench'], 'dumbbell', true, 'brzycki', 'compound', 'squat'),

-- LEGS - Hamstrings
('leg-curl', 'Leg Curl', ARRAY['Lying Leg Curl', 'Hamstring Curl', 'Machine Leg Curl'], ARRAY['hamstrings'], ARRAY[]::TEXT[], ARRAY['machine'], 'machine', false, NULL, 'isolation', 'pull'),
('seated-leg-curl', 'Seated Leg Curl', ARRAY['Seated Hamstring Curl'], ARRAY['hamstrings'], ARRAY[]::TEXT[], ARRAY['machine'], 'machine', false, NULL, 'isolation', 'pull'),

-- LEGS - Glutes/Hips
('hip-thrust', 'Hip Thrust', ARRAY['Barbell Hip Thrust', 'Glute Bridge'], ARRAY['glutes'], ARRAY['hamstrings'], ARRAY['barbell', 'bench'], 'barbell', true, 'brzycki', 'compound', 'hinge'),
('cable-kickback', 'Cable Kickback', ARRAY['Glute Kickback', 'Cable Glute Kickback'], ARRAY['glutes'], ARRAY[]::TEXT[], ARRAY['cable'], 'cable', false, NULL, 'isolation', 'hinge'),

-- LEGS - Calves
('standing-calf-raise', 'Standing Calf Raise', ARRAY['Calf Raise', 'Machine Calf Raise'], ARRAY['calves'], ARRAY[]::TEXT[], ARRAY['machine'], 'machine', false, NULL, 'isolation', 'push'),
('seated-calf-raise', 'Seated Calf Raise', ARRAY['Seated Calf Machine'], ARRAY['calves'], ARRAY[]::TEXT[], ARRAY['machine'], 'machine', false, NULL, 'isolation', 'push'),

-- CORE
('plank', 'Plank', ARRAY['Front Plank', 'Forearm Plank'], ARRAY['core', 'abs'], ARRAY['obliques'], ARRAY['bodyweight'], 'bodyweight', false, NULL, 'isolation', 'carry'),
('crunch', 'Crunch', ARRAY['Ab Crunch', 'Abdominal Crunch'], ARRAY['abs'], ARRAY['obliques'], ARRAY['bodyweight'], 'bodyweight', false, NULL, 'isolation', 'pull'),
('cable-crunch', 'Cable Crunch', ARRAY['Kneeling Cable Crunch', 'Rope Crunch'], ARRAY['abs'], ARRAY['obliques'], ARRAY['cable'], 'cable', false, NULL, 'isolation', 'pull'),
('hanging-leg-raise', 'Hanging Leg Raise', ARRAY['Leg Raise', 'Hanging Knee Raise'], ARRAY['abs'], ARRAY['core'], ARRAY['pull_up_bar', 'bodyweight'], 'bodyweight', false, NULL, 'isolation', 'pull'),
('russian-twist', 'Russian Twist', ARRAY['Seated Twist', 'Medicine Ball Twist'], ARRAY['obliques'], ARRAY['abs'], ARRAY['bodyweight', 'medicine_ball'], 'bodyweight', false, NULL, 'isolation', 'rotation')

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    aliases = EXCLUDED.aliases,
    primary_muscles = EXCLUDED.primary_muscles,
    secondary_muscles = EXCLUDED.secondary_muscles,
    equipment = EXCLUDED.equipment,
    default_weight_source = EXCLUDED.default_weight_source,
    supports_1rm = EXCLUDED.supports_1rm,
    one_rm_formula = EXCLUDED.one_rm_formula,
    category = EXCLUDED.category,
    movement_pattern = EXCLUDED.movement_pattern,
    updated_at = NOW();
