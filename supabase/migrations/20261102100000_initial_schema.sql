create extension if not exists pgcrypto;

create type public.app_role as enum ('employee', 'technician', 'manager');
create type public.ticket_priority as enum ('low', 'normal', 'high');
create type public.ticket_status as enum (
  'open',
  'assigned',
  'in_progress',
  'waiting_parts',
  'resolved',
  'closed',
  'cancelled'
);
create type public.stock_movement_type as enum ('entry', 'usage', 'usage_reversal');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'employee',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_not_blank check (length(btrim(name)) > 0),
  constraint categories_name_unique unique (name)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  assigned_to uuid references auth.users (id) on delete set null,
  category_id uuid references public.categories (id) on delete restrict,
  title text not null,
  description text,
  location text,
  priority public.ticket_priority not null default 'normal',
  status public.ticket_status not null default 'open',
  due_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_ticket_no_not_blank check (length(btrim(ticket_no)) > 0),
  constraint tickets_ticket_no_unique unique (ticket_no),
  constraint tickets_title_not_blank check (length(btrim(title)) > 0),
  constraint tickets_version_positive check (version > 0)
);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  constraint ticket_messages_body_not_blank check (length(btrim(body)) > 0)
);

create table public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint ticket_attachments_storage_path_not_blank
    check (length(btrim(storage_path)) > 0)
);

create table public.ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete restrict,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz not null default now(),
  constraint ticket_history_action_not_blank check (length(btrim(action)) > 0)
);

create table public.parts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  unit text not null,
  stock_quantity integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parts_code_unique unique (code),
  constraint parts_code_not_blank check (length(btrim(code)) > 0),
  constraint parts_name_not_blank check (length(btrim(name)) > 0),
  constraint parts_unit_not_blank check (length(btrim(unit)) > 0),
  constraint parts_stock_quantity_nonnegative check (stock_quantity >= 0)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts (id) on delete restrict,
  ticket_id uuid references public.tickets (id) on delete restrict,
  type public.stock_movement_type not null,
  quantity integer not null,
  reverses_movement_id uuid unique references public.stock_movements (id) on delete restrict,
  request_id uuid not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  reason text,
  created_at timestamptz not null default now(),
  constraint stock_movements_quantity_positive check (quantity > 0),
  constraint stock_movements_ticket_requirement check (
    (type = 'entry' and ticket_id is null)
    or (type in ('usage', 'usage_reversal') and ticket_id is not null)
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticket_id uuid references public.tickets (id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_message_not_blank check (length(btrim(message)) > 0)
);

create index tickets_created_by_idx on public.tickets (created_by);
create index tickets_assigned_to_idx on public.tickets (assigned_to);
create index tickets_category_id_idx on public.tickets (category_id);
create index tickets_status_idx on public.tickets (status);
create index ticket_messages_ticket_id_created_at_idx
  on public.ticket_messages (ticket_id, created_at);
create index ticket_attachments_ticket_id_idx on public.ticket_attachments (ticket_id);
create unique index ticket_attachments_storage_path_unique_idx
  on public.ticket_attachments (storage_path);
create index ticket_history_ticket_id_created_at_idx
  on public.ticket_history (ticket_id, created_at);
create index stock_movements_part_id_created_at_idx
  on public.stock_movements (part_id, created_at);
create index stock_movements_ticket_id_idx on public.stock_movements (ticket_id);
create index notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at);
create index notifications_unread_idx
  on public.notifications (user_id, created_at)
  where read_at is null;

create sequence public.ticket_no_seq;

alter table public.tickets
  add column request_id uuid not null;

create unique index tickets_created_by_request_id_idx
  on public.tickets (created_by, request_id);

alter table public.ticket_attachments
  add column mime_type text not null default 'image/jpeg',
  add column file_size_bytes integer not null default 0,
  add constraint ticket_attachments_mime_type_check
    check (mime_type in ('image/jpeg', 'image/png')),
  add constraint ticket_attachments_file_size_check
    check (file_size_bytes between 1 and 5242880),
  add constraint ticket_attachments_private_path_check
    check (storage_path not like 'http://%' and storage_path not like 'https://%');

create unique index stock_movements_actor_request_id_idx
  on public.stock_movements (actor_id, request_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'employee'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profile id cannot be changed';
  end if;

  if (new.role is distinct from old.role
      or new.is_active is distinct from old.is_active)
     and coalesce((select auth.role()), '')
       not in ('service_role', 'supabase_admin')
     and current_user <> 'postgres' then
    raise exception 'profile role and active state require trusted management';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_fields
before update on public.profiles
for each row execute function public.protect_profile_fields();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger tickets_set_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

create trigger parts_set_updated_at
before update on public.parts
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
    and is_active;
$$;

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_active
  );
$$;

create or replace function public.can_access_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    case public.current_user_role()
      when 'manager' then true
      when 'technician' then (
        t.created_by = (select auth.uid())
        or t.assigned_to = (select auth.uid())
      )
      when 'employee' then t.created_by = (select auth.uid())
      else false
    end
  from public.tickets as t
  where t.id = p_ticket_id;
