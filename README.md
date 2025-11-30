# TONG
万事铜小程序的准备材料第二版方案。计划做一款汛期能方便看水位信息的小程序，希望可以做起来。

A Python script for visualizing 48-hour hydrological monitoring data of Tongwan Reservoir in Zhongfang County (with proper math text rendering for unit symbols like m³).

## Core Features
1. **Precise Metric Definition**
   - `rz`: 库内水位 (Reservoir Water Level) - Unit: $m$ (米)
   - `w`: 蓄水量 (Storage Capacity) - Unit: $10^6 m^3$ (百万立方)
   - `inq`: 入库流量 (Inflow) - Unit: $m^3/s$ (立方米每秒)
   - `otq`: 出库流量 (Outflow) - Unit: $m^3/s$ (立方米每秒)

2. **Professional Visualization**
   - Dual-axis line chart (left: water level | right: storage/flow)
   - All unit symbols rendered with matplotlib math text (no garbled characters)
   - Custom title: "中方县铜湾水库水文综合监测数据（站点编号：XXX）"
   - High-resolution output (300 DPI) with Chinese/math symbol support

3. **Robust Data Handling**
   - Preserve `+` in API URL (avoid encoding to `%2B`)
   - Auto-generate unique filenames with timestamps
   - Handle missing/invalid data gracefully
   - Comprehensive error logging

## Prerequisites
- Python 3.7+
- Required packages:
  ```bash
  pip install requests matplotlib
