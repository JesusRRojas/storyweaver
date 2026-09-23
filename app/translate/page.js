'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'

export default function TranslatePage() {
  const [books, setBooks] = useState([])
  const [languages, setLanguages] = useState([])
  const [selectedBook, setSelectedBook] = useState(null)
  const [selectedLanguage, setSelectedLanguage] = useState(null)
  const [pages, setPages] = useState([])
  const [translations, setTranslations] = useState({})
  const [message, setMessage] = useState('')
  const [user, setUser] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      const { data: userData } = await supabase.auth.getUser()
      setUser(userData.user)
      const { data: booksData } = await supabase.from('books').select('*')
      setBooks(booksData || [])
      const { data: langsData } = await supabase.from('languages').select('*')
      setLanguages(langsData || [])
    }
    loadData()
  }, [])

  const loadPages = async (bookId) => {
    setSelectedBook(bookId)
    const { data } = await supabase.from('pages').select('*').eq('book_id', bookId).order('page_number')
    setPages(data || [])
    setTranslations({})
  }

  const saveTranslation = async (pageId) => {
    if (!selectedLanguage) return setMessage('Selecciona un idioma primero')
    if (!translations[pageId]) return setMessage('Escribe una traducción primero')

    const { error } = await supabase.from('translations').upsert({
      page_id: pageId,
      language_id: parseInt(selectedLanguage),
      translated_content: translations[pageId],
      translated_by: user.id,
      status: 'completed'
    }, { onConflict: 'page_id,language_id' })

    if (error) setMessage(error.message)
    else setMessage('¡Traducción guardada exitosamente!')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">StoryWeaver — Traducir</h1>
        <Link href="/" className="text-blue-500 hover:underline">Volver al inicio</Link>
      </nav>

      <main className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded shadow p-6 mb-6 flex gap-4">
          <select
            className="border p-2 rounded flex-1"
            onChange={(e) => loadPages(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>Selecciona un libro</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>{book.title}</option>
            ))}
          </select>

          <select
            className="border p-2 rounded flex-1"
            onChange={(e) => setSelectedLanguage(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>Selecciona idioma destino</option>
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
        </div>

        {message && <p className="text-center text-green-600 mb-4">{message}</p>}

        {pages.length === 0 && selectedBook && (
          <p className="text-center text-gray-500">Este libro no tiene páginas aún.</p>
        )}

        {pages.map((page) => (
          <div key={page.id} className="bg-white rounded shadow p-6 mb-4">
            <p className="text-sm text-gray-400 mb-2">Página {page.page_number}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-bold mb-2">Texto original:</p>
                <p className="text-gray-700 bg-gray-50 p-3 rounded">{page.content}</p>
              </div>
              <div>
                <p className="font-bold mb-2">Tu traducción:</p>
                <textarea
                  className="w-full border p-2 rounded h-32"
                  placeholder="Escribe tu traducción aquí..."
                  value={translations[page.id] || ''}
                  onChange={(e) => setTranslations({ ...translations, [page.id]: e.target.value })}
                />
                <button
                  onClick={() => saveTranslation(page.id)}
                  className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Guardar traducción
                </button>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}