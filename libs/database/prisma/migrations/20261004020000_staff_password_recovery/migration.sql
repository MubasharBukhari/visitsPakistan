ALTER TABLE staff_account ADD COLUMN recovery_requested_at timestamptz(6);
CREATE TABLE staff_password_reset (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token_hash text NOT NULL UNIQUE,
 staff_id uuid NOT NULL REFERENCES staff_account(id) ON DELETE RESTRICT,
 password_version text NOT NULL,
 encrypted_token text,
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 expires_at timestamptz(6) NOT NULL,
 used_at timestamptz(6),
 delivered_at timestamptz(6),
 next_attempt_at timestamptz(6) NOT NULL DEFAULT now(),
 delivery_attempts integer NOT NULL DEFAULT 0
);
CREATE INDEX staff_password_reset_staff_id_created_at_idx ON staff_password_reset(staff_id, created_at);
CREATE INDEX staff_password_reset_next_attempt_at_expires_at_idx ON staff_password_reset(next_attempt_at, expires_at);
