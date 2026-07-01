<script setup>
import { computed } from 'vue'

const props = defineProps({
  dayTables: {
    type: Array,
    required: true
  },
  selectedDate: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['create-table', 'delete-table', 'update-table', 'open-time-picker'])

// Filter tables by active date
const filteredTables = computed(() => {
  return props.dayTables.filter(table => table.date === props.selectedDate)
})

const handleCreateTableClick = () => {
  emit('create-table')
}

const handleDeleteTableClick = (tableId) => {
  emit('delete-table', tableId)
}

// Add a new row to the table
const handleAddRow = (table) => {
  const colsCount = table.rows[0] ? table.rows[0].length : (table.headers.length || 1)
  table.rows.push(Array(colsCount).fill(''))
  // Force sync immediately when a row is added
  triggerTableUpdate(table, true)
}

const handleTimeClick = (table) => {
  emit('open-time-picker', (time) => {
    table.time = time
    triggerTableUpdate(table, true)
  })
}

const handleClearTime = (table) => {
  table.time = null
  triggerTableUpdate(table, true)
}

// Debounce cloud sync updates
let updateTimeout = null
const triggerTableUpdate = (table, force = false) => {
  if (updateTimeout) clearTimeout(updateTimeout)
  
  const performUpdate = () => {
    emit('update-table', {
      id: table.id,
      name: table.name,
      time: table.time,
      rows: JSON.parse(JSON.stringify(table.rows)) // deep copy
    })
  }

  if (force) {
    performUpdate()
  } else {
    updateTimeout = setTimeout(performUpdate, 800)
  }
}

// Format readable date
const getReadableDateString = (dateStr) => {
  const parts = dateStr.split('-')
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ]
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
  return `${date.getDate()} ${months[date.getMonth()]}, ${days[date.getDay()]}`
}
</script>

<template>
  <div class="day-tables-container">
    <!-- Create Table Button -->
    <button 
      type="button" 
      class="create-table-btn" 
      @click="handleCreateTableClick"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
      Создать таблицу
    </button>

    <h4 class="date-header">{{ getReadableDateString(selectedDate) }}</h4>

    <!-- Empty State -->
    <div v-if="filteredTables.length === 0" class="empty-state">
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
        <line x1="15" y1="3" x2="15" y2="21"></line>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="3" y1="15" x2="21" y2="15"></line>
      </svg>
      <span class="empty-text">На этот день еще нет таблиц.<br>Создайте схему посадок или дневник заметок!</span>
    </div>

    <!-- Active Tables Listing -->
    <div v-else class="tables-cards-list">
      <div 
        v-for="table in filteredTables" 
        :key="table.id" 
        class="standalone-table-card"
      >
        <!-- Table Header (Inline Title Editing & Delete Action) -->
        <div class="table-card-header">
          <input 
            v-model="table.name" 
            type="text" 
            class="table-card-title-input" 
            placeholder="Назовите таблицу..." 
            @input="triggerTableUpdate(table, false)"
            @blur="triggerTableUpdate(table, true)"
          />
          <button 
            type="button" 
            class="table-time-btn" 
            :class="{ active: table.time }"
            @click="handleTimeClick(table)"
            title="Установить время напоминания"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span v-if="table.time" class="table-time-text">{{ table.time }}</span>
          </button>
          
          <button 
            v-if="table.time"
            type="button"
            class="clear-table-time-btn"
            @click="handleClearTime(table)"
            title="Сбросить время"
          >
            &times;
          </button>

          <button 
            type="button" 
            class="delete-table-card-btn" 
            @click="handleDeleteTableClick(table.id)"
            title="Удалить таблицу"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>

        <!-- Rendered Grid -->
        <div class="table-responsive-wrapper">
          <table class="embedded-task-table" :class="table.templateId">
            <!-- Headers if any -->
            <thead v-if="table.headers && table.headers.length > 0">
              <tr>
                <th v-for="(h, hIdx) in table.headers" :key="hIdx">
                  {{ h }}
                </th>
              </tr>
            </thead>
            <!-- Rows -->
            <tbody>
              <tr v-for="(row, rIdx) in table.rows" :key="rIdx">
                <td v-for="(cell, cIdx) in row" :key="cIdx">
                  <input 
                    v-model="row[cIdx]" 
                    type="text" 
                    class="cell-input" 
                    placeholder="..."
                    @input="triggerTableUpdate(table, false)"
                    @blur="triggerTableUpdate(table, true)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Add Row Button -->
        <button 
          type="button" 
          class="add-row-btn" 
          @click="handleAddRow(table)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Добавить строку
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.day-tables-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.create-table-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-family);
  box-shadow: var(--shadow);
  transition: var(--transition);
}

.create-table-btn:active {
  transform: scale(0.98);
}

.date-header {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-top: 4px;
}

.tables-cards-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 24px;
}

.standalone-table-card {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: var(--transition);
}

.table-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--surface-secondary);
  border-bottom: 1px solid var(--surface-border);
}

.table-card-title-input {
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  background: transparent;
  border: none;
  outline: none;
  flex: 1;
  padding: 2px 0;
  border-bottom: 1px dashed transparent;
  transition: var(--transition);
}

.table-card-title-input:focus {
  border-bottom-color: var(--primary);
  color: var(--primary);
}

.delete-table-card-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  opacity: 0.6;
}

.delete-table-card-btn:hover {
  background: hsl(0, 80%, 96%);
  color: hsl(0, 80%, 50%);
  opacity: 1;
}

@media (prefers-color-scheme: dark) {
  .delete-table-card-btn:hover {
    background: hsl(0, 60%, 18%);
    color: hsl(0, 80%, 60%);
  }
}

.add-row-btn {
  width: 100%;
  border: none;
  background: var(--surface-secondary);
  border-top: 1px solid var(--surface-border);
  padding: 10px;
  font-family: var(--font-family);
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: var(--transition);
}

.add-row-btn:hover {
  background: var(--primary-light);
}

.add-row-btn:active {
  background: hsl(var(--primary-hue), 30%, 88%);
}

.table-time-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--surface-secondary);
  border: 1px solid var(--surface-border);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  font-family: var(--font-family);
  font-size: 11px;
  font-weight: 600;
  transition: var(--transition);
  margin-right: 2px;
  flex-shrink: 0;
}

.table-time-btn.active {
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent);
}

.table-time-btn:active {
  transform: scale(0.95);
}

.clear-table-time-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-right: 6px;
  border-radius: 50%;
  transition: var(--transition);
  flex-shrink: 0;
}

.clear-table-time-btn:hover {
  background: var(--surface-secondary);
  color: #ff3b30;
}
</style>
