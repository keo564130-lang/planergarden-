<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  year: { type: Number, default: 2026 },
  currentMonth: { type: Number, default: null },
  viewLevel: { type: String, required: true },
  tasks: { type: Array, required: true },
  dayTables: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'update:currentMonth',
  'update:viewLevel',
  'select-day'
])

// Currently displayed month in day-grid view (allows swipe between months)
const displayMonth = ref(props.currentMonth !== null ? props.currentMonth : new Date().getMonth())
const displayYear = ref(props.year)
const selectedDay = ref(null)

// Sync displayMonth when parent changes currentMonth
watch(() => props.currentMonth, (val) => {
  if (val !== null) {
    displayMonth.value = val
    displayYear.value = props.year
  }
})

const monthsList = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

const weekdayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

// Today detection
const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

// Compute calendar grid cells for displayMonth
const calendarCells = computed(() => {
  const y = displayYear.value
  const m = displayMonth.value
  const firstDay = new Date(y, m, 1)
  const lastDay = new Date(y, m + 1, 0)
  
  // Day of week of 1st (convert Sun=0 to Mon=0 format)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6
  
  const cells = []
  
  // Previous month fill
  if (startDow > 0) {
    const prevLastDay = new Date(y, m, 0).getDate()
    const prevMonth = m === 0 ? 11 : m - 1
    const prevYear = m === 0 ? y - 1 : y
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevLastDay - i
      cells.push({
        day: d,
        dateString: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        otherMonth: true
      })
    }
  }
  
  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({
      day: d,
      dateString: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      otherMonth: false
    })
  }
  
  // Next month fill (to complete 6 rows max)
  const remaining = 42 - cells.length
  const nextMonth = m === 11 ? 0 : m + 1
  const nextYear = m === 11 ? y + 1 : y
  for (let d = 1; d <= remaining; d++) {
    cells.push({
      day: d,
      dateString: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      otherMonth: true
    })
  }
  
  // Trim trailing empty row if possible
  if (cells.length > 35) {
    const lastRowStart = 35
    const lastRowAllOther = cells.slice(lastRowStart).every(c => c.otherMonth)
    if (lastRowAllOther) cells.splice(lastRowStart)
  }
  
  return cells
})

// Task count helpers
const hasDataForDate = (dateStr) => {
  const hasTasks = props.tasks.some(t => t.date === dateStr && !t.completed)
  const hasTables = props.dayTables.some(t => t.date === dateStr)
  return hasTasks || hasTables
}

const getTaskCountForMonth = (monthIdx) => {
  const monthPrefix = `${props.year}-${String(monthIdx + 1).padStart(2, '0')}`
  return props.tasks.filter(t => t.date.startsWith(monthPrefix) && !t.completed).length
}

// Navigation
const selectMonth = (monthIdx) => {
  displayMonth.value = monthIdx
  displayYear.value = props.year
  selectedDay.value = null
  emit('update:currentMonth', monthIdx)
  emit('update:viewLevel', 'days')
}

const prevMonth = () => {
  if (displayMonth.value === 0) {
    displayMonth.value = 11
    displayYear.value--
  } else {
    displayMonth.value--
  }
  selectedDay.value = null
  emit('update:currentMonth', displayMonth.value)
}

const nextMonth = () => {
  if (displayMonth.value === 11) {
    displayMonth.value = 0
    displayYear.value++
  } else {
    displayMonth.value++
  }
  selectedDay.value = null
  emit('update:currentMonth', displayMonth.value)
}

const selectDayCell = (cell) => {
  if (cell.otherMonth) return
  selectedDay.value = cell.dateString
  emit('select-day', cell.dateString)
}

const navigateToMonths = () => {
  selectedDay.value = null
  emit('update:currentMonth', null)
  emit('update:viewLevel', 'month')
}

// Swipe handling
const touchStartX = ref(0)
const handleTouchStart = (e) => {
  touchStartX.value = e.touches[0].clientX
}
const handleTouchEnd = (e) => {
  const diff = touchStartX.value - e.changedTouches[0].clientX
  if (Math.abs(diff) > 60) {
    if (diff > 0) nextMonth()
    else prevMonth()
  }
}
</script>

<template>
  <div class="calendar-wrapper">
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

    <!-- DAY GRID VIEW (M3 Date Picker) -->
    <div 
      v-else-if="viewLevel === 'days'" 
      class="calendar-grid-container"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
    >
      <!-- Back to months button -->
      <button class="back-to-months-btn" @click="navigateToMonths">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        Все месяцы
      </button>

      <!-- Month navigation header -->
      <div class="calendar-month-header">
        <button class="calendar-nav-btn" @click="prevMonth">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span class="calendar-month-title">{{ monthsList[displayMonth] }} {{ displayYear }}</span>
        <button class="calendar-nav-btn" @click="nextMonth">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <!-- Weekday headers -->
      <div class="calendar-weekday-header">
        <div v-for="wd in weekdayHeaders" :key="wd" class="calendar-weekday">{{ wd }}</div>
      </div>

      <!-- Day cells grid -->
      <div class="calendar-days-grid">
        <div 
          v-for="(cell, idx) in calendarCells" 
          :key="idx"
          class="calendar-day-cell"
          :class="{
            'other-month': cell.otherMonth,
            'today': cell.dateString === todayStr,
            'selected': cell.dateString === selectedDay
          }"
          @click="selectDayCell(cell)"
        >
          {{ cell.day }}
          <span v-if="hasDataForDate(cell.dateString)" class="calendar-day-dot"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calendar-grid-container {
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 16px;
  box-shadow: var(--shadow);
  border: 1px solid var(--surface-border);
  animation: fadeSlideUp 0.3s cubic-bezier(0.2, 0, 0, 1);
}

.back-to-months-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--primary);
  font-family: var(--font-family);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 4px;
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  transition: var(--transition-fast);
}

.back-to-months-btn:active {
  background: var(--primary-light);
}
</style>
