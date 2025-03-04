from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, Tuple

class LocationBase(BaseModel):
    name: str
    description: Optional[str] = None
    latitude: float
    longitude: float

    @field_validator('latitude')
    def validate_latitude(cls, value):
        if value < -90 or value > 90:
            raise ValueError("Latitude must be between -90 and 90 degrees")
        return value

    @field_validator('longitude')
    def validate_longitude(cls, value):
        if value < -180 or value > 180:
            raise ValueError("Longitude must be between -180 and 180 degrees")
        return value

class LocationCreate(LocationBase):
    pass

class Location(LocationBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    @property
    def coordinates(self) -> Tuple[float, float]:
        return (self.longitude, self.latitude)

    class Config:
        from_attributes = True

class NearbyLocationsRequest(BaseModel):
    latitude: float
    longitude: float
    radius: float  # in meters

    @field_validator('radius')
    def validate_radius(cls, value):
        if value <= 0:
            raise ValueError("Radius must be greater than 0 meters")
        if value > 100000:  # 100 km limit
            raise ValueError("Radius must not exceed 100 kilometers")
        return value
