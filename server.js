import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import * as cheerio from 'cheerio';
import yahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

// 健康檢查
app.get('/health', (req, res) => res.send('Server v3.2 (Hybrid) is Live'));

// 專門抓取台灣 Yahoo 網頁的爬蟲
async function scrapeTaiwanYahoo(stockId) {
    const suffixes = ['.TW', '.TWO', ''];
    for (const suffix of suffixes) {
        try {
            const url = `https://tw.stock.yahoo.com/quote/${stockId}${suffix}`;
            const { data } = await axios.get(url, { 
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                timeout: 5000 
            });
            const $ = cheerio.load(data);
            
            // 抓取現價 (使用 Yahoo 目前最新的 CSS class)
            const price = $('.Fz\\(32px\\)').first().text();
            if (!price || price === '-') continue;

            // 抓取漲跌
            const changeRaw = $('.Fz\\(20px\\)').first().text();
            let trend = 'none';
            if ($('.Fz\\(20px\\)').first().hasClass('C($c-trend-up)')) trend = 'up';
            else if ($('.Fz\\(20px\\)').first().hasClass('C($c-trend-down)')) trend = 'down';

            return {
                price: price,
                change: changeRaw,
                trend: trend,
                symbol: stockId + suffix,
                source: 'YahooTW_Scrape'
            };
        } catch (e) { continue; }
    }
    return null;
}

// 專門抓取美股 API
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
    } catch (e) {}
    return null;
}

app.get('/api/stock/:id', async (req, res) => {
    const stockId = req.params.id;
    let result = null;

    // 判斷是否為台股 (4-5位數字)
    if (stockId.match(/^[0-9]{4,5}$/)) {
        result = await scrapeTaiwanYahoo(stockId);
    } 
    
    // 如果台股爬不到，或是美股代號，嘗試 API
    if (!result) {
        result = await fetchUSStock(stockId);
    }

    if (result) {
        res.json({ id: stockId, ...result });
    } else {
        res.status(404).json({ error: 'Stock not found across all sources' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
