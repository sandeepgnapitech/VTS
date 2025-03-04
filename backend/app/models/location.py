from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from geoalchemy2.shape import to_shape
from ..core.database import Base

class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    geometry = Column(Geometry('POINT', srid=4326))  # SRID 4326 is for WGS84 (lat/long)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @property
    def latitude(self) -> float:
        point = to_shape(self.geometry)
        return point.y

    @property
    def longitude(self) -> float:
        point = to_shape(self.geometry)
        return point.x
