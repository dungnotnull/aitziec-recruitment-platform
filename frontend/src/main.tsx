import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/shared/styles/global.css'
import { Providers } from '@/app/providers'

async function enableMocking() {
  if (process.env.NODE_ENV !== 'development') {
    return
  }
  const { worker } = await import('@/api/mocks/browser')
  return worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Providers />
    </StrictMode>,
  )
})
