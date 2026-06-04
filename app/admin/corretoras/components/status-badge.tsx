const CONFIG = {
  ativo:    { label: 'Ativa',     class: 'bg-green-100 text-green-700' },
  suspenso: { label: 'Suspensa',  class: 'bg-yellow-100 text-yellow-700' },
  inativo:  { label: 'Inativa',   class: 'bg-gray-100 text-gray-500' },
} as const

export function StatusBadge({ status }: { status: string }) {
  const cfg = CONFIG[status as keyof typeof CONFIG] ?? { label: status, class: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.class}`}>
      {cfg.label}
    </span>
  )
}
