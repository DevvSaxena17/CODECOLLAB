

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const validateCSS = (cssCode) => {
  const errors = [];
  const lines = cssCode.split('\n');

  let codeWithoutComments = cssCode.replace(/\/\*[\s\S]*?\*\//g, '');

  let braceCount = 0;
  let inString = false;
  let stringChar = '';
  let lastOpenBraceLine = 0;
  
  for (let i = 0; i < codeWithoutComments.length; i++) {
    const char = codeWithoutComments[i];
    const prevChar = i > 0 ? codeWithoutComments[i - 1] : '';
    const lineNum = codeWithoutComments.substring(0, i).split('\n').length;

    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      continue;
    }
    
    if (inString) continue;
    
    if (char === '{') {
      braceCount++;
      lastOpenBraceLine = lineNum;
    } else if (char === '}') {
      braceCount--;
      if (braceCount < 0) {
        errors.push(`Line ${lineNum}: Unmatched closing brace '}'`);
        return { valid: false, errors };
      }
    }
  }
  
  if (braceCount > 0) {
    errors.push(`Line ${lastOpenBraceLine}: Unclosed brace - missing ${braceCount} closing brace(s)`);
  }
  
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  
  while ((match = rulePattern.exec(codeWithoutComments)) !== null) {
    const selector = match[1].trim();
    const declarations = match[2].trim();
    const ruleStartLine = codeWithoutComments.substring(0, match.index).split('\n').length;
    
    if (!selector || selector.length === 0) {
      errors.push(`Line ${ruleStartLine}: Empty selector`);
    }
    
    if (declarations) {
      const declParts = [];
      let currentDecl = '';
      let inDeclString = false;
      let declStringChar = '';
      
      for (let i = 0; i < declarations.length; i++) {
        const char = declarations[i];
        const prevChar = i > 0 ? declarations[i - 1] : '';
        
        if ((char === '"' || char === "'") && prevChar !== '\\') {
          if (!inDeclString) {
            inDeclString = true;
            declStringChar = char;
          } else if (char === declStringChar) {
            inDeclString = false;
            declStringChar = '';
          }
          currentDecl += char;
          continue;
        }
        
        if (inDeclString) {
          currentDecl += char;
          continue;
        }
        
        if (char === ';') {
          if (currentDecl.trim()) {
            declParts.push(currentDecl.trim());
          }
          currentDecl = '';
        } else {
          currentDecl += char;
        }
      }

      if (currentDecl.trim()) {
        declParts.push(currentDecl.trim());
      }

      const declLines = declarations.split('\n');
      let currentLineInRule = 0;

      for (let i = 0; i < declParts.length; i++) {
        const decl = declParts[i];
        if (!decl) continue;

        const declIndex = declarations.indexOf(decl);
        const declLine = ruleStartLine + (declIndex >= 0 ? declarations.substring(0, declIndex).split('\n').length : 1);

        if (!decl.includes(':')) {
          errors.push(`Line ${declLine}: Invalid declaration syntax - missing colon in "${decl}"`);
        } else {
          const colonIndex = decl.indexOf(':');
          const property = decl.substring(0, colonIndex).trim();
          const value = decl.substring(colonIndex + 1).trim();
          
          if (!property) {
            errors.push(`Line ${declLine}: Missing property name before colon`);
          }
          
          if (!value) {
            errors.push(`Line ${declLine}: Missing property value after colon`);
          }

          const declEndIndex = declIndex + decl.length;
          const afterDecl = declarations.substring(declEndIndex).trim();

          if (i < declParts.length - 1 && afterDecl && !afterDecl.startsWith('}')) {
            
            const nextChar = declarations.substring(declEndIndex).trim()[0];
            if (nextChar !== ';' && nextChar !== '}') {
              
              const declLineContent = lines[declLine - 1] || '';
              if (!declLineContent.trim().endsWith(';') && !declLineContent.includes(decl + ';')) {
                errors.push(`Line ${declLine}: Missing semicolon after "${decl.trim()}"`);
              }
            }
          }
        }
      }

      const declMatches = declarations.match(/([a-zA-Z-]+)\s*:\s*([^;{}\n]+)/g);
      if (declMatches && declMatches.length > 1) {
        for (let i = 0; i < declMatches.length - 1; i++) {
          const match = declMatches[i];
          const trimmedMatch = match.trim();
          const matchIndex = declarations.indexOf(match);
          const afterMatch = declarations.substring(matchIndex + match.length).trim();

          if (afterMatch && !afterMatch.startsWith(';') && !afterMatch.startsWith('}')) {
            const nextPropMatch = afterMatch.match(/^([a-zA-Z-]+)\s*:/);
            if (nextPropMatch) {
              const lineNum = ruleStartLine + declarations.substring(0, matchIndex).split('\n').length;
              errors.push(`Line ${lineNum}: Missing semicolon after "${trimmedMatch}"`);
              break; 
            }
          }
        }
      }

      const lastDecl = declParts[declParts.length - 1];
      if (lastDecl && !declarations.trim().endsWith(';') && !declarations.trim().endsWith(lastDecl)) {

      }
    }
  }

  let testCode = codeWithoutComments;
  let inTestString = false;
  let testStringChar = '';
  
  for (let i = 0; i < testCode.length; i++) {
    const char = testCode[i];
    const prevChar = i > 0 ? testCode[i - 1] : '';
    
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inTestString) {
        inTestString = true;
        testStringChar = char;
      } else if (char === testStringChar) {
        inTestString = false;
        testStringChar = '';
      }
    }
  }
  
  if (inTestString) {
    errors.push('Unclosed string literal');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : []
  };
};

