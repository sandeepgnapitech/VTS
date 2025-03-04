import React, { createContext, useContext, useState } from 'react';

const ToolContext = createContext();

export const ToolProvider = ({ children }) => {
  const [activeTool, setActiveTool] = useState(null);

  const setToolActive = (toolName, isActive) => {
    setActiveTool(isActive ? toolName : null);
  };

  return (
    <ToolContext.Provider value={{ activeTool, setToolActive }}>
      {children}
    </ToolContext.Provider>
  );
};

export const useTool = () => {
  const context = useContext(ToolContext);
  if (!context) {
    throw new Error('useTool must be used within a ToolProvider');
  }
  return context;
};
