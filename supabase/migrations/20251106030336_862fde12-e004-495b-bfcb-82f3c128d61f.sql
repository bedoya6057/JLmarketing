-- Remapear la tabla productos para coincidir con la estructura del Excel
-- Renombrar columnas existentes para match con el Excel

-- Agregar columna microcategoria que estaba faltando
ALTER TABLE productos ADD COLUMN IF NOT EXISTS microcategoria TEXT;

-- La estructura actual tiene:
-- macrocategoria -> debería ser "MACROCATEGORIA" del Excel (ej: CARNES Y PESCADOS)
-- categoria -> debería ser "Microcategoria" del Excel (ej: CARNES ROJAS CERDO)
-- division -> debería ser "División" del Excel (ej: FRESCOS)
-- Falta un campo para "Categoría" del Excel (ej: CARNES)

-- Creamos una nueva columna para categoria_general que es la "Categoría" del Excel
ALTER TABLE productos ADD COLUMN IF NOT EXISTS categoria_general TEXT;

-- Comentario explicativo del mapeo correcto:
-- EXCEL                     -> TABLA productos
-- ----------------------------------------
-- MACROCATEGORIA           -> macrocategoria (ej: CARNES Y PESCADOS, BEBIDAS ALCOHÓLICAS)
-- Microcategoria           -> microcategoria (ej: CARNES ROJAS CERDO, PISCO, WHISKY)
-- División                 -> division (ej: FRESCOS, ABARROTES)
-- Categoría                -> categoria (ej: CARNES, BEBIDAS, FIAMBRES Y QUESOS)

COMMENT ON COLUMN productos.macrocategoria IS 'MACROCATEGORIA del Excel - Nivel 1 de clasificación (ej: CARNES Y PESCADOS, BEBIDAS ALCOHÓLICAS)';
COMMENT ON COLUMN productos.microcategoria IS 'Microcategoria del Excel - Nivel 2 de clasificación (ej: CARNES ROJAS CERDO, PISCO, WHISKY)';
COMMENT ON COLUMN productos.division IS 'División del Excel - Tipo de producto (ej: FRESCOS, ABARROTES)';
COMMENT ON COLUMN productos.categoria IS 'Categoría del Excel - Nivel 3 de clasificación (ej: CARNES, BEBIDAS, FIAMBRES Y QUESOS)';
