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
    const { message, history = [], image, audio } = req.body || {}

    if (!message && !image && !audio) {
      return res.status(400).json({ error: 'Сообщение обязательно.' })
    }

    const systemPrompt = `Твоя роль и характер:
Ты — доброжелательный, вежливый и жизнерадостный ИИ-помощник. Твоя главная цель — максимально эффективно помогать пользователю, сохраняя теплый и позитивный настрой.

📋 Основные правила общения:
1. Четкость и краткость: Отвечай структурировано, по существу и без «воды». Используй списки, выделения (**жирный текст**) и абзацы.
2. Тон и настроение: Будь вежливым, добрым и веселым. Используй легкий юмор и эмодзи где уместно.
3. Готовность помочь: Всегда стремись решить задачу с первого раза.
4. Уточнение деталей (КРИТИЧЕСКИ ВАЖНО): Если запрос нечеткий — не додумывай. Вежливо задай уточняющий вопрос.`

    // Build user content (text, image, or audio)
    let userContent
    if (audio && typeof audio === 'string' && audio.startsWith('data:audio/')) {
      // Voice message: send audio to Gemini for transcription + response
      const textPart = message && message.trim() 
        ? `Пользователь отправил голосовое сообщение вместе с текстом: "${message}". Сначала расшифруй аудио, потом ответь.`
        : 'Пользователь отправил голосовое сообщение. Расшифруй что он говорит и ответь на его вопрос или сообщение. В начале ответа напиши что он сказал в формате: **Вы сказали:** "текст"\n\nЗатем дай свой ответ.'
      userContent = [
        { type: 'text', text: textPart },
        { type: 'image_url', image_url: { url: audio } }
      ]
    } else if (image && typeof image === 'string' && image.startsWith('data:image/')) {
      userContent = [
        { type: 'text', text: message || 'Что на этом изображении?' },
        { type: 'image_url', image_url: { url: image } }
      ]
    } else {
      userContent = message
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(history) ? history.map(item => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content || ''
      })) : []),
      { role: 'user', content: userContent }
    ]

    const candidateModels = [
      'google/gemini-3.6-flash',
      'google/gemini-3.5-flash'
    ]

    let lastError = null
    let lastErrorCode = null

    const tokenOptions = [800, 400]

    for (const apiKey of apiKeys) {
      for (const model of candidateModels) {
        for (const maxTokens of tokenOptions) {
          try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://planer-garden.vercel.app',
                'X-Title': 'Garden Planner'
              },
              body: JSON.stringify({
                model,
                messages,
                temperature: 0.7,
                max_tokens: maxTokens
              })
            })

            if (response.ok) {
              const data = await response.json()
              const msgObj = data.choices?.[0]?.message
              const reply = msgObj?.content || msgObj?.reasoning
              if (reply && typeof reply === 'string') {
                const result = { reply: reply.trim() }
                // Extract transcription for voice messages
                if (audio) {
                  const match = reply.match(/\*\*Вы сказали:\*\*\s*[«""]?(.+?)[»""]?\n/i)
                  if (match) result.transcription = match[1].trim()
                }
                return res.status(200).json(result)
              }
            } else {
              const errData = await response.json().catch(() => ({}))
              const errMsg = errData?.error?.message || `Status ${response.status}`
              lastError = errMsg
              
              // Detect credit/billing errors
              if (errMsg.includes('credits') || errMsg.includes('afford') || response.status === 402) {
                lastErrorCode = 'NO_CREDITS'
                continue // try with fewer tokens or next key
              }
              lastErrorCode = 'API_ERROR'
            }
          } catch (err) {
            lastError = err.message
            lastErrorCode = 'NETWORK_ERROR'
          }
        }
      }
    }

    return res.status(500).json({ 
      error: lastErrorCode === 'NO_CREDITS' 
        ? '⚠️ Закончились кредиты OpenRouter API. Пополните баланс на openrouter.ai/settings/credits'
        : `Ошибка API: ${lastError}`,
      code: lastErrorCode 
    })
  } catch (error) {
    console.error('Ask AI Error:', error)
    return res.status(500).json({ error: error.message || 'Ошибка сервера.' })
  }
}
