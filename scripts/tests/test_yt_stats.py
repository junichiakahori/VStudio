import requests
import json
import re

def get_yt_stats(video_id):
    url = f"https://www.youtube.com/watch?v={video_id}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
    }
    html = requests.get(url, headers=headers).text
    
    # Try ytInitialPlayerResponse
    player_match = re.search(r'ytInitialPlayerResponse\s*=\s*(\{.*?\});(?:var|</script>)', html)
    if player_match:
        try:
            player = json.loads(player_match.group(1))
            videoDetails = player.get("videoDetails", {})
            print("Title:", videoDetails.get("title"))
            print("Author:", videoDetails.get("author"))
            print("ViewCount (or concurrent if live):", videoDetails.get("viewCount"))
            print("IsLive:", videoDetails.get("isLiveContent"))
        except Exception as e:
            print("error", e)

    # Try to find subscriber count in ytInitialData
    data_match = re.search(r'ytInitialData\s*=\s*(\{.*?\});(?:var|</script>)', html)
    if data_match:
        try:
            data = json.loads(data_match.group(1))
            # Just print the first 200 chars to see if we got it
            # Subscriber count usually in subscriberCountText
            match = re.search(r'"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"\}\}', html)
            if match:
                print("Subscribers:", match.group(1))
            else:
                match2 = re.search(r'"subscriberCountText":\{"simpleText":"([^"]+)"\}', html)
                if match2:
                    print("Subscribers:", match2.group(1))
        except Exception as e:
            print("error", e)
            
get_yt_stats("gQNdGuV8YgQ")
