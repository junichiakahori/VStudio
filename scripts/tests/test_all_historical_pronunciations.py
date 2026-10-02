#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/tests/test_all_historical_pronunciations.py
==================================================
【VStudio 永続品質保証】全歴史的誤読・デグレ防止 総合回帰テストスイート
過去に発生したすべての誤読事例・破綻表現をテストケース化し、
パイプライン（normalize_for_tts ➔ audit_and_heal_news_script ➔ VOICEVOX発音）を通した
完全な回帰防止（モグラ叩き撲滅）を100%自動検証する。

カテゴリ:
  1. 「方」関連（上方漫才/上方落語 vs 上方修正、人名+さんの方化防止、方々、用法）
  2. 多音語・文脈依存語（中日、大雨、米、行方 等）
  3. 大相撲・スポーツ敬称（力士への選手付け防止 等）
  4. 助詞孤立さんたち・組織/モノへの敬称防止
  5. 英語・アルファベット・グループ名
  6. 助詞融合・固有名詞全文照合
"""

import os
import sys
import re

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(CURRENT_DIR))
sys.path.insert(0, BASE_DIR)

from server.tts_normalizer import normalize_for_tts
from server.news_script_processor import audit_and_heal_news_script, audit_and_heal_via_voicevox_full_reading
from server.voicevox_client import get_voicevox_reading_and_kana


def clean_voicevox_kana(kana_str: str) -> str:
    """VOICEVOXのアクセント句境界（/）、モーラアクセント記号（'）、無声化記号（_）等を除去して純粋なカタカナ列にする"""
    if not kana_str:
        return ""
    # アクセント記号、境界記号、空白、読点を除去
    return re.sub(r"['/_^\s　、。・]", "", kana_str)


# ══════════════════════════════════════════════════════════════════════════
# テストケース定義
# ══════════════════════════════════════════════════════════════════════════

