#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_wiki_dict.py
Wikipedia日本語版から人名・地名・企業名の読み（よみ）を取得し
wiki_dict.json を生成・更新するバッチスクリプト。

使い方:
  python3 generate_wiki_dict.py              # 全カテゴリを取得・更新
  python3 generate_wiki_dict.py --dry        # 取得のみ（保存しない）
  python3 generate_wiki_dict.py --category 野球
  python3 generate_wiki_dict.py --names 大谷翔平 池江璃花子
"""

import json, re, ssl, time, urllib.request, urllib.parse, os, argparse

WIKI_DICT_PATH = os.path.join(os.path.dirname(__file__), "dict", "wiki_dict.json")
INTERVAL = 2.0   # Wikipedia APIレート制限対策（秒）
TIMEOUT  = 8

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# ──────────────────────────────────────────────
# 取得対象リスト（カテゴリ別）
# 新しい名前はここに追加するだけでOK
# ──────────────────────────────────────────────
TARGETS = {

    "政治家": [
        "石破茂", "岸田文雄", "高市早苗", "林芳正", "上川陽子",
        "野田佳彦", "枝野幸男", "泉健太", "山本太郎", "玉木雄一郎",
        "小池百合子", "吉村洋文", "斎藤元彦", "河野太郎", "茂木敏充",
        "菅義偉", "安倍晋三", "麻生太郎",
    ],

    "野球": [
        "大谷翔平", "田中将大", "ダルビッシュ有", "菊池雄星", "今永昇太",
        "鈴木誠也", "吉田正尚", "千賀滉大", "牧秀悟", "佐々木朗希",
        "山本由伸", "村上宗隆", "岡本和真", "近本光司", "丸佳浩",
        "坂本勇人", "菊池涼介", "西川龍馬",
    ],

    "サッカー": [
        "三笘薫", "久保建英", "遠藤航", "冨安健洋", "伊東純也",
        "前田大然", "堂安律", "田中碧", "古橋亨梧", "鎌田大地",
        "南野拓実", "中村敬斗", "浅野拓磨", "川島永嗣",
    ],

    "スポーツ（その他）": [
        "池江璃花子", "錦織圭", "羽生結弦", "宇野昌磨", "坂本花織",
        "高梨沙羅", "平野歩夢", "堀米雄斗", "阿部一二三", "阿部詩",
        "山口茜", "奥原希望", "西矢椛", "ウルフアロン",
        "大坂なおみ", "八村塁", "渡邊雄太",
    ],

    "芸能人・俳優": [
        "綾瀬はるか", "石原さとみ", "新垣結衣", "長澤まさみ", "広瀬すず",
        "浜辺美波", "橋本環奈", "今田美桜", "川口春奈", "土屋太鳳",
        "菅田将暉", "山田涼介", "吉沢亮", "横浜流星", "坂口健太郎",
        "竹内涼真", "桐谷健太", "鈴木亮平", "木村拓哉", "反町隆史",
        "松本人志", "浜田雅功", "明石家さんま", "岡村隆史", "矢部浩之",
        "有吉弘行", "博多大吉", "千鳥大悟",
    ],

    "歌手": [
        "浜崎あゆみ", "安室奈美恵", "中島美嘉", "宇多田ヒカル",
        "米津玄師", "優里", "藤井風", "あいみょん",
        "福山雅治", "桑田佳祐", "矢沢永吉", "氷川きよし",
        "五木ひろし", "北島三郎", "坂本冬美",
    ],

    "アイドル": [
        "宮脇咲良", "指原莉乃", "大島優子", "前田敦子", "渡辺麻友",
        "柏木由紀", "横山由依", "峯岸みなみ",
        "西野七瀬", "白石麻衣", "生田絵梨花", "齋藤飛鳥", "与田祐希",
        "久保史緒里", "遠藤さくら", "賀喜遥香", "山下美月",
    ],

    "企業": [
        "トヨタ自動車", "ソニーグループ", "ソフトバンクグループ",
        "楽天グループ", "任天堂", "パナソニック", "シャープ",
        "ホンダ", "日産自動車", "川崎重工業",
        "三菱電機", "富士通", "キヤノン",
    ],

    "地名": [
        "北海道", "青森県", "岩手県", "宮城県", "秋田県",
        "山形県", "福島県", "茨城県", "栃木県", "群馬県",
        "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県",
        "富山県", "石川県", "福井県", "山梨県", "長野県",
        "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県",
        "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
        "鳥取県", "島根県", "岡山県", "広島県", "山口県",
        "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
        "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県",
        "鹿児島県", "沖縄県",
        "札幌市", "仙台市", "さいたま市", "千葉市", "横浜市",
        "川崎市", "新潟市", "静岡市", "浜松市", "名古屋市",
        "京都市", "大阪市", "堺市", "神戸市", "岡山市",
        "広島市", "北九州市", "福岡市", "熊本市",
        "新宿区", "渋谷区", "港区", "千代田区", "中央区",
        "豊島区", "品川区", "世田谷区",
    ],
}


def get_wiki_reading(title):
    """Wikipedia日本語版APIから読み（ひらがな）を取得する。"""
    params = {
        "action": "query", "titles": title,
        "prop": "revisions", "rvprop": "content",
        "rvslots": "main", "rvsection": "0",
        "format": "json", "formatversion": "2",
    }
    url = "https://ja.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "VStudio-WikiDictBot/2.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=TIMEOUT) as res:
            data = json.loads(res.read().decode("utf-8"))
        pages = data.get("query", {}).get("pages", [])
        if not pages or pages[0].get("missing"):
            return None
        content = (pages[0].get("revisions", [{}])[0]
                   .get("slots", {}).get("main", {}).get("content", ""))
    except Exception as e:
        print(f"    [ERROR] {title}: {e}")
        return None

    # パターン1: {{読み仮名|漢字|よみ}} テンプレート（最も信頼性が高い）
    parts = re.findall(r"\{\{読み仮名\|[^|]+\|([ぁ-ん][ぁ-んー]+)\}\}", content)
    if parts:
        return "".join(parts)

    # パターン2: | 各国語表記 = よみ（政治家Infobox）
    m = re.search(r"\|\s*各国語表記\s*=\s*([ぁ-ん][ぁ-んー\s]+)", content)
    if m:
        return m.group(1).replace(" ", "").strip()

    # パターン3: | ふりがな = よみ
    m = re.search(r"\|\s*ふりがな\s*=\s*([ぁ-ん][ぁ-んー\s]+)", content)
    if m:
        return m.group(1).replace(" ", "").strip()

    # パターン4: '''名前'''（よみ）— 地名・組織名
    m = re.search(r"'''[^']+'''\s*[（(]([ぁ-ん][ぁ-んー\s]{2,})[、，）)]", content)
    if m:
        return m.group(1).replace(" ", "").strip()

    # パターン5: summary API（地名の冒頭「〇〇（よみ）は」パターン）
    try:
        sum_url = f"https://ja.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}"
        req2 = urllib.request.Request(sum_url, headers={"User-Agent": "VStudio-WikiDictBot/2.0"})
        with urllib.request.urlopen(req2, context=ctx, timeout=TIMEOUT) as res2:
            sdata = json.loads(res2.read().decode("utf-8"))
        extract = sdata.get("extract", "")
        m = re.search(r"[（(]([ぁ-ん][ぁ-んー・]{1,20})[）),、\s]", extract)
        if m:
            return m.group(1).strip()
    except Exception:
        pass

    return None


def main():
    parser = argparse.ArgumentParser(description="Wikipediaから読みを取得してwiki_dict.jsonを更新")
    parser.add_argument("--dry", action="store_true", help="保存せずに結果だけ表示")
    parser.add_argument("--category", help="特定カテゴリのみ処理（例: 野球）")
    parser.add_argument("--names", nargs="+", help="個別の名前を指定して取得")
    parser.add_argument("--force", action="store_true", help="取得済みエントリも再取得して上書き")
    args = parser.parse_args()

    # 既存のwiki_dict.jsonをロード（差分更新）
    wiki_dict = {}
    if os.path.exists(WIKI_DICT_PATH):
        with open(WIKI_DICT_PATH, "r", encoding="utf-8") as f:
            wiki_dict = json.load(f)
        print(f"既存エントリ: {len(wiki_dict)} 件")

    # 取得対象を決定
    if args.names:
        targets_flat = args.names
        print(f"個別取得: {targets_flat}")
    elif args.category:
        targets_flat = TARGETS.get(args.category, [])
        if not targets_flat:
            print(f"カテゴリ「{args.category}」が見つかりません。利用可能: {list(TARGETS.keys())}")
            return
        print(f"カテゴリ「{args.category}」: {len(targets_flat)} 件")
    else:
        targets_flat = [name for names in TARGETS.values() for name in names]
        print(f"全カテゴリ合計: {len(targets_flat)} 件")

    # 未取得のみ処理（--force で全取得）
    to_fetch = targets_flat if args.force else [t for t in targets_flat if t not in wiki_dict]
    print(f"取得対象: {len(to_fetch)} 件\n")

    added = 0
    failed = 0
    for i, name in enumerate(to_fetch, 1):
        reading = get_wiki_reading(name)
        if reading:
            wiki_dict[name] = reading
            added += 1
            print(f"  [{i:3d}/{len(to_fetch)}] ✅ {name} → {reading}")
        else:
            failed += 1
            print(f"  [{i:3d}/{len(to_fetch)}] ❌ {name} → 取得失敗")
        time.sleep(INTERVAL)

    print(f"\n── 完了 ──")
    print(f"  新規取得: {added} 件 / 失敗: {failed} 件 / 合計: {len(wiki_dict)} 件")

    if not args.dry:
        with open(WIKI_DICT_PATH, "w", encoding="utf-8") as f:
            json.dump(wiki_dict, f, ensure_ascii=False, indent=4)
        print(f"  保存完了: {WIKI_DICT_PATH}")
    else:
        print("  (--dry モード: 保存をスキップ)")


if __name__ == "__main__":
    main()
