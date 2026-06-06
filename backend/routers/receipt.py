from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from services.supabase_client import supabase
from services.gemini_service import analyze_image
from services.llama_service import chat_with_llama
from middleware.auth_middleware import get_current_user
from typing import Optional
import json
import re

router = APIRouter()

@router.post("/scan")
async def scan_receipt(
    file: UploadFile = File(...),
    trip_id: Optional[str] = Form(None),
    function: Optional[str] = Form("extract"),
    num_people: Optional[int] = Form(None),
    target_currency: Optional[str] = Form(None),
    target_language: Optional[str] = Form(None),
    current_user = Depends(get_current_user)
):
    try:
        image_bytes = await file.read()

        extract_prompt = """
You are a receipt scanner AI.
Analyze this receipt image and extract information as raw JSON only.
No explanation, no markdown, no code blocks.

Format:
{
    "merchant_name": "store name",
    "total_amount": 0,
    "currency": "IDR",
    "items": [
        {"name": "item name", "price": 0, "quantity": 1}
    ],
    "date": "transaction date or null"
}

If unreadable: {"error": "Struk tidak terbaca"}
        """

        result_text = await analyze_image(image_bytes, extract_prompt)
        clean = re.sub(r"```json\s*|```\s*", "", result_text.strip()).strip()
        json_match = re.search(r'\{.*\}', clean, re.DOTALL)
        if json_match:
            clean = json_match.group(0)

        base_result = json.loads(clean)

        if base_result.get("error"):
            return base_result

        if function == "split_bill" and num_people and num_people > 1:
            split_prompt = f"""
Berikut adalah data struk belanja dalam JSON:
{json.dumps(base_result, ensure_ascii=False)}

Bagi tagihan ini untuk {num_people} orang dengan adil.
Kembalikan HANYA JSON mentah, tanpa penjelasan:
{{
    "total_amount": 0,
    "currency": "IDR",
    "num_people": {num_people},
    "per_person": 0,
    "breakdown": [
        {{"person": 1, "amount": 0, "items": []}}
    ]
}}
            """
            split_text = chat_with_llama(split_prompt)
            split_clean = re.sub(r"```json\s*|```\s*", "", split_text.strip()).strip()
            split_match = re.search(r'\{.*\}', split_clean, re.DOTALL)
            if split_match:
                split_result = json.loads(split_match.group(0))
                base_result["split_bill"] = split_result

        elif function == "currency" and target_currency:
            currency_prompt = f"""
Data struk: {json.dumps(base_result, ensure_ascii=False)}

Konversi semua harga dari {base_result.get('currency', 'IDR')} ke {target_currency}.
Gunakan estimasi kurs yang reasonable.
Kembalikan HANYA JSON mentah:
{{
    "original_currency": "{base_result.get('currency', 'IDR')}",
    "target_currency": "{target_currency}",
    "exchange_rate_estimate": 0,
    "total_converted": 0,
    "items_converted": [
        {{"name": "item name", "original_price": 0, "converted_price": 0}}
    ]
}}
            """
            currency_text = chat_with_llama(currency_prompt)
            currency_clean = re.sub(r"```json\s*|```\s*", "", currency_text.strip()).strip()
            currency_match = re.search(r'\{.*\}', currency_clean, re.DOTALL)
            if currency_match:
                base_result["currency_conversion"] = json.loads(currency_match.group(0))

        elif function == "translate" and target_language:
            translate_prompt = f"""
Data struk: {json.dumps(base_result, ensure_ascii=False)}

Terjemahkan semua nama item ke bahasa {target_language}.
Kembalikan HANYA JSON mentah:
{{
    "merchant_name": "translated name",
    "items_translated": [
        {{"original": "original name", "translated": "translated name", "price": 0}}
    ]
}}
            """
            translate_text = chat_with_llama(translate_prompt)
            translate_clean = re.sub(r"```json\s*|```\s*", "", translate_text.strip()).strip()
            translate_match = re.search(r'\{.*\}', translate_clean, re.DOTALL)
            if translate_match:
                base_result["translation"] = json.loads(translate_match.group(0))

        if trip_id and "total_amount" in base_result:
            supabase.table("expenses").insert({
                "user_id": current_user.id,
                "trip_id": trip_id,
                "amount": int(float(base_result["total_amount"])),
                "category": "receipt_scan",
                "description": f"Scan struk: {base_result.get('merchant_name', 'Unknown')}"
            }).execute()

        return base_result

    except json.JSONDecodeError as e:
        print(f"[Receipt] JSONDecodeError: {e}")
        raise HTTPException(status_code=422, detail="Gagal parse hasil scan")
    except Exception as e:
        print(f"[Receipt] Exception: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=str(e))