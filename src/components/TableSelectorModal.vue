<script setup>
import { ref } from 'vue'

const emit = defineEmits(['select', 'cancel'])

const templates = [
  {
    id: 'grid-2x2',
    name: 'Грядка 2х2',
    rows: 2,
    cols: 2,
    headers: []
  },
  {
    id: 'grid-3x3',
    name: 'Грядка 3х3',
    rows: 3,
    cols: 3,
    headers: []
  },
  {
    id: 'params',
    name: 'Параметры (2х3)',
    rows: 3,
    cols: 2,
    headers: ['Свойство', 'Значение']
  },
  {
    id: 'watering',
    name: 'Дневник полива (3х2)',
    rows: 2,
    cols: 3,
    headers: ['Культура', 'Утро', 'Вечер']
  },
  {
    id: 'sublist',
    name: 'Список дел (1х4)',
    rows: 4,
    cols: 1,
    headers: []
  },
  {
    id: 'measures',
    name: 'Замеры (3х3)',
    rows: 3,
    cols: 3,
    headers: ['Дата', 'Параметр', 'Запись']
  }
]

const handleSelect = (template) => {
  // Construct an empty table structure based on template rules
  const tableData = {
    templateId: template.id,
    name: template.name,
    headers: [...template.headers],
    // Create an empty rows array of dimensions rows x cols
    rows: Array.from({ length: template.rows }, () => 
      Array.from({ length: template.cols }, () => '')
    )
  }
  emit('select', tableData)
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<template>
  <div class="modal-scrim" @click.self="handleCancel">
    <div class="picker-island table-selector-island">
      <div class="picker-header">
        <h3 class="picker-title">Выберите шаблон таблицы</h3>
      </div>
      
      <!-- Vertical scrolling list of template cards -->
      <div class="templates-scroll-list">
        <div 
          v-for="tmpl in templates" 
          :key="tmpl.id" 
          class="template-card"
          @click="handleSelect(tmpl)"
        >
          <div class="template-info">
            <span class="template-card-name">{{ tmpl.name }}</span>
            <span class="template-card-dims">
              Ячеек: {{ tmpl.cols }} &times; {{ tmpl.rows }}
            </span>
          </div>
          
          <!-- Miniature visual mock representation of the grid layout -->
          <div class="mini-grid-preview" :class="tmpl.id">
            <!-- Headers if any -->
            <div v-if="tmpl.headers.length > 0" class="mini-row mini-headers">
              <div 
                v-for="(header, hIdx) in tmpl.headers" 
                :key="hIdx" 
                class="mini-cell mini-header-cell"
              ></div>
            </div>
            <!-- Rows -->
            <div 
              v-for="r in tmpl.rows" 
              :key="r" 
              class="mini-row"
            >
              <div 
                v-for="c in tmpl.cols" 
                :key="c" 
                class="mini-cell"
              ></div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="picker-footer">
        <button class="picker-btn cancel" @click="handleCancel">Отмена</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-selector-island {
  width: 320px;
  max-height: 520px;
}

.templates-scroll-list {
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 380px;
  scrollbar-width: none;
}

.templates-scroll-list::-webkit-scrollbar {
  display: none;
}

.template-card {
  background: var(--surface-secondary);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: var(--transition);
}

.template-card:hover {
  border-color: var(--primary);
  background: var(--surface);
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.template-card:active {
  transform: scale(0.98);
}

.template-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.template-card-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}

.template-card-dims {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

/* Mini visual grid representations */
.mini-grid-preview {
  display: flex;
  flex-direction: column;
  width: 90px;
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  overflow: hidden;
  background: var(--surface);
}

.mini-row {
  display: flex;
  height: 12px;
}

.mini-cell {
  flex: 1;
  border-right: 1px solid var(--surface-border);
  border-bottom: 1px solid var(--surface-border);
}

.mini-cell:last-child {
  border-right: none;
}

.mini-row:last-child .mini-cell {
  border-bottom: none;
}

/* Styling headers and custom widths in mini-grids */
.mini-headers {
  background: var(--primary-light);
  height: 10px;
}

.mini-header-cell {
  background: rgba(46, 125, 50, 0.15);
}

/* Custom column sizing for Parameter/Watering layout previews */
.mini-grid-preview.params .mini-cell:first-child {
  flex: 0 0 40%;
}
.mini-grid-preview.params .mini-cell:last-child {
  flex: 0 0 60%;
}

.mini-grid-preview.watering .mini-cell:first-child {
  flex: 0 0 50%;
}
.mini-grid-preview.watering .mini-cell:nth-child(2),
.mini-grid-preview.watering .mini-cell:nth-child(3) {
  flex: 0 0 25%;
}
</style>
