// Tactile Haptic Feedback Utilities

/**
 * Trigger crisp native haptic vibration
 */
export function triggerHaptic(type = 'tap') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return

  try {
    if (type === 'success') {
      // Crisp double-tap vibration for task completion
      navigator.vibrate([18, 50, 22])
    } else if (type === 'tap') {
      // Light tick on buttons/tabs
      navigator.vibrate(10)
    } else if (type === 'warning') {
      navigator.vibrate([30, 40, 30])
    }
  } catch (e) {
    // Graceful fallback on devices without vibration motor
  }
}
