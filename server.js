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

app.get('/health', (req, res) => res.send('Server v3.6 (Google Finance Optimized) is Live'));

// --- 強化版 Google Finance 解析 ---
async function fetchFromGoogle(stockId) {
    try {
        let query = stockId;
        if (stockId.match(/^[0-9]+$/)) {
            // 嘗試上市 (TPE)，若失敗後續會走備援
            query = `${stockId}:TPE`;
        }

        const url = `https://www.google.com/finance/quote/${query}`;
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 5000 });
        const $ = cheerio.load(data);

        // 1. 抓取現價
        const price = $('.fxKbKc').first().text();
        if (!price) return null;

        // 2. 抓取漲跌區域
        // Google Finance 的漲跌通常在 [aria-label] 中有詳細文字，或是在特定的 div
        const changeEl = $('.Jw7X6b').first();
        let changeStr = changeEl.text(); // 例如 "+31.00 (1.69%)"
        
        // 判斷漲跌趨勢
        let trend = 'none';
        if (changeEl.hasClass('P23S3b') || changeStr.includes('+')) trend = 'up';
        else if (changeEl.hasClass('pY6Snc') || changeStr.includes('-')) trend = 'down';

        // 整理 change 格式：確保它只包含 "漲跌 (百分比)"
        // 有時 Google 會抓到 "今日漲跌" 之類的雜字，我們過濾一下
        const cleanChange = changeStr.match(/[+-]?[0-9,.]+\s*\([^)]+\)/);
        const finalChange = cleanChange ? cleanChange[0] : changeStr;

        return {
            price: price.replace(/[^0-9.]/g, ''),
            change: finalChange,
            trend: trend,
            symbol: query,
            source: 'Google'
        };
    } catch (e) {}
    return null;
}

// --- 備援引擎：Yahoo 台灣網頁版 (上櫃公司專用) ---
async function fetchFromYahooWeb(stockId) {
    try {
        // 同時嘗試 .TW 和 .TWO
        for (const suffix of ['.TW', '.TWO']) {
            const url = `https://tw.stock.yahoo.com/quote/${stockId}${suffix}`;
            const { data } = await axios.get(url, { 
                headers: { ...HEADERS, 'Referer': 'https://tw.stock.yahoo.com/' },
                timeout: 5000 
            });
            const $ = cheerio.load(data);
            const price = $('.Fz\\(32px\\)').first().text();
            if (!price || price === '-') continue;

            const change = $('.Fz\\(20px\\)').first().text();
            let trend = 'none';
            if ($('.Fz\\(20px\\)').first().hasClass('C($c-trend-up)')) trend = 'up';
            else if ($('.Fz\\(20px\\)').first().hasClass('C($c-trend-down)')) trend = 'down';

            return { price, change, trend, symbol: stockId + suffix, source: 'YahooWeb' };
        }
    } catch (e) {}
    return null;
}

app.get('/api/stock/:id', async (req, res) => {
    const stockId = req.params.id;
    let result = await fetchFromGoogle(stockId);
    
    // 如果 Google 沒抓到，或是台股（Google 有時對上櫃支援較慢），嘗試 Yahoo
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
    console.log(`Server v3.6 running on port ${PORT}`);
});
