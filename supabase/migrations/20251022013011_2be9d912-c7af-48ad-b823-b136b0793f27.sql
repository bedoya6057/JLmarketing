-- Agregar campo motivo_no_exhibicion a respuestas_exhibicion
ALTER TABLE respuestas_exhibicion 
ADD COLUMN motivo_no_exhibicion text;