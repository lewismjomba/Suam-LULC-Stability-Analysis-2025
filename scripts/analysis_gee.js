// =============================================================
// 1. STUDY AREA (Suam Area: Kenya/Uganda - MT. ELGON)
// =============================================================

// 1. Study Area (Representative Subset - 20km x 20km)
// Captures the Suam River, the border crossing, and the distinct 
// transition from Mt Elgon National Park (forest) to Agriculture.

var mountElgonExtent = ee.Geometry.Rectangle([
  34.68, 1.10,  // West Longitude, South Latitude
  34.86, 1.28   // East Longitude, North Latitude
]);
Map.centerObject(mountElgonExtent, 12);
Map.addLayer(mountElgonExtent, {color: 'red'}, 'Study Area (Suam 20kmx20km)');

// 2. Helper Functions
function maskL9(image) {
  var qa = image.select('QA_PIXEL');
  return image.updateMask(qa.bitwiseAnd(1 << 3).eq(0)
    .and(qa.bitwiseAnd(1 << 4).eq(0))
    .and(qa.bitwiseAnd(1 << 2).eq(0)));
}

// 3. Data Collection (Landsat 9)
var l9Col = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
  .filterBounds(mountElgonExtent)
  .filterDate('2025-01-01', '2025-12-31')
  .map(maskL9)
  .select(
    ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'],
    ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2']
  );

var image2025 = l9Col.median().clip(mountElgonExtent);


// Define False Color Viz (NIR, SWIR1, Red)
var l9Viz = {
  bands: ['NIR', 'SWIR1', 'Red'],
  min: 7000,
  max: 30000,
  gamma: 1.4
};

Map.addLayer(image2025, l9Viz, 'Landsat 9 False Color (2025)');


// Define True Color Viz (Red, Green, Blue)
var trueColorViz = {
  bands: ['Red', 'Green', 'Blue'],
  min: 0,
  max: 30000, // Landsat 9 Scale is roughly 0-65535, but 30000 usually captures the land surface well
  gamma: 1.2    // Slightly lower gamma for more natural contrast
};

Map.addLayer(image2025, trueColorViz, 'Landsat 9 True Color (2025)');

// =============================================================
// 2. FEATURE EXTRACTION (BUILDING THE 82-FEATURE STACK)
// =============================================================

// Type 1: Band Percentiles (30)
var percentiles = l9Col.reduce(ee.Reducer.percentile([10, 25, 50, 75, 90]));

// Type 2: Index Statistics (40)
var addAllIndices = function(img) {
  var ndvi = img.normalizedDifference(['NIR', 'Red']).rename('NDVI');
  var ndbi = img.normalizedDifference(['SWIR1', 'NIR']).rename('NDBI');
  var ndwi = img.normalizedDifference(['Green', 'NIR']).rename('NDWI');
  var mndwi = img.normalizedDifference(['Green', 'SWIR1']).rename('MNDWI');
  var ndsi = img.normalizedDifference(['Green', 'SWIR1']).rename('NDSI');
  var nbr = img.normalizedDifference(['NIR', 'SWIR2']).rename('NBR');
  var bsi = img.expression('((SWIR1 + Red) - (NIR + Blue)) / ((SWIR1 + Red) + (NIR + Blue))', 
    {'SWIR1':img.select('SWIR1'),'Red':img.select('Red'),'NIR':img.select('NIR'),'Blue':img.select('Blue')}).rename('BSI');
  var brightness = img.reduce(ee.Reducer.mean()).rename('Brightness');
  var bci = img.normalizedDifference(['SWIR1', 'Red']).rename('BCI');
  var blfei = img.expression('(SWIR1 + Green - Red) / (SWIR1 + Green + Red)',
    {'SWIR1':img.select('SWIR1'),'Green':img.select('Green'),'Red':img.select('Red')}).rename('BLFEI');
  return img.addBands([ndvi, ndbi, ndwi, mndwi, ndsi, nbr, bsi, brightness, bci, blfei]);
};

var indexStats = l9Col.map(addAllIndices)
  .select(['NDVI', 'NDBI', 'NDWI', 'MNDWI', 'NDSI', 'NBR', 'BSI', 'Brightness', 'BCI', 'BLFEI'])
  .reduce(ee.Reducer.minMax().combine(ee.Reducer.mean(), '', true).combine(ee.Reducer.stdDev(), '', true));

