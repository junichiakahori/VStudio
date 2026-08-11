import asyncio
import os
import certifi
os.environ['SSL_CERT_FILE'] = certifi.where()
from TikTokLive import TikTokLiveClient
from TikTokLive.events import CommentEvent

client = TikTokLiveClient(unique_id="@awasatohazumi")

@client.on(CommentEvent)
async def on_comment(event: CommentEvent):
    print(f"[Comment] {event.user.nickname}: {event.comment}")

asyncio.run(client.start())
