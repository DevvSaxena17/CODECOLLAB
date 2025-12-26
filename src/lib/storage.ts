
import { User, Project, File, Message } from '../types';

const STORAGE_KEYS = {
  USERS: 'codecollab_users',
  PROJECTS: 'codecollab_projects',
  FILES: 'codecollab_files',
  MESSAGES: 'codecollab_messages',
  CHANGE_REQUESTS: 'codecollab_change_requests',
  COMMITS: 'codecollab_commits',
  BRANCHES: 'codecollab_branches',
  PULL_REQUESTS: 'codecollab_pull_requests',
  CURRENT_USER: 'codecollab_current_user',
};

const getStorage = <T>(key: string, defaultValue: T[]): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setStorage = <T>(key: string, data: T[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error: any) {
    console.error('Error saving to localStorage:', error);
    
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      alert('Storage quota exceeded! Please clear some browser data or use a different browser.');
      throw new Error('Storage quota exceeded. Please free up space and try again.');
    }
    
    throw new Error(`Failed to save data: ${error.message || 'Unknown error'}`);
  }
};

export const createUser = (user: Omit<User, 'created_at'>): User => {
  const users = getStorage<User>(STORAGE_KEYS.USERS, []);
  const newUser: User = {
    ...user,
    created_at: new Date().toISOString(),
  };
  users.push(newUser);
  setStorage(STORAGE_KEYS.USERS, users);
  return newUser;
};

export const getUserById = (id: string): User | null => {
  const users = getStorage<User>(STORAGE_KEYS.USERS, []);
  return users.find((u) => u.id === id) || null;
};

export const getUserByEmail = (email: string): User | null => {
  const users = getStorage<User>(STORAGE_KEYS.USERS, []);
  return users.find((u) => u.email === email) || null;
};

export const createProject = (project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'admin_id'>): Project => {
  const projects = getStorage<Project>(STORAGE_KEYS.PROJECTS, []);
  const newProject: Project = {
    ...project,
    admin_id: project.owner_id, 
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  projects.push(newProject);
  setStorage(STORAGE_KEYS.PROJECTS, projects);
  
  return newProject;
};

export const isProjectAdmin = (projectId: string, userId: string): boolean => {
  const project = getProjectById(projectId);
  return project?.admin_id === userId;
};

export const getProjectById = (id: string): Project | null => {
  const projects = getStorage<Project>(STORAGE_KEYS.PROJECTS, []);
  return projects.find((p) => p.id === id) || null;
};

export const getProjectsByOwner = (ownerId: string): Project[] => {
  const projects = getStorage<Project>(STORAGE_KEYS.PROJECTS, []);
  return projects.filter((p) => p.owner_id === ownerId);
};

export const updateProject = (id: string, updates: Partial<Project>): Project | null => {
  const projects = getStorage<Project>(STORAGE_KEYS.PROJECTS, []);
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) return null;
  
  projects[index] = {
    ...projects[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  setStorage(STORAGE_KEYS.PROJECTS, projects);
  return projects[index];
};

export const deleteProject = (id: string): boolean => {
  const projects = getStorage<Project>(STORAGE_KEYS.PROJECTS, []);
  const filtered = projects.filter((p) => p.id !== id);
  setStorage(STORAGE_KEYS.PROJECTS, filtered);
  return filtered.length < projects.length;
};

export const createFile = (file: Omit<File, 'id' | 'created_at' | 'updated_at'>): File => {
  const files = getStorage<File>(STORAGE_KEYS.FILES, []);
  const newFile: File = {
    ...file,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  files.push(newFile);
  setStorage(STORAGE_KEYS.FILES, files);
  return newFile;
};

export const getFilesByProject = (projectId: string): File[] => {
  const files = getStorage<File>(STORAGE_KEYS.FILES, []);
  return files.filter((f) => f.project_id === projectId);
};

export const getFileById = (id: string): File | null => {
  const files = getStorage<File>(STORAGE_KEYS.FILES, []);
  return files.find((f) => f.id === id) || null;
};

export const updateFile = (id: string, updates: Partial<File>): File | null => {
  const files = getStorage<File>(STORAGE_KEYS.FILES, []);
  const index = files.findIndex((f) => f.id === id);
  if (index === -1) return null;
  
  files[index] = {
    ...files[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  setStorage(STORAGE_KEYS.FILES, files);
  return files[index];
};

export const deleteFile = (id: string): boolean => {
  const files = getStorage<File>(STORAGE_KEYS.FILES, []);
  const filtered = files.filter((f) => f.id !== id);
  setStorage(STORAGE_KEYS.FILES, filtered);
  return filtered.length < files.length;
};

export const createMessage = (message: Omit<Message, 'id' | 'timestamp'>): Message => {
  const messages = getStorage<Message>(STORAGE_KEYS.MESSAGES, []);
  const newMessage: Message = {
    ...message,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  messages.push(newMessage);
  setStorage(STORAGE_KEYS.MESSAGES, messages);
  return newMessage;
};

export const getMessagesByProject = (projectId: string): Message[] => {
  const messages = getStorage<Message>(STORAGE_KEYS.MESSAGES, []);
  return messages.filter((m) => m.project_id === projectId);
};

export const setCurrentUser = (user: User | null): void => {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
};

export const getCurrentUser = (): User | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!data) return null;
    const user = JSON.parse(data);
    
    return getUserById(user.id);
  } catch {
    return null;
  }
};

const hashPassword = (password: string): string => {
  
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; 
  }
  return hash.toString();
};

export const createUserWithPassword = (
  email: string,
  password: string,
  name: string
): User => {
  const users = getStorage<{ id: string; email: string; passwordHash: string }>(
    'codecollab_user_auth',
    []
  );

  if (users.find((u) => u.email === email)) {
    throw new Error('User already exists');
  }
  
  const userId = crypto.randomUUID();
  users.push({
    id: userId,
    email,
    passwordHash: hashPassword(password),
  });
  localStorage.setItem('codecollab_user_auth', JSON.stringify(users));
  
  return createUser({
    id: userId,
    name,
    email,
  });
};

export const verifyPassword = (email: string, password: string): User | null => {
  const users = getStorage<{ id: string; email: string; passwordHash: string }>(
    'codecollab_user_auth',
    []
  );
  
  const userAuth = users.find((u) => u.email === email);
  if (!userAuth) return null;
  
  const passwordHash = hashPassword(password);
  if (userAuth.passwordHash !== passwordHash) return null;
  
  return getUserById(userAuth.id);
};

