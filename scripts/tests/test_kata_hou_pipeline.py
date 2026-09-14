import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import re
from server.news_script_processor import audit_and_heal_news_script
from server.voicevox_client import get_voicevox_reading_and_kana

# AIがプロンプトの指示に従ってルビ付きで出力した文章のテストケース
ai_sample_sentences = [
    "倉木華さんはセクシー女優として活動していた方（かた）で、突然の訃報に多くの人々が悲しみとショックを受けているにゃ。",
    "そして猟師の方（かた）から狩猟を体験してみるようアドバイスを受けたんだにゃ。",
    "野球界に大きな影響を与えた方（かた）として敬意を表したいにゃ！",
    "AIモデルの事前学習に携わってきた方（かた）で、彼は批判しましたにゃ。",
    "朝は時間に余裕を持った行動をした方（ほう）がいいにゃ！",
    "世論調査では民主党支持層の方（ほう）が投票意欲が高いことが示されているにゃ。",
    "片方（かたほう）の袖がボリューミーに膨らんだレースドレスで登場したにゃ。"
]

def run_pipeline_test(label=""):
    print(f"============================================================")
    print(f"🧪 パイプライン検証テスト: {label}")
    print(f"============================================================")

    results = []
    for s in ai_sample_sentences:
        # 1. AI原稿から display(字幕) と speech(音声) を分離（直前の漢字連続のみ対象）
        disp = re.sub(r'([\u4e00-\u9fff]{1,8})[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\1', s)
        disp = disp.replace("（", "").replace("）", "").replace("(", "").replace(")", "").strip()

        sp = re.sub(r'([\u4e00-\u9fff]{1,8})[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\2', s)

        # 2. 自己修復・監査パイプラインを実行
        items = [{"display": disp, "speech": sp}]
        healed = audit_and_heal_news_script(items, title="ニュース", article_context="テスト記事")
        healed_disp = healed[0]["display"]
        healed_sp = healed[0]["speech"]

        # 3. VOICEVOX実機エンジンで実際の発音を確認
        vox_reading, _ = get_voicevox_reading_and_kana(healed_sp)

        results.append({
            "original": s,
            "display": healed_disp,
            "speech": healed_sp,
            "vox_reading": vox_reading
        })

    for r in results:
        print(f"📝 元テキスト: {r['original'][:40]}...")
        print(f"   📺 字幕(display): {r['display']}")
        print(f"   🎙️ 音声(speech) : {r['speech']}")
        print(f"   🔊 VOICEVOX読   : {r['vox_reading']}")
        print("-" * 60)

    return results

if __name__ == "__main__":
    run_pipeline_test("現在の状態（削除前）")
