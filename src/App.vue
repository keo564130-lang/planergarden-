<script setup>
import { ref, watch, onMounted } from 'vue'
import { supabase } from './supabase'
import NestedCalendar from './components/NestedCalendar.vue'
import TaskList from './components/TaskList.vue'
import DayTablesView from './components/DayTablesView.vue'
import TimePickerModal from './components/TimePickerModal.vue'
import TableSelectorModal from './components/TableSelectorModal.vue'

// Base configurations
const year = ref(2026)
const currentMonth = ref(6) // July (0-indexed, so 6)
const currentWeekIndex = ref(null)
const currentDay = ref(null)
const viewLevel = ref('month') // 'month', 'week', 'day', 'tasks'
const selectedDate = ref('')

// Day sub-navigation (Tasks vs Tables)
const activeDayTab = ref('tasks') // 'tasks' or 'tables'

// Modal states
const showTimePicker = ref(false)
const timePickerCallback = ref(null)
const showTableSelector = ref(false)

// Dark mode state
const isDarkMode = ref(false)

// Databases (local reactive cache)
const tasks = ref([])
const dayTables = ref([])

// Auth state
const currentUser = ref(null)
const isLoadingCloud = ref(true)

// Notification state
const notifiedTasks = ref(new Set())
const notificationStatus = ref('загрузка')

const updateNotificationStatus = () => {
  if (!('Notification' in window)) {
    notificationStatus.value = 'не поддерживается (запустите с экрана Домой)'
  } else {
    const status = Notification.permission
    if (status === 'default') {
      notificationStatus.value = 'ожидание (коснитесь экрана для запроса)'
    } else if (status === 'granted') {
      notificationStatus.value = 'разрешено (уведомления работают)'
    } else if (status === 'denied') {
      notificationStatus.value = 'заблокировано (разрешите в настройках iPhone)'
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
    
    // Check if subscription already exists
    let sub = await reg.pushManager.getSubscription()
    
    if (!sub) {
      const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      })
    }
    
    // Save to Supabase (push_subscriptions table)
    if (supabase && sub) {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      const subJSON = sub.toJSON()
      
      // 1. Check if this endpoint is already registered
      const { data: existing, error: findError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('subscription->>endpoint', subJSON.endpoint)
        
      if (findError) throw findError
      
      if (existing && existing.length > 0) {
        // 2. If exists, update timezone and user_id if needed
        const { error: updateError } = await supabase
          .from('push_subscriptions')
          .update({
            user_id: currentUser.value.id,
            timezone: timezone
          })
          .eq('id', existing[0].id)
        if (updateError) throw updateError
      } else {
        // 3. Otherwise insert new
        const { error: insertError } = await supabase
          .from('push_subscriptions')
          .insert({
            user_id: currentUser.value.id,
            subscription: subJSON,
            timezone: timezone
          })
        if (insertError) throw insertError
      }
      console.log('Web Push subscription successfully synced with Supabase!')
    }
  } catch (err) {
    console.error('Failed to subscribe user to Web Push:', err.message)
  }
}

// Automatically subscribe once user logins and notifications are granted
watch(currentUser, (newUser) => {
  if (newUser && 'Notification' in window && Notification.permission === 'granted') {
    subscribeUserToPush()
  }
})

// Fetch fresh data from Supabase
const fetchCloudData = async () => {
  if (!supabase || !currentUser.value) return
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
    
    // Map Postgres snake_case back to camelCase for Vue bindings
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
  } catch (err) {
    console.error('Failed to sync cloud data:', err.message)
  }
}



