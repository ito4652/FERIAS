-- Sección Candidatos: tabla, almacenamiento de CV y reglas de acceso.
-- Pégalo completo en Supabase > SQL Editor > New query y pulsa Run. Se puede ejecutar más de una vez.

-- Solo las cuentas @icb.cl con sesión iniciada pueden leer o escribir.
create or replace function public.es_equipo() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') ilike '%@icb.cl'
$$;

create table if not exists public.candidatos (
  id             uuid primary key default gen_random_uuid(),
  creado         timestamptz not null default now(),
  actualizado    timestamptz not null default now(),
  nombre         text not null,
  feria          text,
  feria_id       text,
  universidad    text,
  carrera        text,
  tipo           text check (tipo in ('Práctica', 'Trabajo')),
  busca_desde    text check (busca_desde ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  correo         text,
  telefono       text,
  evaluacion     smallint check (evaluacion between 1 and 3),
  estado         text not null default 'Por contactar'
                 check (estado in ('Por contactar', 'Contactado', 'En proceso', 'Contratado', 'Descartado')),
  notas          text,
  cv_path        text,
  cv_nombre      text,
  entrevistador  text,
  consentimiento boolean not null default false
);

create or replace function public.tocar_actualizado() returns trigger
language plpgsql as $$
begin new.actualizado := now(); return new; end $$;

drop trigger if exists candidatos_actualizado on public.candidatos;
create trigger candidatos_actualizado before update on public.candidatos
  for each row execute function public.tocar_actualizado();

-- Campos agregados para importar desde Excel (no hace nada si ya existen).
alter table public.candidatos add column if not exists nivel        text;
alter table public.candidatos add column if not exists area_interes text;
alter table public.candidatos add column if not exists duracion     text;

alter table public.candidatos enable row level security;

-- Permisos explícitos: solo usuarios con sesión iniciada; los visitantes anónimos no tienen acceso.
revoke all on public.candidatos from anon;
grant select, insert, update, delete on public.candidatos to authenticated;

drop policy if exists "equipo lee"     on public.candidatos;
drop policy if exists "equipo crea"    on public.candidatos;
drop policy if exists "equipo edita"   on public.candidatos;
drop policy if exists "equipo elimina" on public.candidatos;
create policy "equipo lee"     on public.candidatos for select to authenticated using (public.es_equipo());
create policy "equipo crea"    on public.candidatos for insert to authenticated with check (public.es_equipo());
create policy "equipo edita"   on public.candidatos for update to authenticated using (public.es_equipo()) with check (public.es_equipo());
create policy "equipo elimina" on public.candidatos for delete to authenticated using (public.es_equipo());

-- Almacenamiento privado para los CV (máximo 25 MB por archivo).
insert into storage.buckets (id, name, public, file_size_limit)
values ('cvs', 'cvs', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "equipo lee cv"     on storage.objects;
drop policy if exists "equipo sube cv"    on storage.objects;
drop policy if exists "equipo cambia cv"  on storage.objects;
drop policy if exists "equipo elimina cv" on storage.objects;
create policy "equipo lee cv"     on storage.objects for select to authenticated using (bucket_id = 'cvs' and public.es_equipo());
create policy "equipo sube cv"    on storage.objects for insert to authenticated with check (bucket_id = 'cvs' and public.es_equipo());
create policy "equipo cambia cv"  on storage.objects for update to authenticated using (bucket_id = 'cvs' and public.es_equipo());
create policy "equipo elimina cv" on storage.objects for delete to authenticated using (bucket_id = 'cvs' and public.es_equipo());
