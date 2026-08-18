<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import Sortable from 'sortablejs'
import { triggerHaptic } from '../utils/audio.js'

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
  'update-recipe-category',
  'add-note',
  'delete-note',
  'clear-share-data'
])

const currentView = ref('list')
const selectedRecipe = ref(null)

const searchQuery = ref('')
const isReorderMode = ref(false)

const palette = [
  'default', '#FFCDD2', '#F8BBD0', '#E1BEE7', 
  '#D1C4E9', '#C5CAE9', '#BBDEFB', '#B3E5FC',
  '#B2EBF2', '#B2DFDB', '#C8E6C9', '#DCEDC8',
  '#F0F4C3', '#FFF9C4', '#FFECB3', '#FFE0B2', '#FFCCBC'
]

// --- View 1: Category List ---
const expandedCategories = ref(new Set())
const toggleCategory = (id) => {
  if (expandedCategories.value.has(id)) {
    expandedCategories.value.delete(id)
  } else {
    expandedCategories.value.add(id)
  }
}

const toggleReorderMode = () => {
  isReorderMode.value = !isReorderMode.value
  triggerHaptic('tap')
  if (isReorderMode.value) {
    // Automatically expand all categories so all drop targets are visible
    props.categories.forEach(c => expandedCategories.value.add(c.id))
  }
  nextTick(() => {
    refreshSortables()
  })
}

const showAddCategoryModal = ref(false)
const newCategoryName = ref('')
const newCategoryEmoji = ref('📁')
const newCategoryColor = ref('default')
const showCategoryColorPicker = ref(false)
const emojiList = ['🍆','🍅','🥒','🫙','🥕','🌽','🍎','🍓','🫐','🍒','🥔','🧅','🍋','🌶️','🥬','🍇','📁']

const openAddCategory = () => {
  newCategoryName.value = ''
  newCategoryEmoji.value = '🍔'
  newCategoryColor.value = 'default'
  showCategoryColorPicker.value = false
  showAddCategoryModal.value = true
}
const addCategory = () => {
  if (newCategoryName.value.trim()) {
    emit('add-category', newCategoryName.value.trim(), newCategoryEmoji.value, newCategoryColor.value)
    showAddCategoryModal.value = false
  }
}
const deleteCategory = (id, event) => {
  event.stopPropagation()
  if (confirm('Удалить категорию?')) {
    emit('delete-category', id)
  }
}

const getRecipesForCategory = (catId) => {
  return props.recipes.filter(r => {
    if (r.category_id !== catId) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const matchName = r.name.toLowerCase().includes(q)
      const matchTag = (r.tags || []).some(t => t.toLowerCase().includes(q))
      if (!matchName && !matchTag) return false
    }
    return true
  })
}

const sortableInstances = {}
const setupSortableForElement = (el, catId) => {
  if (!el) return
  if (sortableInstances[catId]) {
    try { sortableInstances[catId].destroy() } catch (e) {}
    delete sortableInstances[catId]
  }
  sortableInstances[catId] = Sortable.create(el, {
    group: 'recipes',
    animation: 200,
    disabled: !isReorderMode.value,
    handle: isReorderMode.value ? '.drag-handle' : false,
    forceFallback: true,
    fallbackTolerance: 2,
    ghostClass: 'recipe-drag-ghost',
    chosenClass: 'recipe-drag-chosen',
    dragClass: 'recipe-drag-dragging',
    onStart: () => {
      triggerHaptic('tap')
    },
    onEnd: (evt) => {
      const itemEl = evt.item
      const recipeId = itemEl?.dataset?.id
      const toCatId = evt.to?.dataset?.catId
      if (recipeId && toCatId && evt.from !== evt.to) {
        triggerHaptic('success')
        emit('update-recipe-category', recipeId, toCatId)
      }
    }
  })
}

