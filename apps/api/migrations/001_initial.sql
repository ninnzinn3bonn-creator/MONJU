CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE gathering_state AS ENUM (
  'NOT_GATHERED',
  'CANDIDATE',
  'GATHERED',
  'LEAVING'
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  auth_provider text NOT NULL,
  provider_user_id text NOT NULL,
  display_name text NOT NULL,
  profile_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_provider, provider_user_id)
);

CREATE TABLE groups (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  leader_user_id uuid NOT NULL REFERENCES users(id),
  required_member_count integer NOT NULL DEFAULT 2 CHECK (required_member_count BETWEEN 2 AND 5),
  gathering_radius_m integer NOT NULL DEFAULT 50 CHECK (gathering_radius_m BETWEEN 10 AND 500),
  gathering_duration_sec integer NOT NULL DEFAULT 60 CHECK (gathering_duration_sec BETWEEN 10 AND 3600),
  candidate_grace_sec integer NOT NULL DEFAULT 5 CHECK (candidate_grace_sec BETWEEN 0 AND 60),
  leaving_duration_sec integer NOT NULL DEFAULT 600 CHECK (leaving_duration_sec BETWEEN 60 AND 86400),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX group_members_user_idx ON group_members(user_id);

CREATE TABLE latest_locations (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m double precision NOT NULL CHECK (accuracy_m >= 0),
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE group_invites (
  id uuid PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX group_invites_group_idx ON group_invites(group_id);

CREATE TABLE gathering_states (
  group_id uuid PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  state gathering_state NOT NULL DEFAULT 'NOT_GATHERED',
  candidate_started_at timestamptz,
  condition_lost_at timestamptz,
  gathered_at timestamptz,
  leaving_started_at timestamptz,
  last_notification_at timestamptz,
  recorder_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recording_started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE device_tokens (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_token)
);

CREATE INDEX device_tokens_token_idx ON device_tokens(device_token);
