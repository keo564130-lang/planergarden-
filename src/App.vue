<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from './supabase'
import NestedCalendar from './components/NestedCalendar.vue'
import TaskList from './components/TaskList.vue'
import DayTablesView from './components/DayTablesView.vue'
import TimePickerModal from './components/TimePickerModal.vue'
import TableSelectorModal from './components/TableSelectorModal.vue'
import AiChat from './components/AiChat.vue'
import RecipesView from './components/RecipesView.vue'
import AppSettingsModal from './components/AppSettingsModal.vue'
import UpdateModal from './components/UpdateModal.vue'
import { triggerHaptic } from './utils/audio.js'

// App version (increment on every change)
const APP_VERSION = '2.6.02'
const MAJOR_RELEASE_VERSION = '2.6.00'
const showUpdateModal = ref(false)

// Base configurations
const year = ref(2026)
const currentMonth = ref(null)
const currentDay = ref(null)
const viewLevel = ref('calendar') // 'calendar' or 'tasks'
const todayObj = new Date()
const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`
const selectedDate = ref(todayStr)

// App Pro Settings state
const showAppSettings = ref(false)
const defaultSettings = {
  tabOrder: ['calendar', 'recipes', 'ai', 'settings'],
  startTab: 'calendar',
  showTabLabels: true,
  hapticEnabled: true,
  autoRolloverTasks: false,
  photoQuality: 'medium',
  autoPlayVideo: true,
  keepScreenOn: false,
  aiTone: 'friendly'
}
const savedSettings = localStorage.getItem('garden_planner_app_settings')
const appSettings = ref(savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings)

// Bottom navigation
const activeTab = ref(appSettings.value.startTab || 'calendar') // 'calendar', 'recipes', 'ai', 'settings'

// Day sub-navigation (Tasks vs Tables)
const activeDayTab = ref('tasks')

// Modal states
const showTimePicker = ref(false)
const timePickerCallback = ref(null)
const showTableSelector = ref(false)

// Dark mode state
const isDarkMode = ref(false)

// Databases (local reactive cache)
const tasks = ref([])
const dayTables = ref([])

// AI Chat state
const aiChats = ref([])
const aiMessages = ref([])
const allAiMessages = ref({}) // { [chatId]: Array<Message> }
const currentChatId = ref(null)
const isAiTyping = ref(false)

// Recipe state
const recipeCategories = ref([])
const recipes = ref([])
const recipeNotes = ref([])
const shareData = ref(null)

// Auth state
const currentUser = ref(null)
const isLoadingCloud = ref(false)
const authUsername = ref('')
const authPassword = ref('')
const authMode = ref('login') // 'login' or 'register'
const authError = ref('')
const authLoading = ref(false)
const isRealAccount = computed(() => {
  if (!currentUser.value) return false
  const email = currentUser.value.email || ''
  return email && email.includes('@') && !currentUser.value.is_anonymous
})

// Notification state
const notifiedTasks = ref(new Set())
const notificationStatus = ref('загрузка')
const isKeyboardOpen = ref(false)

const updateNotificationStatus = () => {
  if (!('Notification' in window)) {
    notificationStatus.value = 'не поддерживается'
  } else {
    const status = Notification.permission
    if (status === 'default') {
      notificationStatus.value = 'ожидание'
    } else if (status === 'granted') {
      notificationStatus.value = 'работает ✓'
    } else if (status === 'denied') {
      notificationStatus.value = 'заблокировано'
    } else {
      notificationStatus.value = status
    }
  }
}

const VAPID_PUBLIC_KEY = 'BC-_wjbio3YNx9kWkXYUyG7ZodwZoII8em5Odtf21OVZ2hi1PSq0-61esqxJT8zcNVtOC1OfxEI1Pijc2s8mN7k'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

const subscribeUserToPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !currentUser.value) return
  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
    }
    const subJson = sub.toJSON()
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (supabase && currentUser.value) {
      await supabase.from('push_subscriptions').upsert({
        user_id: currentUser.value.id,
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        timezone: userTimezone
      }, { onConflict: 'endpoint' })
    }
  } catch (err) {
    console.error('Push subscription failed:', err.message)
  }
}

// Fetch cloud data with resilient two-way merge
const fetchCloudData = async () => {
  if (!supabase || !currentUser.value?.id) return
  const userId = currentUser.value.id

  // 1. Fetch & Merge tasks
  try {
    const { data: cloudTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
    
    if (!tasksError && cloudTasks) {
      if (cloudTasks.length > 0) {
        const cloudTaskMap = new Map(cloudTasks.map(t => [t.id, t]))
        const merged = tasks.value.map(localT => cloudTaskMap.get(localT.id) || localT)
        for (const cloudT of cloudTasks) {
          if (!merged.some(t => t.id === cloudT.id)) merged.push(cloudT)
        }
        tasks.value = merged
      } else if (tasks.value.length > 0) {
        // Upload local tasks to cloud
        for (const t of tasks.value) {
          await supabase.from('tasks').upsert({
            id: t.id,
            user_id: userId,
            title: t.title,
            description: t.description || '',
            date: t.date,
            time: t.time || null,
            category: t.category || 'garden',
            completed: t.completed || false
          }).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.warn('Tasks sync error:', err.message)
  }

  // 2. Fetch & Merge tables
  try {
    const { data: cloudTables, error: tablesError } = await supabase
      .from('day_tables')
      .select('*')
      .eq('user_id', userId)
    
    if (!tablesError && cloudTables) {
      const mappedCloud = cloudTables.map(t => ({
        id: t.id,
        date: t.date,
        name: t.name,
        time: t.time,
        templateId: t.template_id,
        headers: t.headers,
        rows: t.rows,
        user_id: t.user_id
      }))
      if (mappedCloud.length > 0) {
        const map = new Map(mappedCloud.map(t => [t.id, t]))
        const merged = dayTables.value.map(localT => map.get(localT.id) || localT)
        for (const ct of mappedCloud) {
          if (!merged.some(t => t.id === ct.id)) merged.push(ct)
        }
        dayTables.value = merged
      }
    }
  } catch (err) {
    console.warn('Tables sync error:', err.message)
  }

  // 3. Fetch & Merge AI chats
  try {
    const { data: cloudChats, error: chatsError } = await supabase
      .from('ai_chats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (!chatsError && cloudChats) {
      if (cloudChats.length > 0) {
        const cloudChatMap = new Map(cloudChats.map(c => [c.id, c]))
        const merged = aiChats.value.map(localC => cloudChatMap.get(localC.id) || localC)
        for (const cc of cloudChats) {
          if (!merged.some(c => c.id === cc.id)) merged.push(cc)
        }
        aiChats.value = merged
      } else if (aiChats.value.length > 0) {
        // Upload local chats
        for (const c of aiChats.value) {
          await supabase.from('ai_chats').upsert({
            id: c.id,
            user_id: userId,
            title: c.title,
            created_at: c.created_at || new Date().toISOString()
          }).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.warn('AI Chats sync error:', err.message)
  }

  // 4. Fetch & Merge recipe categories
  try {
    const { data: cloudCategories, error: catError } = await supabase
      .from('recipe_categories')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })
    
    if (!catError && cloudCategories) {
      if (cloudCategories.length > 0) {
        const cloudCatMap = new Map(cloudCategories.map(c => [c.id, c]))
        const merged = recipeCategories.value.map(localC => cloudCatMap.get(localC.id) || localC)
        for (const cc of cloudCategories) {
          if (!merged.some(c => c.id === cc.id)) merged.push(cc)
        }
        recipeCategories.value = merged
      } else if (recipeCategories.value.length > 0) {
        // Upload local categories
        for (const c of recipeCategories.value) {
          await supabase.from('recipe_categories').upsert({
            id: c.id,
            user_id: userId,
            name: c.name,
            emoji: c.emoji || '📁',
            color: c.color || 'default',
            position: c.position || 0
          }).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.warn('Recipe categories sync error:', err.message)
  }

  // 5. Fetch & Merge recipes
  try {
    const { data: cloudRecipes, error: recError } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })
    
    if (!recError && cloudRecipes) {
      if (cloudRecipes.length > 0) {
        const cloudRecMap = new Map(cloudRecipes.map(r => [r.id, r]))
        const merged = recipes.value.map(localR => cloudRecMap.get(localR.id) || localR)
        for (const cr of cloudRecipes) {
          if (!merged.some(r => r.id === cr.id)) merged.push(cr)
        }
        recipes.value = merged
      } else if (recipes.value.length > 0) {
        // Upload local recipes
        for (const r of recipes.value) {
          await supabase.from('recipes').upsert({
            id: r.id,
            user_id: userId,
            category_id: r.category_id,
            name: r.name,
            content: r.content || '',
            photos: r.photos || [],
            video_url: r.video_url || null,
            color: r.color || 'default',
            tags: r.tags || [],
            position: r.position || 0
          }).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.warn('Recipes sync error:', err.message)
  }

  // 6. Fetch & Merge recipe notes
  try {
    const { data: cloudNotes, error: notesError } = await supabase
      .from('recipe_notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    
    if (!notesError && cloudNotes) {
      if (cloudNotes.length > 0) {
        const cloudNoteMap = new Map(cloudNotes.map(n => [n.id, n]))
        const merged = recipeNotes.value.map(localN => cloudNoteMap.get(localN.id) || localN)
        for (const cn of cloudNotes) {
          if (!merged.some(n => n.id === cn.id)) merged.push(cn)
        }
        recipeNotes.value = merged
      }
    }
  } catch (err) {
    console.warn('Recipe notes sync error:', err.message)
  }
}

// Scheduler: checks tasks time matching system time
const checkNotifications = async () => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const now = new Date()
  const currentHrs = now.getHours()
  const currentMins = now.getMinutes()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  for (const task of tasks.value) {
    if (!task.time || task.completed || task.date !== todayStr) continue
    if (notifiedTasks.value.has(task.id)) continue
    const [taskHrs, taskMins] = task.time.split(':').map(Number)
    if (currentHrs === taskHrs && currentMins === taskMins) {
      const title = 'Дачный планер 🌸'
      const options = { body: `Пора выполнять задачу: "${task.title}"`, icon: '/icon-192.png', badge: '/icon-192.png', tag: `task-${task.id}`, renotify: true }
      try {
        // iOS PWA requires serviceWorker.showNotification — new Notification() is blocked
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready
          await reg.showNotification(title, options)
        } else {
          new Notification(title, options)
        }
      } catch (e) {
        console.warn('Notification failed:', e.message)
      }
      notifiedTasks.value.add(task.id)
    }
  }
}

// Load cache and setup Auth on mount
onMounted(async () => {
  // 1. Load dark mode & theme hue
  const savedDarkMode = localStorage.getItem('garden_planner_dark_mode')
  if (savedDarkMode !== null) {
    isDarkMode.value = savedDarkMode === 'true'
  } else {
    isDarkMode.value = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  updateMetaThemeColor(isDarkMode.value)

  const savedHue = localStorage.getItem('garden_planner_primary_hue')
  if (savedHue) {
    document.documentElement.style.setProperty('--primary-hue', savedHue)
  }

  // 1b. MutationObserver: automatically sync theme-color meta whenever dark-theme class changes on <html>
  const themeObserver = new MutationObserver(() => {
    const isDark = document.documentElement.classList.contains('dark-theme')
    updateMetaThemeColor(isDark)
    updateMetaBackgroundColor(isDark)
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
  
  // 2. Immediate offline cache fallback
  const savedTasks = localStorage.getItem('garden_planner_tasks')
  if (savedTasks) { try { tasks.value = JSON.parse(savedTasks) } catch (e) {} }
  const savedTables = localStorage.getItem('garden_planner_day_tables')
  if (savedTables) { try { dayTables.value = JSON.parse(savedTables) } catch (e) {} }
  const savedChats = localStorage.getItem('garden_planner_ai_chats')
  if (savedChats) { try { aiChats.value = JSON.parse(savedChats) } catch (e) {} }
  const savedAllMsgs = localStorage.getItem('garden_planner_all_ai_messages')
  const savedCategories = localStorage.getItem('garden_planner_recipe_categories')
  if (savedCategories) { try { recipeCategories.value = JSON.parse(savedCategories) } catch (e) {} }
  const savedRecipes = localStorage.getItem('garden_planner_recipes')
  if (savedRecipes) { try { recipes.value = JSON.parse(savedRecipes) } catch (e) {} }
  const savedNotes = localStorage.getItem('garden_planner_recipe_notes')
  if (savedNotes) { try { recipeNotes.value = JSON.parse(savedNotes) } catch (e) {} }
  if (savedAllMsgs) { try { allAiMessages.value = JSON.parse(savedAllMsgs) } catch (e) {} }

  // Auto-rollover overdue incomplete tasks if enabled
  if (appSettings.value && appSettings.value.autoRolloverTasks && tasks.value.length > 0) {
    const now = new Date()
    const todayFmt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    let changed = false
    tasks.value.forEach(t => {
      if (!t.completed && t.date && t.date < todayFmt) {
        t.date = todayFmt
        changed = true
      }
    })
    if (changed) safeLocalSet('garden_planner_tasks', tasks.value)
  }

  // 3. iOS/Android keyboard fix — global level
  const initialHeight = window.innerHeight
  const setAppHeight = () => {
    const vv = window.visualViewport
    const h = vv ? vv.height : window.innerHeight
    document.documentElement.style.setProperty('--app-height', h + 'px')
    // Compare against initial height (not current innerHeight which may change)
    isKeyboardOpen.value = (initialHeight - h) > 100
    // Kill any scroll the OS tries to inject
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }
  setAppHeight()

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setAppHeight)
    window.visualViewport.addEventListener('scroll', setAppHeight)
  }
  window.addEventListener('resize', setAppHeight)

  // Also reset on focusout (keyboard close)
  document.addEventListener('focusout', () => {
    setTimeout(setAppHeight, 100)
  })
  // And on focusin, prevent iOS page scroll after a delay
  document.addEventListener('focusin', () => {
    setTimeout(() => { window.scrollTo(0, 0) }, 50)
    setTimeout(() => { window.scrollTo(0, 0) }, 150)
    setTimeout(() => { window.scrollTo(0, 0) }, 300)
  })

  // 4. Request notification permission & subscribe to push
  updateNotificationStatus()
  if ('Notification' in window && Notification.permission === 'granted') {
    // Already granted — ensure push subscription is active
    subscribeUserToPush()
  } else if ('Notification' in window && Notification.permission === 'default') {
    const triggerPermission = (permission) => {
      updateNotificationStatus()
      if (permission === 'granted') {
        subscribeUserToPush()
        try {
          if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => reg.showNotification('Уведомления включены! 🎉', { body: 'Теперь вы будете получать напоминания.', icon: '/icon-192.png' }))
          } else {
            new Notification('Уведомления включены! 🎉', { body: 'Теперь вы будете получать напоминания.', icon: '/icon-192.png' })
          }
        } catch (e) {}
      }
    }
    const requestSilentPermission = () => {
      if (Notification.permission === 'default') {
        try {
          const promise = Notification.requestPermission(triggerPermission)
          if (promise && typeof promise.then === 'function') { promise.then(triggerPermission).catch(() => {}) }
        } catch (e) { try { Notification.requestPermission(triggerPermission) } catch (err) {} }
      }
      window.removeEventListener('click', requestSilentPermission)
      window.removeEventListener('touchend', requestSilentPermission)
    }
    window.addEventListener('click', requestSilentPermission)
    window.addEventListener('touchend', requestSilentPermission)
  }

  // 5. Supabase Auth with persistent session & auto-refresh (Non-blocking with safety timeout)
  if (supabase) {
    // Set up real-time auth state listener
    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        currentUser.value = session.user
        fetchCloudData()
      } else if (event === 'SIGNED_OUT') {
        currentUser.value = null
      }
    })

    // Init session in background without blocking UI
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        currentUser.value = session.user
        await fetchCloudData()
      } else {
        // Only sign in anonymously if user was NOT previously registered
        const wasRealAccount = localStorage.getItem('garden_planner_was_real_account')
        if (!wasRealAccount) {
          const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
          if (!authError && authData?.user) {
            currentUser.value = authData.user
            await fetchCloudData()
          }
        }
      }
    }).catch((err) => {
      console.warn('Supabase auth initialization warning:', err?.message)
    }).finally(() => {
      isLoadingCloud.value = false
    })
  } else {
    isLoadingCloud.value = false
  }

  // 6. Start notification scheduler — check every 30 seconds
  checkNotifications()
  setInterval(checkNotifications, 30000)

  // 7. Web Share Target Handler (PWA & Android Share Sheet)
  const processSharedPayload = (data) => {
    if (!data) return
    activeTab.value = 'recipes'
    shareData.value = data
  }

  // A) BroadcastChannel listener from sw.js
  if ('BroadcastChannel' in window) {
    try {
      const shareChannel = new BroadcastChannel('share-target')
      shareChannel.onmessage = (event) => {
        if (event.data) processSharedPayload(event.data)
      }
    } catch (e) {}
  }

  // B) Check Cache Storage for cached share data
  if ('caches' in window) {
    try {
      caches.open('share-target-cache').then(async (cache) => {
        const response = await cache.match('/_share_data')
        if (response) {
          const data = await response.json()
          await cache.delete('/_share_data')
          if (data && (Date.now() - (data.timestamp || 0) < 60000)) {
            processSharedPayload(data)
          }
        }
      }).catch(() => {})
    } catch (e) {}
  }

  // C) Check URL search params (?shared=1 or ?title=...&text=...&url=...)
  try {
    const urlParams = new URLSearchParams(window.location.search)
    const title = urlParams.get('title') || ''
    const text = urlParams.get('text') || ''
    const sharedUrl = urlParams.get('url') || ''
    if (title || text || sharedUrl) {
      processSharedPayload({
        title,
        text: text + (sharedUrl ? '\n' + sharedUrl : ''),
        photos: []
      })
      window.history.replaceState({}, '', '/')
    }
  } catch (e) {}

  // 8. Check for first launch after app update (What's New)
  try {
    const releaseKey = `garden_planner_seen_release_${MAJOR_RELEASE_VERSION.replace(/\./g, '_')}`
    const seenRelease = localStorage.getItem(releaseKey)
    if (!seenRelease) {
      localStorage.setItem(releaseKey, 'true')
      setTimeout(() => {
        showUpdateModal.value = true
      }, 400)
    }
  } catch (e) {}
})

const handleCloseUpdateModal = () => {
  try {
    const releaseKey = `garden_planner_seen_release_${MAJOR_RELEASE_VERSION.replace(/\./g, '_')}`
    localStorage.setItem(releaseKey, 'true')
  } catch (e) {}
  showUpdateModal.value = false
}

// Keep local storage in sync (with error protection)
const safeLocalSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('localStorage save warning for', key, ':', e.message)
  }
}
watch(tasks, (v) => { safeLocalSet('garden_planner_tasks', v) }, { deep: true })
watch(dayTables, (v) => { safeLocalSet('garden_planner_day_tables', v) }, { deep: true })
watch(aiChats, (v) => { safeLocalSet('garden_planner_ai_chats', v) }, { deep: true })
watch(allAiMessages, (v) => { safeLocalSet('garden_planner_all_ai_messages', v) }, { deep: true })
watch(recipeCategories, (v) => { safeLocalSet('garden_planner_recipe_categories', v) }, { deep: true })
watch(recipes, (v) => { safeLocalSet('garden_planner_recipes', v) }, { deep: true })
watch(recipeNotes, (v) => { safeLocalSet('garden_planner_recipe_notes', v) }, { deep: true })
watch(appSettings, (v) => { safeLocalSet('garden_planner_app_settings', v) }, { deep: true })

const updateMetaThemeColor = (isDark) => {
  const themeColor = isDark ? '#101411' : '#f3f6f4'
  
  const meta = document.getElementById('theme-meta') || document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', themeColor)
  }

  document.documentElement.style.backgroundColor = themeColor
  document.body.style.backgroundColor = themeColor
}
const updateMetaBackgroundColor = (isDark) => {
  const backgroundColor = isDark ? '#101411' : '#f3f6f4'
  
  const meta = document.getElementById('background-meta') || document.querySelector('meta[name="background-color"]')
  if (meta) {
    meta.setAttribute('content', backgroundColor)
  }

  document.documentElement.style.backgroundColor = backgroundColor
  document.body.style.backgroundColor = backgroundColor
}

watch(isDarkMode, (newVal) => {
  try { localStorage.setItem('garden_planner_dark_mode', newVal) } catch(e) {}
  if (newVal) { document.documentElement.classList.add('dark-theme') }
  else { document.documentElement.classList.remove('dark-theme') }
  updateMetaThemeColor(newVal)
  updateMetaBackgroundColor(newVal)
})

const toggleDarkMode = () => { isDarkMode.value = !isDarkMode.value }

// --- Settings, Customization & Features ---
const availableThemes = [
  { name: 'Шалфей', hue: 145, color: 'hsl(145, 32%, 42%)' },
  { name: 'Бриз', hue: 198, color: 'hsl(198, 35%, 44%)' },
  { name: 'Индиго', hue: 220, color: 'hsl(220, 30%, 48%)' },
  { name: 'Лаванда', hue: 265, color: 'hsl(265, 26%, 52%)' },
  { name: 'Пудра', hue: 345, color: 'hsl(345, 28%, 50%)' },
  { name: 'Песок', hue: 38, color: 'hsl(38, 40%, 44%)' }
]
const currentHue = ref(parseInt(localStorage.getItem('garden_planner_primary_hue')) || 145)
const setAccentTheme = (hue) => {
  currentHue.value = hue
  localStorage.setItem('garden_planner_primary_hue', hue)
  document.documentElement.style.setProperty('--primary-hue', hue)
}

const stats = computed(() => {
  const completed = tasks.value.filter(t => t.completed).length
  return {
    completedTasks: completed,
    totalTasks: tasks.value.length,
    totalRecipes: recipes.value.length,
    totalNotes: recipeNotes.value.length,
    totalChats: aiChats.value.length
  }
})

const exportBackup = () => {
  const backupData = {
    version: '2.5',
    date: new Date().toISOString(),
    tasks: tasks.value,
    dayTables: dayTables.value,
    recipeCategories: recipeCategories.value,
    recipes: recipes.value,
    recipeNotes: recipeNotes.value,
    aiChats: aiChats.value,
    allAiMessages: allAiMessages.value
  }
  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `planer-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const restoreFileInput = ref(null)
