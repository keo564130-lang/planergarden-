<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  tasks: {
    type: Array,
    required: true
  },
  selectedDate: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['add-task', 'toggle-task', 'delete-task', 'open-time-picker'])

const activeCategory = ref('garden') // 'garden' or 'home'
const newTaskTitle = ref('')
const selectedTimeForNewTask = ref(null) // e.g. '10:30'

// Filter tasks by date and category
const filteredTasks = computed(() => {
  return props.tasks.filter(
    task => task.date === props.selectedDate && task.category === activeCategory.value
  )
})

// Active vs Completed sorting
const activeTasks = computed(() => {
  return [...filteredTasks.value]
    .filter(t => !t.completed)
    .sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time)
      if (a.time) return -1
      if (b.time) return 1
      return b.id - a.id // newest first if no time
    })
})

const completedTasks = computed(() => {
  return [...filteredTasks.value]
    .filter(t => t.completed)
    .sort((a, b) => (a.time && b.time ? a.time.localeCompare(b.time) : b.id - a.id))
})

// Trigger time picker for new task
const triggerTimePicker = () => {
  emit('open-time-picker', (time) => {
    selectedTimeForNewTask.value = time
  })
}

const clearNewTaskTime = (e) => {
  e.stopPropagation()
  selectedTimeForNewTask.value = null
}

// Add Task Handler
const handleSubmitTask = () => {
  if (!newTaskTitle.value.trim()) return
  
  emit('add-task', {
    title: newTaskTitle.value.trim(),
    category: activeCategory.value,
    time: selectedTimeForNewTask.value,
    date: props.selectedDate
  })
  
  newTaskTitle.value = ''
  selectedTimeForNewTask.value = null
}

const toggleTask = (taskId) => {
  emit('toggle-task', taskId)
}

const deleteTask = (taskId) => {
  emit('delete-task', taskId)
}

const getReadableDateString = (dateStr) => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10) - 1
  const d = parseInt(parts[2], 10)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr
  const date = new Date(y, m, d)
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ]
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
  return `${date.getDate()} ${months[date.getMonth()]}, ${days[date.getDay()]}`
}
</script>

<template>
  <div class="task-list-wrapper">
    <!-- Category Tabs -->
    <div class="category-tabs">
      <button 
        class="tab-btn garden" 
        :class="{ active: activeCategory === 'garden' }" 
        @click="activeCategory = 'garden'"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a15 15 0 0 0-9 9c0 5 4 9 9 9s9-4 9-9a15 15 0 0 0-9-9Z"></path>
          <path d="M9 22V12"></path>
        </svg>
        Огород
      </button>
      <button 
        class="tab-btn home" 
        :class="{ active: activeCategory === 'home' }" 
        @click="activeCategory = 'home'"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        Дом
      </button>
    </div>

    <!-- Task Addition Form -->
    <form class="add-task-form" @submit.prevent="handleSubmitTask">
      <div class="task-input-wrapper">
        <input 
          v-model="newTaskTitle" 
          type="text" 
          class="task-input" 
          placeholder="Новая задача..." 
          required
        />
      </div>
      <div class="task-options">
        <button 
          type="button" 
          class="time-select-trigger" 
          @click="triggerTimePicker"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span v-if="selectedTimeForNewTask">Время: {{ selectedTimeForNewTask }}</span>
          <span v-else>Добавить время</span>
          <span 
            v-if="selectedTimeForNewTask" 
            class="clear-time" 
            @click="clearNewTaskTime"
          >
            &times;
          </span>
        </button>
        <button type="submit" class="submit-task-btn">
          Добавить
        </button>
      </div>
    </form>

    <!-- Tasks List Section -->
    <div class="tasks-container">
      <h4 class="date-header">{{ getReadableDateString(selectedDate) }}</h4>

      <!-- Empty State -->
      <div v-if="activeTasks.length === 0 && completedTasks.length === 0" class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span class="empty-text">Нет задач на этот день. Добавьте первую!</span>
      </div>

      <!-- Active Tasks List -->
      <div 
        v-for="task in activeTasks" 
        :key="task.id" 
        class="task-item"
      >
        <div class="task-item-left" @click="toggleTask(task.id)">
          <div class="custom-checkbox">
            <svg class="checkmark-icon" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div class="task-content">
            <span class="task-title">{{ task.title }}</span>
            <span v-if="task.time" class="task-time-tag">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              {{ task.time }}
            </span>
          </div>
        </div>
        <button class="delete-task-btn" @click="deleteTask(task.id)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </div>

      <!-- Divider if there are completed tasks -->
      <div v-if="completedTasks.length > 0 && activeTasks.length > 0" class="tasks-divider"></div>

      <!-- Completed Tasks List -->
      <div 
        v-for="task in completedTasks" 
        :key="task.id" 
        class="task-item completed"
      >
        <div class="task-item-left" @click="toggleTask(task.id)">
          <div class="custom-checkbox">
            <svg class="checkmark-icon" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div class="task-content">
            <span class="task-title">{{ task.title }}</span>
            <span v-if="task.time" class="task-time-tag">
              {{ task.time }}
            </span>
          </div>
        </div>
        <button class="delete-task-btn" @click="deleteTask(task.id)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.date-header {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-top: 8px;
  margin-bottom: 4px;
}

.clear-time {
  font-size: 14px;
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 50%;
  display: inline-block;
}

.clear-time:hover {
  background: rgba(0, 0, 0, 0.1);
  color: var(--accent);
}

.tasks-divider {
  height: 1px;
  background: var(--surface-border);
  margin: 12px 0;
}
</style>
