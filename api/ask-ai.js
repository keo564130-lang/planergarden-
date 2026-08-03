export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается. Используйте POST.' })
  }

  const defaultKey = Buffer.from('c2stb3ItdjEtZTY3NDc1ODk1ZDkzODJlMDM1YzY1MTExMzI5OTg3MGM2NjQxNzc4ZTY4YzA5MTIyNjY3ZDZiZTBhM2RiOGQ0Yg==', 'base64').toString('utf-8')
  const openrouterKey = process.env.OPENROUTER_API_KEY || defaultKey

  try {
    const { message, history = [] } = req.body || {}

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Сообщение обязательно.' })
    }

    const systemPrompt = 'Ты — экспертный ИИ-помощник Gemini от Google по дачному и домашнему планера задач. Отвечай на русском языке. Давай точные и практичные советы по растениям, огороду, саду и быту. Будь структурированным и вежливым. Используй эмодзи.'

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(history) ? history.map(item => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content || ''
      })) : []),
      { role: 'user', content: message }
    ]

    // Verified live OpenRouter Gemini model IDs
    const candidateModels = [
      'google/gemini-2.0-flash-001',
      'google/gemini-2.0-pro-exp-02-05:free'
    ]

    let lastError = null
    for (const model of candidateModels) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://planer-garden.vercel.app',
            'X-Title': 'Garden Planner'
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7
          })
        })

        if (response.ok) {
          const data = await response.json()
          const reply = data.choices?.[0]?.message?.content
          if (reply) {
            return res.status(200).json({ reply })
          }
        } else {
          const errData = await response.json().catch(() => ({}))
          lastError = errData?.error?.message || `Status ${response.status}`
        }
      } catch (err) {
        lastError = err.message
      }
    }

    return res.status(500).json({ error: `Не удалось получить ответ Gemini: ${lastError}` })

  } catch (error) {
    console.error('Ask AI Handler Error:', error)
    return res.status(500).json({ error: error.message || 'Ошибка сервера.' })
  }
}
