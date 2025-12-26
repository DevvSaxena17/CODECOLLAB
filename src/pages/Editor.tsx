import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getProjectById,
  getFilesByProject,
  getFileById,
  updateFile,
  createFile,
  deleteFile,
  getMessagesByProject,
  createMessage,
  getUserById,
  isProjectAdmin,
} from '../lib/storage';
import {
  hasProjectAccess,
  getUserAccessToProject,
} from '../lib/storage-access';
import {
  createChangeRequest,
  getPendingChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
  createCommit,
  createBranch,
  getBranchesByProject,
  getMainBranch,
  getCommitsByBranch,
  getOpenPullRequests,
  mergePullRequest,
  getBranchById,
} from '../lib/storage-advanced';
import {
  getPendingAccessRequests,
  approveProjectAccess,
  rejectProjectAccess,
  getProjectMembers,
} from '../lib/storage-access';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import Editor from '@monaco-editor/react';
import { File as FileType, Project, Language, Message, ChangeRequest, Branch, Commit, PullRequest } from '../types';
import { 
  Plus, Trash2, Edit2, Check, X, Play, Share2, 
  ArrowLeft, LogOut, Send, File, GitBranch, GitCommit, GitPullRequest,
  Shield, CheckCircle, XCircle, Clock, GitMerge, Users, Copy, Loader2
} from 'lucide-react';

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileType[]>([]);
  const [activeFile, setActiveFile] = useState<FileType | null>(null);
  const [language, setLanguage] = useState<Language>('python');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<ChangeRequest[]>([]);
  const [selectedChangeRequest, setSelectedChangeRequest] = useState<ChangeRequest | null>(null);
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [changeRequestMessage, setChangeRequestMessage] = useState('');

  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [showBranches, setShowBranches] = useState(false);
  const [showCommits, setShowCommits] = useState(false);
  const [showPullRequests, setShowPullRequests] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [localChanges, setLocalChanges] = useState<Map<string, string>>(new Map()); 
  const [originalFileContent, setOriginalFileContent] = useState<Map<string, string>>(new Map()); 
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<any[]>([]);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  
  const editorRef = useRef<any>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!user || !projectId) {
      navigate('/login');
      return;
    }

    setupSocket();

    return () => {
      disconnectSocket();
    };
  }, [projectId, user]);

  const loadProject = () => {
    try {
      if (!projectId || !user) return;

      const projectData = getProjectById(projectId);
      if (!projectData) {
        alert('Project not found. Please check the share code.');
        navigate('/dashboard');
        return;
      }

      const isUserAdmin = isProjectAdmin(projectId, user.id);
      if (!isUserAdmin && !hasProjectAccess(projectId, user.id)) {
        const access = getUserAccessToProject(projectId, user.id);
        if (!access) {
          alert('You do not have access to this project. Please request access from the dashboard first.');
          navigate('/dashboard');
          return;
        } else if (access.status === 'pending') {
          alert('Your join request is pending approval from the project admin.');
          navigate('/dashboard');
          return;
        } else if (access.status === 'rejected') {
          alert('Your join request was rejected. Please contact the project admin.');
          navigate('/dashboard');
          return;
        }
      }

      if (!isUserAdmin && hasProjectAccess(projectId, user.id) && !projectData) {

      }

      let filesData = getFilesByProject(projectId);
      let messagesData = getMessagesByProject(projectId);

      setProject(projectData);
        filesData.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setFiles(filesData);
        
        if (filesData.length > 0) {
          const firstFile = filesData[0];
          setActiveFile(firstFile);
          detectLanguage(firstFile.file_name);
          
          if (user && !isProjectAdmin(projectId, user.id)) {
            setOriginalFileContent((prev) => {
              const newMap = new Map(prev);
              newMap.set(firstFile.id, firstFile.content);
              return newMap;
            });
          }
        }

        if (user) {
          const adminStatus = isProjectAdmin(projectId, user.id);
          setIsAdmin(adminStatus);
          
          if (adminStatus) {
            loadPendingChanges();
            loadPendingJoinRequests();
            loadProjectMembers();
          }
        }

        loadBranches();
        loadPullRequests();

        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit('share-project-data', {
            project: projectData,
            files: filesData,
            messages: messagesData,
          });
        }

        loadChatMessages();

        const socket2 = getSocket();
        if (socket2 && socket2.connected && filesData.length === 0) {
          socket2.emit('request-project-data');
          
          socket2.once('project-data', (data: any) => {
              if (data && data.project && data.files) {
              
              const existingProject = getProjectById(data.project.id);
              if (!existingProject && user && hasProjectAccess(data.project.id, user.id)) {

                try {
                  const projectsStr = localStorage.getItem('codecollab_projects');
                  const projects = projectsStr ? JSON.parse(projectsStr) : [];
                  if (!projects.find((p: any) => p.id === data.project.id)) {
                    projects.push(data.project);
                    localStorage.setItem('codecollab_projects', JSON.stringify(projects));
                  }
                } catch (e) {
                  console.error('Error saving project:', e);
                }
              }

              if (data.files.length > 0) {
                let filesImported = false;
                data.files.forEach((file: FileType) => {
                  const existing = getFileById(file.id);
                  if (!existing) {
                    createFile({
                      project_id: file.project_id,
                      file_name: file.file_name,
                      content: file.content,
                    });
                    filesImported = true;
                  }
                });
                
                if (filesImported) {
                  
                  const updatedFiles = getFilesByProject(projectId!);
                  updatedFiles.sort((a, b) => 
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  );
                  setFiles(updatedFiles);
                  if (updatedFiles.length > 0 && !activeFile) {
                    setActiveFile(updatedFiles[0]);
                    detectLanguage(updatedFiles[0].file_name);
                  }
                  loadChatMessages();
                }
              }
            }
          });
        }
    } catch (error) {
      console.error('Error loading project:', error);
      alert('Failed to load project');
    }
  };

  const loadChatMessages = () => {
    try {
      if (!projectId) return;
      const messages = getMessagesByProject(projectId);
      
      const enrichedMessages = messages.map((msg) => {
        const user = getUserById(msg.user_id);
        return { ...msg, user_name: user?.name };
      });
      enrichedMessages.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setChatMessages(enrichedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadPendingChanges = () => {
    if (!projectId) return;
    const pending = getPendingChangeRequests(projectId);
    setPendingChanges(pending);
  };

  const loadBranches = () => {
    if (!projectId) return;
    const projectBranches = getBranchesByProject(projectId);
    setBranches(projectBranches);
    const main = getMainBranch(projectId);
    const branch = main || projectBranches[0] || null;
    setCurrentBranch(branch);
    if (branch) {
      loadCommits(branch.id);
    }
  };

  const loadCommits = (branchId?: string) => {
    const branch = branchId ? getBranchById(branchId) : currentBranch;
    if (!branch) return;
    const branchCommits = getCommitsByBranch(branch.id);
    setCommits(branchCommits);
  };

  const loadPullRequests = () => {
    if (!projectId) return;
    const prs = getOpenPullRequests(projectId);
    setPullRequests(prs);
  };

  const loadPendingJoinRequests = () => {
    if (!projectId) return;
    const requests = getPendingAccessRequests(projectId);
    setPendingJoinRequests(requests);
  };

  const loadProjectMembers = () => {
    if (!projectId) return;
    const members = getProjectMembers(projectId);
    setProjectMembers(members);
  };

  const handleApproveJoinRequest = (accessId: string) => {
    if (!user) return;
    approveProjectAccess(accessId, user.id);
    loadPendingJoinRequests();
    loadProjectMembers();
  };

  const handleRejectJoinRequest = (accessId: string) => {
    if (!user) return;
    rejectProjectAccess(accessId, user.id);
    loadPendingJoinRequests();
    loadProjectMembers();
  };

  const handleApproveChange = (requestId: string) => {
    if (!user) return;
    const approved = approveChangeRequest(requestId, user.id);
    if (approved) {
      
      const file = getFileById(approved.file_id);
      if (file) {
        updateFile(approved.file_id, { content: approved.new_content });
        setFiles((prev) => prev.map((f) => 
          f.id === approved.file_id ? { ...f, content: approved.new_content } : f
        ));
        if (activeFile?.id === approved.file_id) {
          setActiveFile({ ...activeFile, content: approved.new_content });
        }
      }
      loadPendingChanges();
      setSelectedChangeRequest(null);
    }
  };

  const handleRejectChange = (requestId: string) => {
    if (!user) return;
    rejectChangeRequest(requestId, user.id);
    loadPendingChanges();
    setSelectedChangeRequest(null);
  };

  const setupSocket = () => {
    if (!projectId || !user) return;

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
    }

    const socket = connectSocket(projectId, user.id);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket');
      
      loadProject();
    });

    socket.on('code-change', (data: { fileId: string; content: string }) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === data.fileId ? { ...f, content: data.content } : f))
      );
      if (activeFile?.id === data.fileId) {
        setActiveFile((prev) => (prev ? { ...prev, content: data.content } : null));
      }
    });

    socket.on('file-created', (file: FileType) => {
      setFiles((prev) => [...prev, file]);
    });

    socket.on('file-deleted', (fileId: string) => {
      setFiles((prev) => {
        const updated = prev.filter((f) => f.id !== fileId);
        
        setActiveFile((currentActive) => {
          if (currentActive?.id === fileId) {
            return updated.length > 0 ? updated[0] : null;
          }
          return currentActive;
        });
        return updated;
      });
    });

    socket.on('new-message', (message: Message) => {
      setChatMessages((prev) => [...prev, message]);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      
      setOutput('Error: Unable to connect to collaboration server. Real-time features may not work.');
    });
  };

  const detectLanguage = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'py') setLanguage('python');
    else if (ext === 'c') setLanguage('c');
    else if (ext === 'cpp' || ext === 'cxx' || ext === 'cc') setLanguage('cpp');
    else if (ext === 'css') setLanguage('css');
    else if (ext === 'js' || ext === 'jsx') setLanguage('javascript');
    else if (ext === 'ts' || ext === 'tsx') setLanguage('typescript');
    else if (ext === 'java') setLanguage('java');
    else if (ext === 'go') setLanguage('go');
    else if (ext === 'rs') setLanguage('rust');
    else if (ext === 'php') setLanguage('php');
    else if (ext === 'rb') setLanguage('ruby');
    else if (ext === 'html' || ext === 'htm') setLanguage('html');
  };

  const getFileExtension = (lang: Language): string => {
    switch (lang) {
      case 'python': return 'py';
      case 'c': return 'c';
      case 'cpp': return 'cpp';
      case 'css': return 'css';
      case 'javascript': return 'js';
      case 'java': return 'java';
      case 'typescript': return 'ts';
      case 'go': return 'go';
      case 'rust': return 'rs';
      case 'php': return 'php';
      case 'ruby': return 'rb';
      case 'html': return 'html';
      default: return 'txt';
    }
  };

  const handleLanguageChange = async (newLanguage: Language) => {
    if (!projectId || !user) return;

    const ext = getFileExtension(newLanguage);
    const defaultFileName = `main.${ext}`;

    const existingFile = files.find(f => {
      const fileExt = f.file_name.split('.').pop()?.toLowerCase();
      return fileExt === ext;
    });

    if (existingFile) {
      
      setActiveFile(existingFile);
      detectLanguage(existingFile.file_name);
    } else {
      
      const newFile = createFile({
        project_id: projectId,
        file_name: defaultFileName,
        content: getDefaultContent(defaultFileName),
      });

      if (newFile) {
        setFiles((prev) => [...prev, newFile]);
        setActiveFile(newFile);
        setLanguage(newLanguage);

        const socket = getSocket();
        if (socket) {
          socket.emit('file-created', newFile);
        }
      }
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!activeFile || !value || !projectId || !user) return;

    setLocalChanges((prev) => {
      const newMap = new Map(prev);
      newMap.set(activeFile.id, value);
      return newMap;
    });

    const updatedFile = { ...activeFile, content: value };
    setActiveFile(updatedFile);
    setFiles((prev) => prev.map((f) => (f.id === activeFile.id ? updatedFile : f)));

    if (isAdmin) {
      updateFile(activeFile.id, { content: value });

      const socket = getSocket();
      if (socket) {
        socket.emit('code-change', {
          fileId: activeFile.id,
          content: value,
        });
      }
    }
    
  };

  const submitChangeRequest = () => {
    if (!activeFile || !projectId || !user) return;

    const newContent = localChanges.get(activeFile.id);
    const originalContent = originalFileContent.get(activeFile.id) || activeFile.content;

    if (!newContent || newContent === originalContent) {
      alert('No changes to submit');
      return;
    }

    if (!changeRequestMessage.trim()) {
      alert('Please add a message explaining your changes');
      return;
    }

    createChangeRequest({
      project_id: projectId,
      file_id: activeFile.id,
      user_id: user.id,
      user_name: user.name,
      old_content: originalContent,
      new_content: newContent,
      message: changeRequestMessage,
    });

    setLocalChanges((prev) => {
      const newMap = new Map(prev);
      newMap.delete(activeFile.id);
      return newMap;
    });

    const originalFile = getFileById(activeFile.id);
    if (originalFile) {
      setActiveFile(originalFile);
      setFiles((prev) => prev.map((f) => (f.id === activeFile.id ? originalFile : f)));
      
      setOriginalFileContent((prev) => {
        const newMap = new Map(prev);
        newMap.set(activeFile.id, originalFile.content);
        return newMap;
      });
    }

    setChangeRequestMessage('');
    setShowChangeRequestModal(false);
    alert('Change request submitted! Waiting for admin approval.');
    loadPendingChanges();
  };

  const handleCreateFile = () => {
    if (!newFileName.trim() || !projectId) return;

    const ext = newFileName.split('.').pop();
    const fileName = ext ? newFileName : `${newFileName}.py`;

    if (fileName.length > 255) {
      alert('File name is too long. Please use a shorter name.');
      return;
    }

    if (/[<>:"/\\|?*]/.test(fileName)) {
      alert('File name contains invalid characters. Please use a valid file name.');
      return;
    }

    if (files.some(f => f.file_name === fileName)) {
      alert('A file with this name already exists. Please use a different name.');
      return;
    }

    try {
      const newFile = createFile({
        project_id: projectId,
        file_name: fileName,
        content: getDefaultContent(fileName),
      });

      setFiles((prev) => [...prev, newFile]);
      setActiveFile(newFile);
      detectLanguage(fileName);
      setNewFileName('');
      setShowNewFileInput(false);

      const socket = getSocket();
      if (socket && socket.connected) {
        try {
          socket.emit('file-created', newFile);
        } catch (socketError) {
          console.error('Error sending file creation via socket:', socketError);
        }
      }
    } catch (error: any) {
      console.error('Error creating file:', error);
      const errorMessage = error?.message || 'Failed to create file';
      if (errorMessage.includes('quota') || errorMessage.includes('Storage')) {
        alert('Storage quota exceeded! Please clear some browser data and try again.');
      } else {
        alert(`Failed to create file: ${errorMessage}`);
      }
    }
  };

  const handleDeleteFile = (fileId: string) => {
    if (files.length === 1) {
      alert('Cannot delete the last file');
      return;
    }

    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const deleted = deleteFile(fileId);
      
      if (!deleted) {
        alert('File not found or could not be deleted.');
        return;
      }

      setFiles((prev) => {
        const updated = prev.filter((f) => f.id !== fileId);
        setActiveFile((currentActive) => {
          if (currentActive?.id === fileId) {
            return updated.length > 0 ? updated[0] : null;
          }
          return currentActive;
        });
        return updated;
      });

      const socket = getSocket();
      if (socket && socket.connected) {
        try {
          socket.emit('file-deleted', fileId);
        } catch (socketError) {
          console.error('Error sending file deletion via socket:', socketError);
        }
      }
    } catch (error: any) {
      console.error('Error deleting file:', error);
      const errorMessage = error?.message || 'Failed to delete file';
      if (errorMessage.includes('quota') || errorMessage.includes('Storage')) {
        alert('Storage error occurred. Please try again.');
      } else {
        alert(`Failed to delete file: ${errorMessage}`);
      }
    }
  };

  const handleRenameFile = (fileId: string) => {
    if (!editingName.trim()) return;

    if (editingName.length > 255) {
      alert('File name is too long. Please use a shorter name.');
      return;
    }

    if (/[<>:"/\\|?*]/.test(editingName)) {
      alert('File name contains invalid characters. Please use a valid file name.');
      return;
    }

    if (files.some(f => f.id !== fileId && f.file_name === editingName)) {
      alert('A file with this name already exists. Please use a different name.');
      return;
    }

    try {
      const updated = updateFile(fileId, { file_name: editingName });
      if (!updated) {
        alert('Failed to rename file. File may not exist.');
        return;
      }

      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? updated : f))
      );
      if (activeFile?.id === fileId) {
        setActiveFile(updated);
        detectLanguage(editingName);
      }

      setEditingFile(null);
      setEditingName('');
    } catch (error: any) {
      console.error('Error renaming file:', error);
      const errorMessage = error?.message || 'Failed to rename file';
      if (errorMessage.includes('quota') || errorMessage.includes('Storage')) {
        alert('Storage quota exceeded! Please clear some browser data and try again.');
      } else {
        alert(`Failed to rename file: ${errorMessage}`);
      }
    }
  };

  const handleRunCode = async () => {
    if (!activeFile || isRunning) return;

    setIsRunning(true);
    setOutput('Running...\n');
    setExecutionTime(null);
    const startTime = Date.now();

    try {
      const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeFile.content,
          language: language,
        }),
      });

      const endTime = Date.now();
      const elapsed = ((endTime - startTime) / 1000).toFixed(2);
      setExecutionTime(parseFloat(elapsed));

      if (!response.ok) {
        
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          
          errorMessage = response.statusText || errorMessage;
        }
        setOutput(`Error: ${errorMessage}`);
        setIsRunning(false);
        return;
      }

      const data = await response.json();
      setOutput(data.output || data.error || 'No output');
    } catch (error) {
      const endTime = Date.now();
      const elapsed = ((endTime - startTime) / 1000).toFixed(2);
      setExecutionTime(parseFloat(elapsed));
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        setOutput(
          'Error: Backend server is not running!\n\n' +
          'Please start the server by running:\n' +
          'npm run server\n\n' +
          'Open a new terminal and run this command, then try again.'
        );
      } else {
        setOutput(`Error: ${error instanceof Error ? error.message : 'Failed to execute code'}`);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleClearOutput = () => {
    setOutput('');
    setExecutionTime(null);
  };

  const handleCopyOutput = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy output:', err);
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim() || !user || !projectId) return;

    if (chatInput.length > 5000) {
      alert('Message is too long. Please keep messages under 5000 characters.');
      return;
    }

    try {
      const newMessage = createMessage({
        project_id: projectId,
        user_id: user.id,
        content: chatInput.trim(),
      });

      const messageWithUser = { ...newMessage, user_name: user.name };
      setChatMessages((prev) => [...prev, messageWithUser]);
      setChatInput('');

      const socket = getSocket();
      if (socket && socket.connected) {
        try {
          socket.emit('new-message', messageWithUser);
        } catch (socketError) {
          console.error('Error sending message via socket:', socketError);
          
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage = error?.message || 'Failed to send message';
      if (errorMessage.includes('quota') || errorMessage.includes('Storage')) {
        alert('Storage quota exceeded! Please clear some browser data and try again.');
      } else {
        alert(`Failed to send message: ${errorMessage}`);
      }
    }
  };

  const copyShareLink = () => {
    
    if (projectId) {
      navigator.clipboard.writeText(projectId);
      alert('Share code copied to clipboard!\n\nShare code: ' + projectId);
    }
  };

  const getDefaultContent = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'py') return 'print("Hello, CodeCollab!")';
    if (ext === 'c') return '#include <stdio.h>\n\nint main() {\n    printf("Hello, CodeCollab!\\n");\n    return 0;\n}';
    if (ext === 'cpp') return '#include <iostream>\n\nint main() {\n    std::cout << "Hello, CodeCollab!" << std::endl;\n    return 0;\n}';
    if (ext === 'css') return '/* Welcome to CodeCollab! */\nbody {\n    margin: 0;\n    padding: 20px;\n    font-family: Arial, sans-serif;\n    background-color: #1a1a1a;\n    color: #ffffff;\n}';
    if (ext === 'js') return 'console.log("Hello, CodeCollab!");';
    if (ext === 'ts') return 'console.log("Hello, CodeCollab!");';
    if (ext === 'java') return 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, CodeCollab!");\n    }\n}';
    if (ext === 'go') return 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, CodeCollab!")\n}';
    if (ext === 'rs') return 'fn main() {\n    println!("Hello, CodeCollab!");\n}';
    if (ext === 'php') return '<?php\necho "Hello, CodeCollab!\\n";\n?>';
    if (ext === 'rb') return 'puts "Hello, CodeCollab!"';
    if (ext === 'html' || ext === 'htm') return '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>CodeCollab</title>\n</head>\n<body>\n    <h1>Hello, CodeCollab!</h1>\n</body>\n</html>';
    return '';
  };

  if (!project || !user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center relative overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/10 via-red-900/10 to-yellow-900/10 animate-gradient-shift"></div>
        
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="particle particle-1"></div>
          <div className="particle particle-2"></div>
          <div className="particle particle-3"></div>
          <div className="particle particle-4"></div>
          <div className="particle particle-5"></div>
        </div>

        <div className="flex flex-col items-center gap-8 relative z-10 animate-fade-in">
          {/* Enhanced Animated Spinner */}
          <div className="relative">
            {/* Outer glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/30 via-red-500/30 to-yellow-500/30 rounded-full blur-xl animate-pulse"></div>
            
            {/* Spinner layers */}
            <div className="w-28 h-28 border-4 border-gray-800 rounded-full relative"></div>
            <div className="w-28 h-28 border-4 border-transparent border-t-yellow-500 border-r-red-500 rounded-full animate-spin absolute top-0 left-0 shadow-lg shadow-yellow-500/50"></div>
            <div className="w-28 h-28 border-4 border-transparent border-b-yellow-500 border-l-red-500 rounded-full animate-spin-reverse absolute top-0 left-0 shadow-lg shadow-red-500/50"></div>
            
            {/* Inner pulsing circle with glow */}
            <div className="absolute inset-5 bg-gradient-to-r from-yellow-500/20 via-red-500/20 to-yellow-500/20 rounded-full animate-pulse"></div>
            <div className="absolute inset-6 bg-gradient-to-r from-yellow-500/10 to-red-500/10 rounded-full animate-pulse-slow"></div>
          </div>
          
          {/* Message with enhanced animations */}
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-400 via-red-500 to-yellow-600 bg-clip-text text-transparent animate-gradient-text mb-6 drop-shadow-lg">
              Please Wait... Server is Starting
            </h2>
            
            {/* Enhanced bouncing dots */}
            <div className="flex items-center justify-center gap-3">
              <span className="w-4 h-4 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full bounce-delay-1 shadow-lg shadow-yellow-500/50"></span>
              <span className="w-4 h-4 bg-gradient-to-r from-red-500 to-red-400 rounded-full bounce-delay-2 shadow-lg shadow-red-500/50"></span>
              <span className="w-4 h-4 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full bounce-delay-3 shadow-lg shadow-yellow-500/50"></span>
            </div>
            
            {/* Progress bar */}
            <div className="mt-8 w-full max-w-md mx-auto h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-500 rounded-full animate-progress-bar"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between bg-gray-900">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
          <h2 className="text-lg font-semibold">{project.name}</h2>
          {isAdmin && (
            <div className="flex items-center gap-2 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded text-yellow-400 text-sm">
              <Shield className="w-4 h-4" />
              Admin
            </div>
          )}
          {currentBranch && (
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded text-sm">
              <GitBranch className="w-4 h-4" />
              {currentBranch.name}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {}
          <button
            onClick={() => setShowBranches(!showBranches)}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors"
            title="Branches"
          >
            <GitBranch className="w-4 h-4" />
            Branches
          </button>
          <button
            onClick={() => setShowCommits(!showCommits)}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors"
            title="Commits"
          >
            <GitCommit className="w-4 h-4" />
            Commits
          </button>
          <button
            onClick={() => setShowPullRequests(!showPullRequests)}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors relative"
            title="Pull Requests"
          >
            <GitPullRequest className="w-4 h-4" />
            PRs
            {pullRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pullRequests.length}
              </span>
            )}
          </button>

          {}
          {isAdmin && (
            <button
              onClick={() => setShowMembersModal(true)}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors relative"
              title="Members"
            >
              <Users className="w-4 h-4" />
              Members
              {pendingJoinRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingJoinRequests.length}
                </span>
              )}
            </button>
          )}

          {}
          {isAdmin && pendingChanges.length > 0 && (
            <button
              onClick={() => setSelectedChangeRequest(pendingChanges[0])}
              className="px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded-lg flex items-center gap-2 transition-colors relative"
            >
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400">Review Changes</span>
              <span className="bg-yellow-500 text-black text-xs rounded-full px-2 py-0.5">
                {pendingChanges.length}
              </span>
            </button>
          )}

          {}
          {!isAdmin && localChanges.size > 0 && (
            <button
              onClick={() => setShowChangeRequestModal(true)}
              className="px-3 py-2 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Submit Changes
            </button>
          )}

          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as Language)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-yellow-500"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="typescript">TypeScript</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="php">PHP</option>
            <option value="cpp">C++</option>
            <option value="c">C</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
            <option value="ruby">Ruby</option>
          </select>

          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="px-4 py-2 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run
              </>
            )}
          </button>

          <button
            onClick={copyShareLink}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>

          <button
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {}
      <div className="flex-1 flex overflow-hidden">
        {}
        <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <button
              onClick={() => setShowNewFileInput(true)}
              className="w-full px-4 py-2 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New File
            </button>
          </div>

          {showNewFileInput && (
            <div className="p-4 border-b border-gray-800">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="filename.py"
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg focus:outline-none focus:border-yellow-500 mb-2"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFile()}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateFile}
                  className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewFileInput(false);
                    setNewFileName('');
                  }}
                  className="flex-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.id}
                className={`p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-800 ${
                  activeFile?.id === file.id ? 'bg-gray-800' : ''
                }`}
                onClick={() => {
                  setActiveFile(file);
                  detectLanguage(file.file_name);
                  
                  if (user && projectId && !isProjectAdmin(projectId, user.id)) {
                    setOriginalFileContent((prev) => {
                      const newMap = new Map(prev);
                      if (!newMap.has(file.id)) {
                        newMap.set(file.id, file.content);
                      }
                      return newMap;
                    });
                  }
                }}
              >
                {editingFile === file.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 px-2 py-1 bg-black border border-gray-700 rounded text-sm"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleRenameFile(file.id);
                        if (e.key === 'Escape') {
                          setEditingFile(null);
                          setEditingName('');
                        }
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => handleRenameFile(file.id)}
                      className="text-green-400 hover:text-green-300"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingFile(null);
                        setEditingName('');
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm truncate">{file.file_name}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFile(file.id);
                          setEditingName(file.file_name);
                        }}
                        className="p-1 hover:bg-gray-700 rounded"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.id);
                        }}
                        className="p-1 hover:bg-gray-700 rounded text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {}
        <div className="flex-1 flex flex-col">
          {activeFile ? (
            <div className="flex-1">
              <Editor
                height="100%"
                language={language}
                value={activeFile.content}
                onChange={handleEditorChange}
                theme="vs-dark"
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Select a file to start editing
            </div>
          )}

          {}
          <div className="h-48 bg-gray-900 border-t border-gray-800 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold">Output</div>
                {executionTime !== null && (
                  <div className="text-xs text-gray-400">
                    Executed in {executionTime}s
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {output && (
                  <button
                    onClick={handleCopyOutput}
                    className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                    title="Copy output"
                  >
                    <Copy className="w-4 h-4 text-gray-400" />
                  </button>
                )}
                {output && (
                  <button
                    onClick={handleClearOutput}
                    className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                    title="Clear output"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className={`text-sm font-mono whitespace-pre-wrap ${
                output && (output.startsWith('Error:') || output.startsWith('❌'))
                  ? 'text-red-400'
                  : output && output.startsWith('✓')
                  ? 'text-green-400'
                  : 'text-gray-300'
              }`}>
                {output || 'Output will appear here...'}
              </pre>
            </div>
          </div>
        </div>

        {}
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800 font-semibold">Chat</div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="text-sm">
                <div className="text-yellow-500 font-semibold mb-1">
                  {msg.user_name || 'User'}
                </div>
                <div className="text-gray-300">{msg.content}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg focus:outline-none focus:border-yellow-500"
              />
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {}
      {showChangeRequestModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-semibold mb-4">Submit Change Request</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Message (explain your changes)</label>
              <textarea
                value={changeRequestMessage}
                onChange={(e) => setChangeRequestMessage(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg focus:outline-none focus:border-yellow-500"
                rows={4}
                placeholder="Describe what you changed and why..."
              />
            </div>
            {activeFile && localChanges.has(activeFile.id) && (
              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Preview Changes:</div>
                <div className="bg-black rounded p-4 font-mono text-xs max-h-60 overflow-y-auto">
                  <div className="text-red-400 mb-2">- Old content (current version)</div>
                  <div className="whitespace-pre-wrap text-gray-300 mb-4 border-b border-gray-700 pb-2">
                    {originalFileContent.get(activeFile.id) || activeFile.content}
                  </div>
                  <div className="text-green-400 mb-2">+ New content (your changes)</div>
                  <div className="whitespace-pre-wrap text-gray-300">
                    {localChanges.get(activeFile.id)}
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-4">
              <button
                onClick={submitChangeRequest}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200"
              >
                Submit for Approval
              </button>
              <button
                onClick={() => {
                  setShowChangeRequestModal(false);
                  setChangeRequestMessage('');
                }}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {selectedChangeRequest && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-semibold mb-4">Review Change Request</h2>
            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-2">
                Requested by: <span className="text-yellow-400">{selectedChangeRequest.user_name}</span>
              </div>
              {selectedChangeRequest.message && (
                <div className="bg-gray-800 rounded p-3 mb-4">
                  <div className="text-sm font-medium mb-1">Message:</div>
                  <div className="text-sm text-gray-300">{selectedChangeRequest.message}</div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm font-medium mb-2 text-red-400">Current (Old)</div>
                <div className="bg-black rounded p-4 font-mono text-xs max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {selectedChangeRequest.old_content}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-2 text-green-400">Proposed (New)</div>
                <div className="bg-black rounded p-4 font-mono text-xs max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {selectedChangeRequest.new_content}
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => handleApproveChange(selectedChangeRequest.id)}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Approve
              </button>
              <button
                onClick={() => handleRejectChange(selectedChangeRequest.id)}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <XCircle className="w-5 h-5" />
                Reject
              </button>
              <button
                onClick={() => setSelectedChangeRequest(null)}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showBranches && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Branches</h2>
              <button onClick={() => setShowBranches(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className={`p-3 rounded-lg border ${
                    currentBranch?.id === branch.id
                      ? 'bg-yellow-500/20 border-yellow-500'
                      : 'bg-gray-800 border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      <span className="font-semibold">{branch.name}</span>
                      {branch.is_main && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                          main
                        </span>
                      )}
                    </div>
                    {currentBranch?.id !== branch.id && (
                      <button
                        onClick={() => {
                          setCurrentBranch(branch);
                          loadCommits();
                          setShowBranches(false);
                        }}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-800 pt-4">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="New branch name"
                className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg focus:outline-none focus:border-yellow-500 mb-2"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newBranchName.trim() && projectId && user) {
                    createBranch({
                      project_id: projectId,
                      name: newBranchName,
                      created_by: user.id,
                      is_main: false,
                    });
                    setNewBranchName('');
                    loadBranches();
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newBranchName.trim() && projectId && user) {
                    createBranch({
                      project_id: projectId,
                      name: newBranchName,
                      created_by: user.id,
                      is_main: false,
                    });
                    setNewBranchName('');
                    loadBranches();
                  }
                }}
                className="w-full px-4 py-2 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200"
              >
                Create Branch
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showCommits && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Commits</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCommitModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200 flex items-center gap-2"
                >
                  <GitCommit className="w-4 h-4" />
                  Commit
                </button>
                <button onClick={() => setShowCommits(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {commits.length === 0 ? (
                <div className="text-center text-gray-400 py-8">No commits yet</div>
              ) : (
                commits.map((commit) => (
                  <div key={commit.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <GitCommit className="w-4 h-4 text-yellow-400" />
                      <span className="font-semibold">{commit.user_name || 'User'}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(commit.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-300 mb-2">{commit.message}</div>
                    <div className="text-xs text-gray-500">
                      {commit.files.length} file(s) changed
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {}
      {showCommitModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 w-full max-w-2xl">
            <h2 className="text-2xl font-semibold mb-4">Create Commit</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Commit Message</label>
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg focus:outline-none focus:border-yellow-500"
                rows={4}
                placeholder="Describe your changes..."
              />
            </div>
            <div className="mb-4">
              <div className="text-sm font-medium mb-2">Files to commit:</div>
              <div className="bg-gray-800 rounded p-3 text-sm">
                {Array.from(localChanges.keys()).map((fileId) => {
                  const file = files.find((f) => f.id === fileId);
                  return file ? (
                    <div key={fileId} className="text-yellow-400">• {file.file_name}</div>
                  ) : null;
                })}
                {localChanges.size === 0 && (
                  <div className="text-gray-400">No changes to commit</div>
                )}
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  if (commitMessage.trim() && currentBranch && projectId && user && localChanges.size > 0) {
                    const commitFiles = Array.from(localChanges.entries()).map(([fileId, newContent]) => {
                      const file = files.find((f) => f.id === fileId);
                      return {
                        file_id: fileId,
                        file_name: file?.file_name || '',
                        old_content: file?.content || '',
                        new_content: newContent,
                        action: 'update' as const,
                      };
                    });

                    createCommit({
                      project_id: projectId,
                      branch_id: currentBranch.id,
                      user_id: user.id,
                      user_name: user.name,
                      message: commitMessage,
                      files: commitFiles,
                    });

                    setLocalChanges(new Map());
                    setCommitMessage('');
                    setShowCommitModal(false);
                    loadCommits();
                  }
                }}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200"
              >
                Commit Changes
              </button>
              <button
                onClick={() => {
                  setShowCommitModal(false);
                  setCommitMessage('');
                }}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showPullRequests && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Pull Requests</h2>
              <button onClick={() => setShowPullRequests(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {pullRequests.length === 0 ? (
                <div className="text-center text-gray-400 py-8">No open pull requests</div>
              ) : (
                pullRequests.map((pr) => (
                  <div key={pr.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <GitPullRequest className="w-4 h-4 text-yellow-400" />
                        <span className="font-semibold">{pr.title}</span>
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                          {pr.status}
                        </span>
                      </div>
                      {isAdmin && pr.status === 'open' && (
                        <button
                          onClick={() => {
                            if (user) {
                              mergePullRequest(pr.id, user.id);
                              loadPullRequests();
                            }
                          }}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center gap-1"
                        >
                          <GitMerge className="w-4 h-4" />
                          Merge
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-gray-300 mb-2">{pr.description}</div>
                    <div className="text-xs text-gray-500">
                      By {pr.created_by_name} • {new Date(pr.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Project Members</h2>
              <button onClick={() => setShowMembersModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {}
            {pendingJoinRequests.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-yellow-400">Pending Join Requests</h3>
                <div className="space-y-2">
                  {pendingJoinRequests.map((request) => (
                    <div key={request.id} className="bg-gray-800 rounded-lg p-4 border border-yellow-500/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{request.user_name || 'Unknown User'}</div>
                          <div className="text-sm text-gray-400">
                            Requested {new Date(request.requested_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveJoinRequest(request.id)}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectJoinRequest(request.id)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold flex items-center gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {}
            <div>
              <h3 className="text-lg font-semibold mb-3">Members ({projectMembers.filter(m => m.status === 'approved').length})</h3>
              <div className="space-y-2">
                {projectMembers.filter(m => m.status === 'approved').length === 0 ? (
                  <div className="text-center text-gray-400 py-4">No members yet</div>
                ) : (
                  projectMembers
                    .filter((m) => m.status === 'approved')
                    .map((member) => (
                      <div key={member.user_id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{member.user_name}</div>
                            <div className="text-sm text-gray-400">{member.email}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Joined {new Date(member.joined_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="px-3 py-1 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-sm">
                            Approved
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

