-- EMERGENCY, TEMPORARY RESCUE POLICIES
-- Allow V.21 clients to upsert respuestas for ONE specific encarte even if unauthenticated.
-- REMOVE once recovery confirmed.

DO $$
BEGIN
  -- INSERT policy (already may exist)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='respuestas' AND policyname='TEMP rescue insert MakroEnero1'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "TEMP rescue insert MakroEnero1"
      ON public.respuestas
      FOR INSERT
      WITH CHECK (encarte_id = 'c6187c85-7c72-4b95-a553-51dd4e622521')
    $sql$;
  END IF;

  -- UPDATE policy (needed for UPSERT ON CONFLICT DO UPDATE)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='respuestas' AND policyname='TEMP rescue update MakroEnero1'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "TEMP rescue update MakroEnero1"
      ON public.respuestas
      FOR UPDATE
      USING (encarte_id = 'c6187c85-7c72-4b95-a553-51dd4e622521')
      WITH CHECK (encarte_id = 'c6187c85-7c72-4b95-a553-51dd4e622521')
    $sql$;
  END IF;
END $$;

ALTER TABLE public.respuestas ENABLE ROW LEVEL SECURITY;