$$;

create or replace function public.prevent_direct_stock_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' and new.stock_quantity <> 0 then
    raise exception 'parts must start with zero stock';
  end if;

  if tg_op = 'UPDATE'
     and new.stock_quantity is distinct from old.stock_quantity
     and (
       current_setting('app.allow_stock_update', true) is distinct from 'on'
       or (
         coalesce((select auth.role()), '')
           not in ('service_role', 'supabase_admin')
         and current_user <> 'postgres'
       )
     ) then
    raise exception 'stock_quantity can only be changed by a trusted stock movement';
  end if;
  return new;
end;
$$;

create trigger parts_prevent_direct_stock_change
before insert or update of stock_quantity on public.parts
for each row execute function public.prevent_direct_stock_change();

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  stock_delta integer;
  current_stock integer;
  reversal_type public.stock_movement_type;
  original_ticket_id uuid;
  original_quantity integer;
  previous_stock_update_setting text;
begin

  if coalesce((select auth.role()), '')
       not in ('service_role', 'supabase_admin')
     and current_user <> 'postgres'
     and coalesce(current_setting('app.stock_rpc', true), '') <> 'on' then
    raise exception 'stock movements require trusted management';
  end if;

  if new.type in ('entry', 'usage_reversal') then
    stock_delta := new.quantity;
  else
    stock_delta := -new.quantity;
  end if;

  if new.type = 'usage_reversal' then
    if new.reverses_movement_id is null then
      raise exception 'usage_reversal must reference a movement';
    end if;

    select sm.type, sm.ticket_id
      into reversal_type, original_ticket_id
      from public.stock_movements as sm
      where sm.id = new.reverses_movement_id
        and sm.part_id = new.part_id;

    if reversal_type is distinct from 'usage' then
      raise exception 'usage_reversal must reverse a usage movement for the same part';
    end if;

    if new.ticket_id is distinct from original_ticket_id then
      raise exception 'usage_reversal must use the original usage ticket';
    end if;

    select quantity
      into original_quantity
      from public.stock_movements as sm
      where sm.id = new.reverses_movement_id;

    if new.quantity is distinct from original_quantity then
      raise exception 'usage_reversal quantity must match the original usage';
    end if;
  elsif new.reverses_movement_id is not null then
    raise exception 'only usage_reversal may reverse a movement';
  end if;

  select stock_quantity
    into current_stock
    from public.parts
    where id = new.part_id
    for update;

  if current_stock + stock_delta < 0 then
    raise exception 'stock quantity cannot become negative';
  end if;

  previous_stock_update_setting := current_setting('app.allow_stock_update', true);
  perform set_config('app.allow_stock_update', 'on', true);
  update public.parts
  set stock_quantity = stock_quantity + stock_delta
  where id = new.part_id;
  perform set_config(
    'app.allow_stock_update',
    coalesce(previous_stock_update_setting, 'off'),
    true
  );

  return new;
end;
$$;

create trigger stock_movements_apply_stock
after insert on public.stock_movements
for each row execute function public.apply_stock_movement();

create or replace function public.protect_notification_fields()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.ticket_id is distinct from old.ticket_id
     or new.message is distinct from old.message
     or new.created_at is distinct from old.created_at then
    raise exception 'notification identity and content fields cannot be changed';
  end if;

  return new;
end;
$$;

create trigger notifications_protect_fields
before update on public.notifications
for each row execute function public.protect_notification_fields();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_history enable row level security;
alter table public.parts enable row level security;
alter table public.stock_movements enable row level security;
alter table public.notifications enable row level security;

revoke all on table
  public.profiles,
  public.categories,
  public.tickets,
  public.ticket_messages,
  public.ticket_attachments,
  public.ticket_history,
  public.parts,
  public.stock_movements,
  public.notifications
from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;
grant select on table public.categories, public.parts to authenticated;
grant select on table
  public.tickets,
  public.ticket_messages,
  public.ticket_attachments,
  public.ticket_history,
  public.stock_movements
to authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;
revoke all on function public.current_user_is_active() from public, anon;
grant execute on function public.current_user_is_active() to authenticated;
revoke all on function public.can_access_ticket(uuid) from public, anon;
grant execute on function public.can_access_ticket(uuid) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.protect_profile_fields() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_direct_stock_change() from public, anon, authenticated;
revoke all on function public.apply_stock_movement() from public, anon, authenticated;
revoke all on function public.protect_notification_fields() from public, anon, authenticated;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  and public.current_user_is_active()
);

create policy profiles_update_own_name
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and role is not distinct from public.current_user_role()
  and is_active
);

create policy categories_select_active
on public.categories
for select
to authenticated
using (is_active and public.current_user_is_active());

create policy categories_select_manager_all
on public.categories
for select
to authenticated
using (public.current_user_role() = 'manager'
  and public.current_user_is_active());

create policy parts_select_active
on public.parts
for select
to authenticated
using (is_active and public.current_user_is_active());

create policy parts_select_manager_all
on public.parts
for select
to authenticated
using (public.current_user_role() = 'manager'
  and public.current_user_is_active());

