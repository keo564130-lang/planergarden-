<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  year: { type: Number, default: 2026 },
  tasks: { type: Array, required: true },
  dayTables: { type: Array, default: () => [] }
})

const emit = defineEmits(['select-day'])

const today = new Date()
const todayYear = today.getFullYear()
const todayMonth = today.getMonth()
const todayDate = today.getDate()
const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`

const currentMonth = ref(todayMonth)
const selectedDay = ref(null)

const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

const wd = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const prevMonth = () => { if (currentMonth.value > 0) currentMonth.value-- }
const nextMonth = () => { if (currentMonth.value < 11) currentMonth.value++ }

const dayGrid = computed(() => {
  const y = props.year
  const mi = currentMonth.value
  const first = new Date(y, mi, 1)
  const last = new Date(y, mi + 1, 0).getDate()
  let dow = first.getDay() - 1
  if (dow < 0) dow = 6

  const cells = []
  const prevLast = new Date(y, mi, 0).getDate()
  for (let i = dow - 1; i >= 0; i--) {
    cells.push({ day: prevLast - i, current: false, dateStr: '' })
  }
  for (let d = 1; d <= last; d++) {
    const ds = `${y}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, current: true, dateStr: ds })
  }
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
  <div class="cal">
    <div class="cal-header">
      <button class="cal-arrow" @click="prevMonth" :disabled="currentMonth === 0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span class="cal-title">{{ monthNames[currentMonth] }} {{ year }}</span>
      <button class="cal-arrow" @click="nextMonth" :disabled="currentMonth === 11">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <div class="cal-weekdays">
      <span v-for="w in wd" :key="w">{{ w }}</span>
    </div>

    <div class="cal-grid">
      <button
        v-for="(cell, ci) in dayGrid"
        :key="ci"
        class="cal-day"
        :class="{
          other: !cell.current,
          today: cell.dateStr === todayStr,
          selected: cell.dateStr === selectedDay,
          dot: hasData(cell.dateStr)
        }"
        :disabled="!cell.current"
        @click="tapDay(cell)"
      >
        {{ cell.day }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.cal {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 16px;
  box-shadow: var(--shadow);
  border: 1px solid var(--surface-border);
}

.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.cal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
}

.cal-arrow {
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
.cal-arrow:disabled { opacity: 0.2; }
.cal-arrow:active:not(:disabled) { background: var(--surface-secondary); }

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 8px;
}
.cal-weekdays span {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cal-day {
  aspect-ratio: 1;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 8px;
  font-family: var(--font-family);
  font-size: 15px;
  font-weight: 500;
  color: var(--text-main);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.cal-day:active:not(.other) { background: var(--surface-secondary); }
.cal-day.other { color: var(--text-muted); opacity: 0.3; cursor: default; }
.cal-day.today { background: var(--primary); color: var(--text-on-primary); font-weight: 700; border-radius: 50%; }
.cal-day.selected:not(.today) { background: var(--primary-light); color: var(--text-on-primary); font-weight: 700; border-radius: 50%; }
.cal-day.dot { background: var(--primary-container); color: var(--on-primary-container); font-weight: 600; }
.cal-day.today.dot { background: var(--primary); color: var(--text-on-primary); }
.cal-day.selected.dot { background: var(--primary-light); color: var(--text-on-primary); }
</style>
