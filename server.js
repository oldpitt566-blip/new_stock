const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 新增首頁路徑，方便確認伺服器狀態
app.get('/', (req, res) => {
    res.send('祥老師投資戰情室 - 股價 API 伺服器運作中！<br>使用範例: /api/stock/2603');
});

app.get('/api/stock/:id', async (req, res) => {
    const stockId = req.params.id;
    const fetchFromYahoo = async (suffix) => {
        const url = `https://tw.stock.yahoo.com/quote/${stockId}${suffix}`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const price = $('.Fz\\(32px\\)').first().text();
        const change = $('.Fz\\(20px\\)').first().text();
        return { price, change };
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
