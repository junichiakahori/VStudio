import json
import random

def generate_combinations(templates, replacements, count):
    phrases = set()
    attempts = 0
    while len(phrases) < count and attempts < count * 5:
        t = random.choice(templates)
        # substitute variables
        phrase = t
        for key, values in replacements.items():
            if f"{{{key}}}" in phrase:
                phrase = phrase.replace(f"{{{key}}}", random.choice(values), 1)
        # remove extra spaces before punctuation
        phrase = phrase.replace(" 、", "、").replace(" ！", "！").replace(" ？", "？")
        phrases.add(phrase)
        attempts += 1
    return list(phrases)

words_normal = {
    "food": ["ハンバーグ", "オムライス", "カレー", "パスタ", "サラダ", "ステーキ", "お寿司", "ラーメン", "うどん", "ピザ", "パンケーキ", "クレープ", "プリン", "アイスクリーム", "ケーキ", "チョコ", "クッキー"],
    "time": ["今日", "明日", "昨日", "最近", "今度", "週末"],
    "action": ["何しようかな", "どこに行こうかな", "ゲームでもしようかな", "散歩に行こうかな", "映画を見ようかな", "本を読もうかな", "お買い物に行こうかな"],
    "feeling": ["嬉しいな", "楽しいな", "ちょっと寂しいな", "元気いっぱいだよ", "眠いかも", "ワクワクするね", "ドキドキするね"],
    "weather": ["晴れ", "雨", "曇り", "雪", "快晴"],
    "greeting": ["ねえねえ", "あのね", "そういえば", "ちょっと聞いて", "みんな！"],
    "person": ["みんな", "あなた", "君", "お前", "リスナーさん"],
}

templates_general = [
    "{greeting}！ {time}のご飯は {food} にしようかなー",
    "{greeting}！ {time}は {food} が食べたい気分なんだよね！",
    "{time}は {food} を食べたよ！ すごく美味しかったなー",
    "{time}は 何かいいことあった？",
    "{greeting}！ {time}は {action}ー",
    "なんだか {food} が食べたくなってきた……",
    "{greeting}、私のことずっと見ててね！ {feeling}！",
    "{person}の好きな {food} って何かな？ 教えて教えて！",
    "{time}の天気、{weather} だといいなぁ",
    "あ、今コメント打とうとしたでしょ！ 待ってるからね！",
    "{greeting}、何か面白いお話ないかなー？",
    "画面の前の{person}！ ちゃんと見えてるよー！",
    "{feeling}！ {person}が来てくれて本当に嬉しい！",
    "{greeting}！ {action}？ それとも私とお話しする？",
    "ずっと座ってると、腰が痛くなってくるかも……",
    "そろそろ伸びしないと、体がバキバキになりそう！",
    "{time}は、なんか {feeling}……",
    "{greeting}！ {time}の配信も、楽しんでいってね！",
]

templates_morning = [
    "おはよう！ 今日も一日がんばろうね！",
    "{greeting}！ 朝ごはんはちゃんと {food} を食べた？",
    "ふわぁ…… まだちょっと {feeling}……",
    "今日の朝の空気って、すごく気持ちいいねー！",
    "{time}の朝は、なんだか {feeling}！",
    "いってらっしゃい！ 気をつけてね！",
    "朝から {food} が食べたい気分だよー！",
    "みんな、おはよう！ {action}ー？",
    "今日も一日、最高の日にしようね！",
    "朝はやっぱり {food} だよね！",
]

templates_afternoon = [
    "こんにちは！ お昼ご飯は {food} 食べた？",
    "午後もがんばっていこうー！ {feeling}！",
    "ちょっと休憩しない？ お茶でも飲もっか",
    "外、いいお天気だねー！ {weather}だといいな",
    "眠くなってくる時間だよね…… {food} でも食べる？",
    "午後もあと少し！ ファイトだよ！",
    "{greeting}！ お昼寝の時間だなぁ……むにゃむにゃ",
    "お昼は {food} を食べたよ！",
    "午後も {person} と一緒なら頑張れる！",
    "休憩時間かな？ ゆっくり休んでね！",
]

templates_night = [
    "こんばんはー！ 今日も一日お疲れ様！",
    "{time}の夜ご飯は {food} だったよ！",
    "そろそろ眠くなってきちゃったかも……",
    "夜は冷えるから、あったかくしてね！",
    "今日も一日、本当によくがんばったね！ えらい！",
    "おやすみなさい、いい夢見てね",
    "{greeting}！ 夜のおやつに {food} 食べちゃおうかな……",
    "夜ふかしはダメだよ？ でも、私と一緒なら特別！",
    "今日一日、どんな一日だった？",
    "明日もいい日になりますように！ おやすみ！",
]


words_zunda = words_normal.copy()
words_zunda["food"] = ["ずんだ餅", "枝豆", "ずんだシェイク", "ずんだアイス", "ずんだまんじゅう", "塩ゆで枝豆"]
words_zunda["greeting"] = ["ねえねえ", "あのねなのだ", "そういえばなのだ", "ちょっと聞いてほしいのだ", "みんな！"]
words_zunda["feeling"] = ["嬉しいのだ", "楽しいのだ", "ちょっと寂しいのだ", "元気いっぱいなのだよ", "眠いかもなのだ", "ワクワクするのだ", "ドキドキするのだ"]

