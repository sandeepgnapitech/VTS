from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy import func
from ..core.database import get_db
from ..models.location import Location as LocationModel
from ..schemas.location import Location, LocationCreate, NearbyLocationsRequest

router = APIRouter(
    prefix="/locations",
    tags=["locations"]
)

@router.post("/", response_model=Location)
def create_location(location: LocationCreate, db: Session = Depends(get_db)):
    # Create a PostGIS geometry point from latitude and longitude
    point = Point(location.longitude, location.latitude)
    
    db_location = LocationModel(
        name=location.name,
        description=location.description,
        geometry=from_shape(point, srid=4326)
    )
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location

@router.get("/", response_model=List[Location])
def read_locations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    locations = db.query(LocationModel).offset(skip).limit(limit).all()
    return locations

@router.get("/{location_id}", response_model=Location)
def read_location(location_id: int, db: Session = Depends(get_db)):
    db_location = db.query(LocationModel).filter(LocationModel.id == location_id).first()
    if db_location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return db_location

@router.put("/{location_id}", response_model=Location)
def update_location(location_id: int, location: LocationCreate, db: Session = Depends(get_db)):
    db_location = db.query(LocationModel).filter(LocationModel.id == location_id).first()
    if db_location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    
    # Update geometry point
    point = Point(location.longitude, location.latitude)
    
    db_location.name = location.name
    db_location.description = location.description
    db_location.geometry = from_shape(point, srid=4326)
    
    db.commit()
    db.refresh(db_location)
    return db_location

@router.delete("/{location_id}")
def delete_location(location_id: int, db: Session = Depends(get_db)):
    db_location = db.query(LocationModel).filter(LocationModel.id == location_id).first()
    if db_location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    
    db.delete(db_location)
    db.commit()
    return {"message": "Location deleted successfully"}

@router.post("/nearby", response_model=List[Location])
def find_nearby_locations(request: NearbyLocationsRequest, db: Session = Depends(get_db)):
    """Find locations within a specified radius (in meters) of a point"""
    point = Point(request.longitude, request.latitude)
    point_wgs84 = from_shape(point, srid=4326)
    
    # ST_DWithin uses geometry type and distance in meters
    nearby_locations = db.query(LocationModel).filter(
        func.ST_DWithin(
            func.ST_Transform(LocationModel.geometry, 3857),  # Transform to Web Mercator
            func.ST_Transform(point_wgs84, 3857),  # Transform search point
            request.radius  # radius in meters
        )
    ).all()
    
    return nearby_locations
