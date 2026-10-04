ALTER TABLE staff_password_reset ADD COLUMN failed_attempts integer NOT NULL DEFAULT 0;
