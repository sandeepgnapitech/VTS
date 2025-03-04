from sqlalchemy import Column, Integer, String, JSON, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from ..core.database import Base

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    deviceid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False)
    name = Column(String, index=True)
    description = Column(String)
    data = Column(JSON)
    lat = Column(Float)
    lon = Column(Float)
    address = Column(String)
    
    # Relationship to DeviceLogs
    logs = relationship("DeviceLog", back_populates="device")
