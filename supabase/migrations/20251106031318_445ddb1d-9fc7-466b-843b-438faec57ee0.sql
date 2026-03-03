-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for saving encuestador progress
CREATE TABLE public.progreso_encuestador (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  encarte_id UUID NOT NULL,
  tienda TEXT,
  distrito TEXT,
  supervisor TEXT,
  acompaniamiento_encargado BOOLEAN DEFAULT false,
  foto_ingreso_url TEXT,
  current_index INTEGER DEFAULT 0,
  selected_macrocategoria TEXT DEFAULT 'todas',
  selected_microcategoria TEXT DEFAULT 'todas',
  has_started BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, encarte_id)
);

-- Enable RLS
ALTER TABLE public.progreso_encuestador ENABLE ROW LEVEL SECURITY;

-- Users can view their own progress
CREATE POLICY "Users can view own progress"
ON public.progreso_encuestador
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert own progress"
ON public.progreso_encuestador
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own progress"
ON public.progreso_encuestador
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own progress
CREATE POLICY "Users can delete own progress"
ON public.progreso_encuestador
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_progreso_encuestador_updated_at
BEFORE UPDATE ON public.progreso_encuestador
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();