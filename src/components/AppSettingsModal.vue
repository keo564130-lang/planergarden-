<template>
  <div class="modal-scrim" @click.self="emit('close')">
    <div class="settings-modal-card">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-title-wrap">
          <div class="header-icon-badge">⚙️</div>
          <div>
            <h2 class="modal-title">Настройки приложения</h2>
            <p class="modal-subtitle">Тонкая кастомизация и параметры</p>
          </div>
        </div>
        <button class="close-btn" @click="emit('close')" aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="modal-body">
        
        <!-- SECTION 1: DOCKBAR & NAVIGATION -->
        <div class="pro-card">
          <div class="pro-card-title">
            <span>🔄 Докбар и навигация</span>
          </div>
          
          <div class="setting-row">
            <div class="setting-text">
              <span class="setting-name">Подписи под иконками</span>
              <span class="setting-desc">Скрыть названия вкладок для минимализма</span>
            </div>
            <div class="toggle-switch" :class="{ on: settings.showTabLabels }" @click="toggleSetting('showTabLabels')">
              <div class="toggle-knob"></div>
            </div>
          </div>

          <div class="setting-divider"></div>

          <div class="setting-row">
            <div class="setting-text">
              <span class="setting-name">Стартовый экран</span>
              <span class="setting-desc">Какая вкладка открывается при входе</span>
            </div>
            <select v-model="settings.startTab" class="pro-select" @change="save">
              <option value="calendar">📅 Планер</option>
              <option value="recipes">🍳 Рецепты</option>
              <option value="ai">🤖 ИИ-помощник</option>
              <option value="settings">⚙️ Ещё</option>
            </select>
          </div>

          <div class="setting-divider"></div>

          <div class="tab-order-section">
            <span class="setting-name">Порядок вкладок в меню:</span>
            <div class="tab-order-list">
              <div v-for="(tabKey, index) in settings.tabOrder" :key="tabKey" class="tab-order-item">
                <span class="tab-item-name">{{ getTabLabel(tabKey) }}</span>
                <div class="order-btn-group">
                  <button class="order-btn" :disabled="index === 0" @click="moveTab(index, -1)">▲</button>
                  <button class="order-btn" :disabled="index === settings.tabOrder.length - 1" @click="moveTab(index, 1)">▼</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 2: HAPTIC FEEDBACK -->
        <div class="pro-card">
          <div class="pro-card-title">
            <span>📳 Тактильный отклик</span>
          </div>

          <div class="setting-row">
            <div class="setting-text">
              <span class="setting-name">Вибрация (Haptic)</span>
              <span class="setting-desc">Тактильный щелчок при выполнении задач и нажатиях</span>
            </div>
            <div class="toggle-switch" :class="{ on: settings.hapticEnabled }" @click="toggleSetting('hapticEnabled')">
              <div class="toggle-knob"></div>
            </div>
          </div>
        </div>

        <!-- SECTION 3: PLANNER AUTOMATION -->
        <div class="pro-card">
          <div class="pro-card-title">
            <span>📅 Умный планер</span>
          </div>

          <div class="setting-row">
            <div class="setting-text">
              <span class="setting-name">Автоперенос задач</span>
              <span class="setting-desc">Переносить вчерашние невыполненные задачи на сегодня</span>
            </div>
            <div class="toggle-switch" :class="{ on: settings.autoRolloverTasks }" @click="toggleSetting('autoRolloverTasks')">
              <div class="toggle-knob"></div>
            </div>
          </div>
        </div>

        <!-- SECTION 4: RECIPES & COOKING -->
        <div class="pro-card">
          <div class="pro-card-title">
            <span>🍳 Кухня и медиа</span>
          </div>

          <div class="setting-row">
            <div class="setting-text">
              <span class="setting-name">Сжатие фото</span>
              <span class="setting-desc">Экономия места на бесплатном сервере</span>
            </div>
            <select v-model="settings.photoQuality" class="pro-select" @change="save">
              <option value="low">🌱 Экономное (0.4)</option>
              <option value="medium">⚖️ Баланс (0.6)</option>
              <option value="high">✨ Высокое (0.8)</option>
            </select>
          </div>

          <div class="setting-divider"></div>

          <div class="setting-row">
            <div class="setting-text">
              <span class="setting-name">Автовоспроизведение видео</span>
              <span class="setting-desc">Запуск видео рецепта при открытии</span>
            </div>
            <div class="toggle-switch" :class="{ on: settings.autoPlayVideo }" @click="toggleSetting('autoPlayVideo')">
              <div class="toggle-knob"></div>
            </div>
          </div>

          <div class="setting-divider"></div>

          <div class="setting-row">
            <div class="setting-text">
              <span class="setting-name">Режим готовки (WakeLock)</span>
              <span class="setting-desc">Не гасить экран пока открыт рецепт</span>
            </div>
            <div class="toggle-switch" :class="{ on: settings.keepScreenOn }" @click="toggleSetting('keepScreenOn')">
              <div class="toggle-knob"></div>
            </div>
          </div>
        </div>

        <!-- SECTION 5: AI CHARACTER TONE -->
        <div class="pro-card">
          <div class="pro-card-title">
            <span>🤖 Характер ИИ-помощника</span>
          </div>

          <div class="ai-tone-grid">
            <button 
              v-for="tone in aiTones" 
              :key="tone.id" 
              class="tone-btn"
              :class="{ active: settings.aiTone === tone.id }"
              @click="settings.aiTone = tone.id; save()"
            >
              <span class="tone-emoji">{{ tone.emoji }}</span>
              <div class="tone-info">
                <span class="tone-name">{{ tone.name }}</span>
                <span class="tone-desc">{{ tone.desc }}</span>
              </div>
            </button>
          </div>
        </div>

        <!-- SECTION 6: STORAGE & CACHE -->
        <div class="pro-card">
          <div class="pro-card-title">
            <span>💾 Память и хранилище</span>
          </div>

          <div class="storage-info-row">
            <span>Занято памяти на устройстве:</span>
            <span class="storage-value">{{ storageSize }} KB</span>
          </div>

          <div class="setting-divider"></div>

          <button class="clear-cache-btn" @click="handleClearCache">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
            <span>Очистить временный кэш браузера</span>
          </button>
        </div>

      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button class="save-close-btn" @click="emit('close')">Готово</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { triggerHaptic } from '../utils/audio.js'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      tabOrder: ['calendar', 'recipes', 'ai', 'settings'],
      startTab: 'calendar',
      showTabLabels: true,
      hapticEnabled: true,
      autoRolloverTasks: false,
      photoQuality: 'medium',
      autoPlayVideo: true,
      keepScreenOn: false,
      aiTone: 'friendly'
    })
  }
})