// Type 3: Texture (6)
var glcm = image2025.select('NIR').multiply(100).toUint16().glcmTexture({size: 3})
  .select(['NIR_var', 'NIR_contrast', 'NIR_diss', 'NIR_ent', 'NIR_corr', 'NIR_idm']);

// Type 4: Terrain & Hydro (6)
var srtm = ee.Image('USGS/SRTMGL1_003').clip(mountElgonExtent);
var terrainFeatures = ee.Algorithms.Terrain(srtm).select(['elevation', 'aspect', 'slope']);
var merit = ee.Image("MERIT/Hydro/v1_0_1").clip(mountElgonExtent);
var hand = merit.select('hnd').rename('HAND');
var uparea = merit.select('upa'); 
var slopeRad = terrainFeatures.select('slope').multiply(Math.PI / 180);
var twi = uparea.divide(slopeRad.tan().add(0.01)).log().rename('TWI');
var tpi = srtm.subtract(srtm.focal_mean(150, 'circle', 'meters')).rename('TPI');

// THE FINAL STACK (82 BANDS)
var finalStack = ee.Image.cat([percentiles, indexStats, glcm, terrainFeatures, hand, twi, tpi]);

// Pick 3 representative bands for the 'RGB' display (e.g., Elevation, NIR, and TWI)
// This makes the layer "visible" while keeping all 82 bands attached.
var stackViz = {
  bands: ['elevation', 'NIR_median', 'twi'], // Replace with your actual band names
  min: [1000, 500, 0],
  max: [3000, 5000, 20]
};

// Map.addLayer(finalStack, stackViz, '82-Band Feature Stack');

// // 1. Topographic Theme (Elevation, Slope, Aspect)
// Map.addLayer(finalStack.select(['elevation', 'slope', 'aspect']), {min: 0, max: 3000}, 'Terrain Theme');

// // 2. Texture Theme (GLCM Entropy, Variance, Correlation)
// Map.addLayer(finalStack.select(['NIR_ent', 'NIR_var', 'NIR_corr']), {min: 0, max: 1}, 'Texture/Roughness Theme');

// // 3. Hydrology Theme (TWI, HAND, Water Index)
// Map.addLayer(finalStack.select(['twi', 'hand', 'NDWI_median']), {min: 0, max: 20}, 'Hydrology/Moisture Theme');


// =============================================================
// 3. ROBUST TRAINING DATA GENERATION (CONSENSUS + PHYSICS)
// =============================================================
// A Multi-Source Consensus method.
// Classes: 1:Forest, 2:Grass, 3:Crop, 4:Bare, 5:Water, 6:Urban

// 1. Load Reference Datasets
var esa = ee.Image("ESA/WorldCover/v100/2020").clip(mountElgonExtent);
var dw = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
  .filterBounds(mountElgonExtent)
  .filterDate('2024-01-01', '2025-12-31') // Matches your study period
  .mode()
  .select('label')
  .clip(mountElgonExtent);

// 2. Harmonize Classes to Standard Scheme (1-6)
// ESA Original: 10(Tree), 30(Grass), 40(Crop), 60(Bare), 80(Water), 50(Built)
// DW Original:  1(Tree),  2(Grass),  4(Crop),  7(Bare),  0(Water),  6(Built)
var esaRemapped = esa.remap([10, 30, 40, 60, 80, 50], [1, 2, 3, 4, 5, 6], 0).rename('class');
var dwRemapped = dw.remap([1, 2, 4, 7, 0, 6], [1, 2, 3, 4, 5, 6], 0).rename('class');

// 3. Create Consensus Map (High Confidence)
// Only accept pixels where ESA and Dynamic World AGREE
var consensusMap = esaRemapped.updateMask(esaRemapped.eq(dwRemapped)).rename('consensus_class');

// 4. Fill Gaps with Physics-Based Logic (The "Enhancement")
// Global maps often miss small streams or fallow fields. We use your bands to find them.

