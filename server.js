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
            const changeEl = $('.Fz\\(20px\\)').first();
            const changeFull = changeEl.text(); // 格式通常是 "5.00 (2.56%)"
            
            let trend = 'none';
            if (changeEl.hasClass('C($c-trend-up)')) trend = 'up';
            else if (changeEl.hasClass('C($c-trend-down)')) trend = 'down';
            
            // 拆分漲跌值與百分比
            let changeVal = '0';
            if (changeFull && changeFull !== '-') {
                const parts = changeFull.split(' ');
                changeVal = parts[0].replace(/[+-↑↓]/g, '').trim();
            }

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
