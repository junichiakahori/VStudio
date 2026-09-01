import requests
import re
import sys

video_id = sys.argv[1]
url = f"https://www.youtube.com/watch?v={video_id}"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept-Language": "en-US,en;q=0.9"
}
html = requests.get(url, headers=headers).text

concurrent = re.search(r'"viewCount":\{"videoViewCountRenderer":\{"viewCount":\{"runs":\[\{"text":"([\d,]+)"\}', html)
if concurrent:
    print("concurrent regex 1:", concurrent.group(1))

concurrent2 = re.search(r'"viewCountText":\{"runs":\[\{"text":"([\d,]+)"\}', html)
if concurrent2:
    print("concurrent regex 2:", concurrent2.group(1))

# total views
player_match = re.search(r'ytInitialPlayerResponse\s*=\s*(\{.*?\});(?:var|</script>)', html)
if player_match:
    import json
    player = json.loads(player_match.group(1))
    videoDetails = player.get("videoDetails", {})
    print("videoDetails viewCount:", videoDetails.get("viewCount"))
