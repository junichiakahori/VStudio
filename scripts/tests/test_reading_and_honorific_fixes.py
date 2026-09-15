import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from server.news_script_processor import audit_and_heal_news_script
from server.tts_normalizer import apply_person_kata_rules

def test_honorifics():
    print("=== 1. 男さん・女さん・敬称テスト ===")
    test_items = [
        {"display": "男さんが女性に電話をかけたんだにゃ。", "speech": "男さんが女性に電話をかけたんだにゃ。"},
        {"display": "女性さんが警察に相談したため、男さんは目的を達成できなかったにゃ。", "speech": "女性さんが警察に相談したため、男さんは目的を達成できなかったにゃ。"},
        {"display": "心肺停止の状態になった男性さん、大変だったにゃ。", "speech": "心肺停止の状態になった男性さん、大変だったにゃ。"},
        {"display": "ご長男さんが駆けつけ、次男さんも安心したにゃ。", "speech": "ご長男さんが駆けつけ、次男さんも安心したにゃ。"}
    ]
    healed = audit_and_heal_news_script(test_items, title="脅迫事件のニュース", article_context="事件の概要です")
    
    assert "男が女性に" in healed[0]["display"], f"Fail 0 disp: {healed[0]['display']}"
    assert "男が女性に" in healed[0]["speech"], f"Fail 0 sp: {healed[0]['speech']}"
    assert "女性が警察に相談したため、男は" in healed[1]["display"], f"Fail 1 disp: {healed[1]['display']}"
    assert "女性が警察に相談したため、男は" in healed[1]["speech"], f"Fail 1 sp: {healed[1]['speech']}"
    assert "男性、大変だった" in healed[2]["display"], f"Fail 2 disp: {healed[2]['display']}"
    assert "男性、大変だった" in healed[2]["speech"], f"Fail 2 sp: {healed[2]['speech']}"
    # 家族呼称（ご長男さん、次男さん）が保護されているか
    assert "ご長男さん" in healed[3]["display"], f"Fail 3 chonan: {healed[3]['display']}"
    assert "次男さん" in healed[3]["display"], f"Fail 3 jinan: {healed[3]['display']}"
    print("  ✅ 敬称テスト全件合格！")

def test_sumo_senshu():
    print("=== 2. 相撲力士「選手」除去テスト ===")
    sumo_items = [
        {"display": "大相撲秋場所初日、大の里選手は大栄翔選手に勝利したにゃ。", "speech": "大相撲秋場所初日、大の里選手は大栄翔選手に勝利したにゃ。"},
        {"display": "翔傑選手、50歳で現役初出場して駒ノ富士選手を倒して白星を獲得したにゃ。", "speech": "翔傑選手、50歳で現役初出場して駒ノ富士選手を倒して白星を獲得したにゃ。"}
    ]
    sumo_healed = audit_and_heal_news_script(sumo_items, title="大相撲秋場所の取組結果", article_context="土俵の上で力士たちが熱戦を繰り広げた")
    
    assert "大の里は大栄翔に勝利" in sumo_healed[0]["display"], f"Fail sumo 0 disp: {sumo_healed[0]['display']}"
    assert "大の里は大栄翔に勝利" in sumo_healed[0]["speech"], f"Fail sumo 0 sp: {sumo_healed[0]['speech']}"
    assert "翔傑、50歳で現役初出場して駒ノ富士を倒して" in sumo_healed[1]["display"], f"Fail sumo 1 disp: {sumo_healed[1]['display']}"
    assert "翔傑、50歳で現役初出場して駒ノ富士を倒して" in sumo_healed[1]["speech"], f"Fail sumo 1 sp: {sumo_healed[1]['speech']}"
    print("  ✅ 相撲力士への選手誤爆除去合格！")

    # 野球・サッカー等では選手が維持されるか
    baseball_items = [
        {"display": "プロ野球で坂本選手がサヨナラホームランを放ったにゃ。", "speech": "プロ野球で坂本選手がサヨナラホームランを放ったにゃ。"}
    ]
    baseball_healed = audit_and_heal_news_script(baseball_items, title="プロ野球の試合結果", article_context="巨人の選手たちが喜んだ")
    assert "坂本選手" in baseball_healed[0]["display"], f"Fail baseball: {baseball_healed[0]['display']}"
    print("  ✅ 一般スポーツでの「選手」維持合格！")

def test_kata_hou():
    print("=== 3. 方（かた）/ 方（ほう）読み分けテスト ===")
    from server.news_script_processor import audit_and_heal_news_script
    import re

    kata_hou_tests = [
        ("倉木華さんはセクシー女優として活動していた方（かた）で、悲しみとショックを受けているにゃ。", "活動していた方で", "活動していたかたで"),
        ("野球界に大きな影響を与えた方（かた）として敬意を表したいにゃ！", "影響を与えた方として", "影響を与えたかたとして"),
        ("AIモデルの事前学習に携わってきた方（かた）で、批判しましたにゃ。", "携わってきた方で", "携わってきたかたで"),
        ("そして猟師の方（かた）から狩猟を体験してみるようアドバイスを受けたんだにゃ。", "猟師の方から", "猟師のかたから"),
        ("朝は時間に余裕を持った行動をした方（ほう）がいいにゃ！", "した方がいい", "したほうがいい"),
        ("世論調査では民主党支持層の方（ほう）が投票意欲が高いことが示されているにゃ。", "支持層の方が", "支持層のほうが"),
    ]

    for text, exp_disp, exp_sp in kata_hou_tests:
        disp = re.sub(r'([\u4e00-\u9fff]{1,8})[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\1', text)
        disp = disp.replace("（", "").replace("）", "").replace("(", "").replace(")", "").strip()
        sp = re.sub(r'([\u4e00-\u9fff]{1,8})[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\2', text)
        items = [{"display": disp, "speech": sp}]
        healed = audit_and_heal_news_script(items, title="テスト", article_context="記事")
        
        assert exp_disp in healed[0]["display"], f"Fail disp: expected '{exp_disp}' in '{healed[0]['display']}'"
        assert exp_sp in healed[0]["speech"], f"Fail speech: expected '{exp_sp}' in '{healed[0]['speech']}'"
        print(f"  ✅ PASS: disp='{exp_disp}' / speech='{exp_sp}' ➔ OK")
    print("  ✅ 方（かた）/ 方（ほう）読み分けテスト全件合格！")

if __name__ == "__main__":
    test_honorifics()
    test_sumo_senshu()
    test_kata_hou()
    print("\n🎉🎉🎉 全テスト 100% 成功！ 🎉🎉🎉")
