-- Crear tabla de progreso para encuestadores de exhibición
CREATE TABLE public.progreso_encuestador_exhibicion (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  exhibicion_id uuid NOT NULL,
  tienda text,
  supervisor text,
  acompaniamiento_encargado boolean DEFAULT false,
  foto_ingreso_url text,
  current_index integer DEFAULT 0,
  has_started boolean DEFAULT false,
  selected_macrocategoria text DEFAULT 'todas',
  selected_microcategoria text DEFAULT 'todas',
  responded_product_ids text[] DEFAULT '{}',
  skipped_product_ids text[] DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.progreso_encuestador_exhibicion ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own progress" ON public.progreso_encuestador_exhibicion
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" ON public.progreso_encuestador_exhibicion
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON public.progreso_encuestador_exhibicion
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress" ON public.progreso_encuestador_exhibicion
  FOR DELETE USING (auth.uid() = user_id);