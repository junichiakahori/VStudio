import json
import random
import re

with open('idle_phrases.js', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'const NORMAL_LONG_STORIES = (\{.*?\});', content, re.DOTALL)
NORMAL_LONG_STORIES = json.loads(m.group(1)) if m else {"general": [], "morning": [], "afternoon": [], "night": []}

m2 = re.search(r'const ZUNDA_LONG_STORIES = (\{.*?\});', content, re.DOTALL)
ZUNDA_LONG_STORIES = json.loads(m2.group(1)) if m2 else {"general": [], "morning": [], "afternoon": [], "night": []}

def generate_combinations(templates, replacements, count):
    phrases = set()
    attempts = 0
    # Create all possible combinations to avoid random sampling exhaustion
    all_possible = []
    
    # We will just generate random ones, but with more variables
    while len(phrases) < count and attempts < count * 20:
        t = random.choice(templates)
        phrase = t
        for key, values in replacements.items():
            if f"{{{key}}}" in phrase:
                phrase = phrase.replace(f"{{{key}}}", random.choice(values), 1)
        phrase = phrase.replace(" 、", "、").replace(" ！", "！").replace(" ？", "？")
        phrases.add(phrase)
        attempts += 1
    return list(phrases)

words_normal = {
    "food": ["ハンバーグ", "オムライス", "カレー", "パスタ", "サラダ", "ステーキ", "お寿司", "ラーメン", "うどん", "ピザ", "パンケーキ", "クレープ", "プリン", "アイスクリーム", "ケーキ", "チョコ", "クッキー", "焼肉", "お好み焼き", "たこ焼き", "チャーハン", "唐揚げ", "ポテト", "ドーナツ", "マカロン", "和菓子", "おにぎり", "サンドイッチ", "シチュー", "グラタン"],
    "time": ["今日", "明日", "昨日", "最近", "今度", "週末", "この前", "いつか", "さっき"],
    "action": ["何しようかな", "どこに行こうかな", "ゲームでもしようかな", "散歩に行こうかな", "映画を見ようかな", "本を読もうかな", "お買い物に行こうかな", "歌でも歌おうかな", "ストレッチしようかな", "お絵かきしようかな", "掃除しようかな", "料理しようかな", "のんびりしようかな", "配信しようかな", "動画見ようかな", "お出かけしようかな"],
    "feeling": ["嬉しいな", "楽しいな", "ちょっと寂しいな", "元気いっぱいだよ", "眠いかも", "ワクワクするね", "ドキドキするね", "癒やされるな", "幸せだな", "不思議な気分だな", "のんびりしてるよ", "最高だね", "ウキウキするな", "ほっこりするね", "疲れちゃったかも"],
    "weather": ["晴れ", "雨", "曇り", "雪", "快晴", "雷雨", "強風", "大雪"],
    "greeting": ["ねえねえ", "あのね", "そういえば", "ちょっと聞いて", "みんな！", "あ！", "えっとね", "実はね", "ふふっ", "んー？"],
    "person": ["みんな", "あなた", "君", "お前", "リスナーさん", "そこの君"],
    "topic": ["好きな音楽", "好きな本", "好きな映画", "行ってみたい場所", "昔の思い出", "最近あった面白いこと", "好きな動物", "最近のマイブーム"],
    "reaction": ["すごいよね！", "びっくりだよね！", "面白いよねー", "なんでだろうね？", "不思議だよね！", "笑っちゃうよね！", "最高だよねー！", "信じられないよね！"]
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
    "{greeting}、{person}の {topic} について教えてほしいな！",
    "{time}ね、{topic} について考えてたんだけど、{reaction}",
    "たまには {action}。 みんなはどう思う？",
    "私ね、{food} を毎日食べても飽きない自信があるよ！",
    "{weather} の日って、無性に {food} が食べたくなるんだよねー",
    "{greeting}！ {person}は {weather} の日って好き？",
    "今、{feeling}…… {person}はどう？",
    "{time}の出来事、あとで詳しく話すね！ {reaction}"
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
    "朝起きたら {weather} だったよ！ {feeling}！",
    "おはよう！ {time}の朝ごはんは {food} だったんだー",
    "{greeting}！ 朝の挨拶って大事だよね！",
    "まだちょっと {feeling} けど、{action}！"
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
    "おやつに {food} を食べちゃおうかな！ {feeling}！",
    "お昼ご飯食べすぎちゃって、{feeling}……",
    "午後からは {action}！ {person}も一緒にどう？",
    "こんにちは！ {time}の午後は {weather} だね！"
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
    "寝る前に {topic} について話そっか！",
    "夜の {weather} って、なんだか {feeling} ね",
    "{time}の夢は {food} が出てくるといいなー",
    "おやすみ前に {action}！ {feeling}！"
]