create policy tickets_select_per_role
on public.tickets
for select
to authenticated
using (public.can_access_ticket(id));

create policy ticket_messages_select_per_ticket
on public.ticket_messages
for select
to authenticated
using (public.can_access_ticket(ticket_id));

create policy ticket_attachments_select_per_ticket
on public.ticket_attachments
for select
to authenticated
using (public.can_access_ticket(ticket_id));

create policy ticket_history_select_per_ticket
on public.ticket_history
for select
to authenticated
using (public.can_access_ticket(ticket_id));

create policy stock_movements_select_per_ticket
on public.stock_movements
for select
to authenticated
using (
  (ticket_id is not null and public.can_access_ticket(ticket_id))
  or (
    ticket_id is null
    and public.current_user_role() = 'manager'
    and public.current_user_is_active()
  )
);

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_is_active()
);

create policy notifications_update_read_at
on public.notifications
for update
to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_is_active()
)
with check (
  user_id = (select auth.uid())
  and public.current_user_is_active()
);

create or replace function public.notify_ticket_participants(
  p_ticket_id uuid,
  p_message text,
  p_actor_id uuid
)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  insert into public.notifications (user_id, ticket_id, message)
  select participant_id, p_ticket_id, p_message
  from (
    select t.created_by as participant_id
    from public.tickets as t
    where t.id = p_ticket_id
    union
    select t.assigned_to
    from public.tickets as t
    where t.id = p_ticket_id
      and t.assigned_to is not null
  ) as participants
  where participant_id <> p_actor_id;
$$;

create or replace function public.create_ticket(
  p_request_id uuid,
  p_title text,
  p_description text,
  p_category_id uuid,
  p_location text
)
returns public.tickets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  existing_ticket public.tickets;
  created_ticket public.tickets;
begin
  if v_actor_id is null or not public.current_user_is_active() then
    raise exception 'authentication required';
  end if;

  if p_request_id is null
     or length(btrim(coalesce(p_title, ''))) not between 3 and 200
     or length(btrim(coalesce(p_description, ''))) not between 1 and 5000
     or length(btrim(coalesce(p_location, ''))) not between 1 and 300 then
    raise exception 'invalid ticket fields';
  end if;

  if not exists (
    select 1
    from public.categories
    where id = p_category_id
      and is_active
  ) then
    raise exception 'category is not active';
  end if;

  select *
    into existing_ticket
    from public.tickets as t
    where t.created_by = v_actor_id
      and t.request_id = p_request_id;

  if found then
    if existing_ticket.title is distinct from btrim(p_title)
       or existing_ticket.description is distinct from btrim(p_description)
       or existing_ticket.category_id is distinct from p_category_id
       or existing_ticket.location is distinct from btrim(p_location) then
      raise exception 'request_id was already used with different content';
    end if;
    return existing_ticket;
  end if;

  insert into public.tickets (
    ticket_no,
    request_id,
    created_by,
    category_id,
    title,
    description,
    location,
    priority,
    due_at
  )
  values (
    format(
      'SRV-%s-%s',
      to_char(clock_timestamp(), 'YYYYMMDD'),
      lpad(nextval('public.ticket_no_seq')::text, 6, '0')
    ),
    p_request_id,
    v_actor_id,
    p_category_id,
    btrim(p_title),
    btrim(p_description),
    btrim(p_location),
    'normal',
    now() + interval '48 hours'
  )
  returning * into created_ticket;

  insert into public.ticket_history (ticket_id, actor_id, action, new_value)
  values (
    created_ticket.id,
    v_actor_id,
    'created',
    jsonb_build_object('status', created_ticket.status, 'priority', created_ticket.priority)
  );

  return created_ticket;
exception
  when unique_violation then
    select *
      into existing_ticket
      from public.tickets as t
      where t.created_by = v_actor_id
        and t.request_id = p_request_id;
    if found then
      if existing_ticket.title is distinct from btrim(p_title)
         or existing_ticket.description is distinct from btrim(p_description)
         or existing_ticket.category_id is distinct from p_category_id
         or existing_ticket.location is distinct from btrim(p_location) then
        raise exception 'request_id was already used with different content';
      end if;
      return existing_ticket;
    end if;
    raise;
end;
$$;

