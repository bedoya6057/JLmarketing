-- =====================================================
-- FIX SECURITY WARNING: Function Search Path Mutable
-- Usar CREATE OR REPLACE para actualizar funciones existentes
-- =====================================================

-- Actualizar handle_updated_at con search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;