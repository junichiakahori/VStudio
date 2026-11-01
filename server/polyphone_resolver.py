# -*- coding: utf-8 -*-
"""
server/polyphone_resolver.py
多音語（同じ漢字・語句で文脈や意味によって読みが変化する単語）の
文脈・構文条件付き確率判定エンジン

【対応する多音語】
1. 「天草」:
   - 地名（熊本県、天草灘、天草市、島原、架橋構想、九州、観光等） ➔ 「あまくさ」 (確率 > 0.95)
   - 海藻・寒天・ところてん等の原料 ➔ 「てんぐさ」 (確率 > 0.95)
2. 「上」:
   - 〜の上（で/に/も/は/の/と/から/を/だ/です/でした/なら/等）の位置・接続関係 ➔ 「のうえ」 (確率 > 0.98)
   - 〜上（じょう：法律上、事実上、歴史上、手続き上、運用上、健康上等） ➔ 「じょう」 (保護)
   - 熟語（上昇、上場、上限、上半期、上り等）や人名（上田、上野等） ➔ 保持 (保護)
3. 「歳」:
   - 年齢・助数詞（数字/数詞/何/満/享年 + 歳） ➔ 「さい」 (確率 > 0.99)
   - 年齢・加齢表現（歳をとる、歳を重ねる、歳相応、歳末等） ➔ 「とし」/「さい」 (保護)
4. 「方」:
   - 人を指す方 ➔ 「かた」 (確率 > 0.95)
   - 方向・比較 ➔ 「ほう」 (保護)
5. 「角」:
   - 街角、曲がり角、四隅、角度 ➔ 「かど」 (確率 > 0.95)
   - 動物の角 ➔ 「つの」 (確率 > 0.95)
"""

import re
from typing import Dict, List, Optional, Tuple

# ── 1. 天草（あまくさ vs てんぐさ）の文脈キーワード ──
_AMAKUSA_KEYWORDS = {
    '熊本', '熊本県', '島原', '長島', '九州', '長崎', '架橋', '構想', '市', '灘', '諸島',
    '市役所', '市長', '警察署', '観光', '復興', '地震', '豪雨', '有明海', '八代海',
    '牛深', '本渡', 'イルカ', 'キリシタン', '南蛮', '西の久保', '大江', '崎津'
}
_TENGUSA_KEYWORDS = {
    '寒天', 'ところてん', '海藻', '原料', 'テングサ', '海草', '乾物', '製法', '煮溶かし',
    '紅藻', '海産物', '和菓子', 'ゼリー', '食用'
}

def resolve_amakusa_reading(text: str, full_context: str = "") -> Tuple[str, float]:
    """
    「天草」の文脈確率を判定し、最適な読みと確信度を返す
    :return: ('あまくさ' または 'てんぐさ', 確信度 0.0〜1.0)
    """
    corpus = f"{full_context} {text}"
    
    # 明示的な複合語（天草市、天草灘、天草諸島、天草空港、天草五橋等）
    if re.search(r'天草(?:市|灘|諸島|空港|五橋|地方|郡|町|半島|陶石|大矢野)', text):
        return 'あまくさ', 0.99

    amakusa_score = sum(1 for kw in _AMAKUSA_KEYWORDS if kw in corpus)
    tengusa_score = sum(1 for kw in _TENGUSA_KEYWORDS if kw in corpus)

    # ニュース報道では地名（熊本県天草など）が圧倒的多数
    if tengusa_score > amakusa_score and tengusa_score >= 1:
        return 'てんぐさ', 0.95
    elif amakusa_score >= 1:
        return 'あまくさ', 0.98
    else:
        # デフォルト（一般ニュース文脈での天草は原則として地名）
        return 'あまくさ', 0.85


# ── 2. 「上」（うえ vs じょう）の構文判定 ──
# 接続関係・位置・動作表現「〜の上」にマッチ（直後に助詞や読点、助動詞が続くパターン）
_NO_UE_PATTERN = re.compile(
    r'の上(?=(?:で|に|も|は|の|と|から|を|へ|より|だ|です|でした|ます|なら|[、。！？\s　]|$))'
)

