from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from supabase import create_client
import os
from dotenv import load_dotenv
from typing import Optional
from datetime import date

load_dotenv()
router = APIRouter()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

class TripCreate(BaseModel):
    destination: str
    start_date: date
    end_date: date
    vibe: str
    budget_min: int
    budget_max: int

@router.post("/")
async def create_trip(data: TripCreate, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = supabase.auth.get_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    user_id = user.user.id
    res = supabase.table("trips").insert({
        "user_id": user_id,
        "destination": data.destination,
        "start_date": str(data.start_date),
        "end_date": str(data.end_date),
        "vibe": data.vibe,
        "budget_min": data.budget_min,
        "budget_max": data.budget_max,
        "status": "planning"
    }).execute()
    
    return {"trip_id": res.data[0]["id"], "message": "Trip berhasil dibuat"}

@router.get("/{trip_id}/itinerary")
async def get_itinerary(trip_id: str, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user = supabase.auth.get_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    res = supabase.table("itinerary_items")\
        .select("*")\
        .eq("trip_id", trip_id)\
        .order("day_number")\
        .order("order_index")\
        .execute()
    
    # Group by day
    days = {}
    for item in res.data:
        day = item["day_number"]
        if day not in days:
            days[day] = []
        days[day].append(item)
    
    return {"trip_id": trip_id, "itinerary": days}