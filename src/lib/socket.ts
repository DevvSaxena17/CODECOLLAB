import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socket: Socket | null = null;
let currentRoomId: string | null = null;
let currentUserId: string | null = null;

export const connectSocket = (roomId: string, userId: string): Socket => {
  
  if (socket?.connected && currentRoomId === roomId && currentUserId === userId) {
    return socket;
  }

  if (socket) {
    socket.removeAllListeners(); 
    socket.disconnect();
    socket = null;
  }
  
  currentRoomId = roomId;
  currentUserId = userId;
  
  socket = io(SOCKET_URL, {
    query: { roomId, userId },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    if (reason === 'io server disconnect') {
      
      socket?.connect();
    }
  });
  
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners(); 
    socket.disconnect();
    socket = null;
  }
  currentRoomId = null;
  currentUserId = null;
};

export const getSocket = (): Socket | null => socket;