words_zunda = words_normal.copy()
words_zunda["food"] = ["ずんだ餅", "枝豆", "ずんだシェイク", "ずんだアイス", "ずんだまんじゅう", "塩ゆで枝豆", "ずんだクレープ", "ずんだロールケーキ", "ずんだ大福", "ずんだフラペチーノ"]
words_zunda["greeting"] = ["ねえねえ", "あのねなのだ", "そういえばなのだ", "ちょっと聞いてほしいのだ", "みんな！", "あ！なのだ", "えっとねなのだ", "実はねなのだ", "ふふっ", "んー？なのだ"]
words_zunda["feeling"] = ["嬉しいのだ", "楽しいのだ", "ちょっと寂しいのだ", "元気いっぱいなのだよ", "眠いかもなのだ", "ワクワクするのだ", "ドキドキするのだ", "癒やされるのだ", "幸せなのだ", "不思議な気分なのだ", "のんびりしてるのだよ", "最高なのだ", "ウキウキするのだ", "ほっこりするのだ", "疲れちゃったかもなのだ"]
words_zunda["reaction"] = ["すごいのだ！", "びっくりなのだ！", "面白いのだー", "なんでだろうねなのだ？", "不思議なのだ！", "笑っちゃうのだ！", "最高なのだー！", "信じられないのだ！"]


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
    "{greeting}、{person}の {topic} について教えてほしいななのだ！",
    "{time}ね、{topic} について考えてたんだけど、{reaction}",
    "たまには {action}なのだ。 みんなはどう思うのだ？",
    "ボクね、{food} を毎日食べても飽きない自信があるのだよ！",
    "{weather} の日って、無性に {food} が食べたくなるのだよねー",
    "{greeting}！ {person}は {weather} の日って好きのだ？",
    "今、{feeling}…… {person}はどうなのだ？",
    "{time}の出来事、あとで詳しく話すのだ！ {reaction}"
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
    "朝起きたら {weather} だったのだ！ {feeling}！",
    "おはようなのだ！ {time}の朝ごはんは {food} だったんだーなのだ",
    "{greeting}！ 朝の挨拶って大事なのだ！",
    "まだちょっと {feeling} けど、{action}なのだ！"
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
    "おやつに {food} を食べちゃおうかななのだ！ {feeling}！",
    "お昼ご飯食べすぎちゃって、{feeling}……",
    "午後からは {action}なのだ！ {person}も一緒にどうなのだ？",
    "こんにちはなのだ！ {time}の午後は {weather} だねなのだ！"
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
    "寝る前に {topic} について話そっかなのだ！",
    "夜の {weather} って、なんだか {feeling} ねなのだ",
    "{time}の夢は {food} が出てくるといいなーなのだ",
    "おやすみ前に {action}なのだ！ {feeling}！"
]

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

content = "const NORMAL_PHRASES = " + json.dumps(NORMAL_PHRASES, ensure_ascii=False, indent=4) + ";\n\n"
content += "const NORMAL_LONG_STORIES = " + json.dumps(NORMAL_LONG_STORIES, ensure_ascii=False, indent=4) + ";\n\n"
content += "const ZUNDA_PHRASES = " + json.dumps(ZUNDA_PHRASES, ensure_ascii=False, indent=4) + ";\n\n"
content += "const ZUNDA_LONG_STORIES = " + json.dumps(ZUNDA_LONG_STORIES, ensure_ascii=False, indent=4) + ";\n"

with open('idle_phrases.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Generated NORMAL: {sum(len(v) for v in NORMAL_PHRASES.values())}")
print(f"Generated ZUNDA: {sum(len(v) for v in ZUNDA_PHRASES.values())}")
print(f"Total Phrases Generated (including long stories): {sum(len(v) for v in NORMAL_PHRASES.values()) + sum(len(v) for v in ZUNDA_PHRASES.values()) + sum(len(v) for v in NORMAL_LONG_STORIES.values()) + sum(len(v) for v in ZUNDA_LONG_STORIES.values())}")
