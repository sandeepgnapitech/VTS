import React, { useState, useRef } from 'react';
import { Button, message, Tooltip } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';
import { transform } from 'ol/proj';
import { click } from 'ol/events/condition';
import { useTool } from './contexts/ToolContext';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';

/**
 * GetCoords widget for copying clicked coordinates to clipboard
 * @param {Object} props Component props
 * @param {import('ol').Map} props.map OpenLayers map instance
 * @returns {JSX.Element} Get coordinates button
 */
const GetCoords = ({ map }) => {
  const { activeTool, setToolActive } = useTool();
  const active = activeTool === 'coords';
  const vectorLayerRef = useRef(null);
  const vectorSourceRef = useRef(null);

  // Initialize vector layer for markers
  React.useEffect(() => {
    if (!map) return;

    vectorSourceRef.current = new VectorSource();
    vectorLayerRef.current = new VectorLayer({
      source: vectorSourceRef.current,
      style: new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({
            color: 'red'
          }),
          stroke: new Stroke({
            color: 'white',
            width: 2
          })
        })
      })
    });

    map.addLayer(vectorLayerRef.current);

    return () => {
      if (map && vectorLayerRef.current) {
        map.removeLayer(vectorLayerRef.current);
      }
    };
  }, [map]);

  // Create and manage the coordinates display element
  React.useEffect(() => {
    // Create the coordinates display element
    const coordsDisplay = document.createElement('div');
    coordsDisplay.id = 'coords-display';
    coordsDisplay.style.position = 'fixed';
    coordsDisplay.style.top = '50%';
    coordsDisplay.style.left = '50%';
    coordsDisplay.style.transform = 'translate(-50%, -50%)';
    coordsDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.38)';
    coordsDisplay.style.color = 'white';
    coordsDisplay.style.padding = '10px 20px';
    coordsDisplay.style.borderRadius = '4px';
    coordsDisplay.style.zIndex = '9999';
    coordsDisplay.style.pointerEvents = 'none';
    coordsDisplay.style.fontSize = '16px';
    coordsDisplay.style.display = 'none';

    // Add it to the body
    document.body.appendChild(coordsDisplay);

    // Cleanup function
    return () => {
      if (document.getElementById('coords-display')) {
        document.body.removeChild(coordsDisplay);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!map) return;

    const handleClick = (event) => {
      if (!active) return;

      // Get clicked coordinate and add marker
      const clickedCoord = map.getEventCoordinate(event.originalEvent);
      
      // Clear previous marker
      if (vectorSourceRef.current) {
        vectorSourceRef.current.clear();
      }
      
      // Add new marker
      const feature = new Feature({
        geometry: new Point(clickedCoord)
      });
      vectorSourceRef.current.addFeature(feature);

      // Transform to EPSG:4326 (latitude/longitude)
      const lonLat = transform(clickedCoord, map.getView().getProjection(), 'EPSG:4326');
      
      // Format coordinates to 6 decimal places
      const coordStr = `${lonLat[1].toFixed(6)}, ${lonLat[0].toFixed(6)}`;
      
      // Show coordinates and copy to clipboard
      const coordsDisplay = document.querySelector('#coords-display');
      if (coordsDisplay) {
        coordsDisplay.textContent = `${coordStr} (Copied!)`;
        coordsDisplay.style.display = 'block';
        
        // Copy to clipboard
        navigator.clipboard.writeText(coordStr).catch(() => {
          // If clipboard copy fails, show message without "Copied!"
          coordsDisplay.textContent = coordStr;
        });
        
        // Hide after 3 seconds
        setTimeout(() => {
          coordsDisplay.style.display = 'none';
        }, 3000);
      }
    };

    if (active) {
      map.getTargetElement().style.cursor = 'crosshair';
      map.on('click', handleClick);
    } else {
      map.getTargetElement().style.cursor = 'default';
      map.un('click', handleClick);
    }

    return () => {
      if (map) {
        map.un('click', handleClick);
        map.getTargetElement().style.cursor = 'default';
      }
    };
  }, [map, active]);

  const toggleCoords = () => {
    if (!map) return;
    const newActive = !active;
    setToolActive('coords', newActive);
    if (newActive) {
      message.info('Click anywhere on the map to view and copy coordinates');
    } else {
      // Clear markers when deactivating
      if (vectorSourceRef.current) {
        vectorSourceRef.current.clear();
      }
    }
  };

  if (!map) return null;

  return (
    <Tooltip title="Click on map to view and copy coordinates">
      <Button
        type={active ? 'primary' : 'default'}
        icon={<EnvironmentOutlined />}
        onClick={toggleCoords}
        style={{ minWidth: '40px', width: '40px', height: '40px', padding: 0 }}
      />
    </Tooltip>
  );
};

GetCoords.propTypes = {
  map: PropTypes.object.isRequired,
};

export default GetCoords;
