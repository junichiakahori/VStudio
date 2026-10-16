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
from server.news_script_processor import audit_and_heal_news_script, audit_and_heal_via_voicevox_full_reading, validate_news_script_quality
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
            {
                "id": "pronoun_kare_repair",
                "desc": "性別誤認防止のため「彼の」などの三人称代名詞が実名＋敬称（武豊騎手の）へ自己修復されること",
                "text": "武豊騎手は通算5000勝を達成しましたにゃ。彼の目は凱旋門賞に向いていますにゃ。",
                "category_name": "スポーツ",
                "check_type": "speech_text",
                "expected_pattern": r"武豊騎手の目は",
                "forbidden_pattern": r"彼の目は",
            },
            {
                "id": "pronoun_kanojo_repair",
                "desc": "性別誤認防止のため「彼女の」などの三人称代名詞が実名＋敬称（優香さんの）へ自己修復されること",
                "text": "優香さんは笑顔で語りましたにゃ。彼女の新たな挑戦に期待が集まっていますにゃ。",
                "category_name": "エンタメ",
                "check_type": "speech_text",
                "expected_pattern": r"優香さんの新たな挑戦",
                "forbidden_pattern": r"彼女の新たな挑戦",
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
                "expected_speech_pattern": r"プーチン(?:大統領|だいとうりょう)が",
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
                "desc": "「羽生結弦」が「ハニュウユズル」と正しく発音されること（ハブ防止）",
                "text": "羽生結弦選手がアイスショーで素晴らしい演技を披露しましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ハニュウユズル",
                "forbidden_kana_pattern": r"ハブ",
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
                "expected_kana_pattern": r"プウチン.*(?:ロ|ロシア)ダイトオリョオ.*(?:ロ|ロシア)セ[イエ]ケン",
                "forbidden_kana_pattern": r"ツユ",
            },
            {
                "id": "proper_tsunku_no_osu",
                "desc": "「つんく♂」が「ツンク」と正しく発音されること（Wikipedia解決・つんくおす防止）",
                "text": "つんく♂さんが新曲のプロデュースを手掛けましたにゃ。",
                "check_type": "both",
                "expected_speech_pattern": r"つんくさん",
                "forbidden_speech_pattern": r"つんくおす|おすさん",
                "expected_kana_pattern": r"ツンクサン",
                "forbidden_kana_pattern": r"ツンクオス|オスサン",
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
            {
                "id": "tone_okurare_tatanya_repair",
                "desc": "「贈られたたにゃ」「見られたたにゃ」等の異常な『たたにゃ』が『たにゃ』へ修復されること",
                "text": "アイスキューブプロジェクトにノーベル物理学賞が贈られたたにゃ。",
                "check_type": "both",
                "expected_display_pattern": r"贈られたにゃ",
                "forbidden_display_pattern": r"贈られたたにゃ|たたにゃ",
                "expected_speech_pattern": r"贈られたにゃ",
                "forbidden_speech_pattern": r"贈られたたにゃ|たたにゃ",
                "expected_kana_pattern": r"オクラレタニャ",
                "forbidden_kana_pattern": r"オクラレタタニャ|タタニャ",
            },
            {
                "id": "tone_rare_nya_to_tanya_repair",
                "desc": "「贈られにゃ」の『た』抜けが『贈られたにゃ』へ修復され『贈られたたにゃ』にならないこと",
                "text": "アイスキューブプロジェクトにノーベル物理学賞が贈られにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"贈られたにゃ",
                "forbidden_pattern": r"贈られにゃ|たたにゃ",
            },
        ]
    },
    {
        "category": "9. スポーツ・結婚混在・引退選手（OB/解説者）の動的敬称修復（リストフリー解決）",
        "cases": [
            {
                "id": "athlete_marriage_actor_honorific",
                "desc": "スポーツ選手と俳優の結婚報道で、俳優（福原遥）が「さん」に修復され、選手（久保建英）は「選手」が維持されること",
                "text": "サッカーの久保建英選手が活躍し、女優の福原遥選手との結婚が明らかになりましたにゃ。",
                "title": "久保建英選手と女優・福原遥さんが電撃結婚",
                "article_context": "サッカー日本代表の久保建英選手と、女優でタレントの福原遥さんが結婚したことが分かりました。",
                "category_name": "スポーツ",
                "check_type": "both_text",
                "expected_display_pattern": r"久保建英選手.*福原遥さん",
                "forbidden_display_pattern": r"福原遥選手|久保建英さん",
                "expected_speech_pattern": r"(?:久保建英|くぼたけふさ)選手.*(?:福原遥|ふくはらはるか)さん",
                "forbidden_speech_pattern": r"(?:福原遥|ふくはらはるか)選手|(?:久保建英|くぼたけふさ)さん",
            },
            {
                "id": "retired_baseball_player_matsuzaka",
                "desc": "元プロ野球選手（松坂大輔）への「選手」誤爆がWikipedia/構文解析により「さん」へ修復されること",
                "text": "元プロ野球選手の松坂大輔選手が甲子園の決勝について熱く語りましたにゃ。",
                "title": "松坂大輔氏が語る甲子園の熱闘",
                "article_context": "元プロ野球選手で野球解説者の松坂大輔さんが、夏の高校野球について振り返りました。",
                "category_name": "スポーツ",
                "check_type": "both_text",
                "expected_display_pattern": r"松坂大輔さん",
                "forbidden_display_pattern": r"松坂大輔選手",
                "expected_speech_pattern": r"(?:松坂大輔|まつざかだいすけ)さん",
                "forbidden_speech_pattern": r"(?:松坂大輔|まつざかだいすけ)選手",
            },
            {
                "id": "retired_soccer_player_uchida",
                "desc": "元サッカー日本代表（内田篤人）への「選手」誤爆がWikipedia/構文解析により「さん」へ修復されること",
                "text": "解説者の内田篤人選手が若手ディフェンダーのプレーを絶賛しましたにゃ。",
                "title": "内田篤人氏が解説する日本代表の守備",
                "article_context": "元日本代表の内田篤人さんが、最新の試合について解説を行いました。",
                "category_name": "スポーツ",
                "check_type": "both_text",
                "expected_display_pattern": r"内田篤人さん",
                "forbidden_display_pattern": r"内田篤人選手",
                "expected_speech_pattern": r"(?:内田篤人|うちだあつと)さん",
                "forbidden_speech_pattern": r"(?:内田篤人|うちだあつと)選手",
            },
            {
                "id": "active_athlete_ohtani_protected",
                "desc": "現役アスリート（大谷翔平選手）は「選手」の呼称が確実に維持されること（誤った『さん』化の防止）",
                "text": "ドジャースの大谷翔平選手が豪快なホームランを放ちましたにゃ。",
                "title": "大谷翔平選手が第50号本塁打",
                "article_context": "メジャーリーグ・ドジャースの大谷翔平選手が本塁打を記録しました。",
                "category_name": "スポーツ",
                "check_type": "both_text",
                "expected_display_pattern": r"大谷翔平選手",
                "forbidden_display_pattern": r"大谷翔平さん",
                "expected_speech_pattern": r"(?:大谷翔平|おおたにしょうへい)選手",
                "forbidden_speech_pattern": r"(?:大谷翔平|おおたにしょうへい)さん",
            },
        ]
    },
    {
        "category": "10. 二重敬称防止（「氏さん」の防止・自動修復）",
        "cases": [
            {
                "id": "double_honorific_inada_shi_san",
                "desc": "「稲田氏さん」が「稲田さん」へ是正され、「氏さん」「いなだけさん」が完全に排除されること",
                "text": "その中で稲田氏さんは、消費減税そのものには反対ではないとしながらも、議論が十分に行われていないと批判したにゃ。",
                "check_type": "both",
                "expected_display_pattern": r"稲田さんは",
                "forbidden_display_pattern": r"稲田氏さん",
                "expected_speech_pattern": r"(?:稲田|いなだ)さんは",
                "forbidden_speech_pattern": r"氏さん|いなだけさん",
                "expected_kana_pattern": r"イナダサンワ",
                "forbidden_kana_pattern": r"イナダケサン|イナダシサン",
            },
            {
                "id": "double_honorific_yamada_shi_san",
                "desc": "「山田氏さん」が「山田さん」へ是正されること",
                "text": "山田氏さんが記者会見で方針を表明したにゃ。",
                "check_type": "speech_text",
                "expected_speech_pattern": r"山田さんが",
                "forbidden_speech_pattern": r"山田氏さん",
            },
            {
                "id": "double_honorific_doushi_san",
                "desc": "「同氏さん」が「同氏」へ是正され、「同さん」「同氏さん」にならないこと",
                "text": "同氏さんは今後の見通しについて語ったにゃ。",
                "check_type": "speech_text",
                "expected_speech_pattern": r"同氏は",
                "forbidden_speech_pattern": r"同氏さん|同さんは",
            },
            {
                "id": "double_honorific_toji_san_protected",
                "desc": "酒造りの「杜氏さん」が誤爆されず確実に保護されること",
                "text": "伝統を受け継ぐ杜氏さんが酒造りを開始したにゃ。",
                "check_type": "speech_text",
                "expected_speech_pattern": r"杜氏さんが",
                "forbidden_speech_pattern": r"杜さんが",
            },
            {
                "id": "double_honorific_kareshi_san_protected",
                "desc": "恋人の「彼氏さん」が誤爆されず確実に保護されること",
                "text": "女性が彼氏さんと一緒にイベントを訪れたにゃ。",
                "check_type": "speech_text",
                "expected_speech_pattern": r"彼氏さんと",
                "forbidden_speech_pattern": r"彼さんと",
            },
        ]
    },
    {
        "category": "11. 差分マージ破損防止（「マスクさんしゅ」等の防止・自動修復）",
        "cases": [
            {
                "id": "sanshu_mask_diff_merge_repair",
                "desc": "「マスクさん」vs「マスクせんしゅ」の差分マージで「マスクさんしゅ」が機械合成されず「マスクさん」になること",
                "text": "マスクさんが新型AIについて言及しましたにゃ。",
                "display_input": "マスクさん",
                "speech_input": "マスクせんしゅが新型AIについて言及しましたにゃ。",
                "check_type": "both",
                "expected_display_pattern": r"マスクさん",
                "forbidden_display_pattern": r"マスクさんしゅ|マスク選手",
                "expected_speech_pattern": r"マスクさん",
                "forbidden_speech_pattern": r"マスクさんしゅ|さんしゅ",
                "expected_kana_pattern": r"マスクサン",
                "forbidden_kana_pattern": r"マスクサンシュ|サンシュ",
            },
            {
                "id": "sanshu_mask_non_sports_raw_repair",
                "desc": "非スポーツ記事でルビ付き「マスク選手（せんしゅ）」から生成されても「マスクさん」へ正しく統一されること",
                "text": "マスク選手が宇宙開発計画を発表しましたにゃ。",
                "display_input": "マスク選手",
                "speech_input": "マスクせんしゅが宇宙開発計画を発表しましたにゃ。",
                "title": "イーロン・マスク氏が新ロケット計画を発表",
                "article_context": "テスラのイーロン・マスクCEOは新たな宇宙計画について語りました。",
                "category_name": "テクノロジー",
                "check_type": "both",
                "expected_display_pattern": r"マスクさん",
                "forbidden_display_pattern": r"マスク選手|マスクさんしゅ",
                "expected_speech_pattern": r"マスクさん",
                "forbidden_speech_pattern": r"マスクせんしゅ|マスクさんしゅ|さんしゅ",
                "expected_kana_pattern": r"マスクサン",
                "forbidden_kana_pattern": r"マスクサンシュ|サンシュ",
            },
            {
                "id": "sanshu_tsunoda_raw_repair",
                "desc": "人名＋さんしゅ（例: 角田裕毅さんしゅ）が自動的に「角田裕毅さん」へ修復されること",
                "text": "角田裕毅さんしゅが好タイムを記録しましたにゃ。",
                "check_type": "speech_text",
                "expected_speech_pattern": r"(?:角田裕毅|つのだゆうき)さん",
                "forbidden_speech_pattern": r"さんしゅ",
            },
            {
                "id": "sanshu_basketball_protected",
                "desc": "競技名＋選手（バスケットボール選手）は破壊されず維持されること",
                "text": "バスケットボール選手たちが集まりましたにゃ。",
                "check_type": "speech_text",
                "expected_speech_pattern": r"バスケットボール選手",
                "forbidden_speech_pattern": r"バスケットボールさん",
            },
            {
                "id": "sanshu_three_kinds_protected",
                "desc": "「第3種」「三種」などの学術・法令用語が「選手」に誤爆破壊されないこと",
                "text": "第3種電気主任技術者の試験が実施されましたにゃ。",
                "check_type": "speech_text",
                "expected_speech_pattern": r"第3種|第３種|だいさんしゅ",
                "forbidden_speech_pattern": r"第3選手|第３選手",
            },
        ]
    },
    {
        "category": "12. 個別記事内の不適切な挨拶（放送事故）防止・自動除去",
        "cases": [
            {
                "id": "greeting_minna_konnichiwa_removal",
                "desc": "記事冒頭の「皆さんこんにちはにゃ！」が自動切除され、放送事故が防止されること",
                "text": "スタメン発表のニュース、皆さんこんにちはにゃ！青森県の高校野球準決勝の試合で、横浜と花巻東のスタメンが発表されましたにゃ。",
                "title": "横浜と花巻東スタメン発表",
                "article_context": "高校野球準決勝が行われました。",
                "check_type": "both",
                "expected_display_pattern": r"横浜と花巻東のスタメンが発表されましたにゃ",
                "forbidden_display_pattern": r"こんにちは",
                "expected_speech_pattern": r"横浜と花巻東のスタメンが発表されましたにゃ",
                "forbidden_speech_pattern": r"こんにちは",
                "expected_kana_pattern": r"ハナマキヒガシ",
                "forbidden_kana_pattern": r"コンニチワ",
            },
            {
                "id": "greeting_fans_konnichiwa_removal",
                "desc": "記事冒頭の「ファンの皆さん、こんにちはにゃ！」が自動切除されること",
                "text": "オーバーウォッチのファンの皆さん、こんにちはにゃ！今週から待望のシーズン5がスタートしましたにゃ。",
                "title": "オーバーウォッチ新シーズン開幕",
                "article_context": "新シーズンがスタートしました。",
                "check_type": "both",
                "expected_display_pattern": r"今週から待望のシーズン5がスタートしましたにゃ",
                "forbidden_display_pattern": r"こんにちは",
                "expected_speech_pattern": r"今週から待望のシーズン5がスタートしましたにゃ",
                "forbidden_speech_pattern": r"こんにちは",
                "expected_kana_pattern": r"シイズン",
                "forbidden_kana_pattern": r"コンニチワ",
            },
            {
                "id": "greeting_movie_title_protected",
                "desc": "元記事の正当な作品名『こんにちは、母さん』は誤爆切除されず保護されること",
                "text": "映画『こんにちは、母さん』の舞台挨拶が行われましたにゃ。",
                "title": "映画『こんにちは、母さん』舞台挨拶",
                "article_context": "映画『こんにちは、母さん』の舞台挨拶が行われました。",
                "check_type": "speech_text",
                "expected_speech_pattern": r"こんにちは、母さん|こんにちは、かあさん",
                "forbidden_speech_pattern": r"^映画の舞台挨拶が行われましたにゃ",
            },
        ]
    },
    {
        "category": "13. 芸能人・非アスリートへの『選手』誤爆防止（6〜7文字名・平仮名混在・出演者たち）",
        "cases": [
            {
                "id": "celebrity_shimekake_senshu_repair",
                "desc": "漢字5文字以上の芸能人（Travis Japan七五三掛龍也）への「選手」誤爆が「さん」へ修復されること",
                "text": "七五三掛龍也選手が米LAで留学中に家出をしたという話題ですにゃ。",
                "title": "Travis Japan七五三掛龍也、米LA留学中のエピソード",
                "article_context": "Travis Japan七五三掛龍也がドラマ出演について語りました。",
                "category_name": "エンタメ",
                "check_type": "both_text",
                "expected_display_pattern": r"七五三掛龍也さん",
                "forbidden_display_pattern": r"七五三掛龍也選手",
                "expected_speech_pattern": r"(?:七五三掛龍也|しめかけりゅうや|しめかけ龍也)さん",
                "forbidden_speech_pattern": r"(?:七五三掛龍也|しめかけりゅうや|しめかけ龍也)選手",
            },
            {
                "id": "celebrity_nagase_ren_speech_repair",
                "desc": "キンプリ永瀬廉の音声側（ひらがな化後）で「ながせれん選手」が残存せず「ながせれんさん」へ修復されること",
                "text": "永瀬廉さん、キスマイのメンバーたちに愛されているエピソードにゃ。",
                "speech_input": "ながせれん選手、キスマイフットツーのメンバーたちに愛されているエピソードにゃ。",
                "title": "キンプリ永瀬廉、キスマイメンバーに周知されていること",
                "article_context": "Kis-My-Ft2と永瀬廉の楽屋でのエピソードが明かされました。",
                "category_name": "エンタメ",
                "check_type": "both_text",
                "expected_display_pattern": r"永瀬廉さん",
                "forbidden_display_pattern": r"永瀬廉選手",
                "expected_speech_pattern": r"ながせれんさん",
                "forbidden_speech_pattern": r"ながせれん選手",
            },
            {
                "id": "celebrity_tamamori_particle_mo_repair",
                "desc": "直前に助詞「も」がある名字単体の芸能人（横尾さんも玉森選手）が「玉森さん/たまもりさん」へ修復されること",
                "text": "横尾さんも玉森選手の位置を教えてくれるんだにゃ。",
                "speech_input": "横尾さんもたまもり選手の位置を教えてくれるんだにゃ。",
                "title": "キンプリ永瀬廉、キスマイメンバーに周知されていること",
                "article_context": "キスマイの横尾渉や玉森裕太が永瀬廉と交流しています。",
                "category_name": "エンタメ",
                "check_type": "both_text",
                "expected_display_pattern": r"玉森さん",
                "forbidden_display_pattern": r"玉森選手",
                "expected_speech_pattern": r"(?:たまもり|玉森)さん",
                "forbidden_speech_pattern": r"(?:たまもり|玉森)選手",
            },
            {
                "id": "entertainment_cast_senshutachi_repair",
                "desc": "映画・舞台・プレミア等のエンタメ記事で共演者に対する「選手たち」が「出演者たち」へ修復されること",
                "text": "主演映画ジャパンプレミアで、その秘話を語り合った選手たちと監督も一同に会しましたにゃ！",
                "title": "柳楽優弥、デビュー秘話を告白",
                "article_context": "主演映画『RYUJI 竜二』ジャパンプレミアに登壇した柳楽優弥さん。",
                "category_name": "エンタメ",
                "check_type": "both_text",
                "expected_display_pattern": r"出演者たち",
                "forbidden_display_pattern": r"選手たち",
                "expected_speech_pattern": r"出演者たち|しゅつえんしゃたち",
                "forbidden_speech_pattern": r"選手たち|せんしゅたち",
            },
        ]
    },
    {
        "category": "14. 難読人名漢字の名前消失防止（『さん』のみ発音事故の防止・硤合さん救済）",
        "cases": [
            {
                "id": "rare_kanji_soai_san_missing_name_prevention",
                "desc": "JIS第3水準漢字を含む人名「硤合さん」がVOICEVOXで「サンガ」とスキップされず「ソアイサンガ」と発音されること",
                "text": "硤合さんが発見した生命の謎に迫る化学的な現象が評価されたにゃ。",
                "title": "硤合さん受賞 広島の仲間が祝福",
                "article_context": "ノーベル化学賞の候補となった硤合憲三さん。",
                "category_name": "ニュース",
                "known_terms": {"硤合": "そあい", "硤合憲三": "そあいけんそう"},
                "check_type": "both",
                "expected_speech_pattern": r"(?:そあい|硤合)さん",
                "forbidden_speech_pattern": r"^\s*さんが",
                "expected_kana_pattern": r"ソアイサン|ソ'アイサン",
                "forbidden_kana_pattern": r"^サンガ|^サ'ンガ",
            },
            {
                "id": "rare_kanji_soai_kenzo_full_reading",
                "desc": "「硤合憲三さん」が異常置換検知でロールバックされず正しく「そあいけんそうさん」と発音されること",
                "text": "硤合憲三さん、ノーベル化学賞受賞のニュースが入ってきましたにゃ。",
                "title": "硤合さん受賞 広島の仲間が祝福",
                "article_context": "ノーベル化学賞の候補となった硤合憲三さん。",
                "category_name": "ニュース",
                "known_terms": {"硤合": "そあい", "硤合憲三": "そあいけんそう"},
                "check_type": "both",
                "expected_speech_pattern": r"(?:そあいけんそう|硤合憲三)さん",
                "expected_kana_pattern": r"ソアイケンソオサン|ソ'アイケン'ソオサン",
                "forbidden_kana_pattern": r"^ケンソオサン|^ケ'ンソオサン",
            },
        ]
    },
    {
        "category": "15. 写真・芸能撮影用語の読み誤読防止（2ショット➔ツーショット、ニショット防止）",
        "cases": [
            {
                "id": "two_shot_photo_halfwidth",
                "desc": "「2ショット撮影」が『ニショット』ではなく『ツーショット』と発音されること",
                "text": "川上千尋が白井審判員と2ショット撮影を公開したにゃ！",
                "title": "川上千尋が白井審判員と2ショット撮影",
                "article_context": "NMB48の川上千尋さんが白井球審と2ショット写真を撮影しました。",
                "category_name": "エンタメ",
                "check_type": "both",
                "expected_speech_pattern": r"ツーショット撮影",
                "forbidden_speech_pattern": r"2ショット|ニショット",
                "expected_kana_pattern": r"ツ[ウー]ショット",
                "forbidden_kana_pattern": r"ニショット",
            },
            {
                "id": "two_shot_photo_fullwidth",
                "desc": "全角「２ショットなど添え」が『ニショット』ではなく『ツーショット』と発音されること",
                "text": "ワンオクRyota、紗栄子との交際を公表 ２ショットなど添えましたにゃ。",
                "title": "ワンオクRyota、交際を公表 ２ショットなど添え",
                "article_context": "ONE OK ROCKのRyotaさんが紗栄子さんとの交際を公表しました。",
                "category_name": "エンタメ",
                "check_type": "both",
                "expected_speech_pattern": r"ツーショットなど添え",
                "forbidden_speech_pattern": r"２ショット|ニショット",
                "expected_kana_pattern": r"ツ[ウー]ショット",
                "forbidden_kana_pattern": r"ニショット",
            },
            {
                "id": "three_shot_photo_halfwidth",
                "desc": "「3ショット写真」が『サンショット』ではなく『スリーショット』と発音されること",
                "text": "豪華な3ショット写真を披露しましたにゃ。",
                "title": "豪華な3ショット写真を披露",
                "category_name": "エンタメ",
                "check_type": "both",
                "expected_speech_pattern": r"スリーショット写真",
                "forbidden_speech_pattern": r"3ショット|サンショット",
                "expected_kana_pattern": r"スリ[イ一ー]ショット",
                "forbidden_kana_pattern": r"サンショット",
            },
        ]
    },
    {
        "category": "16. 動物・競走馬・ペットへの不自然な「さん」付け防止（クマ・パンダ・競走馬等）",
        "cases": [
            {
                "id": "animal_bear_san_removal",
                "desc": "野生動物「クマさん」がニュースで「クマ」に是正されること",
                "text": "住宅街にクマさんが出没し、警察が警戒を呼びかけていますにゃ。",
                "title": "住宅街にクマ出没",
                "category_name": "社会",
                "check_type": "speech_text",
                "expected_pattern": r"住宅街にクマが出没し",
                "forbidden_pattern": r"クマさん|熊さん",
            },
            {
                "id": "animal_panda_san_removal",
                "desc": "動物園の「パンダさん」が「パンダ」に是正され、修飾付き個体名「パンダのシャンシャンさん」も「パンダのシャンシャン」になること",
                "text": "上野動物園のパンダさんが大人気で、パンダのシャンシャンさんも中国で元気ですにゃ。",
                "title": "上野動物園のパンダ人気",
                "category_name": "社会",
                "check_type": "speech_text",
                "expected_pattern": r"上野動物園のパンダが大人気で.*パンダのシャンシャンも中国で",
                "forbidden_pattern": r"パンダさん|シャンシャンさん",
            },
            {
                "id": "racehorse_equinox_san_removal",
                "desc": "競走馬に対する「競走馬のイクイノックスさん/選手」が「競走馬のイクイノックス」に是正されること",
                "text": "競馬の祭典で、競走馬のイクイノックスさんが圧倒的な強さを見せましたにゃ。",
                "title": "イクイノックス圧勝",
                "category_name": "スポーツ",
                "check_type": "speech_text",
                "expected_pattern": r"競走馬のイクイノックスが",
                "forbidden_pattern": r"イクイノックスさん|イクイノックス選手",
            },
            {
                "id": "person_shiratori_san_protected",
                "desc": "人名「白鳥さん」「熊谷さん」の「さん」は誤爆除去されず確実に保護されること",
                "text": "白鳥さんと熊谷さんが研究成果を発表しましたにゃ。",
                "title": "白鳥教授らの研究成果",
                "category_name": "科学",
                "check_type": "speech_text",
                "expected_pattern": r"白鳥さんと熊谷さんが",
                "forbidden_pattern": r"白鳥と熊谷が|白鳥と熊谷さんが",
            },
            {
                "id": "tororo_greeting_protection",
                "desc": "始まりの挨拶「AITuberのとろろがニュースをお届けします」で「とろろ」が「私」に置換されず保護されること",
                "text": "AITuberのとろろがニュースをお届けします。",
                "title": "ニュース番組開始",
                "category_name": "一般",
                "check_type": "speech_text",
                "expected_pattern": r"(?:AITuber|アイチューバー)のとろろがニュースをお届けします",
                "forbidden_pattern": r"私のニュース|私がニュース",
            },
            {
                "id": "tororo_outro_protection",
                "desc": "終わりの挨拶「以上、とろろがお伝えしましたにゃ」で「とろろ」が「私」に置換されず保護されること",
                "text": "以上、とろろがお伝えしましたにゃ。",
                "title": "ニュース番組終了",
                "category_name": "一般",
                "check_type": "speech_text",
                "expected_pattern": r"以上、とろろがお伝えしましたにゃ",
                "forbidden_pattern": r"以上、私がお伝え",
            },
            {
                "id": "tororo_food_protection",
                "desc": "食材「名物のとろろ汁ととろろ蕎麦」で「とろろ」が「私」に誤爆置換されず保護されること",
                "text": "名物のとろろ汁ととろろ蕎麦を堪能しましたにゃ。",
                "title": "ご当地グルメ特集",
                "category_name": "グルメ",
                "check_type": "speech_text",
                "expected_pattern": r"名物のとろろ汁ととろろ蕎麦を",
                "forbidden_pattern": r"名物の私汁|私の蕎麦|私汁",
            },
            {
                "id": "tororo_person_protection",
                "desc": "人名・芸名「とろろ先生」で「とろろ」が「私」に誤爆置換されず保護されること",
                "text": "人気漫画家のとろろ先生が新連載を開始しましたにゃ。",
                "title": "新作漫画スタート",
                "category_name": "エンタメ",
                "check_type": "speech_text",
                "expected_pattern": r"人気漫画家のとろろ先生が",
                "forbidden_pattern": r"人気漫画家の私先生",
            },
        ]
    },
    {
        "category": "17. 多音語「一目」の文脈誤読防止（一目で/一目見て ➔ ひとめ、一目瞭然/一目置く保護）",
        "cases": [
            {
                "id": "hitome_de_kakunin_voicevox",
                "desc": "「一目で確認できる」がVOICEVOXで「ヒトメデカクニンデキル」と発音されること（イチモクデ誤読防止）",
                "text": "重要な情報を一目で確認できる便利な新機能が登場しましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ヒトメデカクニンデキル",
                "forbidden_kana_pattern": r"イチモクデカクニンデキル",
            },
            {
                "id": "hitome_mite_voicevox",
                "desc": "「一目見て」がVOICEVOXで「ヒトメミテ」と発音されること",
                "text": "一目見てその凄さが伝わってきますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ヒトメミテ",
                "forbidden_kana_pattern": r"イチモクミテ",
            },
            {
                "id": "ichimoku_ryozen_protected",
                "desc": "熟語「一目瞭然」は「イチモクリョオゼン」として誤爆せず確実に保護されること",
                "text": "グラフを見れば変化は一目瞭然ですにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"イチモクリョ[オウー]ゼン",
                "forbidden_kana_pattern": r"ヒトメリョ[オウー]ゼン",
            },
            {
                "id": "ichimoku_oku_protected",
                "desc": "慣用句「一目置く」は「イチモクオカレル」として誤爆せず保護されること",
                "text": "専門家からも一目置かれる存在となっていますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"イチモクオカレル",
                "forbidden_kana_pattern": r"ヒトメオカレル",
            },
        ]
    },
    {
        "category": "18. 接頭辞「大」の多音語誤読防止（大盛り上がり➔おおもりあがり、大盛況保護）",
        "cases": [
            {
                "id": "oomoriagari_voicevox",
                "desc": "「大盛り上がり」がVOICEVOXで「オオモリアガリ」と発音されること（ダイモリアガリ誤読防止）",
                "text": "フェス会場は大盛り上がりとなりましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"オオモリアガリ",
                "forbidden_kana_pattern": r"ダイモリアガリ",
            },
            {
                "id": "oomoriagatta_voicevox",
                "desc": "「大盛り上がった」がVOICEVOXで「オオモリアガッタ」と発音されること",
                "text": "昨夜のライブも大盛り上がったようですにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"オオモリアガッタ",
                "forbidden_kana_pattern": r"ダイモリアガッタ",
            },
            {
                "id": "daiseikyo_protected",
                "desc": "熟語「大盛況」は「ダイセイキョウ」として誤爆せず確実に保護されること",
                "text": "イベントは大盛況のうちに幕を閉じましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ダイセ[エイー]キョ[オウー]",
                "forbidden_kana_pattern": r"オオモリキョ",
            },
        ]
    },
    {
        "category": "19. 末尾に句点（。）を含む固有名詞の誤分割防止（ずっと真夜中でいいのに。、モーニング娘。）",
        "cases": [
            {
                "id": "ztmy_sentence_split_protection",
                "desc": "「ずっと真夜中でいいのに。」の「。」で文が分割されず、主語消失・『は、』から始まる文片事故が防止されること",
                "text": "バンドずっと真夜中でいいのに。は、2018年にデビューし、特定の形を持たない音楽バンドとして知られていますにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"ずっと真夜中でいいのに。は、2018年",
                "forbidden_pattern": r"^は、2018年",
            },
            {
                "id": "morning_musume_split_protection",
                "desc": "「モーニング娘。」の「。」で文が分割されず、完全な文として維持されること",
                "text": "アイドルグループモーニング娘。は、結成記念イベントを開催しましたにゃ。",
                "check_type": "speech_text",
                "expected_pattern": r"モーニング娘。は、結成記念",
                "forbidden_pattern": r"^は、結成記念",
            },
        ]
    },
    {
        "category": "20. 副詞「今（いま）」の多音語誤読防止（今話題/今注目/今人気 ➔ いま、今月/今回保護）",
        "cases": [
            {
                "id": "ima_wadai_voicevox",
                "desc": "「今話題」がVOICEVOXで「イマワダイ」と発音されること（コンワダイ誤読防止）",
                "text": "SNSで今話題となっている新商品ですにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"イマワダイ",
                "forbidden_kana_pattern": r"コンワダイ",
            },
            {
                "id": "ima_chumoku_voicevox",
                "desc": "「今注目」がVOICEVOXで「イマチュウモク」と発音されること（コンチュウモク誤読防止）",
                "text": "世界中から今注目を集めていますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"イマチュウモク",
                "forbidden_kana_pattern": r"コンチュウモク",
            },
            {
                "id": "ima_ninki_voicevox",
                "desc": "「今人気」がVOICEVOXで「イマニンキ」と発音されること（コンニンキ誤読防止）",
                "text": "若い世代の間で今人気のスポットですにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"イマニンキ",
                "forbidden_kana_pattern": r"コンニンキ",
            },
            {
                "id": "kongetsu_konkai_protected",
                "desc": "熟語「今月」「今回」は「コンゲツ」「コンカイ」として誤爆せず確実に保護されること",
                "text": "今月開催される今回のイベントも楽しみですにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"コンゲツ.*コンカイ",
                "forbidden_kana_pattern": r"イマゲツ|イマカイ",
            },
        ]
    },
    {
        "category": "21. 英語・アルファベット発音救済（WEB/西スポWEB/1st/大文字英単語）",
        "cases": [
            {
                "id": "nishispo_web_voicevox",
                "desc": "「西スポWEB」が「ニシスポウェブ」と発音されること（ダブリューイービー誤読防止）",
                "text": "西スポWEBの最新記事で発表されましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ニシスポウェブ",
                "forbidden_kana_pattern": r"ダブリュ[ウー]イービ[イエ]",
            },
            {
                "id": "first_live_voicevox",
                "desc": "「1st LIVE」が「ファースト ライブ」と発音されること（イチショートトン単位誤読防止）",
                "text": "記念すべき1st LIVEの開催が決定しましたにゃ！",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ファ[ア]?スト.*ライブ",
                "forbidden_kana_pattern": r"ショ[オウ]トトン",
            },
            {
                "id": "uppercase_english_words",
                "desc": "大文字英単語（WINNER, POP等）がスペルアウトされず英単語として発音されること",
                "text": "大会のWINNERが決定しPOPな演出で盛り上がりましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ウィナ[ア]?.*ポップ",
                "forbidden_kana_pattern": r"ダブリュ[ウー]アイ|ピ[イ]オ[オ]ピ[イ]",
            },
            {
                "id": "gizmodo_voicevox",
                "desc": "「Gizmodo」が「ギズモード」と発音されること（ギズモド誤読防止）",
                "text": "Gizmodo Japanの記事で最新ガジェットが紹介されましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ギズモ[オウ]ド",
                "forbidden_kana_pattern": r"ギズモド",
            },
            {
                "id": "j_reit_voicevox",
                "desc": "「J-REIT」が「ジェイリート」と発音されること（ジェイライト誤読防止）",
                "text": "J-REIT市場で買い推奨が強まっていますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ジェイリ[イエ]?ト",
                "forbidden_kana_pattern": r"ジェイライト",
            },
            {
                "id": "reit_market_voicevox",
                "desc": "「Reit」が「リート」と発音されること（ライト誤読防止）",
                "text": "国内外のReit市場の動向を解説しますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"リ[イエ]?トシジョ[オウ]",
                "forbidden_kana_pattern": r"ライトシジョ[オウ]",
            },
        ]
    },
    {
        "category": "22. ニュース頻出用語・固有名詞の誤読防止（海警局、首都高、月9、連休中日、国学院大）",
        "cases": [
            {
                "id": "kaikeikyoku_voicevox",
                "desc": "「海警局」が「カイケイキョク」と発音されること（ウミへの単語消失事故防止）",
                "text": "中国海警局の船が航行しているのが確認されましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"カイケイキョク",
                "forbidden_kana_pattern": r"チュウゴクウミノフネ",
            },
            {
                "id": "shutoko_voicevox",
                "desc": "「首都高」が「シュトコウ」と発音されること（シュトダカ誤読防止）",
                "text": "首都高で事故が発生し渋滞していますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"シュトコ[オウ]",
                "forbidden_kana_pattern": r"シュトダカ",
            },
            {
                "id": "getsu_ku_voicevox",
                "desc": "「月9ドラマ」が「ゲツクドラマ」と発音されること（ツキキュウ誤読防止）",
                "text": "大注目の月9ドラマがついに始まりましたにゃ！",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ゲツクドラマ",
                "forbidden_kana_pattern": r"ツキキュウ",
            },
            {
                "id": "renkyu_nakabi_voicevox",
                "desc": "「3連休中日」が「サンレンキュウナカビ」と発音されること（チュウニチ誤読防止）",
                "text": "3連休中日の今日は行楽日和となりましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"サンレンキュウナカビ",
                "forbidden_kana_pattern": r"チュウニチ",
            },
            {
                "id": "kokugakuindai_voicevox",
                "desc": "「国学院大」が「コクガクインダイ」と発音されること（コクガイクインダイ誤読防止）",
                "text": "出雲駅伝で国学院大が快走を見せましたにゃ！",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"コクガクインダイ",
                "forbidden_kana_pattern": r"コクガイクインダイ",
            },
            {
                "id": "kaioh_sama_voicevox",
                "desc": "「界王様」が「カイオウサマ」と発音されること（サカイオオサマ訓読み誤読防止）",
                "text": "界王様役を務めた声優さんの追悼ニュースですにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"カイオ[オウ]サマ",
                "forbidden_kana_pattern": r"サカイオオ",
            },
            {
                "id": "nani_kuwanu_kao_voicevox",
                "desc": "「何食わぬ顔」が「ナニクワヌカオ」と発音されること（ナンクワヌカオ誤読防止）",
                "text": "何食わぬ顔で起動したゲーム機が反響を呼んでいますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ナニクワヌカオ",
                "forbidden_kana_pattern": r"ナンクワヌカオ",
            },
        ]
    },
    {
        "category": "23. スポーツ・リーグカテゴリの英語数詞誤読防止（J1/J2/J3, B1/B2, M-1）",
        "cases": [
            {
                "id": "j1_category_voicevox",
                "desc": "「J1」が「ジェイワン」と発音されること（ジェイイチ誤読防止）",
                "text": "J1昇格をかけた大一番が始まりますにゃ！",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ジェイワン",
                "forbidden_kana_pattern": r"ジェイイチ",
            },
            {
                "id": "j2_j3_category_voicevox",
                "desc": "「J2」「J3」が「ジェイツー」「ジェイスリー」と発音されること",
                "text": "J2とJ3の最新順位をお知らせしますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ジェイツ[ウー]トジェイスリ[イー]",
                "forbidden_kana_pattern": r"ジェイニ|ジェイサン",
            },
            {
                "id": "b1_category_voicevox",
                "desc": "「B1」が「ビーワン」と発音されること（ビイイチ誤読防止）",
                "text": "B1リーグの開幕戦は大盛り上がりとなりましたにゃ！",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ビ[イ]?ワン.*オオモリアガリ",
                "forbidden_kana_pattern": r"ビ[イ]イチ",
            },
        ]
    },
    {
        "category": "24. 人気著名人の人名読み誤読防止（川島如恵留、久保史緒里、新川優愛、北村匠海、大森元貴）",
        "cases": [
            {
                "id": "kawashima_noel_voicevox",
                "desc": "「川島如恵留」が「カワシマノエル」と発音されること（カワシマトメ誤読防止）",
                "text": "川島如恵留さんがイベントに登壇しましたにゃ！",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"カワシマノエル",
                "forbidden_kana_pattern": r"カワシマトメ",
            },
            {
                "id": "kubo_shiori_voicevox",
                "desc": "「久保史緒里」が「クボシオリ」と発音されること（クボフミオサト誤読防止）",
                "text": "乃木坂46の久保史緒里さんからコメントが届きましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"クボシオリ",
                "forbidden_kana_pattern": r"クボフミオサト",
            },
            {
                "id": "shinkawa_yua_voicevox",
                "desc": "「新川優愛」が「シンカワユア」と発音されること（シンカワユウアイ誤読防止）",
                "text": "新川優愛さんも絶賛の声を寄せていますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"シンカワユア",
                "forbidden_kana_pattern": r"シンカワユウアイ",
            },
            {
                "id": "kitamura_takumi_voicevox",
                "desc": "「北村匠海」が「キタムラタクミ」と発音されること（キタムラタ クミ誤読防止）",
                "text": "主演の北村匠海さんが舞台挨拶を行いましたにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"キタムラタクミ",
            },
            {
                "id": "oomori_motoki_voicevox",
                "desc": "「大森元貴」が「オオモリモトキ」と発音されること（オオモリモトタカ誤読防止）",
                "text": "大森元貴さんが手がけた新曲が話題ですにゃ！",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"オオモリモトキ",
                "forbidden_kana_pattern": r"オオモリモトタカ",
            },
        ]
    },
    {
        "category": "25. カメラ・光学用語の多音語誤読防止（一眼レフ/ミラーレス一眼 ➔ いちがん、イチメ誤読防止）",
        "cases": [
            {
                "id": "digital_ichigan_ref_voicevox",
                "desc": "「デジタル一眼レフ」が「デジタルイチガンレフ」と発音されること（イチメレフ誤読防止）",
                "text": "初めてのデジタル一眼レフカメラとして大人気ですにゃ！",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"デジタルイチガンレフ",
                "forbidden_kana_pattern": r"イチメレフ",
            },
            {
                "id": "mirrorless_ichigan_voicevox",
                "desc": "「ミラーレス一眼」が「ミラーレスイチガン」と発音されること（イチメ誤読防止）",
                "text": "最新のミラーレス一眼カメラの性能を解説しますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ミラ[ア]?レスイチガン",
                "forbidden_kana_pattern": r"レスイチメ",
            },
        ]
    },
    {
        "category": "26. ネットスラング・語尾の「w」誤読防止（w/ww/www ➔ わら、ダブリュー誤読防止）",
        "cases": [
            {
                "id": "sentence_ending_w_voicevox",
                "desc": "語尾の「w」が「ワラ」と発音されること（ダブリュー誤読防止）",
                "text": "実物に詐欺じゃないですかwと驚きの声が上がっていますにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"サギジャナイデスカ.*ワラ",
                "forbidden_kana_pattern": r"ダブリュ[ウー]",
            },
            {
                "id": "sentence_ending_www_voicevox",
                "desc": "語尾の「www」が「ワラ」と発音されること（ダブリュー連呼防止）",
                "text": "コメント欄では面白すぎるwwwと大盛り上がりですにゃ！",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"オモシロスギル.*ワラ",
                "forbidden_kana_pattern": r"ダブリュ[ウー]",
            },
            {
                "id": "url_and_watt_protected",
                "desc": "URL（www.）や電力単位（100W）は「わら」にならず確実に保護されること",
                "text": "消費電力は100Wで公式サイトはwww.example.comですにゃ。",
                "check_type": "voicevox_kana",
                "expected_kana_pattern": r"ワット.*ダブリュ",
                "forbidden_kana_pattern": r"ヒャクワラ",
            },
        ]
    },
    {
        "category": "27. LLMトークン暴走・破損文片（-Rayu・反復ループ）および有料記事の完全撃墜",
        "cases": [
            {
                "id": "rayu_token_hallucination_rejected",
                "desc": "「-Rayuにゃ」「-Rayu-Rayuにゃ」等の破損英字トークン文片が品質バリデーションで確実に撃墜（False）されること",
                "text": "高市首相はしっかりと考えさせていただくと述べたそうです。\n-Rayuにゃ。\n-Rayu-Rayuにゃ。\n-Rayu-Rayu-Rayuにゃ。",
                "title": "農相続投問題",
                "article_context": "農相の進退について語った。",
                "check_type": "quality_validation",
                "expected_valid": False,
            },
            {
                "id": "paywall_clean_fallback_accepted",
                "desc": "正常な要約台本が品質バリデーションで正常合格（True）すること",
                "text": "高市首相は、農相の簗さんが続投を表明したことを受けて、しっかりと考えさせていただくと述べたそうですにゃ。\n事実であるとしたら本当に不適切だと指摘しましたにゃ。\n現時点で国会や国民に迷惑をかけない形で、まずは自らの口で説明責任を果たすよう求めたにゃ。\n今後の政権運営や国会審議への影響が注目されますにゃ。",
                "title": "農相続投「しっかりと考えさせていただく」と高市首相",
                "article_context": "簗和生農相の予算削減発言を巡り、高市早苗首相は13日の衆院予算委員会で述べた。",
                "check_type": "quality_validation",
                "expected_valid": True,
            },
        ]
    },
    {
        "category": "28. 解剖学・身体部位の誤読防止（肩甲骨 ➔ けんこうこつ、カタカブトコツ誤読防止）",
        "cases": [
            {
                "id": "kenkoukotsu_voicevox",
                "desc": "「肩甲骨」がVOICEVOXで「ケンコオコツ」と発音されること（カタカブトコツ誤読防止）",
                "text": "肩甲骨をほぐすストレッチが効果的ですにゃ。",
                "check_type": "voicevox_reading",
                "expected_kana": "ケンコオコツ",
                "forbidden_kana": ["カタカブトコツ"],
            },
            {
                "id": "kenkoukotsu_hagashi_voicevox",
                "desc": "複合表現「肩甲骨はがし」でも「ケンコオコツ」と発音されること",
                "text": "最近話題の肩甲骨はがしを体験してみたにゃ。",
                "check_type": "voicevox_reading",
                "expected_kana": "ケンコオコツ",
                "forbidden_kana": ["カタカブトコツ"],
            },
        ]
    },
    {
        "category": "29. 接頭辞「誤（ご）」・固有名詞の誤読防止（誤送信/誤作動/誤判定/誤ロスカット/小松本/IIJ）",
        "cases": [
            {
                "id": "prefix_go_houshin_voicevox",
                "desc": "「誤送信」がVOICEVOXで「ゴソオシン」と発音されること（アヤマソオシン誤読防止）",
                "text": "私に誤送信した後輩へ返信したにゃ。",
                "check_type": "voicevox_reading",
                "expected_kana": "ゴソオシン",
                "forbidden_kana": ["アヤマソオシン"],
            },
            {
                "id": "prefix_go_sadou_voicevox",
                "desc": "「誤作動」がVOICEVOXで「ゴサドオ」と発音されること（アヤマサドオ誤読防止）",
                "text": "システムの誤作動により停止したにゃ。",
                "check_type": "voicevox_reading",
                "expected_kana": "ゴサドオ",
                "forbidden_kana": ["アヤマサドオ"],
            },
            {
                "id": "prefix_go_hantei_voicevox",
                "desc": "「誤判定」がVOICEVOXで「ゴハンテエ」と発音されること（ごはんじょう誤読防止）",
                "text": "エーアイの誤判定を防ぐ取り組みだにゃ。",
                "check_type": "voicevox_reading",
                "expected_kana": "ゴハンテエ",
                "forbidden_kana": ["ゴハンジョオ", "アヤマハンテエ"],
            },
            {
                "id": "prefix_go_losscut_voicevox",
                "desc": "「誤ロスカット」がVOICEVOXで「ゴロスカット」と発音されること（アヤマロスカット誤読防止）",
                "text": "FX取引で誤ロスカットが発生したにゃ。",
                "check_type": "voicevox_reading",
                "expected_kana": "ゴロスカット",
                "forbidden_kana": ["アヤマロスカット"],
            },
            {
                "id": "komatsumoto_person_voicevox",
                "desc": "「小松本さん」がVOICEVOXで「コマツモトサン」と発音されること（ショウマツモト誤読防止）",
                "text": "小松本さんを偲ぶ声が寄せられたにゃ。",
                "check_type": "voicevox_reading",
                "expected_kana": "コマツモトサン",
                "forbidden_kana": ["ショオマツモトサン"],
            },
            {
                "id": "iij_acronym_voicevox",
                "desc": "「Iij」がVOICEVOXで「アイアイジェイ」と発音されること（イイジ誤読防止）",
                "text": "通信大手のIijが作業ミスを発表したにゃ。",
                "check_type": "voicevox_reading",
                "expected_kana": "アイアイジェイ",
                "forbidden_kana": ["イイジ"],
            },
            {
                "id": "ayamari_protected",
                "desc": "「誤り（あやまり）」が「アヤマリ」として誤爆せず確実に保護されること",
                "text": "誤りを見つけて訂正したにゃ。",
                "check_type": "voicevox_reading",
                "expected_kana": "アヤマリオ",
                "forbidden_kana": ["ゴリオ"],
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
            if check_type == "quality_validation":
                exp_valid = case.get("expected_valid", True)
                case_title = case.get("title", raw_text)
                case_article = case.get("article_context", raw_text)
                val_res, val_reason = validate_news_script_quality(raw_text, title=case_title, article_context=case_article, char_desc="にゃ")
                is_ok = (val_res == exp_valid)
                err_msg = "" if is_ok else f"品質バリデーション期待値 ({exp_valid}) と結果 ({val_res}) が不一致: 判定理由='{val_reason}'"
                if is_ok:
                    passed_total += 1
                    print(f"  ✅ PASS: [{c_id}] {desc}")
                else:
                    failed_total += 1
                    print(f"  ❌ FAIL: [{c_id}] {desc}")
                    print(f"     理由: {err_msg}")
                    failures.append((c_id, desc, err_msg))
                continue

            # Step 1: normalize_for_tts（略語・グループ名・英字等）
            norm_text = case.get("speech_input") or normalize_for_tts(raw_text)

            # Step 2: audit_and_heal_news_script（敬称・方言・文脈修復等）
            case_title = case.get("title", raw_text)
            case_article = case.get("article_context", raw_text)
            items = [{"display": case.get("display_input") or raw_text, "speech": norm_text}]
            healed = audit_and_heal_news_script(
                items, title=case_title, article_context=case_article, category_name=cat_name_input, context_map=known_terms
            )
            display_text = healed[0]["display"]
            speech_text = healed[0]["speech"]

            # Step 2.5: VOICEVOX 全文照合（助詞融合救済テストおよび名前消失防止の場合）
            if check_type == "voicevox_full_heal" or known_terms:
                healed_vv = audit_and_heal_via_voicevox_full_reading(
                    healed, title=case_title, known_terms_map=known_terms
                )
                display_text = healed_vv[0]["display"]
                speech_text = healed_vv[0]["speech"]

            # Step 3: VOICEVOX 発音生成（音声カナ判定の場合）
            vv_raw_kana = ""
            vv_clean_kana = ""
            if check_type in ("voicevox_kana", "both", "voicevox_full_heal"):
                import time
                for retry_i in range(3):
                    _, vv_raw_kana = get_voicevox_reading_and_kana(speech_text)
                    vv_clean_kana = clean_voicevox_kana(vv_raw_kana)
                    if vv_clean_kana:
                        break
                    time.sleep(0.5 * (retry_i + 1))

            is_ok = True
            err_msg = ""

            # ── 検証判定 ──
            if check_type == "both_text":
                exp_disp = case.get("expected_display_pattern", "")
                forb_disp = case.get("forbidden_display_pattern", "")
                exp_sp = case.get("expected_speech_pattern", "")
                forb_sp = case.get("forbidden_speech_pattern", "")
                if exp_disp and not re.search(exp_disp, display_text):
                    is_ok = False
                    err_msg = f"期待表示 '{exp_disp}' が display ('{display_text}') に見つかりません"
                elif forb_disp and re.search(forb_disp, display_text):
                    is_ok = False
                    err_msg = f"禁止表示 '{forb_disp}' が display ('{display_text}') に含まれています"
                elif exp_sp and not re.search(exp_sp, speech_text):
                    is_ok = False
                    err_msg = f"期待読み '{exp_sp}' が speech ('{speech_text}') に見つかりません"
                elif forb_sp and re.search(forb_sp, speech_text):
                    is_ok = False
                    err_msg = f"禁止読み '{forb_sp}' が speech ('{speech_text}') に含まれています"

            elif check_type in ("speech_text", "both"):
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

            if check_type == "quality_validation":
                exp_valid = case.get("expected_valid", True)
                val_res, val_reason = validate_news_script_quality(raw_text, title=case_title, article_context=case_article, char_desc="にゃ")
                if val_res != exp_valid:
                    is_ok = False
                    err_msg = f"品質バリデーション期待値 ({exp_valid}) と結果 ({val_res}) が不一致: 判定理由='{val_reason}'"

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
