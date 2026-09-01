-- ════════════════════════════════════════════════════════════════
-- ETAPA 3 — R5 · Reservas de instalaciones con control de solapamiento
-- Correr en: Supabase → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- Instalaciones del centro educativo
-- ────────────────────────────────────────────────────────────────
create table if not exists instalaciones (
  id_instalacion bigint generated always as identity primary key,
  nombre         text    not null,
  tipo           text,
  descripcion    text,
  activo         boolean not null default true
);

-- ────────────────────────────────────────────────────────────────
-- Reservas de instalaciones
-- ────────────────────────────────────────────────────────────────
create table if not exists reservas_instalaciones (
  id_reserva     bigint generated always as identity primary key,
  id_instalacion bigint not null
                 references instalaciones(id_instalacion) on delete cascade,
  fecha          date   not null,
  hora_inicio    time   not null,
  hora_fin       time   not null,
  motivo         text,
  reservado_por  uuid   references usuarios(id_usuario),
  fecha_registro timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);

-- ────────────────────────────────────────────────────────────────
-- Verificación automática de disponibilidad
--   Rechaza la reserva si se superpone con otra de la misma
--   instalación en la misma fecha y franja horaria.
-- ────────────────────────────────────────────────────────────────
create or replace function fn_check_solapamiento_reserva()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from reservas_instalaciones r
    where r.id_instalacion = new.id_instalacion
      and r.fecha = new.fecha
      and r.id_reserva is distinct from new.id_reserva
      and new.hora_inicio < r.hora_fin
      and new.hora_fin   > r.hora_inicio
  ) then
    raise exception 'La instalación ya está reservada en ese horario';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_solapamiento on reservas_instalaciones;
create trigger trg_check_solapamiento
  before insert or update on reservas_instalaciones
  for each row execute function fn_check_solapamiento_reserva();

-- ────────────────────────────────────────────────────────────────
-- Carga inicial de instalaciones (R5)
-- ────────────────────────────────────────────────────────────────
insert into instalaciones (nombre, tipo, descripcion)
values
  ('Pileta de natación', 'Deportiva', 'Pileta climatizada'),
  ('Cancha de fútbol',   'Deportiva', 'Cancha de fútbol al aire libre'),
  ('Pista de atletismo', 'Deportiva', 'Pista de atletismo'),
  ('Gimnasio cubierto',  'Deportiva', 'Gimnasio multipropósito cubierto')
on conflict do nothing;