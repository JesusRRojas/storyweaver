'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function Home() {
  const [books, setBooks] = useState([])
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      const { data: userData } = await supabase.auth.getUser()
      setUser(userData.user)
      if (userData.user) {
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', userData.user.id).single()
        setRole(profile?.role || 'reader')
      }
      const { data: booksData } = await supabase
        .from('books')
        .select(`
          *,
          pages (
            image_url,
            page_number
          )
        `)
        .order('id')

      // Ordenar páginas y tomar solo la primera
      const booksWithCover = booksData?.map(book => ({
        ...book,
        cover: book.pages?.sort((a, b) => a.page_number - b.page_number)[0]?.image_url
      }))
      setBooks(booksWithCover || [])
    }
    loadData()
  }, [])

  const bookColors = [
    'bg-pink-100 border-pink-300',
    'bg-blue-100 border-blue-300',
    'bg-green-100 border-green-300',
    'bg-yellow-100 border-yellow-300',
    'bg-purple-100 border-purple-300',
    'bg-orange-100 border-orange-300',
  ]

  const bookEmojis = ['📘', '📗', '📕', '📙', '📓', '📔']

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-3xl">📚</span>
            <span className="text-2xl font-black text-gray-800">story<span className="text-orange-500">weaver</span></span>
          </div>
          <div className="flex gap-6 items-center">
            {user ? (
              <>
                <Link href="/my-translations" className="text-teal-600 font-semibold hover:text-teal-700">
                  Mis traducciones
                </Link>
                <div className="relative group">
                  <button className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full hover:bg-gray-200">
                    <span className="text-gray-700 text-sm font-medium">{user.email}</span>
                    <span className="text-gray-500 text-xs">▼</span>
                  </button>
                  <div className="absolute right-0 top-10 bg-white rounded-2xl shadow-xl border border-gray-100 w-52 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <div className="p-2">
                      {role === 'admin' && (
                        <>
                          <Link href="/admin" className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-50 text-gray-700 text-sm">
                            ➕ Agregar libro
                          </Link>
                          <Link href="/admin/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-50 text-gray-700 text-sm">
                            ⚙️ Panel admin
                          </Link>
                          <div className="border-t border-gray-100 my-1" />
                        </>
                      )}
                      <button
                        onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}
                        className="w-full flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-red-50 text-red-500 text-sm"
                      >
                        🚪 Cerrar sesión
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <Link href="/auth" className="bg-orange-500 text-white px-6 py-2 rounded-full font-bold hover:bg-orange-600 shadow">
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 py-16 px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="max-w-lg">
            <h1 className="text-5xl font-black text-gray-800 leading-tight mb-4">
              Historias para <span className="text-orange-500">todos</span> los idiomas 🌍
            </h1>
            <p className="text-gray-600 text-lg mb-8">
              Lee cuentos ilustrados y ayuda a traducirlos para que más niños puedan disfrutarlos en su lengua materna.
            </p>
            {!user && (
              <Link href="/auth" className="bg-orange-500 text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-orange-600 shadow-lg inline-block">
                Comenzar a leer →
              </Link>
            )}
          </div>
          <div className="text-9xl hidden md:block">🦜</div>
        </div>

        {/* Stats */}
        <div className="max-w-6xl mx-auto mt-12 flex gap-12">
          <div className="text-center">
            <p className="text-4xl font-black text-orange-500">{books.length}</p>
            <p className="text-gray-600 font-medium">HISTORIAS</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-black text-teal-500">4</p>
            <p className="text-gray-600 font-medium">IDIOMAS</p>
          </div>
        </div>
      </div>

      {/* Catálogo */}
      <div className="max-w-6xl mx-auto px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-gray-800">📖 Historias disponibles</h2>
        </div>

        {books.length === 0 ? (
          <p className="text-gray-400 text-center text-xl py-12">No hay libros disponibles aún.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {books.map((book, i) => (
              <div key={book.id} className="relative group">
                {role === 'admin' && (
                  <button
                    onClick={async () => {
                      if (confirm('¿Estás seguro de eliminar este libro?')) {
                      const { data: bookPages } = await supabase
                        .from('pages').select('id').eq('book_id', book.id)
                      const pageIds = bookPages?.map(p => p.id) || []
                      if (pageIds.length > 0) {
                        await supabase.from('translations').delete().in('page_id', pageIds)
                      }
                      await supabase.from('pages').delete().eq('book_id', book.id)
                      await supabase.from('books').delete().eq('id', book.id)
                      setBooks(books.filter(b => b.id !== book.id))
                    }
                    }}
                    className="absolute top-2 right-2 z-10 bg-red-500 text-white text-xs px-2 py-1 rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 transition"
                  >
                    ✕
                  </button>
                )}
                <Link href={`/book/${book.id}`}>
                  <div className={`${bookColors[i % bookColors.length]} border-2 rounded-2xl p-4 hover:shadow-lg transition cursor-pointer h-full`}>
                    {book.cover ? (
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="w-full h-32 object-cover rounded-xl mb-3"
                        />
                      ) : (
                        <div className="text-5xl text-center mb-3">{bookEmojis[i % bookEmojis.length]}</div>
                      )}
                    <h3 className="font-black text-gray-800 text-sm mb-1 line-clamp-2">{book.title}</h3>
                    <p className="text-gray-500 text-xs mb-3 line-clamp-2">{book.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="bg-white text-gray-600 text-xs px-2 py-1 rounded-full border">
                        {book.level || 'General'}
                      </span>
                      <span className="text-orange-500 text-xs font-bold">Leer →</span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 px-8 mt-12">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-2xl font-black mb-2">📚 storyweaver</p>
          <p className="text-gray-400 text-sm">Historias para todos los idiomas del mundo</p>
        </div>
      </footer>
    </div>
  )
}