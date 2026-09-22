-- VEJOTEK: acceso sencillo para vendedores, sin correo
create table if not exists public.seller_access (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pin text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.tickets
  add column if not exists seller_id uuid references public.seller_access(id);

alter table public.seller_access enable row level security;

create policy if not exists "seller admin select" on public.seller_access
for select to authenticated using (public.is_admin());

create policy if not exists "seller admin write" on public.seller_access
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.seed_sellers()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  names text[] := array[
    'Juliana Lopez','Daniela Lopez','Alejandra Rodriguez','Rosa Hernandez',
    'Diana Toquica','Maria Camila','Carolina Malencha','Marcela Gonzalez',
    'Sebastian Lopez','Pablo','Tatiana Lopez','Fernando Lopez',
    'Maicol Lopez','Luz Sabogal','Patricia C. "claudia"','Jose Lopez',
    'Mateo Lopez','Javier A','Javier B','Elizabeth Rodriguez'
  ];
  pins text[] := array[
    '1842','5271','6394','7418','3056','8263','4519','9724','1638','5840',
    '2167','7035','3481','9152','4607','8329','1574','6943','2816','5397'
  ];
  i int;
  s_id uuid;
begin
  if not public.is_admin() then raise exception 'Solo administración'; end if;

  for i in 1..array_length(names,1) loop
    insert into public.seller_access(name,pin)
    values(names[i],pins[i])
    on conflict(name) do update set active=true
    returning id into s_id;

    update public.tickets
      set seller_id=s_id
      where ticket_number between 'VJ-001' and 'VJ-100'
        and ((i-1)*5 < cast(substring(ticket_number from 4) as int)
        and cast(substring(ticket_number from 4) as int) <= i*5);
  end loop;

  -- Diana conserva además su perfil de administradora.
  update public.tickets t
    set socio_id = p.id
  from public.profiles p
  join public.seller_access s on s.name='Diana Toquica'
  where p.role='admin' and p.name='Diana Toquica' and t.seller_id=s.id;

  return array_length(names,1);
end;
$$;

create or replace function public.seller_login(p_name text, p_pin text)
returns json
language plpgsql
security definer
set search_path=public
as $$
declare s public.seller_access;
begin
  select * into s from public.seller_access
  where lower(trim(name))=lower(trim(p_name)) and pin=trim(p_pin) and active=true;
  if not found then
    return json_build_object('ok',false,'message','Nombre o PIN incorrecto');
  end if;
  return json_build_object('ok',true,'seller_id',s.id,'name',s.name);
end;
$$;

create or replace function public.seller_get_tickets(p_seller_id uuid, p_pin text)
returns setof public.tickets
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists(select 1 from public.seller_access where id=p_seller_id and pin=trim(p_pin) and active=true) then
    raise exception 'Acceso no autorizado';
  end if;
  return query select t.* from public.tickets t
    where t.seller_id=p_seller_id
    order by t.ticket_number;
end;
$$;

create or replace function public.seller_save_ticket(
  p_seller_id uuid, p_pin text, p_ticket_id uuid,
  p_type text, p_buyer_name text, p_buyer_phone text
)
returns json
language plpgsql
security definer
set search_path=public
as $$
declare t public.tickets; v_price int;
begin
  if not exists(select 1 from public.seller_access where id=p_seller_id and pin=trim(p_pin) and active=true) then
    raise exception 'Acceso no autorizado';
  end if;
  if p_type not in ('individual','pareja') then raise exception 'Tipo de entrada inválido'; end if;
  v_price := case when p_type='pareja' then 50000 else 30000 end;

  select * into t from public.tickets where id=p_ticket_id and seller_id=p_seller_id for update;
  if not found then raise exception 'Entrada no encontrada'; end if;
  if t.status not in ('disponible','reservada') then raise exception 'Esta entrada ya fue vendida'; end if;

  update public.tickets
    set ticket_type=p_type, price=v_price, status='vendida',
        buyer_name=nullif(trim(p_buyer_name),''), buyer_phone=nullif(trim(p_buyer_phone),'')
    where id=p_ticket_id;

  if p_type='pareja' then
    insert into public.raffle_entries(ticket_id,slot) values(p_ticket_id,2) on conflict do nothing;
  else
    delete from public.raffle_entries where ticket_id=p_ticket_id and slot=2;
  end if;

  return json_build_object('ok',true,'message','Venta registrada');
end;
$$;

create or replace function public.seller_mark_paid(p_seller_id uuid, p_pin text, p_ticket_id uuid)
returns json
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists(select 1 from public.seller_access where id=p_seller_id and pin=trim(p_pin) and active=true) then
    raise exception 'Acceso no autorizado';
  end if;
  update public.tickets
    set status='pagada', paid_at=now()
    where id=p_ticket_id and seller_id=p_seller_id and status='vendida';
  if not found then raise exception 'La entrada debe estar en estado vendida'; end if;
  return json_build_object('ok',true,'message','Pago registrado');
end;
$$;

revoke all on function public.seller_login(text,text) from public;
grant execute on function public.seller_login(text,text) to anon,authenticated;
revoke all on function public.seller_get_tickets(uuid,text) from public;
grant execute on function public.seller_get_tickets(uuid,text) to anon,authenticated;
revoke all on function public.seller_save_ticket(uuid,text,uuid,text,text,text) from public;
grant execute on function public.seller_save_ticket(uuid,text,uuid,text,text,text) to anon,authenticated;
revoke all on function public.seller_mark_paid(uuid,text,uuid) from public;
grant execute on function public.seller_mark_paid(uuid,text,uuid) to anon,authenticated;

-- Permitir que el administrador vea el vendedor aunque todavía no haya perfil de autenticación.
create policy if not exists "tickets admin select all" on public.tickets
for select to authenticated using (public.is_admin());