const app = express();
const httpServer = createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  credentials: true,
}));
app.use(express.json());

app.post('/api/execute', async (req, res) => {
  const { code, language } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: 'Code and language are required' });
  }

  try {
    let output = '';
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const timestamp = Date.now();
    let command = '';
    let filePath = '';

    let exePath = '';
    
    const normalizedLanguage = language.toLowerCase();
    switch (normalizedLanguage) {
      case 'python':
        filePath = path.join(tempDir, `code_${timestamp}.py`);
        fs.writeFileSync(filePath, code);
        command = `python "${filePath}"`;
        break;
      case 'javascript':
        filePath = path.join(tempDir, `code_${timestamp}.js`);
        fs.writeFileSync(filePath, code);
        command = `node "${filePath}"`;
        break;
      case 'cpp':
        filePath = path.join(tempDir, `code_${timestamp}.cpp`);
        exePath = path.join(tempDir, `code_${timestamp}.exe`);
        fs.writeFileSync(filePath, code);
        
        command = `g++ "${filePath}" -o "${exePath}" && "${exePath}"`;
        break;
      case 'c':
        filePath = path.join(tempDir, `code_${timestamp}.c`);
        exePath = path.join(tempDir, `code_${timestamp}.exe`);
        fs.writeFileSync(filePath, code);
        
        command = `gcc "${filePath}" -o "${exePath}" && "${exePath}"`;
        break;
      case 'java':
        filePath = path.join(tempDir, `Main_${timestamp}.java`);
        exePath = path.join(tempDir, `Main_${timestamp}.class`);

        const className = 'Main_' + timestamp;
        
        let javaCode = code;
        if (!code.includes('public class')) {
          
          javaCode = `public class ${className} {\n    public static void main(String[] args) {\n${code.split('\n').map(line => '        ' + line).join('\n')}\n    }\n}`;
        } else {
          
          javaCode = code.replace(/public class\s+(\w+)/, `public class ${className}`);
        }
        fs.writeFileSync(filePath, javaCode);
        command = `cd "${tempDir}" && javac "${path.basename(filePath)}" && java ${className}`;
        break;
      case 'css':
        
        const validation = validateCSS(code);
        if (validation.valid) {
          output = '✓ CSS validated successfully! Link this stylesheet in your HTML: <link rel="stylesheet" href="styles.css">';
          return res.json({ output });
        } else {
          const errorMessages = validation.errors.join('\n');
          return res.status(400).json({ 
            error: `CSS Validation Error:\n${errorMessages}` 
          });
        }
      default:
        return res.status(400).json({ error: 'Unsupported language' });
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      });
      output = stdout || stderr || 'No output';
    } catch (error) {
      output = error.stderr || error.message || 'Execution error';
    } finally {
      
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (exePath && fs.existsSync(exePath)) {
          fs.unlinkSync(exePath);
        }
        
        if (language === 'java' && filePath) {
          const className = path.basename(filePath, '.java');
          const classFile = path.join(path.dirname(filePath), `${className}.class`);
          if (fs.existsSync(classFile)) {
            fs.unlinkSync(classFile);
          }
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    res.json({ output });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const sharedProjects = new Map(); 

io.on('connection', (socket) => {
  const { roomId, userId } = socket.handshake.query;
  
  if (roomId) {
    socket.join(roomId);
    console.log(`User ${userId} joined room ${roomId}`);

    socket.on('request-project-data', () => {
      const projectData = sharedProjects.get(roomId);
      if (projectData) {
        socket.emit('project-data', projectData);
      } else {
        socket.emit('project-data', null);
      }
    });

    socket.on('share-project-data', (data) => {
      sharedProjects.set(roomId, data);
      
      socket.to(roomId).emit('project-data', data);
    });

    socket.on('code-change', (data) => {
      
      const projectData = sharedProjects.get(roomId);
      if (projectData && projectData.files) {
        const fileIndex = projectData.files.findIndex(f => f.id === data.fileId);
        if (fileIndex !== -1) {
          projectData.files[fileIndex].content = data.content;
          projectData.files[fileIndex].updated_at = new Date().toISOString();
        }
      }
      socket.to(roomId).emit('code-change', data);
    });

    socket.on('file-created', (file) => {
      const projectData = sharedProjects.get(roomId);
      if (projectData && projectData.files) {
        projectData.files.push(file);
      }
      socket.to(roomId).emit('file-created', file);
    });

    socket.on('file-deleted', (fileId) => {
      const projectData = sharedProjects.get(roomId);
      if (projectData && projectData.files) {
        projectData.files = projectData.files.filter(f => f.id !== fileId);
      }
      socket.to(roomId).emit('file-deleted', fileId);
    });

    socket.on('new-message', (message) => {
      const projectData = sharedProjects.get(roomId);
      if (projectData && projectData.messages) {
        projectData.messages.push(message);
      }
      socket.to(roomId).emit('new-message', message);
    });

    socket.on('disconnect', () => {
      console.log(`User ${userId} left room ${roomId}`);
    });
  }
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

