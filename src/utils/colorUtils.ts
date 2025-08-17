// Utility function to generate light/dark versions of a color
export const getColorShades = (color: string) => {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Generate light background (with alpha) - make it more visible
  const lightBg = `rgba(${r}, ${g}, ${b}, 0.15)`;
  
  // Generate hover background (with higher alpha)
  const hoverBg = `rgba(${r}, ${g}, ${b}, 0.25)`;
  
  // Generate text color (darker version)
  const textColor = `rgb(${Math.max(0, r - 80)}, ${Math.max(0, g - 80)}, ${Math.max(0, b - 80)})`;
  
  return {
    lightBg,
    hoverBg,
    textColor,
    borderColor: color
  };
};