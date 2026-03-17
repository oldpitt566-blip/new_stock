import yfinance as yf
import sys
import json

def fetch_stock(symbol):
    try:
        # Try .TW suffix first for Taiwan stocks
        if not symbol.endswith(('.TW', '.TWO')):
            # Heuristic: try .TW, then .TWO, then as-is
            suffixes = ['.TW', '.TWO', '']
        else:
            suffixes = ['']
        
        for suffix in suffixes:
            full_symbol = symbol + suffix
            ticker = yf.Ticker(full_symbol)
            info = ticker.fast_info
            
            # fast_info is more efficient than ticker.info
            if info is not None and info.last_price > 0:
                price = info.last_price
                # Calculate change (approximate if not provided directly)
                # For exact daily change, we might need ticker.history(period="1d")
                history = ticker.history(period="2d")
                if len(history) >= 2:
                    prev_close = history['Close'].iloc[-2]
                    change = price - prev_close
                    change_pct = (change / prev_close) * 100
                    trend = 'up' if change > 0 else 'down' if change < 0 else 'none'
                else:
                    change = 0
                    change_pct = 0
                    trend = 'none'
                
                return {
                    "price": round(price, 2),
                    "change": f"{round(change, 2)} ({round(change_pct, 2)}%)",
                    "trend": trend,
                    "symbol": full_symbol
                }
        
        return {"error": "Stock not found"}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(json.dumps(fetch_stock(sys.argv[1])))
    else:
        print(json.dumps({"error": "No symbol provided"}))
