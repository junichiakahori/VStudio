import pytchat
import time

video_id = "wJMInpkckWM" # Replace with known archived video ID if needed
try:
    chat = pytchat.create(video_id=video_id)
    print("is_alive:", chat.is_alive())
    if chat.is_alive():
        for c in chat.get().sync_items():
            print(f"{c.datetime} [{c.author.name}]- {c.message}")
            break
except Exception as e:
    print("Error:", e)
