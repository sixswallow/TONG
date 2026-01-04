import * as echarts from '../../ec-canvas/echarts';

const app = getApp();
const util = require('../../utils/util.js');

function initChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: dpr
  });
  canvas.setChart(chart);

  const chartData = app.globalData.chartData;
  const option = {
    backgroundColor: '#f8f9fa',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e0e0e0',
      borderWidth: 1,
      textStyle: {
        color: '#333',
        fontSize: 13
      },
      formatter: function (params) {
        let result = '<div style="font-weight: bold; margin-bottom: 5px;">' + params[0].axisValue + '</div>';
        params.forEach(param => {
          if (param.seriesName === '汛限水位') {
            result += '<div style="margin: 3px 0;">' + param.marker + param.seriesName + ': <span style="color: #ff4444; font-weight: bold;">' + param.value + ' m</span></div>';
          } else {
            result += '<div style="margin: 3px 0;">' + param.marker + param.seriesName + ': <span style="color: ' + param.color + '; font-weight: bold;">' + param.data.value + ' ' + param.data.unit + '</span></div>';
          }
        });
        return result;
      }
    },
    legend: {
      show: true,
      type: 'scroll',
      top: 0,
      left: 'center',
      itemWidth: 25,
      itemHeight: 14,
      itemGap: 15,
      textStyle: {
        fontSize: 12,
        color: '#666'
      },
      data: function() {
        const legendData = [];
        const config = app.globalData.INDEX_CONFIG;
        Object.keys(config).forEach(key => {
          if (config[key].show) {
            legendData.push(config[key].name);
          }
        });
        legendData.push('汛限水位');
        return legendData;
      }()
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '15%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: chartData.timeList,
      axisLabel: {
        rotate: 45,
        fontSize: 11,
        color: '#666',
        margin: 15,
        formatter: function(value) {
          if (!value) return '';
          try {
            const date = new Date(value);
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${month}-${day} ${hours}:${minutes}`;
          } catch (e) {
            return value;
          }
        }
      },
      axisLine: {
        lineStyle: {
          color: '#ddd'
        }
      },
      axisTick: {
        show: false
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '库水位 (m)',
        position: 'left',
        nameTextStyle: {
          fontSize: 13,
          color: '#2196F3',
          padding: [0, 0, 0, 20]
        },
        axisLabel: {
          formatter: '{value}',
          color: '#666',
          fontSize: 11
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: '#ddd'
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed',
            color: '#e8e8e8'
          }
        }
      },
      {
        type: 'value',
        name: '流量 (m³/s)',
        position: 'right',
        nameTextStyle: {
          fontSize: 13,
          color: '#FF5722',
          padding: [0, 20, 0, 0]
        },
        axisLabel: {
          formatter: '{value}',
          color: '#666',
          fontSize: 11
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: '#ddd'
          }
        },
        splitLine: {
          show: false
        }
      }
    ],
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomLock: false
      },
      {
        start: 0,
        end: 100,
        height: 25,
        bottom: 10,
        borderColor: 'transparent',
        backgroundColor: '#f0f0f0',
        fillerColor: 'rgba(33, 150, 243, 0.2)',
        handleSize: '80%',
        handleStyle: {
          color: '#2196F3'
        },
        textStyle: {
          color: '#666'
        }
      }
    ],
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    series: getSeriesData(chartData, app.globalData.FLOOD_LIMIT_LEVEL)
  };

  chart.setOption(option);
  return chart;
}

function getSeriesData(chartData, floodLimitLevel) {
  const series = [];
  const config = app.globalData.INDEX_CONFIG;

  Object.keys(config).forEach(key => {
    if (config[key].show) {
      const data = chartData.indexValues[key].map((value, index) => {
        return {
          value: isNaN(value) ? null : value,
          unit: config[key].unit_math
        };
      });

      series.push({
        name: config[key].name,
        type: 'line',
        smooth: true,
        smoothMonotone: 'x',
        data: data,
        yAxisIndex: config[key].axis === 'left' ? 0 : 1,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        hoverAnimation: true,
        lineStyle: {
          color: config[key].color,
          width: 2.5,
          shadowColor: 'rgba(0, 0, 0, 0.1)',
          shadowBlur: 10,
          shadowOffsetY: 5
        },
        itemStyle: {
          color: config[key].color,
          borderColor: '#fff',
          borderWidth: 2
        },
        areaStyle: {
          opacity: 0.15,
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: config[key].color },
            { offset: 1, color: 'rgba(255, 255, 255, 0)' }
          ])
        },
        connectNulls: true,
        emphasis: {
          focus: 'series',
          itemStyle: {
            borderWidth: 3,
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)'
          }
        }
      });
    }
  });

  if (chartData.timeList && chartData.timeList.length > 0) {
    series.push({
      name: '汛限水位',
      type: 'line',
      data: Array(chartData.timeList.length).fill(floodLimitLevel),
      lineStyle: {
        color: '#ff4444',
        type: 'dashed',
        width: 2.5,
        shadowColor: 'rgba(255, 68, 68, 0.3)',
        shadowBlur: 8
      },
      yAxisIndex: 0,
      symbol: 'none',
      markLine: {
        silent: true,
        symbol: 'none',
        data: [
          {
            yAxis: floodLimitLevel,
            label: {
              show: true,
              position: 'end',
              formatter: '汛限水位 {c}m',
              color: '#ff4444',
              fontSize: 12,
              fontWeight: 'bold',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: [4, 8],
              borderRadius: 3,
              borderColor: '#ff4444',
              borderWidth: 1
            },
            lineStyle: {
              color: '#ff4444',
              type: 'dashed',
              width: 2,
              opacity: 0.8
            }
          }
        ]
      },
      tooltip: {
        formatter: function(params) {
          return params.marker + params.seriesName + ': ' + params.value + ' m';
        }
      },
      emphasis: {
        lineStyle: {
          width: 3,
          shadowBlur: 10,
          shadowColor: 'rgba(255, 68, 68, 0.5)'
        }
      }
    });
  }

  return series;
}

Page({
  data: {
    chartData: {},
    loading: true,
    error: false,
    errorMsg: '',
    floodLimitLevel: app.globalData.FLOOD_LIMIT_LEVEL,
    indexConfig: app.globalData.INDEX_CONFIG,
    ec: {
      onInit: initChart
    }
  },

  onLoad: function () {
    this.loadHydrologicalData();
  },

  onPullDownRefresh: function () {
    this.loadHydrologicalData();
  },

  loadHydrologicalData: function () {
    const that = this;
    that.setData({
      loading: true,
      error: false
    });

    const now = new Date();
    const utcTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const beijingTime = new Date(utcTime.getTime() + (3600000 * 8));
    const beijingTime48HoursAgo = new Date(beijingTime.getTime() - (48 * 60 * 60 * 1000));

    const dateEnd = util.formatDate(beijingTime, 'YYYY-MM-DD+HH');
    const dateBegin = util.formatDate(beijingTime48HoursAgo, 'YYYY-MM-DD+HH');

    console.log('当前时间（北京时间）:', beijingTime);
    console.log('48小时前（北京时间）:', beijingTime48HoursAgo);
    console.log('请求日期范围:', dateBegin, '至', dateEnd);

    const requestUrl = `${app.globalData.BASE_URL}?code=${app.globalData.STATION_CODE}&dateBegin=${dateBegin}&dateEnd=${dateEnd}`;
    console.log('完整请求URL:', requestUrl);

    wx.request({
      url: requestUrl,
      method: 'GET',
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.list) {
          const parsedData = that.parseData(res.data);
          app.globalData.chartData = parsedData;
          that.setData({
            chartData: parsedData,
            loading: false
          });
          that.saveDataToLocal(parsedData, dateBegin, dateEnd);
        } else {
          that.loadDataFromLocal();
        }
      },
      fail: function (err) {
        console.warn('网络请求失败，尝试使用本地数据: ', err);
        that.loadDataFromLocal();
      },
      complete: function () {
        wx.stopPullDownRefresh();
      }
    });
  },

  saveDataToLocal: function (data, dateBegin, dateEnd) {
    try {
      wx.setStorageSync('hydrologicalData', {
        data: data,
        dateBegin: dateBegin,
        dateEnd: dateEnd,
        timestamp: Date.now()
      });
      console.log('数据已保存到本地存储');
    } catch (error) {
      console.error('保存数据到本地失败: ', error);
    }
  },

  loadDataFromLocal: function () {
    try {
      const stored = wx.getStorageSync('hydrologicalData');
      if (stored && stored.data) {
        const isExpired = Date.now() - stored.timestamp > 6 * 60 * 60 * 1000;
        if (!isExpired) {
          app.globalData.chartData = stored.data;
          this.setData({
            chartData: stored.data,
            loading: false
          });
          console.log('使用本地存储的数据');
          return;
        } else {
          console.log('本地数据已过期');
        }
      }
    } catch (error) {
      console.error('加载本地数据失败: ', error);
    }
    this.handleError('无法获取数据，请检查网络连接后重试');
  },

  parseData: function (rawData) {
    const timeList = [];
    const indexValues = {};
    const ZERO_FILTER_INDICES = ['inq', 'otq'];

    Object.keys(app.globalData.INDEX_CONFIG).forEach(key => {
      indexValues[key] = [];
    });

    const dataList = rawData.list || [];

    if (!Array.isArray(dataList)) {
      throw new Error('数据格式异常: 预期列表类型');
    }

    dataList.forEach(item => {
      const timeStr = item.tm;
      if (!timeStr) {
        console.warn('跳过无效数据项: 缺失时间字段', item);
        return;
      }

      const tempVals = {};
      Object.keys(app.globalData.INDEX_CONFIG).forEach(key => {
        const val = item[key];
        let processedVal;

        if (val === null || val === undefined || val === '') {
          processedVal = NaN;
        } else {
          try {
            processedVal = parseFloat(val);
            if (ZERO_FILTER_INDICES.includes(key) && processedVal === 0) {
              processedVal = NaN;
              console.warn(`过滤0值数据: 字段=${key}, 时间=${timeStr}, 值=${processedVal}`);
            }
          } catch (error) {
            processedVal = NaN;
            console.warn(`数值解析失败: 字段=${key}, 值=${val}`, item);
          }
        }

        tempVals[key] = processedVal;
      });

      timeList.push(timeStr);
      Object.keys(app.globalData.INDEX_CONFIG).forEach(key => {
        indexValues[key].push(tempVals[key]);
      });
    });

    if (timeList.length === 0) {
      throw new Error('解析后无有效时间数据');
    }

    for (const key of Object.keys(indexValues)) {
      const hasValidData = indexValues[key].some(val => !isNaN(val));
      if (!hasValidData) {
        console.warn(`警告: ${app.globalData.INDEX_CONFIG[key].name}无有效数据, 跳过绘制/提取`);
        delete indexValues[key];
        delete app.globalData.INDEX_CONFIG[key];
      }
    }

    if (Object.keys(indexValues).length === 0) {
      throw new Error('所有指标均无有效数据');
    }

    console.log(`数据解析完成: 有效时间点=${timeList.length}个, 已提取指标=${Object.values(app.globalData.INDEX_CONFIG).map(item => item.name)}`);

    return {
      timeList: timeList,
      indexValues: indexValues
    };
  },

  handleError: function (msg) {
    this.setData({
      loading: false,
      error: true,
      errorMsg: msg
    });
  },

  onShareAppMessage: function () {
    return {
      title: '铜湾水库水文监测',
      path: '/pages/index/index'
    };
  }
});
