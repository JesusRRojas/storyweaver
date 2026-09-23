'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'

export default function AdminPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('')
  const [author, setAuthor] = useState('')
  const [pages, setPages] = useState([{ page_number: 1, content: '', image: null, preview: null }])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const addPage = () => {
    setPages([...pages, { page_number: pages.length + 1, content: '', image: null, preview: null }])
  }

  const removePage = (index) => {
    const updated = pages.filter((_, i) => i !== index)
      .map((p, i) => ({ ...p, page_number: i + 1 }))
    setPages(updated)
  }

  const updatePage = (index, field, value) => {
    const updated = [...pages]
    updated[index][field] = value
    setPages(updated)
  }

  const handleImage = (index, file) => {
    if (!file) return
    const updated = [...pages]
    updated[index].image = file
    updated[index].preview = URL.createObjectURL(file)
    setPages(updated)
  }

  const handleSubmit = async () => {
    if (!title) return setMessage('El título es obligatorio')
    if (pages.some(p => !p.content)) return setMessage('Todas las páginas deben tener texto')
    setLoading(true)

    const { data: book, error: bookError } = await supabase
      .from('books')
      .insert([{ title, description, level, author, is_published: true }])
      .select()
      .single()

    if (bookError) {
      setMessage(bookError.message)
      setLoading(false)
      return
    }

    for (const page of pages) {
      let image_url = null

      if (page.image) {
        const fileName = `book-${book.id}-page-${page.page_number}-${Date.now()}.png`
        const { error: uploadError } = await supabase.storage
          .from('book-images')
          .upload(fileName, page.image)

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('book-images')
            .getPublicUrl(fileName)
          image_url = urlData.publicUrl
        }
      }

      await supabase.from('pages').insert([{
        book_id: book.id,
        page_number: page.page_number,
        content: page.content,
        image_url
      }])
    }

    setMessage('¡Libro creado exitosamente!')
    setTitle('')
    setDescription('')
    setLevel('')
    setAuthor('')
    setPages([{ page_number: 1, content: '', image: null, preview: null }])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">StoryWeaver — Agregar libro</h1>
        <Link href="/" className="text-blue-500 hover:underline">← Volver al inicio</Link>
      </nav>

      <main className="max-w-3xl mx-auto p-8">
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Información del libro</h2>
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Título del libro *"
              className="border p-3 rounded-lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="Descripción"
              className="border p-3 rounded-lg h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nivel (fácil, intermedio, avanzado)"
                className="border p-3 rounded-lg"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              />
              <input
                type="text"
                placeholder="Autor"
                className="border p-3 rounded-lg"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">Páginas del libro</h2>
        {pages.map((page, index) => (
          <div key={index} className="bg-white rounded-xl shadow p-6 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Página {page.page_number}</h3>
              {pages.length > 1 && (
                <button
                  onClick={() => removePage(index)}
                  className="text-red-500 text-sm hover:underline"
                >
                  Eliminar página
                </button>
              )}
            </div>
            <div className="flex flex-col gap-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                {page.preview ? (
                  <div>
                    <img src={page.preview} alt="preview" className="max-h-48 mx-auto rounded" />
                    <button
                      onClick={() => { updatePage(index, 'preview', null); updatePage(index, 'image', null) }}
                      className="mt-2 text-red-500 text-sm hover:underline"
                    >
                      Cambiar imagen
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <p className="text-gray-400 mb-2">📷 Haz clic para subir imagen</p>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImage(index, e.target.files[0])}
                    />
                  </label>
                )}
              </div>
              <textarea
                placeholder="Texto de esta página *"
                className="border p-3 rounded-lg h-24"
                value={page.content}
                onChange={(e) => updatePage(index, 'content', e.target.value)}
              />
            </div>
          </div>
        ))}

        <button
          onClick={addPage}
          className="w-full border-2 border-dashed border-blue-300 text-blue-500 py-3 rounded-xl hover:bg-blue-50 mb-6"
        >
          + Agregar página
        </button>

        {message && (
          <p className={`text-center mb-4 font-medium ${message.includes('exitosamente') ? 'text-green-600' : 'text-red-500'}`}>
            {message}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-500 text-white py-4 rounded-xl text-lg font-bold hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Guardando...' : '💾 Guardar libro completo'}
        </button>
      </main>
    </div>
  )
}