const express = require('express');
const cors = require('cors');
const path = require('path');
const yahooFinance = require('yahoo-finance2').default;

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.send('Server is alive! Version: 3.0 (Node Native)'));

app.get('/api/stock/:id', async (req, res) => {
    const stockId = req.params.id;
    const suffixes = stockId.match(/^[0-9]{4,5}$/) ? ['.TW', '.TWO', ''] : [''];
    
    let result = null;
    for (const suffix of suffixes) {
        try {
            const quote = await yahooFinance.quote(stockId + suffix);
            if (quote && quote.regularMarketPrice) {
                const price = quote.regularMarketPrice;
                const change = quote.regularMarketChange || 0;
                const changePct = quote.regularMarketChangePercent || 0;
                const trend = change > 0 ? 'up' : (change < 0 ? 'down' : 'none');
                
                result = {
                    id: stockId,
                    price: price.toFixed(2),
                    change: `${change.toFixed(2)} (${changePct.toFixed(2)}%)`,
                    trend: trend,
                    symbol: stockId + suffix
                };
                break;
            }
        } catch (e) { continue; }
    }

    if (result) {
        res.json(result);
    } else {
        res.status(404).json({ error: 'Stock not found' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server v3.0 running on port ${PORT}`);
});
