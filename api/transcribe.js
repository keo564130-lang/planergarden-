export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const key1 = Buffer.from('c2stb3ItdjEtZTY3NDc1ODk1ZDkzODJlMDM1YzY1MTExMzI5OTg3MGM2NjQxNzc4ZTY4YzA5MTIyNjY3ZDZiZTBhM2RiOGQ0Yg==', 'base64').toString('utf-8')
  const key2 = Buffer.from('c2stb3ItdjEtYWNkZjAyZmViYWRhOWQyNDUxYjI2ODY0YWVjNzRiMzkwYzA4YjMzNDUwNjBlYTc2NzZkNGI1YjlhYWY3MDlhOA==', 'base64').toString('utf-8')

  const apiKeys = [process.env.OPENROUTER_API_KEY, key1, key2].filter(Boolean)

  try {
    const { audio } = req.body || {}
    if (!audio || typeof audio !== 'string' || !audio.startsWith('data:audio/')) {
      return res.status(400).json({ error: 'Аудио обязательно.' })
    }

    const messages = [
      { role: 'system', content: 'Ты — транскрибатор. Твоя единственная задача — расшифровать аудио в текст. Верни ТОЛЬКО текст который произнёс человек, без кавычек, без пояснений, без ничего лишнего. Если ничего не слышно — верни пустую строку.' },
      { role: 'user', content: [
        { type: 'text', text: 'Расшифруй это аудио в текст. Верни ТОЛЬКО произнесённый текст, ничего больше.' },
        { type: 'image_url', image_url: { url: audio } }
      ]}
    ]

    const candidateModels = [
      'google/gemini-2.5-flash:free',
      'google/gemini-2.0-flash-exp:free',
      'google/gemini-3.6-flash',
      'google/gemini-3.5-flash'
    ]

    let lastError = null

    for (const apiKey of apiKeys) {
      for (const model of candidateModels) {
        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://planer-garden.vercel.app',
              'X-Title': 'Garden Planner'
            },
            body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 500 })
          })

          if (response.ok) {
            const data = await response.json()
            const msgObj = data.choices?.[0]?.message
            const text = msgObj?.content || msgObj?.reasoning || ''
            return res.status(200).json({ text: text.trim() })
          } else {
            const errData = await response.json().catch(() => ({}))
            lastError = errData?.error?.message || `Status ${response.status}`
          }
        } catch (err) {
          lastError = err.message
        }
      }
    }

    return res.status(500).json({ error: `Ошибка: ${lastError}` })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Ошибка сервера.' })
  }
}
