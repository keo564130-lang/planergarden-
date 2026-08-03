<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  year: { type: Number, default: 2026 },
  tasks: { type: Array, required: true },
  dayTables: { type: Array, default: () => [] }
})

const emit = defineEmits(['select-day'])

const expandedMonth = ref(null) // Which month is open (0-11 or null)
const selectedDay = ref(null)

const monthsList = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

const monthEmojis = ['❄️', '💨', '🌱', '🌸', '☀️', '🌻', '🍃', '🌾', '🍂', '🎃', '🍁', '🎄']

const weekdayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

// Today
const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const todayMonth = today.getMonth()

// Auto-expand current month on mount
if (expandedMonth.value === null) {
  expandedMonth.value = todayMonth
}

// Toggle accordion
const toggleMonth = (monthIdx) => {
  if (expandedMonth.value === monthIdx) {
    expandedMonth.value = null
  } else {
    expandedMonth.value = monthIdx
    selectedDay.value = null
  }
}

// Build day grid for a given month
const getCalendarCells = (monthIdx) => {
  const y = props.year
  const firstDay = new Date(y, monthIdx, 1)
  const lastDay = new Date(y, monthIdx + 1, 0)
  
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6
  
  const cells = []
  
  // Previous month padding
  if (startDow > 0) {
    const prevLastDay = new Date(y, monthIdx, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) {
      cells.push({ day: prevLastDay - i, dateString: '', otherMonth: true })
    }
  }
  
  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({
      day: d,
      dateString: `${y}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      otherMonth: false
    })
  }
  
  // Next month padding (fill to complete rows)
  const remaining = (7 - (cells.length % 7)) % 7
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, dateString: '', otherMonth: true })
  }
  
  return cells
}

// Task count for month
const getTaskCountForMonth = (monthIdx) => {
  const monthPrefix = `${props.year}-${String(monthIdx + 1).padStart(2, '0')}`
  return props.tasks.filter(t => t.date.startsWith(monthPrefix) && !t.completed).length
}

// Has data for specific date
const hasDataForDate = (dateStr) => {
  if (!dateStr) return false
  const hasTasks = props.tasks.some(t => t.date === dateStr && !t.completed)
  const hasTables = props.dayTables.some(t => t.date === dateStr)
  return hasTasks || hasTables
}

const selectDayCell = (cell) => {
  if (cell.otherMonth) return
  selectedDay.value = cell.dateString
  emit('select-day', cell.dateString)
}
</script>

<template>
  <div class="calendar-accordion">
    <div 
      v-for="(month, idx) in monthsList" 
      :key="idx" 
      class="month-section"
      :class="{ expanded: expandedMonth === idx }"
    >
      <!-- Month Header (tap to expand/collapse) -->
      <button 
        class="month-header" 
        @click="toggleMonth(idx)"
        :class="{ 
          'is-current': idx === todayMonth,
          'is-expanded': expandedMonth === idx 
        }"
      >
        <div class="month-header-left">
          <span class="month-emoji">{{ monthEmojis[idx] }}</span>
          <span class="month-label">{{ month }}</span>
        </div>
        <div class="month-header-right">
          <span 
            v-if="getTaskCountForMonth(idx) > 0" 
            class="month-badge"
          >
            {{ getTaskCountForMonth(idx) }}
          </span>
          <svg 
            class="chevron-icon" 
            :class="{ rotated: expandedMonth === idx }"
            width="20" height="20" viewBox="0 0 24 24" 
            fill="none" stroke="currentColor" 
            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </button>

      <!-- Days Grid (accordion content) -->
      <transition name="accordion">
        <div v-if="expandedMonth === idx" class="days-panel">
          <!-- Weekday headers -->
          <div class="weekday-row">
            <span v-for="wd in weekdayHeaders" :key="wd" class="weekday-cell">{{ wd }}</span>
          </div>

          <!-- Day cells -->
          <div class="days-grid">
            <button
              v-for="(cell, ci) in getCalendarCells(idx)"
              :key="ci"
              class="day-cell"
              :class="{
                'other-month': cell.otherMonth,
                'is-today': cell.dateString === todayStr,
                'is-selected': cell.dateString === selectedDay,
                'has-data': hasDataForDate(cell.dateString)
              }"
              :disabled="cell.otherMonth"
              @click="selectDayCell(cell)"
            >
              <span class="day-num">{{ cell.day }}</span>
              <span v-if="hasDataForDate(cell.dateString)" class="day-indicator"></span>
            </button>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.calendar-accordion {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ---- Month Header ---- */
.month-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  cursor: pointer;
  font-family: var(--font-family);
  transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
  box-shadow: var(--shadow);
}

.month-header.is-expanded {
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  border-bottom-color: transparent;
  background: var(--primary-light);
}

.month-header.is-current {
  border-color: var(--primary);
}

.month-header:active {
  transform: scale(0.98);
}

.month-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.month-emoji {
  font-size: 20px;
  line-height: 1;
}

.month-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
}

.month-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.month-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: var(--text-on-primary);
  min-width: 24px;
  text-align: center;
}

.chevron-icon {
  color: var(--text-muted);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.chevron-icon.rotated {
  transform: rotate(180deg);
}

/* ---- Days Panel ---- */
.days-panel {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-top: none;
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  padding: 8px 12px 16px 12px;
  box-shadow: var(--shadow);
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}

.weekday-cell {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  padding: 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.day-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: var(--radius-full);
  transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
  position: relative;
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
  padding: 0;
  gap: 1px;
}

.day-cell:active:not(.other-month) {
  transform: scale(0.88);
  background: var(--surface-secondary);
}

.day-cell.other-month {
  opacity: 0.25;
  cursor: default;
}

.day-cell.is-today .day-num {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--primary);
  border-radius: 50%;
  font-weight: 700;
  color: var(--primary);
}

.day-cell.is-selected .day-num {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary);
  color: var(--text-on-primary);
  border-radius: 50%;
  font-weight: 700;
  border: none;
}

.day-indicator {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--primary);
  position: absolute;
  bottom: 2px;
}

.day-cell.is-selected .day-indicator {
  background: var(--text-on-primary);
}

/* ---- Accordion Animation ---- */
.accordion-enter-active {
  animation: accordionOpen 0.35s cubic-bezier(0.2, 0, 0, 1);
}

.accordion-leave-active {
  animation: accordionClose 0.25s cubic-bezier(0.4, 0, 1, 1);
}

@keyframes accordionOpen {
  0% {
    opacity: 0;
    max-height: 0;
    transform: translateY(-8px);
  }
  100% {
    opacity: 1;
    max-height: 400px;
    transform: translateY(0);
  }
}

@keyframes accordionClose {
  0% {
    opacity: 1;
    max-height: 400px;
  }
  100% {
    opacity: 0;
    max-height: 0;
  }
}
</style>
