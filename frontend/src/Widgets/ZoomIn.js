import React from 'react';
import { Button, message, Tooltip } from 'antd';
import { ZoomInOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';
import { DragBox } from 'ol/interaction';
import { useTool } from './contexts/ToolContext';

/**
 * ZoomIn widget for zooming into a drawn rectangle
 * @param {Object} props Component props
 * @param {import('ol').Map} props.map OpenLayers map instance
 * @returns {JSX.Element} Zoom in button
 */
const ZoomIn = ({ map }) => {
  const { activeTool, setToolActive } = useTool();
  const active = activeTool === 'zoomIn';

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
        const extent = dragBox.getGeometry().getExtent();
        map.getView().fit(extent, {
          duration: 500
        });
      });

      map.getTargetElement().style.cursor = 'zoom-in';
      message.info('Draw a rectangle to zoom in');
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

  const toggleZoomIn = () => {
    if (!map) return;
    setToolActive('zoomIn', !active);
  };

  if (!map) return null;

  return (
    <Tooltip title="Click and drag to zoom in">
      <Button
        type={active ? 'primary' : 'default'}
        icon={<ZoomInOutlined />}
        onClick={toggleZoomIn}
        style={{ minWidth: '40px', width: '40px', height: '40px', padding: 0 }}
      />
    </Tooltip>
  );
};

ZoomIn.propTypes = {
  map: PropTypes.object.isRequired,
};

export default ZoomIn;
