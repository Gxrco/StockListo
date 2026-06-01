-- Runs once when the PostgreSQL container initializes.
-- Creates the application role and enables required extensions.
-- The app schema is managed by Alembic (alembic upgrade head).

\connect stocklisto

-- Revoke UPDATE/DELETE on kardex from the app role after schema is created.
-- This is enforced at the service layer too; this is a belt-and-suspenders guard.
-- We grant it back after the initial migration so Alembic can seed data.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
