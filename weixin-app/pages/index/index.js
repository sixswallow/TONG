import * as echarts from '../../ec-canvas/echarts';

const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
    loading: true,
    selectedData: null,
    chartData: null,
    headerTime: '',
    listTime: '',
    metrics: {
      latestOtq: '--',
      maxOtq: '--',
      minOtq: '--'
    },
    ec: { lazyLoad: true }
  },

  onLoad: function() {
    this.loadHydrologicalData();
  },

  loadHydrologicalData: function() {
    this.setData({ loading: true });
    const that = this;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}年${(now.getMonth() + 1).toString().padStart(2, '0')}月`;
    
    const dateEnd = util.formatDate(now, 'YYYY-MM-DD+HH');
    const dateBegin = util.formatDate(new Date(now.getTime() - 48 * 3600000), 'YYYY-MM-DD+HH');

    wx.request({
      url: app.globalData.PROXY_URL,
      data: {
        code: app.globalData.STATION_CODE,
        dateBegin: dateBegin,
        dateEnd: dateEnd
      },
      success: function(res) {
        if (res.data && res.data.list) {
          const parsedData = that.parseData(res.data.list);
          that.setData({ 
            headerTime: currentMonth,
            listTime: currentMonth,
            metrics: parsedData.metrics,
            chartData: parsedData,
            loading: false 
          }, () => {
            that.initChart();
          });
        } else {
          that.setData({ loading: false });
          wx.showToast({ title: '暂无数据', icon: 'none' });
        }
      },
      fail: function() {
        that.setData({ loading: false });
        wx.showToast({ title: '获取失败', icon: 'none' });
      }
    });
  },

  parseData: function(list) {
    const timeList = [];
    const indexValues = { rz: [], inq: [], otq: [] };
    
    let maxOtq = -Infinity;
    let minOtq = Infinity;
    let latestOtq = 0;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const time = item.tm || '';
      const otq = item.otq ? parseFloat(item.otq) : 0;
      
      timeList.push(time);
      indexValues.rz.push(item.rz ? parseFloat(item.rz) : null);
      indexValues.inq.push(item.inq ? parseFloat(item.inq) : 0);
      indexValues.otq.push(otq);

      if (i === list.length - 1) latestOtq = otq;
      if (otq > maxOtq) maxOtq = otq;
      if (otq < minOtq) minOtq = otq;
    }

    return { 
      timeList, 
      indexValues,
      metrics: {
        latestOtq: latestOtq.toFixed(2),
        maxOtq: maxOtq === -Infinity ? '--' : maxOtq.toFixed(2),
        minOtq: minOtq === Infinity ? '--' : minOtq.toFixed(2)
      }
    };
  },

  initChart: function() {
    this.selectComponent('#mychart-dom-bar').init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, {
        width: width, height: height, devicePixelRatio: dpr
      });
      canvas.setChart(chart);

      const chartData = this.data.chartData;
      const floodLimitLevel = app.globalData.FLOOD_LIMIT_LEVEL || 152.5;

      const option = this.getOption(chartData, floodLimitLevel);
      chart.setOption(option);

      chart.on('click', (params) => {
        if (params && params.dataIndex !== undefined) {
          this.showDataDetails(params.dataIndex);
        }
      });
      this.chart = chart;
      return chart;
    });
  },

  getOption: function(chartData, floodLimitLevel) {
    const rzList = chartData.indexValues.rz.filter(v => v !== null);
    let minW = Math.min.apply(null, rzList.concat([floodLimitLevel]));
    let maxW = Math.max.apply(null, rzList.concat([floodLimitLevel]));

    return {
      backgroundColor: '#ffffff',
      grid: { left: '10%', right: '10%', bottom: '18%', top: '15%', containLabel: true },
      tooltip: { 
        trigger: 'axis', 
        axisPointer: { type: 'line', lineStyle: { color: '#2196F3', type: 'solid', width: 1 } }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: chartData.timeList,
        axisLine: { show: true, lineStyle: { color: '#eee' } },
        axisTick: { show: false },
        axisLabel: {
          rotate: 45,
          fontSize: 10,
          interval: Math.floor(chartData.timeList.length / 6),
          formatter: v => v ? v.substring(5, 16) : ''
        }
      },
      yAxis: [
        { 
          type: 'value', 
          name: '水位(m)', 
          min: Math.floor(minW - 0.5), 
          max: Math.ceil(maxW + 0.5),
          axisLine: { show: true, lineStyle: { color: '#2196F3' } },
          axisTick: { show: false },
          splitLine: { show: false },
          nameTextStyle: { fontSize: 10, color: '#999' }
        },
        { 
          type: 'value', 
          name: '流量(m³/s)', 
          position: 'right', 
          splitLine: { show: true, lineStyle: { type: 'dashed', color: '#f0f0f0' } },
          axisLine: { show: true, lineStyle: { color: '#4CAF50' } },
          axisTick: { show: false },
          nameTextStyle: { fontSize: 10, color: '#999' }
        }
      ],
      series: [
        {
          name: '库水位', type: 'line', smooth: true, 
          data: chartData.indexValues.rz,
          itemStyle: { color: '#2196F3' }, 
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: false,
          lineStyle: { width: 2 }
        },
        {
          name: '入库流量', type: 'line', smooth: true, yAxisIndex: 1,
          data: chartData.indexValues.inq,
          itemStyle: { color: '#4CAF50' },
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: false,
          lineStyle: { width: 2 }
        },
        {
          name: '出库流量', type: 'line', smooth: true, yAxisIndex: 1,
          data: chartData.indexValues.otq,
          itemStyle: { color: '#FF9800' },
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: false,
          lineStyle: { width: 2 }
        },
        {
          name: '汛限水位', type: 'line',
          data: Array(chartData.timeList.length).fill(floodLimitLevel),
          lineStyle: { color: '#F44336', type: 'dashed' }, symbol: 'none'
        }
      ]
    };
  },

  showDataDetails: function(index) {
    const data = this.data.chartData;
    const timeStr = data.timeList[index];
    
    const formatTime = (t) => {
        if(!t) return '';
        return t.length >= 16 ? t.substring(5, 16) : t;
    };

    const selected = {
      time: timeStr,
      formattedTime: timeStr || '',
      rz: data.indexValues.rz[index]?.toFixed(2) || '--',
      inq: data.indexValues.inq[index]?.toFixed(2) || '--',
      otq: data.indexValues.otq[index]?.toFixed(2) || '--'
    };

    this.setData({
      selectedData: selected,
      headerTime: formatTime(timeStr)
    });
    
    wx.vibrateShort({ type: 'light' });
  },

  onShareAppMessage: function () {
    return {
      title: '实时水文监测数据',
      path: '/pages/index/index'
    }
  },
  onShareTimeline: function () {
    return {
      title: '实时水文监测数据'
    }
  }
});