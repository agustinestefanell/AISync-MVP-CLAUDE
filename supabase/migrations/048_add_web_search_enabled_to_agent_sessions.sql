-- Add web_search_enabled to agent_sessions
--
-- Context:
-- Runtime Grounding Layer + Web Search default ON persistente por agente.
-- Cada agent session ahora tiene su propio toggle de web search,
-- persistente en DB, default ON (true).
--
-- Esta columna reemplaza el patrón anterior de inyectar instrucciones
-- de web search en systemPromptParts — ahora se inyecta una capa de
-- runtime grounding siempre, y el toggle controla si web search está
-- o no disponible en esa capa.

alter table agent_sessions
  add column if not exists web_search_enabled boolean not null default true;
