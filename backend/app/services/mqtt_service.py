import json
import paho.mqtt.client as mqtt
import uuid
import logging
import threading
import time
from ..core.config import settings
from ..core.database import SessionLocal
from ..models.device_log import DeviceLog
from ..models.device import Device

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MQTTService:
    def __init__(self):
        # Generate a unique client ID
        self.client_id = f"{settings.MQTT_CLIENT_ID}_{uuid.uuid4().hex[:8]}"
        logger.info(f"Initializing MQTT client with ID: {settings}")
        
        # Create client with clean session
        self.client = mqtt.Client(client_id=self.client_id, clean_session=True)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        self.client.on_log = self.on_log
        
        # State management
        self.connected = False
        self.running = False
        self.reconnect_interval = 5

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.connected = True
            logger.info("Successfully connected to MQTT broker")
            logger.info(f"Subscribing to topic: {settings.MQTT_TOPIC}")
            client.subscribe(settings.MQTT_TOPIC)
        else:
            self.connected = False
            logger.error(f"Failed to connect to MQTT broker with code {rc}")
            connection_codes = {
                1: "Incorrect protocol version",
                2: "Invalid client identifier",
                3: "Server unavailable",
                4: "Bad username or password",
                5: "Not authorized"
            }
            if rc in connection_codes:
                logger.error(f"Connection error: {connection_codes[rc]}")

    def on_disconnect(self, client, userdata, rc):
        self.connected = False
        if rc != 0:
            logger.warning(f"Unexpected disconnection from MQTT broker. Code: {rc}")
        else:
            logger.info("Disconnected from MQTT broker")

    def on_log(self, client, userdata, level, buf):
        logger.debug(f"MQTT Log: {buf}")

    def on_message(self, client, userdata, msg):
        try:
            # Parse the device ID from the topic
            # Topic format: device/<device_id>/data
            device_id = msg.topic.split('/')[1]
            
            logger.debug(f"Received message on topic {msg.topic}")
            
            # Parse message payload
            payload = json.loads(msg.payload.decode())
            logger.info(f"Received data for device {device_id}: {payload}")
            
            # Create database session
            db = SessionLocal()
            try:
                # Convert string device_id to UUID
                device_uuid = uuid.UUID(device_id)
                
                # Check if device exists
                device = db.query(Device).filter(Device.deviceid == device_uuid).first()
                if not device:
                    logger.error(f"Device {device_id} not found in database")
                    return
                
                # Create new device log entry
                device_log = DeviceLog(
                    deviceid=device_uuid,
                    data=payload
                )
                db.add(device_log)
                db.commit()
                logger.info(f"Successfully logged data for device {device_id}")
            except Exception as db_error:
                db.rollback()
                logger.error(f"Database error: {db_error}")
            finally:
                db.close()
                
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON payload: {e}")
        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)

    def maintain_connection(self):
        """Thread to maintain MQTT connection"""
        while self.running:
            if not self.connected:
                try:
                    logger.info(f"Attempting to connect to {settings.MQTT_BROKER}:{settings.MQTT_PORT}...")
                    self.client.connect(settings.MQTT_BROKER, settings.MQTT_PORT, 60)
                except Exception as e:
                    logger.error(f"Connection failed: {e}")
            time.sleep(self.reconnect_interval)

    def start(self):
        try:
            # Configure client
            self.client.enable_logger(logger)
            
            # Start the network loop in a background thread
            self.client.loop_start()
            
            # Start connection maintenance thread
            self.running = True
            connection_thread = threading.Thread(target=self.maintain_connection)
            connection_thread.daemon = True
            connection_thread.start()
            
            # Keep the main thread alive
            logger.info("MQTT service started. Press Ctrl+C to stop.")
            while self.running:
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Received shutdown signal")
            self.stop()
        except Exception as e:
            logger.error(f"MQTT Service Error: {e}", exc_info=True)
            self.stop()

    def stop(self):
        logger.info("Stopping MQTT service...")
        self.running = False
        self.client.loop_stop()
        if self.connected:
            self.client.disconnect()
        logger.info("MQTT service stopped")
