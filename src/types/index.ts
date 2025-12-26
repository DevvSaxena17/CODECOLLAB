export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  admin_id: string; // Admin is the project creator
  name: string;
  created_at: string;
  updated_at: string;
}

export interface File {
  id: string;
  project_id: string;
  file_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  project_id: string;
  user_id: string;
  user_name?: string;
  content: string;
  timestamp: string;
}

// Change Request System (Admin Approval)
export interface ChangeRequest {
  id: string;
  project_id: string;
  file_id: string;
  user_id: string;
  user_name?: string;
  old_content: string;
  new_content: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  message?: string; // User's message explaining the change
}

// Commit System (GitHub-like)
export interface Commit {
  id: string;
  project_id: string;
  branch_id: string;
  user_id: string;
  user_name?: string;
  message: string;
  files: CommitFile[];
  created_at: string;
  parent_commit_id?: string; // For commit history
}

export interface CommitFile {
  file_id: string;
  file_name: string;
  old_content: string;
  new_content: string;
  action: 'create' | 'update' | 'delete';
}

// Branch System
export interface Branch {
  id: string;
  project_id: string;
  name: string;
  created_by: string;
  created_at: string;
  head_commit_id?: string; // Latest commit on this branch
  is_main: boolean; // Main/master branch
}

// Pull Request System
export interface PullRequest {
  id: string;
  project_id: string;
  source_branch_id: string;
  target_branch_id: string;
  title: string;
  description: string;
  created_by: string;
  created_by_name?: string;
  status: 'open' | 'merged' | 'closed';
  commits: string[]; // Commit IDs
  created_at: string;
  merged_at?: string;
  merged_by?: string;
}

export type Language = 'python' | 'c' | 'cpp' | 'css' | 'javascript' | 'java';

// Project Access & Member Management
export interface ProjectAccess {
  id: string;
  project_id: string;
  user_id: string;
  user_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  approved_at?: string;
  approved_by?: string;
}

export interface ProjectMember {
  user_id: string;
  user_name: string;
  email: string;
  status: 'pending' | 'approved';
  joined_at: string;
}