// Scheduler: checks tasks time matching system time
const checkNotifications = () => {
  console.log('[Notification Check] Running... Permission status:', 'Notification' in window ? Notification.permission : 'not supported')
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const now = new Date()
  const currentHrs = now.getHours()
  const currentMins = now.getMinutes()
  
  // YYYY-MM-DD
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const todayStr = `${yyyy}-${mm}-${dd}`

  console.log('[Notification Check] Current Time:', `${currentHrs}:${currentMins}`, 'Date:', todayStr, 'Tasks count:', tasks.value.length)

  tasks.value.forEach(async (task) => {
    console.log(`[Notification Check] Task "${task.title}": date in task="${task.date}" (today="${todayStr}"), time="${task.time}", completed=${task.completed}`)
    if (task.completed || !task.time || task.date !== todayStr) return
    if (notifiedTasks.value.has(task.id)) return

    const [taskHrs, taskMins] = task.time.split(':').map(Number)
    console.log(`[Notification Check] Comparing task "${task.title}" time (${task.time}) with current (${currentHrs}:${currentMins})`)

    // Match exact hours & minutes
    if (currentHrs === taskHrs && currentMins === taskMins) {
      console.log('[Notification Check] Match found! Triggering notification for:', task.title)
      const title = 'Дачный планер 🌸'
      const options = {
        body: `Пора выполнять задачу: "${task.title}"`,
        icon: '/favicon.ico',
        tag: `task-reminder-${task.id}`,
        renotify: true
      }

      try {
        const notif = new Notification(title, options)
        console.log('[Notification Check] Native Notification triggered:', notif)
      } catch (e) {
        console.warn('[Notification Check] Constructor failed, trying SW fallback:', e.message)
        // SW fallback
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          const reg = await navigator.serviceWorker.ready
          await reg.showNotification(title, options)
          console.log('[Notification Check] SW Notification triggered successfully!')
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
  
  // 2. Immediate offline cache fallback (Stale-While-Revalidate)
  const savedTasks = localStorage.getItem('garden_planner_tasks')
  if (savedTasks) {
    try { tasks.value = JSON.parse(savedTasks) } catch (e) {}
  }
  const savedTables = localStorage.getItem('garden_planner_day_tables')
  if (savedTables) {
    try { dayTables.value = JSON.parse(savedTables) } catch (e) {}
  }

  // 3. Setup iOS keyboard viewport shifting/offset fix on blur
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      window.scrollTo(0, 0)
      document.body.scrollTop = 0
    }, 80)
  })
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (Math.abs(window.visualViewport.height - window.innerHeight) < 10) {
        window.scrollTo(0, 0)
        document.body.scrollTop = 0
      }
    })
  }

  // 4. Request notification permission silently on first user gesture (touch or click) anywhere on the page
  updateNotificationStatus()
  if ('Notification' in window && Notification.permission === 'default') {
    const triggerPermission = (permission) => {
      updateNotificationStatus()
      if (permission === 'granted') {
        subscribeUserToPush()
        const title = 'Уведомления включены! 🎉'
        const options = {
          body: 'Теперь вы будете получать напоминания о дачных делах.',
          icon: '/favicon.ico'
        }
        try {
          new Notification(title, options)
        } catch (e) {
          if (navigator.serviceWorker && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then(reg => {
              reg.showNotification(title, options)
            })
          }
        }
      }
    }

    // Trigger on first user interaction (touch or click) using window listeners and touchend
    const requestSilentPermission = () => {
      updateNotificationStatus()
      if (Notification.permission === 'default') {
        try {
          // Support both promise and callback syntax for maximum iOS Safari compatibility
          const promise = Notification.requestPermission(triggerPermission)
          if (promise && typeof promise.then === 'function') {
            promise.then(triggerPermission).catch(() => {})
          }
        } catch (e) {
          try {
            Notification.requestPermission(triggerPermission)
          } catch (err) {}
        }
      }
      window.removeEventListener('click', requestSilentPermission)
      window.removeEventListener('touchend', requestSilentPermission)
    }
    window.addEventListener('click', requestSilentPermission)
    window.addEventListener('touchend', requestSilentPermission)
  }

  // 5. Background task notifications are fully handled in the cloud by Supabase pg_cron + Vercel API
  // to prevent duplicate triggers and save battery.

  // 6. Supabase Silent Anonymous Login (Guest Mode)
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        currentUser.value = session.user
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
        if (authError) throw authError
        if (authData && authData.user) {
          currentUser.value = authData.user
        }
      }

      // 7. Fetch fresh data once authenticated
      if (currentUser.value) {
        await fetchCloudData()
      }
    } catch (err) {
      console.error('Supabase auth initialization failed:', err.message)
    } finally {
      isLoadingCloud.value = false
    }
  } else {
    isLoadingCloud.value = false
  }
})

// Keep local storage cache in sync when reactive database updates
watch(tasks, (newTasks) => {
  localStorage.setItem('garden_planner_tasks', JSON.stringify(newTasks))
}, { deep: true })

watch(dayTables, (newTables) => {
  localStorage.setItem('garden_planner_day_tables', JSON.stringify(newTables))
}, { deep: true })

watch(isDarkMode, (newVal) => {
  localStorage.setItem('garden_planner_dark_mode', newVal)
  if (newVal) {
    document.documentElement.classList.add('dark-theme')
  } else {
    document.documentElement.classList.remove('dark-theme')
  }
})

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value
}

// Navigation Back trigger
const handleBack = () => {
  if (viewLevel.value === 'tasks') {
    viewLevel.value = 'day'
    currentDay.value = null
    activeDayTab.value = 'tasks'
  } else if (viewLevel.value === 'day') {
    viewLevel.value = 'week'
    currentWeekIndex.value = null
  } else if (viewLevel.value === 'week') {
    viewLevel.value = 'month'
    currentMonth.value = null
  }
}

const handleHomeClick = () => {
  currentMonth.value = 6
  currentWeekIndex.value = null
  currentDay.value = null
  selectedDate.value = ''
  viewLevel.value = 'month'
  activeDayTab.value = 'tasks'
}

