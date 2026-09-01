import requests
import re
import json

url = "https://www.youtube.com/live_chat?is_popout=1&v=gQNdGuV8YgQ"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9"
}
html = requests.get(url, headers=headers).text

match = re.search(r'window\["ytInitialData"\]\s*=\s*(\{.*?\});\s*</script>', html)
if match:
    data = json.loads(match.group(1))
    actions = data.get("contents", {}).get("liveChatRenderer", {}).get("actions", [])
    
    comments = []
    for action in actions:
        item = action.get("addChatItemAction", {}).get("item", {})
        if "liveChatTextMessageRenderer" in item:
            renderer = item["liveChatTextMessageRenderer"]
            author = renderer.get("authorName", {}).get("simpleText", "")
            message = "".join([r.get("text", "") for r in renderer.get("message", {}).get("runs", [])])
            comments.append(f"{author}: {message}")
            
    print(f"Found {len(comments)} initial messages:")
    for c in comments:
        print(" - " + c)
else:
    print("ytInitialData not found. Snippet:")
    for line in html.split('\n'):
        if "ytInitialData" in line:
            print(line[:200])
