import sys
import os

from server.tts_normalizer import (
    normalize_for_tts,
    heal_sentence_reading,
    apply_pronunciation_memory
)

print("=== 1. normalize_for_tts テスト ===")
test_cases = [
    ("防波堤で釣り人が海に転落したにゃ。", "つりびと"),
    ("現場には多くの釣り人が集まっていたにゃ。", "つりびと"),
    ("釣人が救助されたにゃ。", "つりびと"),
]

for text, expected in test_cases:
    yomi = normalize_for_tts(text)
    print(f"入力: {text} ➔ 正規化後: {yomi}")
    assert expected in yomi, f"'{expected}' が含まれていません: {yomi}"
    assert "つりじん" not in yomi, f"誤読 'つりじん' が残っています: {yomi}"

print("\n=== 2. heal_sentence_reading（台帳照合自己修復）テスト ===")
disp = "防波堤で釣り人が転落した"
sp = "ぼうはていでつりじんがてんらくした"
healed = heal_sentence_reading(disp, sp)
print(f"disp:   '{disp}'")
print(f"sp:     '{sp}'")
print(f"healed: '{healed}'")
assert "つりびと" in healed, f"誤読 'つりじん' が 'つりびと' に修復されていません: {healed}"
assert "つりじん" not in healed, f"誤読 'つりじん' が残っています: {healed}"

print("\n=== 3. apply_pronunciation_memory テスト ===")
res1 = apply_pronunciation_memory("釣り人がいた")
print(f"apply_pronunciation_memory('釣り人がいた') ➔ '{res1}'")
assert "つりびと" in res1

res2 = apply_pronunciation_memory("釣人がいた")
print(f"apply_pronunciation_memory('釣人がいた') ➔ '{res2}'")
assert "つりびと" in res2

print("\n🎉 「釣り人」「釣人」➔「つりびと」の全てのテストに合格しました！")
