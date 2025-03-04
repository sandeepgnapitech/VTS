import React from 'react';
import { Space } from 'antd';
import PropTypes from 'prop-types';
import './MapPanel.css';

/**
 * Toolbar widget that displays controls on the map
 * @param {Object} props Component props
 * @param {React.ReactNode} props.children - Widgets to render in the toolbar
 * @param {('top'|'bottom'|'left'|'right')} [props.position='top'] - Position of the toolbar on the map
 * @returns {JSX.Element} Toolbar containing map widgets
 */
const Toolbar = ({ children, position = 'top' }) => {
  const getStyles = () => {
    const baseStyles = {
      position: 'absolute', // Relative to map div
      zIndex: 1,
      background: '#fff',
      padding: '8px',
      borderRadius: '4px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      border: '1px solid #d9d9d9',
      pointerEvents: 'auto' // Ensure controls are clickable
    };

    const positionStyles = {
      left: {
        left: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      },
      right: {
        right: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      },
      bottom: {
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'row',
        gap: '8px'
      },
      top: {
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'row',
        gap: '8px'
      }
    };

    return {
      ...baseStyles,
      ...positionStyles[position]
    };
  };

  const isVertical = position === 'left' || position === 'right';

  return (
    <div
      style={getStyles()}
      className={`map-panel map-panel-${position}`}
    >
      <Space
        size={12}
        direction={isVertical ? 'vertical' : 'horizontal'}
        align="center"
      >
        {children}
      </Space>
    </div>
  );
};

Toolbar.propTypes = {
  children: PropTypes.node,
  position: PropTypes.oneOf(['top', 'bottom', 'left', 'right'])
};

export default Toolbar;