templates_zunda_general = [
    "{greeting}！ {time}のご飯は {food} にしようかなーなのだ",
    "{greeting}！ {time}は {food} が食べたい気分なのだ！",
    "{time}は {food} を食べたのだ！ すごく美味しかったなーなのだ",
    "{time}は 何かいいことあったのだ？",
    "{greeting}！ {time}は {action}ーなのだ",
    "なんだか {food} が食べたくなってきたのだ……",
    "{greeting}、ボクのことずっと見ててね！ {feeling}！",
    "{person}の好きな {food} って何なのだ？ 教えてほしいのだ！",
    "{time}の天気、{weather} だといいなぁなのだ",
    "あ、今コメント打とうとしたのだ！ 待ってるのだ！",
    "{greeting}、何か面白いお話ないかなーなのだ？",
    "画面の前の{person}！ ちゃんと見えてるのだー！",
    "{feeling}！ {person}が来てくれて本当に嬉しいのだ！",
    "{greeting}！ {action}なのだ？ それともボクとお話しするのだ？",
    "ずっと座ってると、腰が痛くなってくるのだ……",
    "そろそろ伸びしないと、体がバキバキになりそうなのだ！",
    "{time}は、なんか {feeling}……",
    "{greeting}！ {time}の配信も、楽しんでいってねなのだ！",
]

templates_zunda_morning = [
    "おはよう！ 今日も一日がんばるのだ！",
    "{greeting}！ 朝ごはんはちゃんと {food} を食べたのだ？",
    "ふわぁ…… まだちょっと {feeling}……",
    "今日の朝の空気って、すごく気持ちいいのだー！",
    "{time}の朝は、なんだか {feeling}！",
    "いってらっしゃい！ 気をつけてねなのだ！",
    "朝から {food} が食べたい気分なのだよー！",
    "みんな、おはよう！ {action}ーなのだ？",
    "今日も一日、最高の日にするのだ！",
    "朝はやっぱり {food} なのだ！",
]

templates_zunda_afternoon = [
    "こんにちは！ お昼ご飯は {food} 食べたのだ？",
    "午後もがんばっていこうーなのだ！ {feeling}！",
    "ちょっと休憩しないのだ？ お茶でも飲もっかなのだ",
    "外、いいお天気だねー！ {weather}だといいななのだ",
    "眠くなってくる時間だよね…… {food} でも食べるのだ？",
    "午後もあと少し！ ファイトなのだ！",
    "{greeting}！ お昼寝の時間だなぁ……むにゃむにゃなのだ",
    "お昼は {food} を食べたのだ！",
    "午後も {person} と一緒なら頑張れるのだ！",
    "休憩時間なのだ？ ゆっくり休んでねなのだ！",
]

templates_zunda_night = [
    "こんばんはーなのだ！ 今日も一日お疲れ様なのだ！",
    "{time}の夜ご飯は {food} だったのだ！",
    "そろそろ眠くなってきちゃったかもなのだ……",
    "夜は冷えるから、あったかくしてねなのだ！",
    "今日も一日、本当によくがんばったのだ！ えらいなのだ！",
    "おやすみなさい、いい夢見てねなのだ",
    "{greeting}！ 夜のおやつに {food} 食べちゃおうかななのだ……",
    "夜ふかしはダメなのだよ？ でも、ボクと一緒なら特別なのだ！",
    "今日一日、どんな一日だったのだ？",
    "明日もいい日になりますようになのだ！ おやすみなのだ！",
]


# Generate NORMAL
normal_gen = generate_combinations(templates_general, words_normal, 400)
normal_mor = generate_combinations(templates_morning, words_normal, 200)
normal_aft = generate_combinations(templates_afternoon, words_normal, 200)
normal_nig = generate_combinations(templates_night, words_normal, 200)

NORMAL_PHRASES = {
    "general": normal_gen,
    "morning": normal_mor,
    "afternoon": normal_aft,
    "night": normal_nig
}

# Generate ZUNDA
zunda_gen = generate_combinations(templates_zunda_general, words_zunda, 400)
zunda_mor = generate_combinations(templates_zunda_morning, words_zunda, 200)
zunda_aft = generate_combinations(templates_zunda_afternoon, words_zunda, 200)
zunda_nig = generate_combinations(templates_zunda_night, words_zunda, 200)

ZUNDA_PHRASES = {
    "general": zunda_gen,
    "morning": zunda_mor,
    "afternoon": zunda_aft,
    "night": zunda_nig
}


with open("scripts/gen_p2.json", "r", encoding="utf-8") as f:
    NORMAL_LONG_STORIES = json.load(f)

with open("scripts/gen_p4.json", "r", encoding="utf-8") as f:
    ZUNDA_LONG_STORIES = json.load(f)


content = "const NORMAL_PHRASES = " + json.dumps(NORMAL_PHRASES, ensure_ascii=False, indent=4) + ";\n\n"
content += "const NORMAL_LONG_STORIES = " + json.dumps(NORMAL_LONG_STORIES, ensure_ascii=False, indent=4) + ";\n\n"
content += "const ZUNDA_PHRASES = " + json.dumps(ZUNDA_PHRASES, ensure_ascii=False, indent=4) + ";\n\n"
content += "const ZUNDA_LONG_STORIES = " + json.dumps(ZUNDA_LONG_STORIES, ensure_ascii=False, indent=4) + ";\n"

with open('idle_phrases.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Generated {sum(len(v) for v in NORMAL_PHRASES.values())} normal phrases.")
print(f"Generated {sum(len(v) for v in ZUNDA_PHRASES.values())} zunda phrases.")
print("Saved to idle_phrases.js")
