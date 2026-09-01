import random
import json

normal_morning_subjects = ["朝ごはんは", "今日の予定は", "お天気は", "朝の空気って", "目覚まし時計は", "起きたばかりで"]
normal_morning_actions = ["ちゃんと食べた？", "なにかある？", "気持ちいいよねー", "鳴ったのに気づかなかったよ", "まだ眠いかも"]
normal_morning_endings = ["", "ふぁぁ……", "今日も頑張ろうね！", "早く支度しなきゃ！"]

phrases = []
for s in normal_morning_subjects:
    for a in normal_morning_actions:
        for e in normal_morning_endings:
            phrases.append(f"{s}{a}{e}")

print(f"Generated {len(phrases)} morning phrases")
