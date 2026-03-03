-- Remove temporary rescue RLS policies from respuestas table
-- These were added for backward compatibility with V.21 APKs during sync issues

DROP POLICY IF EXISTS "TEMP rescue insert MakroEnero1" ON public.respuestas;
DROP POLICY IF EXISTS "TEMP rescue update MakroEnero1" ON public.respuestas;

-- Also remove the policy for null created_by if it's no longer needed
-- (keeping it for now as it may help with legacy data)
-- DROP POLICY IF EXISTS "Users can update respuestas with null created_by" ON public.respuestas;