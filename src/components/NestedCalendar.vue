<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  year: { type: Number, default: 2026 },
  tasks: { type: Array, required: true },
  dayTables: { type: Array, default: () => [] }
})

const emit = defineEmits(['select-day'])

const selectedDay = ref(null)

const months = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'
]

const wd = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const getGrid = (mi) => {
  const y = props.year
  const first = new Date(y, mi, 1)
  const last = new Date(y, mi + 1, 0).getDate()
  let dow = first.getDay() - 1
  if (dow < 0) dow = 6
  const cells = []
  for (let i = 0; i < dow; i++) cells.push(null)
  for (let d = 1; d <= last; d++) cells.push(d)
  return cells
}

const dateStr = (mi, d) => {
  return `${props.year}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const hasData = (mi, d) => {
  const ds = dateStr(mi, d)
  return props.tasks.some(t => t.date === ds && !t.completed) || props.dayTables.some(t => t.date === ds)
}

const isToday = (mi, d) => dateStr(mi, d) === todayStr

const selectDay = (mi, d) => {
  const ds = dateStr(mi, d)
  selectedDay.value = ds
  emit('select-day', ds)
}
</script>

<template>
  <div class="year-calendar">
    <div class="year-header">
      <h2 class="year-title">{{ year }}</h2>
    </div>

    <div class="months-grid">
      <div v-for="(name, mi) in months" :key="mi" class="mini-month">
        <div class="mini-month-name">{{ name }}</div>
        <div class="mini-weekdays">
          <span v-for="w in wd" :key="w">{{ w }}</span>
        </div>
        <div class="mini-days">
          <span
            v-for="(cell, ci) in getGrid(mi)"
            :key="ci"
            class="mini-day"
            :class="{
              empty: cell === null,
              today: cell && isToday(mi, cell),
              selected: cell && dateStr(mi, cell) === selectedDay,
              'has-dot': cell && hasData(mi, cell),
              weekend: cell && ((ci % 7 === 5) || (ci % 7 === 6))
            }"
            @click="cell && selectDay(mi, cell)"
          >{{ cell || '' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.year-calendar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.year-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.year-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.months-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.mini-month {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding: 10px;
  box-shadow: var(--shadow);
}

.mini-month-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
  text-transform: lowercase;
  margin-bottom: 6px;
}

.mini-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 2px;
}

.mini-weekdays span {
  text-align: center;
  font-size: 9px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 2px 0;
  text-transform: uppercase;
}

.mini-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.mini-day {
  text-align: center;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-main);
  padding: 3px 0;
  cursor: pointer;
  border-radius: 50%;
  position: relative;
  line-height: 1;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-day:active:not(.empty) {
  background: var(--surface-secondary);
}

.mini-day.empty {
  cursor: default;
}

.mini-day.weekend {
  color: var(--text-muted);
}

.mini-day.today {
  background: var(--primary);
  color: var(--text-on-primary);
  font-weight: 700;
}

.mini-day.selected {
  outline: 2px solid var(--primary);
  outline-offset: -1px;
  font-weight: 700;
}

.mini-day.has-dot::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--primary);
}

.mini-day.today.has-dot::after {
  background: var(--text-on-primary);
}
</style>
