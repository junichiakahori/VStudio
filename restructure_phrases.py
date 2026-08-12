import re

def restructure():
    with open("idle_phrases.js", "r", encoding="utf-8") as f:
        text = f.read()

    patterns = {
        "NORMAL_PHRASES": r"const NORMAL_PHRASES = \[(.*?)\];",
        "NORMAL_LONG_STORIES": r"const NORMAL_LONG_STORIES = \[(.*?)\];",
        "ZUNDA_PHRASES": r"const ZUNDA_PHRASES = \[(.*?)\];",
        "ZUNDA_LONG_STORIES": r"const ZUNDA_LONG_STORIES = \[(.*?)\];"
    }

    new_js = ""

    for name, pattern in patterns.items():
        match = re.search(pattern, text, re.DOTALL)
        if not match: continue
        # Split by '",' taking care of newlines
        raw_items = re.findall(r'"(.*?)"', match.group(1), re.DOTALL)
        
        morning = []
        afternoon = []
        night = []
        general = []
        
        for p in raw_items:
            # clean up newlines if any
            p = p.replace("\n", "").strip()
            if not p: continue
            
            if re.search(r"おはよう|あさごはん|あさおき|あさまで", p):
                morning.append(p)
            elif re.search(r"こんにちは|おひるごはん|おひるね|おてんき|さんぽちゅう", p):
                afternoon.append(p)
            elif re.search(r"こんばんは|おやすみ|よるごはん|ばんごはん|ほし|ねるまえ|よるよなか|よるに|よるになって", p):
                night.append(p)
            else:
                general.append(p)
                
        new_js += f"const {name} = {{\n"
        new_js += "    general: [\n        " + ",\n        ".join(f'"{p}"' for p in general) + "\n    ],\n"
        new_js += "    morning: [\n        " + ",\n        ".join(f'"{p}"' for p in morning) + "\n    ],\n"
        new_js += "    afternoon: [\n        " + ",\n        ".join(f'"{p}"' for p in afternoon) + "\n    ],\n"
        new_js += "    night: [\n        " + ",\n        ".join(f'"{p}"' for p in night) + "\n    ]\n"
        new_js += "};\n\n"

    with open("idle_phrases.js", "w", encoding="utf-8") as f:
        f.write(new_js)

restructure()
print("Restructured idle_phrases.js successfully.")