// A. Physics-Based Water: High MNDWI + Low HAND (Must be in a valley)
var strictWater = finalStack.select('MNDWI_mean').gt(0.1) 
  .and(hand.lt(15)) // Height Above Nearest Drainage < 15m
  .and(esaRemapped.eq(5).or(dwRemapped.eq(5))); // At least one map says water

// B. Spectral Bareland: High Brightness + Low Vegetation
var strictBare = finalStack.select('BSI_mean').gt(0.1)
  .and(finalStack.select('NDVI_mean').lt(0.25))
  .and(esaRemapped.eq(4).or(dwRemapped.eq(4))); // At least one map says bare

// 5. Final "Ground Truth" Proxy Map
// Priority: 1. Strict Consensus, 2. Physics Water, 3. Spectral Bare
var finalProxyMap = consensusMap.unmask(0)
  .where(consensusMap.eq(0).and(strictWater), 5)
  .where(consensusMap.eq(0).and(strictBare), 4)
  .selfMask() // Remove remaining 0s (pixels where maps disagreed and physics didn't apply)
  .rename('Map'); // Naming it 'Map' to match your classifier code

// Map.addLayer(finalProxyMap, {min:1, max:6, palette:['006400','ffbb22','ffff4c','f096ff','0064c8','fa0000']}, 'Robust Training Labels');
Map.addLayer(finalProxyMap, {min:1, max:6, palette: [
    '006400', // 1: Forest (Dark Green)
    '90ee90', // 2: Grass (Light Green)
    'ffff00', // 3: Crop (Pure Yellow)
    'a0522d', // 4: Bareland (Saddle Brown)
    '0064c8', // 5: Water (Blue)
    'ff0000'  // 6: Urban (Pure Red)
  ]}, 'Consensus Training Layer');

print('Total Features in Stack:', finalStack.bandNames().length());
print('Total Features in Stack (FinalProxy):', finalProxyMap.bandNames().length());
// =============================================================
// 4. STRATIFIED SAMPLING
// =============================================================

// We define specific counts to ensure rare classes (Water/Bare) get enough points
// 1:Forest, 2:Grass, 3:Crop, 4:Bare, 5:Water, 6:Urban
// var customCounts = [800, 300, 800, 150, 100, 100]; //RF - 93%
var customCounts = [300, 100, 300, 100, 100, 100]; 
var classIds = [1, 2, 3, 4, 5, 6];

var training = finalStack.addBands(finalProxyMap).stratifiedSample({
  numPoints: 0, // Set to 0 because we use classPoints below
  classBand: 'Map',
  region: mountElgonExtent,
  scale: 30,
  geometries: true,
  dropNulls: true,
  classValues: classIds,
  classPoints: customCounts
});

// Helper to print class counts (sanity check for the paper)
print('Training Data Distribution:', training.aggregate_histogram('Map'));

// =============================================================
// 5. TRAIN/TEST SPLIT
// =============================================================
// Split into Train (70%) and Validation (30%)
var split = 0.7;
var withRandom = training.randomColumn('random');
var trainingPartition = withRandom.filter(ee.Filter.lt('random', split));
var testingPartition = withRandom.filter(ee.Filter.gte('random', split));

// ==================================================================
// 6. CLASSIFIER SETUP (RF vs GBM vs SVM vs CART vs Minimum Distance)
// ==================================================================

// A. Random Forest (The "Winner")
var rf = ee.Classifier.smileRandomForest({numberOfTrees: 100, variablesPerSplit: 5})
    .train({features: trainingPartition, classProperty: 'Map', inputProperties: finalStack.bandNames()});

// B. Gradient Boosting Machines (The "Challenger")
var gbm = ee.Classifier.smileGradientTreeBoost({numberOfTrees: 50, shrinkage: 0.05, samplingRate: 0.7})
    .train({features: trainingPartition, classProperty: 'Map', inputProperties: finalStack.bandNames()});

// C. SVM (The "Artifact" Baseline - prone to salt-and-pepper noise)
var svm = ee.Classifier.libsvm({kernelType: 'RBF', gamma: 0.5, cost: 10})
    .train({features: trainingPartition, classProperty: 'Map', inputProperties: finalStack.bandNames()});


