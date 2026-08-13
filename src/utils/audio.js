// Web Audio API Synth & Haptic Utilities for Duolingo-style sounds & haptics

let audioCtx = null

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (AudioContext) {
      audioCtx = new AudioContext()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

/**
 * Play a rich, joyful Duolingo-style completion chime (Chord: C5 -> G5 -> C6)
 */
export function playSuccessChime() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.35, gain: 0.15 }, // C5
      { freq: 659.25, time: 0.08, dur: 0.35, gain: 0.18 }, // E5
      { freq: 783.99, time: 0.16, dur: 0.40, gain: 0.20 }, // G5
      { freq: 1046.50, time: 0.24, dur: 0.55, gain: 0.25 } // C6
    ]

    notes.forEach(({ freq, time, dur, gain }) => {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + time)

      gainNode.gain.setValueAtTime(0, now + time)
      gainNode.gain.linearRampToValueAtTime(gain, now + time + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + dur)

      osc.connect(gainNode)
      gainNode.connect(ctx.destination)

      osc.start(now + time)
      osc.stop(now + time + dur)
    })
  } catch (e) {
    console.warn('Audio playback error:', e)
  }
}

/**
 * Play a subtle, tactile soft tap sound
 */
export function playTapSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.04)

    gainNode.gain.setValueAtTime(0.08, now)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.04)
  } catch (e) {
    console.warn('Tap sound error:', e)
  }
}

/**
 * Trigger rich haptic vibration
 */
export function triggerHaptic(type = 'tap') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return

  try {
    if (type === 'success') {
      // Duolingo-style double pop
      navigator.vibrate([15, 40, 25])
    } else if (type === 'tap') {
      navigator.vibrate(10)
    } else if (type === 'warning') {
      navigator.vibrate([30, 40, 30])
    }
  } catch (e) {
    // Ignore vibration errors on unsupported devices
  }
}
