import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import yahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.send('Server v3.3 (FinMind + Yahoo) is Live'));

// --- 台股引擎：FinMind API ---
async function fetchTaiwanStock(stockId) {
    try {
        // FinMind API 不需要 Token 即可進行基礎查詢
        const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${stockId}&start_date=${new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0]}`;
        const { data } = await axios.get(url);
        
        if (data && data.data && data.data.length > 0) {
            const history = data.data;
            const last = history[history.length - 1];
            const prev = history.length > 1 ? history[history.length - 2] : last;
            
            const price = last.close;
            const change = price - prev.close;
            const changePct = (change / prev.close) * 100;
            
            return {
                price: price.toFixed(2),
                change: `${change.toFixed(2)} (${changePct.toFixed(2)}%)`,
                trend: change > 0 ? 'up' : (change < 0 ? 'down' : 'none'),
                symbol: stockId,
                source: 'FinMind'
            };
        }
    } catch (e) {
        console.error(`FinMind error for ${stockId}:`, e.message);
    }
    return null;
}

// --- 美股引擎：Yahoo Finance API ---
async function fetchUSStock(stockId) {
    try {
        const quote = await yahooFinance.quote(stockId);
        if (quote && quote.regularMarketPrice) {
            const price = quote.regularMarketPrice;
            const change = quote.regularMarketChange || 0;
            const changePct = quote.regularMarketChangePercent || 0;
            return {
                price: price.toFixed(2),
                change: `${change.toFixed(2)} (${changePct.toFixed(2)}%)`,
                trend: change > 0 ? 'up' : (change < 0 ? 'down' : 'none'),
                symbol: stockId,
                source: 'YahooAPI'
            };
        }
    } catch (e) {
        console.error(`Yahoo error for ${stockId}:`, e.message);
    }
    return null;
}

app.get('/api/stock/:id', async (req, res) => {
    const stockId = req.params.id;
    let result = null;

    // 判斷是否為台股 (純數字)
    if (stockId.match(/^[0-9]+$/)) {
        result = await fetchTaiwanStock(stockId);
    } 
    
    // 如果不是台股，或是 FinMind 沒抓到，嘗試 Yahoo
    if (!result) {
        result = await fetchUSStock(stockId);
    }

    if (result) {
        res.json({ id: stockId, ...result });
    } else {
        res.status(404).json({ error: 'Stock not found' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server v3.3 running on port ${PORT}`);
});