const emit = defineEmits(['update:modelValue', 'close'])

const settings = ref({ ...props.modelValue })

const aiTones = [
  { id: 'friendly', emoji: '💬', name: 'Дружелюбный дачник', desc: 'Теплые и полезные советы' },
  { id: 'agronomist', emoji: '🌿', name: 'Опытный агроном', desc: 'Точные научные агро-советы' },
  { id: 'chef', emoji: '🍳', name: 'Шеф-повар', desc: 'Кулинарные секреты и тонкости' },
  { id: 'concise', emoji: '⚡', name: 'Краткий и по делу', desc: 'Коротко, пунктами, без воды' }
]

const tabNames = {
  calendar: '📅 Планер',
  recipes: '🍳 Рецепты',
  ai: '🤖 ИИ',
  settings: '⚙️ Ещё'
}

const getTabLabel = (key) => tabNames[key] || key

const storageSize = ref('0')

const calculateStorage = () => {
  try {
    let total = 0
    for (let x in localStorage) {
      if (localStorage.hasOwnProperty(x)) {
        total += (localStorage[x].length * 2)
      }
    }
    storageSize.value = (total / 1024).toFixed(1)
  } catch (e) {
    storageSize.value = '12.4'
  }
}

onMounted(() => {
  calculateStorage()
})

