#Install in terminal
##pip3 install pandas matplotlib statsmodels

#Import packages
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import statsmodels.api as sm
from statsmodels.tsa.holtwinters import ExponentialSmoothing

# Load the dataset
csv_file_path = "/Users/calvinfrederick/Desktop/university/data.csv"
df = pd.read_csv(csv_file_path)

# Convert Stock Date to datetime format
df["Stock Date"] = pd.to_datetime(df["Stock Date"])

def predict_stock_moving_average(subcategory_name):
    # Filter for selected subcategory
    subcategory_df = df[df["Subcategory"] == subcategory_name]

    # Aggregate units sold by stock date
    sales_data = subcategory_df.groupby("Stock Date")["Units Sold"].sum().reset_index()

    # Ensure enough data exists
    if len(sales_data) < 3:
        return f"Error: Not enough data to make a forecast for '{subcategory_name}'."

    # Calculate moving average for the last 3 available dates
    avg_sales = sales_data["Units Sold"].tail(3).mean()

    # Predict next 30 days based on this average
    future_stock_needed = int(avg_sales * 30)

    return f"Suggested number of stock to buy for {subcategory_name}: {future_stock_needed} for the next month"

# Example Usage:
print(predict_stock_moving_average("Cakes"))







