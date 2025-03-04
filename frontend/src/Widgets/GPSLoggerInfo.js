import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Form, Select, DatePicker, Space, message, Slider } from 'antd';
import { EnvironmentOutlined, LineChartOutlined, PlayCircleOutlined, PauseCircleOutlined, StopOutlined, CarOutlined } from '@ant-design/icons';
import Title from 'antd/es/typography/Title';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { Point, LineString } from 'ol/geom';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';
import { transform } from 'ol/proj';
import axios from 'axios';
import moment from 'moment';
import debounce from 'lodash/debounce';

const { RangePicker } = DatePicker;

const displayModeOptions = [
  { value: 'point', label: 'Points Only', icon: <EnvironmentOutlined /> },
  { value: 'path', label: 'Path with Points', icon: <LineChartOutlined /> },
  { value: 'animate', label: 'Animated Route', icon: <CarOutlined /> }
];

const STYLES = {
  vehicle: {
    radius: 8,
    fill: '#ff4d4f',
    stroke: '#ffffff',
    strokeWidth: 3,
    directionLength: 20,
    trailEffect: {
      color: '#ff4d4f',
      width: 3,
      dash: [6, 6]
    },
    shadow: {
      blur: 10,
      color: 'rgba(255, 77, 79, 0.3)'
    }
  },
  path: {
    color: 'rgb(241, 245, 0)',
    width: 7
  },
  point: {
    radius: 3,
    fill: 'red',
    stroke: '#fff',
    strokeWidth: 1
  }
};

/**
 * GPSLoggerInfo Component
 * 
 * Displays and animates GPS device location history with various visualization modes:
 * - Points Only: Shows individual GPS points
 * - Path with Points: Shows connected path with points
 * - Animated Route: Animates a vehicle marker along the GPS path
 *
 * @param {Object} props The component props
 * @param {import('ol').Map} props.map OpenLayers Map instance
 * @returns {JSX.Element} Rendered component
 */