// D. CART (The "Simple Baseline")
// Useful to show why an "Ensemble" (Forest) is better than a single Tree.
var cart = ee.Classifier.smileCart()
    .train({features: trainingPartition, classProperty: 'Map', inputProperties: finalStack.bandNames()});


// Define the "Traditional" bands using the available p50 (Median) names
var spectralBands = ['Blue_p50', 'Green_p50', 'Red_p50', 'NIR_p50', 'SWIR1_p50', 'SWIR2_p50'];

// --- 1. TRAIN THE MODEL (Section 6E) ---
var minDist = ee.Classifier.minimumDistance({metric: 'mahalanobis'}) // or 'euclidean'
    .train({
      features: trainingPartition, 
      classProperty: 'Map', 
      inputProperties: spectralBands // <--- Uses p50 bands now
    });
  
  
// =============================================================
// 7. CLASSIFICATION
// =============================================================

// 1. Random Forest (The Optimized Method)
var classifiedRF = finalStack.classify(rf);
// 2. Gradient Boosting (The Complex Challenger)
var classifiedGBM = finalStack.classify(gbm);
// 3. SVM (The High-Dim Baseline)
var classifiedSVM = finalStack.classify(svm);
// 4. CART (The Single-Tree Baseline) - NEW
var classifiedCART = finalStack.classify(cart);

// // 5. Minimum Distance (The Traditional Baseline) - NEW
// // Note: This uses only spectral bands as defined in the training step
// var classifiedMinDist = finalStack.select(['Blue','Green','Red','NIR','SWIR1','SWIR2'])
//     .classify(minDist);

// --- 2. CLASSIFY THE IMAGE (Section 7.5) ---
// We strictly select the same bands used for training
var classifiedMinDist = finalStack.select(spectralBands)
    .classify(minDist)
    .clip(mountElgonExtent);

// =============================================================
// 8. ACCURACY ASSESSMENT (Updated)
// =============================================================
print('---------------- DETAILED ACCURACY REPORT ----------------');

// Helper function to calculate and print ALL metrics for a classifier
var printDetailedAccuracy = function(classifier, name) {
  print('================ ' + name + ' ================');
  
  // 1. Generate the Confusion Matrix using the TEST partition
  var testResults = testingPartition.classify(classifier);
  var errorMatrix = testResults.errorMatrix('Map', 'classification');
  
  // 2. Overall Accuracy
  print(name + ' Overall Accuracy:', errorMatrix.accuracy());
  
  // 3. Kappa Coefficient
  print(name + ' Kappa Coefficient:', errorMatrix.kappa());
  
  // 4. Producer's Accuracy (Column Accuracy)
  // Measure of "Omission Error" (What did we miss?)
  print(name + ' Producers Accuracy:', errorMatrix.producersAccuracy());
  
  // 5. User's Accuracy (Row Accuracy)
  // Measure of "Commission Error" (False Positives)
  print(name + ' Users Accuracy:', errorMatrix.consumersAccuracy());
  
  // 6. The Confusion Matrix Itself
  print(name + ' Confusion Matrix:', errorMatrix);
};

// Run for all 5 models
printDetailedAccuracy(rf, 'Random Forest');
printDetailedAccuracy(gbm, 'Gradient Boosting');
printDetailedAccuracy(cart, 'CART');
printDetailedAccuracy(minDist, 'Minimum Distance');
printDetailedAccuracy(svm, 'SVM');


//  // =============================================================
// 9. VISUAL LAYERS
// =============================================================
// var viz = {min: 1, max: 6, palette: ['006400','ffbb22','ffff4c','f096ff','0064c8','fa0000']}; 
var viz = {
  min: 1, 
  max: 6, 
  palette: ['006400', '90ee90', 'ffff00', 'a0522d', '0064c8', 'ff0000']
};


// Add them to the map to compare
Map.addLayer(classifiedMinDist, viz, '5. Min Distance (Simple)', false);
Map.addLayer(classifiedCART, viz, '4. CART (Blocky)', false);
Map.addLayer(classifiedSVM, viz, '3. SVM (Salt & Pepper)', false);
Map.addLayer(classifiedGBM, viz, '2. GBM (Detailed)', false);
Map.addLayer(classifiedRF, viz, '1. RF (Optimized)', true); // Only RF on by default


