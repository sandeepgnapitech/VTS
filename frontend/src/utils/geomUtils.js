import { Style, Fill, Stroke, Circle } from 'ol/style';

/**
 * Gets the geometry type of features in a layer
 * @param {ol/layer/Vector} layer The vector layer to check
 * @returns {string} The geometry type ('Point', 'LineString', 'Polygon', 'Mixed')
 */
export const getGeometryType = (layer) => {
  const features = layer.getSource().getFeatures();
  if (features.length === 0) return null;

  const types = new Set();
  features.forEach(feature => {
    const geom = feature.getGeometry();
    if (geom) {
      types.add(geom.getType());
    }
  });

  if (types.size === 0) return null;
  if (types.size === 1) return Array.from(types)[0];
  return 'Mixed';
};

/**
 * Gets the appropriate style for a geometry type
 * @param {string} type The geometry type
 * @param {string} color The color to use
 * @param {Object} options Additional style options
 * @returns {ol/style/Style} The OpenLayers style
 */
export const getStyleForGeometry = (type, color, options = {}) => {
  const { size = 8, width = 2 } = options;

  switch (type) {
    case 'Point':
      return new Style({
        image: new Circle({
          radius: size,
          fill: new Fill({
            color: color + '80'
          }),
          stroke: new Stroke({
            color: color,
            width: width
          })
        })
      });

    case 'LineString':
      return new Style({
        stroke: new Stroke({
          color: color,
          width: width
        })
      });

    case 'Polygon':
      return new Style({
        fill: new Fill({
          color: color + '80'
        }),
        stroke: new Stroke({
          color: color,
          width: width
        })
      });

    case 'Mixed':
      // For mixed geometry types, return a style function that handles each type
      return (feature) => {
        const geomType = feature.getGeometry().getType();
        return getStyleForGeometry(geomType, color, options);
      };

    default:
      // Default to point style if type is unknown
      return getStyleForGeometry('Point', color, options);
  }
};
