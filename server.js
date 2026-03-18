import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.send('Server v3.7 (Yahoo Internal API) is Live'));

// --- 終極引擎：Yahoo Finance Query API ---
async function fetchStockData(stockId) {
    // 判斷後綴：台股嘗試 .TW 與 .TWO，美股不加後綴
    const suffixes = stockId.match(/^[0-9]+$/) ? ['.TW', '.TWO'] : [''];
    
    for (const suffix of suffixes) {
        const symbol = stockId + suffix;
        try {
            // 使用 Yahoo Finance 的內部 Chart API，這是目前最穩定的純數據來源
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                timeout: 5000
            });

            if (data?.chart?.result?.[0]?.meta) {
                const meta = data.chart.result[0].meta;
                const price = meta.regularMarketPrice;
                const prevClose = meta.chartPreviousClose;
                
                if (price === undefined || prevClose === undefined) continue;

                const change = price - prevClose;
                const changePct = (change / prevClose) * 100;
                const trend = change > 0 ? 'up' : (change < 0 ? 'down' : 'none');

                console.log(`Successfully fetched ${symbol}: ${price}`);

                return {
                    price: price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    change: `${change.toFixed(2)} (${changePct.toFixed(2)}%)`,
                    trend: trend,
                    symbol: symbol,
                    source: 'YahooInternal'
                };
            }
        } catch (e) {
            console.error(`Error fetching ${symbol}: ${e.message}`);
            continue; 
        }
    }
    return null;
}

app.get('/api/stock/:id', async (req, res) => {
    const stockId = req.params.id;
    const result = await fetchStockData(stockId);

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
    console.log(`Server v3.7 running on port ${PORT}`);
});