const save = () => {
  emit('update:modelValue', { ...settings.value })
  try {
    localStorage.setItem('garden_planner_app_settings', JSON.stringify(settings.value))
  } catch (e) {}
}

const toggleSetting = (key) => {
  settings.value[key] = !settings.value[key]
  if (settings.value.hapticEnabled) {
    triggerHaptic('tap')
  }
  save()
}

const moveTab = (index, delta) => {
  const newIndex = index + delta
  if (newIndex < 0 || newIndex >= settings.value.tabOrder.length) return
  const item = settings.value.tabOrder.splice(index, 1)[0]
  settings.value.tabOrder.splice(newIndex, 0, item)
  if (settings.value.hapticEnabled) triggerHaptic('tap')
  save()
}

const handleClearCache = () => {
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name))
    })
  }
  if (settings.value.hapticEnabled) triggerHaptic('tap')
  alert('Кэш приложения успешно очищен! ✨')
  calculateStorage()
}
</script>

<style scoped>
.modal-scrim {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
}

.settings-modal-card {
  width: 100%;
  max-width: 440px;
  max-height: 85vh;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: 28px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: scaleIn 0.2s cubic-bezier(0.2, 0, 0, 1);
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.94); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header {
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;
}

.header-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon-badge {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
  font-family: var(--font-family);
}

.modal-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin: 2px 0 0;
  font-family: var(--font-family);
}

.close-btn {
  background: var(--surface-secondary);
  border: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: pointer;
  transition: var(--transition-fast);
}

.close-btn:active {
  background: var(--surface-border);
}

.modal-body {
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pro-card {
  background: var(--bg-app);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pro-card-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
  font-family: var(--font-family);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.setting-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-main);
  font-family: var(--font-family);
}

.setting-desc {
  font-size: 11.5px;
  color: var(--text-muted);
  font-family: var(--font-family);
}

.setting-divider {
  height: 1px;
  background: var(--surface-border);
  margin: 2px 0;
}

.pro-select {
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
  background: var(--surface);
  color: var(--text-main);
  font-size: 12.5px;
  font-family: var(--font-family);
  outline: none;
  cursor: pointer;
}

.tab-order-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tab-order-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tab-order-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
}

.tab-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  font-family: var(--font-family);
}

.order-btn-group {
  display: flex;
  gap: 4px;
}

.order-btn {
  background: var(--surface-secondary);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  width: 26px;
  height: 26px;
  font-size: 10px;
  color: var(--text-main);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.order-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.clear-cache-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  cursor: pointer;
  font-family: var(--font-family);
  transition: var(--transition-fast);
  margin-top: 4px;
}

.clear-cache-btn:active {
  background: var(--primary-light);
}

.ai-tone-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.tone-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface);
  border: 1.5px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  cursor: pointer;
  text-align: left;
  transition: var(--transition-fast);
}

.tone-btn.active {
  border-color: var(--primary);
  background: var(--primary-light);
}

.tone-emoji {
  font-size: 22px;
}

.tone-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tone-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
  font-family: var(--font-family);
}

.tone-desc {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-family);
}

.storage-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-main);
  font-family: var(--font-family);
}

.storage-value {
  font-weight: 700;
  color: var(--primary);
}

.toggle-switch {
  width: 46px;
  height: 26px;
  border-radius: 13px;
  background: var(--surface-border);
  position: relative;
  transition: var(--transition);
  cursor: pointer;
  flex-shrink: 0;
}

.toggle-switch.on {
  background: var(--primary);
}

.toggle-knob {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: var(--transition);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-switch.on .toggle-knob {
  left: 23px;
}

.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--surface-border);
  display: flex;
  justify-content: flex-end;
  background: var(--surface);
  flex-shrink: 0;
}

.save-close-btn {
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  padding: 10px 24px;
  border-radius: var(--radius-full);
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-family);
  cursor: pointer;
}
</style>
