-- Agregar constraint único para prevenir duplicados
-- Primero eliminar duplicados manteniendo solo el más antiguo

-- Eliminar duplicados de respuestas_exhibicion (mantener el más antiguo)
DELETE FROM respuestas_exhibicion
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY exhibicion_id, producto_id, tienda, created_by, fecha
             ORDER BY created_at ASC
           ) as rn
    FROM respuestas_exhibicion
  ) t
  WHERE t.rn > 1
);

-- Crear índice único para prevenir duplicados futuros
CREATE UNIQUE INDEX IF NOT EXISTS idx_respuestas_exhibicion_unique 
ON respuestas_exhibicion (exhibicion_id, producto_id, tienda, created_by, fecha);

-- Lo mismo para respuestas (encartes)
DELETE FROM respuestas
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY encarte_id, producto_id, tienda, created_by, fecha
             ORDER BY created_at ASC
           ) as rn
    FROM respuestas
  ) t
  WHERE t.rn > 1
);

-- Crear índice único para respuestas
CREATE UNIQUE INDEX IF NOT EXISTS idx_respuestas_unique 
ON respuestas (encarte_id, producto_id, tienda, created_by, fecha);