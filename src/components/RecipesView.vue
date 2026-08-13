<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  categories: { type: Array, default: () => [] },
  recipes: { type: Array, default: () => [] },
  recipeNotes: { type: Array, default: () => [] },
  shareData: { type: Object, default: null }
})

const emit = defineEmits([
  'add-category',
  'delete-category',
  'add-recipe',
  'update-recipe',
  'delete-recipe',
  'add-note',
  'delete-note',
  'clear-share-data'
])

const currentView = ref('list')
const selectedRecipe = ref(null)

// --- View 1: Category List ---
const expandedCategories = ref(new Set())
const toggleCategory = (id) => {
  if (expandedCategories.value.has(id)) {
    expandedCategories.value.delete(id)
  } else {
    expandedCategories.value.add(id)
  }
}

const showAddCategoryModal = ref(false)
const newCategoryName = ref('')
const newCategoryEmoji = ref('📁')
const emojiList = ['🍆','🍅','🥒','🫙','🥕','🌽','🍎','🍓','🫐','🍒','🥔','🧅','🍋','🌶️','🥬','🍇','📁']

const openAddCategory = () => {
  newCategoryName.value = ''
  newCategoryEmoji.value = '📁'
  showAddCategoryModal.value = true
}
const addCategory = () => {
  if (newCategoryName.value.trim()) {
    emit('add-category', newCategoryName.value.trim(), newCategoryEmoji.value)
    showAddCategoryModal.value = false
  }
}
const deleteCategory = (id, event) => {
  event.stopPropagation()
  if (confirm('Удалить категорию?')) {
    emit('delete-category', id)
  }
}

const getRecipesForCategory = (catId) => props.recipes.filter(r => r.category_id === catId)

const openRecipe = (recipe) => {
  selectedRecipe.value = recipe
  currentCarouselIndex.value = 0
  currentView.value = 'detail'
}
const backToList = () => {
  currentView.value = 'list'
  selectedRecipe.value = null
}

// --- View 2: Recipe Detail ---
const currentCarouselIndex = ref(0)
const selectedRecipeNotes = computed(() => {
  if (!selectedRecipe.value) return []
  return props.recipeNotes.filter(n => n.recipe_id === selectedRecipe.value.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
})
const newNoteText = ref('')
const showNoteInput = ref(false)
const noteInputRef = ref(null)
const addNote = () => {
  if (newNoteText.value.trim() && selectedRecipe.value) {
    emit('add-note', selectedRecipe.value.id, newNoteText.value.trim())
    newNoteText.value = ''
  }
}
const addNoteAndClose = () => {
  addNote()
  showNoteInput.value = false
}
const deleteNote = (noteId) => {
  if (confirm('Удалить заметку?')) {
    emit('delete-note', noteId)
  }
}

const deleteCurrentRecipe = () => {
  if (selectedRecipe.value && confirm('Удалить рецепт?')) {
    emit('delete-recipe', selectedRecipe.value.id)
    backToList()
  }
}

// Fullscreen photo
const showFullscreenPhoto = ref(false)
const fullscreenPhotoSrc = ref('')
const openFullscreen = (src) => {
  fullscreenPhotoSrc.value = src
  showFullscreenPhoto.value = true
}

// Carousel swipe logic
let touchStartX = 0
let touchEndX = 0
const handleTouchStart = (e) => { touchStartX = e.changedTouches[0].screenX }
const handleTouchMove = (e) => { touchEndX = e.changedTouches[0].screenX }
const handleTouchEnd = () => {
  if (!selectedRecipe.value?.photos?.length) return
  const diff = touchStartX - touchEndX
  if (Math.abs(diff) > 50) {
    if (diff > 0 && currentCarouselIndex.value < selectedRecipe.value.photos.length - 1) {
      currentCarouselIndex.value++
    } else if (diff < 0 && currentCarouselIndex.value > 0) {
      currentCarouselIndex.value--
    }
  }
}

// --- View 3: Edit / Create Modal ---
const showRecipeModal = ref(false)
const isEditing = ref(false)
const editingRecipe = ref({
  id: null,
  category_id: null,
  name: '',
  content: '',
  photos: [],
  note: ''
})

const openAddRecipe = (categoryId = null) => {
  isEditing.value = false
  editingRecipe.value = {
    id: null,
    category_id: categoryId || (props.categories.length ? props.categories[0].id : null),
    name: '',
    content: '',
    photos: [],
    note: ''
  }
  showRecipeModal.value = true
}

const openEditRecipe = () => {
  if (!selectedRecipe.value) return
  isEditing.value = true
  editingRecipe.value = {
    id: selectedRecipe.value.id,
    category_id: selectedRecipe.value.category_id,
    name: selectedRecipe.value.name,
    content: selectedRecipe.value.content,
    photos: [...(selectedRecipe.value.photos || [])],
    note: '' 
  }
  showRecipeModal.value = true
}

const saveRecipe = () => {
  if (!editingRecipe.value.name.trim()) return alert('Введите название')
  if (!editingRecipe.value.category_id) return alert('Выберите категорию')

  if (isEditing.value) {
    emit('update-recipe', {
      id: editingRecipe.value.id,
      category_id: editingRecipe.value.category_id,
      name: editingRecipe.value.name.trim(),
      content: editingRecipe.value.content.trim(),
      photos: editingRecipe.value.photos
    })
    selectedRecipe.value = { ...selectedRecipe.value, ...editingRecipe.value }
  } else {
    emit('add-recipe', {
      category_id: editingRecipe.value.category_id,
      name: editingRecipe.value.name.trim(),
      content: editingRecipe.value.content.trim(),
      photos: editingRecipe.value.photos,
      note: editingRecipe.value.note.trim()
    })
  }
  showRecipeModal.value = false
}

const removeEditingPhoto = (index) => {
  editingRecipe.value.photos.splice(index, 1)
}

const processPhotoFile = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        
        if (width > 800) {
          height = Math.round((height * 800) / width)
          width = 800
        }
        
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.6))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

