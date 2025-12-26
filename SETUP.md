# CodeCollab Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Backend Server

Open a terminal and run:
```bash
npm run server
```

The server will start on `http://localhost:3001`

**Requirements for Code Execution:**
- **Python**: Must have Python installed and in PATH
- **JavaScript**: Node.js is already installed (you're using it!)
- **C++**: Requires g++ compiler (install via your package manager)

### 3. Start the Frontend

Open a **new terminal** and run:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Testing the Application

1. **Sign Up**: Create a new account (stored in browser localStorage)
2. **Create Project**: Click "Create New Project" and give it a name
3. **Start Coding**: The editor will open automatically
4. **Share**: Click "Share" button to copy the project link
5. **Test Collaboration**: Open the link in another browser/incognito window and sign in with a different account
6. **Test Code Execution**: Write some code and click "Run"

## How It Works

- **Authentication**: User accounts and passwords are stored in browser localStorage
- **Projects & Files**: All project data is stored locally in the browser
- **Real-time Collaboration**: WebSocket server syncs changes between users
- **Code Execution**: Backend server executes code safely

## Troubleshooting

### Code Execution Not Working
- Make sure the backend server (`npm run server`) is running
- Check that Python/Node.js/g++ are installed and accessible from command line
- Check the server console for error messages

### Real-time Collaboration Not Working
- Ensure the backend server is running (it handles WebSocket connections)
- Check browser console for WebSocket connection errors
- Make sure both users are connected to the same WebSocket server

### Data Loss
- All data is stored in browser localStorage
- Clearing browser data will delete all projects
- Each browser/device has its own separate data
- For persistent storage across devices, consider migrating to a database

## Production Deployment

For production:
1. Update WebSocket URL to your production server
2. Configure CORS properly in `server.js`
3. Consider migrating to a database for persistent storage
4. Use a production-ready WebSocket server (consider using a service like Railway, Render, or Heroku)
5. Implement proper password hashing (currently uses simple hash)

## Notes

- All data is stored locally in the browser - no external database required
- Real-time collaboration works via WebSocket server
- Each browser has separate data - users on different browsers won't see each other's projects unless they share links
- For production, consider adding a proper database backend for persistent, cross-device storage