// =============================================================
// 10. VISUALIZING TRAINING SAMPLES
// =============================================================

// Define a color palette matching your classification scheme
// 1:Forest (Green), 2:Grass (Yellow-Green), 3:Crop (Yellow), 
// 4:Bare (Pink), 5:Water (Blue), 6:Urban (Red)
// var classPalette = ['006400', 'ffbb22', 'ffff4c', 'f096ff', '0064c8', 'fa0000'];
var classPalette = ['006400', '90ee90', 'ffff00', 'a0522d', '0064c8', 'ff0000'];

// Create a function to color the points based on the 'Map' property
var coloredPoints = training.map(function(feature) {
  var classVal = feature.get('Map');
  // Map class 1-6 to colors in the palette
  var color = ee.List(classPalette).get(ee.Number(classVal).subtract(1));
  return feature.set('style', {color: color, pointSize: 3});
});

// Add the points to the map
// We use .style() to apply the colors defined above
Map.addLayer(coloredPoints.style({styleProperty: 'style'}), {}, 'Training Samples (Color-Coded)');

// Optional: Add a label for each point when clicked
print('Training Samples Metadata:', training.limit(10));


// =============================================================
// 11. AREA CALCULATION ITERATION (FIXED)
// =============================================================
print('---------------- AREA ESTIMATION (HECTARES) ----------------');

// 1. Define the Class Names as an Earth Engine Dictionary (Server-Side)
// Keys must be strings for ee.Dictionary
var classNamesDict = ee.Dictionary({
  '1': 'Forest',
  '2': 'Grassland',
  '3': 'Cropland',
  '4': 'Bareland',
  '5': 'Water',
  '6': 'Urban'
});

// 2. Helper Function to Calculate Area for ONE Classifier
var getAreaStats = function(classifiedImage, modelName) {
  // Create an image of pixel areas in Hectares
  var areaImage = ee.Image.pixelArea().divide(10000); 
  
  // Sum the area per class using a Grouped Reducer
  var areaStats = areaImage.addBands(classifiedImage).reduceRegion({
    reducer: ee.Reducer.sum().group({
      groupField: 1,
      groupName: 'class_val',
    }),
    geometry: mountElgonExtent,
    scale: 30,
    maxPixels: 1e9,
    bestEffort: true
  });
  
  // Format the result into a readable FeatureCollection
  var groups = ee.List(areaStats.get('groups'));
  var features = groups.map(function(item) {
    var dict = ee.Dictionary(item);
    var classVal = dict.get('class_val'); // This is a Number (e.g., 1)
    var area = dict.get('sum');
    
    // FIX: Convert Number to String to look it up in the Dictionary
    var classValString = ee.Number(classVal).format('%d');
    var name = classNamesDict.get(classValString);
    
    return ee.Feature(null, {
      'Model': modelName,
      'Class_ID': classVal,
      'Class_Name': name,
      'Area_Ha': area
    });
  });
  
  return ee.FeatureCollection(features);
};

// 3. Run the Iteration for All 5 Classifiers
var areaRF = getAreaStats(classifiedRF, '1. Random Forest');
var areaGBM = getAreaStats(classifiedGBM, '2. GBM');
var areaCART = getAreaStats(classifiedCART, '3. CART');
var areaMinDist = getAreaStats(classifiedMinDist, '4. MinDist');
var areaSVM = getAreaStats(classifiedSVM, '5. SVM');

// 4. Merge Results for Charting
var allAreas = areaRF.merge(areaGBM).merge(areaCART).merge(areaMinDist).merge(areaSVM);

// 5. Print the Chart (Visual Comparison)
var areaChart = ui.Chart.feature.groups(allAreas, 'Class_Name', 'Area_Ha', 'Model')
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Operational Impact: Area Estimation Differences',
    hAxis: {title: 'Land Cover Class'},
    vAxis: {title: 'Estimated Area (Hectares)'},
    colors: ['1a9641', 'd7191c', 'fdae61', '2b83ba', '404040'] // Colors for the 5 models
  });
print(areaChart);

// 6. Print the Raw Table (For your Paper)
print('Merged Area Data (Click to see values):', allAreas);

