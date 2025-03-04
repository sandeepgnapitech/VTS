import React, { useState } from 'react';
import { Button } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import './MapPanel.css';

/**
 * A collapsible panel component that can be positioned on the left, right, or bottom of the map
 * @param {Object} props Component props
 * @param {'left'|'right'|'bottom'} [props.position='left'] - Position of the panel
 * @param {boolean} [props.isAdjacent=false] - Whether the panel should be adjacent to the map (true) or overlap it (false)
 * @param {React.ReactNode} props.children - Content to render inside the panel
 * @returns {JSX.Element} A collapsible panel with the specified position and content
 */
const MapPanel = ({ position = 'left', isAdjacent = false, children }) => {
  const [collapsed, setCollapsed] = useState(false);

  const getContainerStyle = () => {
    const style = {
      height: position === 'bottom' ? 'auto' : '100%',
      zIndex: 1000,
    };

    if (position === 'bottom') {
      if (isAdjacent) {
        return {
          ...style,
          position: 'relative',
          width: '100%',
          order: 2, // Place at the bottom of flex container
        };
      }
      return {
        ...style,
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
      };
    }

    if (!isAdjacent) {
      return {
        ...style,
        position: 'absolute',
        [position]: 0,
        top: '10px',
        height: 'calc(100% - 20px)',
      };
    }

    return style;
  };

  const getPanelStyle = () => {
    const baseStyle = {
      background: '#fff',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      transition: 'all 0.3s ease',
      overflow: 'hidden',
      borderRadius: '4px',
    };

    if (position === 'bottom') {
      return {
        ...baseStyle,
        width: '100%',
        height: '200px',
        marginBottom: isAdjacent ? '40px' : 0,
        transform: `translateY(${collapsed ? '100%' : '0'})`,
        opacity: collapsed ? 0 : 1,
        visibility: collapsed ? 'hidden' : 'visible',
      };
    }

    if (isAdjacent) {
      const marginSide = position === 'left' ? 'marginLeft' : 'marginRight';
      return {
        ...baseStyle,
        height: '100%',
        width: collapsed ? '0' : '300px',
        [marginSide]: '0px',
      };
    }

    return {
      ...baseStyle,
      position: 'absolute',
      height: '100%',
      width: '300px',
      [position]: collapsed ? '-300px' : '0px',
      top: 0,
    };
  };

  const getButtonStyle = () => {
    if (position === 'bottom') {
      return {
        position: 'absolute',
        bottom: '-32px', // Fixed position below the panel
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1001,
      };
    }

    const baseStyle = {
      position: 'absolute',
      top: '50%',
      marginTop: '-16px', // Half of button height (32px) for vertical centering
      zIndex: 1001,
    };

    if (position === 'left') {
      return {
        ...baseStyle,
        left: collapsed ? 0 : '300px',
      };
    }

    return {
      ...baseStyle,
      right: collapsed ? 0 : '-32px', // When expanded, position button outside panel
    };
  };

  return (
    <div 
      className={`map-panel-container${isAdjacent ? ' adjacent' : ''}`} 
      style={getContainerStyle()}
      data-position={position}
    >
      <div className="map-panel" style={getPanelStyle()}>
        <div className="map-panel-content" style={{ 
          maxHeight: '100%',
          height: 'auto',
          padding: '12px',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          overflowY: 'auto'
        }}>
          {children}
        </div>
      </div>
      <Button
        className="map-panel-button"
        icon={
          position === 'bottom'
            ? collapsed
              ? <MenuUnfoldOutlined rotate={-90} />
              : <MenuFoldOutlined rotate={-90} />
            : collapsed
              ? <MenuUnfoldOutlined />
              : <MenuFoldOutlined />
        }
        onClick={() => setCollapsed(!collapsed)}
        style={getButtonStyle()}
      />
    </div>
  );
};

export default MapPanel;