const handlePhotoUpload = async (e) => {
  const files = e.target.files
  if (!files) return
  for (let i = 0; i < files.length; i++) {
    const dataUrl = await processPhotoFile(files[i])
    editingRecipe.value.photos.push(dataUrl)
  }
  e.target.value = ''
}

// --- Share Target Logic ---
watch(() => props.shareData, (newVal) => {
  if (newVal) {
    isEditing.value = false
    editingRecipe.value = {
      id: null,
      category_id: props.categories.length ? props.categories[0].id : null,
      name: newVal.title || '',
      content: newVal.text || '',
      photos: newVal.photos ? [...newVal.photos] : [],
      note: ''
    }
    showRecipeModal.value = true
    emit('clear-share-data')
  }
}, { immediate: true })

const adjustTextareaHeight = (e) => {
  e.target.style.height = 'auto'
  e.target.style.height = e.target.scrollHeight + 'px'
}

// iOS keyboard: keep focused field visible
const scrollToField = (e) => {
  const el = e.target
  // Wait for iOS keyboard to animate open
  setTimeout(() => {
    if (window.visualViewport) {
      const vvHeight = window.visualViewport.height
      const rect = el.getBoundingClientRect()
      const elBottom = rect.bottom
      // If element is below visible area, scroll it up
      if (elBottom > vvHeight - 20) {
        const scrollParent = el.closest('.modal-body')
        if (scrollParent) {
          scrollParent.scrollTop += (elBottom - vvHeight + 80)
        }
      }
    }
  }, 400)
}

// --- Link parsing ---
const showLinkModal = ref(false)
const linkUrl = ref('')
const linkLoading = ref(false)
const linkError = ref('')

const openLinkModal = () => {
  linkUrl.value = ''
  linkError.value = ''
  linkLoading.value = false
  showLinkModal.value = true
}

