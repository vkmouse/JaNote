import { ref } from 'vue'
import type { Ref } from 'vue'

interface UseServiceWorkerUpdateReturn {
  needRefresh: Ref<boolean>
  updateServiceWorker: () => Promise<void>
}

export function useServiceWorkerUpdate(): UseServiceWorkerUpdateReturn {
  const needRefresh = ref(false)
  let registration: ServiceWorkerRegistration | null = null

  // 初始化：註冊 Service Worker 並監聽更新
  const init = async () => {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker is not supported in this browser')
      return
    }

    try {
      // 等待現有的 registration
      registration = await navigator.serviceWorker.ready
      
      console.log('Service Worker is ready')

      // 監聽新的 Service Worker 進入 waiting 狀態
      const checkForUpdate = () => {
        if (registration?.waiting) {
          console.log('New Service Worker is waiting')
          needRefresh.value = true
        }
      }

      // 立即檢查是否已經有等待中的 Service Worker
      checkForUpdate()

      // 監聽 updatefound 事件（當發現新的 Service Worker 時）
      registration.addEventListener('updatefound', () => {
        console.log('Update found - new Service Worker installing')
        const newWorker = registration?.installing

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            console.log('Service Worker state changed to:', newWorker.state)
            
            // 當新的 Service Worker 進入 waiting 狀態時
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New Service Worker installed and ready to activate')
              needRefresh.value = true
            }
          })
        }
      })

      // 監聽 controllerchange 事件（當控制權轉移時，自動重載頁面）
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Controller changed - reloading page')
        window.location.reload()
      })

      // 每 60 秒檢查一次更新
      setInterval(() => {
        console.log('Checking for Service Worker updates...')
        registration?.update()
      }, 60 * 1000)

    } catch (error) {
      console.error('Error during Service Worker initialization:', error)
    }
  }

  // 執行更新：通知等待中的 Service Worker 執行 skipWaiting
  const updateServiceWorker = async () => {
    if (!registration?.waiting) {
      console.log('No waiting Service Worker found')
      return
    }

    try {
      console.log('Sending SKIP_WAITING message to Service Worker')
      
      // 向等待中的 Service Worker 發送 SKIP_WAITING 訊息
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })

      // 設定一個保險機制：如果 5 秒後還沒重載，手動重載
      setTimeout(() => {
        console.log('Force reload after timeout')
        window.location.reload()
      }, 5000)

    } catch (error) {
      console.error('Error during Service Worker update:', error)
      // 如果出錯，直接重載頁面
      window.location.reload()
    }
  }

  // 啟動初始化
  init()

  return {
    needRefresh,
    updateServiceWorker
  }
}
