const fs = require('fs');

let content = fs.readFileSync('populate-foods.js', 'utf8');

// Add serving_size and serving_unit after nutritionFacts for any food that doesn't have them
content = content.replace(
  /(\s+nutritionFacts: \{[^}]+\},)(\n\s+commonServings:)/g,
  '$1\n    serving_size: 100,\n    serving_unit: \'g\',$2'
);

fs.writeFileSync('populate-foods.js', content);
console.log('Fixed serving size and unit for all foods');
