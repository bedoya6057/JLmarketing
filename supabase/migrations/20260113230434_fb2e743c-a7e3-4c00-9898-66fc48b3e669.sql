-- EMERGENCY, TEMPORARY RESCUE POLICY
-- Allows inserting respuestas for ONE specific encarte even if the request is not authenticated.
-- This is ONLY to recover Alice's offline data from V.21 and should be removed once sync completes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'respuestas'
      AND policyname = 'TEMP rescue insert MakroEnero1'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "TEMP rescue insert MakroEnero1"
      ON public.respuestas
      FOR INSERT
      WITH CHECK (
        encarte_id = 'c6187c85-7c72-4b95-a553-51dd4e622521'
      )
    $sql$;
  END IF;
END $$;

ALTER TABLE public.respuestas ENABLE ROW LEVEL SECURITY;