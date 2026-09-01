import json, requests

def synth(text, name):
    res = requests.post(f"http://127.0.0.1:50021/audio_query?text={text}&speaker=3")
    query = res.json()
    
    # Save original audio
    r1 = requests.post("http://127.0.0.1:50021/synthesis?speaker=3", json=query)
    with open(f"{name}_orig.wav", "wb") as f:
        f.write(r1.content)

    # Modify accent to 1
    query['accent_phrases'][-1]['accent'] = 1
    
    r2 = requests.post("http://127.0.0.1:50021/synthesis?speaker=3", json=query)
    with open(f"{name}_accent1.wav", "wb") as f:
        f.write(r2.content)

synth("なのだ", "nanoda")
