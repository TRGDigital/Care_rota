-- Specialist/champion roles a staff member holds (multi-select), mirroring CareStream's
-- SECONDARY_ROLES. Zero or more per person; drives the rota champion tags.
ALTER TABLE staff ADD COLUMN specialisms text[] NOT NULL DEFAULT '{}';
