<template>
  <div class="modal-scrim" @click.self="cancel">
    <div class="time-picker-modal">
      <div class="time-display">
        <div 
          class="time-segment" 
          :class="{ active: mode === 'hour' }"
          @click="mode = 'hour'"
        >
          {{ formatTwoDigits(selectedHour) }}
        </div>
        <div class="time-separator">:</div>
        <div 
          class="time-segment" 
          :class="{ active: mode === 'minute' }"
          @click="mode = 'minute'"
        >
          {{ formatTwoDigits(selectedMinute) }}
        </div>
      </div>
      
      <div class="dial-container">
        <div 
          class="dial" 
          ref="dialRef" 
          @mousedown="onPointerDown" 
          @touchstart.passive="onPointerDown" 
          @mousemove="onPointerMove" 
          @touchmove.passive="onPointerMove" 
          @mouseup="onPointerUp" 
          @touchend="onPointerUp"
          @mouseleave="onPointerUp"
        >
          <div class="dial-center"></div>
          <div class="dial-hand" :style="handStyle">
            <div class="dial-thumb"></div>
          </div>
          
          <template v-if="mode === 'hour'">
            <div 
              v-for="h in 12" 
              :key="'h1_'+h" 
              class="dial-number" 
              :style="getNumberStyle(h, 1, 12)"
            >
              {{ h }}
            </div>
            <div 
              v-for="h in 12" 
              :key="'h2_'+h" 
              class="dial-number inner" 
              :style="getNumberStyle(h, 2, 12)"
            >
              {{ h === 12 ? '00' : h + 12 }}
            </div>
          </template>
          
          <template v-else>
             <div 
               v-for="m in 12" 
               :key="'m_'+m" 
               class="dial-number" 
               :style="getNumberStyle(m, 1, 12)"
             >
              {{ formatTwoDigits((m === 12 ? 0 : m) * 5) }}
            </div>
          </template>
        </div>
      </div>
      
      <div class="modal-actions">
        <button class="btn-text" @click="cancel">Отмена</button>
        <button class="btn-text" @click="confirm">ОК</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  initialTime: { type: String, default: '12:00' }
});
const emit = defineEmits(['confirm', 'cancel']);

const mode = ref('hour');
const selectedHour = ref(12);
const selectedMinute = ref(0);
const dialRef = ref(null);
const isDragging = ref(false);

onMounted(() => {
  if (props.initialTime) {
    const [h, m] = props.initialTime.split(':').map(Number);
    if (!isNaN(h)) selectedHour.value = h;
    if (!isNaN(m)) selectedMinute.value = m;
  }
});

const formatTwoDigits = (num) => num.toString().padStart(2, '0');

const cancel = () => emit('cancel');
const confirm = () => {
  emit('confirm', `${formatTwoDigits(selectedHour.value)}:${formatTwoDigits(selectedMinute.value)}`);
};

const getAngle = (val, max) => {
  return (val / max) * 360 - 90; 
};

const handStyle = computed(() => {
  let angle = 0;
  let radius = 100;
  if (mode.value === 'hour') {
    const h = selectedHour.value;
    const isInner = h === 0 || h > 12;
    radius = isInner ? 64 : 100;
    const displayH = h % 12 || 12;
    angle = getAngle(displayH, 12);
  } else {
    angle = getAngle(selectedMinute.value, 60);
    radius = 100;
  }
  return {
    transform: `rotate(${angle}deg)`,
    width: `${radius}px`
  };
});

const getNumberStyle = (index, ring, max) => {
  const angle = (index / max) * 360 - 90;
  const rad = angle * Math.PI / 180;
  const radius = ring === 1 ? 100 : 64;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;
  
  return {
    left: `calc(50% + ${x}px - 16px)`,
    top: `calc(50% + ${y}px - 16px)`
  };
};

const updateValueFromEvent = (e) => {
  if (!dialRef.value) return;
  const rect = dialRef.value.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  angle += 90;
  if (angle < 0) angle += 360;
  
  const distance = Math.sqrt(dx*dx + dy*dy);
  
  if (mode.value === 'hour') {
    let h = Math.round(angle / 30);
    if (h === 0) h = 12;
    
    const isInner = distance < rect.width / 2 * 0.75;
    if (isInner) {
      if (h === 12) h = 0;
      else h += 12;
    } else {
      if (h === 12) h = 12;
    }
    selectedHour.value = h;
  } else {
    let m = Math.round(angle / 6);
    if (m === 60) m = 0;
    selectedMinute.value = m;
  }
};

const onPointerDown = (e) => {
  if (e.type !== 'touchstart') e.preventDefault();
  isDragging.value = true;
  updateValueFromEvent(e);
};

const onPointerMove = (e) => {
  if (!isDragging.value) return;
  if (e.type !== 'touchmove') e.preventDefault();
  updateValueFromEvent(e);
};

const onPointerUp = () => {
  if (isDragging.value) {
    isDragging.value = false;
    if (mode.value === 'hour') {
      mode.value = 'minute';
    }
  }
};
</script>

<style scoped>
.modal-scrim {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadeIn 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.time-picker-modal {
  background-color: var(--surface);
  border-radius: 28px;
  box-shadow: var(--shadow-lg);
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: scaleIn 0.3s cubic-bezier(0.2, 0, 0, 1);
  font-family: var(--font-family, 'Google Sans Text', sans-serif);
}

.time-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 32px;
}

.time-segment {
  width: 96px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 500;
  color: var(--text-main);
  background-color: var(--bg-app, #f0f0f0);
  border-radius: 16px;
  cursor: pointer;
  transition: all var(--transition, 0.2s ease);
}

.time-segment.active {
  background-color: var(--primary);
  color: var(--text-on-primary, #fff);
}

.time-separator {
  font-size: 48px;
  color: var(--text-main);
  font-weight: 400;
}

.dial-container {
  position: relative;
  width: 240px;
  height: 240px;
  margin-bottom: 24px;
}

.dial {
  width: 100%;
  height: 100%;
  background-color: var(--bg-app, #f0f0f0);
  border-radius: 50%;
  position: relative;
  touch-action: none;
  cursor: pointer;
}

.dial-center {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  background-color: var(--primary);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
}

.dial-hand {
  position: absolute;
  top: 50%;
  left: 50%;
  height: 2px;
  background-color: var(--primary);
  transform-origin: 0 50%;
  z-index: 1;
  pointer-events: none;
  transition: width 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.dial-thumb {
  position: absolute;
  right: -16px;
  top: 50%;
  width: 32px;
  height: 32px;
  background-color: var(--primary);
  border-radius: 50%;
  transform: translateY(-50%);
  opacity: 0.15;
}

.dial-number {
  position: absolute;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--text-main);
  border-radius: 50%;
  pointer-events: none;
  z-index: 2;
  transition: all var(--transition, 0.2s ease);
}

.dial-number.inner {
  font-size: 12px;
  color: var(--text-muted);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  gap: 8px;
}

.btn-text {
  background: transparent;
  border: none;
  color: var(--primary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  padding: 10px 16px;
  border-radius: 20px;
  cursor: pointer;
  transition: background-color var(--transition, 0.2s ease);
  min-height: 48px;
}

.btn-text:hover,
.btn-text:active {
  background-color: var(--primary-light, rgba(0, 0, 0, 0.05));
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
