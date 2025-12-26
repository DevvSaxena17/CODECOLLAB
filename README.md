# CodeCollab

A real-time collaborative code editor platform built with React, TypeScript, and WebSockets. All data is stored locally in the browser using localStorage.

## Features

- 🔐 **Authentication** - Email/password based authentication (stored locally)
- 👥 **Real-time Collaboration** - Multiple users can edit code simultaneously via WebSocket
- 💬 **Live Chat** - Real-time chat within each project
- 🚀 **Code Execution** - Run Python, JavaScript, and C++ code
- 📁 **File Management** - Create, rename, and delete files
- 🎨 **Dark Theme** - Beautiful dark UI with yellow/red/gold accents
- 📝 **Syntax Highlighting** - Powered by Monaco Editor
- 💾 **Local Storage** - All data stored in browser localStorage (no backend database required)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Backend Server

The backend server handles code execution and WebSocket connections:

```bash
npm run server
```

**Note:** For code execution to work, you need:
- Python installed (for Python execution)
- Node.js installed (for JavaScript execution)
- g++ compiler installed (for C++ execution)

### 3. Start the Frontend

In a new terminal:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Project Structure

```
├── src/
│   ├── pages/          # Page components (Landing, Login, Dashboard, Editor)
│   ├── contexts/       # React contexts (AuthContext)
│   ├── lib/            # Utilities (localStorage, Socket client)
│   ├── types/          # TypeScript type definitions
│   └── App.tsx         # Main app component with routing
├── server.js           # Backend server (Express + Socket.io)
└── package.json
```

## Usage

1. **Sign Up** - Create a new account (stored locally)
2. **Create Project** - Click "Create New Project" on the dashboard
3. **Share** - Use the "Share" button to copy a link and invite collaborators
4. **Code** - Start coding! Changes sync in real-time via WebSocket
5. **Run** - Click "Run" to execute your code
6. **Chat** - Use the chat panel to communicate with collaborators

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Monaco Editor
- **Backend:** Express.js, Socket.io (for real-time collaboration and code execution)
- **Storage:** Browser localStorage (no external database)
- **Authentication:** Local password-based auth
- **Real-time:** Socket.io WebSockets

## Notes

- The backend server must be running for code execution and real-time features to work
- All data is stored in browser localStorage - clearing browser data will delete all projects
- For production, consider migrating to a proper database for persistent storage
- Real-time collaboration works across different browser tabs/windows via WebSocket

