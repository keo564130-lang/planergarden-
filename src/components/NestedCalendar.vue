<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  year: { type: Number, default: 2026 },
  tasks: { type: Array, required: true },
  dayTables: { type: Array, default: () => [] }
})

const emit = defineEmits(['select-day'])

const level = ref('months') // 'months' or 'days'
const activeMonth = ref(null)
const selectedDay = ref(null)

const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

const wd = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const today = new Date()
const todayYear = today.getFullYear()
const todayMonth = today.getMonth()
const todayDate = today.getDate()
const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`

// Count tasks for month badge
const getMonthTaskCount = (mi) => {
  const prefix = `${props.year}-${String(mi + 1).padStart(2, '0')}`
  return props.tasks.filter(t => t.date && t.date.startsWith(prefix) && !t.completed).length
}

// Open month → day grid
const openMonth = (mi) => {
  activeMonth.value = mi
  level.value = 'days'
}

// Back to months
const goBack = () => {
  level.value = 'months'
  activeMonth.value = null
}

// Navigate months with arrows
const prevMonth = () => {
  if (activeMonth.value > 0) activeMonth.value--
}
const nextMonth = () => {
  if (activeMonth.value < 11) activeMonth.value++
}

// Build grid for active month
const dayGrid = computed(() => {
  if (activeMonth.value === null) return []
  const y = props.year
  const mi = activeMonth.value
  const first = new Date(y, mi, 1)
  const last = new Date(y, mi + 1, 0).getDate()
  let dow = first.getDay() - 1
  if (dow < 0) dow = 6

  const cells = []
  // Padding
  const prevLast = new Date(y, mi, 0).getDate()
  for (let i = dow - 1; i >= 0; i--) {
    cells.push({ day: prevLast - i, current: false, dateStr: '' })
  }
  // Days
  for (let d = 1; d <= last; d++) {
    const ds = `${y}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, current: true, dateStr: ds })
  }
  // Fill remaining row
  const rem = (7 - (cells.length % 7)) % 7
  for (let d = 1; d <= rem; d++) {
    cells.push({ day: d, current: false, dateStr: '' })
  }
  return cells
})

const hasData = (ds) => {
  if (!ds) return false
  return props.tasks.some(t => t.date === ds && !t.completed) || props.dayTables.some(t => t.date === ds)
}

const tapDay = (cell) => {
  if (!cell.current) return
  selectedDay.value = cell.dateStr
  emit('select-day', cell.dateStr)
}
</script>

<template>
  <div class="calendar-root">
    <!-- LEVEL 1: Month cards -->
    <div v-if="level === 'months'" class="months-view">
      <div class="months-grid">
        <button
          v-for="(name, mi) in monthNames"
          :key="mi"
          class="month-card"
          :class="{ 'is-current': mi === todayMonth && year === todayYear }"
          @click="openMonth(mi)"
        >
          <span class="month-name">{{ name }}</span>
          <span v-if="getMonthTaskCount(mi) > 0" class="month-badge">{{ getMonthTaskCount(mi) }}</span>
        </button>
      </div>
    </div>

    <!-- LEVEL 2: Day grid -->
    <div v-else class="days-view">
      <div class="days-header">
        <button class="nav-arrow" @click="prevMonth" :disabled="activeMonth === 0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="days-title">{{ monthNames[activeMonth] }} {{ year }}</span>
        <button class="nav-arrow" @click="nextMonth" :disabled="activeMonth === 11">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="weekday-row">
        <span v-for="w in wd" :key="w" class="weekday-label">{{ w }}</span>
      </div>

      <div class="day-grid">
        <button
          v-for="(cell, ci) in dayGrid"
          :key="ci"
          class="day-btn"
          :class="{
            'other': !cell.current,
            'today': cell.dateStr === todayStr,
            'selected': cell.dateStr === selectedDay,
            'has-dot': hasData(cell.dateStr)
          }"
          :disabled="!cell.current"
          @click="tapDay(cell)"
        >
          <span class="day-number">{{ cell.day }}</span>
          <span v-if="hasData(cell.dateStr)" class="dot"></span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-root {
  display: flex;
  flex-direction: column;
}

/* === Months Grid === */
.months-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.month-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px 8px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-family: var(--font-family);
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: var(--shadow);
  position: relative;
}

.month-card:active {
  transform: scale(0.96);
}

.month-card.is-current {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}

.month-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.month-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: var(--text-on-primary);
}

/* === Days View === */
.days-view {
  display: flex;
  flex-direction: column;
}

.days-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 16px 0;
}

.days-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
}

.nav-arrow {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  border: none;
  background: transparent;
  color: var(--text-main);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-arrow:disabled {
  opacity: 0.3;
  cursor: default;
}

.nav-arrow:active:not(:disabled) {
  background: var(--surface-secondary);
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}

.weekday-label {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 6px 0;
}

.day-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.day-btn {
  aspect-ratio: 1;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: var(--radius-full);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  font-family: var(--font-family);
  padding: 0;
  gap: 2px;
}

.day-btn:active:not(.other) {
  background: var(--surface-secondary);
}

.day-number {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-main);
  line-height: 1;
}

.day-btn.other .day-number {
  color: var(--text-muted);
  opacity: 0.35;
}

.day-btn.today {
  background: var(--primary);
}

.day-btn.today .day-number {
  color: var(--text-on-primary);
  font-weight: 700;
}

.day-btn.selected {
  outline: 2px solid var(--primary);
  outline-offset: -1px;
}

.day-btn.selected .day-number {
  font-weight: 700;
  color: var(--primary);
}

.day-btn.today.selected {
  outline-color: var(--text-on-primary);
}

.day-btn.today.selected .day-number {
  color: var(--text-on-primary);
}

.dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--primary);
  position: absolute;
  bottom: 4px;
}

.day-btn.today .dot {
  background: var(--text-on-primary);
}
</style>