const triggerImport = () => { restoreFileInput.value?.click() }
const handleImportBackup = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result)
      if (data.tasks) tasks.value = data.tasks
      if (data.dayTables) dayTables.value = data.dayTables
      if (data.recipeCategories) recipeCategories.value = data.recipeCategories
      if (data.recipes) recipes.value = data.recipes
      if (data.recipeNotes) recipeNotes.value = data.recipeNotes
      if (data.aiChats) aiChats.value = data.aiChats
      if (data.allAiMessages) allAiMessages.value = data.allAiMessages
      alert('Данные успешно восстановлены! 🎉')
    } catch (err) {
      alert('Ошибка при чтении файла резервной копии: ' + err.message)
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

const gardenTips = [
  '🌱 Поливайте растения рано утром или на закате, чтобы влага не испарялась на полуденном солнце.',
  '🍅 Пасынкуйте томаты вовремя: оставляйте 1–2 главных стебля для крупных плодов и проветривания куста.',
  '🌿 Базилик и томаты — идеальные соседи на грядке: они улучшают вкус друг друга и отпугивают тлю.',
  '🥒 Огурцы любят только теплую воду: полив холодной водой провоцирует горечь плодов и корневую гниль.',
  '🧅 Мульчирование скошенной травой слоем 5–7 см сохраняет влагу в почве и подавляет сорняки.',
  '🍓 Чтобы клубника была слаще, в период созревания сократите полив и обеспечьте максимум солнца.',
  '🍳 Секрет хрустящей корочки: промокните продукт бумажным полотенцем от влаги перед жаркой.',
  '🫙 Храните свежую зелень как букет цветов в стакане с водой в дверце холодильника.',
  '🧄 Чеснок, посаженный рядом с клубникой и смородиной, защищает их от клещей и грибковых болезней.',
  '🥕 Морковь любит рыхлую песчаную почву — если земля тяжелая, добавьте песок или компост, чтобы корнеплоды не искривлялись.',
  '🌶️ Перец любит регулярный неглубокий полив без пересыхания: пересушка почвы сбрасывает первые завязи.',
  '🥔 Окучивание картофеля стимулирует рост дополнительных клубней и защищает их от позеленения на солнце.',
  '🥬 Рукколу и шпинат лучше сажать в легкой полутени — на палящем солнце они быстрее уходят в стрелку.',
  '🍎 Зола от лиственных деревьев — превосходное калийное и фосфорное удобрение без хлора.',
  '🫐 Голубика любит исключительно кислую почву (pH 4.0–4.5) — мульчируйте ее хвойным опадом или торфом.',
  '☕ Кофейная гуща — отличная добавка в компост и мульча для кислолюбивых растений (гортензии, голубика).',
  '🥚 Измельченная яичная скорлупа обогащает почву кальцием и защищает молодые побеги от слизней.',
  '🌼 Бархатцы и календула по периметру грядок отпугивают нематод и многих огородных вредителей.',
  '🥒 Для обильного урожая кабачков снимайте плоды молодыми (15–20 см) — это стимулирует появление новых завязей.',
  '🥩 Солите мясо за 40 минут до жарки (или прямо на сковороде) — тогда оно останется сочным внутри.',
  '🍋 Чтобы получить максимум сока из лимона, покатайте его с нажимом по столу перед тем, как разрезать.',
  '🧅 Чтобы не плакать от лука, охладите его в холодильнике 15 минут перед нарезкой и смочите нож.',
  '🧄 Очистить много чеснока за секунды: накройте зубчики широким лезвием ножа и слегка надавите ладонью.',
  '🥖 Освежить черствый хлеб: сбрызните корку водой и поставьте в разогретую духовку на 5 минут.',
  '🥔 Варите картофель для пюре в подсоленной холодной воде, начиная нагрев вместе с картошкой для равномерной варки.',
  '🌿 Чтобы сушеные травы раскрыли аромат, разотрите их пальцами перед добавлением в блюдо.',
  '🍯 Натуральный мед никогда не портится: засахарившийся мед достаточно согреть на водяной бане до 40°C.',
  '🥑 Храните авокадо рядом с бананами, если хотите ускорить его дозревание за 1–2 дня.',
  '🍅 Не храните свежие помидоры в холодильнике: холод разрушает летучие ароматические соединения.',
  '🧀 Твердый сыр натирается быстрее и не прилипает к терке, если слегка сбрызнуть её растительным маслом.',
  '🌱 Опрыскивание томатов слабым раствором молока и йода (1 л молока + 15 капель йода на 9 л воды) защищает от фитофторы.',
  '🌻 Посадите подсолнухи на северной стороне участка: они послужат естественной ветрозащитой для нежных культур.'
]
const currentTipIndex = ref(Math.floor(Math.random() * gardenTips.length))
const nextTip = () => {
  currentTipIndex.value = (currentTipIndex.value + 1) % gardenTips.length
}

// Navigation
const handleBack = () => {
  if (viewLevel.value === 'tasks') {
    viewLevel.value = 'calendar'
    currentDay.value = null
    activeDayTab.value = 'tasks'
  }
}

const handleSelectDay = (dateStr) => {
  selectedDate.value = dateStr
  viewLevel.value = 'tasks'
  activeDayTab.value = 'tasks'
}

// Task handlers
const handleAddTask = async (newTask) => {
  const tempId = Date.now()
  const localTask = { id: tempId, title: newTask.title, category: newTask.category, time: newTask.time || null, completed: false, date: newTask.date, user_id: currentUser.value ? currentUser.value.id : null }
  tasks.value.push(localTask)
  if (supabase && currentUser.value) {
    try {
      const { data, error } = await supabase.from('tasks').insert({ title: newTask.title, category: newTask.category, time: newTask.time || null, completed: false, date: newTask.date, user_id: currentUser.value.id }).select()
      if (error) throw error
      if (data && data[0]) { const idx = tasks.value.findIndex(t => t.id === tempId); if (idx !== -1) tasks.value[idx] = data[0] }
    } catch (err) { console.error('Failed to save task:', err.message) }
  }
}

const handleToggleTask = async (taskId) => {
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return
  task.completed = !task.completed
  if (task.completed) {
    if (appSettings.value && appSettings.value.hapticEnabled) triggerHaptic('success')
  } else {
    if (appSettings.value && appSettings.value.hapticEnabled) triggerHaptic('tap')
  }
  if (supabase && currentUser.value) {
    try { const isTemp = typeof taskId === 'number' && taskId > 1000000000000; if (!isTemp) { const { error } = await supabase.from('tasks').update({ completed: task.completed }).eq('id', taskId); if (error) throw error } } catch (err) { console.error('Failed to toggle task:', err.message) }
  }
}

const switchTab = (tabKey) => {
  activeTab.value = tabKey
  if (appSettings.value && appSettings.value.hapticEnabled) triggerHaptic('tap')
}

const handleDeleteTask = async (taskId) => {
  tasks.value = tasks.value.filter(t => t.id !== taskId)
  if (supabase && currentUser.value) {
    try { const isTemp = typeof taskId === 'number' && taskId > 1000000000000; if (!isTemp) { const { error } = await supabase.from('tasks').delete().eq('id', taskId); if (error) throw error } } catch (err) { console.error('Failed to delete task:', err.message) }
  }
}

// Time picker
const handleOpenTimePicker = (callback) => { timePickerCallback.value = callback; showTimePicker.value = true }
const handleConfirmTime = (time) => { if (timePickerCallback.value) timePickerCallback.value(time); showTimePicker.value = false; timePickerCallback.value = null }
const handleCancelTime = () => { showTimePicker.value = false; timePickerCallback.value = null }

// Table handlers
const handleOpenTableSelector = () => { showTableSelector.value = true }
const handleSelectTableTemplate = async (tableData) => {
  const tempId = Date.now()
  const localTable = { id: tempId, date: selectedDate.value, name: tableData.name, time: null, templateId: tableData.templateId, headers: tableData.headers || [], rows: tableData.rows || [], user_id: currentUser.value ? currentUser.value.id : null }
  dayTables.value.push(localTable)
  showTableSelector.value = false
  if (supabase && currentUser.value) {
    try {
      const { data, error } = await supabase.from('day_tables').insert({ date: selectedDate.value, name: tableData.name, time: null, template_id: tableData.templateId, headers: tableData.headers || [], rows: tableData.rows || [], user_id: currentUser.value.id }).select()
      if (error) throw error
      if (data && data[0]) { const idx = dayTables.value.findIndex(t => t.id === tempId); if (idx !== -1) dayTables.value[idx] = { ...data[0], templateId: data[0].template_id } }
    } catch (err) { console.error('Failed to create table:', err.message) }
  }
}
const handleCancelTableSelector = () => { showTableSelector.value = false }

const handleDeleteTable = async (tableId) => {
  dayTables.value = dayTables.value.filter(t => t.id !== tableId)
  if (supabase && currentUser.value) {
    try { const isTemp = typeof tableId === 'number' && tableId > 1000000000000; if (!isTemp) { const { error } = await supabase.from('day_tables').delete().eq('id', tableId); if (error) throw error } } catch (err) { console.error('Failed to delete table:', err.message) }
  }
}

const handleUpdateTable = async ({ id, name, time, rows }) => {
  const idx = dayTables.value.findIndex(t => t.id === id)
  if (idx !== -1) { dayTables.value[idx].name = name; dayTables.value[idx].time = time; dayTables.value[idx].rows = rows }
  const isTemp = typeof id === 'number' && id > 1000000000000
  if (isTemp) return
  if (supabase && currentUser.value) {
    try { const { error } = await supabase.from('day_tables').update({ name, time, rows }).eq('id', id); if (error) throw error } catch (err) { console.error('Failed to sync table:', err.message) }
  }
}

// AI Chat handlers
const handleNewChat = async () => {
  const tempId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
  const newChat = { id: tempId, title: 'Новый чат', created_at: new Date().toISOString() }
  aiChats.value.unshift(newChat)
  currentChatId.value = tempId
  aiMessages.value = []

  if (supabase && currentUser.value) {
    try {
      const { data, error } = await supabase.from('ai_chats').insert({ user_id: currentUser.value.id, title: 'Новый чат' }).select()
      if (error) throw error
      if (data && data[0]) {
        const idx = aiChats.value.findIndex(c => c.id === tempId)
        if (idx !== -1) aiChats.value[idx] = data[0]
        currentChatId.value = data[0].id
      }
    } catch (err) { console.error('Failed to create chat:', err.message) }
  }
}

const handleSelectChat = async (chatId) => {
  currentChatId.value = chatId
  // Restore from local cache immediately
  if (chatId && allAiMessages.value[chatId]) {
    aiMessages.value = allAiMessages.value[chatId]
  } else {
    aiMessages.value = []
  }
  
  if (supabase && currentUser.value && chatId) {
    try {
      const { data, error } = await supabase.from('ai_messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true })
      if (!error && data) {
        aiMessages.value = data
        allAiMessages.value = { ...allAiMessages.value, [chatId]: data }
      }
    } catch (err) { console.error('Failed to load messages:', err.message) }
  }
}

const handleDeleteChat = async (chatId) => {
  aiChats.value = aiChats.value.filter(c => c.id !== chatId)
  const updatedAll = { ...allAiMessages.value }
  delete updatedAll[chatId]
  allAiMessages.value = updatedAll

  if (currentChatId.value === chatId) { currentChatId.value = null; aiMessages.value = [] }
  if (supabase && currentUser.value) {
    try { await supabase.from('ai_chats').delete().eq('id', chatId) } catch (err) { console.error('Failed to delete chat:', err.message) }
  }
}

const saveLocalMessages = () => {
  if (currentChatId.value) {
    // Strip base64 image data before saving - it's too large for localStorage
    const cleanMessages = aiMessages.value.map(m => {
      if (m.image) {
        const { image, ...rest } = m
        return { ...rest, hasImage: true }
      }
      return m
    })
    allAiMessages.value = {
      ...allAiMessages.value,
      [currentChatId.value]: cleanMessages
    }
  }
}

const handleSendMessage = async (payload) => {
  const messageText = typeof payload === 'string' ? payload : (payload.text || '')
  const messageImage = typeof payload === 'string' ? null : (payload.image || null)
  
  if (!messageText.trim() && !messageImage) return
  
  // Add user message locally
  const userMsg = { id: Date.now().toString(), chat_id: currentChatId.value, role: 'user', content: messageText, image: messageImage || undefined, created_at: new Date().toISOString() }
  aiMessages.value.push(userMsg)
  saveLocalMessages()

  // Update chat title if first message
  const chat = aiChats.value.find(c => c.id === currentChatId.value)
  if (chat && (chat.title === 'Новый чат' || !chat.title)) {
    chat.title = (messageImage && !messageText.trim()) ? '📷 Фото' : messageText.substring(0, 50)
    if (supabase) {
      supabase.from('ai_chats').update({ title: chat.title }).eq('id', chat.id).then(() => {})
    }
  }

  // Save user message to DB
  if (supabase && currentUser.value) {
    try {
      const { data } = await supabase.from('ai_messages').insert({ chat_id: currentChatId.value, role: 'user', content: messageText }).select()
      if (data && data[0]) {
        const idx = aiMessages.value.findIndex(m => m.id === userMsg.id)
        if (idx !== -1) {
          data[0].image = messageImage || undefined
          aiMessages.value[idx] = data[0]
        }
        saveLocalMessages()
      }
    } catch (err) { console.error('Failed to save message:', err.message) }
  }

  // Call AI API
  isAiTyping.value = true
  try {
    const history = aiMessages.value.filter(m => m.id !== userMsg.id).map(m => ({ role: m.role, content: m.content }))
    const body = { message: messageText || 'Что на этом фото?', history, tone: appSettings.value ? appSettings.value.aiTone : 'friendly' }
    if (messageImage) body.image = messageImage
    
    const res = await fetch('/api/ask-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    
    if (data.error || !data.reply) {
      // Show error as a system message, not as AI reply
      const errorMsg = data.error || 'Не удалось получить ответ.'
      const errSystemMsg = { id: (Date.now() + 1).toString(), chat_id: currentChatId.value, role: 'assistant', content: `❌ **Ошибка:** ${errorMsg}`, created_at: new Date().toISOString() }
      aiMessages.value.push(errSystemMsg)
      saveLocalMessages()
    } else {
      const aiMsg = { id: (Date.now() + 1).toString(), chat_id: currentChatId.value, role: 'assistant', content: data.reply, created_at: new Date().toISOString() }
      aiMessages.value.push(aiMsg)
      saveLocalMessages()

      // Save AI response to DB
      if (supabase && currentUser.value) {
        try { await supabase.from('ai_messages').insert({ chat_id: currentChatId.value, role: 'assistant', content: data.reply }) } catch (err) {}
      }
    }
  } catch (err) {
    const errorMsg = { id: (Date.now() + 1).toString(), chat_id: currentChatId.value, role: 'assistant', content: 'Ошибка подключения к ИИ. Проверьте интернет.', created_at: new Date().toISOString() }
    aiMessages.value.push(errorMsg)
    saveLocalMessages()
  } finally {
    isAiTyping.value = false
  }
}

// Auth: login / register / logout
const handleAuth = async () => {
  if (!supabase) { authError.value = 'Ошибка: База данных не подключена'; return }
  const username = authUsername.value.trim().toLowerCase()
  const password = authPassword.value
  authError.value = ''
  
  if (!username || username.length < 2) { authError.value = 'Имя минимум 2 символа'; return }
  if (!password || password.length < 4) { authError.value = 'Пароль минимум 4 символа'; return }
  if (!/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/.test(username)) { authError.value = 'Имя: только буквы, цифры и _'; return }
  
  const fakeEmail = `${username}@planergarden.app`
  authLoading.value = true
  
  try {
    if (authMode.value === 'register') {
      // Try to upgrade anonymous user to permanent
      if (currentUser.value && currentUser.value.is_anonymous) {
        const { data, error } = await supabase.auth.updateUser({ email: fakeEmail, password })
        if (error) {
          if (error.message.includes('already registered') || error.message.includes('already exists')) {
            authError.value = 'Это имя уже занято. Выберите другое.'
          } else {
            authError.value = error.message
          }
          return
        }
        currentUser.value = data.user
      } else {
        // No anonymous session, sign up fresh
        const { data, error } = await supabase.auth.signUp({ email: fakeEmail, password })
        if (error) {
          if (error.message.includes('already registered')) {
            authError.value = 'Это имя уже занято.'
          } else {
            authError.value = error.message
          }
          return
        }
        currentUser.value = data.user
        localStorage.setItem('garden_planner_was_real_account', 'true')
        await fetchCloudData()
      }
      localStorage.setItem('garden_planner_was_real_account', 'true')
      authUsername.value = ''
      authPassword.value = ''
    } else {
      // Login
      const { data, error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password })
      if (error) {
        if (error.message.includes('Invalid login')) {
          authError.value = 'Неверное имя или пароль'
        } else {
          authError.value = error.message
        }
        return
      }
      currentUser.value = data.user
      localStorage.setItem('garden_planner_was_real_account', 'true')
      await fetchCloudData()
      authUsername.value = ''
      authPassword.value = ''
    }
  } catch (err) {
    authError.value = err.message
  } finally {
    authLoading.value = false
  }
}

const handleLogout = async () => {
  if (!supabase) return
  try {
    await supabase.auth.signOut()
    currentUser.value = null
    localStorage.removeItem('garden_planner_was_real_account')
    localStorage.removeItem('garden_planner_tasks')
    localStorage.removeItem('garden_planner_day_tables')
    localStorage.removeItem('garden_planner_ai_chats')
    localStorage.removeItem('garden_planner_all_ai_messages')
    localStorage.removeItem('garden_planner_recipe_categories')
    localStorage.removeItem('garden_planner_recipes')
    localStorage.removeItem('garden_planner_recipe_notes')
    tasks.value = []
    dayTables.value = []
    aiChats.value = []
    aiMessages.value = []
    allAiMessages.value = {}
    recipeCategories.value = []
    recipes.value = []
    recipeNotes.value = []
    currentChatId.value = null
    activeTab.value = 'calendar'
  } catch (err) {
    console.error('Logout error:', err)
  }
}

const displayUsername = computed(() => {
  if (!currentUser.value?.email) return ''
  return currentUser.value.email.replace('@planergarden.app', '')
})

// Recipe handlers
const handleAddCategory = async (name, emoji, color = 'default') => {
  const tempId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
  const localCat = { id: tempId, name, emoji, color, position: recipeCategories.value.length, user_id: currentUser.value?.id, created_at: new Date().toISOString() }
  recipeCategories.value.push(localCat)
  if (supabase && currentUser.value) {
    try {
      const { data, error } = await supabase.from('recipe_categories').insert({ name, emoji, color, position: recipeCategories.value.length - 1, user_id: currentUser.value.id }).select()
      if (error) throw error
      if (data?.[0]) { const idx = recipeCategories.value.findIndex(c => c.id === tempId); if (idx !== -1) recipeCategories.value[idx] = data[0] }
    } catch (err) { console.error('Failed to add category:', err.message) }
  }
}

const handleDeleteCategory = async (categoryId) => {
  recipeCategories.value = recipeCategories.value.filter(c => c.id !== categoryId)
  recipes.value = recipes.value.filter(r => r.category_id !== categoryId)
  if (supabase && currentUser.value) {
    try { await supabase.from('recipe_categories').delete().eq('id', categoryId) } catch (err) { console.error('Failed to delete category:', err.message) }
  }
}

const handleAddRecipe = async (recipe) => {
  const tempId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
  const localRecipe = { 
    id: tempId, 
    category_id: recipe.category_id, 
    name: recipe.name, 
    content: recipe.content, 
    photos: recipe.photos || [], 
    video_url: recipe.video_url || null,
    color: recipe.color || 'default',
    tags: recipe.tags || [],
    position: recipes.value.length, 
    user_id: currentUser.value?.id, 
    created_at: new Date().toISOString(), 
    updated_at: new Date().toISOString() 
  }
  recipes.value.push(localRecipe)
  if (supabase && currentUser.value) {
    try {
      const { data, error } = await supabase.from('recipes').insert({ 
        category_id: recipe.category_id, 
        name: recipe.name, 
        content: recipe.content, 
        photos: recipe.photos || [], 
        video_url: recipe.video_url || null,
        color: recipe.color || 'default',
        tags: recipe.tags || [],
        position: recipes.value.length - 1, 
        user_id: currentUser.value.id 
      }).select()
      if (error) throw error
      if (data?.[0]) { const idx = recipes.value.findIndex(r => r.id === tempId); if (idx !== -1) recipes.value[idx] = data[0] }
    } catch (err) { console.error('Failed to add recipe:', err.message) }
  }
  // Add initial note if provided
  if (recipe.note && recipe.note.trim()) {
    const recipeId = recipes.value.find(r => r.id === tempId)?.id || tempId
    handleAddNote(recipeId, recipe.note)
  }
}

const handleUpdateRecipe = async (recipe) => {
  const idx = recipes.value.findIndex(r => r.id === recipe.id)
  if (idx !== -1) {
    recipes.value[idx] = { 
      ...recipes.value[idx], 
      name: recipe.name, 
      content: recipe.content, 
      photos: recipe.photos, 
      video_url: recipe.video_url !== undefined ? recipe.video_url : recipes.value[idx].video_url,
      color: recipe.color || recipes.value[idx].color,
      tags: recipe.tags || recipes.value[idx].tags,
      updated_at: new Date().toISOString() 
    }
  }
  if (supabase && currentUser.value) {
    try { 
      await supabase.from('recipes').update({ 
        name: recipe.name, 
        content: recipe.content, 
        photos: recipe.photos, 
        video_url: recipe.video_url !== undefined ? recipe.video_url : recipes.value[idx]?.video_url || null,
        color: recipe.color,
        tags: recipe.tags,
        updated_at: new Date().toISOString() 
      }).eq('id', recipe.id) 
    } catch (err) { console.error('Failed to update recipe:', err.message) }
  }
}

const handleUpdateRecipeCategory = async (recipeId, newCategoryId) => {
  const idx = recipes.value.findIndex(r => r.id === recipeId)
  if (idx !== -1) {
    recipes.value[idx].category_id = newCategoryId
    recipes.value[idx].updated_at = new Date().toISOString()
  }
  if (supabase && currentUser.value) {
    try {
      await supabase.from('recipes').update({
        category_id: newCategoryId,
        updated_at: new Date().toISOString()
      }).eq('id', recipeId)
    } catch (err) { console.error('Failed to update recipe category:', err.message) }
  }
}

const handleDeleteRecipe = async (recipeId) => {

  recipes.value = recipes.value.filter(r => r.id !== recipeId)
  recipeNotes.value = recipeNotes.value.filter(n => n.recipe_id !== recipeId)
  if (supabase && currentUser.value) {
    try { await supabase.from('recipes').delete().eq('id', recipeId) } catch (err) { console.error('Failed to delete recipe:', err.message) }
  }
}

const handleAddNote = async (recipeId, text) => {
  const tempId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
  const localNote = { id: tempId, recipe_id: recipeId, text, user_id: currentUser.value?.id, created_at: new Date().toISOString() }
  recipeNotes.value.push(localNote)
  if (supabase && currentUser.value) {
    try {
      const { data, error } = await supabase.from('recipe_notes').insert({ recipe_id: recipeId, text, user_id: currentUser.value.id }).select()
      if (error) throw error
      if (data?.[0]) { const idx = recipeNotes.value.findIndex(n => n.id === tempId); if (idx !== -1) recipeNotes.value[idx] = data[0] }
    } catch (err) { console.error('Failed to add note:', err.message) }
  }
}

const handleDeleteNote = async (noteId) => {
  recipeNotes.value = recipeNotes.value.filter(n => n.id !== noteId)
  if (supabase && currentUser.value) {
    try { await supabase.from('recipe_notes').delete().eq('id', noteId) } catch (err) { console.error('Failed to delete note:', err.message) }
  }
}

const handleClearShareData = () => { shareData.value = null }

// Computed header title
const headerTitle = () => {
  if (activeTab.value === 'recipes') return '🍳 Рецепты'
  if (activeTab.value === 'ai') return 'ИИ Помощник'
  if (activeTab.value === 'settings') return isRealAccount.value ? 'Профиль' : 'Аккаунт'
  if (viewLevel.value === 'tasks') return activeDayTab.value === 'tasks' ? 'Задачи на день' : 'Таблицы дня'
  return '🌱 Планер задач'
}
</script>

<template>
  <div class="device-frame" :class="{ 'dark-theme': isDarkMode }">
    <div class="device-screen" :class="{ 'dark-theme': isDarkMode }">

      <!-- App Header -->
      <header class="app-header">
        <!-- Back button for calendar sub-navigation -->
        <button 
          v-if="activeTab === 'calendar' && viewLevel === 'tasks'" 
          class="back-btn" 
          @click="handleBack"
          aria-label="Назад"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span v-else class="header-spacer"></span>

        <h1 class="app-title">{{ headerTitle() }}</h1>

        <!-- Theme Toggle -->
        <button class="theme-toggle-btn" @click="toggleDarkMode">
          <svg v-if="isDarkMode" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>
      </header>

      <!-- Day View Tab switcher -->
      <div v-if="activeTab === 'calendar' && viewLevel === 'tasks'" class="day-tabs-bar">
        <button class="day-tab-btn" :class="{ active: activeDayTab === 'tasks' }" @click="activeDayTab = 'tasks'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          Задачи
        </button>
        <button class="day-tab-btn" :class="{ active: activeDayTab === 'tables' }" @click="activeDayTab = 'tables'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
          </svg>
          Таблицы
        </button>
      </div>

      <!-- App Scrollable Area -->
      <main class="app-body">
        <!-- Cloud loader -->
        <div v-if="isLoadingCloud && tasks.length === 0 && dayTables.length === 0 && supabase" class="cloud-loading-screen">
          <div class="cloud-spinner"></div>
          <span>Подключение к облаку...</span>
        </div>

        <template v-else>
          <!-- CALENDAR TAB -->
          <template v-if="activeTab === 'calendar'">
            <transition name="fade" mode="out-in">
              <!-- Calendar Accordion View -->
              <NestedCalendar 
                v-if="viewLevel !== 'tasks'"
                :year="year"
                :tasks="tasks"
                :day-tables="dayTables"
                @select-day="handleSelectDay"
              />

              <!-- Day View: Tasks Tab -->
              <TaskList 
                v-else-if="activeDayTab === 'tasks'" 
                :tasks="tasks" 
                :selected-date="selectedDate" 
                @add-task="handleAddTask"
                @toggle-task="handleToggleTask"
                @delete-task="handleDeleteTask"
                @open-time-picker="handleOpenTimePicker"
              />

              <!-- Day View: Tables Tab -->
              <DayTablesView 
                v-else
                :day-tables="dayTables"
                :selected-date="selectedDate"
                @create-table="handleOpenTableSelector"
                @delete-table="handleDeleteTable"
                @update-table="handleUpdateTable"
                @open-time-picker="handleOpenTimePicker"
              />
            </transition>
          </template>

          <!-- AI CHAT TAB -->
          <AiChat 
            v-if="activeTab === 'ai'"
            :chat-messages="aiMessages"
            :chat-list="aiChats"
            :current-chat-id="currentChatId"
            :is-typing="isAiTyping"
            @send-message="handleSendMessage"
            @new-chat="handleNewChat"
            @select-chat="handleSelectChat"
            @delete-chat="handleDeleteChat"
          />

          <!-- RECIPES TAB -->
          <RecipesView
            v-if="activeTab === 'recipes'"
            :categories="recipeCategories"
            :recipes="recipes"
            :recipe-notes="recipeNotes"
            :share-data="shareData"
            @add-category="handleAddCategory"
            @delete-category="handleDeleteCategory"
            @add-recipe="handleAddRecipe"
            @update-recipe="handleUpdateRecipe"
            @delete-recipe="handleDeleteRecipe"
            @update-recipe-category="handleUpdateRecipeCategory"
            @add-note="handleAddNote"
            @delete-note="handleDeleteNote"
            @clear-share-data="handleClearShareData"
          />

          <!-- SETTINGS TAB -->
          <div v-if="activeTab === 'settings'" class="settings-page">
            <!-- 1. Profile / Auth Section -->
            <div v-if="isRealAccount" class="settings-section">
              <div class="profile-card">
                <div class="profile-avatar">{{ displayUsername.charAt(0).toUpperCase() }}</div>
                <div class="profile-info">
                  <span class="profile-name">{{ displayUsername }}</span>
                  <span class="profile-sub">Синхронизация активна ☁️</span>
                </div>
              </div>
            </div>
            <div v-else class="settings-section">
              <div class="auth-card">
                <div class="auth-icon">🔐</div>
                <h3 class="auth-title">{{ authMode === 'login' ? 'Вход в аккаунт' : 'Создание аккаунта' }}</h3>
                <p class="auth-subtitle">{{ authMode === 'login' ? 'Войдите для синхронизации данных' : 'Придумайте имя и пароль' }}</p>
                <div class="auth-form">
                  <input v-model="authUsername" type="text" :placeholder="authMode === 'login' ? 'Ваше имя' : 'Придумайте имя'" class="auth-input" autocomplete="username" autocapitalize="off" />
                  <input v-model="authPassword" type="password" :placeholder="authMode === 'login' ? 'Пароль' : 'Придумайте пароль'" class="auth-input" autocomplete="current-password" @keyup.enter="handleAuth" />
                  <div v-if="authError" class="auth-error">{{ authError }}</div>
                  <button class="auth-btn primary-btn" @click="handleAuth" :disabled="authLoading">
                    {{ authLoading ? '⏳' : (authMode === 'login' ? 'Войти' : 'Создать аккаунт') }}
                  </button>
                </div>
                <button class="auth-switch" @click="authMode = authMode === 'login' ? 'register' : 'login'; authError = ''">
                  {{ authMode === 'login' ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти' }}
                </button>
              </div>
            </div>

            <!-- 2. Mini Stats Dashboard (Logged in only) -->
            <div v-if="isRealAccount" class="settings-section">
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-icon-wrap">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <div class="stat-content">
                    <span class="stat-num">{{ stats.completedTasks }}</span>
                    <span class="stat-label">Выполнено</span>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon-wrap">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16M4 15h16M8 11V5a2 2 0 1 1 4 0v6M14 11V7a2 2 0 1 1 4 0v4"></path></svg>
                  </div>
                  <div class="stat-content">
                    <span class="stat-num">{{ stats.totalRecipes }}</span>
                    <span class="stat-label">Рецептов</span>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon-wrap">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                  </div>
                  <div class="stat-content">
                    <span class="stat-num">{{ stats.totalNotes }}</span>
                    <span class="stat-label">Заметок</span>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon-wrap">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  </div>
                  <div class="stat-content">
                    <span class="stat-num">{{ stats.totalChats }}</span>
                    <span class="stat-label">ИИ-чатов</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. Appearance (Theme & Accents - Available for all) -->
            <div class="settings-section">
              <div class="settings-card">
                <div class="settings-card-header">
                  <span class="header-title">🎨 Палитра приложения</span>
                </div>
                <div class="theme-bubbles-grid">
                  <button 
                    v-for="t in availableThemes" 
                    :key="t.hue" 
                    class="theme-pill-btn"
                    :class="{ active: currentHue === t.hue }"
                    @click="setAccentTheme(t.hue)"
                  >
                    <span class="color-dot" :style="{ background: t.color }"></span>
                    <span class="color-text">{{ t.name }}</span>
                  </button>
                </div>

                <div class="settings-divider"></div>

                <div class="settings-item-row" @click="toggleDarkMode">
                  <div class="item-left">
                    <span>🌙</span>
                    <span>Тёмная тема</span>
                  </div>
                  <div class="toggle-switch" :class="{ on: isDarkMode }"><div class="toggle-knob"></div></div>
                </div>
              </div>
            </div>

            <!-- 4. Garden Tip of the Day (Logged in only) -->
            <div v-if="isRealAccount" class="settings-section">
              <div class="settings-card tip-card-clean">
                <div class="tip-top-row">
                  <span class="tip-title">✨ Совет дня</span>
                  <button class="tip-refresh-btn" @click="nextTip">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    <span>Другой совет</span>
                  </button>
                </div>
                <p class="tip-body-text">{{ gardenTips[currentTipIndex] }}</p>
              </div>
            </div>

            <!-- 5. Backup & Tools (Logged in only) -->
            <div v-if="isRealAccount" class="settings-section">
              <div class="settings-card">
                <div class="settings-card-header">
                  <span class="header-title">💾 Резервная копия</span>
                </div>
                <div class="backup-actions">
                  <button class="btn-backup" @click="exportBackup">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span>Скачать JSON</span>
                  </button>
                  <button class="btn-backup" @click="triggerImport">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>Восстановить</span>
                  </button>
                  <input type="file" ref="restoreFileInput" accept=".json" @change="handleImportBackup" hidden>
                </div>

                <div class="settings-divider"></div>

                <div class="settings-item-row">
                  <div class="item-left">
                    <span>🔔</span>
                    <span>Уведомления</span>
                  </div>
                  <span class="settings-value">{{ notificationStatus }}</span>
                </div>
              </div>
            </div>

            <!-- 6. App Settings Launch Card -->
            <div class="settings-section">
              <div class="settings-card launch-settings-card" @click="showAppSettings = true">
                <div class="launch-card-content">
                  <div class="launch-icon-badge">⚙️</div>
                  <div class="launch-info">
                    <span class="launch-title">Настройки приложения</span>
                    <span class="launch-desc">Порядок вкладок, вибрация, стиль ИИ</span>
                  </div>
                </div>
                <svg class="chevron-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </div>
            </div>

            <!-- 7. About & Author Credit -->
            <div class="settings-section footer-section">
              <div class="about-card">
                <div class="about-logo">🌱</div>
                <div class="about-info">
                  <div class="about-title">Дачный и Домашний Планер</div>
                  <div class="about-ver">Версия {{ APP_VERSION }} • Offline Ready PWA ⚡</div>
                </div>
              </div>

              <div class="author-badge">
                Сделано aleshadev ❤️
              </div>

              <button v-if="isRealAccount" class="auth-btn logout-btn" @click="handleLogout">
                Выйти из аккаунта
              </button>
            </div>
          </div>
        </template>
      </main>

      <!-- Time Picker Modal -->
      <transition name="fade">
        <TimePickerModal 
          v-if="showTimePicker" 
          @confirm="handleConfirmTime" 
          @cancel="handleCancelTime"
        />
      </transition>

      <!-- Table Selector Modal -->
      <transition name="fade">
        <TableSelectorModal 
          v-if="showTableSelector" 
          @select="handleSelectTableTemplate" 
          @cancel="handleCancelTableSelector"
        />
      </transition>

      <!-- App Settings Modal -->
      <transition name="fade">
        <AppSettingsModal 
          v-if="showAppSettings" 
          v-model="appSettings" 
          @close="showAppSettings = false" 
        />
      </transition>

      <!-- M3 Bottom Navigation Bar -->
      <nav class="bottom-nav" v-show="!isKeyboardOpen">
        <button 
          v-for="tabKey in (appSettings?.tabOrder || ['calendar', 'recipes', 'ai', 'settings'])" 
          :key="tabKey" 
          class="bottom-nav-item" 
          :class="{ active: activeTab === tabKey }" 
          @click="switchTab(tabKey)"
        >
          <template v-if="tabKey === 'calendar'">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span v-if="appSettings?.showTabLabels !== false" class="nav-label">Планер</span>
          </template>
          <template v-else-if="tabKey === 'recipes'">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19h16M4 15h16M8 11V5a2 2 0 1 1 4 0v6M14 11V7a2 2 0 1 1 4 0v4"></path>
            </svg>
            <span v-if="appSettings?.showTabLabels !== false" class="nav-label">Рецепты</span>
          </template>
          <template v-else-if="tabKey === 'ai'">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span v-if="appSettings?.showTabLabels !== false" class="nav-label">ИИ</span>
          </template>
          <template v-else-if="tabKey === 'settings'">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span v-if="appSettings?.showTabLabels !== false" class="nav-label">Ещё</span>
          </template>
        </button>
      </nav>

      <!-- Update / What's New Modal (Overlays Everything) -->
      <transition name="fade">
        <UpdateModal 
          v-if="showUpdateModal"
          :version="MAJOR_RELEASE_VERSION"
          @close="handleCloseUpdateModal"
        />
      </transition>

    </div>
  </div>
</template>

<style>
.back-btn,
.theme-toggle-btn {
  background: transparent;
  border: none;
  color: var(--text-main);
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
}

.back-btn:active,
.theme-toggle-btn:active {
  background: var(--surface-secondary);
}

.header-spacer {
  width: 40px;
}

.day-tabs-bar {
  display: flex;
  background: var(--surface);
  border-bottom: 1px solid var(--surface-border);
  padding: 4px 16px;
  gap: 8px;
  z-index: 10;
  flex-shrink: 0;
}

.day-tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-bottom: 3px solid transparent;
  font-family: var(--font-family);
  transition: var(--transition-fast);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.day-tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

/* Auth & Settings */
.settings-page {
  padding: 16px 16px 40px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
}
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile-card {
  display: flex; align-items: center; gap: 16px;
  background: var(--surface); border-radius: var(--radius-lg);
  padding: 20px; border: 1px solid var(--surface-border);
}
.profile-avatar {
  width: 52px; height: 52px; border-radius: 50%;
  background: var(--primary); color: var(--text-on-primary);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700; font-family: var(--font-family);
}
.profile-info { display: flex; flex-direction: column; gap: 2px; }
.profile-name { font-size: 18px; font-weight: 700; color: var(--text-main); font-family: var(--font-family); }
.profile-sub { font-size: 13px; color: var(--text-muted); font-family: var(--font-family); }

.settings-item {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--surface); border-radius: var(--radius-md);
  padding: 16px; border: 1px solid var(--surface-border);
  cursor: pointer; font-family: var(--font-family); font-size: 15px; color: var(--text-main);
}
.settings-value { font-size: 13px; color: var(--text-muted); }

.toggle-switch {
  width: 48px; height: 28px; border-radius: 14px;
  background: var(--surface-border); position: relative; transition: var(--transition);
}
.toggle-switch.on { background: var(--primary); }
.toggle-knob {
  width: 22px; height: 22px; border-radius: 50%;
  background: white; position: absolute; top: 3px; left: 3px;
  transition: var(--transition); box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.toggle-switch.on .toggle-knob { left: 23px; }

.auth-card {
  background: var(--surface); border-radius: var(--radius-lg);
  padding: 32px 24px; text-align: center;
  border: 1px solid var(--surface-border);
}
.auth-icon { font-size: 48px; margin-bottom: 12px; }
.auth-title { font-size: 20px; font-weight: 700; color: var(--text-main); margin: 0 0 6px; font-family: var(--font-family); }
.auth-subtitle { font-size: 14px; color: var(--text-muted); margin: 0 0 20px; font-family: var(--font-family); }

.auth-form { display: flex; flex-direction: column; gap: 12px; }
.auth-input {
  width: 100%; padding: 14px 16px; border-radius: var(--radius-md);
  border: 1px solid var(--surface-border); background: var(--bg-app);
  color: var(--text-main); font-size: 15px; font-family: var(--font-family);
  outline: none; transition: var(--transition); box-sizing: border-box;
}
.auth-input:focus { border-color: var(--primary); }

.auth-btn {
  width: 100%; padding: 14px; border-radius: var(--radius-md);
  border: none; font-size: 15px; font-weight: 600;
  cursor: pointer; font-family: var(--font-family); transition: var(--transition);
}
.primary-btn { background: var(--primary); color: var(--text-on-primary); }
.primary-btn:active { opacity: 0.8; }
.primary-btn:disabled { opacity: 0.5; }
.logout-btn { background: transparent; color: #e53935; border: 1px solid #e53935; margin-top: 8px; }

.auth-error {
  background: #fce4ec; color: #c62828; padding: 10px 14px;
  border-radius: var(--radius-sm); font-size: 13px; text-align: left;
  font-family: var(--font-family);
}

.auth-switch {
  background: none; border: none; color: var(--primary);
  font-size: 14px; cursor: pointer; margin-top: 16px;
  font-family: var(--font-family); text-decoration: underline;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.stat-card {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.stat-icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--primary-light);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.stat-num {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
  font-family: var(--font-family);
  line-height: 1.1;
}
.stat-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
  font-family: var(--font-family);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Settings Card & Headers */
.settings-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--surface-border);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.settings-card-header {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
  font-family: var(--font-family);
}
.settings-divider {
  height: 1px;
  background: var(--surface-border);
  margin: 2px 0;
}
.settings-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-main);
  font-family: var(--font-family);
}
.item-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Theme Bubbles — Grid perfectly fitting card */
.theme-bubbles-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
}
.theme-pill-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--surface-secondary);
  border: 1.5px solid transparent;
  border-radius: var(--radius-full);
  padding: 7px 4px;
  cursor: pointer;
  transition: var(--transition-fast);
  font-family: var(--font-family);
  min-width: 0;
  box-sizing: border-box;
}
.theme-pill-btn.active {
  border-color: var(--primary);
  background: var(--primary-light);
}
.color-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.color-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Tip Card Clean (Matching surface cards) */
.tip-card-clean {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tip-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tip-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
  font-family: var(--font-family);
}
.tip-refresh-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: var(--surface-secondary);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-full);
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-main);
  cursor: pointer;
  font-family: var(--font-family);
  transition: var(--transition-fast);
}
.tip-refresh-btn:active {
  transform: scale(0.95);
  background: var(--primary-light);
}
.tip-body-text {
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--text-main);
  font-family: var(--font-family);
  margin: 0;
}

