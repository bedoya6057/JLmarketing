-- Allow admins to view all progress records for tracking

-- Policy for progreso_encuestador
CREATE POLICY "Admins can view all progreso_encuestador"
ON public.progreso_encuestador
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
    AND user_roles.is_active = true
  )
);

-- Policy for progreso_encuestador_exhibicion  
CREATE POLICY "Admins can view all progreso_encuestador_exhibicion"
ON public.progreso_encuestador_exhibicion
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
    AND user_roles.is_active = true
  )
);