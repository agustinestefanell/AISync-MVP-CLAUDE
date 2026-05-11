# AISync MVP — Claude Code Reference

## Proyecto
AISync es una control layer para trabajo asistido por IA.
Repo activo: AISync-MVP-CLAUDE
Stack: Next.js 14 + TypeScript + Tailwind + Supabase + Vercel
URL producción: https://ai-sync-mvp-claude.vercel.app

## Reglas de trabajo
- Explicar todo en español simple. El developer es non-programmer.
- Confirmar antes de cualquier cambio destructivo.
- Verificar entorno antes de cada tarea: pwd, git branch, git status.
- Mostrar resultado por bloque y esperar aprobación antes de continuar.
- No tocar AISYNC-DEMO-V2 ni AISYNC-DEMO-MVP bajo ninguna circunstancia.
- Un bloque a la vez. No avanzar sin aprobación explícita.

## Arquitectura core
- 1 Account = 1 User = 1 Sovereign Cell
- Jerarquía: Account > Project > Team > Workspace > AI Agent Session
- SAT = todos los agentes del team usan el mismo provider
- MAT = agentes con providers distintos (calculado automáticamente)
- Documentation Mode: five views over the same documentary base
- audit_log sin FK formal a checkpoints — tradeoff temporal pendiente
  de definición arquitectural, no una decisión de diseño cerrada

## Providers de IA
- Arquitectura model-agnostic y extensible
- API keys por usuario en Supabase (tabla user_api_keys)
- AISync no paga el uso de IA de sus clientes
- Providers: Anthropic, OpenAI, Google Gemini, IA Local, Custom

## Capas de prompts
- Capa 1: System prompts de rol — definidos por AISync, intocables por usuario
- Capa 2: Prompts Library del usuario — templates de su industria

## Arquitectura de planos — Bloque 13

CONTROL PLANE (AISync):
accounts, projects, teams, workspaces, agent_sessions,
audit_log, user_api_keys, user_custom_providers, team_connections

CONTENT PLANE (cliente, migrable):
checkpoints, checkpoint_messages, messages

Regla: todo objeto de content plane debe diseñarse como migrable.
Nunca tratarlo como base canónica de AISync.
Referencia: src/lib/db/planes.ts

## Migraciones ejecutadas en Supabase
001_hierarchy, 002_messages, 003_checkpoints,
004_checkpoint_purpose, 005_teams_rls_update,
006_api_keys, 007_custom_providers, 008_team_connections,
009_documentation_metadata, 010_content_plane,
011_system_prompts, 011b_system_prompts_seed,
012_admin_roles

## Estado de bloques
Completados: 1 al 16 (Bloque 16 = Admin Panel Fase 1)
Fase 3 (UI/UX): post-albañilería
Referencia visual: aisync-demo-mvp.vercel.app

## Idioma
100% inglés en la interfaz del producto.
Comunicación con el developer: español simple.

## Ritual de apertura de sesión
1. pwd → confirmar que estás en aisync-mvp-claude
2. git remote -v → confirmar repo correcto
3. git branch --show-current → confirmar rama main
4. git status --short → ver cambios pendientes
5. git log --oneline -5 → ver últimos commits
