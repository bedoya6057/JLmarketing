-- Agregar nuevas columnas a productos_exhibicion
ALTER TABLE public.productos_exhibicion 
ADD COLUMN IF NOT EXISTS macrocategoria text,
ADD COLUMN IF NOT EXISTS microcategoria text,
ADD COLUMN IF NOT EXISTS marca text,
ADD COLUMN IF NOT EXISTS suma_tiendas text;