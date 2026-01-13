#!/usr/bin/env python3
"""
Karpenter Data Processing Script

This script processes raw Karpenter CPU allocation data files and generates
aggregated summary files for the HRP360 dashboard.

Input: Large CSV files (~50MB each) with node-level data
Output: Small aggregated CSV files (<1MB total) for dashboard use

Usage:
    python process_karpenter_data.py

Source folder: /Users/aravinthramesh/Documents/Karpenter
Output folder: /Users/aravinthramesh/Documents/git/hrp360/hyperforce-runtime-platform-360/assets/data/karpenter
"""

import os
import pandas as pd
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import json
import warnings
warnings.filterwarnings('ignore')

# Configuration
SOURCE_DIR = "/Users/aravinthramesh/Documents/Karpenter"
OUTPUT_DIR = "/Users/aravinthramesh/Documents/git/hrp360/hyperforce-runtime-platform-360/assets/data/karpenter"

# Month mapping from filename
MONTH_MAP = {
    'april': '2025-04',
    'may': '2025-05',
    'june': '2025-06',
    'july': '2025-07',
    'august': '2025-08',
    'sep': '2025-09',
    'oct': '2025-10'
}

def extract_month_from_filename(filename):
    """Extract month from filename like 'Core July CPU allocation rate.csv'"""
    filename_lower = filename.lower()
    for month_key, month_value in MONTH_MAP.items():
        if month_key in filename_lower:
            return month_value
    return None

def get_environment_from_cluster(cluster_name):
    """Determine environment from cluster name"""
    # Handle NaN/None/float values
    if pd.isna(cluster_name) or not isinstance(cluster_name, str):
        return 'other'
    
    cluster_lower = cluster_name.lower()
    
    if 'prod' in cluster_lower or 'esvc' in cluster_lower:
        return 'prod'
    elif 'staging' in cluster_lower or 'stage' in cluster_lower:
        return 'staging'
    elif 'test' in cluster_lower:
        return 'test'
    elif 'perf' in cluster_lower:
        return 'perf'
    elif 'dev' in cluster_lower:
        return 'dev'
    else:
        return 'other'

def get_efficiency_indicator(avg_cpu, environment):
    """
    Determine efficiency indicator based on CPU and environment
    
    prod/esvc: >80% efficient, 50-80% moderate, <50% inefficient
    other (test/perf/dev): >90% efficient, 70-90% moderate, <70% inefficient
    """
    if environment in ['prod', 'esvc']:
        if avg_cpu > 80:
            return 'Efficient'
        elif avg_cpu >= 50:
            return 'Moderately Efficient'
        else:
            return 'Inefficient'
    else:
        if avg_cpu > 90:
            return 'Efficient'
        elif avg_cpu >= 70:
            return 'Moderately Efficient'
        else:
            return 'Inefficient'

def load_csv_file(filepath, month):
    """Load a CSV file and add month column"""
    print(f"  Loading: {os.path.basename(filepath)}")
    try:
        df = pd.read_csv(filepath)
        df['month'] = month
        df['month_name'] = pd.to_datetime(month).strftime('%B')
        return df
    except Exception as e:
        print(f"  Error loading {filepath}: {e}")
        return None

def try_extract_numbers_file(filepath):
    """
    Try to extract data from .numbers file
    .numbers files are actually ZIP archives containing XML data
    """
    print(f"  Attempting to extract: {os.path.basename(filepath)}")
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            # List contents
            file_list = z.namelist()
            print(f"    Found {len(file_list)} files in archive")
            
            # Look for table data (usually in Index/Tables/*.iwa files)
            # This is complex - recommend manual CSV export
            print(f"    ⚠️ .numbers extraction is complex. Please export as CSV manually.")
            return None
    except Exception as e:
        print(f"    Error: {e}")
        return None

def load_all_data():
    """Load all data files from source directory"""
    print("\n📂 Loading data files from:", SOURCE_DIR)
    
    all_data = []
    
    for filename in os.listdir(SOURCE_DIR):
        filepath = os.path.join(SOURCE_DIR, filename)
        month = extract_month_from_filename(filename)
        
        if not month:
            print(f"  Skipping (no month detected): {filename}")
            continue
        
        if filename.endswith('.csv'):
            df = load_csv_file(filepath, month)
            if df is not None:
                all_data.append(df)
        elif filename.endswith('.numbers'):
            # Try to extract .numbers file
            df = try_extract_numbers_file(filepath)
            if df is not None:
                all_data.append(df)
            else:
                print(f"    → Please export '{filename}' as CSV from Apple Numbers")
    
    if all_data:
        combined_df = pd.concat(all_data, ignore_index=True)
        print(f"\n✅ Loaded {len(combined_df):,} total rows from {len(all_data)} files")
        return combined_df
    else:
        print("\n❌ No data loaded!")
        return None

