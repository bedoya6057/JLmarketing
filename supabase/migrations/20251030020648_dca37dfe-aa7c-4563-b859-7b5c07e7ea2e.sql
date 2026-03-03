-- Add cartel_presenta_precio column to respuestas table
ALTER TABLE respuestas ADD COLUMN cartel_presenta_precio boolean DEFAULT false;