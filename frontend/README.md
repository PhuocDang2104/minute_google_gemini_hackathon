# MeetMate Frontend (Electron + React)

Frontend của MeetMate cung cấp UI cho Pre/In/Post meeting, Knowledge Hub, và realtime transcript/recap. Dự án bao gồm Electron shell (main + preload) và renderer React chạy trên Vite.

## Overview
- Renderer: React + React Router + Vite.
- Electron main: tạo BrowserWindow, load dev server hoặc build local.
- Preload: contextBridge tối thiểu cho IPC an toàn.
- Kết nối backend qua REST + WebSocket.

## Directory Structure
```
electron/
├── src/
│   ├── main/                 # Electron main process
│   ├── preload/              # contextBridge (IPC safe layer)
│   └── renderer/
│       ├── app/              # routes, layouts
│       ├── features/         # domain modules (pre/in/post, knowledge)
│       ├── components/       # shared UI
│       ├── services/         # API clients
│       ├── store/            # global state
│       ├── styles/           # theme + globals
│       ├── i18n/             # translations
│       ├── lib/              # helpers
│       └── main.tsx          # renderer entry
├── public/
├── index.html
├── vite.config.ts
├── vercel.json
├── package.json
└── tsconfig.json
```

## Architecture Notes
### 1) Electron Shell
- `src/main/index.ts`: tạo cửa sổ và load URL.
- `src/preload/index.ts`: `contextBridge` cho API tối thiểu.

### 2) Renderer App
- Routes nằm trong `src/renderer/app/routes/`.
- UI chia theo feature: meetings, knowledge, tasks, settings...
- State + API: `store/`, `services/`, `lib/`.

### 3) Backend Integration
- Base URL lấy từ `VITE_API_URL` (mặc định trong `vite.config.ts`).
- Realtime WS: `/api/v1/ws/frontend/{session_id}`.

## Development
### Install & run (renderer)
```powershell
cd electron
npm install
npm run dev
```
Mở `http://localhost:5173` để chạy UI.

### Electron shell (optional)
- Main/preload đang ở dạng TypeScript và cần bundling/emit để chạy trong Electron.
- Nếu muốn chạy desktop shell: build renderer + thêm bước build main/preload (ví dụ dùng electron-vite hoặc tsc emit) rồi chạy Electron.

## Configuration
- `VITE_API_URL` để trỏ backend (local hoặc deployed).

Ví dụ (PowerShell):
```powershell
$env:VITE_API_URL="http://localhost:8000"
```

## Build
```powershell
cd electron
npm run build
```
Output renderer: `electron/dist/` (phục vụ cho web/preview).

## References
- UI flows: `docs/DEVELOPMENT_PLAN.md`
- Realtime flow: `docs/in_meeting_flow.md`