const GPSLoggerInfo = ({ map }) => {
  const [form] = Form.useForm();
  const [devices, setDevices] = useState([]);
  const [drawMode, setDrawMode] = useState('point');
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [animationDuration, setAnimationDuration] = useState(30);
  const [hasData, setHasData] = useState(false);

  // Layer refs
  const vectorLayerRef = useRef(null);
  const vectorSourceRef = useRef(null);
  const animationLayerRef = useRef(null);
  const animationSourceRef = useRef(null);

  // Animation refs
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const pathPointsRef = useRef([]);
  const timestampsRef = useRef([]);
  const vehicleFeatureRef = useRef(null);
  const directionFeatureRef = useRef(null);
  const isPlayingRef = useRef(false);
  const mountedRef = useRef(true);

  // Debounced progress update
  const setProgressDebounced = useCallback(
    debounce((value) => setProgress(value), 50),
    []
  );

  const calculatePathMetrics = useCallback((points) => {
    if (!points?.length) throw new Error('Invalid points data');
    
    const distances = [0];
    let totalDistance = 0;
    
    for (let i = 1; i < points.length; i++) {
      const dx = points[i][0] - points[i-1][0];
      const dy = points[i][1] - points[i-1][1];
      totalDistance += Math.sqrt(dx * dx + dy * dy);
      distances.push(totalDistance);
    }
    
    return { distances, totalDistance };
  }, []);

  const findSegmentIndex = useCallback((distances, targetDistance) => {
    let left = 0;
    let right = distances.length - 1;
    
    while (left < right - 1) {
      const mid = Math.floor((left + right) / 2);
      if (distances[mid] <= targetDistance) {
        left = mid;
      } else {
        right = mid;
      }
    }
    return left;
  }, []);

  const updatePosition = useCallback((currentX, currentY, angle) => {
    if (!vehicleFeatureRef.current || !directionFeatureRef.current) return;

    const directionLength = STYLES.vehicle.directionLength;
    vehicleFeatureRef.current.getGeometry().setCoordinates([currentX, currentY]);
    directionFeatureRef.current.getGeometry().setCoordinates([
      [currentX, currentY],
      [
        currentX + Math.cos(angle) * directionLength,
        currentY + Math.sin(angle) * directionLength
      ]
    ]);
  }, []);

  // Stop animation handler
  const handleStopAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    startTimeRef.current = null;
    isPlayingRef.current = false;
    
    // Reset position to start if possible
    if (vehicleFeatureRef.current && pathPointsRef.current?.length > 0) {
      const initialPoint = pathPointsRef.current[0];
      updatePosition(initialPoint[0], initialPoint[1], 0);
    }
    
    setIsPlaying(false);
    setProgress(0);
    
    // Force refresh
    if (animationLayerRef.current) {
      animationLayerRef.current.changed();
    }
  }, [updatePosition]);

  const animateFrame = useCallback((timestamp) => {
    try {
      // Check if we should continue
      if (!mountedRef.current || !isPlayingRef.current) {
        //handleStopAnimation();
        //return;
      }

      // Request next frame first to ensure continuous animation
      animationFrameRef.current = requestAnimationFrame(animateFrame);

      // Validate features first
      if (!vehicleFeatureRef.current || !directionFeatureRef.current) {
        console.error('Missing animation features');
        handleStopAnimation();
        return;
      }

      // Initialize or validate start time
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      // Calculate progress
      const elapsed = Math.max(0, timestamp - startTimeRef.current);
      const duration = animationDuration * 1000;
      const currentProgress = Math.min(elapsed / duration, 1);
      const progressPercent = Math.floor(currentProgress * 100);

      // Get path data and metrics
      const points = pathPointsRef.current;
      let metrics = points.metrics;
      if (!metrics) {
        metrics = calculatePathMetrics(points);
        points.metrics = metrics;
      }

      const { distances, totalDistance } = metrics;
      const targetDistance = totalDistance * currentProgress;
      const segmentIndex = findSegmentIndex(distances, targetDistance);
      
      // Calculate interpolated position
      const p1 = points[segmentIndex];
      const p2 = points[segmentIndex + 1];
      const segmentProgress = (targetDistance - distances[segmentIndex]) / 
        (distances[segmentIndex + 1] - distances[segmentIndex]);

      const currentX = p1[0] + (p2[0] - p1[0]) * segmentProgress;
      const currentY = p1[1] + (p2[1] - p1[1]) * segmentProgress;
      const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);

      // Update position and progress
      updatePosition(currentX, currentY, angle);
      setProgressDebounced(progressPercent);

      if (currentProgress >= 1) {
        handleStopAnimation();
      }
    } catch (error) {
      console.error('Animation error:', error);
      handleStopAnimation();
    }
  }, [animationDuration, calculatePathMetrics, findSegmentIndex, handleStopAnimation, updatePosition, setProgressDebounced]);

  // Create animation features
  const createAnimationFeatures = useCallback(() => {
    if (!animationSourceRef.current || !pathPointsRef.current?.length) {
      return false;
    }

    const initialPoint = pathPointsRef.current[0];
    animationSourceRef.current.clear();

    // Create vehicle feature
    const vehicle = new Feature({
      geometry: new Point(initialPoint)
    });
    vehicle.setStyle([
      new Style({
        image: new CircleStyle({
          radius: STYLES.vehicle.radius + STYLES.vehicle.shadow.blur,
          fill: new Fill({ color: STYLES.vehicle.shadow.color }),
          stroke: new Stroke({ color: STYLES.vehicle.shadow.color, width: 1 })
        }),
        zIndex: 9
      }),
      new Style({
        image: new CircleStyle({
          radius: STYLES.vehicle.radius,
          fill: new Fill({ color: STYLES.vehicle.fill }),
          stroke: new Stroke({ color: STYLES.vehicle.stroke, width: STYLES.vehicle.strokeWidth })
        }),
        zIndex: 10
      })
    ]);

    // Create direction indicator
    const direction = new Feature({
      geometry: new LineString([initialPoint, initialPoint])
    });
    direction.setStyle([
      new Style({
        stroke: new Stroke({
          color: STYLES.vehicle.shadow.color,
          width: STYLES.vehicle.trailEffect.width + 2
        }),
        zIndex: 8
      }),
      new Style({
        stroke: new Stroke({
          color: STYLES.vehicle.fill,
          width: STYLES.vehicle.trailEffect.width,
          lineCap: 'round'
        }),
        zIndex: 9
      })
    ]);

    vehicleFeatureRef.current = vehicle;
    directionFeatureRef.current = direction;
    animationSourceRef.current.addFeatures([vehicle, direction]);
    
    return true;
  }, []);

  const startAnimation = useCallback(() => {
    try {
      if (!pathPointsRef.current?.length) {
        message.warning('No path data available');
        return false;
      }

      // Reset animation state
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Create or validate features
      if (!vehicleFeatureRef.current || !directionFeatureRef.current) {
        message.loading('Initializing animation...', 0.5);
        if (!createAnimationFeatures()) {
          message.error('Failed to initialize animation. Please try again.');
          handleStopAnimation();
          return false;
        }
        message.success('Animation ready');
      }

      // Start animation
      startTimeRef.current = null;
      setProgress(0);
      isPlayingRef.current = true;
      setIsPlaying(true);
      
      animationFrameRef.current = requestAnimationFrame(animateFrame);
      return true;
    } catch (error) {
      console.error('Failed to start animation:', error);
      handleStopAnimation();
      return false;
    }
  }, [createAnimationFeatures, animateFrame, handleStopAnimation]);

  // Initialize map layers
  useEffect(() => {
    if (!map) return;

    vectorSourceRef.current = new VectorSource();
    vectorLayerRef.current = new VectorLayer({
      source: vectorSourceRef.current,
      style: (feature) => {
        const type = feature.getGeometry().getType();
        return type === 'Point' ? 
          new Style({
            image: new CircleStyle({
              radius: STYLES.point.radius,
              fill: new Fill({ color: STYLES.point.fill }),
              stroke: new Stroke({
                color: STYLES.point.stroke,
                width: STYLES.point.strokeWidth
              })
            })
          }) :
          new Style({
            stroke: new Stroke({
              color: STYLES.path.color,
              width: STYLES.path.width
            })
          });
      }
    });

    animationSourceRef.current = new VectorSource();
    animationLayerRef.current = new VectorLayer({
      source: animationSourceRef.current,
      updateWhileAnimating: true,
      updateWhileInteracting: true,
      renderMode: 'image',
      style: (feature) => {
        const featureStyle = feature.getStyle();
        if (featureStyle) return featureStyle;
        return new Style({
          image: new CircleStyle({
            radius: STYLES.vehicle.radius,
            fill: new Fill({ color: STYLES.vehicle.fill }),
            stroke: new Stroke({ 
              color: STYLES.vehicle.stroke,
              width: STYLES.vehicle.strokeWidth 
            })
          }),
          stroke: new Stroke({
            color: STYLES.vehicle.fill,
            width: STYLES.vehicle.trailEffect.width
          }),
          zIndex: 999
        });
      },
      zIndex: 999,
      renderBuffer: 200
    });

    map.addLayer(vectorLayerRef.current);
    map.addLayer(animationLayerRef.current);
    
    setTimeout(() => {
      if (animationLayerRef.current) {
        animationLayerRef.current.setZIndex(999);
      }
    }, 0);

    return () => {
      if (map) {
        map.removeLayer(vectorLayerRef.current);
        map.removeLayer(animationLayerRef.current);
      }
      handleStopAnimation();
    };
  }, [map, handleStopAnimation]);

  // Fetch devices on mount
  useEffect(() => {
    let isMounted = true;
    
    const fetchDevices = async () => {
      const hide = message.loading('Loading devices...', 0);
      try {
        const response = await axios.get('http://localhost:8000/device/');
        if (isMounted) {
          setDevices(response.data);
          if (response.data.length === 0) {
            message.info('No devices found');
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error fetching devices:', error);
          message.error('Failed to fetch devices');
        }
      } finally {
        hide();
      }
    };

    fetchDevices();
    return () => {
      isMounted = false;
    };
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Handle mode changes
  useEffect(() => {
    form.setFieldsValue({ drawMode });
    
    if (drawMode !== 'animate') {
      handleStopAnimation();
      return;
    }
    
    if (hasData && pathPointsRef.current?.length >= 2) {
      createAnimationFeatures();
    }
  }, [drawMode, form, handleStopAnimation, hasData, createAnimationFeatures]);

  // Add error boundary effect
  useEffect(() => {
    const handleError = () => {
      handleStopAnimation();
      message.error('Animation stopped due to an error');
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [handleStopAnimation]);

  const handleClear = useCallback(() => {
    handleStopAnimation();
    
    // Clear layers
    vectorSourceRef.current?.clear();
    animationSourceRef.current?.clear();
    
    // Clear animation features
    vehicleFeatureRef.current = null;
    directionFeatureRef.current = null;
    
    // Clear data
    pathPointsRef.current = [];
    pathPointsRef.current.metrics = null;
    timestampsRef.current = [];
    
    // Reset state
    setHasData(false);
    setProgress(0);
    setDrawMode('point');
    setAnimationDuration(30);
    
    // Reset form to initial values
    form.resetFields();
    
    // Force refresh layers
    if (animationLayerRef.current) {
      animationLayerRef.current.changed();
    }
    if (vectorLayerRef.current) {
      vectorLayerRef.current.changed();
    }
    
    // Reset map view if available
    if (map) {
      map.getView().setCenter([0, 0]);
      map.getView().setZoom(2);
    }
    
    message.success('Data cleared');
  }, [handleStopAnimation, form, map]);

  const handlePlayPause = useCallback(() => {
    try {
      if (isPlaying) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        isPlayingRef.current = false;
        setIsPlaying(false);
      } else {
        startAnimation();
      }
    } catch (error) {
      console.error('Play/Pause error:', error);
      handleStopAnimation();
    }
  }, [isPlaying, startAnimation, handleStopAnimation]);

  const handleSubmit = async (values) => {
    try {
      handleStopAnimation();
      
      // Clear previous state
      vectorSourceRef.current?.clear();
      animationSourceRef.current?.clear();
      vehicleFeatureRef.current = null;
      directionFeatureRef.current = null;
      pathPointsRef.current = [];
      timestampsRef.current = [];
      setHasData(false);

      const { device, dateRange } = values;
      if (!dateRange || !dateRange[0] || !dateRange[1]) {
        message.error('Please select a valid date range');
        return;
      }

      const [startDate, endDate] = dateRange;

      // Show loading message
      const hide = message.loading('Fetching GPS logs...', 0);
      
      // Ensure dates are moment objects and convert to UTC
      const start = (moment.isMoment(startDate) ? startDate : moment(startDate))
        .clone()
        .utc()
        .format('YYYY-MM-DD HH:mm:ss');
      const end = (moment.isMoment(endDate) ? endDate : moment(endDate))
        .clone()
        .utc()
        .format('YYYY-MM-DD HH:mm:ss');

      console.log('Fetching logs with date range:', { start, end }); // Debug log
      
      const response = await axios.get(`http://localhost:8000/device/${device}/logs/`, {
        params: {
          start_date: start,
          end_date: end,
          limit: 1000
        }
      });

      const logs = response.data;
      hide(); // Hide loading message
      
      if (!logs.length) {
        message.warning(`No logs found between ${moment(start).format('YYYY-MM-DD HH:mm:ss')} and ${moment(end).format('YYYY-MM-DD HH:mm:ss')} UTC`);
        return;
      }

      console.log('Found logs:', logs.length, 'First log:', logs[0]?.time_log, 'Last log:', logs[logs.length - 1]?.time_log);

      // Validate and filter coordinates
      const coordinates = logs
        .filter(log => {
          const lat = parseFloat(log.data.lat);
          const lon = parseFloat(log.data.lon);
          // Check if coordinates are valid numbers and within reasonable ranges
          return !isNaN(lat) && !isNaN(lon) && 
                 lat >= -90 && lat <= 90 && 
                 lon >= -180 && lon <= 180;
        })
        .map(log => {
          try {
            return transform(
              [parseFloat(log.data.lon), parseFloat(log.data.lat)],
              'EPSG:4326',
              map.getView().getProjection()
            );
          } catch (error) {
            console.error('Coordinate transformation error:', error);
            return null;
          }
        })
        .filter(coord => coord !== null);

      if (coordinates.length === 0) {
        message.warning('No valid GPS coordinates found in the selected time range');
        return;
      } else if (coordinates.length === 1) {
        message.warning('Only one valid GPS coordinate found - at least two are needed for path visualization');
        return;
      } else if (coordinates.length >= 2) {
        pathPointsRef.current = [...coordinates];
        timestampsRef.current = logs.map(log => new Date(log.time_log).getTime());

        if (drawMode === 'path' || drawMode === 'animate') {
          vectorSourceRef.current.addFeature(
            new Feature({
              geometry: new LineString(coordinates),
              style: new Style({
                stroke: new Stroke({
                  color: STYLES.path.color,
                  width: STYLES.path.width
                })
              })
            })
          );
        }

        if (drawMode !== 'animate') {
          coordinates.forEach((coord, index) => {
            vectorSourceRef.current.addFeature(
              new Feature({
                geometry: new Point(coord),
                properties: { ...logs[index].data, timestamp: logs[index].time_log }
              })
            );
          });
        }

        map.getView().fit(vectorSourceRef.current.getExtent(), {
          padding: [50, 50, 50, 50],
          duration: 1000
        });

        if (drawMode === 'animate') {
          if (!createAnimationFeatures()) {
            message.error('Failed to initialize animation');
            return;
          }
        }

        setHasData(true);
        message.success('GPS logs displayed successfully');
      } else {
        message.warning('Not enough coordinates for visualization');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      //hide(); // Hide loading message in case of error
      message.error('Failed to fetch GPS logs');
      setHasData(false);
    }
  };

  return (
    <div style={{ padding: '16px' }}>
      <Title level={4}>GPS Logger Info</Title>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          drawMode: 'point',
          dateRange: [moment().subtract(1, 'days'), moment()]
        }}
      >
        <Form.Item
          name="device"
          label="Select Device"
          rules={[{ required: true, message: 'Please select a device' }]}
        >
          <Select placeholder="Select a device">
            {devices.map(device => (
              <Select.Option key={device.deviceid} value={device.deviceid}>
                {device.name || device.deviceid}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="dateRange"
          label="Date Range"
          rules={[{ required: true, message: 'Please select date range' }]}
        >
          <RangePicker 
            showTime={{ format: 'HH:mm:ss' }}
            format="YYYY-MM-DD HH:mm:ss"
            style={{ width: '100%' }}
            ranges={{
              'Last 24 Hours': [moment().subtract(24, 'hours'), moment()],
              'Last 7 Days': [moment().subtract(7, 'days'), moment()],
              'Last 30 Days': [moment().subtract(30, 'days'), moment()]
            }}
            defaultValue={[moment().subtract(24, 'hours'), moment()]}
            onOk={(dates) => {
              // Only update when user clicks OK
              if (dates?.length === 2) {
                const [start, end] = dates.map(date => 
                  moment(date).startOf('second')
                );
                if (start && end) {
                  form.setFieldsValue({
                    dateRange: [start, end]
                  });
                }
              }
            }}
          />
        </Form.Item>

        <Form.Item name="drawMode" label="Display Mode">
          <Select
            value={drawMode}
            onChange={setDrawMode}
            disabled={isPlaying}
          >
            {displayModeOptions.map(option => (
              <Select.Option key={option.value} value={option.value}>
                <Space>
                  {option.icon}
                  {option.label}
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {drawMode === 'animate' && hasData && (
          <>
            <Form.Item label={`Animation Duration (${animationDuration} seconds)`}>
              <Slider
                min={5}
                max={60}
                value={animationDuration}
                onChange={setAnimationDuration}
                disabled={isPlaying}
                marks={{
                  5: '5s',
                  30: '30s',
                  60: '60s'
                }}
              />
            </Form.Item>
            
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Button 
                  type="primary"
                  icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={handlePlayPause}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
                <Button 
                  icon={<StopOutlined />}
                  onClick={handleStopAnimation}
                >
                  Stop
                </Button>
              </Space>
              <Slider 
                value={progress}
                disabled
                style={{ marginTop: 8 }}
                marks={{
                  0: '0%',
                  25: '25%',
                  50: '50%',
                  75: '75%',
                  100: '100%'
                }}
              />
            </div>
          </>
        )}

        <Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={handleClear}>Clear</Button>
            <Button type="primary" htmlType="submit" disabled={isPlaying}>
              Show Logs
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
};

export default GPSLoggerInfo;
