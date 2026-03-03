-- Create exhibiciones table (similar to encartes)
CREATE TABLE public.exhibiciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  tienda TEXT,
  ciudad TEXT,
  bandera TEXT,
  cadena TEXT,
  fecha DATE NOT NULL,
  mes TEXT,
  mes_cod INTEGER,
  estado TEXT DEFAULT 'en_progreso',
  created_by UUID,
  encargado_1 UUID,
  encargado_2 TEXT,
  foto_registro TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on exhibiciones
ALTER TABLE public.exhibiciones ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exhibiciones
CREATE POLICY "Admins can view all exhibiciones" 
ON public.exhibiciones 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'
));

CREATE POLICY "Auditors can view assigned exhibiciones" 
ON public.exhibiciones 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'auditor'
) AND (auth.uid() = created_by OR auth.uid() = encargado_1));

CREATE POLICY "Encuestadores can view all exhibiciones" 
ON public.exhibiciones 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'encuestador'
));

CREATE POLICY "Users can create exhibiciones" 
ON public.exhibiciones 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own exhibiciones" 
ON public.exhibiciones 
FOR UPDATE 
USING (auth.uid() = created_by OR auth.uid() = encargado_1);

CREATE POLICY "Users can delete own exhibiciones" 
ON public.exhibiciones 
FOR DELETE 
USING (auth.uid() = created_by);

-- Create productos_exhibicion table
CREATE TABLE public.productos_exhibicion (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exhibicion_id UUID REFERENCES public.exhibiciones(id) ON DELETE CASCADE,
  cod_producto TEXT,
  descripcion_producto TEXT NOT NULL,
  seccion TEXT,
  linea TEXT,
  tipo_exhibicion TEXT,
  codigo_exhibicion TEXT,
  estado_producto TEXT,
  vigencia TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on productos_exhibicion
ALTER TABLE public.productos_exhibicion ENABLE ROW LEVEL SECURITY;

-- RLS Policies for productos_exhibicion
CREATE POLICY "Owners can view their productos_exhibicion" 
ON public.productos_exhibicion 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM exhibiciones e 
  WHERE e.id = productos_exhibicion.exhibicion_id 
  AND (e.created_by = auth.uid() OR e.encargado_1 = auth.uid())
));

CREATE POLICY "Encuestadores can view all productos_exhibicion" 
ON public.productos_exhibicion 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'encuestador'
));

CREATE POLICY "Users can create productos_exhibicion" 
ON public.productos_exhibicion 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM exhibiciones e 
  WHERE e.id = productos_exhibicion.exhibicion_id 
  AND e.created_by = auth.uid()
));

CREATE POLICY "Users can delete productos_exhibicion of their exhibiciones" 
ON public.productos_exhibicion 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM exhibiciones e 
  WHERE e.id = productos_exhibicion.exhibicion_id 
  AND e.created_by = auth.uid()
));

-- Create respuestas_exhibicion table
CREATE TABLE public.respuestas_exhibicion (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exhibicion_id UUID REFERENCES public.exhibiciones(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos_exhibicion(id) ON DELETE CASCADE,
  created_by UUID,
  fecha DATE,
  tienda TEXT,
  ciudad TEXT,
  bandera TEXT,
  seccion TEXT,
  linea TEXT,
  cod_producto TEXT,
  descripcion_producto TEXT,
  tipo_exhibicion TEXT,
  codigo_exhibicion TEXT,
  presencia_exhibicion BOOLEAN,
  ubicacion TEXT,
  observaciones TEXT,
  foto TEXT,
  foto_registro TEXT,
  encargado TEXT,
  encargado_2 TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on respuestas_exhibicion
ALTER TABLE public.respuestas_exhibicion ENABLE ROW LEVEL SECURITY;

-- RLS Policies for respuestas_exhibicion
CREATE POLICY "Users can view respuestas_exhibicion of their exhibiciones" 
ON public.respuestas_exhibicion 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM exhibiciones e 
  WHERE e.id = respuestas_exhibicion.exhibicion_id 
  AND (e.created_by = auth.uid() OR e.encargado_1 = auth.uid())
));

CREATE POLICY "Users can create respuestas_exhibicion" 
ON public.respuestas_exhibicion 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own respuestas_exhibicion" 
ON public.respuestas_exhibicion 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete respuestas_exhibicion of their exhibiciones" 
ON public.respuestas_exhibicion 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM exhibiciones e 
  WHERE e.id = respuestas_exhibicion.exhibicion_id 
  AND e.created_by = auth.uid()
));

-- Trigger for updated_at on exhibiciones
CREATE TRIGGER update_exhibiciones_updated_at
BEFORE UPDATE ON public.exhibiciones
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();