create or replace function public.update_ticket(
  p_ticket_id uuid,
  p_expected_version integer,
  p_title text,
  p_description text,
  p_category_id uuid,
  p_location text
)
returns public.tickets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  updated_ticket public.tickets;
begin
  if v_actor_id is null
     or not public.current_user_is_active()
     or length(btrim(coalesce(p_title, ''))) not between 3 and 200
     or length(btrim(coalesce(p_description, ''))) not between 1 and 5000
     or length(btrim(coalesce(p_location, ''))) not between 1 and 300 then
    raise exception 'invalid ticket fields';
  end if;

  if not exists (
    select 1
    from public.categories
    where id = p_category_id and is_active
  ) then
    raise exception 'category is not active';
  end if;

  update public.tickets as t
  set title = btrim(p_title),
      description = btrim(p_description),
      category_id = p_category_id,
      location = btrim(p_location),
      version = version + 1
  where t.id = p_ticket_id
    and t.created_by = v_actor_id
    and t.status = 'open'
    and t.version = p_expected_version
  returning * into updated_ticket;

  if not found then
    if exists (
      select 1 from public.tickets
      where id = p_ticket_id and version <> p_expected_version
    ) then
      raise exception 'ticket version conflict';
    end if;
    raise exception 'ticket cannot be edited';
  end if;

  insert into public.ticket_history (ticket_id, actor_id, action, old_value, new_value)
  values (
    p_ticket_id,
    v_actor_id,
    'updated',
    jsonb_build_object('version', p_expected_version),
    jsonb_build_object('version', updated_ticket.version)
  );

  return updated_ticket;
end;
$$;

create or replace function public.assign_ticket(
  p_ticket_id uuid,
  p_technician_id uuid,
  p_expected_version integer
)
returns public.tickets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  previous_assignee uuid;
  updated_ticket public.tickets;
begin
  if public.current_user_role() is distinct from 'manager'
     or not public.current_user_is_active() then
    raise exception 'manager role required';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_technician_id
      and role = 'technician'
      and is_active
  ) then
    raise exception 'technician is not active';
  end if;

  select assigned_to
    into previous_assignee
    from public.tickets
    where id = p_ticket_id
    for update;

  update public.tickets
  set assigned_to = p_technician_id,
      status = case when status = 'open' then 'assigned' else status end,
      version = version + 1
  where id = p_ticket_id
    and version = p_expected_version
    and status in ('open', 'assigned', 'in_progress', 'waiting_parts')
  returning * into updated_ticket;

  if not found then
    raise exception 'ticket version or assignment state conflict';
  end if;

  insert into public.ticket_history (ticket_id, actor_id, action, old_value, new_value)
  values (
    p_ticket_id,
    v_actor_id,
    'assigned',
    jsonb_build_object('version', p_expected_version),
    jsonb_build_object('assigned_to', p_technician_id, 'version', updated_ticket.version)
  );

  perform public.notify_ticket_participants(
    p_ticket_id,
    'Talep ataması güncellendi.',
    v_actor_id
  );
  if previous_assignee is not null
     and previous_assignee <> p_technician_id
     and previous_assignee <> v_actor_id then
    insert into public.notifications (user_id, ticket_id, message)
    values (previous_assignee, p_ticket_id, 'Talep atamanız kaldırıldı.');
  end if;
  return updated_ticket;
end;
$$;

create or replace function public.set_ticket_priority(
  p_ticket_id uuid,
  p_priority public.ticket_priority,
  p_expected_version integer
)
returns public.tickets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  updated_ticket public.tickets;
  target_hours integer;
begin
  if public.current_user_role() is distinct from 'manager'
     or not public.current_user_is_active() then
    raise exception 'manager role required';
  end if;

  target_hours := case p_priority
    when 'low' then 72
    when 'normal' then 48
    when 'high' then 24
  end;

  update public.tickets
  set priority = p_priority,
      due_at = created_at + make_interval(hours => target_hours),
      version = version + 1
  where id = p_ticket_id
    and version = p_expected_version
    and status not in ('closed', 'cancelled')
  returning * into updated_ticket;

  if not found then
    raise exception 'ticket version conflict or closed ticket';
  end if;

  insert into public.ticket_history (ticket_id, actor_id, action, old_value, new_value)
  values (
    p_ticket_id,
    v_actor_id,
    'priority_changed',
    jsonb_build_object('version', p_expected_version),
    jsonb_build_object('priority', p_priority, 'due_at', updated_ticket.due_at)
  );
  perform public.notify_ticket_participants(p_ticket_id, 'Talep önceliği güncellendi.', v_actor_id);
  return updated_ticket;
end;
$$;

create or replace function public.transition_ticket(
  p_ticket_id uuid,
  p_to_status public.ticket_status,
  p_expected_status public.ticket_status,
  p_expected_version integer,
  p_note text default null
)
returns public.tickets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  actor_role public.app_role := public.current_user_role();
  current_ticket public.tickets;
  updated_ticket public.tickets;
  allowed boolean := false;
