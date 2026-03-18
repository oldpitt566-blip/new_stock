import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
};

app.get('/health', (req, res) => res.send('Server v3.5 (Google + Yahoo Web) is Live'));

// --- 核心引擎：Google Finance (極速且穩定) ---
async function fetchFromGoogle(stockId) {
    try {
        // 判斷台股或是美股 (台股補上 :TPE 或 :TWO)
        let query = stockId;
        if (stockId.match(/^[0-9]+$/)) {
            // 先試上市 TPE，不行再試上櫃 TWO (Google Finance 格式)
            query = `${stockId}:TPE`;
        }

        const url = `https://www.google.com/finance/quote/${query}`;
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 5000 });
        const $ = cheerio.load(data);

        const price = $('.YMlS1d .YMlS1d').first().text() || $('.fxKbKc').first().text();
        const changeStr = $('.Jw7X6b').first().text(); // 包含漲跌點數與百分比
        
        if (price) {
            const isUp = $('.Jw7X6b').first().hasClass('P23S3b') || changeStr.includes('+');
            const isDown = $('.Jw7X6b').first().hasClass('pY6Snc') || changeStr.includes('-');

            return {
                price: price.replace(/[^0-9.]/g, ''),
                change: changeStr,
                trend: isUp ? 'up' : (isDown ? 'down' : 'none'),
                symbol: query,
                source: 'Google'
            };
        }
    } catch (e) {}
    return null;
}

// --- 備援引擎：Yahoo 台灣網頁版 (含 Referer 偽裝) ---
async function fetchFromYahooWeb(stockId) {
    try {
        const url = `https://tw.stock.yahoo.com/quote/${stockId}.TW`;
        const { data } = await axios.get(url, { 
            headers: { ...HEADERS, 'Referer': 'https://tw.stock.yahoo.com/' },
            timeout: 5000 
        });
        const $ = cheerio.load(data);
        const price = $('.Fz\\(32px\\)').first().text();
        const change = $('.Fz\\(20px\\)').first().text();
        let trend = 'none';
        if ($('.Fz\\(20px\\)').first().hasClass('C($c-trend-up)')) trend = 'up';
        else if ($('.Fz\\(20px\\)').first().hasClass('C($c-trend-down)')) trend = 'down';

        if (price && price !== '-') {
            return { price, change, trend, symbol: stockId, source: 'YahooWeb' };
        }
    } catch (e) {}
    return null;
}

app.get('/api/stock/:id', async (req, res) => {
    const stockId = req.params.id;
    
    // 1. 優先使用 Google Finance (最穩)
    let result = await fetchFromGoogle(stockId);
    
    // 2. 如果 Google 沒抓到台股，嘗試 Yahoo 網頁版
    if (!result && stockId.match(/^[0-9]+$/)) {
        result = await fetchFromYahooWeb(stockId);
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
    console.log(`Server v3.5 running on port ${PORT}`);
});
