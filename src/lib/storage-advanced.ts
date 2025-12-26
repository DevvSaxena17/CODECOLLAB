
import { ChangeRequest, Commit, Branch, PullRequest } from '../types';

const STORAGE_KEYS = {
  CHANGE_REQUESTS: 'codecollab_change_requests',
  COMMITS: 'codecollab_commits',
  BRANCHES: 'codecollab_branches',
  PULL_REQUESTS: 'codecollab_pull_requests',
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

export const createChangeRequest = (
  changeRequest: Omit<ChangeRequest, 'id' | 'created_at' | 'status'>
): ChangeRequest => {
  const requests = getStorage<ChangeRequest>(STORAGE_KEYS.CHANGE_REQUESTS, []);
  const newRequest: ChangeRequest = {
    ...changeRequest,
    id: crypto.randomUUID(),
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  requests.push(newRequest);
  setStorage(STORAGE_KEYS.CHANGE_REQUESTS, requests);
  return newRequest;
};

export const getChangeRequestsByProject = (projectId: string): ChangeRequest[] => {
  const requests = getStorage<ChangeRequest>(STORAGE_KEYS.CHANGE_REQUESTS, []);
  return requests.filter((r) => r.project_id === projectId);
};

export const getPendingChangeRequests = (projectId: string): ChangeRequest[] => {
  return getChangeRequestsByProject(projectId).filter((r) => r.status === 'pending');
};

export const approveChangeRequest = (
  requestId: string,
  reviewedBy: string
): ChangeRequest | null => {
  const requests = getStorage<ChangeRequest>(STORAGE_KEYS.CHANGE_REQUESTS, []);
  const index = requests.findIndex((r) => r.id === requestId);
  if (index === -1) return null;

  requests[index] = {
    ...requests[index],
    status: 'approved',
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewedBy,
  };
  setStorage(STORAGE_KEYS.CHANGE_REQUESTS, requests);
  return requests[index];
};

export const rejectChangeRequest = (
  requestId: string,
  reviewedBy: string
): ChangeRequest | null => {
  const requests = getStorage<ChangeRequest>(STORAGE_KEYS.CHANGE_REQUESTS, []);
  const index = requests.findIndex((r) => r.id === requestId);
  if (index === -1) return null;

  requests[index] = {
    ...requests[index],
    status: 'rejected',
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewedBy,
  };
  setStorage(STORAGE_KEYS.CHANGE_REQUESTS, requests);
  return requests[index];
};

export const createBranch = (branch: Omit<Branch, 'id' | 'created_at'>): Branch => {
  const branches = getStorage<Branch>(STORAGE_KEYS.BRANCHES, []);
  const newBranch: Branch = {
    ...branch,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  branches.push(newBranch);
  setStorage(STORAGE_KEYS.BRANCHES, branches);
  return newBranch;
};

export const getBranchesByProject = (projectId: string): Branch[] => {
  const branches = getStorage<Branch>(STORAGE_KEYS.BRANCHES, []);
  return branches.filter((b) => b.project_id === projectId);
};

export const getBranchById = (id: string): Branch | null => {
  const branches = getStorage<Branch>(STORAGE_KEYS.BRANCHES, []);
  return branches.find((b) => b.id === id) || null;
};

export const getMainBranch = (projectId: string): Branch | null => {
  const branches = getBranchesByProject(projectId);
  return branches.find((b) => b.is_main) || null;
};

export const updateBranch = (id: string, updates: Partial<Branch>): Branch | null => {
  const branches = getStorage<Branch>(STORAGE_KEYS.BRANCHES, []);
  const index = branches.findIndex((b) => b.id === id);
  if (index === -1) return null;

  branches[index] = { ...branches[index], ...updates };
  setStorage(STORAGE_KEYS.BRANCHES, branches);
  return branches[index];
};

export const createCommit = (commit: Omit<Commit, 'id' | 'created_at'>): Commit => {
  const commits = getStorage<Commit>(STORAGE_KEYS.COMMITS, []);
  const newCommit: Commit = {
    ...commit,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  commits.push(newCommit);
  setStorage(STORAGE_KEYS.COMMITS, commits);

  if (commit.branch_id) {
    updateBranch(commit.branch_id, { head_commit_id: newCommit.id });
  }

  return newCommit;
};

export const getCommitsByBranch = (branchId: string): Commit[] => {
  const commits = getStorage<Commit>(STORAGE_KEYS.COMMITS, []);
  return commits.filter((c) => c.branch_id === branchId);
};

export const getCommitById = (id: string): Commit | null => {
  const commits = getStorage<Commit>(STORAGE_KEYS.COMMITS, []);
  return commits.find((c) => c.id === id) || null;
};

export const getCommitHistory = (branchId: string): Commit[] => {
  const commits = getCommitsByBranch(branchId);
  
  const commitMap = new Map(commits.map((c) => [c.id, c]));
  const history: Commit[] = [];
  
  const branch = getBranchById(branchId);
  if (!branch?.head_commit_id) return [];

  let currentCommitId: string | undefined = branch.head_commit_id;
  while (currentCommitId) {
    const commit = commitMap.get(currentCommitId);
    if (!commit) break;
    history.push(commit);
    currentCommitId = commit.parent_commit_id;
  }

  return history;
};

export const createPullRequest = (
  pr: Omit<PullRequest, 'id' | 'created_at' | 'status'>
): PullRequest => {
  const prs = getStorage<PullRequest>(STORAGE_KEYS.PULL_REQUESTS, []);
  const newPR: PullRequest = {
    ...pr,
    id: crypto.randomUUID(),
    status: 'open',
    created_at: new Date().toISOString(),
  };
  prs.push(newPR);
  setStorage(STORAGE_KEYS.PULL_REQUESTS, prs);
  return newPR;
};

export const getPullRequestsByProject = (projectId: string): PullRequest[] => {
  const prs = getStorage<PullRequest>(STORAGE_KEYS.PULL_REQUESTS, []);
  return prs.filter((pr) => pr.project_id === projectId);
};

export const getOpenPullRequests = (projectId: string): PullRequest[] => {
  return getPullRequestsByProject(projectId).filter((pr) => pr.status === 'open');
};

export const mergePullRequest = (
  prId: string,
  mergedBy: string
): PullRequest | null => {
  const prs = getStorage<PullRequest>(STORAGE_KEYS.PULL_REQUESTS, []);
  const index = prs.findIndex((pr) => pr.id === prId);
  if (index === -1) return null;

  prs[index] = {
    ...prs[index],
    status: 'merged',
    merged_at: new Date().toISOString(),
    merged_by: mergedBy,
  };
  setStorage(STORAGE_KEYS.PULL_REQUESTS, prs);
  return prs[index];
};

export const closePullRequest = (prId: string): PullRequest | null => {
  const prs = getStorage<PullRequest>(STORAGE_KEYS.PULL_REQUESTS, []);
  const index = prs.findIndex((pr) => pr.id === prId);
  if (index === -1) return null;

  prs[index] = {
    ...prs[index],
    status: 'closed',
  };
  setStorage(STORAGE_KEYS.PULL_REQUESTS, prs);
  return prs[index];
};

export const calculateDiff = (oldContent: string, newContent: string): {
  added: number;
  removed: number;
  lines: Array<{ type: 'added' | 'removed' | 'unchanged'; content: string }>;
} => {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  const maxLen = Math.max(oldLines.length, newLines.length);
  const diff: Array<{ type: 'added' | 'removed' | 'unchanged'; content: string }> = [];
  let added = 0;
  let removed = 0;

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      diff.push({ type: 'added', content: newLine });
      added++;
    } else if (newLine === undefined) {
      diff.push({ type: 'removed', content: oldLine });
      removed++;
    } else if (oldLine === newLine) {
      diff.push({ type: 'unchanged', content: oldLine });
    } else {
      diff.push({ type: 'removed', content: oldLine });
      diff.push({ type: 'added', content: newLine });
      removed++;
      added++;
    }
  }

  return { added, removed, lines: diff };
};

