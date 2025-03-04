import React, { useState, useEffect } from 'react';
import { ToolProvider } from './Widgets/contexts/ToolContext';
import Map from './components/Map';
import MapPanel from './Widgets/MapPanel';
import ScaleBar from './Widgets/ScaleBar';
import ZoomSliderControl from './Widgets/ZoomSlider';
import LayerManager from './Widgets/LayerManager';
import AddDevice from './Widgets/AddDevice';

import Toolbar from './Widgets/Toolbar';

import ZoomIn from './Widgets/ZoomIn';
import ZoomOut from './Widgets/ZoomOut';
import GetCoords from './Widgets/GetCoords';
import Branding from './Widgets/Branding';
import GPSDevice from './Widgets/GPSDevice';
import GPSLoggerInfo from './Widgets/GPSLoggerInfo';
import 'antd/dist/reset.css';
import './App.css';

// Components that don't need additional props
const baseWidgets = [ScaleBar];

// Components with specific props configurations
const configuredWidgets = [
  { Component: ZoomSliderControl, props: { position: 'left' } }
];

/**
 * Main application component that renders a full-screen map with collapsible panels
 * @returns {JSX.Element} The application layout with map and collapsible panels
 */
function App() {
  const [map, setMap] = useState(null);

  return (
    <div className="app">
      <div className="map-container">
        <div className="map-panels">
          {/* Main content row (left panel, map, right panel) */}
          <div className="map-row">
            {/* Left Panel */}
            <MapPanel position="left" isAdjacent={true}>
                <LayerManager map={map} />
                <GPSDevice map={map} />
                <GPSLoggerInfo map={map} />
            </MapPanel>


            {/* Map */}
            <Map onMapInit={setMap}>
              {map && (
                <>
                  {/* Top Toolbar */}
                  <ToolProvider>
                    <Toolbar position="top">
                      <ZoomIn map={map} />
                      <ZoomOut map={map} />
                      <GetCoords map={map} />
                      <AddDevice map={map} />
                    </Toolbar>
                  </ToolProvider>

                  {/* Render base widgets */}
                  {baseWidgets.map((Widget, index) => (
                    <Widget key={index} map={map} />
                  ))}

                  {/* Render configured widgets with props */}
                  {configuredWidgets.map(({ Component, props }, index) => (
                    <Component key={index} map={map} {...props} />
                  ))}

                  {/* Add branding widget */}
                  <Branding />
                </>
              )}
            </Map>

            {/* Right Panel */}
            {/* <MapPanel position="right" isAdjacent={true}>

            </MapPanel> */}
          </div>

          {/* Bottom Panel */}
        </div>
      </div>
    </div>
  );
}

export default App;