TEST_CATEGORIES = [
    {
        "category": "1. 「方」関連の多音語・敬称・用法（上方、人名+さん、方々、接続詞）",
        "cases": [
            {
                "id": "kata_kamigata_manzai",
                "desc": "「上方漫才」は「カミガタマンザイ」と正しく発音されること（じょうほう漫才にならない）",
                "text": "伝統的な上方漫才が披露され、会場は大きな笑いに包まれましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"カミガタマンザイ",
                "forbidden_kana_pattern": r"ジョオホオマンザイ",
            },
            {
                "id": "kata_kamigata_rakugo",
                "desc": "「上方落語」は「カミガタラクゴ」と正しく発音されること",
                "text": "上方落語界の重鎮が出演しましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"カミガタラクゴ",
                "forbidden_kana_pattern": r"ジョオホオラクゴ",
            },
            {
                "id": "kata_jyoho_shusei",
                "desc": "「上方修正」は「ジョウホウシュウセイ」と発音され、「かみがた修正」に破壊されないこと",
                "text": "米国のGDP確定値が予想外に上方修正され、好感されましたにゃ。",
                "check_type": "both",
                "expected_speech_pattern": r"上方修正",
                "forbidden_speech_pattern": r"かみがた修正",
                "expected_kana_pattern": r"ジョオホオシュウセエ",
                "forbidden_kana_pattern": r"カミガタシュウセエ",
            },
            {
                "id": "kata_ito_shiro_san",
                "desc": "伊東四朗さんの「さん」が「方」に化けないこと",
                "text": "伊東四朗さんが芸能活動引退を発表しましたにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"伊東四朗さん|いとうしろうさん",
                "forbidden_pattern": r"伊東四朗方|いとうしろう方",
            },
            {
                "id": "kata_hanyu_yuzuru_san",
                "desc": "羽生結弦さんの「さん」が「方」に化けないこと（プーさんも維持）",
                "text": "羽生結弦さんとくまのプーさんとのコラボ商品が発表されましたにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"(?:羽生結弦|はにゅうゆづる)さんと.*プーさん",
                "forbidden_pattern": r"(?:羽生|はにゅう).*?方",
            },
            {
                "id": "kata_sono_yoshida_san",
                "desc": "曽野舜太さんと吉田仁人さんの「さん」が「方」に化けないこと",
                "text": "曽野舜太さんと吉田仁人さんが新イメージキャラクターに就任したにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"(?:曽野舜太|そのしゅんた)さんと(?:吉田仁人|よしだじんと)さん",
                "forbidden_pattern": r"(?:そのしゅんた|よしだじんと)方",
            },
            {
                "id": "kata_ninomiya_san",
                "desc": "二宮和也さんの「さん」が「方」に化けないこと",
                "text": "山田孝之さんと二宮和也さんが出演することが発表されたにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"(?:二宮和也|にのみやかずなり)さん",
                "forbidden_pattern": r"(?:二宮和也|にのみやかずなり)方",
            },
            {
                "id": "kata_katagata_people",
                "desc": "人を指す「方々」は音声用テキストで「かた々」に自己修復されること",
                "text": "被災者の方々や避難生活を送る方々に寄り添う支援が求められますにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"被災者のかた々.*送るかた々",
                "forbidden_pattern": r"被災者のほうぼう",
            },
            {
                "id": "kata_many_people",
                "desc": "「多くの方」は「多くのかた」に自己修復されること",
                "text": "多くの方に届いてほしいと話していましたにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"多くのかたに",
                "forbidden_pattern": r"おおくのほうに",
            },
            {
                "id": "kata_ippo_direction",
                "desc": "接続詞「一方で」「あり方はある」などの比較・方針・方向が誤変換されないこと",
                "text": "一方で、様々な連携のあり方はあると述べましたにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"一方で.*あり方はある",
                "forbidden_pattern": r"いっかたで|ありほうはある",
            },
            {
                "id": "kata_tsukaikata",
                "desc": "「使い方」「見方」などの複合語が誤変換されないこと",
                "text": "スマートフォンの使い方や物事の見方について解説したにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"使い方.*見方",
                "forbidden_pattern": r"つかいほう|みほう",
            },
        ]
    },
    {
        "category": "2. 多音語・文脈依存語（中日、大雨、米、行方）",
        "cases": [
            {
                "id": "heteronym_chunichi_dragons",
                "desc": "「中日ドラゴンズ」「中日新聞」は「ちゅうにち」と読まれること（なかび誤爆防止）",
                "text": "中日ドラゴンズの試合結果と中日新聞の報道をお伝えしますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"チュウニチ.*チュウニチ",
                "forbidden_kana_pattern": r"ナカビ",
            },
            {
                "id": "heteronym_ooame",
                "desc": "「大雨警報」は「オオアメ」と読まれること（おおう、タイウ防止）",
                "text": "各地で大雨警報が発表され、大雨による浸水に警戒が必要ですにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"オオアメ.*オオアメ",
                "forbidden_kana_pattern": r"オオウ|タイウ",
            },
            {
                "id": "heteronym_bei_president",
                "desc": "「訪米」「日米」は「ホウベイ」「ニチベイ」と読まれること",
                "text": "訪米中の首相が日米首脳会談を行いましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ホオベエ.*ニチベエ",
                "forbidden_kana_pattern": r"ホオマイ|ニチマイ",
            },
            {
                "id": "heteronym_kome_rice",
                "desc": "「白米」「新米」「米を研ぐ」は「マイ/コメ」と読まれること（ベイ防止）",
                "text": "美味しい白米と今年の新米のコメを食べましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ハクマイ.*シンマイ.*コメ",
                "forbidden_kana_pattern": r"ハクベイ|シンベイ",
            },
            {
                "id": "heteronym_yukue",
                "desc": "「行方不明」「行方」は「ユクエ」と読まれること（ぎょうほう防止）",
                "text": "行方不明者の捜索が続き、今後の行方が注目されますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ユクエフメエ.*ユクエ",
                "forbidden_kana_pattern": r"ギョオホオ",
            },
        ]
    },
    {
        "category": "3. 大相撲・スポーツ敬称（力士への選手誤爆防止）",
        "cases": [
            {
                "id": "sumo_ononogato_no_senshu",
                "desc": "大相撲の力士（大の里、豊昇龍、琴桜）に「選手」を付けないこと",
                "text": "大相撲秋場所で大の里と豊昇龍が白星を挙げましたにゃ。",
                "category_name": "スポーツ",
                "check_type": "speech_text",
                "expected_pattern": r"大の里|おおのさと",
                "forbidden_pattern": r"大の里選手|おおのさと選手|豊昇龍選手",
            },
            {
                "id": "sports_senshu_maintained",
                "desc": "野球やクライミング等の一般スポーツ選手は「選手」が正しく維持されること",
                "text": "大谷翔平選手がホームランを放ち、野中生萌選手が2位に入りましたにゃ。",
                "category_name": "スポーツ",
                "check_type": "speech_text",
                "expected_pattern": r"(?:大谷翔平|おおたにしょうへい)選手.*(?:野中生萌|のなかみほう)選手",
                "forbidden_pattern": r"大谷翔平さん|野中生萌さん",
            },
            {
                "id": "horse_riding_jyosha_repair",
                "desc": "競馬記事で馬に乗る行為が「乗車」と誤用された場合に「騎乗」へ自己修復されること",
                "text": "武豊騎手は凱旋門賞挑戦のメイショウタバルに乗車し、最終追い切りを行いましたにゃ。",
                "category_name": "スポーツ",
                "check_type": "both",
                "expected_speech_pattern": r"メイショウタバルに(?:騎乗|きじょう)し",
                "forbidden_speech_pattern": r"乗車|じょうしゃ",
                "expected_kana_pattern": r"キジョオシ|キジョウシ",
                "forbidden_kana_pattern": r"ジョオシャ|ジョウシャ",
            },
        ]
    },
    {
        "category": "4. 助詞孤立さんたち・組織/モノへの敬称防止",
        "cases": [
            {
                "id": "isolated_santachi_sports",
                "desc": "スポーツ記事で助詞直後に孤立した「さんたち」が「選手たち」に救済されること",
                "text": "チームのさんたちの活躍が光りましたにゃ。",
                "category_name": "スポーツ",
                "check_type": "speech_text",
                "expected_pattern": r"チームの選手たち",
                "forbidden_pattern": r"チームのさんたち",
            },
            {
                "id": "isolated_santachi_general",
                "desc": "一般記事で助詞直後に孤立した「さんたち」が「皆さん」に救済されること",
                "text": "会場のさんたちから温かい拍手が送られましたにゃ。",
                "category_name": "エンタメ",
                "check_type": "speech_text",
                "expected_pattern": r"会場の皆さん|会場の方たち",
                "forbidden_pattern": r"会場のさんたち|会場の選手たち",
            },
            {
                "id": "corporate_san_removal",
                "desc": "任天堂社などの企業・組織・モノに「さん」を付けないこと",
                "text": "任天堂社さんが新製品を発表し、AIロボットさんが稼働しましたにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"任天堂社が.*(?:AI|エーアイ)ロボットが",
                "forbidden_pattern": r"任天堂社さん|AIロボットさん|エーアイロボットさん",
            },
        ]
    },
    {
        "category": "5. 英語・アルファベット・グループ名",
        "cases": [
            {
                "id": "english_the_spellout",
                "desc": "「THE」が「ティー・エイチ・イー」にスペルアウトされず「The/ザ/ジ」になること",
                "text": "映画THE FIRST SLAM DUNKが公開されましたにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"ざふぁーすと|The First|ザ|ジ",
                "forbidden_pattern": r"THE|ティーエイチイー",
            },
            {
                "id": "group_milk",
                "desc": "「M!LK」が「みるく」と正しく発音されること",
                "text": "人気グループM!LKの新曲がリリースされましたにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"みるく|ミルク",
                "forbidden_pattern": r"M!LK|エムびっくりエルケー",
            },
            {
                "id": "group_sixtones",
                "desc": "「SixTONES」が「ストーンズ」と発音されること（シックス・トーンズ防止）",
                "text": "SixTONESの全国ツアーが決定しましたにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"ストーンズ",
                "forbidden_pattern": r"SixTONES|シックストーンズ",
            },
            {
                "id": "tech_iphone",
                "desc": "「iPhone」が「アイフォン」と正しく発音されること",
                "text": "新型iPhoneが発売されましたにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"アイフォン|アイフォーン",
                "forbidden_pattern": r"iPhone",
            },
            {
                "id": "english_west_show",
                "desc": "「WEST」「SHOW」がアルファベットスペル読みされず「ウエスト」「ショー」と発音されること",
                "text": "人気グループWESTの最新情報とTOKYO FASHION SHOWの様子をお届けしますにゃ。",
                "check_type": "both",
                "expected_speech_pattern": r"ウエスト.*(?:Fashion|ファッション).*(?:Show|ショー)",
                "forbidden_speech_pattern": r"WEST|SHOW|FASHION",
                "expected_kana_pattern": r"(?:ウエ_スト|ウエスト).*(?:ショオ|ショ'オ)",
                "forbidden_kana_pattern": r"ダブリュウ|エフエエエス|エスエイチ",
            },
            {
                "id": "spurious_putin_min_cleanup",
                "desc": "要人肩書直後の不要な英語ゴミ（プーチン大統領min）が綺麗に除去されること",
                "text": "プーチン大統領minが今後の外交方針を発表しましたにゃ。",
                "check_type": "both",
                "expected_speech_pattern": r"プーチン大統領が",
                "forbidden_speech_pattern": r"min",
                "expected_kana_pattern": r"プウチン\s*ダイトオリョオガ",
                "forbidden_kana_pattern": r"ミン|エムアイエヌ",
            },
            {
                "id": "time_unit_min_sec_repair",
                "desc": "英字時間単位（15min, 30sec）が「分」「秒」へ自然に日本語化されること",
                "text": "所要時間は約15minで、残り時間は30secですにゃ。",
                "check_type": "both",
                "expected_speech_pattern": r"15分.*30秒",
                "forbidden_speech_pattern": r"min|sec",
                "expected_kana_pattern": r"ジュウ\s*ゴフン.*サンジュウビョオ",
                "forbidden_kana_pattern": r"ミン|エスイーシー",
            },
        ]
    },
    {
        "category": "6. 助詞融合・固有名詞全文照合",
        "cases": [
            {
                "id": "fusion_oguri_shun",
                "desc": "「に小栗旬」で助詞が人名に融合せず「おぐりしゅん」と読まれること（ササグリシュン防止）",
                "text": "ゲストに小栗旬さんが登場しましたにゃ。",
                "known_terms": {"小栗旬": "おぐりしゅん"},
                "check_type": "voicevox_full_heal",
                "expected_pattern": r"おぐりしゅん|オグリシュン",
                "forbidden_pattern": r"ササグリ",
            },
            {
                "id": "fusion_tezuka",
                "desc": "「手塚」が「てづか」と読まれること（てずか濁音揺らぎ防止）",
                "text": "手塚さんの作品を振り返りますにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"手塚|てづか",
                "forbidden_pattern": r"てずか",
            },
        ]
    },
    {
        "category": "7. 著名人・外国要人・作品・テクノロジー固有名詞（宝鐘マリン、趣里、ベッセント、VIVANT、NTT）",
        "cases": [
            {
                "id": "proper_houshou_marine",
                "desc": "「宝鐘マリン」が「ホオショウマリン」と正しく発音されること（たからかねまりん防止）",
                "text": "宝鐘マリンさんの最新生配信が話題になっているにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ホオショウマリン|ホウショウマリン",
                "forbidden_kana_pattern": r"タカラカネ|タカラガネ",
            },
            {
                "id": "proper_shuri",
                "desc": "「趣里」が「シュリ」と正しく発音されること（おもむきさと防止）",
                "text": "女優の趣里さんが主演を務める新作映画が公開されたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"シュリ",
                "forbidden_kana_pattern": r"オモムキサト",
            },
            {
                "id": "proper_bessent_treasury",
                "desc": "「ベッセント米財務長官」が「ベッセントベイザイムチョウカン」と発音されること（まい財務長官防止）",
                "text": "ベッセント米財務長官が新たな経済政策について言及しましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ベッセントベ[エ|イ]ザイムチョ",
                "forbidden_kana_pattern": r"マイザイムチョ",
            },
            {
                "id": "proper_vivant",
                "desc": "「VIVANT」が「ヴィヴァン」と発音されること（ぶいあいぶいえーえぬてぃ防止）",
                "text": "大ヒットドラマVIVANTの続編が期待されていますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ビバン|ヴィヴァン",
                "forbidden_kana_pattern": r"ブイアイブイ",
            },
            {
                "id": "tech_ntt",
                "desc": "「NTT」が「エヌティーティー」と明瞭に発音されること（早口・短音エヌティティ防止）",
                "text": "NTTが次世代通信基盤の実験に成功したにゃ。",
                "check_type": "both",
                "expected_speech_pattern": r"エヌティーティー",
                "forbidden_speech_pattern": r"(?<![A-Za-z0-9])NTT(?![A-Za-z0-9])",
                "expected_kana_pattern": r"エヌティイティイ",
                "forbidden_kana_pattern": r"エヌティティ",
            },
            {
                "id": "proper_hanyu_yuzuru_figure",
                "desc": "「羽生結弦選手」が「ハニュウユズルセンシュ」と正しく発音されること（ハブ防止）",
                "text": "羽生結弦選手がアイスショーで素晴らしい演技を披露しましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ハニュウユズルセンシュ|ハニュウセンシュ",
                "forbidden_kana_pattern": r"ハブユズル|ハブセンシュ",
            },
            {
                "id": "proper_hanyu_single_figure",
                "desc": "フィギュアスケート文脈での単独「羽生選手」が「ハニュウセンシュ」と正しく発音されること（ハブ防止）",
                "text": "フィギュアスケートの羽生選手が新たな挑戦について語りましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ハニュウセンシュ",
                "forbidden_kana_pattern": r"ハブセンシュ",
            },
            {
                "id": "proper_habu_yoshiharu_shogi",
                "desc": "「羽生善治九段」が「ハブヨシハル」と正しく発音されること（ハニュウ防止）",
                "text": "羽生善治九段が竜王戦の対局に臨みましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ハブヨシハル|ハ'ブクダン",
                "forbidden_kana_pattern": r"ハニュウヨシハル",
            },
            {
                "id": "proper_habu_single_shogi",
                "desc": "将棋文脈での単独「羽生九段」が「ハブクダン」と正しく発音されること（ハニュウ防止）",
                "text": "将棋の公式戦で羽生九段が勝利を収めましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ハブクダン|ハ'ブクダン",
                "forbidden_kana_pattern": r"ハニュウクダン",
            },
            {
                "id": "proper_putin_russia_president",
                "desc": "「プーチン露大統領」「露政権」が「ろだいとうりょう」「ろせいけん」と正しく発音されること（つゆ防止）",
                "text": "プーチン露大統領と露政権が今後の対外政策を発表しましたにゃ。",
                "check_type": "both",
                "expected_speech_pattern": r"プーチン.*(?:露大統領|ろだいとうりょう|ロシア大統領).*(?:露政権|ろせいけん|ロシア政権)",
                "forbidden_speech_pattern": r"つゆ大統領|つゆ政権",
                "expected_kana_pattern": r"プウチン.*(?:ロ|ロシア)ダイトオリョオ.*(?:ロ|ロシア)セエケン",
                "forbidden_kana_pattern": r"ツユ",
            },
        ]
    },
    {
        "category": "8. 口調・語尾破損修復（〜されにゃ、〜しにゃ、〜さにゃ、見えにゃ、にゃにゃ重複、出さにゃ）",
        "cases": [
            {
                "id": "tone_sare_nya_repair",
                "desc": "「〜されにゃ」の「た」抜けが「〜されたにゃ」へ修復されること",
                "text": "新曲の発売が正式に発表されにゃ！",
                "check_type": "speech_text",
                "expected_pattern": r"発表されたにゃ",
                "forbidden_pattern": r"発表されにゃ",
            },
            {
                "id": "tone_shi_nya_repair",
                "desc": "「〜しにゃ」の「た」抜けが「〜したにゃ」へ修復されること",
                "text": "運営チームが新しい方針を決定しにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"決定したにゃ",
                "forbidden_pattern": r"決定しにゃ",
            },
            {
                "id": "tone_sa_nya_repair",
                "desc": "「〜さにゃ」の不要な「さ」が除去されて「〜にゃ」へ修復されること",
                "text": "それは本当ださにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"本当だにゃ",
                "forbidden_pattern": r"ださにゃ",
            },
            {
                "id": "tone_mie_nya_repair",
                "desc": "「見えにゃ」の「た」抜けが「見えたにゃ」へ修復されること",
                "text": "ステージの上に素敵な未来が見えにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"見えたにゃ",
                "forbidden_pattern": r"見えにゃ",
            },
            {
                "id": "tone_nya_nya_duplicate_repair",
                "desc": "「〜にゃにゃ」の重複が「〜にゃ」へ修復されること",
                "text": "今日もいいお天気だにゃにゃ！",
                "check_type": "speech_text",
                "expected_pattern": r"お天気だにゃ！",
                "forbidden_pattern": r"にゃにゃ",
            },
            {
                "id": "tone_desa_nya_repair",
                "desc": "「出さにゃ」が「出たにゃ」へ修復されること",
                "text": "ついに素晴らしい結果が出さにゃ！",
                "check_type": "speech_text",
                "expected_pattern": r"結果が出たにゃ",
                "forbidden_pattern": r"出さにゃ",
            },
        ]
    }
]


