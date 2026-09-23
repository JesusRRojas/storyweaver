'use client'
import { useState, useEffect, use } from 'react'
import { supabase } from '../../../lib/supabase'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function BookPage({ params }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const langFromUrl = searchParams.get('lang')
  const [book, setBook] = useState(null)
  const [pages, setPages] = useState([])
  const [currentPage, setCurrentPage] = useState(0)
  const [languages, setLanguages] = useState([])
  const [availableLanguages, setAvailableLanguages] = useState([])
  const [selectedLanguage, setSelectedLanguage] = useState(langFromUrl || 'original')
  const [translations, setTranslations] = useState({})
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [message, setMessage] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      const { data: userData } = await supabase.auth.getUser()
      setUser(userData.user)

      if (userData.user) {
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', userData.user.id).single()
        setRole(profile?.role || 'reader')
      }

      const { data: bookData } = await supabase
        .from('books').select('*').eq('id', id).single()
      setBook(bookData)

      const { data: pagesData } = await supabase
        .from('pages').select('*').eq('book_id', id).order('page_number')
      setPages(pagesData || [])

      const { data: langsData } = await supabase
        .from('languages').select('*')
      setLanguages(langsData || [])

      // Obtener idiomas que ya tienen traducciones completadas
      const { data: transData } = await supabase
        .from('translations')
        .select('language_id, languages(id, name)')
        .eq('status', 'completed')
        .in('page_id', (await supabase.from('pages').select('id').eq('book_id', id)).data?.map(p => p.id) || [])

      const uniqueLangs = [...new Map(
        transData?.map(t => [t.language_id, t.languages]) || []
      ).values()]
      setAvailableLanguages(uniqueLangs)

      if (langFromUrl) {
        loadTranslations(langFromUrl, pagesData)
      }
    }
    loadData()
  }, [id])

  const loadTranslations = async (langId, pagesData) => {
    if (langId === 'original') return
    const pageList = pagesData || pages
    const pageIds = pageList.map(p => p.id)
    const { data } = await supabase
      .from('translations')
      .select('*')
      .in('page_id', pageIds)
      .eq('language_id', langId)
      .eq('status', 'completed')
    const transMap = {}
    data?.forEach(t => { transMap[t.page_id] = t.translated_content })
    setTranslations(transMap)
  }

  const loadMyTranslations = async (langId) => {
    if (!user || langId === 'original') return
    const pageIds = pages.map(p => p.id)
    const { data } = await supabase
      .from('translations')
      .select('*')
      .in('page_id', pageIds)
      .eq('language_id', langId)
      .eq('translated_by', user.id)
    const transMap = {}
    data?.forEach(t => { transMap[t.page_id] = t.translated_content })
    setTranslations(transMap)
  }

  const handleLanguageChange = async (langId) => {
    setSelectedLanguage(langId)
    setIsEditing(false)
    if (langId === 'original') {
      setTranslations({})
    } else {
      await loadTranslations(langId, pages)
    }
  }

  const saveTranslation = async (pageId, content) => {
    if (!content) return
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const status = profile?.role === 'translator' || profile?.role === 'admin' ? 'completed' : 'pending'

    const { error } = await supabase.from('translations').upsert({
      page_id: pageId,
      language_id: parseInt(selectedLanguage),
      translated_content: content,
      translated_by: user.id,
      status
    }, { onConflict: 'page_id,language_id' })

    if (error) setMessage(error.message)
    else {
      setMessage('¡Guardado!')
      setTimeout(() => setMessage(''), 2000)
    }
  }

  const downloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    let y = 20

    doc.setFontSize(20)
    doc.text(book.title, 105, y, { align: 'center' })
    y += 20

    for (const page of pages) {
      if (y > 250) { doc.addPage(); y = 20 }
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = page.image_url
        })
        const canvas = document.createElement('canvas')
        const scale = Math.min(800 / img.width, 600 / img.height)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        const imgData = canvas.toDataURL('image/jpeg', 0.6)
        const maxW = 170, maxH = 100
        const aspectRatio = img.width / img.height
        let drawW, drawH
        if (aspectRatio > maxW / maxH) { drawW = maxW; drawH = maxW / aspectRatio }
        else { drawH = maxH; drawW = maxH * aspectRatio }
        const offsetX = 20 + (maxW - drawW) / 2
        const offsetY = y + (maxH - drawH) / 2
        doc.addImage(imgData, 'JPEG', offsetX, offsetY, drawW, drawH)
        y += maxH + 5
      } catch { y += 5 }

      const text = selectedLanguage !== 'original' ? (translations[page.id] || page.content) : page.content
      doc.setFontSize(12)
      const lines = doc.splitTextToSize(text, 170)
      doc.text(lines, 20, y)
      y += lines.length * 7 + 15
    }
    doc.save(`${book.title}.pdf`)
  }

  if (!book) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>

  const page = pages[currentPage]
  const pageText = selectedLanguage === 'original'
    ? page?.content
    : (translations[page?.id] || page?.content)

  return (
    <div className="min-h-screen bg-amber-50">
      <nav className="bg-white shadow p-4 flex justify-between items-center">
        <Link href="/" className="text-blue-500 hover:underline">← Volver</Link>
        <h1 className="text-xl font-bold">{book.title}</h1>
        <span className="text-gray-500 text-sm">{currentPage + 1} / {pages.length}</span>
      </nav>

      {/* Selector de idioma */}
      <div className="max-w-2xl mx-auto px-6 pt-4 flex flex-wrap gap-2">
        <button
          onClick={() => handleLanguageChange('original')}
          className={`px-4 py-2 rounded-full text-sm font-medium ${selectedLanguage === 'original' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 shadow'}`}
        >
          Original
        </button>
        {availableLanguages.map(lang => (
          <button
            key={lang.id}
            onClick={() => handleLanguageChange(lang.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium ${selectedLanguage == lang.id ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 shadow'}`}
          >
            {lang.name}
          </button>
        ))}
        {user && selectedLanguage !== 'original' && (
          <button
            onClick={() => { setIsEditing(!isEditing); loadMyTranslations(selectedLanguage) }}
            className={`px-4 py-2 rounded-full text-sm font-medium ${isEditing ? 'bg-blue-500 text-white' : 'bg-white text-blue-500 shadow'}`}
          >
            ✏️ {isEditing ? 'Ver traducción' : 'Traducir'}
          </button>
        )}
        {user && selectedLanguage === 'original' && (
          <select
            className="px-4 py-2 rounded-full text-sm font-medium bg-white text-blue-500 shadow"
            defaultValue=""
            onChange={(e) => { if (e.target.value) { setSelectedLanguage(e.target.value); setIsEditing(true); loadMyTranslations(e.target.value) } }}
          >
            <option value="" disabled>✏️ Traducir a...</option>
            {languages.map(lang => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
        )}
      </div>

      {page && (
        <main className="max-w-2xl mx-auto p-6">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {page.image_url && (
              <img
                src={page.image_url}
                alt={`Página ${page.page_number}`}
                className="w-full object-contain bg-gray-50"
                style={{ maxHeight: '400px' }}
              />
            )}

            <div className="p-6 flex flex-col gap-4">
              <div className="border-4 border-gray-800 rounded-2xl p-4">
                <p className="text-xs text-gray-400 mb-1">
                  {selectedLanguage === 'original' ? 'Texto original' : `Traducción · ${availableLanguages.find(l => l.id == selectedLanguage)?.name || ''}`}
                </p>
                <p className="text-base text-gray-800 leading-relaxed">{pageText}</p>
              </div>

              {isEditing && user && (
                <div className="border-4 border-blue-400 rounded-2xl p-4">
                  <p className="text-xs text-blue-400 mb-1">Tu traducción</p>
                  <textarea
                    className="w-full outline-none text-base text-gray-800 resize-none"
                    rows={3}
                    placeholder="Escribe tu traducción aquí..."
                    value={translations[page.id] || ''}
                    onChange={(e) => setTranslations({ ...translations, [page.id]: e.target.value })}
                  />
                  <button
                    onClick={() => saveTranslation(page.id, translations[page.id])}
                    className="mt-2 bg-blue-500 text-white px-4 py-1 rounded-lg text-sm hover:bg-blue-600"
                  >
                    Guardar
                  </button>
                  {message && <span className="ml-3 text-green-600 text-sm">{message}</span>}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mt-6">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="bg-gray-800 text-white px-6 py-3 rounded-full disabled:opacity-30 hover:bg-gray-700"
            >
              ← Anterior
            </button>
            <div className="flex gap-2">
              {pages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`w-3 h-3 rounded-full ${i === currentPage ? 'bg-gray-800' : 'bg-gray-300'}`}
                />
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === pages.length - 1}
              className="bg-gray-800 text-white px-6 py-3 rounded-full disabled:opacity-30 hover:bg-gray-700"
            >
              Siguiente →
            </button>
          </div>

          {currentPage === pages.length - 1 && (
            <button
              onClick={downloadPDF}
              className="w-full mt-6 bg-green-600 text-white py-3 rounded-full hover:bg-green-700 text-lg font-bold"
            >
              ⬇️ Descargar PDF
            </button>
          )}
        </main>
      )}
    </div>
  )
}