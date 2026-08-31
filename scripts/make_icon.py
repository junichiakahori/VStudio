import os
import sys
import subprocess
from PIL import Image, ImageDraw, ImageOps

def create_icns(source_png, output_icns):
    iconset_dir = "AppIcon.iconset"
    os.makedirs(iconset_dir, exist_ok=True)
    
    img = Image.open(source_png).convert("RGBA")
    
    # Create square canvas with rounded corners or nice background
    size = max(img.size)
    square_img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    # Center image
    offset = ((size - img.width) // 2, (size - img.height) // 2)
    square_img.paste(img, offset, img)
    
    sizes = [
        (16, "icon_16x16.png"),
        (32, "icon_16x16@2x.png"),
        (32, "icon_32x32.png"),
        (64, "icon_32x32@2x.png"),
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"),
        (512, "icon_256x256@2x.png"),
        (512, "icon_512x512.png"),
        (1024, "icon_512x512@2x.png"),
    ]
    
    for s, name in sizes:
        resized = square_img.resize((s, s), Image.Resampling.LANCZOS)
        resized.save(os.path.join(iconset_dir, name))
        
    subprocess.run(["iconutil", "-c", "icns", iconset_dir, "-o", output_icns], check=True)
    
    # Cleanup iconset
    for name in os.listdir(iconset_dir):
        os.remove(os.path.join(iconset_dir, name))
    os.rmdir(iconset_dir)
    print(f"Created {output_icns} successfully.")

if __name__ == "__main__":
    src = "assets/avatar.png" if os.path.exists("assets/avatar.png") else "assets/girl.png"
    create_icns(src, "AppIcon.icns")
