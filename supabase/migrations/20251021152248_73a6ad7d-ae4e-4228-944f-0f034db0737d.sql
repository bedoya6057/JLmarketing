-- Add supervisor column to respuestas table
ALTER TABLE public.respuestas 
ADD COLUMN IF NOT EXISTS supervisor text;