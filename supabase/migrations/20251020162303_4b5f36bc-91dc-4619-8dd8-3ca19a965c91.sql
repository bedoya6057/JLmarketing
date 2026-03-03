-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'auditor',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create trigger for new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create encartes table (form sessions)
CREATE TABLE public.encartes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  ciudad TEXT,
  cadena TEXT,
  bandera TEXT,
  tienda TEXT,
  encargado_1 UUID REFERENCES public.profiles(id),
  encargado_2 UUID REFERENCES public.profiles(id),
  fecha DATE NOT NULL,
  mes_cod INTEGER,
  mes TEXT,
  foto_registro TEXT, -- URL to initial photo
  estado TEXT DEFAULT 'en_progreso', -- en_progreso, completado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.encartes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own encartes"
  ON public.encartes FOR SELECT
  USING (auth.uid() = created_by OR auth.uid() = encargado_1 OR auth.uid() = encargado_2);

CREATE POLICY "Users can create encartes"
  ON public.encartes FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own encartes"
  ON public.encartes FOR UPDATE
  USING (auth.uid() = created_by OR auth.uid() = encargado_1 OR auth.uid() = encargado_2);

-- Create products table (master product list)
CREATE TABLE public.productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  encarte_id UUID REFERENCES public.encartes(id) ON DELETE CASCADE,
  macrocategoria TEXT,
  categoria TEXT,
  cod_interno TEXT,
  producto TEXT NOT NULL,
  precio_encarte DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view productos of their encartes"
  ON public.productos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.encartes e
      WHERE e.id = productos.encarte_id
      AND (e.created_by = auth.uid() OR e.encargado_1 = auth.uid() OR e.encargado_2 = auth.uid())
    )
  );

CREATE POLICY "Users can create productos"
  ON public.productos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.encartes e
      WHERE e.id = productos.encarte_id
      AND e.created_by = auth.uid()
    )
  );

-- Create responses table (audit responses)
CREATE TABLE public.respuestas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  encarte_id UUID REFERENCES public.encartes(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id) ON DELETE CASCADE,
  precio_encontrado DECIMAL(10,2),
  precio_tarjeta DECIMAL(10,2),
  presencia_producto BOOLEAN,
  presencia_cartel BOOLEAN,
  presencia_cartel_con_tarjeta BOOLEAN,
  ubicacion_sku TEXT,
  observaciones TEXT,
  precio_ok BOOLEAN,
  cumplimiento_carteles BOOLEAN,
  obs_1 TEXT,
  foto TEXT, -- URL to product photo
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.respuestas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view respuestas of their encartes"
  ON public.respuestas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.encartes e
      WHERE e.id = respuestas.encarte_id
      AND (e.created_by = auth.uid() OR e.encargado_1 = auth.uid() OR e.encargado_2 = auth.uid())
    )
  );

CREATE POLICY "Users can create respuestas"
  ON public.respuestas FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own respuestas"
  ON public.respuestas FOR UPDATE
  USING (auth.uid() = created_by);

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'encarte-photos',
  'encarte-photos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Storage policies
CREATE POLICY "Users can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'encarte-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Photos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'encarte-photos');

CREATE POLICY "Users can update own photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'encarte-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'encarte-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create indexes for better performance
CREATE INDEX idx_encartes_created_by ON public.encartes(created_by);
CREATE INDEX idx_productos_encarte_id ON public.productos(encarte_id);
CREATE INDEX idx_respuestas_encarte_id ON public.respuestas(encarte_id);
CREATE INDEX idx_respuestas_producto_id ON public.respuestas(producto_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.encartes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();