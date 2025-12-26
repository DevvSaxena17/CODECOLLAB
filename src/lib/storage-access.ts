
import { ProjectAccess, ProjectMember } from '../types';
import { getUserById } from './storage';

const STORAGE_KEYS = {
  PROJECT_ACCESS: 'codecollab_project_access',
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
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

export const requestProjectAccess = (
  projectId: string,
  userId: string,
  userName?: string
): ProjectAccess => {
  const accesses = getStorage<ProjectAccess>(STORAGE_KEYS.PROJECT_ACCESS, []);

  const existing = accesses.find(
    (a) => a.project_id === projectId && a.user_id === userId
  );
  
  if (existing) {
    
    if (existing.status === 'rejected') {
      const newAccess: ProjectAccess = {
        ...existing,
        id: crypto.randomUUID(),
        status: 'pending',
        requested_at: new Date().toISOString(),
        approved_at: undefined,
        approved_by: undefined,
      };
      accesses.push(newAccess);
      setStorage(STORAGE_KEYS.PROJECT_ACCESS, accesses);
      return newAccess;
    }
    return existing;
  }

  const newAccess: ProjectAccess = {
    id: crypto.randomUUID(),
    project_id: projectId,
    user_id: userId,
    user_name: userName,
    status: 'pending',
    requested_at: new Date().toISOString(),
  };
  
  accesses.push(newAccess);
  setStorage(STORAGE_KEYS.PROJECT_ACCESS, accesses);
  return newAccess;
};

export const getAccessRequestsByProject = (projectId: string): ProjectAccess[] => {
  const accesses = getStorage<ProjectAccess>(STORAGE_KEYS.PROJECT_ACCESS, []);
  return accesses.filter((a) => a.project_id === projectId);
};

export const getPendingAccessRequests = (projectId: string): ProjectAccess[] => {
  return getAccessRequestsByProject(projectId).filter((a) => a.status === 'pending');
};

export const getUserAccessToProject = (
  projectId: string,
  userId: string
): ProjectAccess | null => {
  const accesses = getStorage<ProjectAccess>(STORAGE_KEYS.PROJECT_ACCESS, []);
  return (
    accesses.find((a) => a.project_id === projectId && a.user_id === userId) || null
  );
};

export const approveProjectAccess = (
  accessId: string,
  approvedBy: string
): ProjectAccess | null => {
  const accesses = getStorage<ProjectAccess>(STORAGE_KEYS.PROJECT_ACCESS, []);
  const index = accesses.findIndex((a) => a.id === accessId);
  if (index === -1) return null;

  accesses[index] = {
    ...accesses[index],
    status: 'approved',
    approved_at: new Date().toISOString(),
    approved_by: approvedBy,
  };
  setStorage(STORAGE_KEYS.PROJECT_ACCESS, accesses);
  return accesses[index];
};

export const rejectProjectAccess = (
  accessId: string,
  rejectedBy: string
): ProjectAccess | null => {
  const accesses = getStorage<ProjectAccess>(STORAGE_KEYS.PROJECT_ACCESS, []);
  const index = accesses.findIndex((a) => a.id === accessId);
  if (index === -1) return null;

  accesses[index] = {
    ...accesses[index],
    status: 'rejected',
    approved_by: rejectedBy,
  };
  setStorage(STORAGE_KEYS.PROJECT_ACCESS, accesses);
  return accesses[index];
};

export const getUserProjects = (userId: string): string[] => {
  const accesses = getStorage<ProjectAccess>(STORAGE_KEYS.PROJECT_ACCESS, []);
  return accesses
    .filter((a) => a.user_id === userId && a.status === 'approved')
    .map((a) => a.project_id);
};

export const getProjectMembers = (projectId: string): ProjectMember[] => {
  const accesses = getStorage<ProjectAccess>(STORAGE_KEYS.PROJECT_ACCESS, []);
  const projectAccesses = accesses.filter((a) => a.project_id === projectId);
  
  const members: ProjectMember[] = [];
  
  projectAccesses.forEach((access) => {
    const user = getUserById(access.user_id);
    if (user) {
      members.push({
        user_id: access.user_id,
        user_name: user.name,
        email: user.email,
        status: access.status as 'pending' | 'approved',
        joined_at: access.approved_at || access.requested_at,
      });
    }
  });
  
  return members;
};

export const hasProjectAccess = (projectId: string, userId: string): boolean => {

  const access = getUserAccessToProject(projectId, userId);
  return access?.status === 'approved';
};

