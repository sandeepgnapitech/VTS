from sqlalchemy import Column, Integer, JSON, ForeignKey, DateTime
import datetime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..core.database import Base
from .device import Device  # Import the Device model

class DeviceLog(Base):
    __tablename__ = "device_logs"

    id = Column(Integer, primary_key=True, index=True)
    deviceid = Column(UUID(as_uuid=True), ForeignKey("devices.deviceid"))
    data = Column(JSON)
    time_log = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationship to Device model
    device = relationship(Device, back_populates="logs")
