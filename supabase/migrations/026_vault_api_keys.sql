-- SEC-005 — Supabase Vault encryption for user provider API keys
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Crea metadata Vault (vault_secret_id, key_last4) y RPCs SECURITY DEFINER para
-- guardar/leer/borrar API keys desde Vault. NO elimina las columnas api_key
-- legacy — el dual-read (Vault primero, plaintext fallback) y el backfill manual
-- se manejan por separado. Ver handoff.md 2026-06-12 para el SQL de backfill.
--
-- Notas de diseño:
-- - `provider` se guarda tal como llega ('Anthropic', no 'anthropic') — las filas
--   existentes usan display names; lowercasear crearía duplicados lógicos.
-- - El nombre del secret de known providers usa lower() solo como namespace.
-- - Custom providers se identifican por (account_id, name) y su secret usa el id
--   de la fila — estable ante renombres y sin colisiones de case.
-- - Las escrituras nuevas dejan api_key = '' en la fila (NOT NULL legacy): una
--   fila Vault-backed nunca necesita su plaintext y retener la key vieja sería
--   un secreto stale. El plaintext de filas AÚN no migradas no se toca.

-- ─── Columnas de metadata ─────────────────────────────────────────────────────

ALTER TABLE public.user_api_keys
  ADD COLUMN IF NOT EXISTS vault_secret_id uuid,
  ADD COLUMN IF NOT EXISTS key_last4 text;

ALTER TABLE public.user_custom_providers
  ADD COLUMN IF NOT EXISTS vault_secret_id uuid,
  ADD COLUMN IF NOT EXISTS key_last4 text;

-- ─── Known providers ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_provider_key(
  p_provider text,
  p_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
  v_secret_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;
  IF p_provider IS NULL OR trim(p_provider) = '' THEN
    RAISE EXCEPTION 'provider is required.';
  END IF;
  IF p_key IS NULL OR trim(p_key) = '' THEN
    RAISE EXCEPTION 'key is required.';
  END IF;

  v_secret_name := 'provider_key_' || auth.uid()::text || '_' || lower(trim(p_provider));

  SELECT id INTO v_secret_id FROM vault.secrets WHERE name = v_secret_name;

  IF v_secret_id IS NULL THEN
    v_secret_id := vault.create_secret(trim(p_key), v_secret_name);
  ELSE
    PERFORM vault.update_secret(v_secret_id, trim(p_key));
  END IF;

  INSERT INTO public.user_api_keys (account_id, provider, api_key, vault_secret_id, key_last4, updated_at)
  VALUES (auth.uid(), trim(p_provider), '', v_secret_id, right(trim(p_key), 4), now())
  ON CONFLICT (account_id, provider)
  DO UPDATE SET
    vault_secret_id = EXCLUDED.vault_secret_id,
    key_last4       = EXCLUDED.key_last4,
    api_key         = '',  -- la key nueva vive solo en Vault; el plaintext previo queda obsoleto
    updated_at      = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_provider_key(
  p_provider text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
  v_secret text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT vault_secret_id INTO v_secret_id
  FROM public.user_api_keys
  WHERE account_id = auth.uid()
    AND provider = trim(p_provider);

  IF v_secret_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = v_secret_id;

  RETURN v_secret;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_provider_key(
  p_provider text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  SELECT vault_secret_id INTO v_secret_id
  FROM public.user_api_keys
  WHERE account_id = auth.uid()
    AND provider = trim(p_provider);

  DELETE FROM public.user_api_keys
  WHERE account_id = auth.uid()
    AND provider = trim(p_provider);

  -- borrar el secret recién después de borrar la fila — sin fila no hay referencia
  IF v_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;
END;
$$;

-- ─── Custom providers (campo real: name; secret por id de fila) ───────────────

CREATE OR REPLACE FUNCTION public.set_custom_provider_key(
  p_provider_name text,
  p_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_row_id uuid;
  v_secret_id uuid;
  v_secret_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;
  IF p_provider_name IS NULL OR trim(p_provider_name) = '' THEN
    RAISE EXCEPTION 'provider name is required.';
  END IF;
  IF p_key IS NULL OR trim(p_key) = '' THEN
    RAISE EXCEPTION 'key is required.';
  END IF;

  SELECT id, vault_secret_id INTO v_row_id, v_secret_id
  FROM public.user_custom_providers
  WHERE account_id = auth.uid()
    AND name = trim(p_provider_name);

  IF v_row_id IS NULL THEN
    RAISE EXCEPTION 'Custom provider not found.';
  END IF;

  v_secret_name := 'custom_provider_key_' || v_row_id::text;

  IF v_secret_id IS NULL THEN
    v_secret_id := vault.create_secret(trim(p_key), v_secret_name);
  ELSE
    PERFORM vault.update_secret(v_secret_id, trim(p_key));
  END IF;

  UPDATE public.user_custom_providers
  SET vault_secret_id = v_secret_id,
      key_last4       = right(trim(p_key), 4),
      api_key         = ''  -- idem set_provider_key
  WHERE id = v_row_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_custom_provider_key(
  p_provider_name text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
  v_secret text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT vault_secret_id INTO v_secret_id
  FROM public.user_custom_providers
  WHERE account_id = auth.uid()
    AND name = trim(p_provider_name);

  IF v_secret_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = v_secret_id;

  RETURN v_secret;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_custom_provider_key(
  p_provider_name text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_row_id uuid;
  v_secret_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  SELECT id, vault_secret_id INTO v_row_id, v_secret_id
  FROM public.user_custom_providers
  WHERE account_id = auth.uid()
    AND name = trim(p_provider_name);

  IF v_row_id IS NULL THEN
    RETURN;  -- nada que borrar
  END IF;

  DELETE FROM public.user_custom_providers WHERE id = v_row_id;

  IF v_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;
END;
$$;

-- ─── Permisos: solo usuarios autenticados; revocar el EXECUTE público default ──

REVOKE ALL ON FUNCTION public.set_provider_key(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_provider_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_provider_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_custom_provider_key(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_custom_provider_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_custom_provider_key(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_provider_key(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_provider_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_custom_provider_key(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_custom_provider_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_custom_provider_key(text) TO authenticated;
