import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic();

export interface MLModelParameters {
  problemType: 'classification' | 'clustering' | 'dimensionality_reduction';
  modelType: string;
  autoMode: boolean;
  dataSource: string;
  targetVariable?: string;
  featureVariables: string[];
  classLabels?: string[];
  nClusters?: number | 'auto';
  nComponents?: number | 'auto';
  purpose?: 'visualization' | 'preprocessing';
  testSize: number;
  randomState: number;
  cvFolds: number;
  scaleFeatures: boolean;
  handleImbalance: boolean;
  hyperparameterTuning: 'none' | 'grid' | 'random';
  tuningIterations: number;
  sampleSize: number;
  customInstructions?: string;
}

export async function parseMLDescription(
  input: string,
  customInstructions: string = "",
  provider: string = "ZHI 5"
): Promise<MLModelParameters> {
  const systemPrompt = `You are an expert machine learning engineer that extracts structured parameters from natural language descriptions of ML problems.

Extract the following information and return it as a JSON object:

{
  "problemType": "classification" | "clustering" | "dimensionality_reduction",
  "modelType": "<specific model or 'auto' for comparison>",
  "autoMode": <true if user wants to compare multiple models>,
  "dataSource": "<description of data source or 'synthetic'>",
  "targetVariable": "<target column name for classification>",
  "featureVariables": ["<list of feature column names>"],
  "classLabels": ["<class names if classification>"],
  "nClusters": <number of clusters or "auto">,
  "nComponents": <number of components or "auto">,
  "purpose": "visualization" | "preprocessing",
  "testSize": <0.0-0.5, default 0.2>,
  "randomState": <integer, default 42>,
  "cvFolds": <3-10, default 5>,
  "scaleFeatures": <boolean, default true>,
  "handleImbalance": <boolean, default false>,
  "hyperparameterTuning": "none" | "grid" | "random",
  "tuningIterations": <10-100, default 50>,
  "sampleSize": <number of samples to generate, default 1000>,
  "customInstructions": "<any special requirements>"
}

PARSING RULES:
- "classify", "predict category", "which group", "predict whether" → classification
- "segment", "group similar", "find patterns", "cluster" → clustering
- "reduce dimensions", "visualize high-dimensional", "compress features", "PCA", "t-SNE" → dimensionality_reduction

CLASSIFICATION MODELS:
- "random forest" → "random_forest"
- "xgboost", "gradient boost" → "xgboost"
- "svm", "support vector" → "svm"
- "neural network", "mlp", "deep learning" → "mlp"
- "gradient boosting" → "gradient_boosting"
- "knn", "k-nearest", "nearest neighbors" → "knn"
- "naive bayes", "probabilistic" → "naive_bayes"
- "logistic regression", "logistic" → "logistic_regression"
- "compare", "best model", "which algorithm" → "auto"

CLUSTERING MODELS:
- "k-means", "kmeans" → "kmeans"
- "dbscan", "density-based" → "dbscan"
- "hierarchical", "agglomerative" → "hierarchical"
- "gmm", "gaussian mixture" → "gmm"
- "mean shift" → "mean_shift"

DIMENSIONALITY REDUCTION:
- "pca", "principal component" → "pca"
- "t-sne", "tsne" → "tsne"
- "umap" → "umap"
- "lda", "linear discriminant" → "lda"

If "imbalanced", "rare class", "skewed" mentioned → handleImbalance: true
If "fast", "quick", "simple" → prefer simpler models
If "accurate", "best performance", "production" → autoMode with tuning

Return ONLY the JSON object, no additional text.`;

  const userMessage = customInstructions 
    ? `${input}\n\nAdditional instructions: ${customInstructions}`
    : input;

  let response: string = "";

  try {
    if (provider === "ZHI 1") {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.1
      });
      response = completion.choices[0]?.message?.content || "";
    } else if (provider === "ZHI 2") {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [
          { role: "user", content: `${systemPrompt}\n\nUser request: ${userMessage}` }
        ]
      });
      response = message.content[0].type === 'text' ? message.content[0].text : "";
    } else if (provider === "ZHI 3") {
      const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          temperature: 0.1
        })
      });
      const deepseekData = await deepseekResponse.json();
      response = deepseekData.choices?.[0]?.message?.content || "";
    } else if (provider === "ZHI 4") {
      const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-large-128k-online",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          temperature: 0.1
        })
      });
      const perplexityData = await perplexityResponse.json();
      response = perplexityData.choices?.[0]?.message?.content || "";
    } else {
      const grokResponse = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROK_API_KEY}`
        },
        body: JSON.stringify({
          model: "grok-3-latest",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          temperature: 0.1
        })
      });
      const grokData = await grokResponse.json();
      response = grokData.choices?.[0]?.message?.content || "";
    }

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse LLM response as JSON");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      problemType: parsed.problemType || 'classification',
      modelType: parsed.modelType || 'auto',
      autoMode: parsed.autoMode ?? (parsed.modelType === 'auto'),
      dataSource: parsed.dataSource || 'synthetic',
      targetVariable: parsed.targetVariable,
      featureVariables: parsed.featureVariables || [],
      classLabels: parsed.classLabels,
      nClusters: parsed.nClusters,
      nComponents: parsed.nComponents,
      purpose: parsed.purpose || 'visualization',
      testSize: parsed.testSize ?? 0.2,
      randomState: parsed.randomState ?? 42,
      cvFolds: parsed.cvFolds ?? 5,
      scaleFeatures: parsed.scaleFeatures ?? true,
      handleImbalance: parsed.handleImbalance ?? false,
      hyperparameterTuning: parsed.hyperparameterTuning || 'random',
      tuningIterations: parsed.tuningIterations ?? 50,
      sampleSize: parsed.sampleSize ?? 1000,
      customInstructions: parsed.customInstructions
    };
  } catch (error) {
    console.error("Error parsing ML description:", error);
    throw error;
  }
}

export function generateMLPythonCode(params: MLModelParameters): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  const header = `"""
Machine Learning Model: ${params.modelType.replace('_', ' ').toUpperCase()}
Problem Type: ${params.problemType.replace('_', ' ').toUpperCase()}
Generated by Cognitive Analysis Platform - Data Science Panel
${params.targetVariable ? `Target Variable: ${params.targetVariable}` : ''}
Features: ${params.featureVariables.join(', ') || 'Auto-generated'}
Generated on: ${new Date().toISOString()}

Required packages:
pip install numpy pandas scikit-learn matplotlib seaborn joblib
${params.modelType === 'xgboost' || params.autoMode ? 'pip install xgboost  # Optional but recommended' : ''}
${params.problemType === 'dimensionality_reduction' && params.modelType === 'umap' ? 'pip install umap-learn  # For UMAP' : ''}
${params.handleImbalance ? 'pip install imbalanced-learn  # For SMOTE' : ''}
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV, RandomizedSearchCV
from sklearn.preprocessing import StandardScaler, LabelEncoder, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
import warnings
warnings.filterwarnings('ignore')
`;

  const classificationImports = `
# Classification imports
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.metrics import (accuracy_score, precision_score, recall_score, f1_score,
                             classification_report, confusion_matrix, roc_auc_score,
                             roc_curve, precision_recall_curve)

# Optional: XGBoost
try:
    from xgboost import XGBClassifier
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("Note: XGBoost not installed. Using GradientBoostingClassifier instead.")

# Optional: imbalanced-learn
try:
    from imblearn.over_sampling import SMOTE
    IMBLEARN_AVAILABLE = True
except ImportError:
    IMBLEARN_AVAILABLE = False
    print("Note: imbalanced-learn not installed. Using class_weight='balanced' instead.")
`;

  const clusteringImports = `
# Clustering imports
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering, MeanShift
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
from scipy.cluster.hierarchy import dendrogram, linkage
`;

  const dimReductionImports = `
# Dimensionality reduction imports
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis

# Optional: UMAP
try:
    import umap
    UMAP_AVAILABLE = True
except ImportError:
    UMAP_AVAILABLE = False
    print("Note: UMAP not installed. Using t-SNE for non-linear reduction.")
`;

  let imports = header;
  if (params.problemType === 'classification') {
    imports += classificationImports;
  } else if (params.problemType === 'clustering') {
    imports += clusteringImports;
  } else {
    imports += dimReductionImports;
  }

  const dataGeneration = generateDataCode(params);
  const eda = generateEDACode(params);
  const preprocessing = generatePreprocessingCode(params);
  
  let modelCode = '';
  let evaluationCode = '';
  let visualizationCode = '';
  
  if (params.problemType === 'classification') {
    modelCode = generateClassificationModelCode(params);
    evaluationCode = generateClassificationEvaluationCode(params);
    visualizationCode = generateClassificationVisualizationCode(params);
  } else if (params.problemType === 'clustering') {
    modelCode = generateClusteringModelCode(params);
    evaluationCode = generateClusteringEvaluationCode(params);
    visualizationCode = generateClusteringVisualizationCode(params);
  } else {
    modelCode = generateDimReductionModelCode(params);
    evaluationCode = generateDimReductionEvaluationCode(params);
    visualizationCode = generateDimReductionVisualizationCode(params);
  }

  const predictionFunction = generatePredictionFunction(params);
  const modelPersistence = generateModelPersistenceCode(params);

  return imports + dataGeneration + eda + preprocessing + modelCode + evaluationCode + visualizationCode + predictionFunction + modelPersistence;
}

function generateDataCode(params: MLModelParameters): string {
  const features = params.featureVariables.length > 0 
    ? params.featureVariables 
    : ['feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5'];

  if (params.problemType === 'classification') {
    const classLabels = params.classLabels || ['class_0', 'class_1'];
    return `
# ==============================================================================
# DATA LOADING / GENERATION
# ==============================================================================
print("=" * 70)
print("MACHINE LEARNING MODEL ANALYSIS")
print("=" * 70)

np.random.seed(${params.randomState})
n_samples = ${params.sampleSize}

# Generate synthetic classification data
from sklearn.datasets import make_classification

X_data, y_data = make_classification(
    n_samples=n_samples,
    n_features=${features.length},
    n_informative=${Math.max(2, Math.floor(features.length * 0.6))},
    n_redundant=${Math.floor(features.length * 0.2)},
    n_classes=${classLabels.length},
    n_clusters_per_class=2,
    weights=${classLabels.length === 2 ? '[0.7, 0.3]' : 'None'},
    flip_y=0.05,
    random_state=${params.randomState}
)

# Create DataFrame
feature_columns = ${JSON.stringify(features)}
df = pd.DataFrame(X_data, columns=feature_columns)
df['${params.targetVariable || 'target'}'] = y_data

# Map class labels
class_names = ${JSON.stringify(classLabels)}
if len(class_names) == len(df['${params.targetVariable || 'target'}'].unique()):
    label_map = {i: name for i, name in enumerate(class_names)}
    df['${params.targetVariable || 'target'}_label'] = df['${params.targetVariable || 'target'}'].map(label_map)

print(f"\\nDataset generated: {df.shape[0]} samples, {df.shape[1]} columns")
print(f"Target distribution:\\n{df['${params.targetVariable || 'target'}'].value_counts()}")
`;
  } else if (params.problemType === 'clustering') {
    return `
# ==============================================================================
# DATA LOADING / GENERATION
# ==============================================================================
print("=" * 70)
print("CLUSTERING ANALYSIS")
print("=" * 70)

np.random.seed(${params.randomState})
n_samples = ${params.sampleSize}

# Generate synthetic clustering data
from sklearn.datasets import make_blobs

n_clusters_true = ${params.nClusters === 'auto' ? 4 : params.nClusters || 4}
X_data, y_true = make_blobs(
    n_samples=n_samples,
    n_features=${features.length},
    centers=n_clusters_true,
    cluster_std=1.5,
    random_state=${params.randomState}
)

# Create DataFrame
feature_columns = ${JSON.stringify(features)}
df = pd.DataFrame(X_data, columns=feature_columns)

print(f"\\nDataset generated: {df.shape[0]} samples, {df.shape[1]} features")
print(f"True number of clusters: {n_clusters_true}")
`;
  } else {
    return `
# ==============================================================================
# DATA LOADING / GENERATION
# ==============================================================================
print("=" * 70)
print("DIMENSIONALITY REDUCTION ANALYSIS")
print("=" * 70)

np.random.seed(${params.randomState})
n_samples = ${params.sampleSize}

# Generate high-dimensional synthetic data
n_features = ${Math.max(features.length, 20)}
n_informative = ${Math.max(5, Math.floor(features.length / 2))}

from sklearn.datasets import make_classification

X_data, y_data = make_classification(
    n_samples=n_samples,
    n_features=n_features,
    n_informative=n_informative,
    n_redundant=5,
    n_classes=3,
    random_state=${params.randomState}
)

# Create DataFrame
feature_columns = [f'feature_{i+1}' for i in range(n_features)]
df = pd.DataFrame(X_data, columns=feature_columns)
df['target'] = y_data

print(f"\\nDataset generated: {df.shape[0]} samples, {df.shape[1]} columns")
print(f"Original dimensionality: {n_features} features")
`;
  }
}

function generateEDACode(params: MLModelParameters): string {
  return `
# ==============================================================================
# EXPLORATORY DATA ANALYSIS
# ==============================================================================
print("\\n" + "-" * 70)
print("EXPLORATORY DATA ANALYSIS")
print("-" * 70)

print("\\nDataset Shape:", df.shape)
print("\\nColumn Types:")
print(df.dtypes)
print("\\nFirst 5 Rows:")
print(df.head())
print("\\nDescriptive Statistics:")
print(df.describe().round(2))

# Missing values check
print("\\nMissing Values:")
missing = df.isnull().sum()
if missing.sum() > 0:
    print(missing[missing > 0])
else:
    print("No missing values detected.")

# Correlation analysis
numeric_cols = df.select_dtypes(include=[np.number]).columns
if len(numeric_cols) > 1:
    print("\\nTop Feature Correlations:")
    corr_matrix = df[numeric_cols].corr()
    upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
    high_corr = [(col, idx, upper.loc[idx, col]) 
                 for col in upper.columns for idx in upper.index 
                 if pd.notna(upper.loc[idx, col]) and abs(upper.loc[idx, col]) > 0.7]
    if high_corr:
        for feat1, feat2, corr in sorted(high_corr, key=lambda x: abs(x[2]), reverse=True)[:5]:
            print(f"  {feat1} <-> {feat2}: {corr:.3f}")
    else:
        print("  No highly correlated feature pairs (|r| > 0.7)")
`;
}

function generatePreprocessingCode(params: MLModelParameters): string {
  const targetCol = params.targetVariable || 'target';
  
  if (params.problemType === 'classification') {
    return `
# ==============================================================================
# DATA PREPROCESSING
# ==============================================================================
print("\\n" + "-" * 70)
print("DATA PREPROCESSING")
print("-" * 70)

# Define features and target
target_column = '${targetCol}'
feature_columns_final = [col for col in df.columns if col not in [target_column, '${targetCol}_label']]

# Identify column types
numeric_features = df[feature_columns_final].select_dtypes(include=[np.number]).columns.tolist()
categorical_features = df[feature_columns_final].select_dtypes(include=['object', 'category']).columns.tolist()

print(f"\\nNumeric features ({len(numeric_features)}): {numeric_features[:10]}{'...' if len(numeric_features) > 10 else ''}")
print(f"Categorical features ({len(categorical_features)}): {categorical_features}")

# Build preprocessing pipeline
numeric_transformer = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler())
])

categorical_transformer = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='most_frequent')),
    ('encoder', OneHotEncoder(drop='first', sparse_output=False, handle_unknown='ignore'))
])

preprocessor = ColumnTransformer(
    transformers=[
        ('num', numeric_transformer, numeric_features),
        ('cat', categorical_transformer, categorical_features)
    ],
    remainder='drop'
)

# Prepare data
X = df[feature_columns_final]
y = df[target_column]

# Encode target if categorical
if y.dtype == 'object':
    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(y)
    class_names_encoded = label_encoder.classes_
    print(f"\\nTarget classes encoded: {dict(zip(class_names_encoded, range(len(class_names_encoded))))}")
else:
    class_names_encoded = [f"Class {i}" for i in sorted(y.unique())]

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=${params.testSize}, random_state=${params.randomState}, stratify=y
)
print(f"\\nTraining set: {len(X_train)} samples")
print(f"Test set: {len(X_test)} samples")

# Fit preprocessor and transform data
X_train_processed = preprocessor.fit_transform(X_train)
X_test_processed = preprocessor.transform(X_test)

# Get feature names after preprocessing
feature_names_processed = numeric_features.copy()
if categorical_features:
    try:
        ohe = preprocessor.named_transformers_['cat'].named_steps['encoder']
        cat_feature_names = ohe.get_feature_names_out(categorical_features).tolist()
        feature_names_processed.extend(cat_feature_names)
    except:
        pass

print(f"Features after preprocessing: {X_train_processed.shape[1]}")
${params.handleImbalance ? `
# Handle class imbalance
if IMBLEARN_AVAILABLE:
    print("\\nApplying SMOTE for class imbalance...")
    smote = SMOTE(random_state=${params.randomState})
    X_train_processed, y_train = smote.fit_resample(X_train_processed, y_train)
    print(f"Training set after SMOTE: {len(X_train_processed)} samples")
else:
    print("\\nUsing class_weight='balanced' for imbalance handling")
    USE_CLASS_WEIGHTS = True
` : ''}`;
  } else if (params.problemType === 'clustering') {
    return `
# ==============================================================================
# DATA PREPROCESSING
# ==============================================================================
print("\\n" + "-" * 70)
print("DATA PREPROCESSING")
print("-" * 70)

# All columns are features for clustering
feature_columns_final = df.columns.tolist()

# Identify column types
numeric_features = df[feature_columns_final].select_dtypes(include=[np.number]).columns.tolist()
categorical_features = df[feature_columns_final].select_dtypes(include=['object', 'category']).columns.tolist()

print(f"\\nNumeric features ({len(numeric_features)}): {numeric_features}")
print(f"Categorical features ({len(categorical_features)}): {categorical_features}")

# Build preprocessing pipeline
numeric_transformer = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler())
])

preprocessor = ColumnTransformer(
    transformers=[
        ('num', numeric_transformer, numeric_features)
    ],
    remainder='drop'
)

# Prepare data (no train/test split for unsupervised learning)
X = df[feature_columns_final]
X_processed = preprocessor.fit_transform(X)

print(f"Features after preprocessing: {X_processed.shape[1]}")
`;
  } else {
    return `
# ==============================================================================
# DATA PREPROCESSING
# ==============================================================================
print("\\n" + "-" * 70)
print("DATA PREPROCESSING")
print("-" * 70)

# Separate features from target (if exists)
if 'target' in df.columns:
    y = df['target']
    feature_columns_final = [col for col in df.columns if col != 'target']
else:
    y = None
    feature_columns_final = df.columns.tolist()

# Identify column types
numeric_features = df[feature_columns_final].select_dtypes(include=[np.number]).columns.tolist()

print(f"\\nNumeric features ({len(numeric_features)}): {numeric_features[:10]}{'...' if len(numeric_features) > 10 else ''}")

# Build preprocessing pipeline
numeric_transformer = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler())
])

preprocessor = ColumnTransformer(
    transformers=[
        ('num', numeric_transformer, numeric_features)
    ],
    remainder='drop'
)

# Prepare data
X = df[feature_columns_final]
X_processed = preprocessor.fit_transform(X)

print(f"Features after preprocessing: {X_processed.shape[1]}")
`;
  }
}

function generateClassificationModelCode(params: MLModelParameters): string {
  if (params.autoMode) {
    return `
# ==============================================================================
# MODEL TRAINING: COMPARISON MODE
# ==============================================================================
print("\\n" + "-" * 70)
print("MODEL COMPARISON")
print("-" * 70)

print("\\nComparing multiple classification models...")

models_to_compare = {
    'Logistic Regression': LogisticRegression(max_iter=1000, random_state=${params.randomState}),
    'Random Forest': RandomForestClassifier(n_estimators=100, random_state=${params.randomState}),
    'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, random_state=${params.randomState}),
    'SVM': SVC(kernel='rbf', probability=True, random_state=${params.randomState}),
    'MLP Neural Network': MLPClassifier(hidden_layer_sizes=(100, 50), max_iter=500, random_state=${params.randomState}),
    'KNN': KNeighborsClassifier(n_neighbors=5),
    'Naive Bayes': GaussianNB()
}

if XGBOOST_AVAILABLE:
    models_to_compare['XGBoost'] = XGBClassifier(
        n_estimators=100, random_state=${params.randomState}, 
        use_label_encoder=False, eval_metric='logloss', verbosity=0
    )

comparison_results = []

for name, clf in models_to_compare.items():
    print(f"  Training {name}...")
    clf.fit(X_train_processed, y_train)
    y_pred = clf.predict(X_test_processed)
    
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
    recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
    f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
    
    # Cross-validation score
    cv_scores = cross_val_score(clf, X_train_processed, y_train, cv=${params.cvFolds}, scoring='f1_weighted')
    
    comparison_results.append({
        'Model': name,
        'Accuracy': accuracy,
        'Precision': precision,
        'Recall': recall,
        'F1 Score': f1,
        'CV F1 (mean)': cv_scores.mean(),
        'CV F1 (std)': cv_scores.std()
    })

comparison_df = pd.DataFrame(comparison_results).sort_values('F1 Score', ascending=False)
print("\\n=== MODEL COMPARISON RESULTS ===")
print(comparison_df.to_string(index=False))

# Select best model
best_model_name = comparison_df.iloc[0]['Model']
model = models_to_compare[best_model_name]
print(f"\\n*** Best Model: {best_model_name} (F1 Score: {comparison_df.iloc[0]['F1 Score']:.4f}) ***")

${params.hyperparameterTuning === 'grid' || params.hyperparameterTuning === 'random' ? `
# ==============================================================================
# HYPERPARAMETER TUNING ON BEST MODEL
# ==============================================================================
print("\\n" + "-" * 70)
print("HYPERPARAMETER TUNING ON BEST MODEL")
print("-" * 70)

# Define param grids for each model type
param_grids = {
    'Logistic Regression': {
        'C': [0.001, 0.01, 0.1, 1, 10, 100],
        'penalty': ['l1', 'l2'],
        'solver': ['liblinear', 'saga']
    },
    'Random Forest': {
        'n_estimators': [50, 100, 200, 300],
        'max_depth': [None, 10, 20, 30],
        'min_samples_split': [2, 5, 10],
        'min_samples_leaf': [1, 2, 4]
    },
    'Gradient Boosting': {
        'n_estimators': [50, 100, 200],
        'max_depth': [3, 5, 7],
        'learning_rate': [0.01, 0.05, 0.1, 0.2],
        'min_samples_split': [2, 5, 10]
    },
    'SVM': {
        'C': [0.1, 1, 10, 100],
        'kernel': ['rbf', 'poly', 'linear'],
        'gamma': ['scale', 'auto', 0.01, 0.1]
    },
    'MLP Neural Network': {
        'hidden_layer_sizes': [(50,), (100,), (100, 50), (100, 50, 25)],
        'alpha': [0.0001, 0.001, 0.01],
        'learning_rate': ['constant', 'adaptive']
    },
    'KNN': {
        'n_neighbors': [3, 5, 7, 9, 11],
        'weights': ['uniform', 'distance'],
        'metric': ['euclidean', 'manhattan']
    },
    'Naive Bayes': {
        'var_smoothing': [1e-10, 1e-9, 1e-8, 1e-7, 1e-6]
    },
    'XGBoost': {
        'n_estimators': [50, 100, 200],
        'max_depth': [3, 5, 7, 10],
        'learning_rate': [0.01, 0.05, 0.1, 0.2],
        'subsample': [0.6, 0.8, 1.0],
        'colsample_bytree': [0.6, 0.8, 1.0]
    }
}

if best_model_name in param_grids:
    print(f"\\nTuning hyperparameters for {best_model_name}...")
    param_grid = param_grids[best_model_name]
    
    # Re-initialize the model for tuning
    best_model_class = type(model)
    base_model = best_model_class()
    
    # Use GridSearchCV or RandomizedSearchCV based on user preference
    ${params.hyperparameterTuning === 'grid' ? `search = GridSearchCV(
        base_model, param_grid, cv=${params.cvFolds},
        scoring='f1_weighted', n_jobs=-1, verbose=1
    )` : `search = RandomizedSearchCV(
        base_model, param_grid, n_iter=${params.tuningIterations}, cv=${params.cvFolds},
        scoring='f1_weighted', n_jobs=-1, verbose=1, random_state=${params.randomState}
    )`}
    
    search.fit(X_train_processed, y_train)
    model = search.best_estimator_
    
    print(f"\\nBest Parameters: {search.best_params_}")
    print(f"Best CV Score: {search.best_score_:.4f}")
    
    # Re-evaluate on test set
    y_pred_tuned = model.predict(X_test_processed)
    print(f"\\nTuned Model Test F1: {f1_score(y_test, y_pred_tuned, average='weighted'):.4f}")
else:
    print(f"\\nNo hyperparameter grid defined for {best_model_name}, using default params")
` : ''}
`;
  } else {
    const modelCode = getClassificationModelCode(params.modelType, params);
    return `
# ==============================================================================
# MODEL TRAINING
# ==============================================================================
print("\\n" + "-" * 70)
print("MODEL TRAINING")
print("-" * 70)

${modelCode}

# Cross-validation
cv_scores = cross_val_score(model, X_train_processed, y_train, cv=${params.cvFolds}, scoring='f1_weighted')
print(f"\\nCross-Validation F1 Scores: {cv_scores.round(4)}")
print(f"Mean CV F1: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
`;
  }
}

function getClassificationModelCode(modelType: string, params: MLModelParameters): string {
  const classWeightParam = params.handleImbalance ? ", class_weight='balanced'" : "";
  
  const modelDefinitions: Record<string, string> = {
    'random_forest': `
# Initialize Random Forest Classifier
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=None,
    min_samples_split=2,
    min_samples_leaf=1,
    random_state=${params.randomState}${classWeightParam}
)

${params.hyperparameterTuning !== 'none' ? `
# Hyperparameter tuning
param_grid = {
    'n_estimators': [50, 100, 200],
    'max_depth': [None, 10, 20, 30],
    'min_samples_split': [2, 5, 10],
    'min_samples_leaf': [1, 2, 4]
}

print("Performing hyperparameter tuning...")
search = RandomizedSearchCV(
    model, param_grid, n_iter=${params.tuningIterations}, cv=${params.cvFolds},
    scoring='f1_weighted', n_jobs=-1, verbose=1, random_state=${params.randomState}
)
search.fit(X_train_processed, y_train)
model = search.best_estimator_
print(f"\\nBest Parameters: {search.best_params_}")
print(f"Best CV Score: {search.best_score_:.4f}")
` : `
# Train model
model.fit(X_train_processed, y_train)
print("Model training complete.")
`}`,
    'xgboost': `
# Initialize XGBoost Classifier
if XGBOOST_AVAILABLE:
    model = XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=${params.randomState},
        use_label_encoder=False,
        eval_metric='logloss',
        verbosity=0
    )
else:
    print("XGBoost not available. Using Gradient Boosting instead.")
    model = GradientBoostingClassifier(n_estimators=100, random_state=${params.randomState})

${params.hyperparameterTuning !== 'none' ? `
# Hyperparameter tuning
param_grid = {
    'n_estimators': [50, 100, 200],
    'max_depth': [3, 5, 7, 10],
    'learning_rate': [0.01, 0.05, 0.1, 0.2],
    'subsample': [0.6, 0.8, 1.0]
}

print("Performing hyperparameter tuning...")
search = RandomizedSearchCV(
    model, param_grid, n_iter=${params.tuningIterations}, cv=${params.cvFolds},
    scoring='f1_weighted', n_jobs=-1, verbose=1, random_state=${params.randomState}
)
search.fit(X_train_processed, y_train)
model = search.best_estimator_
print(f"\\nBest Parameters: {search.best_params_}")
print(f"Best CV Score: {search.best_score_:.4f}")
` : `
# Train model
model.fit(X_train_processed, y_train)
print("Model training complete.")
`}`,
    'svm': `
# Initialize Support Vector Machine
model = SVC(
    kernel='rbf',
    C=1.0,
    gamma='scale',
    probability=True,
    random_state=${params.randomState}${classWeightParam}
)

${params.hyperparameterTuning !== 'none' ? `
# Hyperparameter tuning
param_grid = {
    'C': [0.1, 1, 10, 100],
    'kernel': ['rbf', 'poly'],
    'gamma': ['scale', 'auto', 0.01, 0.1]
}

print("Performing hyperparameter tuning...")
search = RandomizedSearchCV(
    model, param_grid, n_iter=${params.tuningIterations}, cv=${params.cvFolds},
    scoring='f1_weighted', n_jobs=-1, verbose=1, random_state=${params.randomState}
)
search.fit(X_train_processed, y_train)
model = search.best_estimator_
print(f"\\nBest Parameters: {search.best_params_}")
print(f"Best CV Score: {search.best_score_:.4f}")
` : `
# Train model
model.fit(X_train_processed, y_train)
print("Model training complete.")
`}`,
    'mlp': `
# Initialize MLP Neural Network
model = MLPClassifier(
    hidden_layer_sizes=(100, 50),
    activation='relu',
    solver='adam',
    alpha=0.0001,
    max_iter=500,
    random_state=${params.randomState}
)

${params.hyperparameterTuning !== 'none' ? `
# Hyperparameter tuning
param_grid = {
    'hidden_layer_sizes': [(50,), (100,), (100, 50), (100, 100)],
    'activation': ['relu', 'tanh'],
    'alpha': [0.0001, 0.001, 0.01],
    'learning_rate': ['constant', 'adaptive']
}

print("Performing hyperparameter tuning...")
search = RandomizedSearchCV(
    model, param_grid, n_iter=${params.tuningIterations}, cv=${params.cvFolds},
    scoring='f1_weighted', n_jobs=-1, verbose=1, random_state=${params.randomState}
)
search.fit(X_train_processed, y_train)
model = search.best_estimator_
print(f"\\nBest Parameters: {search.best_params_}")
print(f"Best CV Score: {search.best_score_:.4f}")
` : `
# Train model
model.fit(X_train_processed, y_train)
print("Model training complete.")
`}`,
    'knn': `
# Initialize K-Nearest Neighbors
model = KNeighborsClassifier(
    n_neighbors=5,
    weights='uniform',
    metric='euclidean'
)

${params.hyperparameterTuning !== 'none' ? `
# Hyperparameter tuning
param_grid = {
    'n_neighbors': [3, 5, 7, 11, 15],
    'weights': ['uniform', 'distance'],
    'metric': ['euclidean', 'manhattan']
}

print("Performing hyperparameter tuning...")
search = GridSearchCV(
    model, param_grid, cv=${params.cvFolds},
    scoring='f1_weighted', n_jobs=-1, verbose=1
)
search.fit(X_train_processed, y_train)
model = search.best_estimator_
print(f"\\nBest Parameters: {search.best_params_}")
print(f"Best CV Score: {search.best_score_:.4f}")
` : `
# Train model
model.fit(X_train_processed, y_train)
print("Model training complete.")
`}`,
    'naive_bayes': `
# Initialize Naive Bayes
model = GaussianNB()

# Train model (Naive Bayes doesn't have many hyperparameters)
model.fit(X_train_processed, y_train)
print("Model training complete.")
`,
    'gradient_boosting': `
# Initialize Gradient Boosting Classifier
model = GradientBoostingClassifier(
    n_estimators=100,
    max_depth=3,
    learning_rate=0.1,
    random_state=${params.randomState}
)

${params.hyperparameterTuning !== 'none' ? `
# Hyperparameter tuning
param_grid = {
    'n_estimators': [50, 100, 200],
    'max_depth': [3, 5, 7],
    'learning_rate': [0.01, 0.05, 0.1, 0.2],
    'subsample': [0.6, 0.8, 1.0]
}

print("Performing hyperparameter tuning...")
search = RandomizedSearchCV(
    model, param_grid, n_iter=${params.tuningIterations}, cv=${params.cvFolds},
    scoring='f1_weighted', n_jobs=-1, verbose=1, random_state=${params.randomState}
)
search.fit(X_train_processed, y_train)
model = search.best_estimator_
print(f"\\nBest Parameters: {search.best_params_}")
print(f"Best CV Score: {search.best_score_:.4f}")
` : `
# Train model
model.fit(X_train_processed, y_train)
print("Model training complete.")
`}`,
    'logistic_regression': `
# Initialize Logistic Regression
model = LogisticRegression(
    max_iter=1000,
    solver='lbfgs',
    random_state=${params.randomState}${classWeightParam}
)

${params.hyperparameterTuning !== 'none' ? `
# Hyperparameter tuning
param_grid = {
    'C': [0.001, 0.01, 0.1, 1, 10, 100],
    'penalty': ['l2'],
    'solver': ['lbfgs', 'newton-cg', 'sag']
}

print("Performing hyperparameter tuning...")
${params.hyperparameterTuning === 'grid' ? `search = GridSearchCV(
    model, param_grid, cv=${params.cvFolds},
    scoring='f1_weighted', n_jobs=-1, verbose=1
)` : `search = RandomizedSearchCV(
    model, param_grid, n_iter=${params.tuningIterations}, cv=${params.cvFolds},
    scoring='f1_weighted', n_jobs=-1, verbose=1, random_state=${params.randomState}
)`}
search.fit(X_train_processed, y_train)
model = search.best_estimator_
print(f"\\nBest Parameters: {search.best_params_}")
print(f"Best CV Score: {search.best_score_:.4f}")
` : `
# Train model
model.fit(X_train_processed, y_train)
print("Model training complete.")
`}`
  };

  return modelDefinitions[modelType] || modelDefinitions['random_forest'];
}

function generateClassificationEvaluationCode(params: MLModelParameters): string {
  return `
# ==============================================================================
# MODEL EVALUATION
# ==============================================================================
print("\\n" + "-" * 70)
print("MODEL EVALUATION")
print("-" * 70)

# Predictions
y_pred_train = model.predict(X_train_processed)
y_pred_test = model.predict(X_test_processed)

# Probability predictions (if available)
if hasattr(model, 'predict_proba'):
    y_proba_test = model.predict_proba(X_test_processed)
else:
    y_proba_test = None

# Performance metrics
print("\\n=== CLASSIFICATION PERFORMANCE ===")

print("\\nTraining Set:")
print(f"  Accuracy:  {accuracy_score(y_train, y_pred_train):.4f}")
print(f"  Precision: {precision_score(y_train, y_pred_train, average='weighted', zero_division=0):.4f}")
print(f"  Recall:    {recall_score(y_train, y_pred_train, average='weighted', zero_division=0):.4f}")
print(f"  F1 Score:  {f1_score(y_train, y_pred_train, average='weighted', zero_division=0):.4f}")

print("\\nTest Set:")
print(f"  Accuracy:  {accuracy_score(y_test, y_pred_test):.4f}")
print(f"  Precision: {precision_score(y_test, y_pred_test, average='weighted', zero_division=0):.4f}")
print(f"  Recall:    {recall_score(y_test, y_pred_test, average='weighted', zero_division=0):.4f}")
print(f"  F1 Score:  {f1_score(y_test, y_pred_test, average='weighted', zero_division=0):.4f}")

# ROC-AUC
if y_proba_test is not None:
    n_classes = len(np.unique(y_test))
    if n_classes == 2:
        roc_auc = roc_auc_score(y_test, y_proba_test[:, 1])
    else:
        roc_auc = roc_auc_score(y_test, y_proba_test, multi_class='ovr', average='weighted')
    print(f"  ROC-AUC:   {roc_auc:.4f}")

# Detailed classification report
print("\\n=== DETAILED CLASSIFICATION REPORT ===")
print(classification_report(y_test, y_pred_test, target_names=class_names_encoded if 'class_names_encoded' in dir() else None, zero_division=0))

# Confusion Matrix
print("\\n=== CONFUSION MATRIX ===")
cm = confusion_matrix(y_test, y_pred_test)
print(pd.DataFrame(cm, 
    index=[f'Actual: {c}' for c in (class_names_encoded if 'class_names_encoded' in dir() else range(cm.shape[0]))],
    columns=[f'Pred: {c}' for c in (class_names_encoded if 'class_names_encoded' in dir() else range(cm.shape[1]))]))

# Overfitting check
train_f1 = f1_score(y_train, y_pred_train, average='weighted', zero_division=0)
test_f1 = f1_score(y_test, y_pred_test, average='weighted', zero_division=0)
if train_f1 - test_f1 > 0.1:
    print("\\n[WARNING] Possible overfitting detected (Train F1 significantly higher than Test F1)")
    print("   Consider: reducing model complexity, adding regularization, or getting more data")
else:
    print("\\n[OK] No significant overfitting detected")

# Feature Importance
print("\\n=== FEATURE IMPORTANCE ===")
if hasattr(model, 'feature_importances_'):
    importances = model.feature_importances_
    importance_type = "Gini/MDI Importance"
elif hasattr(model, 'coef_'):
    importances = np.abs(model.coef_).mean(axis=0) if len(model.coef_.shape) > 1 else np.abs(model.coef_)
    importance_type = "Coefficient Magnitude"
else:
    from sklearn.inspection import permutation_importance
    print("Computing permutation importance...")
    perm_importance = permutation_importance(model, X_test_processed, y_test, n_repeats=10, random_state=${params.randomState})
    importances = perm_importance.importances_mean
    importance_type = "Permutation Importance"

importance_df = pd.DataFrame({
    'Feature': feature_names_processed[:len(importances)],
    'Importance': importances
}).sort_values('Importance', ascending=False)

print(f"\\nTop 10 Most Important Features ({importance_type}):")
print(importance_df.head(10).to_string(index=False))
`;
}

function generateClassificationVisualizationCode(params: MLModelParameters): string {
  return `
# ==============================================================================
# VISUALIZATIONS
# ==============================================================================
print("\\n" + "-" * 70)
print("GENERATING VISUALIZATIONS")
print("-" * 70)

fig = plt.figure(figsize=(16, 12))

# Plot 1: Confusion Matrix Heatmap
ax1 = fig.add_subplot(2, 2, 1)
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
            xticklabels=class_names_encoded if 'class_names_encoded' in dir() else range(cm.shape[1]),
            yticklabels=class_names_encoded if 'class_names_encoded' in dir() else range(cm.shape[0]),
            ax=ax1, cbar_kws={'label': 'Count'})
ax1.set_xlabel('Predicted Label', fontsize=11)
ax1.set_ylabel('True Label', fontsize=11)
ax1.set_title('Confusion Matrix', fontsize=12)

# Plot 2: Feature Importance (Top 15)
ax2 = fig.add_subplot(2, 2, 2)
top_features = importance_df.head(15)
colors = plt.cm.Blues(np.linspace(0.4, 0.8, len(top_features)))
bars = ax2.barh(range(len(top_features)), top_features['Importance'].values, color=colors)
ax2.set_yticks(range(len(top_features)))
ax2.set_yticklabels(top_features['Feature'].values)
ax2.invert_yaxis()
ax2.set_xlabel('Importance', fontsize=11)
ax2.set_title(f'Top 15 Feature Importance', fontsize=12)

# Plot 3: ROC Curve or Class Distribution
ax3 = fig.add_subplot(2, 2, 3)
if y_proba_test is not None and len(np.unique(y_test)) == 2:
    fpr, tpr, _ = roc_curve(y_test, y_proba_test[:, 1])
    ax3.plot(fpr, tpr, 'b-', linewidth=2, label=f'ROC (AUC = {roc_auc:.4f})')
    ax3.plot([0, 1], [0, 1], 'r--', linewidth=1, label='Random Classifier')
    ax3.fill_between(fpr, tpr, alpha=0.2)
    ax3.set_xlabel('False Positive Rate', fontsize=11)
    ax3.set_ylabel('True Positive Rate', fontsize=11)
    ax3.set_title('ROC Curve', fontsize=12)
    ax3.legend(loc='lower right')
else:
    class_labels = class_names_encoded if 'class_names_encoded' in dir() else [f'Class {i}' for i in range(len(np.unique(y_test)))]
    x_pos = np.arange(len(class_labels))
    width = 0.35
    actual_counts = pd.Series(y_test).value_counts().sort_index().values
    pred_counts = pd.Series(y_pred_test).value_counts().sort_index().reindex(range(len(class_labels)), fill_value=0).values
    ax3.bar(x_pos - width/2, actual_counts, width, label='Actual', color='steelblue')
    ax3.bar(x_pos + width/2, pred_counts, width, label='Predicted', color='coral')
    ax3.set_xticks(x_pos)
    ax3.set_xticklabels(class_labels)
    ax3.set_xlabel('Class', fontsize=11)
    ax3.set_ylabel('Count', fontsize=11)
    ax3.set_title('Actual vs Predicted Distribution', fontsize=12)
    ax3.legend()

# Plot 4: Metrics by Class
ax4 = fig.add_subplot(2, 2, 4)
report_dict = classification_report(y_test, y_pred_test, output_dict=True, zero_division=0)
classes_in_report = [k for k in report_dict.keys() if k not in ['accuracy', 'macro avg', 'weighted avg']]
metrics_data = {c: report_dict[c] for c in classes_in_report}
metrics_df = pd.DataFrame(metrics_data).T[['precision', 'recall', 'f1-score']]
x_pos = np.arange(len(metrics_df))
width = 0.25
ax4.bar(x_pos - width, metrics_df['precision'], width, label='Precision', color='#2ecc71')
ax4.bar(x_pos, metrics_df['recall'], width, label='Recall', color='#3498db')
ax4.bar(x_pos + width, metrics_df['f1-score'], width, label='F1-Score', color='#9b59b6')
ax4.set_xticks(x_pos)
ax4.set_xticklabels(metrics_df.index, rotation=45 if len(metrics_df) > 4 else 0)
ax4.set_xlabel('Class', fontsize=11)
ax4.set_ylabel('Score', fontsize=11)
ax4.set_title('Per-Class Performance Metrics', fontsize=12)
ax4.legend(loc='lower right')
ax4.set_ylim([0, 1.1])

plt.tight_layout()
plt.savefig('classification_analysis.png', dpi=150, bbox_inches='tight')
plt.show()

print("\\nVisualization saved as 'classification_analysis.png'")
`;
}

function generateClusteringModelCode(params: MLModelParameters): string {
  const nClusters = params.nClusters === 'auto' ? 4 : (params.nClusters || 4);
  
  return `
# ==============================================================================
# CLUSTERING MODEL TRAINING
# ==============================================================================
print("\\n" + "-" * 70)
print("CLUSTERING ANALYSIS")
print("-" * 70)

# Determine optimal number of clusters
print("\\nDetermining optimal number of clusters...")

k_range = range(2, 11)
silhouette_scores = []
inertia_scores = []

for k in k_range:
    kmeans_temp = KMeans(n_clusters=k, random_state=${params.randomState}, n_init=10)
    labels_temp = kmeans_temp.fit_predict(X_processed)
    silhouette_scores.append(silhouette_score(X_processed, labels_temp))
    inertia_scores.append(kmeans_temp.inertia_)

optimal_k = k_range[np.argmax(silhouette_scores)]
print(f"Optimal number of clusters (by silhouette): {optimal_k}")

# Train final clustering model
n_clusters_final = ${nClusters} if ${nClusters} != 'auto' else optimal_k
print(f"\\nUsing {n_clusters_final} clusters")

${params.modelType === 'kmeans' || params.autoMode ? `
# K-Means Clustering
model = KMeans(n_clusters=n_clusters_final, random_state=${params.randomState}, n_init=10)
cluster_labels = model.fit_predict(X_processed)
print(f"K-Means clustering complete.")
` : params.modelType === 'dbscan' ? `
# DBSCAN Clustering
from sklearn.neighbors import NearestNeighbors
# Estimate eps using k-distance graph
k = 5
nbrs = NearestNeighbors(n_neighbors=k).fit(X_processed)
distances, _ = nbrs.kneighbors(X_processed)
distances = np.sort(distances[:, k-1])
eps_estimate = np.percentile(distances, 90)

model = DBSCAN(eps=eps_estimate, min_samples=5)
cluster_labels = model.fit_predict(X_processed)
n_clusters_found = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
n_noise = list(cluster_labels).count(-1)
print(f"DBSCAN found {n_clusters_found} clusters and {n_noise} noise points")
` : params.modelType === 'hierarchical' ? `
# Hierarchical (Agglomerative) Clustering
model = AgglomerativeClustering(n_clusters=n_clusters_final, linkage='ward')
cluster_labels = model.fit_predict(X_processed)
print(f"Hierarchical clustering complete.")
` : params.modelType === 'gmm' ? `
# Gaussian Mixture Model
model = GaussianMixture(n_components=n_clusters_final, random_state=${params.randomState})
cluster_labels = model.fit_predict(X_processed)
print(f"GMM clustering complete.")
` : `
# Mean Shift Clustering
model = MeanShift()
cluster_labels = model.fit_predict(X_processed)
n_clusters_found = len(np.unique(cluster_labels))
print(f"Mean Shift found {n_clusters_found} clusters")
`}

# Add cluster labels to DataFrame
df['cluster'] = cluster_labels
`;
}

function generateClusteringEvaluationCode(params: MLModelParameters): string {
  return `
# ==============================================================================
# CLUSTERING EVALUATION
# ==============================================================================
print("\\n" + "-" * 70)
print("CLUSTERING EVALUATION")
print("-" * 70)

# Filter out noise points for metrics (DBSCAN)
valid_mask = cluster_labels != -1
X_valid = X_processed[valid_mask]
labels_valid = cluster_labels[valid_mask]

if len(np.unique(labels_valid)) > 1:
    silhouette = silhouette_score(X_valid, labels_valid)
    calinski = calinski_harabasz_score(X_valid, labels_valid)
    davies = davies_bouldin_score(X_valid, labels_valid)
    
    print("\\n=== CLUSTERING METRICS ===")
    print(f"Silhouette Score:       {silhouette:.4f}  (higher is better, range: -1 to 1)")
    print(f"Calinski-Harabasz:      {calinski:.2f}  (higher is better)")
    print(f"Davies-Bouldin Index:   {davies:.4f}  (lower is better)")
else:
    print("\\nWarning: Only one cluster found. Cannot compute clustering metrics.")

# Cluster distribution
print("\\n=== CLUSTER DISTRIBUTION ===")
cluster_counts = pd.Series(cluster_labels).value_counts().sort_index()
for cluster_id, count in cluster_counts.items():
    pct = count / len(cluster_labels) * 100
    label = "Noise" if cluster_id == -1 else f"Cluster {cluster_id}"
    print(f"  {label}: {count} samples ({pct:.1f}%)")

# Cluster statistics
print("\\n=== CLUSTER STATISTICS (Mean values) ===")
cluster_stats = df.groupby('cluster')[feature_columns_final].mean().round(3)
print(cluster_stats)
`;
}

function generateClusteringVisualizationCode(params: MLModelParameters): string {
  return `
# ==============================================================================
# VISUALIZATIONS
# ==============================================================================
print("\\n" + "-" * 70)
print("GENERATING VISUALIZATIONS")
print("-" * 70)

fig = plt.figure(figsize=(16, 12))

# Reduce to 2D for visualization if needed
if X_processed.shape[1] > 2:
    from sklearn.decomposition import PCA
    pca_vis = PCA(n_components=2, random_state=${params.randomState})
    X_2d = pca_vis.fit_transform(X_processed)
    print(f"Reduced to 2D using PCA (explained variance: {sum(pca_vis.explained_variance_ratio_)*100:.1f}%)")
else:
    X_2d = X_processed

# Plot 1: Cluster Scatter Plot
ax1 = fig.add_subplot(2, 2, 1)
scatter = ax1.scatter(X_2d[:, 0], X_2d[:, 1], c=cluster_labels, cmap='tab10', 
                      alpha=0.7, edgecolors='k', linewidths=0.5, s=50)
ax1.set_xlabel('Component 1', fontsize=11)
ax1.set_ylabel('Component 2', fontsize=11)
ax1.set_title('Cluster Assignments (2D Projection)', fontsize=12)
plt.colorbar(scatter, ax=ax1, label='Cluster')

# Plot 2: Elbow Curve (K-Means inertia)
ax2 = fig.add_subplot(2, 2, 2)
ax2.plot(list(k_range), inertia_scores, 'bo-', linewidth=2, markersize=8)
ax2.set_xlabel('Number of Clusters (k)', fontsize=11)
ax2.set_ylabel('Inertia (Within-cluster sum of squares)', fontsize=11)
ax2.set_title('Elbow Method for Optimal k', fontsize=12)
ax2.grid(True, alpha=0.3)

# Plot 3: Silhouette Scores
ax3 = fig.add_subplot(2, 2, 3)
ax3.bar(list(k_range), silhouette_scores, color='steelblue', edgecolor='k')
ax3.axhline(y=max(silhouette_scores), color='r', linestyle='--', label=f'Max: {max(silhouette_scores):.3f}')
ax3.set_xlabel('Number of Clusters (k)', fontsize=11)
ax3.set_ylabel('Silhouette Score', fontsize=11)
ax3.set_title('Silhouette Score by Number of Clusters', fontsize=12)
ax3.legend()
ax3.set_xticks(list(k_range))

# Plot 4: Cluster Size Distribution
ax4 = fig.add_subplot(2, 2, 4)
cluster_counts_plot = pd.Series(cluster_labels).value_counts().sort_index()
colors = plt.cm.tab10(np.linspace(0, 1, len(cluster_counts_plot)))
bars = ax4.bar(cluster_counts_plot.index.astype(str), cluster_counts_plot.values, color=colors, edgecolor='k')
ax4.set_xlabel('Cluster', fontsize=11)
ax4.set_ylabel('Number of Samples', fontsize=11)
ax4.set_title('Cluster Size Distribution', fontsize=12)
for bar, count in zip(bars, cluster_counts_plot.values):
    ax4.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 5, str(count), 
             ha='center', va='bottom', fontsize=10)

plt.tight_layout()
plt.savefig('clustering_analysis.png', dpi=150, bbox_inches='tight')
plt.show()

print("\\nVisualization saved as 'clustering_analysis.png'")
`;
}

function generateDimReductionModelCode(params: MLModelParameters): string {
  const nComponents = params.nComponents === 'auto' ? 2 : (params.nComponents || 2);
  
  return `
# ==============================================================================
# DIMENSIONALITY REDUCTION
# ==============================================================================
print("\\n" + "-" * 70)
print("DIMENSIONALITY REDUCTION")
print("-" * 70)

n_components = ${nComponents}
print(f"Target dimensionality: {n_components} components")

${params.modelType === 'pca' || params.autoMode ? `
# Principal Component Analysis (PCA)
pca = PCA(n_components=n_components, random_state=${params.randomState})
X_reduced = pca.fit_transform(X_processed)

print("\\n=== PCA RESULTS ===")
print(f"Original dimensions: {X_processed.shape[1]}")
print(f"Reduced dimensions: {X_reduced.shape[1]}")
print(f"\\nExplained Variance Ratio:")
for i, var in enumerate(pca.explained_variance_ratio_):
    print(f"  PC{i+1}: {var*100:.2f}%")
print(f"\\nTotal variance explained: {sum(pca.explained_variance_ratio_)*100:.2f}%")

# Component loadings
loadings = pd.DataFrame(
    pca.components_.T,
    columns=[f'PC{i+1}' for i in range(n_components)],
    index=feature_columns_final[:X_processed.shape[1]]
)
print("\\nTop Feature Loadings (PC1):")
print(loadings['PC1'].abs().sort_values(ascending=False).head(10))

reducer = pca
` : params.modelType === 'tsne' ? `
# t-SNE (t-distributed Stochastic Neighbor Embedding)
tsne = TSNE(n_components=min(n_components, 3), perplexity=30, n_iter=1000, random_state=${params.randomState})
X_reduced = tsne.fit_transform(X_processed)

print("\\n=== t-SNE RESULTS ===")
print(f"Original dimensions: {X_processed.shape[1]}")
print(f"Reduced dimensions: {X_reduced.shape[1]}")
print("Note: t-SNE optimizes for local neighborhood preservation")

reducer = tsne
` : params.modelType === 'umap' ? `
# UMAP (Uniform Manifold Approximation and Projection)
if UMAP_AVAILABLE:
    reducer = umap.UMAP(n_components=n_components, n_neighbors=15, min_dist=0.1, random_state=${params.randomState})
    X_reduced = reducer.fit_transform(X_processed)
    print("\\n=== UMAP RESULTS ===")
    print(f"Original dimensions: {X_processed.shape[1]}")
    print(f"Reduced dimensions: {X_reduced.shape[1]}")
else:
    print("UMAP not available. Using t-SNE instead.")
    from sklearn.manifold import TSNE
    reducer = TSNE(n_components=min(n_components, 3), random_state=${params.randomState})
    X_reduced = reducer.fit_transform(X_processed)
` : `
# Linear Discriminant Analysis (LDA) - requires labels
if y is not None:
    n_classes = len(np.unique(y))
    n_components_lda = min(n_components, n_classes - 1, X_processed.shape[1])
    lda = LinearDiscriminantAnalysis(n_components=n_components_lda)
    X_reduced = lda.fit_transform(X_processed, y)
    print("\\n=== LDA RESULTS ===")
    print(f"Original dimensions: {X_processed.shape[1]}")
    print(f"Reduced dimensions: {X_reduced.shape[1]}")
    print(f"Explained variance ratio: {lda.explained_variance_ratio_}")
    reducer = lda
else:
    print("LDA requires class labels. Using PCA instead.")
    from sklearn.decomposition import PCA
    reducer = PCA(n_components=n_components, random_state=${params.randomState})
    X_reduced = reducer.fit_transform(X_processed)
`}

# Create reduced DataFrame
reduced_columns = [f'Component_{i+1}' for i in range(X_reduced.shape[1])]
df_reduced = pd.DataFrame(X_reduced, columns=reduced_columns)
if y is not None:
    df_reduced['target'] = y.values if hasattr(y, 'values') else y
`;
}

function generateDimReductionEvaluationCode(params: MLModelParameters): string {
  return `
# ==============================================================================
# DIMENSIONALITY REDUCTION EVALUATION
# ==============================================================================
print("\\n" + "-" * 70)
print("EVALUATION")
print("-" * 70)

# Reconstruction error (for PCA)
if 'pca' in dir() and hasattr(pca, 'inverse_transform'):
    X_reconstructed = pca.inverse_transform(X_reduced)
    reconstruction_error = np.mean((X_processed - X_reconstructed) ** 2)
    print(f"\\nReconstruction MSE: {reconstruction_error:.6f}")

# Variance retained
if 'pca' in dir():
    print(f"\\nVariance Analysis:")
    cumulative_var = np.cumsum(pca.explained_variance_ratio_)
    for i, (var, cum_var) in enumerate(zip(pca.explained_variance_ratio_, cumulative_var)):
        print(f"  PC{i+1}: {var*100:.2f}% (cumulative: {cum_var*100:.2f}%)")
    
    # Components needed for 95% variance
    n_95 = np.argmax(cumulative_var >= 0.95) + 1
    print(f"\\nComponents needed for 95% variance: {n_95}")

# Trustworthiness metric
from sklearn.manifold import trustworthiness
trust = trustworthiness(X_processed, X_reduced, n_neighbors=5)
print(f"\\nTrustworthiness (k=5): {trust:.4f}")
print("  (1.0 = perfect preservation of local neighborhoods)")

# Summary statistics of reduced data
print("\\n=== REDUCED DATA STATISTICS ===")
print(df_reduced.describe().round(3))
`;
}

function generateDimReductionVisualizationCode(params: MLModelParameters): string {
  return `
# ==============================================================================
# VISUALIZATIONS
# ==============================================================================
print("\\n" + "-" * 70)
print("GENERATING VISUALIZATIONS")
print("-" * 70)

fig = plt.figure(figsize=(16, 12))

# Plot 1: 2D Projection
ax1 = fig.add_subplot(2, 2, 1)
if y is not None:
    scatter = ax1.scatter(X_reduced[:, 0], X_reduced[:, 1], c=y, cmap='tab10',
                         alpha=0.6, edgecolors='k', linewidths=0.5, s=50)
    plt.colorbar(scatter, ax=ax1, label='Class')
else:
    ax1.scatter(X_reduced[:, 0], X_reduced[:, 1], alpha=0.6, edgecolors='k',
               linewidths=0.5, s=50, color='steelblue')
ax1.set_xlabel('Component 1', fontsize=11)
ax1.set_ylabel('Component 2', fontsize=11)
ax1.set_title('2D Projection of Data', fontsize=12)

# Plot 2: Scree Plot (for PCA)
ax2 = fig.add_subplot(2, 2, 2)
if 'pca' in dir():
    explained_var = pca.explained_variance_ratio_
    cumulative_var = np.cumsum(explained_var)
    x_vals = range(1, len(explained_var) + 1)
    
    ax2.bar(x_vals, explained_var * 100, alpha=0.7, label='Individual', color='steelblue', edgecolor='k')
    ax2.plot(x_vals, cumulative_var * 100, 'ro-', linewidth=2, markersize=8, label='Cumulative')
    ax2.axhline(y=95, color='green', linestyle='--', linewidth=1.5, label='95% threshold')
    ax2.set_xlabel('Principal Component', fontsize=11)
    ax2.set_ylabel('Variance Explained (%)', fontsize=11)
    ax2.set_title('Scree Plot', fontsize=12)
    ax2.legend(loc='center right')
    ax2.set_xticks(x_vals)
else:
    # For t-SNE/UMAP, show density
    sns.kdeplot(x=X_reduced[:, 0], y=X_reduced[:, 1], ax=ax2, cmap='Blues', fill=True, levels=20)
    ax2.scatter(X_reduced[:, 0], X_reduced[:, 1], alpha=0.3, s=10, color='red')
    ax2.set_xlabel('Component 1', fontsize=11)
    ax2.set_ylabel('Component 2', fontsize=11)
    ax2.set_title('Density Visualization', fontsize=12)

# Plot 3: Component Loadings Heatmap (for PCA)
ax3 = fig.add_subplot(2, 2, 3)
if 'loadings' in dir():
    n_show = min(15, len(loadings))
    top_features_idx = np.argsort(np.abs(loadings.iloc[:, :min(3, loadings.shape[1])]).max(axis=1))[-n_show:]
    loadings_subset = loadings.iloc[top_features_idx]
    sns.heatmap(loadings_subset, annot=True, fmt='.2f', cmap='RdBu_r', center=0, ax=ax3,
                cbar_kws={'label': 'Loading'})
    ax3.set_xlabel('Principal Component', fontsize=11)
    ax3.set_ylabel('Feature', fontsize=11)
    ax3.set_title('Component Loadings (Top Features)', fontsize=12)
else:
    # Distribution of reduced dimensions
    for i in range(min(X_reduced.shape[1], 3)):
        ax3.hist(X_reduced[:, i], bins=50, alpha=0.5, label=f'Component {i+1}')
    ax3.set_xlabel('Value', fontsize=11)
    ax3.set_ylabel('Frequency', fontsize=11)
    ax3.set_title('Distribution of Reduced Dimensions', fontsize=12)
    ax3.legend()

# Plot 4: 3D Projection (if 3+ components)
ax4 = fig.add_subplot(2, 2, 4, projection='3d' if X_reduced.shape[1] >= 3 else None)
if X_reduced.shape[1] >= 3:
    if y is not None:
        scatter = ax4.scatter(X_reduced[:, 0], X_reduced[:, 1], X_reduced[:, 2], 
                             c=y, cmap='tab10', alpha=0.6, s=30)
    else:
        ax4.scatter(X_reduced[:, 0], X_reduced[:, 1], X_reduced[:, 2], 
                   alpha=0.6, s=30, color='steelblue')
    ax4.set_xlabel('Component 1')
    ax4.set_ylabel('Component 2')
    ax4.set_zlabel('Component 3')
    ax4.set_title('3D Projection', fontsize=12)
else:
    # Pairwise correlations in reduced space
    if X_reduced.shape[1] >= 2:
        corr = np.corrcoef(X_reduced.T)
        sns.heatmap(corr, annot=True, fmt='.3f', cmap='coolwarm', center=0, ax=ax4,
                   xticklabels=[f'C{i+1}' for i in range(X_reduced.shape[1])],
                   yticklabels=[f'C{i+1}' for i in range(X_reduced.shape[1])])
        ax4.set_title('Component Correlations', fontsize=12)

plt.tight_layout()
plt.savefig('dimensionality_reduction.png', dpi=150, bbox_inches='tight')
plt.show()

print("\\nVisualization saved as 'dimensionality_reduction.png'")
`;
}

function generatePredictionFunction(params: MLModelParameters): string {
  if (params.problemType === 'classification') {
    return `
# ==============================================================================
# PREDICTION FUNCTION
# ==============================================================================

def predict_new(feature_dict):
    """
    Predict class for new sample(s).
    
    Parameters:
    -----------
    feature_dict : dict
        Dictionary with feature names as keys and values.
        Example: {'feature_1': 0.5, 'feature_2': -1.2, ...}
    
    Returns:
    --------
    prediction : int or str
        Predicted class label
    probabilities : dict
        Probability for each class (if available)
    """
    new_data = pd.DataFrame([feature_dict])
    new_data = new_data[feature_columns_final]
    new_processed = preprocessor.transform(new_data)
    
    prediction = model.predict(new_processed)[0]
    
    if hasattr(model, 'predict_proba'):
        proba = model.predict_proba(new_processed)[0]
        probabilities = dict(zip(class_names_encoded if 'class_names_encoded' in dir() else range(len(proba)), proba))
    else:
        probabilities = None
    
    return prediction, probabilities

# Example usage:
# prediction, proba = predict_new({'feature_1': 0.5, 'feature_2': -1.2, ...})
# print(f"Predicted class: {prediction}")
# print(f"Probabilities: {proba}")
`;
  } else if (params.problemType === 'clustering') {
    return `
# ==============================================================================
# CLUSTER ASSIGNMENT FUNCTION
# ==============================================================================

def assign_cluster(feature_dict):
    """
    Assign cluster to new sample(s).
    
    Parameters:
    -----------
    feature_dict : dict
        Dictionary with feature names as keys
    
    Returns:
    --------
    cluster : int
        Assigned cluster label
    """
    new_data = pd.DataFrame([feature_dict])
    new_data = new_data[feature_columns_final]
    new_processed = preprocessor.transform(new_data)
    
    if hasattr(model, 'predict'):
        cluster = model.predict(new_processed)[0]
    else:
        # For DBSCAN, find nearest cluster
        from sklearn.neighbors import NearestNeighbors
        nbrs = NearestNeighbors(n_neighbors=1).fit(X_processed[cluster_labels != -1])
        _, indices = nbrs.kneighbors(new_processed)
        cluster = cluster_labels[cluster_labels != -1][indices[0][0]]
    
    return cluster

# Example usage:
# cluster = assign_cluster({'feature_1': 0.5, 'feature_2': -1.2, ...})
# print(f"Assigned to cluster: {cluster}")
`;
  } else {
    return `
# ==============================================================================
# TRANSFORM FUNCTION
# ==============================================================================

def transform_new(feature_dict):
    """
    Transform new sample(s) to reduced space.
    
    Parameters:
    -----------
    feature_dict : dict
        Dictionary with feature names as keys
    
    Returns:
    --------
    reduced : array
        Transformed coordinates in reduced space
    """
    new_data = pd.DataFrame([feature_dict])
    new_data = new_data[feature_columns_final]
    new_processed = preprocessor.transform(new_data)
    
    if hasattr(reducer, 'transform'):
        reduced = reducer.transform(new_processed)
    else:
        print("Warning: This reducer doesn't support transform() on new data.")
        print("Consider using PCA or UMAP for preprocessing pipelines.")
        reduced = None
    
    return reduced

# Example usage:
# reduced_coords = transform_new({'feature_1': 0.5, 'feature_2': -1.2, ...})
# print(f"Reduced coordinates: {reduced_coords}")
`;
  }
}

function generateModelPersistenceCode(params: MLModelParameters): string {
  return `
# ==============================================================================
# SAVE MODEL AND ARTIFACTS
# ==============================================================================
print("\\n" + "-" * 70)
print("SAVING MODEL")
print("-" * 70)

import joblib
from datetime import datetime

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

# Save main model
model_filename = f'ml_model_{timestamp}.pkl'
joblib.dump(model, model_filename)
print(f"Model saved: {model_filename}")

# Save preprocessor
preprocessor_filename = f'preprocessor_{timestamp}.pkl'
joblib.dump(preprocessor, preprocessor_filename)
print(f"Preprocessor saved: {preprocessor_filename}")

${params.problemType === 'dimensionality_reduction' ? `
# Save reducer
reducer_filename = f'reducer_{timestamp}.pkl'
joblib.dump(reducer, reducer_filename)
print(f"Reducer saved: {reducer_filename}")
` : ''}

# Save configuration
import json
config = {
    'feature_columns': feature_columns_final if 'feature_columns_final' in dir() else [],
    'model_type': '${params.modelType}',
    'problem_type': '${params.problemType}',
    'timestamp': timestamp
}
${params.problemType === 'classification' ? `
config['class_names'] = list(class_names_encoded) if 'class_names_encoded' in dir() else []
` : ''}

config_filename = f'model_config_{timestamp}.json'
with open(config_filename, 'w') as f:
    json.dump(config, f, indent=2)
print(f"Config saved: {config_filename}")

print("\\n" + "=" * 70)
print("ANALYSIS COMPLETE")
print("=" * 70)

# --- LOADING INSTRUCTIONS ---
"""
To load and use this model later:

import joblib
import json
import pandas as pd

# Load artifacts
model = joblib.load('${params.problemType === 'classification' ? 'ml_model_' : params.problemType === 'clustering' ? 'ml_model_' : 'reducer_'}[timestamp].pkl')
preprocessor = joblib.load('preprocessor_[timestamp].pkl')
with open('model_config_[timestamp].json', 'r') as f:
    config = json.load(f)

# Prepare new data
new_sample = {
    'feature_1': value1,
    'feature_2': value2,
    # ... add all features
}
new_df = pd.DataFrame([new_sample])[config['feature_columns']]

# Preprocess and predict
new_processed = preprocessor.transform(new_df)
${params.problemType === 'classification' ? 'prediction = model.predict(new_processed)' : params.problemType === 'clustering' ? 'cluster = model.predict(new_processed)' : 'reduced = model.transform(new_processed)'}
"""
`;
}
