create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','socio');
create type public.ticket_status as enum ('disponible','reservada','vendida','pagada','ingresada');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  role public.user_role not null default 'socio',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null,
  socio_id uuid references public.profiles(id),
  ticket_type text not null default 'individual' check (ticket_type in ('individual','pareja')),
  price integer not null default 30000 check (price in (30000,50000)),
  status public.ticket_status not null default 'disponible',
  buyer_name text,
  buyer_phone text,
  qr_token uuid unique not null default gen_random_uuid(),
  paid_at timestamptz,
  entered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.raffle_entries (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  slot smallint not null default 1 check (slot in (1,2)),
  eligible boolean not null default false,
  created_at timestamptz not null default now(),
  unique(ticket_id,slot)
);

create table public.raffle_draws (
  id uuid primary key default gen_random_uuid(),
  raffle_entry_id uuid references public.raffle_entries(id),
  winner_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id,name,email,role)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''),'@',1), 'Usuario'),
    new.email,
    case when not exists(select 1 from public.profiles) then 'admin'::public.user_role else 'socio'::public.user_role end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and active=true); $$;

alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.raffle_entries enable row level security;
alter table public.raffle_draws enable row level security;

create policy "profiles own or admin" on public.profiles for select to authenticated
using (id=auth.uid() or public.is_admin());

create policy "admin profiles write" on public.profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "tickets admin or owner select" on public.tickets for select to authenticated
using (public.is_admin() or socio_id=auth.uid());

create policy "tickets admin insert" on public.tickets for insert to authenticated
with check (public.is_admin());

create policy "tickets admin update or owner" on public.tickets for update to authenticated
using (public.is_admin() or socio_id=auth.uid())
with check (public.is_admin() or socio_id=auth.uid());

create policy "tickets admin delete" on public.tickets for delete to authenticated
using (public.is_admin());

create policy "raffle select authenticated" on public.raffle_entries for select to authenticated
using (true);

create policy "raffle admin write" on public.raffle_entries for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "draw admin" on public.raffle_draws for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create or replace function public.seed_tickets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'Solo administración'; end if;
  insert into public.tickets(ticket_number,ticket_type,price)
  select 'VJ-'||lpad(i::text,3,'0'),'individual',30000
  from generate_series(1,100) i
  on conflict (ticket_number) do nothing;
  insert into public.raffle_entries(ticket_id,slot)
  select id,1 from public.tickets on conflict do nothing;
  select count(*) into n from public.tickets;
  return n;
end;
$$;

create or replace function public.validate_entry(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare t public.tickets;
begin
  select * into t from public.tickets
  where ticket_number=upper(trim(p_code)) or qr_token::text=trim(p_code)
  limit 1;
  if not found then return json_build_object('ok',false,'message','Entrada no encontrada'); end if;
  if t.status='ingresada' or t.entered_at is not null then
    return json_build_object('ok',false,'message','Entrada ya utilizada','ticket',t.ticket_number);
  end if;
  if t.status <> 'pagada' then
    return json_build_object('ok',false,'message','Entrada no está pagada','ticket',t.ticket_number);
  end if;
  update public.tickets set status='ingresada', entered_at=now() where id=t.id;
  update public.raffle_entries set eligible=true where ticket_id=t.id;
  return json_build_object('ok',true,'message','Entrada válida. ¡Bienvenido!','ticket',t.ticket_number);
end;
$$;

revoke all on function public.validate_entry(text) from public;
grant execute on function public.validate_entry(text) to anon, authenticated;
revoke all on function public.seed_tickets() from public;
grant execute on function public.seed_tickets() to authenticated;
