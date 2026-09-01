import os
import json
import urllib.request

prompt = """あなたはルビ振り・ひらがな変換の専門家です。以下の台本テキストの中に残っている「漢字」や「英語」をすべて「ひらがなのみ」に変換して出力してください。

【厳守事項】
1. 文脈や意味、句読点（、。）、改行などのフォーマットは一切変更せず、元の構造を完全に維持すること。
2. 「[SE: 大勢で拍手]」のような [SE: 〇〇] というタグは絶対に変換・翻訳せず、そのままの文字で維持すること。
3. カタカナは読みやすさのためそのままでも構いませんが、漢字は必ずひらがなにすること。
4. 出力は変換後のテキストのみとし、説明などは不要です。

【対象テキスト】
今こうしてげんきにラジオをやれているからけっかおーらいですよね。
"""

api_key = os.environ.get('GEMINI_API_KEY')
if not api_key:
    # Just skip if no api key in env, but let's try to find it
    print("No GEMINI_API_KEY in env")
    exit(0)

data = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode('utf-8')
req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}", data=data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        print(json.loads(response.read().decode())['candidates'][0]['content']['parts'][0]['text'])
except Exception as e:
    print("Error:", e)
