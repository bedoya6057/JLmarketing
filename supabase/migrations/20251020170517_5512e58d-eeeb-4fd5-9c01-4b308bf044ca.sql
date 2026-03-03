-- Add encuestador role to the system
-- First, let's ensure the role column can accept 'encuestador' value
-- Since we're using text type, we just need to document that 'encuestador' is a valid role

-- Update the check constraint if it exists, or add a comment documenting valid roles
COMMENT ON COLUMN profiles.role IS 'Valid roles: admin, auditor, encuestador';

-- Create edge function to create test user
-- This will be handled separately through edge function creation