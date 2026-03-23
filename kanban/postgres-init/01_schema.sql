CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#7F77DD',
    wip_limits JSONB NOT NULL DEFAULT '{"backlog":4,"todo":3,"doing":3,"done":0}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    col VARCHAR(20) NOT NULL CHECK (col IN ('backlog', 'todo', 'doing', 'done')),
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(200) DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    due_date DATE,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    assignees TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    comments JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    card_id INTEGER,
    actor VARCHAR(100) NOT NULL DEFAULT 'You',
    action VARCHAR(50) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cards_project ON cards(project_id);
CREATE INDEX IF NOT EXISTS idx_cards_col ON cards(col);
CREATE INDEX IF NOT EXISTS idx_activity_project_created ON activity_log(project_id, created_at DESC);

-- Seed projects
INSERT INTO projects (name, color) VALUES
  ('MathMind',    '#7F77DD'),
  ('MathNinja',   '#1D9E75'),
  ('FORMA',       '#D85A30'),
  ('House Build', '#BA7517');

-- Seed cards
INSERT INTO cards (project_id, col, title, subtitle, position) VALUES
  (1, 'doing',   'Google Classroom OAuth',   'PKCE flow fix',        0),
  (1, 'todo',    'Grade sync endpoint',      'PATCH /grades',        0),
  (1, 'backlog', 'Firestore migration',      'SQLite to Firestore',  0),
  (1, 'done',    'Flask backend rewrite',    'Node.js to Python',    0),
  (2, 'doing',   'Falling bubble game loop', 'Canvas animation',     0),
  (2, 'todo',    'Factor & prime levels',    'Grade 6-8 content',    0),
  (2, 'done',    'Game canvas setup',        'React + Vite',         0),
  (3, 'backlog', 'Plateau detection logic',  'Metabolic analysis',   0),
  (3, 'todo',    'Hevy API integration',     'Workout data sync',    0),
  (3, 'done',    'Meal photo scanner',       'Claude Vision',        0),
  (4, 'done',    'Finalise floor plan',      'Architect sign-off',   0),
  (4, 'done',    'Secure building permits',  'Local authority',      1),
  (4, 'doing',   'Foundation & slab',        'Contractor on site',   0),
  (4, 'doing',   'Structural framing',       'Ground floor walls',   1),
  (4, 'todo',    'Roof structure & tiling',  'Weatherproof week 8',  0),
  (4, 'todo',    'Electrical rough-in',      '1st fix wiring',       1),
  (4, 'todo',    'Plumbing rough-in',        'Pipes & drainage',     2),
  (4, 'backlog', 'Insulation & drywall',     'Interior walls',       0),
  (4, 'backlog', 'Kitchen & bathroom',       'Fixtures & tiling',    1),
  (4, 'backlog', 'Paint & finishing',        'Final interior pass',  2),
  (4, 'backlog', 'Landscaping',              'Garden & driveway',    3);
