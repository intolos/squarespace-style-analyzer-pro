// style-comparison-utils.js - Style Parsing and Comparison Utilities
// Single Responsibility: Parse, compare, and format style definitions

const StyleComparisonUtils = {

  // Properties to exclude from comparison (handled by color analysis)
  colorProperties: ['color', 'background-color', 'border', 'border-color'],

  // Parse styleDefinition string into key-value object
  parseStyleDefinition: function(styleStr) {
    if (!styleStr) return {};
    const result = {};
    const parts = styleStr.split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        result[key] = value;
      }
    }
    return result;
  },

  // Filter out color-related properties from style object
  filterColorProperties: function(styleObj) {
    const filtered = {};
    for (const key in styleObj) {
      if (!this.colorProperties.includes(key)) {
        filtered[key] = styleObj[key];
      }
    }
    return filtered;
  },

  // Convert style object back to string
  styleObjectToString: function(styleObj) {
    const parts = [];
    for (const key in styleObj) {
      parts.push(`${key}: ${styleObj[key]}`);
    }
    return parts.join('; ');
  },

  // Get style definition with color properties removed
  getStyleWithoutColors: function(styleStr) {
    const parsed = this.parseStyleDefinition(styleStr);
    const filtered = this.filterColorProperties(parsed);
    return this.styleObjectToString(filtered);
  },

  // Compare two style objects and return differing properties
  getStyleDifferences: function(baselineStyle, comparisonStyle) {
    const differences = [];
    const baselineObj = this.filterColorProperties(this.parseStyleDefinition(baselineStyle));
    const comparisonObj = this.filterColorProperties(this.parseStyleDefinition(comparisonStyle));
    
    // Check all properties in comparison against baseline
    for (const key in comparisonObj) {
      if (baselineObj[key] !== comparisonObj[key]) {
        differences.push(key);
      }
    }
    
    // Check for properties in baseline not in comparison
    for (const key in baselineObj) {
      if (!(key in comparisonObj) && !differences.includes(key)) {
        differences.push(key);
      }
    }
    
    return differences;
  },

  // Format style definition with differences bolded (excluding color properties from display)
  formatStyleWithDifferences: function(styleStr, differingProperties, escapeHtmlFn) {
    const parsed = this.parseStyleDefinition(styleStr);
    const filtered = this.filterColorProperties(parsed);
    
    if (Object.keys(filtered).length === 0) {
      return escapeHtmlFn ? escapeHtmlFn('(no style)') : '(no style)';
    }
    
    const formatted = [];
    
    for (const key in filtered) {
      const part = `${key}: ${filtered[key]}`;
      if (differingProperties.includes(key)) {
        const escaped = escapeHtmlFn ? escapeHtmlFn(part) : part;
        formatted.push(`<strong style="color: #e53e3e;">${escaped}</strong>`);
      } else {
        formatted.push(escapeHtmlFn ? escapeHtmlFn(part) : part);
      }
    }
    
    return formatted.join('; ');
  },

  // Format style definition without highlighting (excluding color properties)
  formatStyleWithoutColors: function(styleStr, escapeHtmlFn) {
    const parsed = this.parseStyleDefinition(styleStr);
    const filtered = this.filterColorProperties(parsed);
    
    if (Object.keys(filtered).length === 0) {
      return escapeHtmlFn ? escapeHtmlFn('(no style)') : '(no style)';
    }
    
    const result = this.styleObjectToString(filtered);
    return escapeHtmlFn ? escapeHtmlFn(result) : result;
  },

  // Group all instances by styleDefinition (with colors removed), return sorted by count
  groupByStyleDefinition: function(locations) {
    const groups = {};
    
    for (const location of locations) {
      // Get style without color properties for grouping
      const styleWithoutColors = this.getStyleWithoutColors(location.styleDefinition || '');
      const key = styleWithoutColors || '(no style)';
      
      if (!groups[key]) {
        groups[key] = {
          styleDefinition: location.styleDefinition, // Keep original for display
          styleWithoutColors: key,
          instances: []
        };
      }
      
      groups[key].instances.push(location);
    }
    
    // Convert to array and sort by count (most common first)
    return Object.values(groups).sort((a, b) => b.instances.length - a.instances.length);
  },

  // Check if a type has style variations (excluding color differences)
  hasStyleVariations: function(locations) {
    if (!locations || locations.length === 0) return false;
    const groups = this.groupByStyleDefinition(locations);
    return groups.length > 1;
  },

  // Get variation count for a type
  getVariationCount: function(locations) {
    if (!locations || locations.length === 0) return 0;
    const groups = this.groupByStyleDefinition(locations);
    return groups.length;
  },

  // Find ALL properties that differ across ANY of the style groups
  // Used for page-by-page report where all differences should be highlighted
  getAllDifferingProperties: function(styleGroups) {
    if (!styleGroups || styleGroups.length < 2) return [];
    
    const allDifferences = new Set();
    
    // Parse all styles into objects (filtered)
    const parsedStyles = styleGroups.map(group => 
      this.filterColorProperties(this.parseStyleDefinition(group.styleDefinition || group.styleWithoutColors || ''))
    );
    
    // Collect all property keys across all styles
    const allKeys = new Set();
    for (const style of parsedStyles) {
      for (const key in style) {
        allKeys.add(key);
      }
    }
    
    // Check each property - if values differ across any styles, add to differences
    for (const key of allKeys) {
      const values = new Set();
      for (const style of parsedStyles) {
        values.add(style[key] || '(not set)');
      }
      if (values.size > 1) {
        allDifferences.add(key);
      }
    }
    
    return Array.from(allDifferences);
  }
};

// Make globally available
window.StyleComparisonUtils = StyleComparisonUtils;