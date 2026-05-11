-- Bloque 5b: Agregar propósito a checkpoints
-- Ejecutar en: Supabase Dashboard → SQL Editor

alter table checkpoints
  add column if not exists purpose text not null default 'Checkpoint';
