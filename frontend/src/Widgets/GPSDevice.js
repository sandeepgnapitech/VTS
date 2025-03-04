import React, { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { Button, Card, Form, Select, message, Checkbox } from 'antd';
import axios from 'axios';
import { Vector as VectorSource } from 'ol/source';
import { Vector as VectorLayer } from 'ol/layer';
import { Point } from 'ol/geom';
import Feature from 'ol/Feature';
import { Style, Circle as CircleStyle, Fill, Stroke, RegularShape } from 'ol/style';
import { transform } from 'ol/proj';

const MQTT_CONFIG = {
  url: 'wss://test.mosquitto.org:8081',
  options: {
    protocol: 'wss',
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000
  }
};

/**
 * GPSDevice widget for displaying real-time GPS position from MQTT broker over WebSocket
 * @param {Object} props Component props
 * @param {import('ol').Map} props.map OpenLayers map instance
 * @returns {JSX.Element} GPS device widget
 */
const GPSDevice = ({ map }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const clientRef = useRef(null);
  const sourceRef = useRef(new VectorSource());
  const zoomStateRef = useRef(false);  // To track zoom state changes
  // Animation frame tracking
  const animationRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  const vectorRef = useRef(new VectorLayer({
    source: sourceRef.current,
    style: (feature) => {
      const styles = [];

      // Arrow icon
      styles.push(new Style({
        image: new RegularShape({
          points: 3,
          radius: 12,
          rotation: Math.PI / 2,
          fill: new Fill({
            color: '#4CAF50'
          }),
          stroke: new Stroke({
            color: '#fff',
            width: 2
          })
        })
      }));

      // Wave animation
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const waveCount = 3;
      
      for (let i = 0; i < waveCount; i++) {
        const offset = (i / waveCount);
        const ratio = ((elapsed + offset) % 1);
        
        styles.push(new Style({
          image: new CircleStyle({
            radius: 12 + (ratio * 30),
            stroke: new Stroke({
              color: `rgba(76, 175, 80, ${0.4 * (1 - ratio)})`,
              width: 2
            })
          })
        }));
      }

      return styles;
    }
  }));

  // Handle animation
  useEffect(() => {
    const animate = () => {
      vectorRef.current.changed();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Load devices from backend
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await axios.get('http://localhost:8000/device/');
        setDevices(response.data);
      } catch (error) {
        console.error('Error fetching devices:', error);
        message.error('Failed to fetch devices');
      }
    };
    fetchDevices();
  }, []);

  // Initialize map layer
  useEffect(() => {
    if (!map) return;

    map.addLayer(vectorRef.current);

    return () => {
      if (map) {
        map.removeLayer(vectorRef.current);
      }
    };
  }, [map]);

  // Handle zoom state changes
  useEffect(() => {
    // Update ref to track actual state
    zoomStateRef.current = zoomEnabled;
    
    // Cancel animations when zoom is disabled
    if (!zoomEnabled && map) {
      map.getView().cancelAnimations();
    }
  }, [zoomEnabled, map]);

  // Cleanup MQTT connection on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.end();
      }
    };
  }, []);

  const connectToMQTT = () => {
    // Disconnect if already connected
    if (clientRef.current) {
      clientRef.current.end();
    }

    // Connect to MQTT broker
    try {
      const clientId = 'gnapi-map-' + Math.random().toString(16).substr(2, 8);
      
      const client = mqtt.connect(MQTT_CONFIG.url, {
        ...MQTT_CONFIG.options,
        clientId
      });

      client.on('connect', () => {
        setIsConnected(true);
        message.success('Live tracking started');

        // Subscribe to device topics
        const topics = selectedDevice === 'all'
          ? 'device/+/data'
          : `device/${selectedDevice}/data`;
        
        client.subscribe(topics, { qos: 0 }, (err) => {
          if (err) {
            message.error(`Failed to start tracking: ${err.message}`);
          } else {
            const deviceName = selectedDevice === 'all' 
              ? 'all devices' 
              : devices.find(d => d.deviceid === selectedDevice)?.name || 'Unknown Device';
            message.success(`Now tracking ${deviceName}`);
          }
        });
      });

      client.on('message', (topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          if (data.lat && data.lon) {
            updatePosition(data.lat, data.lon, topic);
          }
        } catch (err) {
          console.error('Error parsing MQTT message:', err);
        }
      });

      client.on('error', (error) => {
        message.error('Connection error');
        console.error('MQTT error:', error);
        setIsConnected(false);
      });

      client.on('close', () => {
        setIsConnected(false);
        message.info('Connection closed');
      });

      clientRef.current = client;
    } catch (err) {
      message.error(`Failed to connect: ${err.message}`);
      console.error('Connection error:', err);
    }
  };

  const updatePosition = (lat, lon, topic) => {
    if (!map) return;

    const location = transform(
      [lon, lat],
      'EPSG:4326',
      map.getView().getProjection()
    );

    // Keep track of features per device
    const deviceId = topic.split('/')[1];
    const existingFeature = sourceRef.current.getFeatures().find(
      f => f.get('deviceId') === deviceId
    );

    if (existingFeature) {
      existingFeature.getGeometry().setCoordinates(location);
    } else {
      const feature = new Feature({
        geometry: new Point(location)
      });
      feature.set('deviceId', deviceId);
      sourceRef.current.addFeature(feature);
    }

    // Use ref to check zoom state to ensure we have latest value
    if (zoomStateRef.current === true) {
      const shouldZoom = 
        selectedDevice === deviceId || // Single device mode
        (selectedDevice === 'all' && sourceRef.current.getFeatures().length === 1); // First feature in all devices mode
        
      if (shouldZoom) {
        map.getView().animate({
          center: location,
          duration: 300
        });
      }
    }
  };

  const disconnectMQTT = () => {
    if (clientRef.current) {
      clientRef.current.end();
      clientRef.current = null;
      setIsConnected(false);
      message.info('Live tracking stopped');
      
      // Clear all features when disconnecting
      sourceRef.current.clear();
    }
  };

  if (!map) return null;

  return (
    <Card title="GPS Device Tracking" style={{ margin: '12px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Select
          style={{ width: '100%', marginBottom: '12px' }}
          placeholder="Select Device"
          value={selectedDevice}
          onChange={setSelectedDevice}
          disabled={isConnected}
        >
          <Select.Option value="all">All Devices</Select.Option>
          {devices.map(device => (
            <Select.Option key={device.deviceid} value={device.deviceid}>
              {device.name}
            </Select.Option>
          ))}
        </Select>
        <Button
          type={isConnected ? 'primary' : 'default'}
          onClick={isConnected ? disconnectMQTT : connectToMQTT}
          style={{ width: '100%' }}
          danger={isConnected}
        >
          {isConnected ? 'Disconnect' : 'Connect'}
        </Button>
      </div>

      {isConnected && (
        <div style={{ marginTop: '8px' }}>
          <Form.Item style={{ marginBottom: '8px' }}>
            <Checkbox 
              checked={zoomEnabled}
              onChange={e => setZoomEnabled(e.target.checked)}
            >
              Auto Zoom
            </Checkbox>
          </Form.Item>
          <div style={{ color: '#4CAF50', marginBottom: '8px' }}>
            ● Live tracking active
          </div>
          <div style={{ fontSize: '12px' }}>
            Tracking:{' '}
            <span style={{ 
              color: '#4CAF50',
              backgroundColor: '#E8F5E9',
              padding: '2px 8px',
              borderRadius: '12px',
              display: 'inline-block',
              marginTop: '4px'
            }}>
              {selectedDevice === 'all' 
                ? 'All Devices' 
                : devices.find(d => d.deviceid === selectedDevice)?.name || 'Unknown Device'}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default GPSDevice;
