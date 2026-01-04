//app.js
App({
  onLaunch: function() {
    // 初始化应用
    console.log('应用启动');
  },
  globalData: {
    // 核心配置
    BASE_URL: "http://www.hnswkcj.com/wxhn/data/rthyinfo/rsvr/proc/one.json",
    STATION_CODE: "613K0912",
    STATION_NAME: "中方县铜湾水库",
    
    // 汛限水位配置
    FLOOD_LIMIT_LEVEL: 152.5,  // 汛限水位：152.5米
    FLOOD_LINE_COLOR: "#ff4444",  // 汛限水位线颜色：红色
    FLOOD_LABEL_COLOR: "#cc0000",  // 汛限水位标签颜色
    
    // 水文指标配置
    INDEX_CONFIG: {
      "rz": {"name": "库水位", "unit_math": "m", "color": "#1f77b4", "axis": "left", "show": true},
      "w": {"name": "蓄水量", "unit_math": "10^6 m^3", "color": "#ff7f0e", "axis": "right", "show": false},  // 不展示
      "inq": {"name": "入库流量", "unit_math": "m^3/s", "color": "#2ca02c", "axis": "right", "show": true},
      "otq": {"name": "出库流量", "unit_math": "m^3/s", "color": "#d62728", "axis": "right", "show": true}
    },
    // 需要过滤0值的指标（仅入库/出库流量）
    ZERO_FILTER_INDICES: ["inq", "otq"],
    
    // 图表数据
    chartData: {}
  }
})