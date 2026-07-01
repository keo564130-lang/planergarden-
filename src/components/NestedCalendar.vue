<script setup>
import { computed } from 'vue'

const props = defineProps({
  year: {
    type: Number,
    default: 2026
  },
  currentMonth: {
    type: Number,
    default: null
  },
  currentWeekIndex: {
    type: Number,
    default: null
  },
  currentDay: {
    type: Number,
    default: null
  },
  viewLevel: {
    type: String,
    required: true // 'month', 'week', 'day'
  },
  tasks: {
    type: Array,
    required: true
  }
})

const emit = defineEmits([
  'update:currentMonth',
  'update:currentWeekIndex',
  'update:currentDay',
  'update:viewLevel',
  'select-day'
])

const monthsList = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

const dayNamesShort = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const dayNamesFull = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

// Computes weeks of the selected month
const computedWeeks = computed(() => {
  if (props.currentMonth === null) return []
  
  const year = props.year
  const month = props.currentMonth
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  
  const weeks = []
  let currentWeek = []
  
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d)
    currentWeek.push({
      dayNumber: d,
      dayOfWeek: date.getDay(), // 0 = Sun, 1 = Mon ...
      dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    })
    
    // If it's Sunday (0) or the last day of the month, close the week
    if (date.getDay() === 0 || d === lastDay.getDate()) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  return weeks
})

// Active task count utilities
const getTaskCountForDate = (dateStr) => {
  return props.tasks.filter(t => t.date === dateStr && !t.completed).length
}

const getTaskCountForWeek = (week) => {
  return week.reduce((acc, day) => acc + getTaskCountForDate(day.dateString), 0)
}

const getTaskCountForMonth = (monthIdx) => {
  const monthPrefix = `${props.year}-${String(monthIdx + 1).padStart(2, '0')}`
  return props.tasks.filter(t => t.date.startsWith(monthPrefix) && !t.completed).length
}

// Navigation Handlers
const selectMonth = (monthIdx) => {
  emit('update:currentMonth', monthIdx)
  emit('update:viewLevel', 'week')
}

const selectWeek = (weekIdx) => {
  emit('update:currentWeekIndex', weekIdx)
  emit('update:viewLevel', 'day')
}

const selectDay = (dayNum) => {
  emit('update:currentDay', dayNum)
  const dateStr = `${props.year}-${String(props.currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
  emit('select-day', dateStr)
}

// Breadcrumb click handlers to jump back
const navigateToMonths = () => {
  emit('update:currentMonth', null)
  emit('update:currentWeekIndex', null)
  emit('update:currentDay', null)
  emit('update:viewLevel', 'month')
}

const navigateToWeeks = () => {
  emit('update:currentWeekIndex', null)
  emit('update:currentDay', null)
  emit('update:viewLevel', 'week')
}

const navigateToDays = () => {
  emit('update:currentDay', null)
  emit('update:viewLevel', 'day')
}

const getWeekDateRangeString = (week) => {
  if (!week || week.length === 0) return ''
  const startDay = week[0].dayNumber
  const endDay = week[week.length - 1].dayNumber
  const monthName = monthsList[props.currentMonth].toLowerCase().slice(0, -1) + 'я' // e.g. Июль -> июля
  return `${startDay} – ${endDay} ${monthName}`
}
</script>

<template>
  <div class="calendar-wrapper">
    <!-- Breadcrumbs Navigation Header -->
    <div class="breadcrumbs-container">
      <div class="breadcrumbs">
        <span 
          class="breadcrumb-item" 
          :class="{ active: viewLevel === 'month' }"
          @click="navigateToMonths"
        >
          {{ year }}
        </span>
        
        <template v-if="currentMonth !== null">
          <span class="breadcrumb-separator">/</span>
          <span 
            class="breadcrumb-item" 
            :class="{ active: viewLevel === 'week' }"
            @click="navigateToWeeks"
          >
            {{ monthsList[currentMonth] }}
          </span>
        </template>
        
        <template v-if="currentWeekIndex !== null">
          <span class="breadcrumb-separator">/</span>
          <span 
            class="breadcrumb-item" 
            :class="{ active: viewLevel === 'day' }"
            @click="navigateToDays"
          >
            Неделя {{ currentWeekIndex + 1 }}
          </span>
        </template>

        <template v-if="currentDay !== null && viewLevel === 'tasks'">
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-item active">
            День {{ currentDay }}
          </span>
        </template>
      </div>
    </div>

    <!-- MONTH LEVEL VIEW -->
    <div v-if="viewLevel === 'month'" class="months-grid">
      <div 
        v-for="(month, idx) in monthsList" 
        :key="idx" 
        class="month-card" 
        @click="selectMonth(idx)"
      >
        <span class="month-name">{{ month }}</span>
        <span 
          class="month-tasks-badge" 
          :class="{ empty: getTaskCountForMonth(idx) === 0 }"
        >
          {{ getTaskCountForMonth(idx) }}
        </span>
      </div>
    </div>

    <!-- WEEK LEVEL VIEW -->
    <div v-else-if="viewLevel === 'week'" class="weeks-list">
      <div 
        v-for="(week, idx) in computedWeeks" 
        :key="idx" 
        class="week-card" 
        @click="selectWeek(idx)"
      >
        <div class="week-info">
          <span class="week-title">Неделя {{ idx + 1 }}</span>
          <span class="week-dates">{{ getWeekDateRangeString(week) }}</span>
        </div>
        <div class="week-stats">
          <span 
            class="month-tasks-badge" 
            :class="{ empty: getTaskCountForWeek(week) === 0 }"
          >
            Активных: {{ getTaskCountForWeek(week) }}
          </span>
          <svg class="chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </div>
    </div>

    <!-- DAY LEVEL VIEW -->
    <div v-else-if="viewLevel === 'day'" class="days-grid">
      <div 
        v-for="day in computedWeeks[currentWeekIndex]" 
        :key="day.dayNumber" 
        class="day-card" 
        :class="{ 'has-tasks': getTaskCountForDate(day.dateString) > 0 }"
        @click="selectDay(day.dayNumber)"
      >
        <div class="day-left">
          <div class="day-number-circle">
            {{ day.dayNumber }}
          </div>
          <div class="day-details">
            <span class="day-name">{{ dayNamesFull[day.dayOfWeek] }}</span>
            <span class="day-task-count">
              {{ getTaskCountForDate(day.dateString) > 0 ? `Задач: ${getTaskCountForDate(day.dateString)}` : 'Нет активных задач' }}
            </span>
          </div>
        </div>
        <svg class="chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.breadcrumbs-container {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  box-shadow: var(--shadow);
}

.chevron-icon {
  color: var(--text-muted);
  opacity: 0.7;
  transition: var(--transition);
}

.day-card:hover .chevron-icon,
.week-card:hover .chevron-icon {
  transform: translateX(2px);
  color: var(--primary);
}
</style>