// =============================================================
// 12. TOPOGRAPHIC STATISTICS (MIN/MAX ELEVATION)
// =============================================================

// 1. Select the elevation band from the SRTM image
var elevation = srtm.select('elevation');

// 2. Calculate Min and Max statistics for the study area
var topoStats = elevation.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: mountElgonExtent,
  scale: 30, // SRTM resolution
  maxPixels: 1e9
});

// 3. Print the results
print('---------------- TOPOGRAPHY STATS ----------------');
print('Minimum Elevation (m):', topoStats.get('elevation_min'));
print('Maximum Elevation (m):', topoStats.get('elevation_max'));

// =============================================================
// 13. EXPORT BOUNDING BOX (FOR GIS)
// =============================================================

// Convert the Geometry (Rectangle) into a FeatureCollection so it can be exported
var exportBoundary = ee.FeatureCollection([
  ee.Feature(mountElgonExtent, {'name': 'Suam_Study_Area'})
]);

// Export as a Shapefile (SHP)
Export.table.toDrive({
  collection: exportBoundary,
  description: 'Suam_Study_Area_BBox',
  folder: 'GEE_Exports', // Change this to your preferred Google Drive folder
  fileFormat: 'SHP'
});

print('Check the "Tasks" tab to run the export.');


// =============================================================
// 14. EXPORT TRAINING SAMPLES
// =============================================================

// Export the training data to Google Drive
Export.table.toDrive({
  collection: training, // This is the variable from your Section 4
  description: 'Suam_Training_Points_CP3',
  folder: 'GEE_Exports',
  fileFormat: 'CSV',
  selectors: ['Map', '.geo'] // Exports the class label and the coordinates
});

// Export the training data to your GEE Assets
Export.table.toAsset({
  collection: training,
  description: 'Suam_Training_Points_Asset_CP3',
  assetId: 'Suam_Training_Points_2025' // This will appear in your 'Assets' tab
});



// // =============================================================
// // 15. EXPORTING CLASSIFIED MAPS (FOR GIS)
// // =============================================================

// // Define export parameters to keep it consistent
// var exportParams = {
//   scale: 30, // Resolution in meters
//   region: mountElgonExtent,
//   maxPixels: 1e13,
//   crs: 'EPSG:4326'
// };

// // 1. Export Random Forest
// Export.image.toDrive({
//   image: classifiedRF.toInt(),
//   description: 'LULC_MountElgon_RF',
//   folder: 'GEE_Classification',
//   scale: 30,
//   region: mountElgonExtent
// });

// // 2. Export Gradient Boosting
// Export.image.toDrive({
//   image: classifiedGBM.toInt(),
//   description: 'LULC_MountElgon_GBM',
//   folder: 'GEE_Classification',
//   scale: 30,
//   region: mountElgonExtent
// });

// // 3. Export SVM
// Export.image.toDrive({
//   image: classifiedSVM.toInt(),
//   description: 'LULC_MountElgon_SVM',
//   folder: 'GEE_Classification',
//   scale: 30,
//   region: mountElgonExtent
// });

// // 4. Export CART
// Export.image.toDrive({
//   image: classifiedCART.toInt(),
//   description: 'LULC_MountElgon_CART',
//   folder: 'GEE_Classification',
//   scale: 30,
//   region: mountElgonExtent
// });

// // 5. Export Minimum Distance
// Export.image.toDrive({
//   image: classifiedMinDist.toInt(),
//   description: 'LULC_MountElgon_MinDist',
//   folder: 'GEE_Classification',
//   scale: 30,
//   region: mountElgonExtent
// });

// // 6. "Bake" the visualization into the image pixels
// var trueColorImage = image2025.visualize({
//   bands: ['Red', 'Green', 'Blue'],
//   min: 0,
//   max: 30000,
//   gamma: 1.2
// });

// // 2. Export the Visualized RGB Image to Drive
// Export.image.toDrive({
//   image: trueColorImage,
//   description: 'MountElgon_TrueColor_2025',
//   folder: 'GEE_Classification',
//   scale: 30,           // 30 meters for Landsat 9
//   region: mountElgonExtent,
//   crs: 'EPSG:4326',    // Standard WGS84
//   maxPixels: 1e13
// });
