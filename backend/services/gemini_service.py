import google.generativeai as genai
import os
from dotenv import load_dotenv
import PIL.Image
import io

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def generate_text(prompt: str, system_prompt: str = "") -> str:
    model = genai.GenerativeModel("gemini-2.0-flash")
    full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
    response = model.generate_content(full_prompt)
    return response.text

async def analyze_image(image_bytes: bytes, prompt: str) -> str:
    model = genai.GenerativeModel("gemini-2.0-flash")
    image = PIL.Image.open(io.BytesIO(image_bytes))
    response = model.generate_content([prompt, image])
    return response.text