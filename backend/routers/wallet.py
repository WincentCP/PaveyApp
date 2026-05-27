from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
security = HTTPBearer()

class ExpenseCreate(BaseModel):
    trip_id: str
    amount: int
    category: str
    description: str

@router.post("/expenses")
async def add_expense(
    data: ExpenseCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        token = credentials.credentials
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Unauthorized")

        res = supabase.table("expenses").insert({
            "user_id": user.user.id,
            "trip_id": data.trip_id,
            "amount": data.amount,
            "category": data.category,
            "description": data.description
        }).execute()

        return {"message": "Expense berhasil ditambahkan", "data": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/expenses/{trip_id}")
async def get_expenses(
    trip_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        token = credentials.credentials
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Unauthorized")

        res = supabase.table("expenses")\
            .select("*")\
            .eq("trip_id", trip_id)\
            .eq("user_id", user.user.id)\
            .order("created_at", desc=True)\
            .execute()

        total = sum(item["amount"] for item in res.data)

        return {
            "trip_id": trip_id,
            "total_spent_idr": total,
            "transactions": res.data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))