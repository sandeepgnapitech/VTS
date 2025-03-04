import paho.mqtt.client as mqtt
import json
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    # Create client
    client = mqtt.Client("mapapp_test_publisher")
    
    try:
        # Connect to broker
        logger.info("Connecting to test.mosquitto.org:1883...")
        client.connect("test.mosquitto.org", 1883, 60)
        
        # Start the loop
        client.loop_start()
        
        # Test data
        test_data = {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "speed": 0,
            "timestamp": str(int(time.time()))
        }
        
        # Publish test message
        topic = "device/test-device-001/data"
        logger.info(f"Publishing test message to {topic}")
        client.publish(topic, json.dumps(test_data))
        
        # Wait a moment for the message to be published
        time.sleep(2)
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
    finally:
        client.loop_stop()
        client.disconnect()
        logger.info("Test publisher disconnected")

if __name__ == "__main__":
    main()