begin
  select *
    into current_ticket
    from public.tickets
    where id = p_ticket_id
    for update;

  if v_actor_id is null
     or not public.current_user_is_active()
     or not found
     or current_ticket.status <> p_expected_status
     or current_ticket.version <> p_expected_version then
    raise exception 'ticket version or status conflict';
  end if;

  if p_to_status = 'cancelled'
     and current_ticket.status in ('open', 'assigned')
     and (actor_role = 'manager' or current_ticket.created_by = v_actor_id) then
    allowed := true;
  elsif p_to_status = 'in_progress'
        and current_ticket.status in ('assigned', 'waiting_parts')
        and current_ticket.assigned_to = v_actor_id
        and actor_role = 'technician' then
    allowed := true;
  elsif p_to_status = 'waiting_parts'
        and current_ticket.status = 'in_progress'
        and current_ticket.assigned_to = v_actor_id
        and actor_role = 'technician' then
    allowed := true;
  elsif p_to_status = 'resolved'
        and current_ticket.status = 'in_progress'
        and current_ticket.assigned_to = v_actor_id
        and actor_role = 'technician' then
    allowed := true;
  elsif p_to_status = 'closed'
        and current_ticket.status = 'resolved'
        and current_ticket.created_by = v_actor_id then
    allowed := true;
  elsif p_to_status = 'in_progress'
        and current_ticket.status = 'resolved'
        and current_ticket.created_by = v_actor_id then
    allowed := true;
  end if;

  if not allowed then
    raise exception 'ticket status transition is not allowed';
  end if;

  if (p_to_status = 'cancelled' or (
        current_ticket.status = 'resolved' and p_to_status = 'in_progress'
      ))
     and length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'reason is required';
  end if;

  update public.tickets
  set status = p_to_status,
      version = version + 1
  where id = p_ticket_id
    and status = p_expected_status
    and version = p_expected_version
  returning * into updated_ticket;

  if not found then
    raise exception 'ticket version conflict';
  end if;

  insert into public.ticket_history (
    ticket_id, actor_id, action, old_value, new_value, note
  )
  values (
    p_ticket_id,
    v_actor_id,
    'status_changed',
    jsonb_build_object('status', current_ticket.status, 'version', p_expected_version),
    jsonb_build_object('status', p_to_status, 'version', updated_ticket.version),
    nullif(btrim(p_note), '')
  );

  perform public.notify_ticket_participants(
    p_ticket_id,
    format('Talep durumu %s olarak güncellendi.', p_to_status::text),
    v_actor_id
  );
  return updated_ticket;
end;
$$;

create or replace function public.add_ticket_message(
  p_ticket_id uuid,
  p_body text
)
returns public.ticket_messages
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  actor_role public.app_role := public.current_user_role();
  current_ticket public.tickets;
  created_message public.ticket_messages;
begin
  select *
    into current_ticket
    from public.tickets
    where id = p_ticket_id;

  if v_actor_id is null
     or not public.current_user_is_active()
     or not found
     or current_ticket.status in ('closed', 'cancelled')
     or not (
       actor_role = 'manager'
       or current_ticket.created_by = v_actor_id
       or current_ticket.assigned_to = v_actor_id
     ) then
    raise exception 'message access is not allowed';
  end if;

  if length(btrim(coalesce(p_body, ''))) not between 1 and 5000 then
    raise exception 'invalid message body';
  end if;

  insert into public.ticket_messages (ticket_id, author_id, body)
  values (p_ticket_id, v_actor_id, btrim(p_body))
  returning * into created_message;

  perform public.notify_ticket_participants(
    p_ticket_id,
    'Talebe yeni bir mesaj eklendi.',
    v_actor_id
  );
  return created_message;
end;
$$;

create or replace function public.add_ticket_attachment(
  p_ticket_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_file_size_bytes integer
)
returns public.ticket_attachments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  existing_attachment public.ticket_attachments;
  created_attachment public.ticket_attachments;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('ticket-attachments:' || p_ticket_id::text, 0)
  );

  if not public.current_user_is_active()
     or not public.can_access_ticket(p_ticket_id)
     or exists (
       select 1
       from public.tickets
       where id = p_ticket_id
         and status in ('closed', 'cancelled')
     )
     or p_mime_type not in ('image/jpeg', 'image/png')
     or p_file_size_bytes not between 1 and 5242880
     or p_storage_path !~ (
       '^' || p_ticket_id::text || '/' || v_actor_id::text || '/[^/]+$'
     )
     or not exists (
       select 1
       from storage.objects as so
       where so.bucket_id = 'ticket-attachments'
         and so.name = p_storage_path
         and coalesce(so.metadata ->> 'mimetype', '') = p_mime_type
         and case
           when length(coalesce(so.metadata ->> 'size', '')) <= 7
             and coalesce(so.metadata ->> 'size', '') ~ '^[0-9]+$'
             then (so.metadata ->> 'size')::integer = p_file_size_bytes
           else false
         end
     ) then
    raise exception 'attachment is invalid or inaccessible';
  end if;

  select *
    into existing_attachment
    from public.ticket_attachments as ta
    where ta.storage_path = p_storage_path
    for update;
  if found then
    if existing_attachment.ticket_id <> p_ticket_id
       or existing_attachment.uploaded_by <> v_actor_id
       or existing_attachment.mime_type <> p_mime_type
       or existing_attachment.file_size_bytes <> p_file_size_bytes then
      raise exception 'storage path was already registered with different attachment content';
    end if;
    return existing_attachment;
  end if;

  if (
    select count(*)
    from public.ticket_attachments
    where ticket_id = p_ticket_id
  ) >= 3 then
    raise exception 'ticket attachment limit reached';
  end if;

  insert into public.ticket_attachments (
    ticket_id, storage_path, uploaded_by, mime_type, file_size_bytes
  )
  values (
    p_ticket_id, p_storage_path, v_actor_id, p_mime_type, p_file_size_bytes
  )
  returning * into created_attachment;

  return created_attachment;
