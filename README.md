# Evaluating Classification Accuracy, Area Estimation, and Area Deviations of Five Algorithms in Google Earth Engine
### Suam LULC Analysis 2025: Comparative Machine Learning Performance

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GEE-Code](https://img.shields.io/badge/Google_Earth_Engine-Script-blue)](https://code.earthengine.google.com/9cd46be3da82dc9030a23ac2e354f5ab)
[![Python-Analysis](https://img.shields.io/badge/Python-Visualization-green?logo=python&logoColor=white)](scripts/visualizations_SUAM.ipynb)

## 1. Project Overview
This repository hosts the source code and datasets for the comparative analysis of five supervised machine learning algorithms: **Random Forest (RF)**, **Gradient Tree Boost (GTB)**, **Classification and Regression Trees (CART)**, **Minimum Distance (MD)**, and **Support Vector Machines (SVM)**. 

The study assesses classifier stability and area estimation accuracy in the heterogeneous tropical landscape of the Suam region (Mt. Elgon), along the Kenyan-Ugandan border.

---

## 2. Study Area
The research area covers a **20 km × 20 km (40,000 ha)** site on the slopes of **Mount Elgon**. 
* **Geography:** Transboundary forest transition zone between Kenya and Uganda.
* **Topography:** Elevation ranges from **1700 m to 3300 m** a.s.l.
* **Ecosystems:** High heterogeneity featuring protected forests, riparian ecosystems of the Suam River, agricultural lands, and built-up areas.

![Study Area Map](images/Study_Area.png)
*Figure 1: Study area location (Suam, Mt. Elgon) and topographic context.*

---

## 3. Methodology & Data

### Data Inputs:
* **Satellite:** Cloud-free 2025 Landsat 9 (Collection 2 Level 2) median composite.
* **Terrain/Hydro:** SRTM DEM and MERIT Hydro datasets.
* **Feature Stack:** An **82-band hypercube** (30 spectral metrics, 40 spectral indices, 6 texture bands, and 6 terrain/hydro features).

### Workflow:
1. **Sample Generation:** Automated stratified random sampling derived from ESA WorldCover and Dynamic World consensus maps (**863 training samples**).
2. **Classification:** Implementation of five algorithms within the Google Earth Engine (GEE) environment.
3. **Evaluation:** Accuracy assessment using OA, Kappa, mF1, and Disagreement Analysis (QD/AD).

![Methodological Workflow](images/Workflow.png)
*Figure 2: Methodological workflow for LULC classification and area deviation analysis.*

---

## 4. Repository Structure
* **`/scripts`**: 
    * `analysis_gee.js`: GEE JavaScript code for feature engineering and classifier execution.
    * `visualizations_SUAM.ipynb`: Python notebook for generating error matrices and disagreement plots.
* **`/data`**: 
    * `training_samples_863.csv`: The validated training dataset.

---

## 5. Key Results & Reproduction

### Summary of Performance:
* **Top Performer:** Random Forest (OA: 93.4%, K: 0.91, mF1: 0.922).
* **Model Collapse:** SVM exhibited significant instability, inflating cropland estimates while failing to predict other classes accurately.

### Reproduction:
1. **GEE Script:** Access the [Interactive Snapshot]([https://code.earthengine.google.com/9cd46be3da82dc9030a23ac2e354f5ab](https://code.earthengine.google.com/c517cd83def3761a11f592ebda6dc966)).
2. **Python Plots:** Run the notebook in `/scripts` to reproduce the Disagreement Analysis (QD/AD) following the Pontius and Millones (2011) framework.

---

## 6. Citation & License
If you utilize this code or data, please cite:
> *[Full citation for CP_3 - To be updated upon publication]*

Licensed under the **MIT License**.
