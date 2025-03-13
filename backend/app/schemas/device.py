from pydantic import BaseModel, UUID4
from typing import Optional, Dict

class DeviceBase(BaseModel):
    name: str
    description: Optional[str] = None
    data: Optional[Dict] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    address: Optional[str] = None

class DeviceCreate(DeviceBase):
    pass

class Device(DeviceBase):
    id: int
    deviceid: UUID4

    class Config:
        from_attributes = True
