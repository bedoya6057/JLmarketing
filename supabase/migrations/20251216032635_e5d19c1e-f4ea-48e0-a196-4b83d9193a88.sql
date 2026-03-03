-- Permitir a admins actualizar cualquier respuesta (encarte)
CREATE POLICY "Admins can update any respuestas"
ON public.respuestas
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Permitir a admins actualizar cualquier respuesta_exhibicion
CREATE POLICY "Admins can update any respuestas_exhibicion"
ON public.respuestas_exhibicion
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));