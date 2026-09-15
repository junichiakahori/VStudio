import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from server.tts_normalizer import normalize_for_tts
from server.voicevox_client import get_voicevox_reading_and_kana

test_cases = [
    ("サッカーのU-18（アンダーエイティーン）日本代表の試合", "アンダアエイティイン"),
    ("SBホークスが好投したにゃ", "ソフトバンク"),
    ("気象予報士の解説によると", "キショオヨホオシ"),
    ("弁護士に相談したにゃ", "ベンゴシ"),
    ("山を超えて谷を渡るにゃ", "コエテ"),
    ("大一番で白星を挙げたにゃ", "オオ イチバン"),
    ("東奥日報が報じたニュースにゃ", "トオ オウ ニッポオ"),
]

def run_test(label=""):
    print(f"=== {label} ===")
    all_passed = True
    import re
    from server.news_script_processor import audit_and_heal_news_script

    for text, exp_vox in test_cases:
        # ルビ分離
        disp = re.sub(r'([A-Za-z0-9\-]+|[\u4e00-\u9fff]{1,8})[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\1', text)
        disp = disp.replace("（", "").replace("）", "").replace("(", "").replace(")", "").strip()
        sp = re.sub(r'([A-Za-z0-9\-]+|[\u4e00-\u9fff]{1,8})[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\2', text)
        
        items = audit_and_heal_news_script([{"display": disp, "speech": sp}], title="テスト", article_context="記事")
        healed_sp = items[0]["speech"]
        healed_disp = items[0]["display"]

        norm = normalize_for_tts(healed_sp)
        vox_reading, _ = get_voicevox_reading_and_kana(norm)
        passed = exp_vox in vox_reading
        status = "✅ PASS" if passed else "❌ FAIL"
        if not passed:
            all_passed = False
        print(f"  {status} | 元文: {text}")
        print(f"         字幕(disp) : {healed_disp}")
        print(f"         音声(sp)   : {healed_sp}")
        print(f"         VOICEVOX   : {vox_reading}")
    return all_passed

if __name__ == "__main__":
    run_test("クリーンアップ前のテスト")
