-- Create tiendas table
CREATE TABLE public.tiendas (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  bandera TEXT NOT NULL,
  tienda TEXT NOT NULL,
  distrito TEXT,
  ubigeo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.tiendas ENABLE ROW LEVEL SECURITY;

-- Create policies for tiendas
-- All authenticated users can view tiendas
CREATE POLICY "Users can view tiendas"
ON public.tiendas
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can insert tiendas
CREATE POLICY "Admins can insert tiendas"
ON public.tiendas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Only admins can update tiendas
CREATE POLICY "Admins can update tiendas"
ON public.tiendas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Only admins can delete tiendas
CREATE POLICY "Admins can delete tiendas"
ON public.tiendas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);