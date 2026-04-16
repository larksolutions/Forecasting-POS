# Sales Forecasting Summary

## Method: Holt's Double Exponential Smoothing

The system uses **Holt's method** (a.k.a. Double Exponential Smoothing) to predict future daily sales revenue. It tracks two components — **level** (the current baseline) and **trend** (the direction sales are heading).

---

## Core Formulas

### Level Equation (where the sales value "is" right now)

```
S_t = α · Y_t + (1 - α)(S_{t-1} + T_{t-1})
```

- **S_t** = smoothed level at time t
- **Y_t** = actual observed sales at time t
- **S_{t-1}** = previous level
- **T_{t-1}** = previous trend

### Trend Equation (how fast sales are rising/falling)

```
T_t = β · (S_t - S_{t-1}) + (1 - β) · T_{t-1}
```

- **T_t** = trend at time t
- **(S_t - S_{t-1})** = change in level (new observed trend)
- **T_{t-1}** = previous trend estimate

### Forecast Equation (predicting h days into the future)

```
F_{t+h} = S_t + h · T_t
```

- **F_{t+h}** = forecast for h days ahead
- **h** = number of days into the future

---

## Parameters

| Symbol       | Value    | Role                                                              |
| ------------ | -------- | ----------------------------------------------------------------- |
| α (alpha)    | **0.3**  | Level smoothing — how much weight recent sales get vs. previous estimates |
| β (beta)     | **0.15** | Trend smoothing — how quickly the trend adapts to changes         |

- **Higher α** = faster reaction to new sales data, but more noise
- **Lower β** = smoother, more stable trend estimates

---

## How It Works (Step by Step)

1. **Initialization**
   - Level (S₀) = first day's revenue
   - Trend (T₀) = average daily change over the first 7 days

2. **Smoothing Loop**
   - Walks through all historical daily sales (up to 84 days of data)
   - At each day, updates the level and trend using the formulas above

3. **Day-of-Week Seasonal Adjustment**
   - Computes a multiplier for each weekday (e.g., weekends may be 1.3× average, Mondays 0.8×)
   - Applied to each prediction:
     ```
     Prediction_h = max(0, (S_t + h · T_t) × DOW_multiplier)
     ```

4. **Output**
   - 14-day daily revenue forecast

---

## Confidence Level

Based on how much historical data is available:

| Data Available          | Confidence |
| ----------------------- | ---------- |
| ≥ 56 days (8 weeks)    | **High**   |
| ≥ 28 days (4 weeks)    | **Medium** |
| < 28 days              | **Low**    |

---

## Product-Level Demand Forecasting

For individual products, the system uses **linear extrapolation** based on sales velocity:

```
Predicted Demand = daily_velocity × days
```

```
Days Until Stockout = floor(current_stock / daily_velocity)
```

A **restock alert** triggers when days until stockout ≤ 14.

---

## Key Outputs

| Output                          | Description                                          |
| ------------------------------- | ---------------------------------------------------- |
| 7-day revenue forecast (₱)     | Total predicted revenue for the next 7 days          |
| 14-day revenue forecast (₱)    | Total predicted revenue for the next 14 days         |
| Daily trend                     | How much revenue changes per day (₱/day)             |
| Weekly trend %                  | Week-over-week growth rate                           |
| Per-product demand              | Predicted units needed for 7, 14, and 30 days        |
| Restock alerts                  | Products running low based on sell-through rate       |

---

## Example

Given:
- Final level (S_t) = ₱2,500
- Final trend (T_t) = ₱50/day
- Saturday DOW multiplier = 1.3

Forecast for Saturday (h = 3 days ahead):
```
F = (2,500 + 3 × 50) × 1.3
F = 2,650 × 1.3
F = ₱3,445
```

This means the system predicts approximately **₱3,445** in revenue for that Saturday.
