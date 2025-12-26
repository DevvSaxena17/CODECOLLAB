

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

// Validation function for HTML
const validateHTML = (htmlCode) => {
  const errors = [];
  const lines = htmlCode.split('\n');
  
  // Check for unclosed tags
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  const openTags = [];
  const selfClosingTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
  let match;
  
  while ((match = tagPattern.exec(htmlCode)) !== null) {
    const tagName = match[1].toLowerCase();
    const isClosing = match[0].startsWith('</');
    const isSelfClosing = match[0].endsWith('/>') || selfClosingTags.includes(tagName);
    const lineNum = htmlCode.substring(0, match.index).split('\n').length;
    
    if (isSelfClosing) continue;
    
    if (isClosing) {
      const lastOpen = openTags.pop();
      if (!lastOpen || lastOpen.tag !== tagName) {
        errors.push(`Line ${lineNum}: Unmatched closing tag </${tagName}>`);
      }
    } else {
      openTags.push({ tag: tagName, line: lineNum });
    }
  }
  
  if (openTags.length > 0) {
    openTags.forEach(({ tag, line }) => {
      errors.push(`Line ${line}: Unclosed tag <${tag}>`);
    });
  }
  
  // Check for basic structure
  if (!htmlCode.includes('<!DOCTYPE') && !htmlCode.includes('<!doctype')) {
    errors.push('Missing DOCTYPE declaration');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : []
  };
};

// Validation function for TypeScript (basic syntax checks)
const validateTypeScript = (tsCode) => {
  const errors = [];
  const lines = tsCode.split('\n');
  
  let braceCount = 0;
  let parenCount = 0;
  let bracketCount = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < tsCode.length; i++) {
    const char = tsCode[i];
    const prevChar = i > 0 ? tsCode[i - 1] : '';
    const lineNum = tsCode.substring(0, i).split('\n').length;
    
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
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
    
    if (char === '{') braceCount++;
    else if (char === '}') {
      braceCount--;
      if (braceCount < 0) {
        errors.push(`Line ${lineNum}: Unmatched closing brace '}'`);
        return { valid: false, errors };
      }
    }
    else if (char === '(') parenCount++;
    else if (char === ')') {
      parenCount--;
      if (parenCount < 0) {
        errors.push(`Line ${lineNum}: Unmatched closing parenthesis ')'`);
        return { valid: false, errors };
      }
    }
    else if (char === '[') bracketCount++;
    else if (char === ']') {
      bracketCount--;
      if (bracketCount < 0) {
        errors.push(`Line ${lineNum}: Unmatched closing bracket ']'`);
        return { valid: false, errors };
      }
    }
  }
  
  if (braceCount > 0) errors.push(`Unclosed ${braceCount} brace(s)`);
  if (parenCount > 0) errors.push(`Unclosed ${parenCount} parenthesis/parentheses`);
  if (bracketCount > 0) errors.push(`Unclosed ${bracketCount} bracket(s)`);
  if (inString) errors.push('Unclosed string literal');
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : []
  };
};

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

