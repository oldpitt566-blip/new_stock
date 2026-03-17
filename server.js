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
    const fetchFromYahoo = async (suffix) => {
        try {
            const url = `https://tw.stock.yahoo.com/quote/${stockId}${suffix}`;
            const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $ = cheerio.load(data);
            
            const price = $('.Fz\\(32px\\)').first().text();
            
            // 抓取所有漲跌相關的元素
            const changeEls = $('.Fz\\(20px\\)');
            let changeFull = '';
            let trend = 'none';
            
            changeEls.each((i, el) => {
                const text = $(el).text().trim();
                const hasTrendUp = $(el).hasClass('C($c-trend-up)');
                const hasTrendDown = $(el).hasClass('C($c-trend-down)');
                
                if (hasTrendUp) trend = 'up';
                else if (hasTrendDown) trend = 'down';
                
                // 尋找包含數字的文字，避免只抓到箭頭
                if (/[0-9]/.test(text)) {
                    changeFull = text;
                    return false; // 找到第一個包含數字的就跳出
                }
            });

            // 如果沒抓到 trend，從文字判定
            if (trend === 'none') {
                if (changeFull.includes('+')) trend = 'up';
                else if (changeFull.includes('-')) trend = 'down';
            }

            // 拆分漲跌值 (只取數字部分)
            let changeVal = changeFull.split(' ')[0].replace(/[+-↑↓]/g, '').trim();
            if (!changeVal || changeVal === '-') changeVal = '0';

            return { price, changeVal, trend };
        } catch (e) { return null; }
    };

    try {
        let result = await fetchFromYahoo('.TW');
        if (!result || !result.price || result.price === '-') {
            result = await fetchFromYahoo('.TWO');
        }
        
        if (result && result.price && result.price !== '-') {
            res.json({ id: stockId, ...result });
        } else {
            res.status(404).json({ error: 'Stock not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
