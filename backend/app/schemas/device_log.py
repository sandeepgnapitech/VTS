from pydantic import BaseModel, UUID4
from typing import Dict, Optional
from datetime import datetime

class DeviceLogBase(BaseModel):
    deviceid: UUID4
    data: Dict

class DeviceLogCreate(DeviceLogBase):
    pass

class DeviceLog(DeviceLogBase):
    id: int
    time_log: datetime

    class Config:
        from_attributes = True
