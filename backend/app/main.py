from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import location, device, device_log
from .core.database import engine
from .models import location as location_model, device as device_model, device_log as device_log_model

# Create database tables
location_model.Base.metadata.create_all(bind=engine)
device_model.Base.metadata.create_all(bind=engine)
device_log_model.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MapApp API")

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(location.router)
app.include_router(device.router)
app.include_router(device_log.router)

@app.get("/")
async def root():
    return {"message": "Welcome to MapApp API"}
