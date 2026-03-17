const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/stock/:id', async (req, res) => {
    const stockId = req.params.id;
    try {
        const url = `https://tw.stock.yahoo.com/quote/${stockId}.TW`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        
        const price = $('.Fz\\(32px\\)').first().text();
        const change = $('.Fz\\(20px\\)').first().text(); // 最簡單的抓取方式
        
        // 簡單判定漲跌顏色
        let trend = 'none';
        if ($('.Fz\\(20px\\)').first().hasClass('C($c-trend-up)')) trend = 'up';
        else if ($('.Fz\\(20px\\)').first().hasClass('C($c-trend-down)')) trend = 'down';

        res.json({ id: stockId, price, change, trend });
    } catch (error) {
        // 嘗試上櫃
        try {
            const url = `https://tw.stock.yahoo.com/quote/${stockId}.TWO`;
            const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $ = cheerio.load(data);
            const price = $('.Fz\\(32px\\)').first().text();
            const change = $('.Fz\\(20px\\)').first().text();
            let trend = 'none';
            if ($('.Fz\\(20px\\)').first().hasClass('C($c-trend-up)')) trend = 'up';
            else if ($('.Fz\\(20px\\)').first().hasClass('C($c-trend-down)')) trend = 'down';
            res.json({ id: stockId, price, change, trend });
        } catch (e) {
            res.status(404).json({ error: 'Not found' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
