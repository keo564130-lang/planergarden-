<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'

const props = defineProps({
  initialTime: {
    type: String,
    default: '12:00'
  }
})

const emit = defineEmits(['confirm', 'cancel'])

// Parse initial time
const parseInitialTime = () => {
  const parts = props.initialTime.split(':')
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  return {
    hour: isNaN(h) ? 12 : h,
    minute: isNaN(m) ? 0 : m
  }
}

const initialVals = parseInitialTime()
const selectedHour = ref(initialVals.hour)
const selectedMinute = ref(initialVals.minute)

const hoursWheel = ref(null)
const minutesWheel = ref(null)

// Initialize wheel scroll positions
onMounted(() => {
  nextTick(() => {
    if (hoursWheel.value) {
      hoursWheel.value.scrollTop = selectedHour.value * 40
    }
    if (minutesWheel.value) {
      minutesWheel.value.scrollTop = selectedMinute.value * 40
    }
  })
})

// Scroll Event Handlers
const handleScroll = (type, event) => {
  const scrollTop = event.target.scrollTop
  const index = Math.round(scrollTop / 40)
  
  if (type === 'hour') {
    if (index >= 0 && index < 24 && selectedHour.value !== index) {
      selectedHour.value = index
    }
  } else {
    if (index >= 0 && index < 60 && selectedMinute.value !== index) {
      selectedMinute.value = index
    }
  }
}

// Click to select and scroll
const selectItem = (type, val) => {
  if (type === 'hour') {
    selectedHour.value = val
    if (hoursWheel.value) {
      hoursWheel.value.scrollTo({ top: val * 40, behavior: 'smooth' })
    }
  } else {
    selectedMinute.value = val
    if (minutesWheel.value) {
      minutesWheel.value.scrollTo({ top: val * 40, behavior: 'smooth' })
    }
  }
}

// Format the final value
const formattedHour = computed(() => String(selectedHour.value).padStart(2, '0'))
const formattedMinute = computed(() => String(selectedMinute.value).padStart(2, '0'))

const handleConfirm = () => {
  emit('confirm', `${formattedHour.value}:${formattedMinute.value}`)
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<template>
  <div class="modal-scrim" @click.self="handleCancel">
    <div class="picker-island">
      <div class="picker-header">
        <h3 class="picker-title">Выберите время</h3>
      </div>
      
      <div class="picker-wheels-container">
        <!-- Center indicator highlight bar -->
        <div class="picker-center-bar"></div>
        
        <!-- Hours Wheel -->
        <div 
          ref="hoursWheel" 
          class="picker-wheel" 
          @scroll="handleScroll('hour', $event)"
        >
          <div class="wheel-scroller">
            <div 
              v-for="h in 24" 
              :key="h - 1" 
              class="picker-item" 
              :class="{ selected: selectedHour === h - 1 }"
              @click="selectItem('hour', h - 1)"
            >
              {{ String(h - 1).padStart(2, '0') }}
            </div>
          </div>
        </div>
        
        <div class="picker-column-separator">:</div>
        
        <!-- Minutes Wheel -->
        <div 
          ref="minutesWheel" 
          class="picker-wheel" 
          @scroll="handleScroll('minute', $event)"
        >
          <div class="wheel-scroller">
            <div 
              v-for="m in 60" 
              :key="m - 1" 
              class="picker-item" 
              :class="{ selected: selectedMinute === m - 1 }"
              @click="selectItem('minute', m - 1)"
            >
              {{ String(m - 1).padStart(2, '0') }}
            </div>
          </div>
        </div>
      </div>
      
      <div class="picker-footer">
        <button class="picker-btn cancel" @click="handleCancel">Отмена</button>
        <button class="picker-btn confirm" @click="handleConfirm">Готово</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scoped overrides if needed, but styling is largely governed by global style.css */
</style>
