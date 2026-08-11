import asyncio
import os
import certifi
os.environ['SSL_CERT_FILE'] = certifi.where()
from TikTokLive import TikTokLiveClient
from TikTokLive.events import ConnectEvent

client = TikTokLiveClient(unique_id="@rkbnews4ch")
@client.on(ConnectEvent)
async def on_connect(event):
    print("Connected")

async def main():
    await client.connect()

asyncio.run(main())
