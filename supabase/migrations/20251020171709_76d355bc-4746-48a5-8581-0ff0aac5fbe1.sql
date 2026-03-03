-- Drop all existing view policies for encartes
DROP POLICY IF EXISTS "Users can view own encartes" ON encartes;
DROP POLICY IF EXISTS "Admins can view all encartes" ON encartes;
DROP POLICY IF EXISTS "Encuestadores can view all encartes" ON encartes;
DROP POLICY IF EXISTS "Auditors can view assigned encartes" ON encartes;

-- Create new policies for viewing encartes
-- Admins can view all encartes
CREATE POLICY "Admins can view all encartes"
ON encartes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Encuestadores can view all encartes (to select which one to audit)
CREATE POLICY "Encuestadores can view all encartes"
ON encartes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'encuestador'
  )
);

-- Auditors can view encartes they created or are assigned to
CREATE POLICY "Auditors can view assigned encartes"
ON encartes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'auditor'
  )
  AND (
    auth.uid() = created_by 
    OR auth.uid() = encargado_1 
    OR auth.uid() = encargado_2
  )
);