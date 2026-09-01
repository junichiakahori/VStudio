import re

with open("youtube_comment_server.py", "r") as f:
    code = f.read()

# 1. Imports and global
code = code.replace(
    "import pytchat\n\nlogging",
    "import pytchat\nimport requests\nimport re\n\nlogging"
)

code = code.replace(
    "chat_task: Optional[asyncio.Task] = None",
    "chat_task: Optional[asyncio.Task] = None\nstats_task: Optional[asyncio.Task] = None"
)

# 2. Add fetch_stats
stats_func = """
async def fetch_stats(video_id):
    try:
        while True:
            url = f"https://www.youtube.com/watch?v={video_id}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept-Language": "en-US,en;q=0.9"
            }
            try:
                html = requests.get(url, headers=headers, timeout=10).text
                viewers = ""
                subscribers = ""
                
                player_match = re.search(r'ytInitialPlayerResponse\s*=\s*(\{.*?\});(?:var|</script>)', html)
                if player_match:
                    import json
                    try:
                        player = json.loads(player_match.group(1))
                        videoDetails = player.get("videoDetails", {})
                        viewers = videoDetails.get("viewCount", "")
                    except Exception as e:
                        logging.error(f"Error parsing player response: {e}")

                data_match = re.search(r'ytInitialData\s*=\s*(\{.*?\});(?:var|</script>)', html)
                if data_match:
                    try:
                        sub_match1 = re.search(r'"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"\}\}', html)
                        if sub_match1:
                            subscribers = sub_match1.group(1)
                        else:
                            sub_match2 = re.search(r'"subscriberCountText":\{"simpleText":"([^"]+)"\}', html)
                            if sub_match2:
                                subscribers = sub_match2.group(1)
                    except Exception as e:
                        pass
                
                await broadcast_to_clients({
                    "type": "stats",
                    "viewers": viewers,
                    "subscribers": subscribers
                })
            except Exception as e:
                logging.error(f"Error fetching stats: {e}")
                
            await asyncio.sleep(30)
    except asyncio.CancelledError:
        pass

async def start_youtube_client"""

code = code.replace("async def start_youtube_client", stats_func)

# 3. start / stop logic
code = code.replace(
    "global chat_task, chat, comment_history, recent_comments",
    "global chat_task, stats_task, chat, comment_history, recent_comments"
)

code = code.replace(
    "chat_task = asyncio.create_task(fetch_chat())",
    "chat_task = asyncio.create_task(fetch_chat())\n    stats_task = asyncio.create_task(fetch_stats(video_id))"
)

code = code.replace(
    "global chat_task, chat",
    "global chat_task, stats_task, chat"
)

code = code.replace(
    "chat_task = None",
    "chat_task = None\n    if stats_task:\n        stats_task.cancel()\n        stats_task = None"
)

with open("youtube_comment_server.py", "w") as f:
    f.write(code)

print("Patched youtube_comment_server.py")
