-- Create event_logs table for centralized logging
CREATE TABLE public.event_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp bigint NOT NULL,
  type text NOT NULL,
  severity text NOT NULL,
  message text NOT NULL,
  context jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stack_trace text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_event_logs_timestamp ON public.event_logs(timestamp DESC);
CREATE INDEX idx_event_logs_user_id ON public.event_logs(user_id);
CREATE INDEX idx_event_logs_type ON public.event_logs(type);
CREATE INDEX idx_event_logs_severity ON public.event_logs(severity);

-- Enable Row Level Security
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own logs
CREATE POLICY "Users can insert own logs"
ON public.event_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own logs
CREATE POLICY "Users can view own logs"
ON public.event_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Admins can view all logs
CREATE POLICY "Admins can view all logs"
ON public.event_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Admins can delete logs
CREATE POLICY "Admins can delete logs"
ON public.event_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));