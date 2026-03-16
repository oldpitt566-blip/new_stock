const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path'); // 新增 path 模組

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname))); // 確保靜態目錄路徑正確

const PORT = process.env.PORT || 3000;

// 使用絕對路徑讀取 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/stock/:id', async (req, res) => {
    const stockId = req.params.id;
    const fetchFromYahoo = async (suffix) => {
        const url = `https://tw.stock.yahoo.com/quote/${stockId}${suffix}`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const price = $('.Fz\\(32px\\)').first().text();
        const changeEl = $('.Fz\\(20px\\)').first();
        const change = changeEl.text();
        
        // 透過類別判定漲跌：C($c-trend-up) 是紅, C($c-trend-down) 是綠
        let trend = 'none';
        if (changeEl.hasClass('C($c-trend-up)')) trend = 'up';
        else if (changeEl.hasClass('C($c-trend-down)')) trend = 'down';
        
        return { price, change, trend };
    };

    try {
        let result = await fetchFromYahoo('.TW');
        // 如果抓不到價格，嘗試 .TWO (上櫃)
        if (!result.price || result.price === '-') {
            result = await fetchFromYahoo('.TWO');
        }
        
        if (!result.price || result.price === '-') {
            throw new Error('Stock not found');
        }
        
        res.json({ id: stockId, ...result });
    } catch (error) {
        res.status(500).json({ error: '無法取得股價' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
