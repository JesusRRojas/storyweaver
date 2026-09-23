'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'

export default function MyTranslationsPage() {
  const [bookGroups, setBookGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterLanguage, setFilterLanguage] = useState('todos')
  const [languages, setLanguages] = useState([])

  useEffect(() => {
    const loadTranslations = async () => {
      const { data: userData } = await supabase.auth.getUser()

      const { data } = await supabase
        .from('translations')
        .select(`
          *,
          pages (
            page_number,
            content,
            book_id,
            books (id, title)
          ),
          languages (id, name)
        `)
        .eq('translated_by', userData.user.id)
        .order('created_at', { ascending: false })

      // Obtener total de páginas por libro
      const bookIds = [...new Set(data?.map(t => t.pages?.book_id).filter(Boolean))]
      const pageCounts = {}
      for (const bookId of bookIds) {
        const { count } = await supabase
          .from('pages')
          .select('*', { count: 'exact', head: true })
          .eq('book_id', bookId)
        pageCounts[bookId] = count
      }

      // Agrupar por libro + idioma
      const groups = {}
      data?.forEach((t) => {
        const bookId = t.pages?.books?.id
        const langId = t.languages?.id
        const key = `${bookId}-${langId}`

        if (!groups[key]) {
          groups[key] = {
            key,
            bookId,
            bookTitle: t.pages?.books?.title,
            languageId: langId,
            languageName: t.languages?.name,
            translatedPages: 0,
            totalPages: pageCounts[bookId] || 0,
            lastUpdated: t.created_at,
            translations: []
          }
        }
        groups[key].translatedPages += 1
        groups[key].translations.push(t)
        if (t.created_at > groups[key].lastUpdated) {
          groups[key].lastUpdated = t.created_at
        }
      })

      const groupList = Object.values(groups)
      setBookGroups(groupList)

      // Idiomas únicos para el filtro
      const uniqueLangs = [...new Map(
        groupList.map(g => [g.languageId, { id: g.languageId, name: g.languageName }])
      ).values()]
      setLanguages(uniqueLangs)
      setLoading(false)
    }
    loadTranslations()
  }, [])

  const filtered = filterLanguage === 'todos'
    ? bookGroups
    : bookGroups.filter(g => g.languageId === parseInt(filterLanguage))

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">Mis Traducciones</h1>
        <Link href="/" className="text-blue-500 hover:underline">← Volver al inicio</Link>
      </nav>

      <main className="max-w-4xl mx-auto p-8">
        {languages.length > 1 && (
          <div className="mb-6 flex items-center gap-3">
            <span className="text-gray-600 text-sm font-medium">Filtrar por idioma:</span>
            <select
              className="border p-2 rounded-lg text-sm"
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value)}
            >
              <option value="todos">Todos</option>
              {languages.map(lang => (
                <option key={lang.id} value={lang.id}>{lang.name}</option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <p className="text-center text-gray-500">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500">No hay traducciones para mostrar.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((group) => {
              const isComplete = group.translatedPages >= group.totalPages
              return (
                <div key={group.key} className="bg-white rounded-xl shadow p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-bold">{group.bookTitle}</h3>
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                          isComplete
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {isComplete ? '✅ Completada' : '⏳ En progreso'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        Idioma: {group.languageName} · {group.translatedPages} de {group.totalPages} páginas traducidas
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Última actualización: {new Date(group.lastUpdated).toLocaleDateString('es-MX', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {!isComplete && (
                        <Link
                          href={`/book/${group.bookId}?lang=${group.languageId}`}
                          className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 text-center"
                        >
                          Continuar →
                        </Link>
                      )}
                      {isComplete && (
                        <Link
                          href={`/book/${group.bookId}?lang=${group.languageId}`}
                          className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600 text-center"
                        >
                          ✏️ Editar
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${(group.translatedPages / group.totalPages) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}