end;
$$;

create or replace function public.add_part(
  p_code text,
  p_name text,
  p_unit text
)
returns public.parts
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  created_part public.parts;
begin
  if public.current_user_role() is distinct from 'manager'
     or not public.current_user_is_active() then
    raise exception 'manager role required';
  end if;

  if length(btrim(coalesce(p_code, ''))) not between 1 and 100
     or length(btrim(coalesce(p_name, ''))) not between 1 and 200
     or length(btrim(coalesce(p_unit, ''))) not between 1 and 50 then
    raise exception 'invalid part fields';
  end if;

  insert into public.parts (code, name, unit)
  values (btrim(p_code), btrim(p_name), btrim(p_unit))
  returning * into created_part;
  return created_part;
end;
$$;

create or replace function public.create_stock_entry(
  p_request_id uuid,
  p_part_id uuid,
  p_quantity integer,
  p_reason text
)
returns public.stock_movements
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  existing_movement public.stock_movements;
  created_movement public.stock_movements;
begin
  if public.current_user_role() is distinct from 'manager'
     or not public.current_user_is_active()
     or p_request_id is null
     or p_quantity <= 0
     or length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'invalid stock entry';
  end if;

  perform set_config('app.stock_rpc', 'on', true);

  select *
    into existing_movement
    from public.stock_movements as sm
    where sm.actor_id = v_actor_id
      and sm.request_id = p_request_id;
  if found then
    if existing_movement.part_id <> p_part_id
       or existing_movement.type <> 'entry'
       or existing_movement.quantity <> p_quantity
       or existing_movement.reason is distinct from btrim(p_reason) then
      raise exception 'request_id was already used with different stock content';
    end if;
    return existing_movement;
  end if;

  insert into public.stock_movements (
    part_id, type, quantity, actor_id, reason, request_id
  )
  values (p_part_id, 'entry', p_quantity, v_actor_id, btrim(p_reason), p_request_id)
  on conflict (actor_id, request_id) do nothing
  returning * into created_movement;

  if not found then
    select *
      into existing_movement
      from public.stock_movements as sm
      where sm.actor_id = v_actor_id
        and sm.request_id = p_request_id;
    if existing_movement.part_id <> p_part_id
       or existing_movement.type <> 'entry'
       or existing_movement.quantity <> p_quantity
       or existing_movement.reason is distinct from btrim(p_reason) then
      raise exception 'request_id was already used with different stock content';
    end if;
    return existing_movement;
  end if;

  return created_movement;
end;
$$;

create or replace function public.use_part(
  p_request_id uuid,
  p_ticket_id uuid,
  p_part_id uuid,
  p_quantity integer,
  p_reason text
)
returns public.stock_movements
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  existing_movement public.stock_movements;
  current_ticket public.tickets;
  created_movement public.stock_movements;
begin
  select *
    into current_ticket
    from public.tickets as t
    where t.id = p_ticket_id
    for update;

  if p_request_id is null
     or p_quantity <= 0
     or current_ticket.id is null
     or current_ticket.assigned_to <> v_actor_id
     or current_ticket.status <> 'in_progress'
     or public.current_user_role() is distinct from 'technician'
     or not public.current_user_is_active()
     or not exists (
       select 1 from public.parts
       where id = p_part_id and is_active
     ) then
    raise exception 'part usage is not allowed';
  end if;

  perform set_config('app.stock_rpc', 'on', true);

  select *
    into existing_movement
    from public.stock_movements as sm
    where sm.actor_id = v_actor_id
      and sm.request_id = p_request_id;
  if found then
    if existing_movement.ticket_id <> p_ticket_id
       or existing_movement.part_id <> p_part_id
       or existing_movement.type <> 'usage'
       or existing_movement.quantity <> p_quantity
       or existing_movement.reason is distinct from p_reason then
      raise exception 'request_id was already used with different stock content';
    end if;
    return existing_movement;
  end if;

  insert into public.stock_movements (
    part_id, ticket_id, type, quantity, actor_id, reason, request_id
  )
  values (
    p_part_id, p_ticket_id, 'usage', p_quantity, v_actor_id, p_reason, p_request_id
  )
  on conflict (actor_id, request_id) do nothing
  returning * into created_movement;

  if not found then
    select *
      into existing_movement
      from public.stock_movements as sm
      where sm.actor_id = v_actor_id
        and sm.request_id = p_request_id;
    if existing_movement.ticket_id <> p_ticket_id
       or existing_movement.part_id <> p_part_id
       or existing_movement.type <> 'usage'
       or existing_movement.quantity <> p_quantity
       or existing_movement.reason is distinct from p_reason then
      raise exception 'request_id was already used with different stock content';
    end if;
    return existing_movement;
  end if;

  insert into public.ticket_history (ticket_id, actor_id, action, new_value, note)
  values (
    p_ticket_id,
    v_actor_id,
    'stock_usage',
    jsonb_build_object('part_id', p_part_id, 'quantity', p_quantity),
    p_reason
  );
  return created_movement;
