-- Migration 059: color en `tags` — soporte para "Edit Tag" en User Library
-- (ajuste post-verificación, 2026-08-22). Nullable con default razonable
-- (mismo azul de --color-accent en tokens.css) para que los tags creados
-- antes de esta migración no aparezcan sin color al mostrarse.

ALTER TABLE tags ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#1f4e79';

COMMENT ON COLUMN tags.color IS
'Color del tag para chips en User Library. Elegido desde una paleta fija en
la UI (Edit Tag), no un color picker libre. Nullable — default aplicado a
filas existentes y nuevas.';
