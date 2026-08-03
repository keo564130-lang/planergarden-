<script setup>
import { ref, watch, onMounted } from 'vue'
import { supabase } from './supabase'
import NestedCalendar from './components/NestedCalendar.vue'
import TaskList from './components/TaskList.vue'
import DayTablesView from './components/DayTablesView.vue'
import TimePickerModal from './components/TimePickerModal.vue'
import TableSelectorModal from './components/TableSelectorModal.vue'
import AiChat from './components/AiChat.vue'

// Base configurations
const year = ref(2026)
const currentMonth = ref(null)
const currentDay = ref(null)
const viewLevel = ref('calendar') // 'calendar' or 'tasks'
const todayObj = new Date()
const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`
const selectedDate = ref(todayStr)

// Bottom navigation
const activeTab = ref('calendar') // 'calendar', 'ai', 'settings'

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

// Auth state
const currentUser = ref(null)
const isLoadingCloud = ref(true)

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

// Fetch cloud data
const fetchCloudData = async () => {
  try {
    // 1. Fetch tasks
    const { data: cloudTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', currentUser.value.id)
    
    if (tasksError) throw tasksError
    tasks.value = cloudTasks || []

    // 2. Fetch tables
    const { data: cloudTables, error: tablesError } = await supabase
      .from('day_tables')
      .select('*')
      .eq('user_id', currentUser.value.id)
    
    if (tablesError) throw tablesError
    
    dayTables.value = (cloudTables || []).map(t => ({
      id: t.id,
      date: t.date,
      name: t.name,
      time: t.time,
      templateId: t.template_id,
      headers: t.headers,
      rows: t.rows,
      user_id: t.user_id
    }))

    // 3. Fetch AI chats
    const { data: cloudChats, error: chatsError } = await supabase
      .from('ai_chats')
      .select('*')
      .eq('user_id', currentUser.value.id)
      .order('created_at', { ascending: false })
    
    if (!chatsError && cloudChats) {
      aiChats.value = cloudChats
    }
  } catch (err) {
    console.error('Failed to sync cloud data:', err.message)
  }
}

// Scheduler: checks tasks time matching system time
const checkNotifications = () => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const now = new Date()
  const currentHrs = now.getHours()
  const currentMins = now.getMinutes()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  tasks.value.forEach(async (task) => {
    if (!task.time || task.completed || task.date !== todayStr) return
    if (notifiedTasks.value.has(task.id)) return
    const [taskHrs, taskMins] = task.time.split(':').map(Number)
    if (currentHrs === taskHrs && currentMins === taskMins) {
      const title = 'Дачный планер 🌸'
      const options = { body: `Пора выполнять задачу: "${task.title}"`, icon: '/favicon.ico', tag: `task-reminder-${task.id}`, renotify: true }
      try {
        new Notification(title, options)
      } catch (e) {
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          const reg = await navigator.serviceWorker.ready
          await reg.showNotification(title, options)
        }
      }
      notifiedTasks.value.add(task.id)
    }
  })
}

// Load cache and setup Auth on mount
onMounted(async () => {
  // 1. Load dark mode
  const savedDarkMode = localStorage.getItem('garden_planner_dark_mode')
  if (savedDarkMode !== null) {
    isDarkMode.value = savedDarkMode === 'true'
  } else {
    isDarkMode.value = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  
  // 2. Immediate offline cache fallback
  const savedTasks = localStorage.getItem('garden_planner_tasks')
  if (savedTasks) { try { tasks.value = JSON.parse(savedTasks) } catch (e) {} }
  const savedTables = localStorage.getItem('garden_planner_day_tables')
  if (savedTables) { try { dayTables.value = JSON.parse(savedTables) } catch (e) {} }
  const savedChats = localStorage.getItem('garden_planner_ai_chats')
  if (savedChats) { try { aiChats.value = JSON.parse(savedChats) } catch (e) {} }
  const savedAllMsgs = localStorage.getItem('garden_planner_all_ai_messages')
  if (savedAllMsgs) { try { allAiMessages.value = JSON.parse(savedAllMsgs) } catch (e) {} }

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

  // 4. Request notification permission
  updateNotificationStatus()
  if ('Notification' in window && Notification.permission === 'default') {
    const triggerPermission = (permission) => {
      updateNotificationStatus()
      if (permission === 'granted') {
        subscribeUserToPush()
        try { new Notification('Уведомления включены! 🎉', { body: 'Теперь вы будете получать напоминания.', icon: '/favicon.ico' }) } catch (e) {}
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

  // 5. Supabase Auth
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        currentUser.value = session.user
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
        if (authError) throw authError
        if (authData && authData.user) { currentUser.value = authData.user }
      }
      if (currentUser.value) { await fetchCloudData() }
    } catch (err) {
      console.error('Supabase auth initialization failed:', err.message)
    } finally {
      isLoadingCloud.value = false
    }
  } else {
    isLoadingCloud.value = false
  }
})

// Keep local storage in sync
watch(tasks, (v) => { localStorage.setItem('garden_planner_tasks', JSON.stringify(v)) }, { deep: true })
watch(dayTables, (v) => { localStorage.setItem('garden_planner_day_tables', JSON.stringify(v)) }, { deep: true })
watch(aiChats, (v) => { localStorage.setItem('garden_planner_ai_chats', JSON.stringify(v)) }, { deep: true })
watch(allAiMessages, (v) => { localStorage.setItem('garden_planner_all_ai_messages', JSON.stringify(v)) }, { deep: true })

watch(isDarkMode, (newVal) => {
  localStorage.setItem('garden_planner_dark_mode', newVal)
  if (newVal) { document.documentElement.classList.add('dark-theme') }
  else { document.documentElement.classList.remove('dark-theme') }
})

const toggleDarkMode = () => { isDarkMode.value = !isDarkMode.value }

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
  if (supabase && currentUser.value) {
    try { const isTemp = typeof taskId === 'number' && taskId > 1000000000000; if (!isTemp) { const { error } = await supabase.from('tasks').update({ completed: task.completed }).eq('id', taskId); if (error) throw error } } catch (err) { console.error('Failed to toggle task:', err.message) }
  }
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
    allAiMessages.value = {
      ...allAiMessages.value,
      [currentChatId.value]: [...aiMessages.value]
    }
  }
}

const handleSendMessage = async (messageText) => {
  if (!messageText.trim()) return
  
  // Add user message locally
  const userMsg = { id: Date.now().toString(), chat_id: currentChatId.value, role: 'user', content: messageText, created_at: new Date().toISOString() }
  aiMessages.value.push(userMsg)
  saveLocalMessages()

  // Update chat title if first message
  const chat = aiChats.value.find(c => c.id === currentChatId.value)
  if (chat && (chat.title === 'Новый чат' || !chat.title)) {
    chat.title = messageText.substring(0, 50)
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
        if (idx !== -1) aiMessages.value[idx] = data[0]
        saveLocalMessages()
      }
    } catch (err) { console.error('Failed to save message:', err.message) }
  }

  // Call AI API
  isAiTyping.value = true
  try {
    const history = aiMessages.value.filter(m => m.id !== userMsg.id).map(m => ({ role: m.role, content: m.content }))
    const res = await fetch('/api/ask-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messageText, history })
    })
    const data = await res.json()
    
    const aiReply = data.reply || data.error || 'Не удалось получить ответ.'
    const aiMsg = { id: (Date.now() + 1).toString(), chat_id: currentChatId.value, role: 'assistant', content: aiReply, created_at: new Date().toISOString() }
    aiMessages.value.push(aiMsg)
    saveLocalMessages()

    // Save AI response to DB
    if (supabase && currentUser.value) {
      try { await supabase.from('ai_messages').insert({ chat_id: currentChatId.value, role: 'assistant', content: aiReply }) } catch (err) {}
    }
  } catch (err) {
    const errorMsg = { id: (Date.now() + 1).toString(), chat_id: currentChatId.value, role: 'assistant', content: 'Ошибка подключения к ИИ. Проверьте интернет.', created_at: new Date().toISOString() }
    aiMessages.value.push(errorMsg)
    saveLocalMessages()
  } finally {
    isAiTyping.value = false
  }
}

// Computed header title
const headerTitle = () => {
  if (activeTab.value === 'ai') return 'ИИ Помощник'
  if (activeTab.value === 'settings') return 'Настройки'
  if (viewLevel.value === 'tasks') return activeDayTab.value === 'tasks' ? 'Задачи на день' : 'Таблицы дня'
  return '🌱 Планер задач'
}
</script>

<template>
  <div class="device-frame">
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

          <!-- SETTINGS TAB (placeholder) -->
          <div v-if="activeTab === 'settings'" class="settings-placeholder">
            <div class="empty-state">
              <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span class="empty-text">Настройки скоро появятся.<br>Уведомления: {{ notificationStatus }}</span>
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

      <!-- M3 Bottom Navigation Bar -->
      <nav class="bottom-nav" v-show="!isKeyboardOpen">
        <button class="bottom-nav-item" :class="{ active: activeTab === 'calendar' }" @click="activeTab = 'calendar'">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span class="nav-label">Планер</span>
        </button>
        <button class="bottom-nav-item" :class="{ active: activeTab === 'ai' }" @click="activeTab = 'ai'">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="nav-label">ИИ</span>
        </button>
        <button class="bottom-nav-item" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span class="nav-label">Ещё</span>
        </button>
      </nav>

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
</style>
