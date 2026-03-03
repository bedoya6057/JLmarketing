-- Fix legacy/mobile sync: allow repairing rows created without created_by

-- 1) Trigger function to always stamp created_by with the authenticated user
CREATE OR REPLACE FUNCTION public.set_respuestas_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set when we have an authenticated user in request context
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Attach trigger to respuestas
DROP TRIGGER IF EXISTS trg_set_respuestas_created_by ON public.respuestas;
CREATE TRIGGER trg_set_respuestas_created_by
BEFORE INSERT OR UPDATE ON public.respuestas
FOR EACH ROW
EXECUTE FUNCTION public.set_respuestas_created_by();

-- 3) Legacy rescue policy: allow updating rows that were created with NULL created_by
CREATE POLICY "Users can update respuestas with null created_by"
ON public.respuestas
FOR UPDATE
USING (created_by IS NULL);

-- Ensure RLS remains enabled
ALTER TABLE public.respuestas ENABLE ROW LEVEL SECURITY;