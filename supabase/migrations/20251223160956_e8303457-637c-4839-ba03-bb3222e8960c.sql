-- Add is_active column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Create index for faster lookups
CREATE INDEX idx_user_roles_is_active ON public.user_roles(is_active);

-- Create function to check if user is active
CREATE OR REPLACE FUNCTION public.is_user_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.user_roles WHERE user_id = _user_id LIMIT 1),
    true
  )
$$;