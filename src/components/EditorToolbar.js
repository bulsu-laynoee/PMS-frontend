import React from 'react';
import { HexColorPicker } from 'react-colorful';
import Tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { FaHandPaper, FaDrawPolygon, FaTrash, FaSwatchbook } from 'react-icons/fa';

const EditorToolbar = ({ 
  mode, 
  setMode, 
  selectedSpace, 
  onUpdateSpace, 
  onDeleteSpace,
  spaceColor,
  setSpaceColor 
}) => {
  const tools = [
    { id: 'select', icon: FaHandPaper, label: 'Select (V)', mode: 'edit' },
    { id: 'draw', icon: FaDrawPolygon, label: 'Draw Space (D)', mode: 'draw' },
    { id: 'pan', icon: FaHandPaper, label: 'Pan (H)', mode: 'view' },
  ];

  // Initialize tooltips
  React.useEffect(() => {
    tools.forEach(tool => {
      Tippy(`[data-tooltip="${tool.id}"]`, {
        content: tool.label,
        placement: 'right',
      });
    });
  }, [tools]);

  const updateSpaceDimensions = (width, height) => {
    if (selectedSpace) {
      onUpdateSpace({
        ...selectedSpace,
        width: parseInt(width) || selectedSpace.width,
        height: parseInt(height) || selectedSpace.height,
      });
    }
  };

  return (
    <div className="toolbar dark" style={{ position: 'fixed', left: '1rem', top: '5rem', zIndex: 1100 }}>
      {/* Main Tools */}
      <div className="tools-group">
        {tools.map((tool) => (
          <button
            key={tool.id}
            data-tooltip={tool.id}
            onClick={() => setMode(tool.mode)}
            className={`toolButton ${mode === tool.mode ? 'active' : ''}`}
          >
            {/* Using react-icons for consistent toolbar appearance */}
            <tool.icon className="w-6 h-6" />
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 my-2" />

      {/* Space Properties - Only shown when a space is selected */}
      {selectedSpace && mode === 'edit' && (
        <div className="d-flex flex-column gap-2">
          {/* Size Controls */}
          <div className="d-flex flex-column gap-1">
            <input
              type="number"
              value={selectedSpace.width}
              onChange={(e) => updateSpaceDimensions(e.target.value, selectedSpace.height)}
              className="form-control form-control-sm"
              min="50"
              step="10"
              placeholder="Width"
            />
            <input
              type="number"
              value={selectedSpace.height}
              onChange={(e) => updateSpaceDimensions(selectedSpace.width, e.target.value)}
              className="form-control form-control-sm"
              min="50"
              step="10"
              placeholder="Height"
            />
          </div>

          {/* Color Picker */}
          <Tippy
            content={
              <HexColorPicker
                color={spaceColor}
                onChange={setSpaceColor}
              />
            }
            interactive={true}
            trigger="click"
          >
            <button className="btn btn-light p-2">
              <FaSwatchbook className="w-100 h-100" />
            </button>
          </Tippy>

          {/* Delete Space */}
          <button
            onClick={() => onDeleteSpace(selectedSpace.id)}
            className="btn btn-danger p-2"
          >
            <FaTrash className="w-100 h-100" />
          </button>
        </div>
      )}
    </div>
  );
};

export default EditorToolbar;
