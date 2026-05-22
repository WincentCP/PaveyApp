from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth
from routers import auth, trips
from routers import auth, trips, weather
from routers import auth, trips, weather, wallet
from routers import auth, trips, weather, wallet, chatbot

app = FastAPI(title="Pavey API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(trips.router, prefix="/trips", tags=["Trips"])
app.include_router(weather.router, prefix="/weather", tags=["Weather"])
app.include_router(wallet.router, prefix="/wallet", tags=["Wallet"])
app.include_router(chatbot.router, prefix="/chatbot", tags=["Chatbot"])
app.include_router(wallet.router, prefix="/wallet", tags=["Wallet"])

@app.get("/")
def root():
    return {"status": "Pavey API is running"}