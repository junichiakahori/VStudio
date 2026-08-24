import urllib.request
import ssl
import sqlite3
import os
import re
import sys

def build_master_dictionary():
    db_path = os.path.join(os.path.dirname(__file__), 'master_dictionary.db')
    if os.path.exists(db_path):
        os.remove(db_path)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # テーブル作成
    cursor.execute('''
        CREATE TABLE dictionary (
            surface TEXT PRIMARY KEY,
            reading TEXT NOT NULL,
            cost INTEGER NOT NULL,
            pos TEXT
        )
    ''')
    cursor.execute('CREATE INDEX idx_surface ON dictionary(surface)')
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    print("=== Google Mozc 国語・現代語辞書データ（約25万語）をダウンロード中... ===")
    
    entries = {}
    
    # 00 〜 09 までの全10ファイルをダウンロード
    for i in range(10):
        file_num = f"{i:02d}"
        url = f"https://raw.githubusercontent.com/google/mozc/master/src/data/dictionary_oss/dictionary{file_num}.txt"
        print(f"[{i+1}/10] dictionary{file_num}.txt を取得中...", flush=True)
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, context=ctx, timeout=30) as res:
                lines = res.read().decode('utf-8').splitlines()
                for line in lines:
                    parts = line.split('\t')
                    if len(parts) >= 5:
                        reading = parts[0].strip()   # ひらがな読み
                        cost = int(parts[3].strip()) # 出現頻度コスト（小さいほど高頻度）
                        surface = parts[4].strip()   # 漢字・表記
                        
                        # 1文字単語や記号、ひらがな単体はノイズ防止のため除外
                        if len(surface) < 2 or surface == reading:
                            continue
                        
                        # 漢字または英字が含まれている単語のみ
                        if not re.search(r'[\u4e00-\u9fafA-Za-z]', surface):
                            continue
                        
                        # コストが低い（より自然で高頻度な読み）を優先
                        if surface not in entries or cost < entries[surface][1]:
                            entries[surface] = (reading, cost)
        except Exception as e:
            print(f"Error fetching dictionary{file_num}.txt: {e}")
            
    print(f"\nMozc辞書から {len(entries):,} 語の有効語彙を抽出しました。")
    
    # SQLite3 に一括書き込み
    print("データベースにインデックスを構築中...")
    insert_data = [(surface, data[0], data[1], "mozc") for surface, data in entries.items()]
    cursor.executemany('INSERT OR REPLACE INTO dictionary (surface, reading, cost, pos) VALUES (?, ?, ?, ?)', insert_data)
    
    conn.commit()
    
    cursor.execute('SELECT COUNT(*) FROM dictionary')
    total_count = cursor.fetchone()[0]
    conn.close()
    
    print(f"✅ 大規模国語辞典『master_dictionary.db』の構築が完了しました！（収録語数: {total_count:,} 語）")
    return total_count

if __name__ == '__main__':
    build_master_dictionary()
