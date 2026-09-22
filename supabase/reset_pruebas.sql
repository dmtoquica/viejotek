-- VEJOTEK · REINICIO DE PRUEBAS
-- Deja las 100 boletas listas para empezar de cero.
-- CONSERVA los 20 vendedores y sus 5 boletas asignadas.
-- Ejecutar en Supabase > SQL Editor > Run.

begin;

update public.tickets
set
  ticket_type = 'individual',
  price = 30000,
  status = 'disponible',
  buyer_name = null,
  buyer_phone = null,
  paid_at = null,
  entered_at = null
where ticket_number like 'VJ-%';

delete from public.raffle_entries
where ticket_id in (
  select id from public.tickets where ticket_number like 'VJ-%'
);

insert into public.raffle_entries (ticket_id, slot, eligible)
select id, 1, false
from public.tickets
where ticket_number like 'VJ-%';

delete from public.raffle_draws;

commit;

-- Verificación
select
  count(*) as total_boletas,
  count(*) filter (where status = 'disponible') as disponibles,
  count(*) filter (where status <> 'disponible') as no_disponibles,
  count(*) filter (where ticket_type = 'individual' and price = 30000) as individuales
from public.tickets
where ticket_number like 'VJ-%';

select
  count(*) as rifas_creadas,
  count(*) filter (where eligible = false) as no_elegibles
from public.raffle_entries
where ticket_id in (
  select id from public.tickets where ticket_number like 'VJ-%'
);
