import React, { useEffect, useState } from 'react';
import { Button, Slider, Tooltip } from 'antd';
import { PlusOutlined, MinusOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';
import { Control } from 'ol/control';
import { createRoot } from 'react-dom/client';

/**
 * Inner component for the zoom slider control
 */
const ZoomSliderContent = ({ map, position = 'left' }) => {
  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    if (!map) return;

    // Initialize zoom level
    setZoom(map.getView().getZoom());

    // Listen for zoom changes
    const handleZoomChange = () => {
      setZoom(map.getView().getZoom());
    };

    map.getView().on('change:resolution', handleZoomChange);

    return () => {
      map.getView().un('change:resolution', handleZoomChange);
    };
  }, [map]);

  const handleZoomChange = (value) => {
    if (!map) return;
    map.getView().animate({
      zoom: value,
      duration: 200
    });
  };

  const handleZoomIn = () => {
    if (!map) return;
    const currentZoom = map.getView().getZoom();
    handleZoomChange(currentZoom + 1);
  };

  const handleZoomOut = () => {
    if (!map) return;
    const currentZoom = map.getView().getZoom();
    handleZoomChange(currentZoom - 1);
  };

  if (!map) return null;

  const view = map.getView();
  const minZoom = view.getMinZoom();
  const maxZoom = view.getMaxZoom();

  const containerStyle = {
    background: 'white',
    padding: 8,
    borderRadius: 4,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    border: '1px solid #d9d9d9',
    display: 'flex',
    gap: 8,
    flexDirection: position === 'bottom' ? 'row' : 'column'
  };

  return (
    <div className="custom-zoom-slider" style={containerStyle}>
      <Tooltip title={position === 'bottom' ? "Zoom out" : "Zoom in"}>
        <Button
          icon={position === 'bottom' ? <MinusOutlined /> : <PlusOutlined />}
          onClick={position === 'bottom' ? handleZoomOut : handleZoomIn}
          disabled={position === 'bottom' ? zoom <= minZoom : zoom >= maxZoom}
          className="zoom-button"
        />
      </Tooltip>
      <Slider
        vertical={position !== 'bottom'}
        min={minZoom}
        max={maxZoom}
        step={0.5}
        value={zoom}
        onChange={handleZoomChange}
        className="zoom-slider"
        style={position === 'bottom' ? { width: 150 } : { height: 150 }}
      />
      <Tooltip title={position === 'bottom' ? "Zoom in" : "Zoom out"}>
        <Button
          icon={position === 'bottom' ? <PlusOutlined /> : <MinusOutlined />}
          onClick={position === 'bottom' ? handleZoomIn : handleZoomOut}
          disabled={position === 'bottom' ? zoom >= maxZoom : zoom <= minZoom}
          className="zoom-button"
        />
      </Tooltip>
    </div>
  );
};

ZoomSliderContent.propTypes = {
  map: PropTypes.object.isRequired,
  position: PropTypes.oneOf(['left', 'right', 'bottom']),
};

/**
 * Custom zoom slider widget for OpenLayers map
 * @param {Object} props Component props
 * @param {import('ol').Map} props.map OpenLayers map instance
 * @param {'left'|'right'|'bottom'} [props.position='left'] Position of the zoom slider
 * @returns {null} Component does not render any visible elements directly
 */
const ZoomSlider = ({ map, position = 'left' }) => {
  useEffect(() => {
    if (!map) return;

    const element = document.createElement('div');
    const control = new Control({
      element: element,
    });

    // Position the control element
    const positionStyle = {
      left: position === 'left' ? '10px' : position === 'bottom' ? '50%' : 'auto',
      right: position === 'right' ? '10px' : 'auto',
      top: position === 'bottom' ? 'auto' : '100px',
      bottom: position === 'bottom' ? '10px' : 'auto',
      position: 'absolute',
      transform: position === 'bottom' ? 'translateX(-50%)' : 'none'
    };
    Object.assign(element.style, positionStyle);

    // Create root and render React component into the control element
    const root = createRoot(element);
    root.render(<ZoomSliderContent map={map} position={position} />);

    // Add control to map
    map.addControl(control);

    return () => {
      map.removeControl(control);
      root.unmount();
    };
  }, [map, position]);

  return null;
};

ZoomSlider.propTypes = {
  map: PropTypes.object.isRequired,
  position: PropTypes.oneOf(['left', 'right', 'bottom']),
};

export default ZoomSlider;
