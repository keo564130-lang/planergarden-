export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const { message, history = [], image, audio } = req.body || {}

    if (!message && !image && !audio) {
      return res.status(400).json({ error: 'Сообщение обязательно.' })
    }

    const systemPrompt = `🤖 Кто ты:
Ты — Gemini 3.6 Flash, языковая модель от Google DeepMind. Ты работаешь в приложении «Дачный Планер» как встроенный ИИ-помощник. Твоя дата знаний — начало 2026 года.

🧠 Твоя линейка моделей (Google Gemini):
- Gemini 1.0 (2023) — первая модель, Ultra/Pro/Nano
- Gemini 1.5 (2024) — Flash и Pro, контекст до 1M токенов  
- Gemini 2.0 (2024-2025) — Flash, Pro, экспериментальные модели
- Gemini 2.5 (2025) — Flash и Pro с улучшенным reasoning
- Gemini 3.5 (2026) — Flash и Pro, значительный скачок качества
- Gemini 3.6 (2026) — Flash и Pro, текущая топовая версия (ЭТО ТЫ!)

🌍 Актуальный ландшафт ИИ-моделей (на 2026):
- **Google**: Gemini 3.6 Flash/Pro — твоя линейка
- **Anthropic (Claude)**: Claude Fable 5 — считается лучшей моделью в мире на данный момент. До этого были Claude 3 Opus, 3.5/3.6 Sonnet, Claude 4 Sonnet/Opus
- **OpenAI (GPT)**: GPT-4o, o1, o3, GPT-5 — сильные модели для разных задач
- **Meta (Llama)**: Llama 3, 3.1, 3.3 — мощные open-source модели
- **xAI (Grok)**: Grok-2, Grok-3 — модели Илона Маска

⚠️ ВАЖНО: Не выдумывай факты о моделях. Если не знаешь точную информацию — честно скажи.

📋 Правила общения:
1. Четкость и краткость: Отвечай структурировано, по существу. Используй списки, **жирный текст** и абзацы.
2. Тон: Будь вежливым, добрым и веселым. Используй юмор и эмодзи где уместно.
3. Помогай с первого раза. Если запрос нечеткий — вежливо уточни.
4. Отвечай на русском языке.`

    // ============================================
    // Strategy 1: Direct Google Gemini API (FREE!)
    // ============================================
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey) {
      try {
        // Build Gemini native format
        const contents = []
        
        // Add history
        if (Array.isArray(history)) {
          for (const item of history.slice(-6)) {
            contents.push({
              role: item.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: item.content || '' }]
            })
          }
        }

        // Build user parts
        const userParts = []
        if (audio && typeof audio === 'string' && audio.startsWith('data:audio/')) {
          const textPart = message && message.trim()
            ? `Пользователь отправил голосовое сообщение вместе с текстом: "${message}". Сначала расшифруй аудио, потом ответь.`
            : 'Пользователь отправил голосовое сообщение. Расшифруй что он говорит и ответь на его вопрос или сообщение. В начале ответа напиши что он сказал в формате: **Вы сказали:** "текст"\n\nЗатем дай свой ответ.'
          userParts.push({ text: textPart })
          const [meta, data] = audio.split(',')
          const mimeType = meta.match(/data:(.*?);/)?.[1] || 'audio/webm'
          userParts.push({ inlineData: { mimeType, data } })
        } else if (image && typeof image === 'string' && image.startsWith('data:image/')) {
          userParts.push({ text: message || 'Что на этом изображении?' })
          const [meta, data] = image.split(',')
          const mimeType = meta.match(/data:(.*?);/)?.[1] || 'image/jpeg'
          userParts.push({ inlineData: { mimeType, data } })
        } else {
          userParts.push({ text: message })
        }

        contents.push({ role: 'user', parts: userParts })

        const response = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
            method: 'POST',
            headers: {
              'x-goog-api-key': geminiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents,
              systemInstruction: { parts: [{ text: systemPrompt }] },
              generationConfig: { maxOutputTokens: 2000, temperature: 0.7 }
            })
          }
        )

        if (response.ok) {
          const data = await response.json()
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
          if (reply && typeof reply === 'string') {
            const result = { reply: reply.trim() }
            if (audio) {
              const match = reply.match(/\*\*Вы сказали:\*\*\s*[«""]?(.+?)[»""]?\n/i)
              if (match) result.transcription = match[1].trim()
            }
            return res.status(200).json(result)
          }
        }
      } catch (err) {
        console.error('Gemini direct error:', err.message)
      }
    }

    // ============================================
    // Strategy 2: OpenRouter fallback (paid)
    // ============================================
    const key1 = Buffer.from('c2stb3ItdjEtZTY3NDc1ODk1ZDkzODJlMDM1YzY1MTExMzI5OTg3MGM2NjQxNzc4ZTY4YzA5MTIyNjY3ZDZiZTBhM2RiOGQ0Yg==', 'base64').toString('utf-8')
    const key2 = Buffer.from('c2stb3ItdjEtYWNkZjAyZmViYWRhOWQyNDUxYjI2ODY0YWVjNzRiMzkwYzA4YjMzNDUwNjBlYTc2NzZkNGI1YjlhYWY3MDlhOA==', 'base64').toString('utf-8')
    const apiKeys = [process.env.OPENROUTER_API_KEY, key1, key2].filter(Boolean)

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(history) ? history.slice(-6).map(item => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content || ''
      })) : []),
      { role: 'user', content: message }
    ]

    const candidateModels = ['google/gemini-3.6-flash', 'google/gemini-3.5-flash']
    let lastError = 'Все модели недоступны'

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
            body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1500 })
          })

          if (response.ok) {
            const data = await response.json()
            const reply = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning
            if (reply && typeof reply === 'string') {
              const result = { reply: reply.trim() }
              if (audio) {
                const match = reply.match(/\*\*Вы сказали:\*\*\s*[«""]?(.+?)[»""]?\n/i)
                if (match) result.transcription = match[1].trim()
              }
              return res.status(200).json(result)
            }
          } else {
            const errData = await response.json().catch(() => ({}))
            lastError = errData?.error?.message || `Status ${response.status}`
          }
        } catch (err) {
          lastError = err.message
        }
      }
    }

    return res.status(500).json({ error: `Ошибка API: ${lastError}` })
  } catch (error) {
    console.error('Ask AI Error:', error)
    return res.status(500).json({ error: error.message || 'Ошибка сервера.' })
  }
}