-- agent_messages predates the assistant API (retired three-voice web UI);
-- table is empty and has no other writers. Modernize role to the AI-SDK
-- vocabulary the assistant routes actually write.
alter table public.agent_messages drop constraint agent_messages_role_check;
alter table public.agent_messages add constraint agent_messages_role_check check (role in ('user','assistant'));
