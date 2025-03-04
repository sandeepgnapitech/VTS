from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from ..core.database import get_db
from ..models import device_log as device_log_model
from ..schemas import device_log as device_log_schema

router = APIRouter()

@router.post("/device-log/", response_model=device_log_schema.DeviceLog)
def create_device_log(device_log: device_log_schema.DeviceLogCreate, db: Session = Depends(get_db)):
    db_device_log = device_log_model.DeviceLog(**device_log.model_dump())
    db.add(db_device_log)
    db.commit()
    db.refresh(db_device_log)
    return db_device_log

@router.get("/device-log/", response_model=List[device_log_schema.DeviceLog])
def get_device_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    logs = db.query(device_log_model.DeviceLog).offset(skip).limit(limit).all()
    return logs

@router.get("/device-log/{log_id}", response_model=device_log_schema.DeviceLog)
def get_device_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(device_log_model.DeviceLog).filter(device_log_model.DeviceLog.id == log_id).first()
    if log is None:
        raise HTTPException(status_code=404, detail="Log not found")
    return log

from datetime import datetime

@router.get("/device/{device_id}/logs", response_model=List[device_log_schema.DeviceLog])
def get_device_logs_by_device(
    device_id: UUID, 
    start_date: datetime = None, 
    end_date: datetime = None,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    query = db.query(device_log_model.DeviceLog)\
            .filter(device_log_model.DeviceLog.deviceid == device_id)
    
    if start_date:
        query = query.filter(device_log_model.DeviceLog.time_log >= start_date)
    if end_date:
        query = query.filter(device_log_model.DeviceLog.time_log <= end_date)
    
    logs = query.order_by(device_log_model.DeviceLog.time_log.asc())\
            .offset(skip)\
            .limit(limit)\
            .all()
    return logs

@router.put("/device-log/{log_id}", response_model=device_log_schema.DeviceLog)
def update_device_log(log_id: int, device_log: device_log_schema.DeviceLogCreate, db: Session = Depends(get_db)):
    db_log = db.query(device_log_model.DeviceLog).filter(device_log_model.DeviceLog.id == log_id).first()
    if db_log is None:
        raise HTTPException(status_code=404, detail="Log not found")
    
    for key, value in device_log.model_dump().items():
        setattr(db_log, key, value)
    
    db.commit()
    db.refresh(db_log)
    return db_log

@router.delete("/device-log/{log_id}")
def delete_device_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(device_log_model.DeviceLog).filter(device_log_model.DeviceLog.id == log_id).first()
    if log is None:
        raise HTTPException(status_code=404, detail="Log not found")
    
    db.delete(log)
    db.commit()
    return {"message": "Log deleted successfully"}
