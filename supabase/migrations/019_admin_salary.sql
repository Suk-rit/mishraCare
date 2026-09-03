-- ============================================================
-- JanSwasthya — Add salary field to admins table
-- ============================================================
-- The admins table was created without a salary column.
-- This migration adds it alongside salary_type for consistency
-- with store_managers, employees, and admin_team.

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS salary      numeric(10,2) NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_type varchar(20)   NULL DEFAULT 'monthly';
