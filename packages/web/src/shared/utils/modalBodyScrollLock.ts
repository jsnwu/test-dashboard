let lockDepth = 0
let savedScrollY = 0
/** Bumped on every `acquire`; deferred unlock compares against snapshot from `release`. */
let unlockGeneration = 0

function applyBodyLock(): void {
    savedScrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedScrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
}

function applyBodyUnlock(): void {
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.overflow = ''
    window.scrollTo(0, savedScrollY)
}

/**
 * Ref-counted body scroll lock. The final `release` schedules unlock on a microtask so a
 * modal on the *next* route can `acquire` in the same commit; `acquire` bumps `unlockGeneration`
 * so that deferred unlock is skipped (avoids a paint with `body` unlocked — perceived flicker).
 */
export function acquireModalBodyScrollLock(): void {
    if (lockDepth === 0) {
        applyBodyLock()
    }
    lockDepth++
    unlockGeneration++
}

export function releaseModalBodyScrollLock(): void {
    if (lockDepth <= 0) {
        return
    }
    lockDepth--
    if (lockDepth > 0) {
        return
    }
    const snap = unlockGeneration
    queueMicrotask(() => {
        if (unlockGeneration !== snap || lockDepth > 0) {
            return
        }
        applyBodyUnlock()
    })
}
