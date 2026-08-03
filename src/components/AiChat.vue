<template>
  <div class="ai-chat-container" ref="chatContainer">
    <!-- View 1: Chat List -->
    <transition name="slide-fade">
      <div v-if="!currentChatId" class="chat-list-view">
        <div class="chat-list-header">
          <button class="icon-button m3-fab" @click="emit('new-chat')" aria-label="Новый чат">
            <svg viewBox="0 0 24 24" class="icon"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
        </div>

        <div class="list-content">
          <div v-if="!chatList || chatList.length === 0" class="empty-state">
            <div class="empty-icon">🌱</div>
            <p>Начните диалог с ИИ-помощником!<br>Спросите совет по уходу за растениями</p>
          </div>
          <div v-else class="chat-list">
            <div 
              v-for="chat in chatList" 
              :key="chat.id" 
              class="chat-card"
              @click="emit('select-chat', chat.id)"
            >
              <div class="chat-card-content">
                <h3 class="chat-title">{{ chat.title || 'Новый чат' }}</h3>
                <span class="chat-date">{{ formatDate(chat.created_at) }}</span>
              </div>
              <button class="icon-button delete-btn" @click.stop="emit('delete-chat', chat.id)" aria-label="Удалить чат">
                <svg viewBox="0 0 24 24" class="icon"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- View 2: Chat Screen -->
    <transition name="slide-up">
      <div v-if="currentChatId" class="chat-screen-view">
        <div class="chat-back-bar">
          <button class="icon-button" @click="goBack" aria-label="Назад">
            <svg viewBox="0 0 24 24" class="icon"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </button>
          <span class="chat-back-title">{{ currentChatTitle }}</span>
        </div>

        <div class="messages-container" ref="messagesContainer">
          <transition-group name="message-anim" tag="div" class="messages-list">
            <div 
              v-for="msg in chatMessages" 
              :key="msg.id" 
              class="message-wrapper"
              :class="msg.role === 'user' ? 'is-user' : 'is-ai'"
            >
              <div class="message-bubble">
                {{ msg.content }}
              </div>
              <div class="message-time">{{ formatTime(msg.created_at) }}</div>
            </div>
            
            <div v-if="isTyping" key="typing" class="message-wrapper is-ai">
              <div class="message-bubble typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </transition-group>
        </div>

        <div class="input-area">
          <div class="input-wrapper">
            <input 
              v-model="newMessage" 
              type="text" 
              placeholder="Спросите о растениях..." 
              @keyup.enter="sendMessage"
              @focus="handleInputFocus"
              class="message-input"
            />
            <button 
              class="send-button" 
              :disabled="!newMessage.trim()" 
              @click="sendMessage"
              aria-label="Отправить"
            >
              <svg viewBox="0 0 24 24" class="icon send-icon"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  chatMessages: {
    type: Array,
    default: () => []
  },
  chatList: {
    type: Array,
    default: () => []
  },
  currentChatId: {
    type: [String, null],
    default: null
  },
  isTyping: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['send-message', 'new-chat', 'select-chat', 'delete-chat'])

const newMessage = ref('')
const messagesContainer = ref(null)
const chatContainer = ref(null)

const currentChatTitle = computed(() => {
  if (!props.currentChatId) return 'Чат'
  const chat = props.chatList.find(c => c.id === props.currentChatId)
  if (chat && chat.title) {
    return chat.title.length > 40 ? chat.title.substring(0, 40) + '...' : chat.title
  }
  return 'Чат с ИИ'
})

const goBack = () => {
  emit('select-chat', null)
}

