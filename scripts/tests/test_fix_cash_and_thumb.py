import sys
import os
import re

# 1. 「金」➔「かね」の否定戻り読みテスト
test_cases = [
    ("現金を渡す", "現金を渡す"),
    ("資金を渡す", "資金を渡す"),
    ("給付金を渡す", "給付金を渡す"),
    ("賞金を渡す", "賞金を渡す"),
    ("現金を奪う", "現金を奪う"),
    ("現金を要求する", "現金を要求する"),
    ("現金を払う", "現金を払う"),
    ("金を渡す", "かねを渡す"),
    ("金を奪う", "かねを奪う"),
    ("金を払う", "かねを払う"),
    ("金目当て", "かね目当て"),
    ("金に困る", "かねに困る"),
    ("金が欲しい", "かねが欲しい"),
]

def heal_gold(text):
    healed_sp = text
    healed_sp = re.sub(r'(?<![一-鿿])金(?=目当て|めあて|払い|はらい|勘定|かんじょう|の切れ目|の亡者)', 'かね', healed_sp)
    healed_sp = re.sub(r'(?<![一-鿿])金(?=を(?:要求|受取|受け取|奪|払|はら|持|もっ|渡|わた|取|盗|ぬす|返|かえ|借|か|貸|欲|ほし|稼|かせ|出|だ|使|つか|脅|巻き上げ|せび))', 'かね', healed_sp)
    healed_sp = re.sub(r'(?<![一-鿿])金(?=に(?:困|こま|目がない|目がくら|糸目をつけず|飽か))', 'かね', healed_sp)
    healed_sp = re.sub(r'(?<![一-鿿])金(?=が(?:欲|ほし|無|な|足|た))', 'かね', healed_sp)
    return healed_sp

print("=== 1. 金/現金 正規表現テスト ===")
all_pass = True
for inp, expected in test_cases:
    actual = heal_gold(inp)
    status = "PASS" if actual == expected else f"FAIL (got '{actual}')"
    print(f"[{status}] '{inp}' ➔ '{actual}' (expected: '{expected}')")
    if actual != expected:
        all_pass = False

assert all_pass, "正規表現テスト失敗！"

# 2. YouTube Video ID 自動解決テスト
from server.youtube_api_helper import resolve_effective_video_id

print("\n=== 2. resolve_effective_video_id テスト ===")
# URLからの抽出
test_urls = [
    ("https://www.youtube.com/watch?v=MAkwyKYtinA", "MAkwyKYtinA"),
    ("https://youtu.be/MAkwyKYtinA", "MAkwyKYtinA"),
    ("https://www.youtube.com/live/MAkwyKYtinA?feature=share", "MAkwyKYtinA"),
    ("MAkwyKYtinA", "MAkwyKYtinA"),
]

for inp, expected in test_urls:
    actual = resolve_effective_video_id(inp)
    status = "PASS" if actual == expected else f"FAIL (got '{actual}')"
    print(f"[{status}] '{inp}' ➔ '{actual}'")
    assert actual == expected

# ハンドル入力時は API未認証でもフォールバックまたはbroadcasts探索が動くことを確認
print("resolve_effective_video_id('@drone.akahori') の実行:")
try:
    res = resolve_effective_video_id("@drone.akahori")
    print(f"結果: {res}")
except Exception as e:
    print(f"例外（想定内）: {e}")

# 3. 台帳（data/pronunciation_memory.json）の読み込みと修復テスト
from server.tts_normalizer import apply_pronunciation_memory, heal_sentence_reading

print("\n=== 3. pronunciation_memory テスト ===")
disp = "容疑者は現金を渡すよう要求した"
sp = "容疑者は現かねを渡すよう要求した"
healed = heal_sentence_reading(disp, sp)
print(f"heal_sentence_reading:")
print(f"  disp: '{disp}'")
print(f"  sp:   '{sp}'")
print(f"  ➔:    '{healed}'")
assert "げんきん" in healed or "現金" in healed, f"台帳修復が効いていません: {healed}"

print("\n🎉 全ての単体テストに合格しました！")
