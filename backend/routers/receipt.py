from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi import Form
from services.supabase_client import supabase
from services.gemini_service import analyze_image
from middleware.auth_middleware import get_current_user
from typing import Optional
import json

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
        Kamu adalah AI scanner struk belanja.
        Analisis gambar struk ini dan extract informasi berikut dalam format JSON:
        {
            "merchant_name": "nama toko/restoran",
            "total_amount": 0,
            "currency": "IDR",
            "items": [
                {"name": "nama item", "price": 0, "quantity": 1}
            ],
            "date": "tanggal transaksi jika ada"
        }
        Hanya return JSON saja, tidak perlu penjelasan lain.
        Jika tidak bisa dibaca, return {"error": "Struk tidak terbaca"}.
        """

        result_text = await analyze_image(image_bytes, prompt)
        clean = result_text.strip().replace("```json", "").replace("```", "")
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

    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Gagal parse hasil scan")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))