const parseLink = async () => {
  const url = linkUrl.value.trim()
  if (!url) return
  if (!url.startsWith('http')) {
    linkError.value = 'Вставьте ссылку (начинается с http)'
    return
  }
  
  linkLoading.value = true
  linkError.value = ''
  
  try {
    const res = await fetch('/api/parse-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    
    const data = await res.json()
    
    if (!res.ok) {
      linkError.value = data.error || 'Не удалось загрузить'
      linkLoading.value = false
      return
    }
    
    // Fill recipe form
    isEditing.value = false
    editingRecipe.value = {
      id: null,
      category_id: props.categories.length ? props.categories[0].id : null,
      name: data.title || '',
      content: data.description || '',
      photos: [],
      note: ''
    }
    
    // Try to load image via proxy
    if (data.image) {
      try {
        const imgRes = await fetch(data.image)
        if (imgRes.ok) {
          const blob = await imgRes.blob()
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.readAsDataURL(blob)
          })
          editingRecipe.value.photos.push(dataUrl)
        }
      } catch (e) {
        // Image failed, continue without it
      }
    }
    
    showLinkModal.value = false
    showRecipeModal.value = true
  } catch (e) {
    linkError.value = 'Ошибка сети'
  }
  
  linkLoading.value = false
}
</script>
<template>
  <div class="recipes-view">
    <transition name="view" mode="out-in">
      
      <!-- VIEW 1: CATEGORY LIST -->
      <div v-if="currentView === 'list'" class="view list-view" key="list">
        <div v-if="categories.length === 0" class="empty-state">
          <div class="empty-text">🍳<br>Добавьте первую<br>категорию рецептов</div>
          <button class="btn-primary" @click="openAddCategory">+ Добавить категорию</button>
        </div>
        
        <div v-else class="categories-container">
          <div v-for="cat in categories" :key="cat.id" class="category-card m3-card" :class="{ 'expanded': expandedCategories.has(cat.id) }">
            <div class="category-header" @click="toggleCategory(cat.id)">
              <div class="cat-title">
                <span class="emoji">{{ cat.emoji }}</span>
                <span class="name">{{ cat.name }}</span>
              </div>
              <div class="cat-actions">
                <button class="btn-icon muted small" @click="deleteCategory(cat.id, $event)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
                <svg class="chevron-icon" :class="{'up': expandedCategories.has(cat.id)}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            
            <div v-show="expandedCategories.has(cat.id)" class="category-content">
              <div class="recipe-list">
                <div v-for="recipe in getRecipesForCategory(cat.id)" :key="recipe.id" class="recipe-item" @click="openRecipe(recipe)">
                  <div class="recipe-item-info">
                    <div class="recipe-item-name">{{ recipe.name }}</div>
                    <div class="recipe-item-preview">{{ (recipe.content || '').substring(0, 50) }}...</div>
                  </div>
                  <div class="recipe-item-photo" v-if="recipe.photos && recipe.photos.length">
                    <img :src="recipe.photos[0]" />
                  </div>
                </div>
              </div>
              <button class="btn-text add-recipe-btn" @click="openAddRecipe(cat.id)">+ Добавить рецепт</button>
            </div>
          </div>
        </div>
        
        <div v-if="categories.length > 0" class="fab-group">
          <button class="fab-small" @click="openLinkModal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          </button>
          <button class="fab" @click="openAddCategory">+</button>
        </div>
      </div>

      <!-- VIEW 2: RECIPE DETAIL -->
      <div v-else-if="currentView === 'detail' && selectedRecipe" class="view detail-view" key="detail">
        
        <!-- Photo card -->
        <div class="detail-top-bar">
          <button class="detail-back-btn" @click="backToList">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div class="spacer"></div>
          <button class="detail-top-action" @click="openEditRecipe">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="detail-top-action danger" @click="deleteCurrentRecipe">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>

        <div class="detail-body">
          <div class="detail-photo-card" v-if="selectedRecipe.photos && selectedRecipe.photos.length > 0"
               @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
            <div class="detail-carousel" :style="{ transform: `translateX(-${currentCarouselIndex * 100}%)` }">
              <div class="detail-carousel-slide" v-for="(photo, i) in selectedRecipe.photos" :key="i" @click="openFullscreen(photo)">
                <img :src="photo" />
              </div>
            </div>
            <div class="detail-photo-dots" v-if="selectedRecipe.photos.length > 1">
              <span v-for="(_, i) in selectedRecipe.photos" :key="i" class="photo-dot" :class="{ active: i === currentCarouselIndex }"></span>
            </div>
          </div>


          <!-- Recipe card -->
          <div class="detail-recipe-card">
            <h1 class="detail-title">{{ selectedRecipe.name }}</h1>
            <div class="detail-text">{{ selectedRecipe.content }}</div>
          </div>

          <!-- Notes section -->
          <div class="detail-notes-section">
            <div class="notes-header">
              <span class="notes-label">📝 Заметки</span>
              <button class="notes-add-btn" @click="showNoteInput = !showNoteInput">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>

            <!-- Inline note input -->
            <div v-if="showNoteInput" class="note-add-card">
              <input type="text" v-model="newNoteText" placeholder="Написать заметку..." @keyup.enter="addNoteAndClose" ref="noteInputRef" />
              <div class="note-add-actions">
                <button class="btn-text-sm" @click="showNoteInput = false">Отмена</button>
                <button class="btn-primary-sm" @click="addNoteAndClose">Добавить</button>
              </div>
            </div>

            <div v-if="selectedRecipeNotes.length === 0 && !showNoteInput" class="notes-empty">
              Пока нет заметок
            </div>

            <div class="notes-cards">
              <div v-for="note in selectedRecipeNotes" :key="note.id" class="note-card">
                <div class="note-card-body">
                  <div class="note-card-text">{{ note.text }}</div>
                  <div class="note-card-date">{{ new Date(note.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) }}</div>
                </div>
                <button class="note-delete-btn" @click="deleteNote(note.id)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- MODAL: ADD FROM LINK -->
    <transition name="slide-up">
      <div v-if="showLinkModal" class="modal-overlay">
        <div class="modal-content small-modal">
          <h3>📎 Добавить из ссылки</h3>
          <p class="link-hint">Скопируйте ссылку на пост из ВК, Телеграм или Инстаграм и вставьте сюда</p>
          <div class="input-group">
            <input type="url" v-model="linkUrl" placeholder="https://vk.com/..." @keyup.enter="parseLink">
          </div>
          <div v-if="linkError" class="link-error">{{ linkError }}</div>
          <div class="modal-actions">
            <button class="btn-text" @click="showLinkModal = false">Отмена</button>
            <button class="btn-primary" @click="parseLink" :disabled="linkLoading">
              {{ linkLoading ? '⏳ Загрузка...' : '📥 Загрузить' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- MODAL: ADD CATEGORY -->
    <transition name="slide-up">
      <div v-if="showAddCategoryModal" class="modal-overlay">
        <div class="modal-content small-modal">
          <h3>Новая категория</h3>
          <div class="input-group">
            <label>Название</label>
            <input type="text" v-model="newCategoryName" placeholder="Например: Выпечка">
          </div>
          <div class="input-group">
            <label>Иконка</label>
            <div class="emoji-grid">
              <div v-for="emoji in emojiList" :key="emoji" class="emoji-option" 
                   :class="{ active: newCategoryEmoji === emoji }"
                   @click="newCategoryEmoji = emoji">
                {{ emoji }}
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-text" @click="showAddCategoryModal = false">Отмена</button>
            <button class="btn-primary" @click="addCategory">💾 Сохранить</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- MODAL: ADD/EDIT RECIPE -->
    <transition name="slide-up">
      <div v-if="showRecipeModal" class="modal-overlay full-modal">
        <div class="modal-header">
          <button class="modal-cancel-btn" @click="showRecipeModal = false">Отмена</button>
          <h3>{{ isEditing ? 'Редактировать' : 'Новый рецепт' }}</h3>
          <button class="btn-primary small" @click="saveRecipe">Сохранить</button>
        </div>
        
        <div class="modal-body">
          <div class="photo-editor">
            <div class="photo-thumbs">
              <div v-for="(photo, i) in editingRecipe.photos" :key="i" class="thumb">
                <img :src="photo" />
                <button class="remove-photo" @click="removeEditingPhoto(i)">✕</button>
              </div>
              <label class="add-photo-btn">
                <span>+</span>
                <input type="file" accept="image/*" multiple @change="handlePhotoUpload" hidden>
              </label>
            </div>
          </div>
          
          <div class="form-island">
            <div class="form-group">
              <label>Категория</label>
              <select v-model="editingRecipe.category_id">
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.emoji }} {{ cat.name }}</option>
              </select>
            </div>
          </div>
          
          <div class="form-island">
            <div class="form-group">
              <label>Название</label>
              <input type="text" v-model="editingRecipe.name" placeholder="Название рецепта" @focus="scrollToField($event)">
            </div>
            
            <div class="island-divider"></div>
            
            <div class="form-group">
              <label>Описание / Рецепт</label>
              <textarea v-model="editingRecipe.content" @input="adjustTextareaHeight" @focus="scrollToField($event)" placeholder="Ингредиенты, шаги..."></textarea>
            </div>
          </div>
          
          <div class="form-island" v-if="!isEditing">
            <div class="form-group">
              <label>Заметка (опционально)</label>
              <input type="text" v-model="editingRecipe.note" placeholder="Первая заметка" @focus="scrollToField($event)">
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- FULLSCREEN PHOTO -->
    <transition name="fade">
      <div v-if="showFullscreenPhoto" class="fullscreen-photo" @click="showFullscreenPhoto = false">
        <button class="close-fullscreen">✕</button>
        <img :src="fullscreenPhotoSrc" @click.stop>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.recipes-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--bg-app);
  font-family: var(--font-family);
  color: var(--text-main);
  position: relative;
  overflow: hidden;
}