end;
$$;

create or replace function public.reverse_part_usage(
  p_request_id uuid,
  p_movement_id uuid,
  p_reason text
)
returns public.stock_movements
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  actor_role public.app_role := public.current_user_role();
  original_movement public.stock_movements;
  current_ticket public.tickets;
  existing_reversal public.stock_movements;
  created_reversal public.stock_movements;
begin
  if not public.current_user_is_active() then
    raise exception 'active user required';
  end if;

  select *
    into original_movement
    from public.stock_movements as sm
    where sm.id = p_movement_id
      and sm.type = 'usage'
    for update;

  select *
    into current_ticket
    from public.tickets as t
    where t.id = original_movement.ticket_id
    for update;

  if p_request_id is null
     or length(btrim(coalesce(p_reason, ''))) = 0
     or original_movement.id is null
     or current_ticket.id is null
     or current_ticket.status not in ('in_progress', 'waiting_parts')
     or not (
       actor_role = 'manager'
       or (
         actor_role = 'technician'
         and current_ticket.assigned_to = v_actor_id
       )
     ) then
    raise exception 'stock reversal is not allowed';
  end if;

  perform set_config('app.stock_rpc', 'on', true);

  select *
    into existing_reversal
    from public.stock_movements as sm
    where sm.actor_id = v_actor_id
      and sm.request_id = p_request_id;
  if found then
    if existing_reversal.reverses_movement_id <> p_movement_id
       or existing_reversal.quantity <> original_movement.quantity
       or existing_reversal.reason is distinct from btrim(p_reason) then
      raise exception 'request_id was already used with different reversal content';
    end if;
    return existing_reversal;
  end if;

  select *
    into existing_reversal
    from public.stock_movements as sm
    where sm.reverses_movement_id = p_movement_id
    for update;
  if found then
    raise exception 'usage movement has already been reversed';
  end if;

  insert into public.stock_movements (
    part_id,
    ticket_id,
    type,
    quantity,
    reverses_movement_id,
    actor_id,
    reason,
    request_id
  )
  values (
    original_movement.part_id,
    original_movement.ticket_id,
    'usage_reversal',
    original_movement.quantity,
    original_movement.id,
    v_actor_id,
    btrim(p_reason),
    p_request_id
  )
  on conflict (actor_id, request_id) do nothing
  returning * into created_reversal;

  if not found then
    select *
      into existing_reversal
      from public.stock_movements as sm
      where sm.actor_id = v_actor_id
        and sm.request_id = p_request_id;
    if existing_reversal.reverses_movement_id <> p_movement_id
       or existing_reversal.quantity <> original_movement.quantity
       or existing_reversal.reason is distinct from btrim(p_reason) then
      raise exception 'request_id was already used with different reversal content';
    end if;
    return existing_reversal;
  end if;

  insert into public.ticket_history (ticket_id, actor_id, action, old_value, note)
  values (
    original_movement.ticket_id,
    v_actor_id,
    'stock_usage_reversed',
    jsonb_build_object('movement_id', original_movement.id),
    btrim(p_reason)
  );
  return created_reversal;
end;
$$;

create or replace function public.create_category(p_name text)
returns public.categories
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  created_category public.categories;
begin
  if public.current_user_role() is distinct from 'manager'
     or not public.current_user_is_active()
     or length(btrim(coalesce(p_name, ''))) not between 1 and 150 then
    raise exception 'manager role and valid category name required';
  end if;

  insert into public.categories (name)
  values (btrim(p_name))
  returning * into created_category;
  return created_category;
end;
$$;

create or replace function public.update_category(
  p_category_id uuid,
  p_name text
)
returns public.categories
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  updated_category public.categories;
begin
  if public.current_user_role() is distinct from 'manager'
     or not public.current_user_is_active()
     or length(btrim(coalesce(p_name, ''))) not between 1 and 150 then
    raise exception 'manager role and valid category name required';
  end if;

  update public.categories
  set name = btrim(p_name),
      updated_at = now()
  where id = p_category_id
  returning * into updated_category;

  if not found then
    raise exception 'category not found';
  end if;
  return updated_category;
end;
$$;

create or replace function public.set_category_active(
  p_category_id uuid,
  p_is_active boolean
)
returns public.categories
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  updated_category public.categories;
begin
  if public.current_user_role() is distinct from 'manager'
     or not public.current_user_is_active() then
    raise exception 'manager role required';
  end if;

  update public.categories
  set is_active = p_is_active,
      updated_at = now()
  where id = p_category_id
  returning * into updated_category;

  if not found then
    raise exception 'category not found';
  end if;
  return updated_category;
end;
$$;