// Select day event
const handleSelectDay = (dateStr) => {
  selectedDate.value = dateStr
  viewLevel.value = 'tasks'
  activeDayTab.value = 'tasks'
}

// Task cloud integrations
const handleAddTask = async (newTask) => {
  const tempId = Date.now()
  const localTask = {
    id: tempId,
    title: newTask.title,
    category: newTask.category,
    time: newTask.time || null,
    completed: false,
    date: newTask.date,
    user_id: currentUser.value ? currentUser.value.id : null
  }
  tasks.value.push(localTask)

  if (supabase && currentUser.value) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: newTask.title,
          category: newTask.category,
          time: newTask.time || null,
          completed: false,
          date: newTask.date,
          user_id: currentUser.value.id
        })
        .select()

      if (error) throw error
      
      if (data && data[0]) {
        const idx = tasks.value.findIndex(t => t.id === tempId)
        if (idx !== -1) {
          tasks.value[idx] = data[0]
        }
      }
    } catch (err) {
      console.error('Failed to save task to cloud:', err.message)
    }
  }
}

const handleToggleTask = async (taskId) => {
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return

  task.completed = !task.completed

  if (supabase && currentUser.value) {
    try {
      const isTemp = typeof taskId === 'number' && taskId > 1000000000000
      if (!isTemp) {
        const { error } = await supabase
          .from('tasks')
          .update({ completed: task.completed })
          .eq('id', taskId)
        
        if (error) throw error
      }
    } catch (err) {
      console.error('Failed to toggle task in cloud:', err.message)
    }
  }
}

const handleDeleteTask = async (taskId) => {
  tasks.value = tasks.value.filter(t => t.id !== taskId)

  if (supabase && currentUser.value) {
    try {
      const isTemp = typeof taskId === 'number' && taskId > 1000000000000
      if (!isTemp) {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId)
        
        if (error) throw error
      }
    } catch (err) {
      console.error('Failed to delete task in cloud:', err.message)
    }
  }
}

// Time picker interface
const handleOpenTimePicker = (callback) => {
  timePickerCallback.value = callback
  showTimePicker.value = true
}

const handleConfirmTime = (time) => {
  if (timePickerCallback.value) {
    timePickerCallback.value(time)
  }
  showTimePicker.value = false
  timePickerCallback.value = null
}

const handleCancelTime = () => {
  showTimePicker.value = false
  timePickerCallback.value = null
}

// Table selector interface
const handleOpenTableSelector = () => {
  showTableSelector.value = true
}

const handleSelectTableTemplate = async (tableData) => {
  const tempId = Date.now()
  const localTable = {
    id: tempId,
    date: selectedDate.value,
    name: tableData.name,
    time: null,
    templateId: tableData.templateId,
    headers: tableData.headers || [],
    rows: tableData.rows || [],
    user_id: currentUser.value ? currentUser.value.id : null
  }
  dayTables.value.push(localTable)
  showTableSelector.value = false

  if (supabase && currentUser.value) {
    try {
      const { data, error } = await supabase
        .from('day_tables')
        .insert({
          date: selectedDate.value,
          name: tableData.name,
          time: null,
          template_id: tableData.templateId,
          headers: tableData.headers || [],
          rows: tableData.rows || [],
          user_id: currentUser.value.id
        })
        .select()

      if (error) throw error
      
      if (data && data[0]) {
        const idx = dayTables.value.findIndex(t => t.id === tempId)
        if (idx !== -1) {
          dayTables.value[idx] = {
            ...data[0],
            templateId: data[0].template_id
          }
        }
      }
    } catch (err) {
      console.error('Failed to create table in cloud:', err.message)
    }
  }
}

const handleCancelTableSelector = () => {
  showTableSelector.value = false
}

const handleDeleteTable = async (tableId) => {
  dayTables.value = dayTables.value.filter(t => t.id !== tableId)

  if (supabase && currentUser.value) {
    try {
      const isTemp = typeof tableId === 'number' && tableId > 1000000000000
      if (!isTemp) {
        const { error } = await supabase
          .from('day_tables')
          .delete()
          .eq('id', tableId)
        
        if (error) throw error
      }
    } catch (err) {
      console.error('Failed to delete table in cloud:', err.message)
    }
  }
}

// Debounced Table Updates handler (Cell changes and Name inputs)
const handleUpdateTable = async ({ id, name, time, rows }) => {
  // Update local state first to keep it reactive and in sync
  const idx = dayTables.value.findIndex(t => t.id === id)
  if (idx !== -1) {
    dayTables.value[idx].name = name
    dayTables.value[idx].time = time
    dayTables.value[idx].rows = rows
  }

  const isTemp = typeof id === 'number' && id > 1000000000000
  if (isTemp) return

  if (supabase && currentUser.value) {
    try {
      const { error } = await supabase
        .from('day_tables')
        .update({ name, time, rows })
        .eq('id', id)
      
      if (error) throw error
    } catch (err) {
      console.error('Failed to sync table changes in cloud:', err.message)
    }
  }
}
</script>

