-- Migration: Add token_version column to users table
-- Created: 2025-09-27
-- Description: Introduces token_version for JWT invalidation on sensitive account changes.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

-- Verification (optional):
-- SELECT token_version FROM users LIMIT 1;
