'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ books: 0, translations: 0, translators: 0 })
  const [translatorActivity, setTranslatorActivity] = useState([])
  const [pendingTranslations, setPendingTranslations] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('activity')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { count: booksCount } = await supabase
      .from('books').select('*', { count: 'exact', head: true })

    const { count: transCount } = await supabase
      .from('translations').select('*', { count: 'exact', head: true })

    const { data: transData } = await supabase
      .from('translations')
      .select(`
        translated_by,
        created_at,
        languages (name),
        pages (
          page_number,
          book_id,
          books (title)
        )
      `)
      .order('created_at', { ascending: false })

    const translators = {}
    transData?.forEach((t) => {
      const uid = t.translated_by
      if (!translators[uid]) {
        translators[uid] = { uid, totalTranslations: 0, books: {}, lastActivity: t.created_at }
      }
      translators[uid].totalTranslations += 1
      if (t.created_at > translators[uid].lastActivity) {
        translators[uid].lastActivity = t.created_at
      }
      const key = `${t.pages?.books?.title}-${t.languages?.name}`
      if (!translators[uid].books[key]) {
        translators[uid].books[key] = { bookTitle: t.pages?.books?.title, langName: t.languages?.name, pages: 0 }
      }
      translators[uid].books[key].pages += 1
    })

    const uids = Object.keys(translators)
    const { data: emailData } = await supabase.rpc('get_user_emails', { user_ids: uids })
    uids.forEach(uid => {
      const user = emailData?.find(u => u.id === uid)
      translators[uid].email = user?.email || uid.slice(0, 8) + '...'
    })

    const { data: pending } = await supabase
      .from('translations')
      .select(`*, pages (page_number, content, books (title)), languages (name)`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    const pendingWithEmails = await Promise.all(
      (pending || []).map(async (t) => {
        const { data: ed } = await supabase.rpc('get_user_emails', { user_ids: [t.translated_by] })
        return { ...t, email: ed?.[0]?.email || t.translated_by.slice(0, 8) + '...' }
      })
    )

    const { data: profiles } = await supabase.from('profiles').select('*')
    const allUids = profiles?.map(p => p.id) || []
    const { data: allEmails } = await supabase.rpc('get_user_emails', { user_ids: allUids })
    const usersWithEmail = profiles?.map(p => ({
      ...p,
      email: allEmails?.find(e => e.id === p.id)?.email || p.id.slice(0, 8) + '...'
    })) || []

    setStats({ books: booksCount || 0, translations: transCount || 0, translators: uids.length })
    setTranslatorActivity(Object.values(translators))
    setPendingTranslations(pendingWithEmails)
    setUsers(usersWithEmail)
    setLoading(false)
  }

  const verifyTranslation = async (id) => {
    await supabase.from('translations').update({ status: 'completed' }).eq('id', id)
    setPendingTranslations(pendingTranslations.filter(t => t.id !== id))
  }

  const rejectTranslation = async (id) => {
    await supabase.from('translations').update({ status: 'rejected' }).eq('id', id)
    setPendingTranslations(pendingTranslations.filter(t => t.id !== id))
  }

  const changeRole = async (userId, newRole) => {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  const roleColors = {
    admin: 'bg-purple-100 text-purple-700',
    translator: 'bg-blue-100 text-blue-700',
    reader: 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">Panel de Administrador</h1>
        <div className="flex gap-4">
          <Link href="/admin" className="text-blue-500 hover:underline">Agregar libro</Link>
          <Link href="/" className="text-blue-500 hover:underline">← Inicio</Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-8">
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <p className="text-4xl font-bold text-blue-600">{stats.books}</p>
            <p className="text-gray-500 mt-2">Libros</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <p className="text-4xl font-bold text-green-600">{stats.translations}</p>
            <p className="text-gray-500 mt-2">Traducciones</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <p className="text-4xl font-bold text-purple-600">{stats.translators}</p>
            <p className="text-gray-500 mt-2">Traductores activos</p>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <button onClick={() => setActiveTab('activity')} className={`px-5 py-2 rounded-full font-medium ${activeTab === 'activity' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 shadow'}`}>
            Actividad
          </button>
          <button onClick={() => setActiveTab('pending')} className={`px-5 py-2 rounded-full font-medium flex items-center gap-2 ${activeTab === 'pending' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 shadow'}`}>
            Pendientes
            {pendingTranslations.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingTranslations.length}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('users')} className={`px-5 py-2 rounded-full font-medium ${activeTab === 'users' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 shadow'}`}>
            Usuarios
          </button>
        </div>

        {loading ? (
          <p className="text-center text-gray-500">Cargando...</p>
        ) : activeTab === 'activity' ? (
          <div className="flex flex-col gap-4">
            {translatorActivity.length === 0 ? (
              <p className="text-center text-gray-500">No hay actividad aún.</p>
            ) : translatorActivity.map((translator) => (
              <div key={translator.uid} className="bg-white rounded-xl shadow p-5">
                <h3 className="text-lg font-bold">{translator.email}</h3>
                <p className="text-sm text-gray-500">{translator.totalTranslations} páginas traducidas</p>
                <p className="text-xs text-gray-400 mt-1">
                  Última actividad: {new Date(translator.lastActivity).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {Object.values(translator.books).map((book) => (
                    <span key={book.bookTitle + book.langName} className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full">
                      {book.bookTitle} · {book.langName} · {book.pages} pág.
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'pending' ? (
          <div className="flex flex-col gap-4">
            {pendingTranslations.length === 0 ? (
              <p className="text-center text-gray-500">No hay traducciones pendientes.</p>
            ) : pendingTranslations.map((t) => (
              <div key={t.id} className="bg-white rounded-xl shadow p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold">{t.pages?.books?.title}</h3>
                    <p className="text-sm text-gray-500">Página {t.pages?.page_number} · {t.languages?.name} · {t.email}</p>
                    <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => verifyTranslation(t.id)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600">✅ Verificar</button>
                    <button onClick={() => rejectTranslation(t.id)} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600">❌ Rechazar</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Texto original</p>
                    <p className="text-sm text-gray-700">{t.pages?.content}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <p className="text-xs text-yellow-600 mb-1">Traducción pendiente</p>
                    <p className="text-sm text-gray-700">{t.translated_content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {users.length === 0 ? (
              <p className="text-center text-gray-500">No hay usuarios.</p>
            ) : users.map((u) => (
              <div key={u.id} className="bg-white rounded-xl shadow p-5 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">{u.email}</h3>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${roleColors[u.role]}`}>{u.role}</span>
                </div>
                <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} className="border p-2 rounded-lg text-sm">
                  <option value="reader">Reader</option>
                  <option value="translator">Translator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}