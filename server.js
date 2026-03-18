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

app.get('/health', (req, res) => res.send('Server v3.4 (TWSE Official + Yahoo) is Live'));

// --- 台股引擎：台灣證交所官方 API (tse/otc) ---
async function fetchTaiwanStockOfficial(stockId) {
    try {
        // 同時嘗試上市 (tse) 與 上櫃 (otc)
        const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${stockId}.tw|otc_${stockId}.tw&_=${Date.now()}`;
        const { data } = await axios.get(url, { timeout: 5000 });
        
        if (data && data.msgArray && data.msgArray.length > 0) {
            const info = data.msgArray[0];
            const price = parseFloat(info.z || info.y); // z 是現價，y 是昨收
            const prevClose = parseFloat(info.y);
            const change = price - prevClose;
            const changePct = (change / prevClose) * 100;
            
            return {
                price: price.toFixed(2),
                change: `${change.toFixed(2)} (${changePct.toFixed(2)}%)`,
                trend: change > 0 ? 'up' : (change < 0 ? 'down' : 'none'),
                symbol: stockId,
                source: 'TWSE_Official'
            };
        }
    } catch (e) {
        console.error(`TWSE error for ${stockId}:`, e.message);
    }
    return null;
}

// --- 美股引擎：Yahoo Finance API (修正版) ---
async function fetchUSStock(stockId) {
    try {
        // 修正 ESM 下的調用方式
        const quoteFunc = yahooFinance.quote || yahooFinance.default?.quote;
        if (typeof quoteFunc !== 'function') throw new Error('yahooFinance.quote is not available');
        
        const quote = await quoteFunc(stockId);
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

    // 判斷台股 (數字)
    if (stockId.match(/^[0-9]+$/)) {
        result = await fetchTaiwanStockOfficial(stockId);
    } 
    
    // 如果不是台股，或是官方 API 沒抓到，嘗試 Yahoo
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
    console.log(`Server v3.4 running on port ${PORT}`);
});
