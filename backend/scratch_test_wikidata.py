import httpx
import asyncio

async def fetch_wikidata_image(query: str):
    search_url = "https://www.wikidata.org/w/api.php"
    search_params = {
        "action": "wbsearchentities",
        "search": query,
        "language": "id",
        "format": "json",
        "limit": 5
    }
    headers = {"User-Agent": "PaveyApp/1.0 (contact@pavey.app)"}
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(search_url, params=search_params, headers=headers, timeout=5.0)
            if res.status_code == 200:
                data = res.json()
                search_results = data.get("search", [])
                if search_results:
                    # Try the first few search results
                    for match in search_results:
                        entity_id = match.get("id")
                        print(f"Found Entity ID: {entity_id} for query '{query}' ({match.get('label')} - {match.get('description')})")
                        
                        # Fetch entity details
                        entity_url = f"https://www.wikidata.org/wiki/Special:EntityData/{entity_id}.json"
                        entity_res = await client.get(entity_url, headers=headers, timeout=5.0)
                        if entity_res.status_code == 200:
                            entity_data = entity_res.json()
                            claims = entity_data.get("entities", {}).get(entity_id, {}).get("claims", {})
                            
                            # P18 is the property code for 'image' in Wikidata
                            image_claims = claims.get("P18", [])
                            if image_claims:
                                img_filename = image_claims[0].get("mainsnak", {}).get("datavalue", {}).get("value")
                                if img_filename:
                                    # Convert filename to Wikimedia Commons image URL
                                    import hashlib
                                    # Spaces are replaced with underscores
                                    name_clean = img_filename.replace(" ", "_")
                                    md5 = hashlib.md5(name_clean.encode('utf-8')).hexdigest()
                                    a = md5[0]
                                    ab = md5[0:2]
                                    img_url = f"https://upload.wikimedia.org/wikipedia/commons/{a}/{ab}/{name_clean}"
                                    print("Wikidata Image URL:", img_url)
                                    return img_url
            else:
                print("Wikidata search request failed:", res.status_code)
    except Exception as e:
        print("Error fetching Wikidata images:", e)
    return None

if __name__ == "__main__":
    asyncio.run(fetch_wikidata_image("Monas"))
    asyncio.run(fetch_wikidata_image("Ubud"))
