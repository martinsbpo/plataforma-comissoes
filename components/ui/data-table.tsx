'use client'

import { useState } from 'react'
import { Skeleton } from './skeleton'

export type Column<T> = {
  key: keyof T | string
  label: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
}

type Props<T> = {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  error?: boolean
  keyField: keyof T
  onExport?: () => void
  exportLabel?: string
}

export function DataTable<T>({ columns, data, loading, error, keyField, onExport, exportLabel }: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 20

  function toggleSort(key: string) {
    if (sortKey === key) setDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function setDir(fn: (d: 'asc' | 'desc') => 'asc' | 'desc') {
    setSortDir(fn(sortDir))
  }

  const filtered = data.filter(row =>
    JSON.stringify(row).toLowerCase().includes(filter.toLowerCase())
  )

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const av = String((a as Record<string, unknown>)[sortKey] ?? '')
        const bv = String((b as Record<string, unknown>)[sortKey] ?? '')
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    : filtered

  const totalPages = Math.ceil(sorted.length / perPage)
  const paginated = sorted.slice((page - 1) * perPage, page * perPage)

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
        <span className="text-2xl">⚠️</span>
        <p className="text-sm text-gray-500">Não foi possível carregar os dados.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-blue-600 hover:underline"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <input
          type="text"
          placeholder="Filtrar..."
          value={filter}
          onChange={e => { setFilter(e.target.value); setPage(1) }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
        />
        {onExport && (
          <button
            onClick={onExport}
            className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {exportLabel ?? '⬇ Exportar'}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {columns.map(col => (
                  <th
                    key={String(col.key)}
                    className={`text-left px-4 py-3 text-gray-600 font-medium whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-gray-900 select-none' : ''}`}
                    onClick={() => col.sortable && toggleSort(String(col.key))}
                  >
                    {col.label}
                    {col.sortable && sortKey === String(col.key) && (
                      <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                paginated.map(row => (
                  <tr key={String((row as Record<string, unknown>)[String(keyField)])} className="hover:bg-gray-50">
                    {columns.map(col => (
                      <td key={String(col.key)} className="px-4 py-3 text-gray-700">
                        {col.render
                          ? col.render(row)
                          : String((row as Record<string, unknown>)[String(col.key)] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>{sorted.length} registros</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                ‹
              </button>
              <span>{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