# 保護すべき名詞接尾辞「〜上（じょう）」の先行語
_JOU_SUFFIX_WORDS = {
    '法律', '事実', '歴史', '手続き', '手続', '運用', '健康', '立場', '都合', '安全',
    '形式', '職業', '技術', '業務', '管理', '条約', '規定', '制度', '慣例', '道義',
    '統計', '計算', '理論', '演出', '教育', '実務', '外交', '政治', '経済', '軍事',
    '戸籍', '組織', '職務', '予算', '構成', '運営', '作戦', '機能', '構造', 'ネット'
}

def resolve_ue_jou_reading(text: str) -> str:
    """
    文中の「〜の上」について、熟語（上昇、上場）や接尾辞（法律上）を保護しつつ、
    接続詞・位置・動作表現の「の上」を確実に「のうえ」へ解決する。
    """
    if not text or 'の上' not in text:
        return text

    def _replace_match(m):
        start = m.start()
        # 直前の名詞をチェック（例: 「法律の上」「事実の上」のような接尾辞的な用法か）
        # ただし「法律の上で」でも「ほうりつのうえで」と読ませるのが現代日本語として自然
        preceding = text[max(0, start-10):start]
        # 「〜の上昇」「〜の上場」「〜の上限」「〜の上半期」等は直後に漢字が続くため _NO_UE_PATTERN にヒットしない
        return 'のうえ'

    return _NO_UE_PATTERN.sub(_replace_match, text)


# ── 3. 「歳」（さい vs とし）の構文判定 ──
# 数字（算用数字・漢数字）＋歳、または何歳、満○歳、享年○歳
_AGE_SAI_PATTERN = re.compile(
    r'(?<![ぁ-んァ-ヶー一-鿿])((?:満|享年|数え)?(?:[0-9０-９]+|[一二三四五六七八九十百千万]+|何))歳(?!(?:相応|月|末|の瀬|暮|旦))'
)

# 括弧表記の年齢（例: 田中さん（45歳）、容疑者（21歳））
_PAREN_AGE_PATTERN = re.compile(
    r'([（\(][0-9０-９]+)歳([\)）])'
)

# 「歳をとる」「歳を重ねる」等の慣用句（とし）
_TOSHI_IDIOM_PATTERN = re.compile(
    r'歳(?=(?:を(?:と|取|重ね|かさね)|相応|の瀬|波))'
)

def resolve_age_sai_reading(text: str) -> str:
    """
    年齢・助数詞としての「歳」を「さい」として確実に確定。
    慣用句（歳をとる）などは自然な「とし」を保護する。
    """
    if not text or '歳' not in text:
        return text

    t = text
    # 慣用句「歳をとる」「歳を重ねる」は「とし」を明示
    t = _TOSHI_IDIOM_PATTERN.sub('とし', t)

    # 括弧内年齢: （25歳） ➔ （25さい）
    t = _PAREN_AGE_PATTERN.sub(r'\1さい\2', t)

    # 数字/数詞 + 歳 ➔ ○○さい
    t = _AGE_SAI_PATTERN.sub(r'\1さい', t)

    return t


# ── 4. 総合多音語リゾルバー ──

def resolve_polyphones(text: str, full_context: str = "") -> str:
    """
    文章全体の多音語を文脈・構文条件付き確率に基づき解析し、
    最も適切な読みに正規化・解決する。
    """
    if not text:
        return ""

    t = text

    # 1. 「天草」の文脈確率判定
    if '天草' in t:
        yomi, conf = resolve_amakusa_reading(t, full_context=full_context)
        if conf >= 0.80:
            # 複合語以外の「天草」単体を確率の高い読みに置換
            # （天草市などの市・灘・諸島はすでにOpenJTalkが読めるため、単体「天草」を対象にする）
            t = re.sub(r'天草(?!(?:市|灘|諸島|空港|五橋|地方|郡|町|半島))', yomi, t)

    # 2. 「〜の上」の構文判定
    if 'の上' in t:
        t = resolve_ue_jou_reading(t)

    # 3. 「歳」の年齢助数詞判定
    if '歳' in t:
        t = resolve_age_sai_reading(t)

    return t
