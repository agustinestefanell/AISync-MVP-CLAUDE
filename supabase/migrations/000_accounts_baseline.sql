-- ============================================================
-- MIGRACIÓN BASELINE — 000_accounts_baseline.sql
-- ESTADO: YA APLICADA EN PRODUCCIÓN — NO EJECUTAR
-- Documenta el schema de accounts y el trigger de creación
-- creados manualmente antes de la migración 001.
-- Registrada como parte de la auditoría técnica 2026-06-11.
-- Verificado contra producción 2026-06-11: columnas reales
-- id, email, name, created_at, plan, role, status.
-- Nota: role y status fueron agregadas después por la 012
-- (ADD COLUMN IF NOT EXISTS — replay seguro); se incluyen acá
-- para que el baseline refleje el estado actual de la tabla.
-- ============================================================

-- Tabla accounts
create table if not exists public.accounts (
  id uuid primary key,
  email text not null,
  name text,
  created_at timestamptz default now(),
  plan text default 'free',
  role text not null default 'user',
  status text not null default 'active'
);

-- Función handle_new_user
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.accounts (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on_auth_user_created
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
