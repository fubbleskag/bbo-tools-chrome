// Script to convert SVG icons to PNG
// Requires Node.js with sharp package installed
// Run: npm install sharp
// Then: node convert-icons.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconSizes = [16, 48, 128];
const sourceDir = path.join(__dirname, '..', 'icons');
const targetDir = path.join(__dirname, '..', 'icons');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Process each icon size
iconSizes.forEach(size => {
  const svgPath = path.join(sourceDir, `icon${size}.svg`);
  const pngPath = path.join(targetDir, `icon${size}.png`);
  
  // Check if SVG exists
  if (fs.existsSync(svgPath)) {
    console.log(`Converting ${svgPath} to ${pngPath}`);
    
    // Convert SVG to PNG
    sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(pngPath)
      .then(() => {
        console.log(`Successfully converted icon${size}.svg to PNG`);
      })
      .catch(err => {
        console.error(`Error converting icon${size}.svg:`, err);
      });
  } else {
    console.error(`Source file ${svgPath} not found`);
  }
});

console.log('Conversion process initiated. Check the output for results.');