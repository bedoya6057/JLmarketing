-- Add new columns to respuestas table for complete encarte tracking
ALTER TABLE public.respuestas
ADD COLUMN IF NOT EXISTS año integer,
ADD COLUMN IF NOT EXISTS mes_cod integer,
ADD COLUMN IF NOT EXISTS mes text,
ADD COLUMN IF NOT EXISTS fecha date,
ADD COLUMN IF NOT EXISTS encarte text,
ADD COLUMN IF NOT EXISTS encargado uuid,
ADD COLUMN IF NOT EXISTS encargado_2 uuid,
ADD COLUMN IF NOT EXISTS ciudad_cadena text,
ADD COLUMN IF NOT EXISTS ciudad text,
ADD COLUMN IF NOT EXISTS bandera text,
ADD COLUMN IF NOT EXISTS tienda text,
ADD COLUMN IF NOT EXISTS macrocategoria text,
ADD COLUMN IF NOT EXISTS categoria text,
ADD COLUMN IF NOT EXISTS cod_interno text,
ADD COLUMN IF NOT EXISTS producto text,
ADD COLUMN IF NOT EXISTS precio_encarte numeric,
ADD COLUMN IF NOT EXISTS foto_registro text;