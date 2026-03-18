import yfinance as yf
import sys
import json
import requests

# 偽裝成真實瀏覽器，避免被 Yahoo 封鎖 IP
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def fetch_stock(symbol):
    session = requests.Session()
    session.headers.update(headers)
    
    try:
        # 判斷是否需要補上台股後綴
        if symbol.isdigit():
            if len(symbol) == 4 or len(symbol) == 5:
                suffixes = ['.TW', '.TWO']
            else:
                suffixes = ['']
        else:
            suffixes = ['']
        
        for suffix in suffixes:
            full_symbol = symbol + suffix
            ticker = yf.Ticker(full_symbol, session=session)
            
            # 使用 history 獲取最後一筆資料，這比 fast_info 更穩定
            hist = ticker.history(period="2d")
            
            if not hist.empty:
                last_row = hist.iloc[-1]
                prev_row = hist.iloc[-2] if len(hist) > 1 else last_row
                
                price = last_row['Close']
                prev_close = prev_row['Close']
                change = price - prev_close
                change_pct = (change / prev_close) * 100 if prev_close != 0 else 0
                
                trend = 'up' if change > 0 else 'down' if change < 0 else 'none'
                
                return {
                    "price": round(float(price), 2),
                    "change": f"{round(float(change), 2)} ({round(float(change_pct), 2)}%)",
                    "trend": trend,
                    "symbol": full_symbol
                }
        
        return {"error": f"Symbol {symbol} not found after trying {suffixes}"}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(json.dumps(fetch_stock(sys.argv[1])))
    else:
        print(json.dumps({"error": "No symbol provided"}))