# ══════════════════════════════════════════════════════════════════════════
# テストランナー
# ══════════════════════════════════════════════════════════════════════════

def run_all_historical_regression_tests():
    total_cases = sum(len(cat["cases"]) for cat in TEST_CATEGORIES)
    print("=" * 75)
    print(f"🚀 VStudio 全歴史的誤読 回帰防止総合テストスイート（全 {total_cases} ケース）")
    print("=" * 75)

    passed_total = 0
    failed_total = 0
    failures = []

    for cat in TEST_CATEGORIES:
        cat_name = cat["category"]
        cases = cat["cases"]
        print(f"\n📁 【{cat_name}】 (計 {len(cases)} 件)")
        print("-" * 75)

        for case in cases:
            c_id = case["id"]
            desc = case["desc"]
            raw_text = case["text"]
            cat_name_input = case.get("category_name", "")
            check_type = case["check_type"]
            known_terms = case.get("known_terms", None)

            # ── 本番完全パイプライン実行 ──
            # Step 1: normalize_for_tts（略語・グループ名・英字等）
            norm_text = normalize_for_tts(raw_text)

            # Step 2: audit_and_heal_news_script（敬称・方言・文脈修復等）
            items = [{"display": raw_text, "speech": norm_text}]
            healed = audit_and_heal_news_script(
                items, title=raw_text, article_context=raw_text, category_name=cat_name_input
            )
            speech_text = healed[0]["speech"]

            # Step 2.5: VOICEVOX 全文照合（助詞融合救済テストの場合）
            if check_type == "voicevox_full_heal":
                healed_vv = audit_and_heal_via_voicevox_full_reading(
                    healed, title=raw_text, known_terms_map=known_terms
                )
                speech_text = healed_vv[0]["speech"]

            # Step 3: VOICEVOX 発音生成（音声カナ判定の場合）
            vv_raw_kana = ""
            vv_clean_kana = ""
            if check_type in ("voicevox_kana", "both", "voicevox_full_heal"):
                _, vv_raw_kana = get_voicevox_reading_and_kana(speech_text)
                vv_clean_kana = clean_voicevox_kana(vv_raw_kana)

            is_ok = True
            err_msg = ""

            # ── 検証判定 ──
            if check_type in ("speech_text", "both"):
                exp_pat = case.get("expected_speech_pattern") or case.get("expected_pattern", "")
                forb_pat = case.get("forbidden_speech_pattern") or case.get("forbidden_pattern", "")
                if exp_pat and not re.search(exp_pat, speech_text):
                    is_ok = False
                    err_msg = f"期待テキスト '{exp_pat}' が speech_text ('{speech_text}') に見つかりません"
                elif forb_pat and re.search(forb_pat, speech_text):
                    is_ok = False
                    err_msg = f"禁止テキスト '{forb_pat}' が speech_text ('{speech_text}') に含まれています"

            if is_ok and check_type in ("voicevox_kana", "both"):
                exp_k_pat = case.get("expected_kana_pattern") or case.get("expected_pattern", "")
                forb_k_pat = case.get("forbidden_kana_pattern") or case.get("forbidden_pattern", "")
                if exp_k_pat and not re.search(exp_k_pat, vv_clean_kana):
                    is_ok = False
                    err_msg = f"期待カナ '{exp_k_pat}' が VOICEVOXカナ ('{vv_clean_kana}') に見つかりません"
                elif forb_k_pat and re.search(forb_k_pat, vv_clean_kana):
                    is_ok = False
                    err_msg = f"禁止カナ '{forb_k_pat}' が VOICEVOXカナ ('{vv_clean_kana}') に含まれています"

            if is_ok and check_type == "voicevox_full_heal":
                exp_f_pat = case.get("expected_pattern", "")
                forb_f_pat = case.get("forbidden_pattern", "")
                target_check = speech_text + " " + vv_clean_kana
                if exp_f_pat and not re.search(exp_f_pat, target_check):
                    is_ok = False
                    err_msg = f"期待パターン '{exp_f_pat}' が修復結果 ('{target_check}') に見つかりません"
                elif forb_f_pat and re.search(forb_f_pat, target_check):
                    is_ok = False
                    err_msg = f"禁止パターン '{forb_f_pat}' が修復結果 ('{target_check}') に含まれています"

            if is_ok:
                passed_total += 1
                print(f"  ✅ PASS: [{c_id}] {desc}")
            else:
                failed_total += 1
                print(f"  ❌ FAIL: [{c_id}] {desc}")
                print(f"     入力: {raw_text}")
                print(f"     正規化後テキスト: {speech_text}")
                if vv_clean_kana:
                    print(f"     VOICEVOXクリーンカナ: {vv_clean_kana}")
                print(f"     理由: {err_msg}")
                failures.append((c_id, desc, err_msg))

    print("\n" + "=" * 75)
    print(f"🎯 総合結果: 全 {total_cases} ケース | 成功: {passed_total} | 失敗: {failed_total}")
    print("=" * 75)

    if failures:
        print("\n💥 以下のケースで失敗が検出されました:")
        for fid, fdesc, ferr in failures:
            print(f"  - [{fid}] {fdesc} ➔ {ferr}")
        return 1

    print("\n🎉 すべての歴史的誤読ケースが正常にパスしました！デグレ・モグラ叩きは完全に防止されています。")
    return 0


if __name__ == "__main__":
    exit_code = run_all_historical_regression_tests()
    sys.exit(exit_code)
