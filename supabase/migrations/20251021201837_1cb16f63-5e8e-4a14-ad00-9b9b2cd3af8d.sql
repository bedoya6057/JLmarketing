-- Change encargado_2 from UUID to TEXT to store "Sí" or "No"
ALTER TABLE public.respuestas 
ALTER COLUMN encargado_2 TYPE text USING encargado_2::text;