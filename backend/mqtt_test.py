import paho.mqtt.client as mqtt
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Successfully connected to MQTT broker")
        logger.info("Subscribing to topic: device/+/data")
        client.subscribe("device/+/data")
    else:
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

def on_disconnect(client, userdata, rc):
    if rc != 0:
        logger.warning(f"Unexpected disconnection from MQTT broker. Code: {rc}")
    else:
        logger.info("Disconnected from MQTT broker")

def on_message(client, userdata, msg):
    logger.info(f"Received message on topic: {msg.topic}")
    logger.info(f"Message payload: {msg.payload.decode()}")

def on_log(client, userdata, level, buf):
    logger.debug(f"MQTT Log: {buf}")

def main():
    # Create MQTT client
    client = mqtt.Client("mapapp_test_client")
    
    # Set callbacks
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect
    client.on_log = on_log

    try:
        logger.info("Connecting to test.mosquitto.org:1883...")
        client.connect("test.mosquitto.org", 1883, 60)
        
        # Enable automatic reconnection
        client.reconnect_delay_set(min_delay=1, max_delay=120)
        
        logger.info("Starting MQTT loop...")
        client.loop_forever()
    except Exception as e:
        logger.error(f"MQTT Service Error: {e}", exc_info=True)
    finally:
        client.disconnect()

if __name__ == "__main__":
    main()
