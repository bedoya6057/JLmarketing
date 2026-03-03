
-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create respuestas" ON public.respuestas;

-- Create a more permissive INSERT policy that allows:
-- 1. Authenticated users to insert their own records (created_by = auth.uid())
-- 2. Authenticated users to insert records with NULL created_by (for offline sync)
-- 3. Authenticated users to insert records where they are the creator
CREATE POLICY "Users can create respuestas" 
ON public.respuestas 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (created_by IS NULL OR created_by = auth.uid())
);
