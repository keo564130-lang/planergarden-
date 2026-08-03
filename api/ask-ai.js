export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Allow only POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается. Используйте POST.' })
  }

  const geminiKey = process.env.GEMINI_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY

  if (!geminiKey && !openrouterKey) {
    return res.status(500).json({
      error: 'API ключ не настроен. Добавьте GEMINI_API_KEY или OPENROUTER_API_KEY в переменные окружения Vercel.'
    })
  }

  try {
    const { message, history = [] } = req.body || {}

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Сообщение обязательно и должно быть строкой.' })
    }

    const systemPrompt = 'Ты — дружелюбный ИИ-помощник для дачного и домашнего планера задач. Отвечай на русском языке. Помогай советами по уходу за растениями, огородом, садом и домом. Будь кратким и полезным. Используй эмодзи для наглядности.'

    // If OpenRouter key is set, use OpenRouter API
    if (openrouterKey) {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...(Array.isArray(history) ? history.map(item => ({
          role: item.role === 'assistant' ? 'assistant' : 'user',
          content: item.content || ''
        })) : []),
        { role: 'user', content: message }
      ]

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://planer-garden.vercel.app',
          'X-Title': 'Garden Planner'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp:free',
          messages
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData?.error?.message || `Ошибка HTTP ${response.status}`
        return res.status(response.status).json({ error: `OpenRouter error: ${errorMessage}` })
      }

      const data = await response.json()
      const reply = data.choices?.[0]?.message?.content
      if (!reply) return res.status(500).json({ error: 'ИИ вернул пустой ответ.' })
      return res.status(200).json({ reply })
    }

    // Direct Gemini API
    const contents = [
      ...(Array.isArray(history)
        ? history.map(item => ({
            role: item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: item.content || '' }]
          }))
        : []),
      { role: 'user', parts: [{ text: message }] }
    ]

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData?.error?.message || `Ошибка HTTP ${response.status}`
      return res.status(response.status).json({ error: `Gemini error: ${errorMessage}` })
    }

    const data = await response.json()
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!reply) return res.status(500).json({ error: 'ИИ вернул пустой ответ.' })
    return res.status(200).json({ reply })

  } catch (error) {
    console.error('Ask AI Handler Error:', error)
    return res.status(500).json({ error: error.message || 'Произошла непредвиденная ошибка на сервере.' })
  }
}
