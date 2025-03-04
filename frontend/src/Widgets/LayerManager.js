import React, { useEffect, useState, useCallback, memo, useRef } from 'react';
import { List, Switch, Slider, Typography, Divider } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined, CaretRightOutlined } from '@ant-design/icons';
import VectorLayer from 'ol/layer/Vector';
import TileLayer from 'ol/layer/Tile';
import PropTypes from 'prop-types';

const { Title } = Typography;

// Enhanced layer operation manager with cleanup
const LayerOperationManager = {
  operations: new WeakMap(),
  timeouts: new WeakMap(),
  
  isProcessing(layer) {
    return this.operations.get(layer)?.processing || false;
  },
  
  startOperation(layer) {
    this.clearTimeout(layer);
    if (!this.operations.has(layer)) {
      this.operations.set(layer, { processing: true });
    } else {
      this.operations.get(layer).processing = true;
    }
  },
  
  endOperation(layer) {
    if (this.operations.has(layer)) {
      this.operations.get(layer).processing = false;
    }
  },

  scheduleEnd(layer, timeout = 100) {
    this.clearTimeout(layer);
    const timeoutId = setTimeout(() => {
      this.endOperation(layer);
      this.timeouts.delete(layer);
    }, timeout);
    this.timeouts.set(layer, timeoutId);
  },

  clearTimeout(layer) {
    if (this.timeouts.has(layer)) {
      clearTimeout(this.timeouts.get(layer));
      this.timeouts.delete(layer);
    }
  },

  cleanup(layer) {
    this.clearTimeout(layer);
    this.operations.delete(layer);
  }
};

const useSwitchState = (layer, onChange) => {
  const [checked, setChecked] = useState(layer.getVisible());
  
  useEffect(() => {
    const handleChange = () => {
      if (!LayerOperationManager.isProcessing(layer)) {
        setChecked(layer.getVisible());
      }
    };
    layer.on('change:visible', handleChange);
    return () => {
      layer.un('change:visible', handleChange);
      LayerOperationManager.cleanup(layer);
    };
  }, [layer]);

  const handleChange = useCallback((value) => {
    if (LayerOperationManager.isProcessing(layer)) return;
    
    LayerOperationManager.startOperation(layer);
    try {
      onChange(value);
      setChecked(value);
    } finally {
      LayerOperationManager.scheduleEnd(layer);
    }
  }, [layer, onChange]);

  return [checked, handleChange];
};

const LayerVisibilityControl = memo(({ layer, map, style }) => {
  const handleVisibilityChange = useCallback((checked) => {
    const type = layer.get('type');
    if (type === 'base' && checked) {
      const baseLayers = map.getLayers().getArray().filter(l => l.get('type') === 'base');
      baseLayers.forEach(l => {
        if (l !== layer) {
          LayerOperationManager.startOperation(l);
          l.setVisible(false);
          LayerOperationManager.scheduleEnd(l);
        }
      });
    }
    layer.setVisible(checked);
  }, [layer, map]);

  const [checked, handleChange] = useSwitchState(layer, handleVisibilityChange);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

  return (
    <div onClick={handleClick}>
      <Switch
        checkedChildren={<EyeOutlined />}
        unCheckedChildren={<EyeInvisibleOutlined />}
        checked={checked}
        onChange={handleChange}
        style={style}
      />
    </div>
  );
}, (prev, next) => prev.layer === next.layer);

LayerVisibilityControl.displayName = 'LayerVisibilityControl';
LayerVisibilityControl.propTypes = {
  layer: PropTypes.object.isRequired,
  map: PropTypes.object.isRequired,
  style: PropTypes.object
};

