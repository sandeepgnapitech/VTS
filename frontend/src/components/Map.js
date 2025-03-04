import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { Map as OLMap, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { defaults as defaultControls } from 'ol/control';

/**
 * Map component that displays OpenStreetMap
 * @param {Object} props - Component props
 * @param {Function} props.onMapInit - Callback function called when map is initialized
 * @returns {JSX.Element} Map component
 */
const Map = ({ onMapInit, children }) => {
  const mapRef = useRef();
  const [map, setMap] = useState(null);

  useEffect(() => {
    // Create base layers with unique IDs
    // const osmLayer = new TileLayer({
    //   source: new OSM(),
    //   title: 'OpenStreetMap',
    //   visible: true,
    //   properties: {
    //     id: 'osm-base',
    //     type: 'base'
    //   }
    // });

    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        maxZoom: 20
      }),
      title: 'Satellite',
      visible: false,
      properties: {
        id: 'satellite-base',
        type: 'base'
      }
    });

    // Create base layers with unique IDs
    const terrainLayer = new TileLayer({
      source: new XYZ({
        url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
        maxZoom: 20
      }),
      title: 'Terrain',
      visible: true,
      properties: {
        id: 'terrain-base',
        type: 'base'
      }
    });

    // Function to handle base layer visibility
    const handleBaseLayerVisibility = (layers) => {
      layers.forEach(layer => {
        if (layer.getProperties().type === 'base') {
          layer.on('change:visible', (event) => {
            if (event.target.getVisible()) {
              // Hide other base layers
              layers.forEach(otherLayer => {
                if (otherLayer !== event.target && 
                    otherLayer.getProperties().type === 'base') {
                  otherLayer.setVisible(false);
                }
              });
            }
          });
        }
      });
    };

    // Create map instance with configured layers
    const mapLayers = [terrainLayer, satelliteLayer,];
    const mapInstance = new OLMap({
      target: mapRef.current,
      layers: mapLayers,
      view: new View({
        center: [0, 0],
        zoom: 2
      }),
      controls: defaultControls({
        zoom: false // Disable default zoom controls
      })
    });

    // Initialize base layer management
    handleBaseLayerVisibility(mapLayers);

    setMap(mapInstance);
    if (onMapInit) {
      onMapInit(mapInstance);
    }
    
    return () => {
      mapInstance.setTarget(undefined);
    };
  }, []);

  return (
    <div ref={mapRef} className="map" style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Map controls and overlays */}
      {map && children}
    </div>
  );
};

export default Map;