create or replace function public.update_part(
  p_part_id uuid,
  p_code text,
  p_name text,
  p_unit text
)
returns public.parts
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  updated_part public.parts;
begin
  if public.current_user_role() is distinct from 'manager'
     or not public.current_user_is_active()
     or length(btrim(coalesce(p_code, ''))) not between 1 and 100
     or length(btrim(coalesce(p_name, ''))) not between 1 and 200
     or length(btrim(coalesce(p_unit, ''))) not between 1 and 50 then
    raise exception 'manager role and valid part fields required';
  end if;

  update public.parts
  set code = btrim(p_code),
      name = btrim(p_name),
      unit = btrim(p_unit),
      updated_at = now()
  where id = p_part_id
  returning * into updated_part;

  if not found then
    raise exception 'part not found';
  end if;
  return updated_part;
end;
$$;

create or replace function public.set_part_active(
  p_part_id uuid,
  p_is_active boolean
)
returns public.parts
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  updated_part public.parts;
begin
  if public.current_user_role() is distinct from 'manager'
     or not public.current_user_is_active() then
    raise exception 'manager role required';
  end if;

  update public.parts
  set is_active = p_is_active,
      updated_at = now()
  where id = p_part_id
  returning * into updated_part;

  if not found then
    raise exception 'part not found';
  end if;
  return updated_part;
end;
$$;

revoke all on function public.notify_ticket_participants(uuid, text, uuid)
from public, anon, authenticated;
revoke all on function public.create_ticket(uuid, text, text, uuid, text)
from public, anon;
revoke all on function public.update_ticket(uuid, integer, text, text, uuid, text)
from public, anon;
revoke all on function public.assign_ticket(uuid, uuid, integer)
from public, anon;
revoke all on function public.set_ticket_priority(uuid, public.ticket_priority, integer)
from public, anon;
revoke all on function public.transition_ticket(
  uuid,
  public.ticket_status,
  public.ticket_status,
  integer,
  text
)
from public, anon;
revoke all on function public.add_ticket_message(uuid, text)
from public, anon;
revoke all on function public.add_ticket_attachment(uuid, text, text, integer)
from public, anon;
revoke all on function public.add_part(text, text, text)
from public, anon;
revoke all on function public.create_stock_entry(uuid, uuid, integer, text)
from public, anon;
revoke all on function public.use_part(uuid, uuid, uuid, integer, text)
from public, anon;
revoke all on function public.reverse_part_usage(uuid, uuid, text)
from public, anon;
revoke all on function public.create_category(text)
from public, anon;
revoke all on function public.update_category(uuid, text)
from public, anon;
revoke all on function public.set_category_active(uuid, boolean)
from public, anon;
revoke all on function public.update_part(uuid, text, text, text)
from public, anon;
revoke all on function public.set_part_active(uuid, boolean)
from public, anon;

grant execute on function public.create_ticket(uuid, text, text, uuid, text)
to authenticated;
grant execute on function public.update_ticket(uuid, integer, text, text, uuid, text)
to authenticated;
grant execute on function public.assign_ticket(uuid, uuid, integer)
to authenticated;
grant execute on function public.set_ticket_priority(uuid, public.ticket_priority, integer)
to authenticated;
grant execute on function public.transition_ticket(
  uuid,
  public.ticket_status,
  public.ticket_status,
  integer,
  text
)
to authenticated;
grant execute on function public.add_ticket_message(uuid, text)
to authenticated;
grant execute on function public.add_ticket_attachment(uuid, text, text, integer)
to authenticated;
grant execute on function public.add_part(text, text, text)
to authenticated;
grant execute on function public.create_stock_entry(uuid, uuid, integer, text)
to authenticated;
grant execute on function public.use_part(uuid, uuid, uuid, integer, text)
to authenticated;
grant execute on function public.reverse_part_usage(uuid, uuid, text)
to authenticated;
grant execute on function public.create_category(text)
to authenticated;
grant execute on function public.update_category(uuid, text)
to authenticated;
grant execute on function public.set_category_active(uuid, boolean)
to authenticated;
grant execute on function public.update_part(uuid, text, text, text)
to authenticated;
grant execute on function public.set_part_active(uuid, boolean)
to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'ticket-attachments',
  'ticket-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy ticket_attachments_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ticket-attachments'
  and name ~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/[^/]+$'
  and case
    when split_part(name, '/', 1) ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      then public.can_access_ticket(split_part(name, '/', 1)::uuid)
    else false
  end
  and exists (
    select 1
    from public.ticket_attachments as ta
    where ta.ticket_id::text = split_part(name, '/', 1)
      and ta.storage_path = name
  )
);

create policy ticket_attachments_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ticket-attachments'
  and name ~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/[^/]+$'
  and case
    when split_part(name, '/', 1) ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      then public.can_access_ticket(split_part(name, '/', 1)::uuid)
    else false
  end
  and exists (
    select 1
    from public.tickets as t
    where t.id::text = split_part(name, '/', 1)
      and t.status not in ('closed', 'cancelled')
  )
  and split_part(name, '/', 2) = (select auth.uid())::text
  and coalesce((metadata ->> 'mimetype'), '') in ('image/jpeg', 'image/png')
  and case
    when length(coalesce((metadata ->> 'size'), '')) <= 7
      and coalesce((metadata ->> 'size'), '') ~ '^[0-9]+$'
      then (metadata ->> 'size')::integer between 1 and 5242880
    else false
  end
);
