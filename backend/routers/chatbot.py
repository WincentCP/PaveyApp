from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from supabase import create_client
import google.generativeai as genai
import os
from dotenv import load_dotenv
from typing import Optional

load_dotenv()
router = APIRouter()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
security = HTTPBearer()

class ChatMessage(BaseModel):
    message: str
    trip_id: Optional[str] = None

@router.post("/message")
async def chat(
    data: ChatMessage,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        token = credentials.credentials
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Unauthorized")

        itinerary_context = ""
        if data.trip_id:
            res = supabase.table("itinerary_items")\
                .select("*")\
                .eq("trip_id", data.trip_id)\
                .order("day_number")\
                .execute()
            if res.data:
                itinerary_context = f"Itinerary aktif user: {res.data}"

        system_prompt = f"""
        Kamu adalah Pavey, AI travel buddy yang membantu wisatawan Indonesia.
        Jawab dalam Bahasa Indonesia, ramah, dan spesifik.
        {f'Konteks perjalanan user saat ini: {itinerary_context}' if itinerary_context else ''}
        Jangan jawab hal di luar konteks perjalanan wisata.
        """

        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(f"{system_prompt}\n\nUser: {data.message}")

        return {"reply": response.text}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))