.view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

/* Transitions */
.view-enter-active, .view-leave-active {
  transition: opacity var(--transition), transform var(--transition);
}
.view-enter-from { opacity: 0; transform: translateX(20px); }
.view-leave-to { opacity: 0; transform: translateX(-20px); }

.slide-up-enter-active, .slide-up-leave-active {
  transition: transform var(--transition-spring), opacity var(--transition);
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity var(--transition-fast);
}
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Common Buttons */
button {
  font-family: var(--font-family);
  cursor: pointer;
  border: none;
  background: none;
  outline: none;
}
.btn-primary {
  background: var(--primary);
  color: var(--text-on-primary);
  padding: 12px 24px;
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 16px;
  min-height: 44px;
  box-shadow: var(--shadow);
  transition: background var(--transition-fast);
}
.btn-primary:hover, .btn-primary:active {
  background: var(--primary-hover);
}
.btn-primary.small {
  padding: 8px 16px;
  font-size: 14px;
  min-height: 36px;
}
.btn-text {
  color: var(--primary);
  font-weight: 500;
  padding: 12px;
  min-height: 44px;
}
.btn-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--text-main);
  transition: background var(--transition-fast);
}
.btn-icon.small {
  width: 36px; height: 36px;
}
.btn-icon:hover { background: var(--surface-container); }
.btn-icon.muted { color: var(--text-muted); font-size: 16px; }
.btn-icon.delete-btn { color: #d32f2f; }

.spacer { flex: 1; }
.divider { height: 1px; background: var(--surface-border); margin: 24px 0; }

/* List View */
.list-view {
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 80px; /* FAB space */
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}
.empty-text {
  font-size: 20px;
  line-height: 1.4;
  margin-bottom: 24px;
  color: var(--text-muted);
}
.categories-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.m3-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  border: 1px solid var(--surface-border);
  overflow: hidden;
}
.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  cursor: pointer;
  min-height: 56px;
}
.cat-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 500;
}
.cat-title .emoji { font-size: 24px; }
.cat-actions { display: flex; align-items: center; gap: 4px; }
.chevron-icon {
  color: var(--text-muted);
  transition: transform var(--transition);
  flex-shrink: 0;
}
.chevron-icon.up { transform: rotate(180deg); }

