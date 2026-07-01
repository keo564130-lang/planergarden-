import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// Configure VAPID keys if set in environment
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:keo564130@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })

  try {
    const now = new Date()

    // 1. Fetch active push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')

    if (subError) throw subError
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ message: 'No subscriptions found' })
    }

    // 2. Fetch all uncompleted tasks with times
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('completed', false)
      .not('time', 'is', null)

    if (tasksError) throw tasksError

    // 2.5 Fetch all day tables with times
    const { data: dayTables, error: tablesError } = await supabase
      .from('day_tables')
      .select('*')
      .not('time', 'is', null)

    if (tablesError) throw tablesError

    const hasTasks = tasks && tasks.length > 0
    const hasTables = dayTables && dayTables.length > 0

    if (!hasTasks && !hasTables) {
      return res.status(200).json({ message: 'No tasks or tables scheduled with times' })
    }

    let notificationsSent = 0

    // 3. Match tasks and tables for each subscription based on their timezone
    for (const sub of subscriptions) {
      try {
        // Calculate the current hour and minute in the user's local timezone
        const localTimeStr = now.toLocaleTimeString('en-US', {
          timeZone: sub.timezone,
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        })
        const [localHrs, localMins] = localTimeStr.split(':').map(Number)

        // Calculate the current date in the user's local timezone (formatted as YYYY-MM-DD)
        const localDateStr = now.toLocaleDateString('en-CA', {
          timeZone: sub.timezone
        })

        // A. Match tasks
        if (hasTasks) {
          const userTasks = tasks.filter(t => t.user_id === sub.user_id && t.date === localDateStr)

          for (const task of userTasks) {
            const [taskHrs, taskMins] = task.time.split(':').map(Number)

            if (localHrs === taskHrs && localMins === taskMins) {
              const payload = JSON.stringify({
                title: 'Дачный планер 🌸',
                options: {
                  body: `Пора выполнять задачу: "${task.title}"`,
                  tag: `task-reminder-${task.id}`,
                  renotify: true
                }
              })
              await webpush.sendNotification(sub.subscription, payload)
              notificationsSent++
            }
          }
        }

        // B. Match tables
        if (hasTables) {
          const userTables = dayTables.filter(t => t.user_id === sub.user_id && t.date === localDateStr)

          for (const table of userTables) {
            const [tableHrs, tableMins] = table.time.split(':').map(Number)

            if (localHrs === tableHrs && localMins === tableMins) {
              const payload = JSON.stringify({
                title: 'Дачный планер 🌸',
                options: {
                  body: `Пора заполнять таблицу: "${table.name || 'Без названия'}"`,
                  tag: `table-reminder-${table.id}`,
                  renotify: true
                }
              })
              await webpush.sendNotification(sub.subscription, payload)
              notificationsSent++
            }
          }
        }
      } catch (subErr) {
        console.error(`Failed to send notification to subscription ID ${sub.id}:`, subErr.message)
        // If subscription has expired or is invalid (Status 410 or 404), delete it
        if (subErr.statusCode === 410 || subErr.statusCode === 404) {
          console.log(`Removing expired subscription ID ${sub.id}`)
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

    return res.status(200).json({ message: `Done. Sent ${notificationsSent} notifications.` })
  } catch (err) {
    console.error('Cron task failed:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
