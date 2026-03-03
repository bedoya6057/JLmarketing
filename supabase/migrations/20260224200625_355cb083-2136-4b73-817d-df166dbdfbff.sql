
-- Recrear constraint en progreso_encuestador
ALTER TABLE public.progreso_encuestador DROP CONSTRAINT IF EXISTS progreso_encuestador_user_encarte_tienda_unique;
ALTER TABLE public.progreso_encuestador ADD CONSTRAINT progreso_encuestador_user_encarte_tienda_unique UNIQUE (user_id, encarte_id, tienda);

-- Recrear constraint en progreso_encuestador_exhibicion también
ALTER TABLE public.progreso_encuestador_exhibicion DROP CONSTRAINT IF EXISTS progreso_encuestador_exhibicion_user_exhibicion_tienda_unique;
ALTER TABLE public.progreso_encuestador_exhibicion ADD CONSTRAINT progreso_encuestador_exhibicion_user_exhibicion_tienda_unique UNIQUE (user_id, exhibicion_id, tienda);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
