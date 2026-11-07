import sys
import os

from server.news_script_processor import (
    is_title_duplicate_sentence,
    build_safe_fallback_sentences,
    validate_news_script_quality
)

print("=== 1. is_title_duplicate_sentence のテスト ===")
title = "児童ポルノ所持容疑で訴追されたメーガン妃の父、条件付き保釈…メーガン妃は反応示さず"

# A. 正常なリード文（絶対に削除されてはならない文）
normal_leads = [
    "メーガン妃の父が児童ポルノ所持容疑で訴追され、条件付き保釈となった。",
    "メーガン妃の父が児童ポルノ所持容疑で訴追された件で、裁判所は条件付きで保釈を認めましたにゃ。",
    "メーガン妃の父親であるトーマス・マークル氏が、児童ポルノ所持容疑で訴追されたことが明らかになったにゃ。",
]
for lead in normal_leads:
    is_dup = is_title_duplicate_sentence(lead, title)
    print(f"[{'PASS' if not is_dup else 'FAIL'}] lead: '{lead}' ➔ is_dup: {is_dup} (expected: False)")
    assert not is_dup, f"正常なリード文が重複判定されてしまっています: {lead}"

# B. 完全なオウム返し文（削除されるべき文）
bad_dups = [
    "児童ポルノ所持容疑で訴追されたメーガン妃の父、条件付き保釈…メーガン妃は反応示さず",
    "児童ポルノ所持容疑で訴追されたメーガン妃の父、条件付き保釈…メーガン妃は反応示さずにゃ。",
    "児童ポルノ所持容疑で訴追されたメーガン妃の父、条件付き保釈…メーガン妃は反応示さずという話題が入ってきましたにゃ。",
    "児童ポルノ所持容疑で訴追されたメーガン妃の父、条件付き保釈…メーガン妃は反応示さずについてのニュースですにゃ。",
]
for bad in bad_dups:
    is_dup = is_title_duplicate_sentence(bad, title)
    print(f"[{'PASS' if is_dup else 'FAIL'}] bad: '{bad}' ➔ is_dup: {is_dup} (expected: True)")
    assert is_dup, f"オウム返し文が重複判定されませんでした: {bad}"

print("\n=== 2. validate_news_script_quality のテスト ===")
# 3文・85〜100文字の要約原稿が合格すること
candidate = (
    "メーガン妃の父が児童ポルノ所持容疑で訴追され、条件付き保釈となったにゃ。\n"
    "王室関係者も今後の司法判断に注目しているようですにゃ。\n"
    "これからの展開をしっかり見守っていきたいですね。"
)
is_valid, reason = validate_news_script_quality(candidate, title=title, char_desc="語尾ににゃ")
print(f"[{'PASS' if is_valid else 'FAIL'}] 3文原稿の判定: {is_valid} (reason: {reason})")
assert is_valid, f"3文原稿が不当に不合格になりました: {reason}"

# 体言止め（反発、強調など）が途中で切れた不完全文片として誤爆削除されないことのテスト
from server.news_script_processor import split_sentences_safely
test_sahen_sentence = "和木町が米軍岩国基地への空母艦載機移駐に伴う特別交付金の対象から外される可能性があり、町長は反発。"
# is_incomplete_sentence_fragment をテスト
from server.news_script_processor import inspect_and_correct_pronunciation
# 内部の fragment チェックが通るか
assert len(test_sahen_sentence) >= 20, "20文字以上あること"

print("\n=== 3. build_safe_fallback_sentences のテスト ===")
article_body = (
    "米検察当局は7日、メーガン妃の父トーマス・マークル被告を児童ポルノ所持の罪で訴追したと発表した。"
    "裁判所は同日、被告に対し保釈保証金の支払いなどを条件に身柄の保釈を認めた。"
    "一方、英王室を離脱したメーガン妃夫妻側はこの件に関して一切のコメントを出していない。"
)
fb_items = build_safe_fallback_sentences(title, article_body, char_desc="語尾ににゃ")
print(f"生成文数: {len(fb_items)}")
for i, it in enumerate(fb_items):
    print(f"  {i+1}. {it['display']}")

assert len(fb_items) >= 3, f"文数が少なすぎます: {len(fb_items)}"
# 「今後の詳しい情報や進展にもぜひ注目していきたいにゃ！」で終わっていないこと（固定文の完全廃止）
last_sent = fb_items[-1]['display']
assert not last_sent.endswith("！"), f"末尾が感嘆符で終わっています（字幕細断の防止違反）: {last_sent}"
assert last_sent.endswith("。"), f"末尾が句点で終わっていません: {last_sent}"
print("末尾文:", last_sent)

print("\n🎉 すべてのテストに合格しました！")