.category-content {
  padding: 0 16px 16px;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-secondary);
}
.recipe-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.recipe-item {
  display: flex;
  justify-content: space-between;
  background: var(--surface);
  padding: 14px 16px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow);
  cursor: pointer;
  align-items: center;
  transition: background var(--transition-fast);
}
.recipe-item:active { background: var(--surface-secondary); }
.recipe-item-info { flex: 1; overflow: hidden; }
.recipe-item-name { font-weight: 600; font-size: 15px; margin-bottom: 2px; }
.recipe-item-preview { font-size: 13px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.recipe-item-photo {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-left: 12px;
  flex-shrink: 0;
}
.recipe-item-photo img { width: 100%; height: 100%; object-fit: cover; }
.add-recipe-btn { width: 100%; text-align: left; padding: 12px 0 0; }

.fab-group {
  position: fixed;
  bottom: 96px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 10;
}
.fab-small {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  background: var(--surface);
  color: var(--primary);
  border: 1px solid var(--surface-border);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition: transform var(--transition-spring);
}
.fab-small:active { transform: scale(0.92); }

.fab {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: var(--text-on-primary);
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-lg);
  transition: transform var(--transition-spring);
  border: none;
  cursor: pointer;
}
.fab:active { transform: scale(0.95); }

.link-hint {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0 0 16px;
  line-height: 1.5;
}
.link-error {
  font-size: 13px;
  color: #d32f2f;
  margin: -8px 0 12px;
}

