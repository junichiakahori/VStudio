import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from server.tts_normalizer import normalize_for_tts
from server.voicevox_client import get_voicevox_reading_and_kana

test_cases = [
    ("U-18サッカー日本代表の試合", "アンダー・エイティーン", "アンダア、エイティイン"),
    ("U-23日本代表が勝利したにゃ", "アンダー・トゥエンティスリー", "アンダア、トゥエンティスリイ"),
    ("SBホークスが好投したにゃ", "ソフトバンク", "ソフトバンク"),
    ("気象予報士の解説によると", "気象予報士", "キショオヨホオシ"),
    ("弁護士に相談したにゃ", "弁護士", "ベンゴシ"),
    ("山を超えて谷を渡るにゃ", "超えて", "コエテ"),
    ("大一番で白星を挙げたにゃ", "大一番", "オオ イチバン"),
    ("東奥日報が報じたニュースにゃ", "とうおうにっぽう", "トオ オウ ニッポオ"),
]

def run_test(label=""):
    print(f"=== {label} ===")
    all_passed = True
    for text, exp_norm, exp_vox in test_cases:
        norm = normalize_for_tts(text)
        vox_reading, _ = get_voicevox_reading_and_kana(norm)
        passed = exp_vox in vox_reading
        status = "✅ PASS" if passed else "❌ FAIL"
        if not passed:
            all_passed = False
        print(f"  {status} | 元文: {text}")
        print(f"         正規化: {norm}")
        print(f"         VOICEVOX: {vox_reading}")
    return all_passed

if __name__ == "__main__":
    run_test("クリーンアップ前のテスト")
