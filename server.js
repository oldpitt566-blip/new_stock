const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

app.get('/api/stock/:id', async (req, res) => {
    const stockId = req.params.id;
    try {
        const url = `https://tw.stock.yahoo.com/quote/${stockId}.TW`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);
        
        // 抓取股價 (Yahoo 股市的選擇器可能會隨時間變動)
        const price = $('.Fz\\(32px\\)').first().text();
        const change = $('.Fz\\(20px\\)').first().text();
        
        res.json({ id: stockId, price, change });
    } catch (error) {
        res.status(500).json({ error: '無法取得股價' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
