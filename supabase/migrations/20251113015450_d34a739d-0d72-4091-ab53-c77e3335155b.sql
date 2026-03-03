-- Fix encartes SELECT visibility: unify into a single permissive policy
-- Drop old restrictive SELECT policies
DROP POLICY IF EXISTS "Admins can view all encartes" ON public.encartes;
DROP POLICY IF EXISTS "Encuestadores can view all encartes" ON public.encartes;
DROP POLICY IF EXISTS "Auditors can view assigned encartes" ON public.encartes;

-- Create a single SELECT policy that grants access by role
CREATE POLICY "View encartes by role"
ON public.encartes
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'encuestador'::app_role)
  OR (
    has_role(auth.uid(), 'auditor'::app_role)
    AND (
      auth.uid() = created_by
      OR auth.uid() = encargado_1
      OR auth.uid() = encargado_2
    )
  )
);