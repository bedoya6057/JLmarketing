
-- 1. Reload PostgREST schema cache to recognize unique constraints for upsert
NOTIFY pgrst, 'reload schema';

-- 2. Fix event_logs INSERT policy to allow any authenticated user to insert logs
DROP POLICY IF EXISTS "Users can insert own logs" ON public.event_logs;
CREATE POLICY "Users can insert own logs" 
ON public.event_logs FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);
