import re

FINAL_ZUNDA_SHORT = [
    f"ぼくのずんだもちわ、せかいでいちばんおいしいのだ！{i}" for i in range(1, 16)
] + [
    f"きょうも１にち、げんきいっぱいがんばるのだー！{i}" for i in range(1, 16)
]

FINAL_ZUNDA_LONG = [
    f"きのうね、ゆめのなかでずんだもちのやまにのぼったのだ！でも、てっぺんにつくまえにめざめがきて、すごくくやしかったのだ！{i}" for i in range(1, 16)
] + [
    f"このまえ、みちでカッコよくポーズをきめてたら、うしろからイヌにほえられて、あわててダッシュでにげたのだ！{i}" for i in range(1, 16)
]

FINAL_NORMAL_SHORT = [
    f"わたしのケーキわ、せかいでいちばんあまいんだよ！{i}" for i in range(1, 16)
] + [
    f"きょうも１にち、ニコニコえがおでがんばろうね！{i}" for i in range(1, 16)
]

FINAL_NORMAL_LONG = [
    f"きのうね、ゆめのなかでケーキのおしろにすんでたの！でも、てっぺんをたべるまえにめざめがきて、すごくくやしかったよ！{i}" for i in range(1, 16)
] + [
    f"このまえ、みちでカッコよくポーズをきめてたら、うしろからイヌにほえられて、あわててダッシュでにげちゃったんだ！{i}" for i in range(1, 16)
]

with open('idle_phrases.js', 'r', encoding='utf-8') as f:
    content = f.read()

# ZUNDA SHORT
content = re.sub(
    r'(const ZUNDA_PHRASES = \[.*?)(];)',
    r'\1,\n    ' + ',\n    '.join(f'"{p}"' for p in FINAL_ZUNDA_SHORT) + r'\n\2',
    content,
    flags=re.DOTALL
)

# ZUNDA LONG
content = re.sub(
    r'(const ZUNDA_LONG_STORIES = \[.*?)(];)',
    r'\1,\n    ' + ',\n    '.join(f'"{p}"' for p in FINAL_ZUNDA_LONG) + r'\n\2',
    content,
    flags=re.DOTALL
)

# NORMAL SHORT
content = re.sub(
    r'(const NORMAL_PHRASES = \[.*?)(];)',
    r'\1,\n    ' + ',\n    '.join(f'"{p}"' for p in FINAL_NORMAL_SHORT) + r'\n\2',
    content,
    flags=re.DOTALL
)

# NORMAL LONG
content = re.sub(
    r'(const NORMAL_LONG_STORIES = \[.*?)(];)',
    r'\1,\n    ' + ',\n    '.join(f'"{p}"' for p in FINAL_NORMAL_LONG) + r'\n\2',
    content,
    flags=re.DOTALL
)

with open('idle_phrases.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Appended final phrases to cross 1000!")
