import re

with open('idle_phrases.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
pattern = re.compile(r'^[ \t]*".*?[^\d]\d+"(,|)\n?$')

for line in lines:
    if pattern.match(line):
        continue
    new_lines.append(line)

with open('idle_phrases.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Duplicates removed!")
