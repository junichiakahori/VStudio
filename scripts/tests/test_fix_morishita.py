import sys
import os

from server.tts_normalizer import (
    normalize_for_tts,
    heal_sentence_reading,
    apply_pronunciation_memory
)

print("=== 1. 森下暢仁の読みテスト ===")
test_cases = [
    ("最大の注目は、床田寛樹投手、森下暢仁投手、坂倉将吾捕手にある。", "もりしたまさと"),
    ("森下暢仁選手がFA権を行使した。", "もりしたまさと"),
    ("暢仁投手の登板が決定した。", "まさと"),
]

for text, expected in test_cases:
    yomi = normalize_for_tts(text)
    print(f"入力: {text} ➔ 正規化後: {yomi}")
    assert expected in yomi, f"'{expected}' が含まれていません: {yomi}"
    assert "とおるじん" not in yomi, f"誤読 'とおるじん' が残っています: {yomi}"

print("\n=== 2. heal_sentence_reading（自己修復）テスト ===")
disp = "最大の注目は森下暢仁投手です"
sp = "さいだいのちゅうもくはもりしたとおるじんとうしゅです"
healed = heal_sentence_reading(disp, sp)
print(f"disp:   '{disp}'")
print(f"sp:     '{sp}'")
print(f"healed: '{healed}'")
assert "もりしたまさと" in healed, f"修復に失敗: {healed}"
assert "とおるじん" not in healed, f"誤読が残っています: {healed}"

print("\n🎉 森下暢仁（もりしたまさと）投手の誤読是正テストに合格しました！")
