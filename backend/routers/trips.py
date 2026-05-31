import httpx
import os

@router.post("/{trip_id}/generate")
async def generate_itinerary(
    trip_id: str,
    current_user = Depends(get_current_user)
):
    try:
        # 1. Ambil data trip dari DB
        trip = supabase.table("trips")\
            .select("*")\
            .eq("id", trip_id)\
            .eq("user_id", current_user.id)\
            .single()\
            .execute()

        if not trip.data:
            raise HTTPException(status_code=404, detail="Trip tidak ditemukan")

        t = trip.data

        # 2. Hit AI-core Wishal
        ai_core_url = os.getenv("AI_CORE_URL", "http://localhost:8080")

        async with httpx.AsyncClient(timeout=60.0) as client:
            ai_response = await client.post(
                f"{ai_core_url}/api/v1/itinerary",
                json={
                    "city": t["destination"],
                    "starting_time": "09:00",
                    "preference": t["vibe"]
                }
            )

        if ai_response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"AI Core error: {ai_response.text}"
            )

        itinerary_data = ai_response.json()

        # 3. Hapus itinerary lama kalau ada
        supabase.table("itinerary_items")\
            .delete()\
            .eq("trip_id", trip_id)\
            .execute()

        # 4. Simpan itinerary baru ke DB
        items_to_insert = []
        for item in itinerary_data.get("itinerary", []):
            items_to_insert.append({
                "trip_id": trip_id,
                "day_number": 1,  # Wishal generate per hari, nanti bisa di-loop
                "order_index": item.get("step", 0),
                "place_name": item.get("name", ""),
                "place_type": item.get("type", "destination"),
                "start_time": item.get("arrival_time", ""),
                "duration_minutes": item.get("duration_spent_minutes", 60),
                "travel_time_to_next": item.get("travel_time_to_next_minutes", 0),
                "description": item.get("activity_todo", ""),
            })

        if items_to_insert:
            supabase.table("itinerary_items").insert(items_to_insert).execute()

        # 5. Update status trip
        supabase.table("trips")\
            .update({"status": "generated"})\
            .eq("id", trip_id)\
            .execute()

        return {
            "message": "Itinerary berhasil digenerate",
            "trip_id": trip_id,
            "weather_mode": itinerary_data.get("weather_mode", ""),
            "itinerary": itinerary_data.get("itinerary", [])
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))