// LayerLegend component remains the same...
const LayerLegend = memo(({ style }) => {
  if (!style?.breaks?.length || !style?.colors?.length) return null;

  return (
    <div style={{ padding: '8px 12px', paddingLeft: 24, background: '#fafafa' }}>
      <div style={{ fontSize: 12, marginBottom: 4, color: '#666' }}>
        {style.field} Classification
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {style.breaks.slice(0, -1).map((breakValue, index) => (
          <div 
            key={index} 
            style={{ 
              display: 'flex', 
              alignItems: 'center',
              fontSize: 12 
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                backgroundColor: style.colors[index],
                marginRight: 8,
                border: '1px solid #d9d9d9'
              }}
            />
            <span>
              {breakValue.toFixed(2)} - {style.breaks[index + 1].toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

LayerLegend.displayName = 'LayerLegend';
LayerLegend.propTypes = {
  style: PropTypes.shape({
    field: PropTypes.string,
    breaks: PropTypes.arrayOf(PropTypes.number),
    colors: PropTypes.arrayOf(PropTypes.string)
  })
};

const LayerItem = memo(({ layer, map, isOverlay, expanded, onToggle }) => {
  const [opacity, setOpacity] = useState(() => Math.round(layer.getOpacity() * 100));
  const [style, setStyle] = useState(() => layer instanceof VectorLayer ? layer.get('currentStyle') : null);
  const name = layer.get('title');
  const id = layer.get('title') || layer.ol_uid;
  const hasStyle = layer instanceof VectorLayer && style;

  useEffect(() => {
    const handleStyleChange = () => {
      if (!LayerOperationManager.isProcessing(layer)) {
        setStyle(layer.get('currentStyle'));
      }
    };

    const handleOpacityChange = () => {
      if (!LayerOperationManager.isProcessing(layer)) {
        setOpacity(Math.round(layer.getOpacity() * 100));
      }
    };

    layer.on('change:opacity', handleOpacityChange);
    if (layer instanceof VectorLayer) {
      layer.on('change:currentStyle', handleStyleChange);
    }

    return () => {
      layer.un('change:opacity', handleOpacityChange);
      if (layer instanceof VectorLayer) {
        layer.un('change:currentStyle', handleStyleChange);
      }
      LayerOperationManager.cleanup(layer);
    };
  }, [layer]);

  const handleItemClick = useCallback(() => {
    if (hasStyle) onToggle(id);
  }, [hasStyle, id, onToggle]);

  const handleOpacityChange = useCallback((value) => {
    if (LayerOperationManager.isProcessing(layer)) return;
    
    LayerOperationManager.startOperation(layer);
    try {
      layer.setOpacity(value / 100);
      setOpacity(value);
    } finally {
      LayerOperationManager.scheduleEnd(layer);
    }
  }, [layer]);

  return (
    <List.Item style={{ padding: 0, borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ width: '100%' }}>
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '12px', 
            cursor: hasStyle ? 'pointer' : 'default',
            userSelect: 'none',
            backgroundColor: 'white'
          }}
          onClick={handleItemClick}
        >
          {hasStyle && (
            <CaretRightOutlined 
              style={{ 
                marginRight: 8,
                transform: `rotate(${expanded ? 90 : 0}deg)`,
                transition: 'transform 0.2s ease'
              }}
            />
          )}
          <span style={{ flex: 1, marginLeft: hasStyle ? 0 : 24 }}>{name}</span>
          <LayerVisibilityControl layer={layer} map={map} style={{ marginLeft: 8 }} />
        </div>
        <div style={{ 
          maxHeight: expanded ? '500px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.2s ease-in-out'
        }}>
          {expanded && (
            <>
              {isOverlay && (
                <div style={{ 
                  padding: '8px 12px', 
                  paddingLeft: 24,
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8,
                  background: '#fafafa',
                  borderTop: '1px solid #f0f0f0'
                }}>
                  <span style={{ fontSize: 12, minWidth: 80 }}>
                    Opacity: {opacity}%
                  </span>
                  <Slider
                    min={0}
                    max={100}
                    value={opacity}
                    onChange={handleOpacityChange}
                    style={{ flex: 1 }}
                  />
                </div>
              )}
              <LayerLegend style={style} />
            </>
          )}
        </div>
      </div>
    </List.Item>
  );
});

LayerItem.displayName = 'LayerItem';
LayerItem.propTypes = {
  layer: PropTypes.object.isRequired,
  map: PropTypes.object.isRequired,
  isOverlay: PropTypes.bool,
  expanded: PropTypes.bool,
  onToggle: PropTypes.func.isRequired
};

// LayerGroup and LayerManager components remain the same...
const LayerGroup = memo(({ layers, title, isOverlay, map, expandedItems, onToggle }) => {
  if (!layers.length) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <Title level={5} style={{ marginBottom: 16 }}>{title}</Title>
      <List
        size="small"
        dataSource={layers}
        renderItem={layer => (
          <LayerItem
            key={layer.get('title') || layer.ol_uid}
            layer={layer}
            map={map}
            isOverlay={isOverlay}
            expanded={expandedItems.has(layer.get('title'))}
            onToggle={onToggle}
          />
        )}
      />
    </div>
  );
});

LayerGroup.displayName = 'LayerGroup';
LayerGroup.propTypes = {
  layers: PropTypes.array.isRequired,
  title: PropTypes.string.isRequired,
  isOverlay: PropTypes.bool,
  map: PropTypes.object.isRequired,
  expandedItems: PropTypes.instanceOf(Set).isRequired,
  onToggle: PropTypes.func.isRequired
};

const LayerManager = ({ map }) => {
  const [layers, setLayers] = useState({ baseLayers: [], overlays: [] });
  const [expandedItems, setExpandedItems] = useState(new Set());
  const mounted = useRef(true);
  const updateTimer = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (updateTimer.current) {
        clearTimeout(updateTimer.current);
      }
    };
  }, []);

  const refreshLayers = useCallback(() => {
    if (!map || !mounted.current) return;

    if (updateTimer.current) {
      clearTimeout(updateTimer.current);
    }

    updateTimer.current = setTimeout(() => {
      if (!mounted.current) return;

      const allLayers = map.getLayers().getArray();
      
      const baseLayers = allLayers
        .filter(layer => layer.get('type') === 'base')
        .reverse();

      const overlays = allLayers
        .filter(layer => layer.get('type') !== 'base')
        .filter(layer => {
          const title = layer.get('title');
          return title && title !== 'Unnamed Layer';
        })
        .reverse();

      setLayers({ baseLayers, overlays });

      overlays.forEach(layer => {
        if (layer instanceof VectorLayer && layer.get('currentStyle')) {
          const id = layer.get('title');
          if (id && !LayerOperationManager.isProcessing(layer)) {
            setExpandedItems(prev => {
              if (prev.has(id)) return prev;
              return new Set([...prev, id]);
            });
          }
        }
      });
    }, 50);
  }, [map]);

  useEffect(() => {
    if (!map) return;

    const handleLayerOperation = () => refreshLayers();
    const layerGroup = map.getLayers();
    
    layerGroup.on(['add', 'remove'], handleLayerOperation);
    handleLayerOperation();

    return () => {
      layerGroup.un(['add', 'remove'], handleLayerOperation);
    };
  }, [map, refreshLayers]);

  const toggleExpand = useCallback((id) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (!map) return null;

  return (
    <div style={{ padding: 16 }}>
      <LayerGroup 
        title="Base Layers" 
        layers={layers.baseLayers} 
        map={map}
        expandedItems={expandedItems}
        onToggle={toggleExpand}
      />
      {layers.overlays.length > 0 && <Divider style={{ margin: '16px 0' }} />}
      <LayerGroup 
        title="Overlays" 
        layers={layers.overlays} 
        isOverlay
        map={map}
        expandedItems={expandedItems}
        onToggle={toggleExpand}
      />
    </div>
  );
};

LayerManager.propTypes = {
  map: PropTypes.object.isRequired,
};

export default LayerManager;
