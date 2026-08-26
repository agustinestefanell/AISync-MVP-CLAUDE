import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Config de react-markdown/remark-gfm para CONTENIDO GUARDADO (Checkpoint,
// Handoff Package, Saved Selection, Loaded Context, Review & Forward) —
// portada tal cual desde MARKDOWN_COMPONENTS/REMARK_PLUGINS de
// src/components/workspace/AgentPanel.tsx (el chat en vivo), que es donde
// este mismo contenido SÍ se ve renderizado correctamente (2026-08-26, fix
// de bug: el contenido guardado se mostraba como texto Markdown crudo en
// ExpandContentModal/User Library/Review & Forward).
//
// AgentPanel.tsx y HumanChatPanel.tsx (chat en vivo) mantienen sus propias
// copias locales, sin cambios — ya funcionan correctamente, no se tocan al
// resolver este bug (evita riesgo en el código de chat en vivo por un fix
// que no lo necesita).

export const DOCUMENT_MARKDOWN_REMARK_PLUGINS = [remarkGfm]

export const DOCUMENT_MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-5">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[11px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-gray-300 px-2 py-1 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 px-2 py-1">
      {children}
    </td>
  ),
  code: ({ children, className }) => {
    const isInline = !className
    return isInline ? (
      <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px] font-mono">
        {children}
      </code>
    ) : (
      <code className="block bg-gray-100 p-2 rounded text-[10px] font-mono overflow-x-auto my-2">
        {children}
      </code>
    )
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-300 pl-3 my-2 italic text-gray-700">
      {children}
    </blockquote>
  ),
}
