const http = require('http');

exports.handler = async (event, context) => {
  // 1. 解析参数
  let eventObj = {};
  try {
    eventObj = JSON.parse(event.toString());
  } catch (e) {
    eventObj = event;
  }

  const params = eventObj.queryParameters || eventObj.queryStringParameters || {};
  let { code, dateBegin, dateEnd } = params;

  if (!code || !dateBegin || !dateEnd) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "参数不足", received: params })
    };
  }

  // 2. 关键点：处理日期中的空格
  // 如果输入是 "2026-01-27+14"，我们尝试将其还原为 API 易于接受的 "2026-01-27 14"
  // 注意：这里要根据目标 API 的具体要求调整
  const formattedBegin = dateBegin.replace('+', ' ');
  const formattedEnd = dateEnd.replace('+', ' ');

  // 3. 构建请求选项 (添加 Headers)
  const options = {
    hostname: 'www.hnswkcj.com',
    port: 80,
    path: `/wxhn/data/rthyinfo/rsvr/proc/one.json?code=${encodeURIComponent(code)}&dateBegin=${encodeURIComponent(formattedBegin)}&dateEnd=${encodeURIComponent(formattedEnd)}`,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'http://www.hnswkcj.com/wxhn/html/index.html', // 模拟来源页面
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest'
    },
    timeout: 10000
  };

  console.log('正在请求 URL:', `http://${options.hostname}${options.path}`);

  try {
    const result = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            // 如果出错，把目标网站返回的内容也打出来，方便调试
            console.error(`API 返回错误状态码: ${res.statusCode}, 内容: ${data}`);
            resolve({ 
              list: [], 
              apiError: `状态码: ${res.statusCode}`,
              apiDetail: data 
            });
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ list: [], apiError: '解析JSON失败', raw: data });
          }
        });
      });

      req.on('error', (err) => resolve({ list: [], apiError: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ list: [], apiError: '请求目标超时' });
      });
      req.end();
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
