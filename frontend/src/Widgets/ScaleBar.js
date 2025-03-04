import React, { useEffect } from 'react';
import { ScaleLine } from 'ol/control';

/**
 * ScaleBar widget component for OpenLayers map
 * @param {Object} props Component props
 * @param {import('ol').Map} props.map OpenLayers map instance
 * @returns {null} Component does not render any visible elements
 */
const ScaleBar = ({ map }) => {
  useEffect(() => {
    if (!map) return;

    const scaleControl = new ScaleLine({
      units: 'metric',
      bar: true,
      steps: 4,
      text: true,
      minWidth: 140
    });

    const element = scaleControl.element;
    element.style.position = 'absolute';
    element.style.left = '50%';
    element.style.transform = 'translateX(-50%)';
    element.style.borderRadius = '4px';
    map.addControl(scaleControl);

    return () => {
      map.removeControl(scaleControl);
    };
  }, [map]);

  return null;
};

export default ScaleBar;
