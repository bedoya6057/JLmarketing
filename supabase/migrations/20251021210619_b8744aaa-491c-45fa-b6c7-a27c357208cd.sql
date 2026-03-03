-- Agregar columna tienda a productos_exhibicion
ALTER TABLE public.productos_exhibicion 
ADD COLUMN IF NOT EXISTS tienda text;