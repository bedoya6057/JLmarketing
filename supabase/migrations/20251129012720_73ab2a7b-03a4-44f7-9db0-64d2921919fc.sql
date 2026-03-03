-- Agregar constraint único para user_id y exhibicion_id
ALTER TABLE public.progreso_encuestador_exhibicion 
ADD CONSTRAINT progreso_encuestador_exhibicion_user_exhibicion_unique 
UNIQUE (user_id, exhibicion_id);