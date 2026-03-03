-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'auditor', 'encuestador');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role::app_role
FROM public.profiles
WHERE role IS NOT NULL;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policy for user_roles: users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- RLS policy for user_roles: only admins can insert roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS policy for user_roles: only admins can update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policy for user_roles: only admins can delete roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Update encartes policies to use has_role function
DROP POLICY IF EXISTS "Admins can view all encartes" ON public.encartes;
CREATE POLICY "Admins can view all encartes"
ON public.encartes
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Encuestadores can view all encartes" ON public.encartes;
CREATE POLICY "Encuestadores can view all encartes"
ON public.encartes
FOR SELECT
USING (public.has_role(auth.uid(), 'encuestador'));

DROP POLICY IF EXISTS "Auditors can view assigned encartes" ON public.encartes;
CREATE POLICY "Auditors can view assigned encartes"
ON public.encartes
FOR SELECT
USING (
  public.has_role(auth.uid(), 'auditor') 
  AND (auth.uid() = created_by OR auth.uid() = encargado_1 OR auth.uid() = encargado_2)
);

-- Update exhibiciones policies to use has_role function
DROP POLICY IF EXISTS "Admins can view all exhibiciones" ON public.exhibiciones;
CREATE POLICY "Admins can view all exhibiciones"
ON public.exhibiciones
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Encuestadores can view all exhibiciones" ON public.exhibiciones;
CREATE POLICY "Encuestadores can view all exhibiciones"
ON public.exhibiciones
FOR SELECT
USING (public.has_role(auth.uid(), 'encuestador'));

DROP POLICY IF EXISTS "Auditors can view assigned exhibiciones" ON public.exhibiciones;
CREATE POLICY "Auditors can view assigned exhibiciones"
ON public.exhibiciones
FOR SELECT
USING (
  public.has_role(auth.uid(), 'auditor')
  AND (auth.uid() = created_by OR auth.uid() = encargado_1)
);

-- Update productos policies to use has_role function
DROP POLICY IF EXISTS "Encuestadores can view all productos" ON public.productos;
CREATE POLICY "Encuestadores can view all productos"
ON public.productos
FOR SELECT
USING (public.has_role(auth.uid(), 'encuestador'));

-- Update productos_exhibicion policies to use has_role function
DROP POLICY IF EXISTS "Encuestadores can view all productos_exhibicion" ON public.productos_exhibicion;
CREATE POLICY "Encuestadores can view all productos_exhibicion"
ON public.productos_exhibicion
FOR SELECT
USING (public.has_role(auth.uid(), 'encuestador'));

-- Update tiendas policies to use has_role function
DROP POLICY IF EXISTS "Admins can insert tiendas" ON public.tiendas;
CREATE POLICY "Admins can insert tiendas"
ON public.tiendas
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update tiendas" ON public.tiendas;
CREATE POLICY "Admins can update tiendas"
ON public.tiendas
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete tiendas" ON public.tiendas;
CREATE POLICY "Admins can delete tiendas"
ON public.tiendas
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Remove role column from profiles (optional - uncomment if you want to remove it)
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;