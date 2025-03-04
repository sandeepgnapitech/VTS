#!/usr/bin/env python3
import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.append(str(backend_dir))

# Set environment variable for the .env file location
os.environ["ENV_FILE"] = str(backend_dir / ".env")

from app.services.mqtt_service import MQTTService

def main():
    try:
        print("Starting MQTT Service...")
        mqtt_service = MQTTService()
        mqtt_service.start()
    except KeyboardInterrupt:
        print("\nStopping MQTT Service...")
        mqtt_service.stop()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
