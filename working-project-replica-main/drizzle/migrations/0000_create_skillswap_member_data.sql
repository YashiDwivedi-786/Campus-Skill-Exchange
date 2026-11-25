CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Student',
  school text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  skills_teach text[] NOT NULL DEFAULT '{}',
  skills_learn text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can discover profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can edit their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.create_skill_swap_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''), NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''), 'Student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER after_auth_user_created_skill_swap
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_skill_swap_profile();

CREATE TABLE public.saved_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, student_id),
  CHECK (owner_id <> student_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_students TO authenticated;
GRANT ALL ON public.saved_students TO service_role;
ALTER TABLE public.saved_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their saved students" ON public.saved_students FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Users can save students" ON public.saved_students FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can unsave students" ON public.saved_students FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.skill_exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_offered text NOT NULL,
  skill_requested text NOT NULL,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> recipient_id)
);
GRANT SELECT, INSERT, UPDATE ON public.skill_exchanges TO authenticated;
GRANT ALL ON public.skill_exchanges TO service_role;
ALTER TABLE public.skill_exchanges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exchange participants can read requests" ON public.skill_exchanges FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = recipient_id);
CREATE POLICY "Members can request exchanges" ON public.skill_exchanges FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Recipients can respond to requests" ON public.skill_exchanges FOR UPDATE TO authenticated USING (auth.uid() = recipient_id OR auth.uid() = requester_id) WITH CHECK (auth.uid() = recipient_id OR (auth.uid() = requester_id AND status = 'cancelled'));

CREATE TABLE public.exchange_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id uuid NOT NULL REFERENCES public.skill_exchanges(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.exchange_messages TO authenticated;
GRANT ALL ON public.exchange_messages TO service_role;
ALTER TABLE public.exchange_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exchange participants can read messages" ON public.exchange_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.skill_exchanges e WHERE e.id = exchange_id AND (e.requester_id = auth.uid() OR e.recipient_id = auth.uid())));
CREATE POLICY "Exchange participants can send messages" ON public.exchange_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.skill_exchanges e WHERE e.id = exchange_id AND (e.requester_id = auth.uid() OR e.recipient_id = auth.uid())));