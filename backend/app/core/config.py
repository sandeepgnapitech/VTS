from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Make authentication fields optional
    DATABASE_URL: Optional[str] = None
    SECRET_KEY: Optional[str] = None
    ALGORITHM: Optional[str] = None
    ACCESS_TOKEN_EXPIRE_MINUTES: Optional[int] = None
    
    # MQTT Settings
    MQTT_BROKER: str = "localhost"  # Local Mosquitto broker
    MQTT_PORT: int = 1883
    MQTT_TOPIC: str = "device/+/data"
    MQTT_CLIENT_ID: str = "mapapp_service"

    class Config:
        env_file = ".env"

settings = Settings()
