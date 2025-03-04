import React, { useEffect, useRef } from 'react';
import { Button, message, Tooltip } from 'antd';
import { DragOutlined } from '@ant-design/icons';
import { DragPan } from 'ol/interaction';
import { useTool } from './contexts/ToolContext';

/**
 * PanTool widget for explicit panning mode with visual feedback
 * @param {Object} props Component props
 * @param {import('ol').Map} props.map OpenLayers map instance
 * @returns {JSX.Element} Pan tool button
 */
const PanTool = ({ map }) => {
  const { activeTool, setToolActive } = useTool();
  const active = activeTool === 'pan';
  const dragPanRef = useRef(null);
  const pointerListenersRef = useRef({});

  useEffect(() => {
    if (!map) return;

    // Create the drag pan interaction
    const interaction = new DragPan({
      kinetic: true
    });

    // Get all existing drag pan interactions
    const existingDragPan = map.getInteractions().getArray().find(
      interaction => interaction instanceof DragPan
    );

    dragPanRef.current = existingDragPan;

    return () => {
      if (map && existingDragPan) {
        map.getInteractions().forEach(interaction => {
          if (interaction instanceof DragPan) {
            map.removeInteraction(interaction);
          }
        });
        map.addInteraction(existingDragPan);
      }
    };
  }, [map]);

  useEffect(() => {
    if (!map || !dragPanRef.current) return;

    const handlePointerDown = () => {
      map.getTargetElement().style.cursor = 'grabbing';
    };

    const handlePointerUp = () => {
      map.getTargetElement().style.cursor = 'grab';
    };

    if (active) {
      // Enable pan mode
      dragPanRef.current.setActive(true);
      map.getTargetElement().style.cursor = 'grab';
      
      // Add pointer listeners
      const viewport = map.getViewport();
      viewport.addEventListener('pointerdown', handlePointerDown);
      viewport.addEventListener('pointerup', handlePointerUp);
      
      // Store listeners for cleanup
      pointerListenersRef.current = {
        down: handlePointerDown,
        up: handlePointerUp,
        viewport
      };

      message.success('Pan mode activated');
    } else {
      // Disable pan mode
      map.getTargetElement().style.cursor = 'default';
      
      // Remove pointer listeners
      const { down, up, viewport } = pointerListenersRef.current;
      if (viewport) {
        viewport.removeEventListener('pointerdown', down);
        viewport.removeEventListener('pointerup', up);
      }
      pointerListenersRef.current = {};
    }

    return () => {
      const { down, up, viewport } = pointerListenersRef.current;
      if (viewport) {
        viewport.removeEventListener('pointerdown', down);
        viewport.removeEventListener('pointerup', up);
      }
      if (map.getTargetElement()) {
        map.getTargetElement().style.cursor = 'default';
      }
    };
  }, [map, active]);

  const togglePan = () => {
    if (!map || !dragPanRef.current) return;
    setToolActive('pan', !active);
  };

  if (!map) return null;

  return (
    <Tooltip title="Pan the map by dragging">
      <Button
        type={active ? 'primary' : 'default'}
        icon={<DragOutlined />}
        onClick={togglePan}
        style={{ minWidth: '40px', width: '40px', height: '40px', padding: 0 }}
      />
    </Tooltip>
  );
};

export default PanTool;
