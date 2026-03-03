-- Robust comparison: cast both sides to text to avoid uuid/text operator issues

BEGIN;

-- ENCARTE
DROP POLICY IF EXISTS "View encartes by role" ON public.encartes;

CREATE POLICY "View encartes by role"
ON public.encartes
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    (has_role(auth.uid(), 'encuestador'::public.app_role) OR has_role(auth.uid(), 'auditor'::public.app_role))
    AND (
      auth.uid()::text = created_by::text
      OR auth.uid()::text = encargado_1::text
      OR auth.uid()::text = encargado_2::text
    )
    AND (
      estado IS NULL OR estado NOT IN ('completado', 'concluido')
    )
  )
);

-- EXHIBICIONES
DROP POLICY IF EXISTS "Admins can view all exhibiciones" ON public.exhibiciones;
DROP POLICY IF EXISTS "Encuestadores can view all exhibiciones" ON public.exhibiciones;
DROP POLICY IF EXISTS "Auditors can view assigned exhibiciones" ON public.exhibiciones;
DROP POLICY IF EXISTS "View exhibiciones by role" ON public.exhibiciones;

CREATE POLICY "View exhibiciones by role"
ON public.exhibiciones
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    (has_role(auth.uid(), 'encuestador'::public.app_role) OR has_role(auth.uid(), 'auditor'::public.app_role))
    AND (
      auth.uid()::text = created_by::text
      OR auth.uid()::text = encargado_1::text
      OR auth.uid()::text = encargado_2::text
    )
    AND (
      estado IS NULL OR estado NOT IN ('completado', 'concluido')
    )
  )
);

COMMIT;