-- ════════════════════════════════════════════════════════════════
-- ETAPA 1 — Quick wins (R10, R11)
-- Correr en: Supabase → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- R10 · Preinscripción online: nuevos campos del aspirante
-- ────────────────────────────────────────────────────────────────
alter table inscripciones
  add column if not exists apellido_aspirante text;

alter table inscripciones
  add column if not exists fecha_nacimiento_aspirante date;


-- ────────────────────────────────────────────────────────────────
-- R11 · Mensajes de contacto recibidos desde la web pública
-- ────────────────────────────────────────────────────────────────
create table if not exists mensajes_contacto (
  id_mensaje   bigint generated always as identity primary key,
  nombre       text        not null,
  email        text        not null,
  mensaje      text        not null,
  leido        boolean     not null default false,
  fecha_envio  timestamptz not null default now()
);

-- Seguridad a nivel de fila.
-- NOTA: si la tabla `inscripciones` funciona HOY sin políticas RLS,
-- es porque tiene RLS desactivado. En ese caso podés omitir el
-- bloque de abajo y simplemente dejar RLS desactivado en esta tabla.
alter table mensajes_contacto enable row level security;

-- Cualquier visitante puede ENVIAR un mensaje (formulario público).
create policy "Envío público de mensajes de contacto"
  on mensajes_contacto for insert
  to anon, authenticated
  with check (true);

-- Solo Admin / Directivo pueden LEER y marcar como leído.
create policy "Staff lee mensajes de contacto"
  on mensajes_contacto for select
  to authenticated
  using (
    exists (
      select 1 from usuarios u
      where u.id_usuario = auth.uid()
        and u.rol in ('Admin', 'Directivo')
    )
  );

create policy "Staff actualiza mensajes de contacto"
  on mensajes_contacto for update
  to authenticated
  using (
    exists (
      select 1 from usuarios u
      where u.id_usuario = auth.uid()
        and u.rol in ('Admin', 'Directivo')
    )
  );