-- Backend-only schema: never add civicmerge to Supabase's exposed schemas.
-- Applied inside one transaction by db:migrate (no destructive reset).
CREATE SCHEMA IF NOT EXISTS civicmerge;
REVOKE ALL ON SCHEMA civicmerge FROM PUBLIC;

CREATE FUNCTION civicmerge.valid_features(tags text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM unnest(tags) AS tag
    WHERE tag IS NULL OR tag !~ '^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$'
  );
$$;

CREATE TABLE civicmerge.incidents (
  id uuid PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('pothole', 'trash', 'flood')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  description text NOT NULL CHECK (length(description) > 0),
  features text[] NOT NULL CHECK (civicmerge.valid_features(features)),
  latitude double precision,
  longitude double precision,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  assigned_team text NOT NULL,
  report_count integer NOT NULL CHECK (report_count > 0),
  cover_image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((latitude IS NULL AND longitude IS NULL) OR
    (latitude IS NOT NULL AND longitude IS NOT NULL AND
     latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);

CREATE TABLE civicmerge.reports (
  id uuid PRIMARY KEY,
  incident_id uuid REFERENCES civicmerge.incidents(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  type text NOT NULL CHECK (type IN ('pothole', 'trash', 'flood')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  description text NOT NULL CHECK (length(description) > 0),
  features text[] NOT NULL CHECK (civicmerge.valid_features(features)),
  latitude double precision,
  longitude double precision,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (id, incident_id),
  CHECK ((status = 'pending' AND incident_id IS NULL) OR
         (status = 'confirmed' AND incident_id IS NOT NULL)),
  CHECK ((latitude IS NULL AND longitude IS NULL) OR
    (latitude IS NOT NULL AND longitude IS NOT NULL AND
     latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);

CREATE TABLE civicmerge.history (
  report_id uuid PRIMARY KEY,
  incident_id uuid NOT NULL REFERENCES civicmerge.incidents(id) ON DELETE RESTRICT,
  event text NOT NULL CHECK (event IN ('created', 'report_merged')),
  at timestamptz NOT NULL,
  FOREIGN KEY (report_id, incident_id) REFERENCES civicmerge.reports(id, incident_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX one_created_event_per_incident ON civicmerge.history(incident_id) WHERE event = 'created';

CREATE TABLE civicmerge.confirmations (
  report_id uuid PRIMARY KEY,
  incident_id uuid NOT NULL REFERENCES civicmerge.incidents(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('create', 'merge')),
  target_incident_id uuid REFERENCES civicmerge.incidents(id) ON DELETE RESTRICT,
  response jsonb NOT NULL,
  confirmed_at timestamptz NOT NULL,
  FOREIGN KEY (report_id, incident_id) REFERENCES civicmerge.reports(id, incident_id) ON DELETE RESTRICT,
  CHECK ((action = 'create' AND target_incident_id IS NULL) OR
         (action = 'merge' AND target_incident_id IS NOT NULL AND target_incident_id = incident_id)),
  CHECK ((jsonb_typeof(response) = 'object' AND
    response ?& ARRAY['incidentId', 'action', 'reportCount', 'assignedTeam'] AND
    response->>'incidentId' = incident_id::text AND
    response->>'action' = CASE action WHEN 'create' THEN 'created' ELSE 'merged' END AND
    jsonb_typeof(response->'reportCount') = 'number' AND
    (response->>'reportCount')::numeric >= 1 AND
    (response->>'reportCount')::numeric = trunc((response->>'reportCount')::numeric) AND
    jsonb_typeof(response->'assignedTeam') = 'string') IS TRUE)
);

CREATE INDEX reports_by_incident ON civicmerge.reports(incident_id, created_at, id);
CREATE INDEX history_by_incident ON civicmerge.history(incident_id, at, report_id);
CREATE INDEX incidents_by_created ON civicmerge.incidents(created_at DESC, id DESC);

-- No browser/anon/authenticated policies: only a trusted backend DB role.
ALTER TABLE civicmerge.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE civicmerge.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE civicmerge.history ENABLE ROW LEVEL SECURITY;
ALTER TABLE civicmerge.confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA civicmerge FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA civicmerge FROM PUBLIC;
