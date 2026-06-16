import os
import sys
from dotenv import load_dotenv

# Load env for GEMINI_API_KEY
load_dotenv('d:/PaveyApp/backend/.env')

from services.paddleocr_service import extract_text_from_image

image_path = 'C:/Users/Imagination/.gemini/antigravity-ide/brain/49a89f78-501d-4072-b308-fd5d5aab548c/media__1781602874815.jpg'

with open(image_path, 'rb') as f:
    img_bytes = f.read()

print('Calling OCR...')
try:
    text = extract_text_from_image(img_bytes)
    print('RESULT:')
    print(text)
except Exception as e:
    print('ERROR:', str(e))
