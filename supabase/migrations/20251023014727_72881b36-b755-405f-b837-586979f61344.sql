-- Cambiar el tipo de columna presencia_exhibicion de boolean a text
ALTER TABLE respuestas_exhibicion 
ALTER COLUMN presencia_exhibicion TYPE text USING 
  CASE 
    WHEN presencia_exhibicion = true THEN 'SI SE ARMO'
    WHEN presencia_exhibicion = false THEN 'NO SE ARMO'
    ELSE NULL
  END;

-- Eliminar la columna motivo_no_exhibicion
ALTER TABLE respuestas_exhibicion 
DROP COLUMN motivo_no_exhibicion;