const refreshSortables = () => {
  props.categories.forEach(cat => {
    const el = document.querySelector(`.recipe-list[data-cat-id="${cat.id}"]`)
    if (el) setupSortableForElement(el, cat.id)
  })
}

const setSortableRef = (el, catId) => {
  if (!el) return
  setupSortableForElement(el, catId)
}

const openRecipe = (recipe) => {
  selectedRecipe.value = recipe
  currentCarouselIndex.value = 0
  currentView.value = 'detail'
}
const backToList = () => {
  currentView.value = 'list'
  selectedRecipe.value = null
}

const showRecipeColorPicker = ref(false)
const showMoveModal = ref(false)

const handleDirectMove = (newCatId) => {
  if (!selectedRecipe.value) return
  if (selectedRecipe.value.category_id === newCatId) {
    showMoveModal.value = false
    return
  }
  triggerHaptic('success')
  emit('update-recipe-category', selectedRecipe.value.id, newCatId)
  selectedRecipe.value.category_id = newCatId
  showMoveModal.value = false
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

// Media items computed (Video is ALWAYS 1st, followed by photos)
const selectedRecipeMedia = computed(() => {
  if (!selectedRecipe.value) return []
  const items = []
  if (selectedRecipe.value.video_url) {
    items.push({ type: 'video', src: selectedRecipe.value.video_url })
  }
  if (selectedRecipe.value.photos && selectedRecipe.value.photos.length) {
    selectedRecipe.value.photos.forEach(photo => {
      items.push({ type: 'photo', src: photo })
    })
  }
  return items
})

const isVideoEmbed = (url) => {
  if (!url || typeof url !== 'string') return false
  return url.includes('video_ext.php') || 
         url.includes('youtube.com') || 
         url.includes('youtu.be') || 
         url.includes('rutube.ru') || 
         url.includes('tiktok.com/embed')
}

// Carousel swipe logic
let touchStartX = 0
let touchEndX = 0
const handleTouchStart = (e) => { touchStartX = e.changedTouches[0].screenX }
const handleTouchMove = (e) => { touchEndX = e.changedTouches[0].screenX }
const handleTouchEnd = () => {
  const total = selectedRecipeMedia.value.length
  if (total <= 1) return
  const diff = touchStartX - touchEndX
  if (Math.abs(diff) > 50) {
    if (diff > 0 && currentCarouselIndex.value < total - 1) {
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
  note: '',
  tags: [],
  color: 'default'
})

const newRecipeTag = ref('')
const addRecipeTag = () => {
  const tag = newRecipeTag.value.trim().toLowerCase()
  if (tag && !editingRecipe.value.tags.includes(tag)) {
    editingRecipe.value.tags.push(tag)
  }
  newRecipeTag.value = ''
}
const removeRecipeTag = (tag) => {
  editingRecipe.value.tags = editingRecipe.value.tags.filter(t => t !== tag)
}

const openAddRecipe = (categoryId = null) => {
  isEditing.value = false
  showRecipeColorPicker.value = false
  editingRecipe.value = {
    id: null,
    category_id: categoryId || (props.categories.length ? props.categories[0].id : null),
    name: '',
    content: '',
    photos: [],
    video_url: null,
    note: '',
    tags: [],
    color: 'default'
  }
  showRecipeModal.value = true
}

const openEditRecipe = () => {
  if (!selectedRecipe.value) return
  isEditing.value = true
  showRecipeColorPicker.value = false
  editingRecipe.value = {
    id: selectedRecipe.value.id,
    category_id: selectedRecipe.value.category_id,
    name: selectedRecipe.value.name,
    content: selectedRecipe.value.content,
    photos: [...(selectedRecipe.value.photos || [])],
    video_url: selectedRecipe.value.video_url || null,
    note: '',
    tags: [...(selectedRecipe.value.tags || [])],
    color: selectedRecipe.value.color || 'default'
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
      photos: editingRecipe.value.photos,
      video_url: editingRecipe.value.video_url || null,
      tags: editingRecipe.value.tags,
      color: editingRecipe.value.color
    })
    selectedRecipe.value = { ...selectedRecipe.value, ...editingRecipe.value }
  } else {
    emit('add-recipe', {
      category_id: editingRecipe.value.category_id,
      name: editingRecipe.value.name.trim(),
      content: editingRecipe.value.content.trim(),
      photos: editingRecipe.value.photos,
      video_url: editingRecipe.value.video_url || null,
      note: editingRecipe.value.note.trim(),
      tags: editingRecipe.value.tags,
      color: editingRecipe.value.color
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
      video_url: newVal.video_url || null,
      note: '',
      tags: [],
      color: 'default'
    }
    showRecipeModal.value = true
    emit('clear-share-data')
  }
}, { immediate: true })

