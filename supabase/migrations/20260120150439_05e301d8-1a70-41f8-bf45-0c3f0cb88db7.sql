-- Fix RLS: Encuestadores/Auditores should see ALL active studies (not concluded/completed)
-- regardless of assignment, just like before.

BEGIN;

-- ENCARTE: Drop restrictive policy, create permissive one
DROP POLICY IF EXISTS "View encartes by role" ON public.encartes;

CREATE POLICY "View encartes by role"
ON public.encartes
FOR SELECT
TO public
USING (
  -- Admins see everything
  has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    -- Encuestadores and Auditores see all active studies
    (has_role(auth.uid(), 'encuestador'::public.app_role) OR has_role(auth.uid(), 'auditor'::public.app_role))
    AND (estado IS NULL OR estado NOT IN ('completado', 'concluido'))
  )
);

-- EXHIBICIONES: Drop restrictive policy, create permissive one
DROP POLICY IF EXISTS "View exhibiciones by role" ON public.exhibiciones;

CREATE POLICY "View exhibiciones by role"
ON public.exhibiciones
FOR SELECT
TO public
USING (
  -- Admins see everything
  has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    -- Encuestadores and Auditores see all active studies
    (has_role(auth.uid(), 'encuestador'::public.app_role) OR has_role(auth.uid(), 'auditor'::public.app_role))
    AND (estado IS NULL OR estado NOT IN ('completado', 'concluido'))
  )
);

COMMIT;