-- Migración 045: Agregar campo extraction_error para diagnóstico
-- Context Files — Stage A: Instrumentación de errores de extracción
-- Fecha: 2026-07-01

ALTER TABLE public.context_sources
ADD COLUMN IF NOT EXISTS extraction_error TEXT;
