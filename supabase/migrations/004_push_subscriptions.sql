-- Sprint 2 schema: Push Subscriptions

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL UNIQUE,
  keys jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own push subscriptions."
  ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions."
  ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions."
  ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for push subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE push_subscriptions;
