import json

with open("data/tts_rules.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# 1. word_reading_fixes のスリム化
wrf = data.get("word_reading_fixes", {})
remove_words = ["超え", "萬谷", "ホロリブ"]
for w in remove_words:
    if w in wrf:
        del wrf[w]
        print(f"word_reading_fixes から削除: {w}")

# 2. context_regex_fixes のスリム化
crf = data.get("context_regex_fixes", [])
patterns_to_remove = {
    r"(?<![A-Za-z0-9])(?:SB|ＳＢ)(?=[一-鿿ぁ-んァ-ヶ])",
    r"([ぁ-んァ-ヶ])よほうさむらい",
    r"([ぁ-んァ-ヶ])ごさむらい",
    r"([ぁ-んァ-ヶ])ぼうさむらい",
    r"([ぁ-んァ-ヶ])こうさむらい",
    r"(?<![A-Za-z0-9])[Uu][\-\u2212\u30FC\uFF0D]?18(?![0-9])",
    r"(?<![A-Za-z0-9])[Uu][\-\u2212\u30FC\uFF0D]?23(?![0-9])",
    r"(?<![A-Za-z0-9])[Uu][\-\u2212\u30FC\uFF0D]?20(?![0-9])",
    r"(?<![A-Za-z0-9])[Uu][\-\u2212\u30FC\uFF0D]?15(?![0-9])",
    r"(?<![A-Za-z0-9])[Uu][\-\u2212\u30FC\uFF0D]?17(?![0-9])",
    r"(?<![0-9〇一二三四五六七八九十百千万第])中条(?=(?:あやみ|きよし|さん|氏|様|ちゃん|くん|君))"
}

new_crf = []
for r in crf:
    pat = r.get("pattern", "")
    if pat in patterns_to_remove:
        note = r.get("note", "")
        print(f"context_regex_fixes から削除: {pat} ({note})")
    else:
        new_crf.append(r)
data["context_regex_fixes"] = new_crf

# 3. person_kata_rules キーの削除
if "person_kata_rules" in data:
    del data["person_kata_rules"]
    print("person_kata_rules キーを削除しました")

with open("data/tts_rules.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("tts_rules.json のスリム化完了！")