const contentTextareaRef = ref(null)

const adjustTextareaHeight = (e) => {
  const el = e?.target || e;
  if (!el) return;
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 300) + 'px'
}

watch([showRecipeModal, () => editingRecipe.value.content], () => {
  if (showRecipeModal.value && contentTextareaRef.value) {
    nextTick(() => {
      adjustTextareaHeight(contentTextareaRef.value)
    })
  }
})

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
    let data;

    // Apify is currently broken by Instagram, relying entirely on backend RapidAPI parser

    try {
      const res = await fetch('/api/parse-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      
      const jsonData = await res.json()
      
      if (!res.ok) {
        throw new Error(jsonData.error || 'Backend parser failed')
      }
      data = jsonData
    } catch (e) {
      console.log('Primary parsing failed, trying fallback...', e)
      // Fallback to microlink if our backend is blocked/timed out
      const mUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&prerender=true`
      const resFallback = await fetch(mUrl)
      const mData = await resFallback.json()
      
      if (mData.status !== 'success') {
        throw new Error('Не удалось проанализировать ссылку. Возможно она закрыта настройками приватности.')
      }
      
      const mTitle = mData.data.title || '';
      
      data = {
        title: mData.data.title || '',
        description: mData.data.description || '',
        originalImage: mData.data.image?.url || '',
        image: mData.data.image?.url ? `/api/parse-url?image=${encodeURIComponent(mData.data.image.url)}` : '',
        video: mData.data.video?.url || null
      }
    }

    // Client-side fallback for VK video/clips
    if (!data.video && (url.includes('vk.com') || url.includes('vkvideo.ru') || url.includes('vk.ru'))) {
      const vkMatch = url.match(/(?:video|clip)(-?\d+_\d+)/i)
      if (vkMatch) {
        const [oid, id] = vkMatch[1].split('_')
        data.video = `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hd=2`
      }
    }
    
    // Clean HTML tags from description (microlink sometimes returns <br>)
    if (data.description) {
      data.description = data.description
        .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
        .replace(/<[^>]+>/g, '')       // Strip all other HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
    }
    
    // Fallback for generic VK/Max titles
    let finalTitle = data.title || ''
    const lowerTitle = finalTitle.toLowerCase()
    
    const isGeneric = !finalTitle || 
      url.includes('max.ru') ||
      url.includes('instagram.com') ||
      url.includes('instagr.am') ||
      lowerTitle.includes('instagram') ||
      lowerTitle.includes('вконтакте') || 
      lowerTitle.includes('vk.com') || 
      lowerTitle.includes('vkontakte') || 
      lowerTitle.includes('wall post') || 
      lowerTitle.includes('пост на стене') || 
      lowerTitle.includes('запись на стене') ||
      lowerTitle === 'vk';
      
    if (isGeneric) {
      if (data.description) {
        // Take the first line or sentence as title
        const lines = data.description.split('\n').filter(l => l.trim())
        const firstLine = lines.length ? lines[0].trim() : ''
        
        if (firstLine) {
          finalTitle = firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine
          // Remove the first line from the content so it doesn't duplicate the title
          const remainingDesc = data.description.substring(firstLine.length).trim()
          // Only replace if there's remaining content, otherwise keep the full text
          data.description = remainingDesc || data.description
        } else {
          finalTitle = 'Новый рецепт'
        }
      } else {
        finalTitle = 'Новый рецепт'
      }
    }
    
    // Fill recipe form
    isEditing.value = false
    editingRecipe.value = {
      id: null,
      category_id: props.categories.length ? props.categories[0].id : null,
      name: finalTitle,
      content: data.description || '',
      photos: [],
      video_url: data.video || null,
      note: '',
      tags: [],
      color: 'default'
    }
    
    // Try to load image: first directly (VK allows CORS), then via proxy
    const targetUrl = data.originalImage || data.image
    if (targetUrl) {
      try {
        let imgRes = null
        try {
          imgRes = await fetch(data.originalImage)
        } catch (e) {
          // Direct fetch failed (CORS), try proxy
          if (data.image) imgRes = await fetch(data.image)
        }
        
        if (imgRes && imgRes.ok) {
          const blob = await imgRes.blob()
          const dataUrl = await new Promise((resolve) => {
            const blobUrl = URL.createObjectURL(blob)
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              let w = img.width, h = img.height
              if (w > 800) { h = Math.round((h * 800) / w); w = 800 }
              canvas.width = w
              canvas.height = h
              canvas.getContext('2d').drawImage(img, 0, 0, w, h)
              URL.revokeObjectURL(blobUrl)
              resolve(canvas.toDataURL('image/jpeg', 0.6))
            }
            img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null) }
            img.src = blobUrl
          })
          if (dataUrl) editingRecipe.value.photos.push(dataUrl)
        }
      } catch (e) {
        // Image failed entirely, continue without it
      }
    }
    showLinkModal.value = false
    showRecipeModal.value = true
  } catch (e) {
    linkError.value = e.message || 'Ошибка сети'
  }
  
  linkLoading.value = false
}
</script>
<template>
  <div class="recipes-view">
    <transition name="view" mode="out-in">
      
      <!-- VIEW 1: CATEGORY LIST -->
      <div v-if="currentView === 'list'" class="view list-view" key="list">
        
        <!-- Search & Reorder Bar -->
        <div class="search-bar-container" v-if="categories.length > 0">
          <div class="search-input-wrap">
            <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" v-model="searchQuery" placeholder="Поиск по названию или тегам..." />
            <button v-if="searchQuery" class="clear-search-btn" @click="searchQuery = ''">✕</button>
          </div>
          <button 
            class="reorder-mode-btn" 
            :class="{ active: isReorderMode }" 
            @click="toggleReorderMode"
            :title="isReorderMode ? 'Завершить перенос' : 'Режим переноса рецептов'"
          >
            <template v-if="!isReorderMode">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 18 12 22 16 18"></polyline><polyline points="8 6 12 2 16 6"></polyline><line x1="12" y1="2" x2="12" y2="22"></line><polyline points="18 8 22 12 18 16"></polyline><polyline points="6 8 2 12 6 16"></polyline><line x1="2" y1="12" x2="22" y2="12"></line></svg>
              <span>Перенос</span>
            </template>
            <template v-else>
              <span class="done-text">✓ Готово</span>
            </template>
          </button>
        </div>

        <!-- Reorder Info Banner when active -->
        <transition name="fade">
          <div v-if="isReorderMode" class="reorder-mode-banner">
            <span>✨ Зажмите <b>☰</b> пальцем и перетащите рецепт в любую папку</span>
          </div>
        </transition>

        <div v-if="categories.length === 0" class="empty-state">
          <div class="empty-text">🍳<br>Добавьте первую<br>категорию рецептов</div>
          <button class="btn-primary" @click="openAddCategory">+ Добавить категорию</button>
        </div>
        
        <div v-else class="categories-container" :class="{ 'reorder-active': isReorderMode }">
          <div v-for="cat in categories" :key="cat.id" class="category-card m3-card" :class="{ 'expanded': expandedCategories.has(cat.id), 'reorder-dropzone': isReorderMode }" :style="cat.color !== 'default' ? `--cat-color: ${cat.color}` : ''">
            <div class="category-header" @click="toggleCategory(cat.id)">
              <div class="cat-title">
                <span class="emoji">{{ cat.emoji }}</span>
                <span class="name">{{ cat.name }}</span>
                <span v-if="isReorderMode" class="cat-count-badge">{{ getRecipesForCategory(cat.id).length }}</span>
              </div>
              <div class="cat-actions">
                <button v-if="!isReorderMode" class="btn-icon muted small" @click="deleteCategory(cat.id, $event)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
                <svg class="chevron-icon" :class="{'up': expandedCategories.has(cat.id)}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            
            <div v-show="expandedCategories.has(cat.id)" class="category-content">
              <div class="recipe-list" :ref="el => setSortableRef(el, cat.id)" :data-cat-id="cat.id">
                <div 
                  v-for="recipe in getRecipesForCategory(cat.id)" 
                  :key="recipe.id" 
                  class="recipe-item" 
                  :class="{ 'in-reorder-mode': isReorderMode }"
                  :data-id="recipe.id" 
                  @click="!isReorderMode && openRecipe(recipe)" 
                  :style="recipe.color !== 'default' ? `--recipe-color: ${recipe.color}` : ''"
                >
                  <!-- Drag Handle for finger touch -->
                  <div v-if="isReorderMode" class="drag-handle">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="20" y2="17"></line></svg>
                  </div>
                  <div class="recipe-item-info">
                    <div class="recipe-item-name">{{ recipe.name }}</div>
                    <div class="recipe-tags" v-if="recipe.tags && recipe.tags.length > 0">
                      <span v-for="tag in recipe.tags" :key="tag" class="recipe-tag-small">#{{ tag }}</span>
                    </div>
                    <div class="recipe-item-preview">{{ (recipe.content || '').substring(0, 50) }}...</div>
                  </div>
                  <div class="recipe-item-photo" v-if="recipe.photos && recipe.photos.length">
                    <img :src="recipe.photos[0]" />
                  </div>
                </div>
              </div>
              <button v-if="!isReorderMode" class="btn-text add-recipe-btn" @click="openAddRecipe(cat.id)">+ Добавить рецепт</button>
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
          <button class="detail-top-action" @click="showMoveModal = true" title="Переместить в другую папку">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><polyline points="12 11 12 17 15 14"></polyline></svg>
          </button>
          <button class="detail-top-action" @click="openEditRecipe" title="Редактировать">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="detail-top-action danger" @click="deleteCurrentRecipe" title="Удалить">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>

        <div class="detail-body">
          <!-- Unified Media Carousel (Video 1st, then Photos) -->
          <div class="detail-photo-card" v-if="selectedRecipeMedia.length > 0"
               @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
            <div class="detail-carousel" :style="{ transform: `translateX(-${currentCarouselIndex * 100}%)` }">
              <div class="detail-carousel-slide" v-for="(item, i) in selectedRecipeMedia" :key="i">
                <template v-if="item.type === 'video'">
                  <div class="carousel-video-wrapper">
                    <iframe 
                      v-if="isVideoEmbed(item.src)"
                      :src="item.src"
                      class="carousel-video-player carousel-video-iframe"
                      frameborder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowfullscreen
                    ></iframe>
                    <video 
                      v-else
                      :src="item.src" 
                      controls 
                      playsinline 
                      preload="metadata"
                      class="carousel-video-player"
                    ></video>
                  </div>
                </template>
                <template v-else>
                  <img :src="item.src" @click="openFullscreen(item.src)" />
                </template>
              </div>
            </div>
            
            <div class="detail-photo-dots" v-if="selectedRecipeMedia.length > 1">
              <span 
                v-for="(item, i) in selectedRecipeMedia" 
                :key="i" 
                class="photo-dot" 
                :class="{ 
                  active: i === currentCarouselIndex,
                  'video-dot': item.type === 'video'
                }"
              ></span>
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
          <div class="input-group">
            <div class="color-picker-header" @click="showCategoryColorPicker = !showCategoryColorPicker">
              <label>Цвет</label>
              <div class="color-picker-preview" :style="{ background: newCategoryColor === 'default' ? 'var(--surface-border)' : newCategoryColor }">
                <span v-if="newCategoryColor === 'default'" class="default-color-icon">✕</span>
              </div>
            </div>
            <div class="color-grid" v-show="showCategoryColorPicker">
              <div v-for="color in palette" :key="color" class="color-option"
                   :class="{ active: newCategoryColor === color }"
                   :style="{ background: color === 'default' ? 'var(--surface)' : color }"
                   @click="newCategoryColor = color; showCategoryColorPicker = false">
                <span v-if="color === 'default'" class="default-color-icon">✕</span>
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
          
          <!-- Video preview in edit modal -->
          <div class="form-island" v-if="editingRecipe.video_url">
            <div class="form-group">
              <div class="video-field-header">
                <label>🎬 Видео рецепта</label>
                <button type="button" class="btn-delete-video" @click="editingRecipe.video_url = null">✕ Удалить видео</button>
              </div>
              <div class="edit-video-box">
                <iframe 
                  v-if="isVideoEmbed(editingRecipe.video_url)"
                  :src="editingRecipe.video_url"
                  class="edit-video-iframe"
                  frameborder="0"
                  allowfullscreen
                ></iframe>
                <video v-else :src="editingRecipe.video_url" controls playsinline preload="metadata"></video>
              </div>
            </div>
          </div>
          
          <div class="form-island">
            <div class="form-group">
              <label>Категория</label>
              <select v-model="editingRecipe.category_id">
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.emoji }} {{ cat.name }}</option>
              </select>
            </div>
            
            <div class="island-divider"></div>
            
            <div class="form-group">
              <div class="color-picker-header" @click="showRecipeColorPicker = !showRecipeColorPicker">
                <label>Цвет карточки</label>
                <div class="color-picker-preview" :style="{ background: editingRecipe.color === 'default' ? 'var(--surface-border)' : editingRecipe.color }">
                  <span v-if="editingRecipe.color === 'default'" class="default-color-icon">✕</span>
                </div>
              </div>
              <div class="color-grid" v-show="showRecipeColorPicker">
                <div v-for="color in palette" :key="color" class="color-option"
                     :class="{ active: editingRecipe.color === color }"
                     :style="{ background: color === 'default' ? 'var(--surface)' : color }"
                     @click="editingRecipe.color = color; showRecipeColorPicker = false">
                  <span v-if="color === 'default'" class="default-color-icon">✕</span>
                </div>
              </div>
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
              <textarea ref="contentTextareaRef" v-model="editingRecipe.content" @input="adjustTextareaHeight" @focus="scrollToField($event)" placeholder="Ингредиенты, шаги..."></textarea>
            </div>
          </div>
          
          <div class="form-island">
            <div class="form-group">
              <label>Теги</label>
              <div class="tags-input-container">
                <div class="tags-list" v-if="editingRecipe.tags.length > 0">
                  <span v-for="tag in editingRecipe.tags" :key="tag" class="tag-badge">
                    #{{ tag }} <button class="tag-remove" @click="removeRecipeTag(tag)">✕</button>
                  </span>
                </div>
                <div class="tag-add-row">
                  <input type="text" v-model="newRecipeTag" placeholder="Добавить тег (без #)" @keyup.enter="addRecipeTag" @focus="scrollToField($event)">
                  <button class="btn-text-sm" @click="addRecipeTag">Добавить</button>
                </div>
              </div>
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

    <!-- MOVE RECIPE MODAL (Fast 1-tap folder selector) -->
    <transition name="fade">
      <div v-if="showMoveModal && selectedRecipe" class="modal-scrim" @click.self="showMoveModal = false">
        <div class="move-modal-card">
          <div class="move-modal-header">
            <div class="move-modal-title-wrap">
              <span class="move-modal-icon">📁</span>
              <div>
                <h3 class="move-modal-title">Переместить рецепт</h3>
                <p class="move-modal-sub">«{{ selectedRecipe.name }}»</p>
              </div>
            </div>
            <button class="close-btn-small" @click="showMoveModal = false">✕</button>
          </div>
          <div class="move-cat-list">
            <button 
              v-for="cat in categories" 
              :key="cat.id" 
              class="move-cat-btn"
              :class="{ current: selectedRecipe.category_id === cat.id }"
              @click="handleDirectMove(cat.id)"
            >
              <span class="move-cat-emoji">{{ cat.emoji }}</span>
              <span class="move-cat-name">{{ cat.name }}</span>
              <span v-if="selectedRecipe.category_id === cat.id" class="current-badge">✓ Текущая</span>
              <span v-else class="move-arrow">➔</span>
            </button>
          </div>
        </div>
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
.search-bar-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.search-input-wrap {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
}
.search-input-wrap input {
  width: 100%;
  padding: 10px 36px 10px 36px;
  border-radius: var(--radius-full);
  border: 1px solid var(--surface-border);
  background: var(--surface);
  font-size: 14px;
  color: var(--text-main);
  outline: none;
  font-family: var(--font-family);
  box-sizing: border-box;
}
.search-input-wrap input:focus {
  border-color: var(--primary);
}
.clear-search-btn {
  position: absolute;
  right: 12px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--surface-border);
  color: var(--text-main);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  border: none;
  cursor: pointer;
}

/* Reorder Mode Button & Banner */
.reorder-mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--surface-border);
  background: var(--surface);
  color: var(--text-main);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-family);
  cursor: pointer;
  white-space: nowrap;
  transition: var(--transition-fast);
  flex-shrink: 0;
}
.reorder-mode-btn:active {
  transform: scale(0.96);
  background: var(--surface-secondary);
}
.reorder-mode-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-on-primary);
  box-shadow: var(--shadow-sm);
}
.done-text {
  font-weight: 700;
}

.reorder-mode-banner {
  background: var(--primary-light);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--primary);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  animation: fadeIn 0.2s ease;
}

.cat-count-badge {
  font-size: 11px;
  font-weight: 700;
  background: var(--primary-light);
  color: var(--primary);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  margin-left: 6px;
}

.drag-handle {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  cursor: grab;
  touch-action: none;
  flex-shrink: 0;
  margin-right: 8px;
  border-radius: var(--radius-sm);
  background: var(--primary-light);
}
.drag-handle:active {
  cursor: grabbing;
}

.recipe-item.in-reorder-mode {
  user-select: none;
  -webkit-user-select: none;
}

/* SortableJS drag visuals */
.recipe-drag-ghost {
  opacity: 0.3 !important;
  background: var(--primary-light) !important;
  border: 2px dashed var(--primary) !important;
}
.recipe-drag-chosen {
  box-shadow: 0 12px 28px rgba(0,0,0,0.22) !important;
  transform: scale(1.02);
  z-index: 999;
}
.recipe-drag-dragging {
  cursor: grabbing !important;
  opacity: 0.95 !important;
}

.categories-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.category-card {
  border-left: 6px solid var(--cat-color, transparent);
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
  min-height: 20px; /* For sortable drop target */
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
  border-left: 4px solid var(--recipe-color, transparent);
}
.recipe-item:active { background: var(--surface-secondary); }
.recipe-item-info { flex: 1; overflow: hidden; display: flex; flex-direction: column; gap: 4px; }
.recipe-item-name { font-weight: 600; font-size: 15px; margin-bottom: 0; }
.recipe-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.recipe-tag-small {
  font-size: 11px;
  color: var(--primary);
  background: var(--primary-container);
  padding: 2px 6px;
  border-radius: 4px;
}
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

/* Photo/Video inside unified card */
.detail-photo-card {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  max-height: 320px;
  min-height: 220px; /* Fallback for iOS aspect-ratio collapse */
  flex-shrink: 0; /* Prevent flex container from collapsing it */
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--surface-border);
  background: #000;
}
.detail-carousel {
  display: flex;
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  transition: transform 0.35s cubic-bezier(0.2, 0, 0, 1);
}
.detail-carousel-slide {
  width: 100%; height: 100%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: #000;
}
.detail-carousel-slide img {
  width: 100%; height: 100%; object-fit: cover;
}
.carousel-video-wrapper {
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  justify-content: center;
  align-items: center;
}
.carousel-video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
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
.emoji-grid, .color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.emoji-option, .color-option {
  width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
  border-radius: var(--radius-sm);
  background: var(--surface-container);
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}
.emoji-option.active, .color-option.active {
  background: var(--primary-container);
  border: 2px solid var(--primary);
  transform: scale(1.1);
}
.color-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 4px 0;
}
.color-picker-header label {
  margin-bottom: 0;
  cursor: pointer;
}
.color-picker-preview {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--surface-border);
}
.default-color-icon {
  font-size: 16px;
  color: var(--text-muted);
}
.tags-input-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--primary-container);
  color: var(--primary);
  border-radius: var(--radius-full);
  font-size: 14px;
  font-weight: 500;
}
.tag-remove {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0,0,0,0.1);
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  border: none;
  cursor: pointer;
}
.tag-add-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.tag-add-row input {
  flex: 1;
  min-width: 0;
  margin-bottom: 0 !important;
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
  overflow-y: auto;
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

/* Edit Modal Video styles */
.video-field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.btn-delete-video {
  background: none;
  border: none;
  color: #d32f2f;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
}
.btn-delete-video:active {
  background: rgba(211, 47, 47, 0.1);
}
.edit-video-box {
  width: 100%;
  max-height: 240px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: #000;
  display: flex;
  justify-content: center;
}
.edit-video-box video {
  max-width: 100%;
  max-height: 240px;
  object-fit: contain;
}
.edit-video-iframe {
  width: 100%;
  height: 220px;
  border: none;
}
.carousel-video-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* Move Modal Styles */
.move-modal-card {
  width: 100%;
  max-width: 380px;
  max-height: 75vh;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: scaleIn 0.2s cubic-bezier(0.2, 0, 0, 1);
  padding: 16px;
  box-sizing: border-box;
}

.move-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--surface-border);
  margin-bottom: 12px;
}

.move-modal-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.move-modal-icon {
  font-size: 24px;
}

.move-modal-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
  font-family: var(--font-family);
}

.move-modal-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin: 2px 0 0;
  font-family: var(--font-family);
  max-width: 230px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.close-btn-small {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--surface-secondary);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  border: none;
  cursor: pointer;
}

.move-cat-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  max-height: 50vh;
}

.move-cat-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
  background: var(--bg-app);
  color: var(--text-main);
  cursor: pointer;
  transition: var(--transition-fast);
  text-align: left;
}

.move-cat-btn:active {
  background: var(--primary-light);
}

.move-cat-btn.current {
  border-color: var(--primary);
  background: var(--primary-light);
}

.move-cat-emoji {
  font-size: 20px;
}

.move-cat-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-family);
}

.current-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
}

.move-arrow {
  color: var(--text-muted);
  font-size: 14px;
}
</style>
