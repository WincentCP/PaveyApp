from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi import Form
from services.supabase_client import supabase
from services.gemini_service import analyze_image
from middleware.auth_middleware import get_current_user
from typing import Optional
import json
import re

router = APIRouter()

@router.post("/scan")
async def scan_receipt(
    file: UploadFile = File(...),
    trip_id: Optional[str] = Form(None),
    current_user = Depends(get_current_user)
):
    try:
        image_bytes = await file.read()

        prompt = """
        You are a receipt scanner AI.
        Analyze this receipt image and extract the following information in JSON format:
        {
            "merchant_name": "store/restaurant name",
            "total_amount": 0,
            "currency": "IDR",
            "items": [
                {"name": "item name", "price": 0, "quantity": 1}
            ],
            "date": "transaction date if available"
        }
        Return ONLY the raw JSON object, no explanation, no markdown, no code blocks.
        If the receipt cannot be read, return {"error": "Struk tidak terbaca"}.
        """

        result_text = await analyze_image(image_bytes, prompt)
        print(f"[Receipt Debug] Raw response: {repr(result_text)}")

        # Bersihkan markdown code block
        clean = result_text.strip().replace("```json", "").replace("```", "").strip()

        # Ekstrak JSON object dari dalam teks jika model nulis teks tambahan
        json_match = re.search(r'\{.*\}', clean, re.DOTALL)
        if json_match:
            clean = json_match.group(0)

        print(f"[Receipt Debug] Clean JSON: {repr(clean)}")
        result = json.loads(clean)

        if trip_id and "total_amount" in result and not result.get("error"):
            supabase.table("expenses").insert({
                "user_id": current_user.id,
                "trip_id": trip_id,
                "amount": int(result["total_amount"]),
                "category": "receipt_scan",
                "description": f"Scan struk: {result.get('merchant_name', 'Unknown')}"
            }).execute()

        return result

    except json.JSONDecodeError as e:
        print(f"[Receipt Debug] JSONDecodeError: {e}")
        raise HTTPException(status_code=422, detail="Gagal parse hasil scan")
    except Exception as e:
        print(f"[Receipt Debug] Exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))