<template>
  <div class="update-modal-scrim" @click.self="handleClose">
    <div class="update-modal-card">
      <div class="update-card-header">
        <h2 class="update-title">Новая версия — новые исправления и добавления! ✨</h2>
        <button class="update-close-btn" @click="handleClose" title="Закрыть" aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="update-scroll-body">
        <!-- Добавили -->
        <div class="update-group">
          <div class="group-title add-title">
            <span class="group-icon">✨</span> Добавили:
          </div>
          <ul class="update-list">
            <li>
              <span class="bullet">📌</span>
              <span><strong>Поддержка Pinterest</strong>.</span>
            </li>
            <li>
              <span class="bullet">🎬</span>
              <span><strong>Видео почти из всех соцсетей</strong> теперь прикрепляются к рецепту.</span>
            </li>
            <li>
              <span class="bullet">🔢</span>
              <span><strong>Новый индекс версий</strong> (0.0.00).</span>
            </li>
            <li>
              <span class="bullet">💌</span>
              <span><strong>Карточка с обновлениями</strong> (ну, вы её уже заметили 😊).</span>
            </li>
          </ul>
        </div>

        <!-- Исправили -->
        <div class="update-group">
          <div class="group-title fix-title">
            <span class="group-icon">🛠</span> Исправили:
          </div>
          <ul class="update-list">
            <li>
              <span class="bullet">⚙️</span>
              <span><strong>Допилили ВКонтакте</strong> — теперь посты, клипы, видео, текст рецептов, ингредиенты и обложки извлекаются быстро и стабильно.</span>
            </li>
            <li>
              <span class="bullet">⚡</span>
              <span><strong>Доделали ссылки из MAX</strong> — теперь видео и вся важная информация корректно отображаются в карточке рецепта.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { triggerHaptic } from '../utils/audio.js'

const props = defineProps({
  version: {
    type: String,
    default: '2.6.00'
  }
})

const emit = defineEmits(['close'])

const handleClose = () => {
  try {
    triggerHaptic('light')
  } catch (e) {}
  emit('close')
}
</script>

<style scoped>
.update-modal-scrim {
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: fadeInScrim 0.25s ease-out;
}

.update-modal-card {
  width: 100%;
  max-width: 380px;
  max-height: 85vh;
  background: var(--surface, #ffffff);
  border-radius: 28px;
  border: 1px solid var(--surface-border, rgba(0, 0, 0, 0.08));
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
  display: flex;
  flex-direction: column;
  padding: 24px 20px 20px;
  animation: scaleInCard 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  overflow: hidden;
}

.update-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.update-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main, #1c1b1f);
  margin: 0;
  line-height: 1.35;
  flex: 1;
}

.update-close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted, #757575);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.update-close-btn:active {
  background: var(--surface-secondary, rgba(0, 0, 0, 0.06));
  transform: scale(0.9);
}

.update-scroll-body {
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.update-scroll-body::-webkit-scrollbar {
  width: 4px;
}
.update-scroll-body::-webkit-scrollbar-thumb {
  background: var(--surface-border, #ddd);
  border-radius: 4px;
}

.update-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-title {
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}

.add-title {
  color: var(--primary, #2e7d32);
}

.fix-title {
  color: var(--accent, #e65100);
}

.update-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.update-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--text-main, #2c3e50);
}

.bullet {
  font-size: 14px;
  line-height: 1.3;
  flex-shrink: 0;
}

@keyframes fadeInScrim {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleInCard {
  from {
    opacity: 0;
    transform: scale(0.88) translateY(12px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
