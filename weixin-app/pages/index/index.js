import * as echarts from '../../ec-canvas/echarts';

const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
    loading: true,
    selectedData: null,
    chartData: null,
    tableList: [],
    headerTime: '',
    listTime: '',
    metrics: {
      latestOtq: '--',
      maxOtq: '--',
      minOtq: '--'
    },
    ec: { lazyLoad: true }
  },

  chart: null,
  lastIndex: -1,

  onLoad: function() {
    this.loadHydrologicalData();
  },

  loadHydrologicalData: function() {
    this.setData({ loading: true });
    var that = this;

    var now = new Date();
    var currentMonth = now.getFullYear() + '年' + (now.getMonth() + 1).toString().padStart(2, '0') + '月';
    
    var dateEnd = util.formatDate(now, 'YYYY-MM-DD+HH');
    var dateBegin = util.formatDate(new Date(now.getTime() - 48 * 3600000), 'YYYY-MM-DD+HH');

    wx.request({
      url: app.globalData.PROXY_URL,
      data: {
        code: app.globalData.STATION_CODE,
        dateBegin: dateBegin,
        dateEnd: dateEnd
      },
      success: function(res) {
        if (res.data && res.data.list && res.data.list.length > 0) {
          var parsedData = that.parseData(res.data.list);
          var tableList = that.buildTableList(parsedData);

          that.setData({ 
            headerTime: currentMonth,
            listTime: currentMonth,
            metrics: parsedData.metrics,
            chartData: parsedData,
            tableList: tableList,
            loading: false 
          }, function() {
            setTimeout(function() {
              that.initChart();
            }, 300);
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
    var timeList = [];
    var indexValues = { rz: [], inq: [], otq: [] };
    
    var maxOtq = -Infinity;
    var minOtq = Infinity;
    var latestOtq = 0;

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var time = item.tm || '';
      var otq = item.otq ? parseFloat(item.otq) : 0;
      
      timeList.push(time);
      indexValues.rz.push(item.rz ? parseFloat(item.rz) : null);
      indexValues.inq.push(item.inq ? parseFloat(item.inq) : 0);
      indexValues.otq.push(otq);

      if (i === list.length - 1) latestOtq = otq;
      if (otq > maxOtq) maxOtq = otq;
      if (otq < minOtq) minOtq = otq;
    }

    return { 
      timeList: timeList, 
      indexValues: indexValues,
      metrics: {
        latestOtq: latestOtq.toFixed(2),
        maxOtq: maxOtq === -Infinity ? '--' : maxOtq.toFixed(2),
        minOtq: minOtq === Infinity ? '--' : minOtq.toFixed(2)
      }
    };
  },

  buildTableList: function(parsedData) {
    var tableList = [];
    var timeList = parsedData.timeList;
    var rz = parsedData.indexValues.rz;
    var inq = parsedData.indexValues.inq;
    var otq = parsedData.indexValues.otq;

    for (var i = timeList.length - 1; i >= 0; i--) {
      tableList.push({
        time: timeList[i] ? (timeList[i].length >= 16 ? timeList[i].substring(0, 16) : timeList[i]) : '--',
        rz: rz[i] !== null && rz[i] !== undefined ? rz[i].toFixed(2) : '--',
        inq: inq[i] !== null && inq[i] !== undefined ? inq[i].toFixed(2) : '--',
        otq: otq[i] !== null && otq[i] !== undefined ? otq[i].toFixed(2) : '--'
      });
    }

    return tableList;
  },

  initChart: function() {
    var that = this;
    var retryCount = 0;

    function tryInit() {
      var chartComponent = that.selectComponent('#mychart-dom-bar');
      if (!chartComponent) {
        retryCount++;
        if (retryCount < 10) {
          setTimeout(tryInit, 300);
        }
        return;
      }

      chartComponent.init(function(canvas, width, height, dpr) {
        var chart = echarts.init(canvas, null, {
          width: width,
          height: height,
          devicePixelRatio: dpr
        });

        var chartData = that.data.chartData;
        var floodLimitLevel = app.globalData.FLOOD_LIMIT_LEVEL || 152.5;

        var option = that.getOption(chartData, floodLimitLevel);
        chart.setOption(option);
        
        that.chart = chart;

        // 通过 zrender 监听触摸事件实现实时跟踪
        var zr = chart.getZr();

        zr.on('mousedown', function(params) {
          that.handleChartTouch(params);
        });

        zr.on('mousemove', function(params) {
          that.handleChartTouch(params);
        });

        // 兼容小程序的 touch 事件名
        zr.on('touchstart', function(params) {
          that.handleChartTouch(params);
        });

        zr.on('touchmove', function(params) {
          that.handleChartTouch(params);
        });

        return chart;
      });
    }

    tryInit();
  },

  handleChartTouch: function(params) {
    if (!this.chart || !this.data.chartData) return;

    var chart = this.chart;
    var chartData = this.data.chartData;
    var totalPoints = chartData.timeList.length;
    if (totalPoints === 0) return;

    var x = params.offsetX;
    var y = params.offsetY;

    if (x === undefined || y === undefined) {
      if (params.event) {
        x = params.event.offsetX || params.event.zrX;
        y = params.event.offsetY || params.event.zrY;
      }
    }

    if (x === undefined || y === undefined) return;

    var pointInPixel = [x, y];

    // 检查是否在图表grid区域内
    if (!chart.containPixel('grid', pointInPixel)) return;

    // 将像素坐标转换为数据索引
    var dataPoint = chart.convertFromPixel({ seriesIndex: 0 }, pointInPixel);
    if (!dataPoint) return;

    var index = Math.round(dataPoint[0]);
    if (index < 0) index = 0;
    if (index >= totalPoints) index = totalPoints - 1;

    // 避免重复更新
    if (index === this.lastIndex) return;
    this.lastIndex = index;

    // 显示竖线
    chart.dispatchAction({
      type: 'showTip',
      seriesIndex: 0,
      dataIndex: index
    });

    // 更新下方选中数据
    this.updateSelectedData(index);
  },

  updateSelectedData: function(index) {
    var data = this.data.chartData;
    if (!data || !data.timeList || index < 0 || index >= data.timeList.length) return;
    
    var timeStr = data.timeList[index];
    
    var formatTime = function(t) {
      if (!t) return '';
      return t.length >= 16 ? t.substring(5, 16) : t;
    };

    var rzVal = data.indexValues.rz[index];
    var inqVal = data.indexValues.inq[index];
    var otqVal = data.indexValues.otq[index];

    this.setData({
      selectedData: {
        formattedTime: formatTime(timeStr),
        rz: (rzVal !== null && rzVal !== undefined) ? rzVal.toFixed(2) : '--',
        inq: (inqVal !== null && inqVal !== undefined) ? inqVal.toFixed(2) : '--',
        otq: (otqVal !== null && otqVal !== undefined) ? otqVal.toFixed(2) : '--'
      },
      headerTime: formatTime(timeStr)
    });
  },

  getOption: function(chartData, floodLimitLevel) {
    var rzList = [];
    for (var i = 0; i < chartData.indexValues.rz.length; i++) {
      if (chartData.indexValues.rz[i] !== null) {
        rzList.push(chartData.indexValues.rz[i]);
      }
    }
    
    var minW = Math.min.apply(null, rzList.concat([floodLimitLevel]));
    var maxW = Math.max.apply(null, rzList.concat([floodLimitLevel]));

    var floodLine = [];
    for (var j = 0; j < chartData.timeList.length; j++) {
      floodLine.push(floodLimitLevel);
    }

    var labelInterval = Math.max(1, Math.floor(chartData.timeList.length / 5));

    return {
      backgroundColor: '#ffffff',
      grid: { 
        left: 8, 
        right: 8, 
        bottom: 45, 
        top: 30, 
        containLabel: true 
      },
      tooltip: { 
        trigger: 'axis',
        show: true,
        triggerOn: 'none',
        transitionDuration: 0,
        confine: true,
        formatter: function() { return ''; },
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: '#1976D2',
            width: 1.5,
            type: 'solid'
          },
          label: { show: false }
        }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: chartData.timeList,
        axisLine: { show: true, lineStyle: { color: '#e0e0e0' } },
        axisTick: { show: false },
        axisLabel: {
          rotate: 50,
          fontSize: 9,
          color: '#aaa',
          interval: labelInterval,
          formatter: function(v) { 
            if (!v) return '';
            if (v.length >= 13) return v.substring(5, 13);
            return v.substring(5);
          }
        }
      },
      yAxis: [
        { 
          type: 'value', 
          name: '水位m', 
          nameTextStyle: { fontSize: 9, color: '#aaa' },
          min: Math.floor(minW - 0.5), 
          max: Math.ceil(maxW + 0.5),
          axisLine: { show: true, lineStyle: { color: '#2196F3' } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { fontSize: 9, color: '#aaa' }
        },
        { 
          type: 'value', 
          name: '流量', 
          nameTextStyle: { fontSize: 9, color: '#aaa' },
          position: 'right', 
          splitLine: { show: true, lineStyle: { type: 'dashed', color: '#f5f5f5' } },
          axisLine: { show: true, lineStyle: { color: '#4CAF50' } },
          axisTick: { show: false },
          axisLabel: { fontSize: 9, color: '#aaa' }
        }
      ],
      series: [
        {
          name: '库水位', 
          type: 'line', 
          smooth: true, 
          data: chartData.indexValues.rz,
          itemStyle: { color: '#2196F3' }, 
          showSymbol: false,
          symbol: 'none',
          lineStyle: { width: 1.5 }
        },
        {
          name: '入库流量', 
          type: 'line', 
          smooth: true, 
          yAxisIndex: 1,
          data: chartData.indexValues.inq,
          itemStyle: { color: '#4CAF50' },
          showSymbol: false,
          symbol: 'none',
          lineStyle: { width: 1.5 }
        },
        {
          name: '出库流量', 
          type: 'line', 
          smooth: true, 
          yAxisIndex: 1,
          data: chartData.indexValues.otq,
          itemStyle: { color: '#FF9800' },
          showSymbol: false,
          symbol: 'none',
          lineStyle: { width: 1.5 }
        },
        {
          name: '汛限水位', 
          type: 'line',
          data: floodLine,
          lineStyle: { color: '#F44336', type: 'dashed', width: 1 }, 
          symbol: 'none',
          silent: true
        }
      ]
    };
  },

  onShareAppMessage: function () {
    return {
      title: '实时水文监测数据',
      path: '/pages/index/index'
    };
  },

  onShareTimeline: function () {
    return {
      title: '实时水文监测数据'
    };
  }
});