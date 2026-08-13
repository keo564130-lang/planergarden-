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
const addNote = () => {
  if (newNoteText.value.trim() && selectedRecipe.value) {
    emit('add-note', selectedRecipe.value.id, newNoteText.value.trim())
    newNoteText.value = ''
  }
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
        
        <button v-if="categories.length > 0" class="fab" @click="openAddCategory">+</button>
      </div>

      <!-- VIEW 2: RECIPE DETAIL -->
      <div v-else-if="currentView === 'detail' && selectedRecipe" class="view detail-view" key="detail">
        <div class="detail-header">
          <button class="btn-icon" @click="backToList">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div class="spacer"></div>
          <button class="btn-icon" @click="openEditRecipe">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-icon delete-btn" @click="deleteCurrentRecipe">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
        
        <div class="detail-scroll">
          <div class="photo-carousel" v-if="selectedRecipe.photos && selectedRecipe.photos.length > 0"
               @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
            <div class="carousel-inner" :style="{ transform: `translateX(-${currentCarouselIndex * 100}%)` }">
              <div class="carousel-item" v-for="(photo, i) in selectedRecipe.photos" :key="i" @click="openFullscreen(photo)">
                <img :src="photo" />
              </div>
            </div>
            <div class="carousel-dots" v-if="selectedRecipe.photos.length > 1">
              <span v-for="(_, i) in selectedRecipe.photos" :key="i" class="dot" :class="{ active: i === currentCarouselIndex }"></span>
            </div>
          </div>
          <div class="no-photo" v-else>📷 Нет фото</div>
          
          <div class="recipe-info">
            <h1 class="recipe-name">{{ selectedRecipe.name }}</h1>
            <div class="recipe-content">{{ selectedRecipe.content }}</div>
          </div>
          
          <div class="divider"></div>
          
          <div class="notes-section">
            <h3>📝 Заметки</h3>
            <div class="notes-list">
              <div v-for="note in selectedRecipeNotes" :key="note.id" class="note-item">
                <div class="note-content">
                  <div class="note-text">{{ note.text }}</div>
                  <div class="note-date">{{ new Date(note.created_at).toLocaleDateString('ru-RU') }}</div>
                </div>
                <button class="btn-icon muted small" @click="deleteNote(note.id)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="note-input-area">
          <input type="text" v-model="newNoteText" placeholder="Новая заметка..." @keyup.enter="addNote">
          <button class="btn-send" @click="addNote">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
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
          <button class="btn-text" @click="showRecipeModal = false">Отмена</button>
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
          
          <div class="form-group">
            <label>Категория</label>
            <select v-model="editingRecipe.category_id">
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.emoji }} {{ cat.name }}</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Название</label>
            <input type="text" v-model="editingRecipe.name" placeholder="Название рецепта">
          </div>
          
          <div class="form-group">
            <label>Описание / Рецепт</label>
            <textarea v-model="editingRecipe.content" @input="adjustTextareaHeight" placeholder="Ингредиенты, шаги..."></textarea>
          </div>
          
          <div class="form-group" v-if="!isEditing">
            <label>Заметка (опционально)</label>
            <input type="text" v-model="editingRecipe.note" placeholder="Первая заметка">
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

.fab {
  position: fixed;
  bottom: 96px;
  right: 24px;
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
  z-index: 10;
  transition: transform var(--transition-spring);
}
.fab:active { transform: scale(0.95); }

/* Detail View */
.detail-view { background: var(--bg-app); display: flex; flex-direction: column; }
.detail-header {
  display: flex;
  align-items: center;
  padding: 12px 8px;
  background: var(--surface);
  border-bottom: 1px solid var(--surface-border);
  z-index: 2;
  gap: 4px;
}
.detail-header .spacer { flex: 1; }
.detail-header .btn-icon {
  width: 40px; height: 40px;
  border-radius: var(--radius-full);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; color: var(--text-main);
  transition: background var(--transition-fast);
}
.detail-header .btn-icon:active { background: var(--surface-secondary); }
.detail-header .btn-icon.delete-btn { color: #d32f2f; }
.detail-scroll {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 80px;
}
.photo-carousel {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  max-height: 320px;
  overflow: hidden;
  background: var(--surface-container);
}
.carousel-inner {
  display: flex;
  height: 100%;
  transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
}
.carousel-item {
  width: 100%;
  height: 100%;
  flex-shrink: 0;
}
.carousel-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.carousel-dots {
  position: absolute;
  bottom: 16px;
  left: 0; right: 0;
  display: flex;
  justify-content: center;
  gap: 8px;
}
.dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.4);
  transition: all 0.3s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.dot.active { background: #fff; width: 24px; border-radius: 4px; }
.no-photo {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-secondary);
  color: var(--text-muted);
  font-size: 15px;
  border-bottom: 1px solid var(--surface-border);
}

.recipe-info {
  padding: 20px;
  background: var(--surface);
  margin: 16px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  border: 1px solid var(--surface-border);
}
.recipe-name {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 12px;
  letter-spacing: -0.3px;
  color: var(--text-main);
}
.recipe-content {
  font-size: 15px;
  line-height: 1.7;
  white-space: pre-wrap;
  color: var(--text-main);
  opacity: 0.85;
}

.notes-section {
  padding: 0 16px 24px;
}
.notes-section h3 {
  font-size: 16px;
  margin: 0 0 12px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  font-size: 12px;
}
.notes-list { display: flex; flex-direction: column; gap: 8px; }
.note-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background: var(--surface);
  padding: 14px 16px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow);
  border: 1px solid var(--surface-border);
}
.note-content { flex: 1; margin-right: 8px; }
.note-text { font-size: 14px; margin-bottom: 4px; white-space: pre-wrap; line-height: 1.5; }
.note-date { font-size: 11px; color: var(--text-muted); }

.note-input-area {
  position: absolute;
  bottom: 0;
  left: 0; right: 0;
  background: var(--surface);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 1px solid var(--surface-border);
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}
.note-input-area input {
  flex: 1;
  background: var(--surface-container);
  border: none;
  padding: 12px 16px;
  border-radius: var(--radius-full);
  font-family: var(--font-family);
  font-size: 15px;
  color: var(--text-main);
  outline: none;
}
.btn-send {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: var(--text-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow);
  flex-shrink: 0;
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.btn-send:active { background: var(--primary-hover); }

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
  background: var(--bg-app);
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
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
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
