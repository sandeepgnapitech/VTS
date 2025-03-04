import React from 'react';
import { Button, message, Tooltip } from 'antd';
import { ZoomOutOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';
import { DragBox } from 'ol/interaction';
import { useTool } from './contexts/ToolContext';

/**
 * ZoomOut widget for zooming out from a drawn rectangle
 * @param {Object} props Component props
 * @param {import('ol').Map} props.map OpenLayers map instance
 * @returns {JSX.Element} Zoom out button
 */
const ZoomOut = ({ map }) => {
  const { activeTool, setToolActive } = useTool();
  const active = activeTool === 'zoomOut';

  React.useEffect(() => {
    if (!map) return;

    let dragBox;
    if (active) {
      // Create a DragBox interaction
      dragBox = new DragBox();

      // Add the interaction to the map
      map.addInteraction(dragBox);

      // Handle the boxend event
      dragBox.on('boxend', () => {
        const boxExtent = dragBox.getGeometry().getExtent();
        const currentView = map.getView();
        const currentZoom = currentView.getZoom();
        
        // Get box center
        const boxCenter = [
          (boxExtent[0] + boxExtent[2]) / 2,
          (boxExtent[1] + boxExtent[3]) / 2
        ];

        // Calculate zoom out level
        const newZoom = Math.max(currentZoom - 2, currentView.getMinZoom());

        map.getView().animate({
          center: boxCenter,
          zoom: newZoom,
          duration: 500
        });
      });

      map.getTargetElement().style.cursor = 'zoom-out';
      message.info('Draw a rectangle to zoom out');
    }

    return () => {
      if (dragBox) {
        map.removeInteraction(dragBox);
        if (map.getTargetElement()) {
          map.getTargetElement().style.cursor = 'default';
        }
      }
    };
  }, [map, active]);

  const toggleZoomOut = () => {
    if (!map) return;
    setToolActive('zoomOut', !active);
  };

  if (!map) return null;

  return (
    <Tooltip title="Click and drag to zoom out">
      <Button
        type={active ? 'primary' : 'default'}
        icon={<ZoomOutOutlined />}
        onClick={toggleZoomOut}
        style={{ minWidth: '40px', width: '40px', height: '40px', padding: 0 }}
      />
    </Tooltip>
  );
};

ZoomOut.propTypes = {
  map: PropTypes.object.isRequired,
};

export default ZoomOut;