/* Detail View */
.detail-view { background: var(--bg-app); display: flex; flex-direction: column; }

/* Top action bar */
.detail-top-bar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 12px;
  flex-shrink: 0;
}
.detail-back-btn {
  width: 40px; height: 40px;
  border-radius: var(--radius-full);
  background: var(--surface);
  border: 1px solid var(--surface-border);
  color: var(--text-main);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow);
}
.detail-back-btn:active { background: var(--surface-secondary); }
.detail-top-action {
  width: 40px; height: 40px;
  border-radius: var(--radius-full);
  background: var(--surface);
  border: 1px solid var(--surface-border);
  color: var(--text-main);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow);
}
.detail-top-action:active { background: var(--surface-secondary); }
.detail-top-action.danger { color: #d32f2f; }

/* Scrollable body */
.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Photo inside card */
.detail-photo-card {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  max-height: 260px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--surface-border);
  background: var(--surface-container);
}
.detail-carousel {
  display: flex;
  height: 100%;
  transition: transform 0.35s cubic-bezier(0.2, 0, 0, 1);
}
.detail-carousel-slide {
  width: 100%; height: 100%; flex-shrink: 0;
}
.detail-carousel-slide img {
  width: 100%; height: 100%; object-fit: cover;
}
.detail-photo-dots {
  position: absolute;
  bottom: 12px;
  left: 0; right: 0;
  display: flex;
  justify-content: center;
  gap: 6px;
  z-index: 2;
}
.photo-dot {
  width: 7px; height: 7px;
  border-radius: 4px;
  background: rgba(255,255,255,0.45);
  transition: all 0.3s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
.photo-dot.active {
  background: #fff;
  width: 20px;
}

/* Recipe card */
.detail-recipe-card {
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 24px 20px;
  box-shadow: var(--shadow);
  border: 1px solid var(--surface-border);
}
.detail-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 16px;
  letter-spacing: -0.3px;
  line-height: 1.3;
  color: var(--text-main);
}
.detail-text {
  font-size: 15px;
  line-height: 1.75;
  white-space: pre-wrap;
  color: var(--text-main);
  opacity: 0.8;
}

/* Notes section */
.detail-notes-section {
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 20px;
  box-shadow: var(--shadow);
  border: 1px solid var(--surface-border);
}
.notes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.notes-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
}
.notes-add-btn {
  width: 36px; height: 36px;
  border-radius: var(--radius-full);
  background: var(--primary-light);
  color: var(--primary);
  display: flex; align-items: center; justify-content: center;
  border: none; cursor: pointer;
  transition: all var(--transition-fast);
}
.notes-add-btn:active { background: var(--primary-container); transform: scale(0.92); }

.note-add-card {
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-bottom: 12px;
  border: 1px solid var(--surface-border);
}
.note-add-card input {
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--surface-border);
  background: var(--surface);
  font-family: var(--font-family);
  font-size: 15px;
  color: var(--text-main);
  outline: none;
  box-sizing: border-box;
  margin-bottom: 10px;
}
.note-add-card input:focus { border-color: var(--primary); }
.note-add-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn-text-sm {
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  background: none;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  font-family: var(--font-family);
}
.btn-primary-sm {
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-on-primary);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  font-family: var(--font-family);
}
.btn-primary-sm:active { background: var(--primary-hover); }

.notes-empty {
  text-align: center;
  padding: 20px 16px;
  color: var(--text-muted);
  font-size: 14px;
}
.notes-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.note-card {
  display: flex;
  align-items: flex-start;
  padding: 14px 16px;
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--primary);
  gap: 10px;
}
.note-card-body { flex: 1; min-width: 0; }
.note-card-text {
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-main);
  white-space: pre-wrap;
  margin-bottom: 4px;
}
.note-card-date {
  font-size: 11px;
  color: var(--text-muted);
}
.note-delete-btn {
  width: 28px; height: 28px;
  border-radius: var(--radius-full);
  background: none;
  color: var(--text-muted);
  display: flex; align-items: center; justify-content: center;
  border: none; cursor: pointer;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}