// Health check endpoint for Render
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'CodeCollab Backend is running' });
});

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
        const cssValidation = validateCSS(code);
        if (cssValidation.valid) {
          output = '✓ CSS validated successfully!\n\nLink this stylesheet in your HTML:\n<link rel="stylesheet" href="styles.css">';
          return res.json({ output });
        } else {
          const errorMessages = cssValidation.errors.join('\n');
          return res.status(400).json({ 
            error: `CSS Validation Error:\n${errorMessages}` 
          });
        }
      case 'typescript':
        const tsValidation = validateTypeScript(code);
        if (!tsValidation.valid) {
          const errorMessages = tsValidation.errors.join('\n');
          return res.status(400).json({ 
            error: `TypeScript Validation Error:\n${errorMessages}` 
          });
        }
        filePath = path.join(tempDir, `code_${timestamp}.ts`);
        fs.writeFileSync(filePath, code);
        command = `npx ts-node "${filePath}"`;
        break;
      case 'go':
        filePath = path.join(tempDir, `code_${timestamp}.go`);
        fs.writeFileSync(filePath, code);
        command = `go run "${filePath}"`;
        break;
      case 'rust':
        filePath = path.join(tempDir, `code_${timestamp}.rs`);
        exePath = path.join(tempDir, `code_${timestamp}`);
        fs.writeFileSync(filePath, code);
        command = `rustc "${filePath}" -o "${exePath}" && "${exePath}"`;
        break;
      case 'php':
        filePath = path.join(tempDir, `code_${timestamp}.php`);
        fs.writeFileSync(filePath, code);
        command = `php "${filePath}"`;
        break;
      case 'ruby':
        filePath = path.join(tempDir, `code_${timestamp}.rb`);
        fs.writeFileSync(filePath, code);
        command = `ruby "${filePath}"`;
        break;
      case 'html':
        const htmlValidation = validateHTML(code);
        if (htmlValidation.valid) {
          output = '✓ HTML validated successfully!\n\nOpen this file in a browser to view the result.\nYou can also use it in your web project.';
          return res.json({ output });
        } else {
          const errorMessages = htmlValidation.errors.join('\n');
          return res.status(400).json({ 
            error: `HTML Validation Error:\n${errorMessages}` 
          });
        }
      default:
        return res.status(400).json({ error: 'Unsupported language' });
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });
      output = stdout || stderr || 'No output';
    } catch (error) {
      // Check for timeout
      if (error.signal === 'SIGTERM' || error.message?.includes('timeout')) {
        output = `Error: Execution timed out after 10 seconds.\n\nThis might happen if:\n- Your code has an infinite loop\n- The program is waiting for input\n- The computation is taking too long\n\nTry optimizing your code or reducing the complexity.`;
        return res.status(400).json({ error: output });
      }
      // Format error messages nicely for different languages
      let errorMessage = error.stderr || error.stdout || error.message || 'Execution error';
      
      // Check if the error is about missing command/runtime
      const isCommandNotFound = 
        errorMessage.includes('is not recognized') ||
        errorMessage.includes('command not found') ||
        errorMessage.includes('not found') ||
        errorMessage.includes('No such file or directory') ||
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('Cannot find module') && errorMessage.includes('ts-node') ||
        errorMessage.includes('ts-node') && errorMessage.includes('not found');
      
      if (isCommandNotFound) {
        // Provide helpful installation instructions
        const installInstructions = {
          'php': 'PHP is not installed. Please install PHP:\n  Windows: Download from https://windows.php.net/download/\n  Mac: brew install php\n  Linux: sudo apt-get install php',
          'go': 'Go is not installed. Please install Go:\n  Windows: Download from https://go.dev/dl/\n  Mac: brew install go\n  Linux: sudo apt-get install golang',
          'rust': 'Rust is not installed. Please install Rust:\n  All platforms: Visit https://rustup.rs/ and run the installer',
          'ruby': 'Ruby is not installed. Please install Ruby:\n  Windows: Download from https://rubyinstaller.org/\n  Mac: brew install ruby\n  Linux: sudo apt-get install ruby',
          'typescript': 'TypeScript/ts-node is not installed. Please install:\n  npm install -g typescript ts-node',
          'python': 'Python is not installed. Please install Python:\n  Windows: Download from https://www.python.org/downloads/\n  Mac: brew install python\n  Linux: sudo apt-get install python3',
          'g++': 'g++ compiler is not installed. Please install:\n  Windows: Install MinGW or use Visual Studio\n  Mac: xcode-select --install\n  Linux: sudo apt-get install g++',
          'gcc': 'gcc compiler is not installed. Please install:\n  Windows: Install MinGW or use Visual Studio\n  Mac: xcode-select --install\n  Linux: sudo apt-get install gcc',
          'javac': 'Java JDK is not installed. Please install:\n  Windows: Download from https://adoptium.net/\n  Mac: brew install openjdk\n  Linux: sudo apt-get install default-jdk',
          'node': 'Node.js is not installed. Please install Node.js from https://nodejs.org/'
        };
        
        let instruction = '';
        if (normalizedLanguage === 'php') {
          instruction = installInstructions['php'];
        } else if (normalizedLanguage === 'go') {
          instruction = installInstructions['go'];
        } else if (normalizedLanguage === 'rust') {
          instruction = installInstructions['rust'];
        } else if (normalizedLanguage === 'ruby') {
          instruction = installInstructions['ruby'];
        } else if (normalizedLanguage === 'typescript') {
          instruction = installInstructions['typescript'];
        } else if (normalizedLanguage === 'python') {
          instruction = installInstructions['python'];
        } else if (normalizedLanguage === 'cpp') {
          instruction = installInstructions['g++'];
        } else if (normalizedLanguage === 'c') {
          instruction = installInstructions['gcc'];
        } else if (normalizedLanguage === 'java') {
          instruction = installInstructions['javac'];
        } else if (normalizedLanguage === 'javascript') {
          instruction = installInstructions['node'];
        }
        
        if (instruction) {
          output = `❌ Runtime Not Found\n\n${instruction}\n\nAfter installation, restart the server and try again.`;
          return res.status(400).json({ error: output });
        }
      }
      
      // Clean up common error patterns for actual code errors
      if (normalizedLanguage === 'typescript') {
        // Format TypeScript/ts-node errors
        errorMessage = errorMessage.replace(/Error: /g, '').replace(/TS\d+:/g, 'TypeScript Error: ');
      } else if (normalizedLanguage === 'go') {
        // Format Go errors
        errorMessage = errorMessage.replace(/go run: /g, '').replace(/\.go:\d+:/g, ' (line ');
      } else if (normalizedLanguage === 'rust') {
        // Format Rust errors
        errorMessage = errorMessage.replace(/error\[E\d+\]:/g, 'Error: ').replace(/--> /g, '');
      } else if (normalizedLanguage === 'php') {
        // Format PHP errors
        errorMessage = errorMessage.replace(/PHP (Parse|Fatal|Warning|Notice) error:/g, '$1 Error:');
      } else if (normalizedLanguage === 'ruby') {
        // Format Ruby errors
        errorMessage = errorMessage.replace(/\(eval\):/g, 'Line ').replace(/in `<main>':/g, '');
      } else if (normalizedLanguage === 'cpp' || normalizedLanguage === 'c') {
        // Format C/C++ compiler errors
        errorMessage = errorMessage.replace(/error: /g, '').replace(/warning: /g, 'Warning: ');
      } else if (normalizedLanguage === 'java') {
        // Format Java errors
        errorMessage = errorMessage.replace(/error: /g, '').replace(/Exception in thread/g, 'Error:');
      }
      
      output = `Error: ${errorMessage}`;
    } finally {
      
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (exePath && fs.existsSync(exePath)) {
          fs.unlinkSync(exePath);
        }
        
        // Clean up Java class files
        if (normalizedLanguage === 'java' && filePath) {
          const className = path.basename(filePath, '.java');
          const classFile = path.join(path.dirname(filePath), `${className}.class`);
          if (fs.existsSync(classFile)) {
            fs.unlinkSync(classFile);
          }
        }
        
        // Clean up Rust executable (no extension on Unix, .exe on Windows)
        if (normalizedLanguage === 'rust' && exePath) {
          if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
          // Also try with .exe extension for Windows
          const exePathWin = exePath + '.exe';
          if (fs.existsSync(exePathWin)) fs.unlinkSync(exePathWin);
        }
        
        // Clean up Go compiled files
        if (normalizedLanguage === 'go' && filePath) {
          const goExe = path.join(path.dirname(filePath), path.basename(filePath, '.go'));
          if (fs.existsSync(goExe)) fs.unlinkSync(goExe);
          const goExeWin = goExe + '.exe';
          if (fs.existsSync(goExeWin)) fs.unlinkSync(goExeWin);
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

