# -*- coding: utf-8 -*-
"""
voicevox_client.py
ローカルVOICEVOXエンジン (port:50021) との通信・音声合成・カナ解析クライアントモジュール
"""

import json
import urllib.request
import urllib.parse
from server.tts_normalizer import normalize_for_tts

def get_voicevox_kana(text, speaker_id=1, custom_dict=None):
    """VOICEVOXのaudio_queryを呼び出し、形態素解析結果のカタカナ読み列を取得する"""
    try:
        processed_text = normalize_for_tts(text, custom_dict=custom_dict)
        encoded_text = urllib.parse.quote(processed_text)
        query_url = f"http://localhost:50021/audio_query?text={encoded_text}&speaker={speaker_id}"
        req = urllib.request.Request(query_url, method="POST")
        with urllib.request.urlopen(req, timeout=5) as q_res:
            query_json = json.loads(q_res.read().decode("utf-8"))
            moras = []
            for phrase in query_json.get("accent_phrases", []):
                phrase_text = "".join([m.get("text", "") for m in phrase.get("moras", [])])
                moras.append(phrase_text)
            return " ".join(moras)
    except Exception as e:
        print(f"[VOICEVOX Kana Error]: {e}")
        return ""

def clean_kana_for_display(kana_str):
    """VOICEVOX内部のアクセント記号（'や_や/）を除去して、人間が読める読みやすいカナ文字列に整形"""
    if not kana_str:
        return ""
    return kana_str.replace('/', ' ').replace("'", "").replace("_", "").strip()

def synthesize_voicevox_backend(text, speaker_id=1, speed=1.0, pitch=0.0, custom_dict=None):
    """VOICEVOXエンジンへテキスト正規化済みテキストを送信して音声WAVバイナリと発音カナを取得"""
    processed_text = normalize_for_tts(text, custom_dict=custom_dict)
    final_text = processed_text
    corrected = (processed_text != text)

    def _audio_query(t):
        enc = urllib.parse.quote(t)
        url = f"http://localhost:50021/audio_query?text={enc}&speaker={speaker_id}"
        req = urllib.request.Request(url, method="POST")
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode("utf-8"))

    query_json = _audio_query(processed_text)
    kana_str = query_json.get("kana", "")

    if speed != 1.0:
        query_json["speedScale"] = speed
    if pitch != 0.0:
        query_json["pitchScale"] = pitch

    synth_url = f"http://localhost:50021/synthesis?speaker={speaker_id}"
    req_synth = urllib.request.Request(
        synth_url,
        data=json.dumps(query_json).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req_synth, timeout=15) as s_res:
        wav_bytes = s_res.read()
    return wav_bytes, kana_str, corrected, final_text
