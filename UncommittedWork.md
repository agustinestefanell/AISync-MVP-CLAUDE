# UncommittedWork.md — Rastreo de trabajo pendiente de decisión

Ver `ProjectStartProtocol_V2.md`, archivo 7, para las reglas de uso de esta tabla.

No es un registro de todos los commits (eso ya lo tiene Git, y el resumen narrativo vive en `handoff-2026-07-c.md`). Es exclusivamente para lo que **todavía no se decidió** — commitear, descartar, o mover a una rama de borrador. Cuando algo de la tabla se resuelve, se saca — no se marca como "resuelto".

| Archivo/Carpeta | Status | Descripción | Fecha detectado |
|---|---|---|---|
| `supabase/migrations/045_add_extraction_error_field.sql` | Modificado (tracked) — ⚠️ requiere decisión | **Contenido corrompido:** el SQL real (`ALTER TABLE context_sources ADD COLUMN extraction_error`) fue reemplazado por el string literal `2` sin salto de línea final. La migración ya está aplicada en Supabase (no afecta producción), pero el archivo versionado ya no refleja la migración real — riesgo si algún día se necesita reconstruir el schema desde las migraciones. Necesita decisión: revertir a su contenido original (`git checkout` sobre este archivo) o confirmar que el cambio fue intencional. | 2026-09-18 |
| `.claude/settings.local.json` | Modificado (tracked) | Allowlist de permisos de Bash/PowerShell acumulada de sesiones recientes (comandos de diagnóstico, scripts de migración, npm audit, etc.). Config local del harness, no es código de producto. | 2026-09-18 |
| `AUDIT_LOCAL_DEPLOYMENT.md` | Sin commitear | Informe de auditoría de solo lectura (2026-08-10) sobre el acoplamiento actual a Supabase Cloud / Vercel / Tavily, de cara a una eventual Etapa 2 de despliegue local (self-hosted / air-gapped). Standalone, sin código tocado. Nunca commiteado. | 2026-09-18 (archivo existe desde 2026-08-10) |
| `ProjectStartProtocol_V2.md` | Sin commitear | Protocolo V2 de infraestructura documental — fuente de esta misma OE (rebasa el V1). Se commitea junto con esta OE. | 2026-09-18 |
| `design-refs/audit-view/` | Sin commitear | Referencias visuales (imágenes) de diseño para Audit View. Material de referencia, no código de producto. | 2026-09-18 (carpeta existe desde 2026-08-19) |
| `design-refs/investigate-view/` | Sin commitear | Referencias visuales de diseño para Investigate View. | 2026-09-18 (carpeta existe desde 2026-08-21) |
| `design-refs/logo/` | Sin commitear | Referencias del logo Hitr.io usadas durante el rebranding. | 2026-09-18 (carpeta existe desde 2026-08-31) |
| `design-refs/teams-map/2026 07 22 TEAM MAPS NEW DESIGN - dranf t vertical.png` | Sin commitear | Mockup visual de Teams Map (draft vertical). | 2026-09-18 (archivo existe desde 2026-07-22) |
| `design-refs/teams-map/2026 07 22 draft 5 - aisync-teams-map-stacked-projects-figma.svg` | Sin commitear | Mockup Figma de Teams Map (draft 5, stacked projects). | 2026-09-18 (archivo existe desde 2026-07-22) |
| `src/app/teams-map-preview/` | Sin commitear | Ruta standalone de preview de Teams Map V3 (datos mock), no en producción — ya señalado como deuda en `handoff-2026-07-c.md` 2026-08-24 (excluido a propósito del fix `h-dvh` por no estar en producción). | 2026-09-18 (existe desde 2026-07-13) |
| `src/components/teams/preview/` | Sin commitear | Componentes del preview Teams Map V3 (`CanvasViewport.tsx`, `TreeLayoutCanvas.tsx`, `buildTreeLayout.ts`, `mockTeamsMapV3Data.ts`, etc.) — mismo preview que `src/app/teams-map-preview/`, no en producción. | 2026-09-18 (existe desde 2026-07-13/14) |