/* Backup Actions */
.backup-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.btn-backup {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
  background: var(--surface-secondary);
  color: var(--text-main);
  font-size: 12.5px;
  font-weight: 600;
  font-family: var(--font-family);
  cursor: pointer;
  transition: var(--transition-fast);
  white-space: nowrap;
}
.btn-backup:active {
  background: var(--primary-light);
  color: var(--primary);
}

/* About & Footer */
.about-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
}
.about-logo {
  font-size: 28px;
}
.about-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  font-family: var(--font-family);
}
.about-ver {
  font-size: 11.5px;
  color: var(--text-muted);
  font-family: var(--font-family);
}

/* Author Credit */
.author-badge {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 8px 0 2px;
  font-family: var(--font-family);
  letter-spacing: 0.2px;
  opacity: 0.85;
}

/* App Settings Launch Card */
.launch-settings-card {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: space-between !important;
  cursor: pointer;
  padding: 14px 16px;
  box-sizing: border-box;
  width: 100%;
  transition: var(--transition-fast);
}
.launch-settings-card:active {
  transform: scale(0.98);
  background: var(--surface-secondary);
}
.launch-card-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}
.launch-icon-badge {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.launch-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.launch-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  font-family: var(--font-family);
}
.launch-desc {
  font-size: 11.5px;
  color: var(--text-muted);
  font-family: var(--font-family);
}
.chevron-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  margin-left: 8px;
}
</style>
