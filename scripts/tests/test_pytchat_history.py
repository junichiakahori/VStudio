import pytchat
import time

chat = pytchat.create(video_id="gQNdGuV8YgQ")
print("Listening to chat...")
start_time = time.time()
while chat.is_alive():
    for c in chat.get().sync_items():
        print(f"[{c.datetime}] {c.author.name}: {c.message}")
    if time.time() - start_time > 10:
        break
    time.sleep(1)
print("Done")