.note-delete-btn:active { background: var(--surface-container); color: #d32f2f; }

/* Modals */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 24px;
}
.modal-content {
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 28px 24px;
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 400px;
}
.modal-content h3 { margin: 0 0 20px; font-size: 20px; }
.input-group { margin-bottom: 20px; }
.input-group label { display: block; font-size: 14px; color: var(--text-muted); margin-bottom: 8px; font-weight: 500; }
.input-group input {
  width: 100%;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--surface-border);
  background: var(--surface);
  font-size: 16px;
  font-family: var(--font-family);
  color: var(--text-main);
  outline: none;
  box-sizing: border-box;
}
.input-group input:focus { border-color: var(--primary); }
.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.emoji-option {
  width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
  border-radius: var(--radius-sm);
  background: var(--surface-container);
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}
.emoji-option.active {
  background: var(--primary-container);
  border: 2px solid var(--primary);
  transform: scale(1.1);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

/* Full Modal */
.full-modal {
  justify-content: flex-start;
  align-items: stretch;
  padding: 0;
  padding-top: env(safe-area-inset-top);
  background: var(--bg-app);
  height: var(--app-height, 100vh);
  height: var(--app-height, 100dvh);
  max-height: var(--app-height, 100vh);
  overflow: hidden;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--surface-border);
  gap: 12px;
  min-height: 56px;
  flex-shrink: 0;
}
.modal-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  flex: 1;
  text-align: center;
}
.modal-cancel-btn {
  padding: 8px 4px;
  font-size: 16px;
  font-weight: 500;
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-family);
  white-space: nowrap;
}
.modal-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: calc(60px + env(safe-area-inset-bottom));
}
.photo-editor .photo-thumbs {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.thumb {
  position: relative;
  width: 72px; height: 72px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow);
}
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.remove-photo {
  position: absolute;
  top: 4px; right: 4px;
  width: 22px; height: 22px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  border-radius: 50%;
  font-size: 12px;
  display: flex; align-items: center; justify-content: center;
  border: none; cursor: pointer;
}
.add-photo-btn {
  width: 72px; height: 72px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--surface-container);
  border: 2px dashed var(--surface-border);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; color: var(--text-muted);
  cursor: pointer;
}

.form-group label { display: block; font-size: 14px; color: var(--text-muted); margin-bottom: 8px; font-weight: 500; }
.form-group input, .form-group select, .form-group textarea {
  width: 100%;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
  background: var(--surface);
  font-size: 16px;
  font-family: var(--font-family);
  color: var(--text-main);
  outline: none;
  box-sizing: border-box;
}
.form-group textarea {
  min-height: 120px;
  resize: none;
  overflow: hidden;
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus {
  border-color: var(--primary);
}

/* Form islands */
.form-island {
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 4px 16px;
  box-shadow: var(--shadow);
  border: 1px solid var(--surface-border);
}
.form-island .form-group {
  padding: 12px 0;
}
.form-island .form-group label {
  margin-bottom: 6px;
}
.form-island .form-group input,
.form-island .form-group select,
.form-island .form-group textarea {
  border: none;
  background: none;
  padding: 8px 0;
  border-radius: 0;
}
.form-island .form-group input:focus,
.form-island .form-group select:focus,
.form-island .form-group textarea:focus {
  border: none;
  outline: none;
}
.island-divider {
  height: 1px;
  background: var(--surface-border);
  margin: 0;
}

/* Fullscreen Photo */
.fullscreen-photo {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #000;
  z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}
.fullscreen-photo img {
  max-width: 100%; max-height: 100%;
  object-fit: contain;
}
.close-fullscreen {
  position: absolute;
  top: env(safe-area-inset-top, 16px); right: 16px;
  width: 44px; height: 44px;
  background: rgba(255,255,255,0.2);
  color: #fff;
  border-radius: 50%;
  font-size: 20px;
}
</style>
