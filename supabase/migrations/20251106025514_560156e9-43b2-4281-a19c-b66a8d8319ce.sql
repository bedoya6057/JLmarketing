-- Allow admins to view all respuestas (encarte)
CREATE POLICY "Admins can view all respuestas"
ON public.respuestas
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all respuestas_exhibicion
CREATE POLICY "Admins can view all respuestas_exhibicion"
ON public.respuestas_exhibicion
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));