const sendMessage = () => {
  if (!newMessage.value.trim()) return
  emit('send-message', newMessage.value.trim())
  newMessage.value = ''
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Keyboard handled globally in App.vue
// Just scroll chat to bottom when input focused
const handleInputFocus = () => {
  setTimeout(scrollToBottom, 300)
}

watch(() => props.chatMessages, () => {
  scrollToBottom()
}, { deep: true })

watch(() => props.isTyping, (val) => {
  if (val) scrollToBottom()
})

const formatTime = (isoString) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const formatDate = (isoString) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
</script>

<style scoped>
.ai-chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
  overflow: hidden;
  background-color: var(--bg-app, #f8f9fa);
  font-family: var(--font-family, 'Google Sans Text', sans-serif);
}

.chat-list-view,
.chat-screen-view {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.chat-list-header {
  display: flex;
  justify-content: flex-end;
  padding: 0 4px 12px 4px;
}

.chat-back-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 12px 4px;
}

.chat-back-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main, #1a1c18);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.icon-button {
  background: transparent;
  border: none;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-main, #1a1c18);
  transition: background-color var(--transition, 0.2s cubic-bezier(0.2, 0, 0, 1));
}

.icon-button:hover {
  background-color: var(--surface-secondary, #e1e3de);
}

.m3-fab {
  background-color: var(--primary, hsl(142, 44%, 40%));
  color: var(--text-on-primary, #ffffff);
  box-shadow: var(--shadow, 0 4px 8px rgba(0,0,0,0.1));
}

.m3-fab:hover {
  background-color: var(--primary-light, hsl(142, 44%, 50%));
}

.icon {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

.list-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 24px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--text-muted, #74776d);
  padding: 32px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--surface, #ffffff);
  padding: 16px 20px;
  border-radius: var(--radius-lg, 16px);
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  cursor: pointer;
  transition: transform var(--transition, 0.2s ease), box-shadow var(--transition, 0.2s ease);
}

.chat-card:active {
  transform: scale(0.98);
}

.chat-card-content {
  flex: 1;
  overflow: hidden;
}

.chat-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-main, #1a1c18);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-date {
  font-size: 12px;
  color: var(--text-muted, #74776d);
}

.delete-btn {
  color: #ba1a1a;
  opacity: 0.6;
}

.delete-btn:hover {
  opacity: 1;
  background-color: #ffdad6;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px 0;
  display: flex;
  flex-direction: column;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-bottom: 24px;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  max-width: 85%;
}

.is-user {
  align-self: flex-end;
  align-items: flex-end;
}

.is-ai {
  align-self: flex-start;
  align-items: flex-start;
}

.message-bubble {
  padding: 12px 16px;
  font-size: 16px;
  line-height: 1.5;
  word-break: break-word;
}

.is-user .message-bubble {
  background-color: var(--primary, hsl(142, 44%, 40%));
  color: var(--text-on-primary, #ffffff);
  border-radius: 20px 20px 4px 20px;
}

.is-ai .message-bubble {
  background-color: var(--surface-secondary, #e1e3de);
  color: var(--text-main, #1a1c18);
  border-radius: 20px 20px 20px 4px;
}

.message-time {
  font-size: 11px;
  color: var(--text-muted, #74776d);
  margin-top: 4px;
  padding: 0 4px;
}

.input-area {
  padding: 8px 12px;
  background-color: var(--bg-app, #f8f9fa);
  flex-shrink: 0;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background-color: var(--surface, #ffffff);
  border-radius: 28px;
  padding: 4px 4px 4px 20px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
}

.message-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 16px;
  color: var(--text-main, #1a1c18);
  font-family: inherit;
}

.message-input::placeholder {
  color: var(--text-muted, #74776d);
}

.send-button {
  background-color: var(--primary, hsl(142, 44%, 40%));
  color: var(--text-on-primary, #ffffff);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s;
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: scale(0.9);
}

.send-button:not(:disabled):active {
  transform: scale(0.95);
}

.send-icon {
  width: 20px;
  height: 20px;
  margin-left: 2px;
}

/* Typing Indicator */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 16px 20px !important;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background-color: var(--text-main, #1a1c18);
  border-radius: 50%;
  opacity: 0.4;
  animation: bounce 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Animations */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
}
.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.message-anim-enter-active,
.message-anim-leave-active {
  transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
}
.message-anim-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.message-anim-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
