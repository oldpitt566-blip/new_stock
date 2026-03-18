const express = require('express');
const cors = require('cors');
const path = require('path');

const { spawn, execSync } = require('child_process');

function getPythonCmd() {
    if (process.platform === 'win32') return 'python';
    try {
        execSync('python3 --version');
        return 'python3';
    } catch (e) {
        return 'python';
    }
}

const pythonCmd = getPythonCmd();
console.log(`Using Python command: ${pythonCmd}`);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/debug/:id', (req, res) => {
    const stockId = req.params.id;
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const pythonProcess = spawn(pythonCmd, ['fetch_stock.py', stockId]);
    
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => stdout += data.toString());
    pythonProcess.stderr.on('data', (data) => stderr += data.toString());

    pythonProcess.on('close', (code) => {
        res.json({
            code,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            platform: process.platform,
            node_version: process.version
        });
    });
});

app.get('/api/stock/:id', (req, res) => {
    const stockId = req.params.id;
    // 在 Linux/Render 上通常是 python3，但在 Windows 上是 python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const pythonProcess = spawn(pythonCmd, ['fetch_stock.py', stockId]);
    
    let data = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (chunk) => {
        data += chunk.toString();
    });

    pythonProcess.stderr.on('data', (chunk) => {
        errorData += chunk.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python Error (Code ${code}):`, errorData);
            return res.status(500).json({ error: 'Python process failed', details: errorData });
        }
        try {
            const result = JSON.parse(data);
            if (result.error) {
                res.status(404).json({ error: result.error });
            } else {
                res.json({ id: stockId, ...result });
            }
        } catch (e) {
            res.status(500).json({ error: 'Failed to parse stock data' });
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
