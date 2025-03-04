from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..models import device as device_model
from ..schemas import device as device_schema
import uuid

router = APIRouter()

@router.post("/device/", response_model=device_schema.Device)
def create_device(device: device_schema.DeviceCreate, db: Session = Depends(get_db)):
    db_device = device_model.Device(**device.model_dump())
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return db_device

@router.get("/device/", response_model=List[device_schema.Device])
def get_devices(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    devices = db.query(device_model.Device).offset(skip).limit(limit).all()
    return devices

@router.get("/device/{device_id}", response_model=device_schema.Device)
def get_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(device_model.Device).filter(device_model.Device.id == device_id).first()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.put("/device/{device_id}", response_model=device_schema.Device)
def update_device(device_id: int, device: device_schema.DeviceCreate, db: Session = Depends(get_db)):
    db_device = db.query(device_model.Device).filter(device_model.Device.id == device_id).first()
    if db_device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    
    for key, value in device.model_dump().items():
        setattr(db_device, key, value)
    
    db.commit()
    db.refresh(db_device)
    return db_device

@router.delete("/device/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(device_model.Device).filter(device_model.Device.id == device_id).first()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    
    db.delete(device)
    db.commit()
    return {"message": "Device deleted successfully"}
