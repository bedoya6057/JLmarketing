-- Modificar tabla productos para incluir todas las columnas del archivo Excel
ALTER TABLE public.productos 
ADD COLUMN IF NOT EXISTS nombre_campana TEXT,
ADD COLUMN IF NOT EXISTS tipo_requerimiento TEXT,
ADD COLUMN IF NOT EXISTS pagina TEXT,
ADD COLUMN IF NOT EXISTS numero_cartel TEXT,
ADD COLUMN IF NOT EXISTS descripcion_producto TEXT,
ADD COLUMN IF NOT EXISTS fecha_inicio DATE,
ADD COLUMN IF NOT EXISTS fecha_fin DATE,
ADD COLUMN IF NOT EXISTS mecanica TEXT,
ADD COLUMN IF NOT EXISTS nombre_mecanica TEXT,
ADD COLUMN IF NOT EXISTS precio_regular DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS precio_promo DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS precio_pack DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS uxb TEXT,
ADD COLUMN IF NOT EXISTS bi_tri_precio TEXT,
ADD COLUMN IF NOT EXISTS medio_pago TEXT,
ADD COLUMN IF NOT EXISTS descripcion_mecanica_tarjeta TEXT,
ADD COLUMN IF NOT EXISTS cuotas TEXT,
ADD COLUMN IF NOT EXISTS precio_promo_tarjeta DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS precio_pack_tarjeta DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS exhibicion TEXT,
ADD COLUMN IF NOT EXISTS cabecera TEXT,
ADD COLUMN IF NOT EXISTS cantidad_comprar TEXT,
ADD COLUMN IF NOT EXISTS monto_minimo DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS division TEXT,
ADD COLUMN IF NOT EXISTS atributo TEXT,
ADD COLUMN IF NOT EXISTS estado_producto TEXT,
ADD COLUMN IF NOT EXISTS unidad_medida TEXT,
ADD COLUMN IF NOT EXISTS alto_grasas_saturadas BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS alto_azucar BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS alto_sodio BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS contiene_grasas_trans BOOLEAN DEFAULT FALSE;

-- Renombrar columnas existentes para coincidir con el Excel
ALTER TABLE public.productos 
RENAME COLUMN producto TO descripcion_producto_carteleria;

-- Agregar comentarios para documentar
COMMENT ON COLUMN public.productos.cod_interno IS 'Código de Producto del sistema';
COMMENT ON COLUMN public.productos.descripcion_producto_carteleria IS 'Descripción de producto (Cartelería)';
COMMENT ON COLUMN public.productos.precio_encarte IS 'Precio que aparece en el encarte (puede ser precio_regular o precio_promo)';
