-- Eliminar políticas existentes de tiendas
DROP POLICY IF EXISTS "Users can view tiendas" ON public.tiendas;
DROP POLICY IF EXISTS "Admins can insert tiendas" ON public.tiendas;
DROP POLICY IF EXISTS "Admins can update tiendas" ON public.tiendas;
DROP POLICY IF EXISTS "Admins can delete tiendas" ON public.tiendas;

-- Crear política unificada y permisiva para SELECT
CREATE POLICY "Authenticated users can view tiendas"
ON public.tiendas
FOR SELECT
TO authenticated
USING (true);

-- Mantener políticas de admin para modificaciones
CREATE POLICY "Admins can manage tiendas"
ON public.tiendas
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));