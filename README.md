# CodeCollab

A real-time collaborative code editor platform built with React, TypeScript, and WebSockets. All data is stored locally in the browser using localStorage.

## 🌐 Live Demo

**Visit the live website:** [https://codecollaab.netlify.app/](https://codecollaab.netlify.app/)

## Features

- 🔐 **Authentication** - Email/password based authentication (stored locally)
- 👥 **Real-time Collaboration** - Multiple users can edit code simultaneously via WebSocket
- 💬 **Live Chat** - Real-time chat within each project
- 🚀 **Code Execution** - Run code in 12+ languages: Python, JavaScript, TypeScript, C, C++, Java, Go, Rust, PHP, Ruby, HTML, CSS
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

**Note:** For code execution to work, you need the appropriate runtime/compiler installed:
- **Python**: Python 3.x (https://www.python.org/downloads/)
- **JavaScript**: Node.js (already installed if you're running this)
- **TypeScript**: `npm install -g typescript ts-node`
- **C/C++**: gcc/g++ compiler (Windows: MinGW, Mac: Xcode tools, Linux: `sudo apt-get install g++`)
- **Java**: JDK (https://adoptium.net/)
- **Go**: Go compiler (https://go.dev/dl/)
- **Rust**: Rust toolchain (https://rustup.rs/)
- **PHP**: PHP interpreter (https://windows.php.net/download/ or `brew install php`)
- **Ruby**: Ruby interpreter (https://rubyinstaller.org/ or `brew install ruby`)
- **HTML/CSS**: Validation only (no runtime required)

If a runtime is missing, you'll see helpful installation instructions in the error message.

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

**🌐 [Try it live](https://codecollaab.netlify.app/)** - Visit the deployed application

Or run locally:
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

## Deployment

- **Frontend:** Deployed on [Netlify](https://netlify.com) - [Live Site](https://codecollaab.netlify.app/)
- **Backend:** Deployed on [Render](https://render.com) for code execution and WebSocket connections

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Notes

- The backend server must be running for code execution and real-time features to work
- All data is stored in browser localStorage - clearing browser data will delete all projects
- For production, consider migrating to a proper database for persistent storage
- Real-time collaboration works across different browser tabs/windows via WebSocket