<template>
  <!-- Interactive iPhone 8 frame wrapper for desktop, scales away on mobile -->
  <div class="device-frame" @click.self="handleHomeClick">
    <div class="device-screen" :class="{ 'dark-theme': isDarkMode }">


      <!-- App Header -->
      <header class="app-header">
        <div class="header-top">
          <!-- Back button if not in Month view -->
          <button 
            v-if="viewLevel !== 'month'" 
            class="back-btn" 
            @click="handleBack"
            aria-label="Назад"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          
          <span v-else class="header-spacer"></span>

          <h1 class="app-title">{{ viewLevel === 'tasks' ? (activeDayTab === 'tasks' ? 'Задачи на день' : 'Таблицы дня') : 'Планер задач' }}</h1>

          <!-- Theme Toggle -->
          <button class="theme-toggle-btn" @click="toggleDarkMode" :aria-label="isDarkMode ? 'Светлая тема' : 'Темная тема'">
            <svg v-if="isDarkMode" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
        </div>
      </header>

      <!-- Day View Tab switcher -->
      <div v-if="viewLevel === 'tasks'" class="day-tabs-bar">
        <button 
          class="day-tab-btn" 
          :class="{ active: activeDayTab === 'tasks' }" 
          @click="activeDayTab = 'tasks'"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          Задачи
        </button>
        <button 
          class="day-tab-btn" 
          :class="{ active: activeDayTab === 'tables' }" 
          @click="activeDayTab = 'tables'"
        >
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
        <!-- Cloud loader overlay if authenticating/syncing on fresh start with no cache -->
        <div v-if="isLoadingCloud && tasks.length === 0 && dayTables.length === 0 && supabase" class="cloud-loading-screen">
          <div class="cloud-spinner"></div>
          <span>Подключение к облаку...</span>
        </div>

        <transition v-else name="fade" mode="out-in">
          <!-- Calendar View -->
          <NestedCalendar 
            v-if="viewLevel !== 'tasks'"
            :year="year"
            v-model:current-month="currentMonth"
            v-model:current-week-index="currentWeekIndex"
            v-model:current-day="currentDay"
            v-model:view-level="viewLevel"
            :tasks="tasks"
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
      </main>

      <!-- Custom Hour/Minute Scroll-Snap Picker Modal -->
      <transition name="fade">
        <TimePickerModal 
          v-if="showTimePicker" 
          @confirm="handleConfirmTime" 
          @cancel="handleCancelTime"
        />
      </transition>

      <!-- Custom Table Template Selector Modal -->
      <transition name="fade">
        <TableSelectorModal 
          v-if="showTableSelector" 
          @select="handleSelectTableTemplate" 
          @cancel="handleCancelTableSelector"
        />
      </transition>
      
      <!-- Debug notification status indicator at the bottom -->
      <div style="font-size: 10px; opacity: 0.7; text-align: center; padding: 6px; border-top: 1px solid var(--surface-border); background: var(--surface-secondary); color: var(--text-muted); font-family: var(--font-family); flex-shrink: 0; user-select: none;">
        Состояние уведомлений: {{ notificationStatus }}
      </div>
    </div>
  </div>
</template>

<style>
/* Header buttons styles matching our design system */
.back-btn,
.theme-toggle-btn {
  background: transparent;
  border: none;
  color: var(--text-main);
  cursor: pointer;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.back-btn:active,
.theme-toggle-btn:active {
  background: var(--surface-secondary);
}

.header-spacer {
  width: 38px;
}

/* Day View Sub-Header Tab Bar */
.day-tabs-bar {
  display: flex;
  background: var(--surface);
  border-bottom: 1px solid var(--surface-border);
  padding: 4px 12px;
  gap: 12px;
  z-index: 10;
  flex-shrink: 0;
}

.day-tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-bottom: 3px solid transparent;
  font-family: var(--font-family);
  transition: var(--transition);
}

.day-tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

/* Cloud connection overlay spinner */
.cloud-loading-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  gap: 12px;
  font-family: var(--font-family);
}

.cloud-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--primary-light);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Notification Permission Banner Prompt */
.notification-banner {
  background: var(--primary-light);
  color: var(--primary);
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-family: var(--font-family);
  font-size: 12px;
  font-weight: 700;
  border-bottom: 1px solid var(--surface-border);
  z-index: 20;
}

.notification-banner button {
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  padding: 6px 14px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition);
}

.notification-banner button:active {
  transform: scale(0.95);
}
</style>