def process_data(df):
    """Process and clean the data"""
    print("\n🔧 Processing data...")
    
    # Add environment column based on falcon_instance
    df['environment'] = df['falcon_instance'].apply(get_environment_from_cluster)
    
    # Clean avg_cpu column
    df['avg_cpu'] = pd.to_numeric(df['avg_cpu'], errors='coerce')
    
    # Add efficiency indicator
    df['efficiency_indicator'] = df.apply(
        lambda row: get_efficiency_indicator(row['avg_cpu'], row['environment']), 
        axis=1
    )
    
    print(f"  Environments found: {df['environment'].value_counts().to_dict()}")
    print(f"  Months found: {sorted(df['month'].unique())}")
    
    return df

def generate_summary_files(df):
    """Generate aggregated summary files for the dashboard"""
    print("\n📊 Generating summary files...")
    
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 1. Main Summary - Comprehensive aggregation with ALL filterable columns
    # This allows cross-filtering on any dimension
    print("  → main_summary.csv")
    main_summary = df.groupby(['month', 'month_name', 'falcon_instance', 'functional_domain', 'environment', 'k8s_cluster']).agg({
        'avg_cpu': 'mean',
        'device': 'nunique',
        'pod_count': 'mean'
    }).reset_index()
    main_summary.columns = ['month', 'month_name', 'falcon_instance', 'functional_domain', 'environment', 'cluster', 'avg_cpu', 'node_count', 'avg_pod_count']
    main_summary['avg_cpu'] = main_summary['avg_cpu'].round(2)
    main_summary['avg_pod_count'] = main_summary['avg_pod_count'].round(2)
    
    # Add efficiency indicator
    main_summary['efficiency_indicator'] = main_summary.apply(
        lambda row: get_efficiency_indicator(row['avg_cpu'], row['environment']), 
        axis=1
    )
    main_summary.to_csv(os.path.join(OUTPUT_DIR, 'main_summary.csv'), index=False)
    print(f"     Rows: {len(main_summary)}")
    
    # 2. Monthly Summary - Overall monthly averages (for quick metrics)
    print("  → monthly_summary.csv")
    monthly_summary = df.groupby(['month', 'month_name']).agg({
        'avg_cpu': 'mean',
        'pod_count': 'mean',
        'device': 'nunique',
        'k8s_cluster': 'nunique'
    }).reset_index()
    monthly_summary.columns = ['month', 'month_name', 'avg_cpu', 'avg_pod_count', 'node_count', 'cluster_count']
    monthly_summary = monthly_summary.round(2)
    monthly_summary.to_csv(os.path.join(OUTPUT_DIR, 'monthly_summary.csv'), index=False)
    
    # 3. Environment Summary - By environment and month
    print("  → environment_summary.csv")
    env_summary = df.groupby(['month', 'month_name', 'environment']).agg({
        'avg_cpu': 'mean',
        'device': 'nunique',
        'k8s_cluster': 'nunique'
    }).reset_index()
    env_summary.columns = ['month', 'month_name', 'environment', 'avg_cpu', 'node_count', 'cluster_count']
    env_summary = env_summary.round(2)
    env_summary.to_csv(os.path.join(OUTPUT_DIR, 'environment_summary.csv'), index=False)
    
    # 4. Cluster Summary - By cluster and month (for Developer View table)
    print("  → cluster_summary.csv")
    cluster_summary = df.groupby(['month', 'month_name', 'k8s_cluster', 'falcon_instance', 'functional_domain', 'environment']).agg({
        'avg_cpu': 'mean',
        'device': 'nunique',
        'pod_count': 'mean'
    }).reset_index()
    cluster_summary.columns = ['month', 'month_name', 'cluster', 'falcon_instance', 'functional_domain', 'environment', 'avg_cpu', 'node_count', 'avg_pod_count']
    cluster_summary['avg_cpu'] = cluster_summary['avg_cpu'].round(2)
    cluster_summary['avg_pod_count'] = cluster_summary['avg_pod_count'].round(2)
    
    # Add efficiency indicator
    cluster_summary['efficiency_indicator'] = cluster_summary.apply(
        lambda row: get_efficiency_indicator(row['avg_cpu'], row['environment']), 
        axis=1
    )
    cluster_summary.to_csv(os.path.join(OUTPUT_DIR, 'cluster_summary.csv'), index=False)
    
    # 5. Falcon Instance Summary - By FI and month (includes environment for filtering)
    print("  → fi_summary.csv")
    fi_summary = df.groupby(['month', 'month_name', 'falcon_instance', 'environment']).agg({
        'avg_cpu': 'mean',
        'device': 'nunique',
        'k8s_cluster': 'nunique'
    }).reset_index()
    fi_summary.columns = ['month', 'month_name', 'falcon_instance', 'environment', 'avg_cpu', 'node_count', 'cluster_count']
    fi_summary = fi_summary.round(2)
    fi_summary.to_csv(os.path.join(OUTPUT_DIR, 'fi_summary.csv'), index=False)
    
    # 6. Functional Domain Summary - By FD and month (includes environment for filtering)
    print("  → fd_summary.csv")
    fd_summary = df.groupby(['month', 'month_name', 'functional_domain', 'environment']).agg({
        'avg_cpu': 'mean',
        'device': 'nunique',
        'k8s_cluster': 'nunique'
    }).reset_index()
    fd_summary.columns = ['month', 'month_name', 'functional_domain', 'environment', 'avg_cpu', 'node_count', 'cluster_count']
    fd_summary = fd_summary.round(2)
    fd_summary.to_csv(os.path.join(OUTPUT_DIR, 'fd_summary.csv'), index=False)
    
    # 6. Filter Options - Unique values for each filter
    print("  → filter_options.json")
    filter_options = {
        'falcon_instances': sorted(df['falcon_instance'].dropna().unique().tolist()),
        'functional_domains': sorted(df['functional_domain'].dropna().unique().tolist()),
        'environments': sorted(df['environment'].dropna().unique().tolist()),
        'clusters': sorted(df['k8s_cluster'].dropna().unique().tolist()),
        'months': sorted(df['month'].dropna().unique().tolist())
    }
    with open(os.path.join(OUTPUT_DIR, 'filter_options.json'), 'w') as f:
        json.dump(filter_options, f, indent=2)
    
    # 7. Cluster Trend - For showing improvement/regression
    print("  → cluster_trend.csv")
    # Pivot to compare months
    cluster_pivot = cluster_summary.pivot_table(
        index=['cluster', 'environment'],
        columns='month',
        values='avg_cpu'
    ).reset_index()
    
    # Calculate trend (compare last month to previous)
    months_sorted = sorted(df['month'].unique())
    if len(months_sorted) >= 2:
        last_month = months_sorted[-1]
        prev_month = months_sorted[-2]
        
        if last_month in cluster_pivot.columns and prev_month in cluster_pivot.columns:
            cluster_pivot['trend'] = cluster_pivot[last_month] - cluster_pivot[prev_month]
            cluster_pivot['trend_direction'] = cluster_pivot['trend'].apply(
                lambda x: 'improved' if x > 0 else ('regressed' if x < 0 else 'stable')
            )
    
    cluster_pivot.to_csv(os.path.join(OUTPUT_DIR, 'cluster_trend.csv'), index=False)
    
    print(f"\n✅ All summary files saved to: {OUTPUT_DIR}")
    
    # Print file sizes
    print("\n📁 Output file sizes:")
    for filename in os.listdir(OUTPUT_DIR):
        filepath = os.path.join(OUTPUT_DIR, filename)
        size = os.path.getsize(filepath)
        print(f"  {filename}: {size/1024:.1f} KB")

def main():
    print("=" * 60)
    print("🚀 Karpenter Data Processing Script")
    print("=" * 60)
    
    # Load all data
    df = load_all_data()
    
    if df is None:
        print("\n❌ No data to process. Please check source files.")
        return
    
    # Process data
    df = process_data(df)
    
    # Generate summary files
    generate_summary_files(df)
    
    print("\n" + "=" * 60)
    print("✅ Processing complete!")
    print("=" * 60)
    
    # Check for missing months
    available_months = sorted(df['month'].unique())
    expected_months = ['2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10']
    missing = set(expected_months) - set(available_months)
    
    if missing:
        print(f"\n⚠️ Missing months: {missing}")
        print("   → Export .numbers files as CSV to include them")

if __name__ == "__main__":
    main()

