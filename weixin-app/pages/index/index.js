import * as echarts from '../../ec-canvas/echarts';

const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
    loading: true,
    showDetails: false,
    selectedData: null,
    chartData: null,
    ec: { lazyLoad: true }
  },

  onLoad: function() {
    this.loadHydrologicalData();
  },

  loadHydrologicalData: function() {
    this.setData({ loading: true });
    const that = this;

    const now = new Date();
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
          that.setData({ chartData: parsedData, loading: false }, () => {
            that.initChart();
          });
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
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      timeList.push(item.tm || '');
      indexValues.rz.push(item.rz ? parseFloat(item.rz) : null);
      indexValues.inq.push(item.inq ? parseFloat(item.inq) : 0);
      indexValues.otq.push(item.otq ? parseFloat(item.otq) : 0);
    }
    return { timeList, indexValues };
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
      backgroundColor: '#f8f9fa',
      legend: { top: 10, data: ['库水位', '入库流量', '出库流量'] },
      grid: { left: '4%', right: '6%', bottom: '20%', top: '22%', containLabel: true },
      tooltip: { 
        show: true, trigger: 'axis', showContent: false,
        axisPointer: { type: 'line', lineStyle: { color: '#2196F3', type: 'dashed' } }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: chartData.timeList,
        axisLabel: {
          rotate: 45, fontSize: 9,
          interval: 5, 
          formatter: v => v ? v.substring(5, 16) : ''
        }
      },
      yAxis: [
        { type: 'value', name: '水位(m)', min: Math.floor(minW - 0.5), max: Math.ceil(maxW + 0.5) },
        { type: 'value', name: '流量(m³/s)', position: 'right', splitLine: { show: false } }
      ],
      series: [
        {
          name: '库水位', type: 'line', smooth: true, 
          data: chartData.indexValues.rz,
          itemStyle: { color: '#2196F3' }, symbolSize: 10, showSymbol: true
        },
        {
          name: '入库流量', type: 'line', smooth: true, yAxisIndex: 1,
          data: chartData.indexValues.inq,
          itemStyle: { color: '#4CAF50' }, symbolSize: 10
        },
        {
          name: '出库流量', type: 'line', smooth: true, yAxisIndex: 1,
          data: chartData.indexValues.otq,
          itemStyle: { color: '#FF9800' }, symbolSize: 10
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
    this.setData({
      selectedData: {
        time: data.timeList[index],
        rz: data.indexValues.rz[index]?.toFixed(2) || '--',
        inq: data.indexValues.inq[index]?.toFixed(2) || '--',
        otq: data.indexValues.otq[index]?.toFixed(2) || '--',
        floodLimit: (app.globalData.FLOOD_LIMIT_LEVEL || 152.5).toFixed(2)
      },
      showDetails: true
    });
    wx.vibrateShort({ type: 'light' });
  },

  closeModal: function() {
    this.setData({ showDetails: false });
  },

  preventTouchMove: function() {}
});
