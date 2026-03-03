-- =====================================================
-- OPTIMIZACIÓN PARA CONCURRENCIA MULTI-USUARIO
-- Índices estratégicos para mejorar performance bajo carga
-- =====================================================

-- Índice compuesto para búsquedas de respuestas por encarte y usuario
-- Usado en loadRespondedProducts (crítico para cada usuario)
CREATE INDEX IF NOT EXISTS idx_respuestas_encarte_user 
ON respuestas(encarte_id, created_by);

-- Índice para ordenamiento rápido de respuestas por fecha
CREATE INDEX IF NOT EXISTS idx_respuestas_created_at 
ON respuestas(created_at DESC);

-- Índice compuesto para progreso de encuestador
-- Usado en checkSavedProgress (cada vez que un usuario retoma)
CREATE INDEX IF NOT EXISTS idx_progreso_user_encarte 
ON progreso_encuestador(user_id, encarte_id);

-- Índice para búsquedas de productos por encarte
-- Usado en loadProductos (crítico, puede ser muchos productos)
CREATE INDEX IF NOT EXISTS idx_productos_encarte 
ON productos(encarte_id);

-- Índice para ordenamiento de encartes
CREATE INDEX IF NOT EXISTS idx_encartes_created_at 
ON encartes(created_at DESC);

-- Índice para estado de encartes (filtrar completados vs en progreso)
CREATE INDEX IF NOT EXISTS idx_encartes_estado 
ON encartes(estado);

-- Índice compuesto para búsquedas de tiendas por bandera
-- Usado en loadTiendas
CREATE INDEX IF NOT EXISTS idx_tiendas_bandera_tienda 
ON tiendas(bandera, tienda);

-- Índice para exhibiciones por fecha
CREATE INDEX IF NOT EXISTS idx_exhibiciones_created_at 
ON exhibiciones(created_at DESC);

-- Índice para respuestas de exhibición por exhibicion_id
CREATE INDEX IF NOT EXISTS idx_respuestas_exhibicion_exhibicion 
ON respuestas_exhibicion(exhibicion_id);

-- Índice para productos de exhibición por exhibicion_id
CREATE INDEX IF NOT EXISTS idx_productos_exhibicion_exhibicion 
ON productos_exhibicion(exhibicion_id);

-- Índice para event_logs por usuario y timestamp
CREATE INDEX IF NOT EXISTS idx_event_logs_user_timestamp 
ON event_logs(user_id, timestamp DESC);

-- =====================================================
-- OPTIMIZACIÓN DE POLÍTICAS RLS
-- Agregar índices para mejorar performance de políticas
-- =====================================================

-- Índice para joins frecuentes en políticas RLS
CREATE INDEX IF NOT EXISTS idx_encartes_created_by 
ON encartes(created_by);

CREATE INDEX IF NOT EXISTS idx_encartes_encargado_1 
ON encartes(encargado_1);

CREATE INDEX IF NOT EXISTS idx_encartes_encargado_2 
ON encartes(encargado_2);

CREATE INDEX IF NOT EXISTS idx_exhibiciones_created_by 
ON exhibiciones(created_by);

CREATE INDEX IF NOT EXISTS idx_exhibiciones_encargado_1 
ON exhibiciones(encargado_1);

-- Índice para user_roles (usado en has_role function)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
ON user_roles(user_id, role);

-- =====================================================
-- ESTADÍSTICAS Y ANÁLISIS
-- Actualizar estadísticas de las tablas para mejor query planning
-- =====================================================

ANALYZE respuestas;
ANALYZE productos;
ANALYZE encartes;
ANALYZE progreso_encuestador;
ANALYZE tiendas;
ANALYZE exhibiciones;
ANALYZE respuestas_exhibicion;
ANALYZE productos_exhibicion;