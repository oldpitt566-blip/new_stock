const express = require('express');
const cors = require('cors');
const path = require('path');

const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/stock/:id', (req, res) => {
    const stockId = req.params.id;
    const pythonProcess = spawn('python', ['fetch_stock.py', stockId]);
    
    let data = '';
    pythonProcess.stdout.on('data', (chunk) => {
        data += chunk.toString();
    });

    pythonProcess.on('close', (code) => {
        try {
            const result = JSON.parse(data);
            if (result.error) {
                res.status(404).json({ error: result.error });
            } else {
                res.json({ id: stockId, ...result });
            }
        } catch (e) {
            res.status(500).json({ error: 'Failed to fetch stock data' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
