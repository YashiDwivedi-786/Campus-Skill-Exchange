REVOKE UPDATE ON public.skill_exchanges FROM authenticated;
GRANT UPDATE (status, updated_at) ON public.skill_exchanges TO authenticated;
DROP POLICY "Recipients can respond to requests" ON public.skill_exchanges;
CREATE POLICY "Recipients can respond and requesters can cancel" ON public.skill_exchanges FOR UPDATE TO authenticated USING (auth.uid() = recipient_id OR auth.uid() = requester_id) WITH CHECK ((auth.uid() = recipient_id AND status IN ('accepted', 'declined', 'completed')) OR (auth.uid() = requester_id AND status = 'cancelled'));