import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import yahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.send('Server v3.1 (ESM Node) is Live'));

app.get('/api/stock/:id', async (req, res) => {
    const stockId = req.params.id;
    const suffixes = stockId.match(/^[0-9]{4,5}$/) ? ['.TW', '.TWO', ''] : [''];
    
    let result = null;
    for (const suffix of suffixes) {
        try {
            // yahooFinance2 在 ESM 下直接 import 即可使用
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
    console.log(`Server running on port ${PORT}`);
});
