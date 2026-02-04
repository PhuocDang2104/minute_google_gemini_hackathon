import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import router from './app/router'
import { LanguageProvider } from './contexts/LanguageContext'
import { ChatProvider } from './contexts/ChatContext'
import { RecordingStateProvider } from './contexts/RecordingStateContext'
import './styles/global.css'

const root = document.getElementById('root') as HTMLElement
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <LanguageProvider>
      <RecordingStateProvider>
        <ChatProvider>
          <RouterProvider router={router} />
        </ChatProvider>
      </RecordingStateProvider>
    </LanguageProvider>
  </React.StrictMode>
)
