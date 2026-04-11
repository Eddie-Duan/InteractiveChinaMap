const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 尝试加载腾讯云COS SDK
let COS = null;
try {
  // 尝试加载本地SDK
  COS = require('cos-nodejs-sdk-v5');
  console.log('COS SDK loaded successfully');
} catch (e) {
  console.log('COS SDK not found, using fallback method');
  // 回退到手动签名方法
  COS = null;
}

// 从.env文件加载环境变量
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      lines.forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          process.env[key] = value;
        }
      });
    }
  } catch (error) {
    console.error('Error loading .env file:', error);
  }
}

// 加载环境变量
loadEnv();

// 从环境变量或配置文件加载配置
const config = {
  secretId: process.env.SecretId || '您的SecretId',
  secretKey: process.env.SecretKey || '您的SecretKey',
  bucket: process.env.BUCKET || 'cnmap-feedback-1420213302',
  region: process.env.REGION || 'ap-beijing' // 默认北京区域，根据实际情况修改
};

// 初始化COS客户端
let cosClient = null;
if (COS) {
  cosClient = new COS({
    SecretId: config.secretId,
    SecretKey: config.secretKey
  });
  console.log('COS client initialized successfully');
}

// 处理CORS
function handleCORS(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// 生成COS签名（使用腾讯云官方API文档推荐的完整方法）
function generateCOSSignature(method, key) {
  const timestamp = Math.floor(Date.now() / 1000);
  const expires = timestamp + 3600;
  
  // 1. 构建规范化请求
  const httpMethod = method.toLowerCase();
  const canonicalUri = key;
  const canonicalQueryString = '';
  
  // 2. 构建规范化头部
  const headers = {
    'content-type': 'application/json',
    'host': `${config.bucket}.cos.${config.region}.myqcloud.com`
  };
  
  // 排序头部
  const sortedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaders.map(header => `${header}:${headers[header]}`).join('\n');
  const signedHeaders = sortedHeaders.join(';');
  
  // 3. 计算请求体的哈希值
  const payloadHash = crypto.createHash('sha1').update('').digest('hex');
  
  // 4. 构建规范化请求字符串
  const canonicalRequest = [
    httpMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    '', // 空行
    signedHeaders,
    payloadHash
  ].join('\n');
  
  console.log('Generated canonicalRequest:', canonicalRequest);
  
  // 5. 构建签名字符串
  const credentialScope = `${timestamp};${expires}`;
  const stringToSign = `sha1\n${credentialScope}\n${crypto.createHash('sha1').update(canonicalRequest).digest('hex')}\n`;
  
  console.log('Generated stringToSign:', stringToSign);
  
  // 6. 计算签名
  const signature = crypto.createHmac('sha1', config.secretKey)
    .update(stringToSign)
    .digest('base64');
  
  console.log('Generated signature:', signature);
  
  return {
    signature,
    timestamp,
    expires
  };
}

// 保存文件到COS
function saveToCOS(key, content, callback) {
  console.log('Starting saveToCOS with key:', key);
  console.log('Config:', config);
  
  // 确保key前面没有"/"
  const formattedKey = key.startsWith('/') ? key.substring(1) : key;
  
  // 如果有COS SDK，使用SDK来操作
  if (cosClient) {
    console.log('Using COS SDK to save file');
    cosClient.putObject({
      Bucket: config.bucket,
      Region: config.region,
      Key: formattedKey,
      Body: content,
      ContentType: 'application/json'
    }, (err, data) => {
      if (err) {
        console.error('COS SDK error:', err);
        callback(err);
      } else {
        console.log('COS SDK success:', data);
        callback(null, { statusCode: 200, data });
      }
    });
  } else {
    // 回退到手动签名方法
    console.log('Using fallback method to save file');
    // 确保key前面有"/"
    const formattedKeyWithSlash = key.startsWith('/') ? key : `/${key}`;
    
    // 构建请求URL
    const url = `https://${config.bucket}.cos.${config.region}.myqcloud.com${formattedKeyWithSlash}`;
    console.log('Request URL:', url);
    
    // 生成签名
    const signatureInfo = generateCOSSignature('PUT', formattedKeyWithSlash);
    console.log('Generated signature:', signatureInfo);
    
    // 构建Authorization头
    const authorization = `q-sign-algorithm=sha1&q-ak=${config.secretId}&q-sign-time=${signatureInfo.timestamp};${signatureInfo.expires}&q-header-list=content-type;host&q-url-param-list=&q-signature=${signatureInfo.signature}`;
    
    // 使用https.request发送请求
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(content),
        'Authorization': authorization
      }
    };
    
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('COS response status:', res.statusCode);
        console.log('COS response data:', data);
        callback(null, { statusCode: res.statusCode, data });
      });
    });
    
    req.on('error', (error) => {
      console.error('COS request error:', error);
      callback(error);
    });
    
    req.write(content);
    req.end();
  }
}

// 从COS获取文件
function getFromCOS(key, callback) {
  const signatureInfo = generateCOSSignature('GET', key);
  
  const options = {
    hostname: `${config.bucket}.cos.${config.region}.myqcloud.com`,
    path: `/${key}`,
    method: 'GET',
    headers: {
      'Authorization': `q-sign-algorithm=sha1&q-ak=${config.secretId}&q-sign-time=${signatureInfo.timestamp};${signatureInfo.expires}&q-key-time=${signatureInfo.timestamp};${signatureInfo.expires}&q-header-list=host&q-url-param-list=&q-signature=${signatureInfo.signature}`,
      'Host': `${config.bucket}.cos.${config.region}.myqcloud.com`
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      callback(null, { statusCode: res.statusCode, data });
    });
  });
  
  req.on('error', (error) => {
    callback(error);
  });
  
  req.end();
}

// 列出COS目录
function listCOSDir(prefix, callback) {
  const signatureInfo = generateCOSSignature('GET', '');
  
  const options = {
    hostname: `${config.bucket}.cos.${config.region}.myqcloud.com`,
    path: `/?prefix=${encodeURIComponent(prefix)}&delimiter=/`,
    method: 'GET',
    headers: {
      'Authorization': `q-sign-algorithm=sha1&q-ak=${config.secretId}&q-sign-time=${signatureInfo.timestamp};${signatureInfo.expires}&q-key-time=${signatureInfo.timestamp};${signatureInfo.expires}&q-header-list=host&q-url-param-list=delimiter&q-url-param-list=prefix&q-signature=${signatureInfo.signature}`,
      'Host': `${config.bucket}.cos.${config.region}.myqcloud.com`
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      callback(null, { statusCode: res.statusCode, data });
    });
  });
  
  req.on('error', (error) => {
    callback(error);
  });
  
  req.end();
}

// 处理请求
function handleRequest(request, response) {
  handleCORS(response);
  
  if (request.method === 'OPTIONS') {
    response.statusCode = 200;
    response.end();
    return;
  }

  const parsedUrl = url.parse(request.url, true);
  const pathname = parsedUrl.pathname;

  // 处理静态文件
  if (pathname.startsWith('/InteractiveChinaMap/')) {
    const filePath = path.join(__dirname, '..', pathname);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        response.statusCode = 404;
        response.end('File not found');
      } else {
        // 设置正确的Content-Type
        if (filePath.endsWith('.html')) {
          response.setHeader('Content-Type', 'text/html');
        } else if (filePath.endsWith('.css')) {
          response.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
          response.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.ico')) {
          response.setHeader('Content-Type', 'image/png');
        }
        response.statusCode = 200;
        response.end(data);
      }
    });
    return;
  }

  // 处理API请求
  if (pathname === '/api/feedbacks' && request.method === 'GET') {
    // 从COS获取反馈列表
    listCOSDir('feedback/', (error, result) => {
      let feedbacks = [];
      let cosError = error;
      
      // 解析COS响应
      if (!error) {
        try {
          const contents = [];
          // 正则表达式匹配Key标签内容
          const keyRegex = /<Key>(.*?)<\/Key>/g;
          let match;
          
          while ((match = keyRegex.exec(result.data)) !== null) {
            contents.push({ Key: [match[1]] });
          }
          
          let count = 0;
          const cosFeedbacks = [];
          
          if (contents.length === 0) {
            // COS没有反馈数据，从本地存储获取
            loadLocalFeedbacks();
          } else {
            contents.forEach(item => {
              const key = item.Key[0];
              getFromCOS(key, (err, result) => {
                if (!err && result.statusCode === 200) {
                  try {
                    const feedback = JSON.parse(result.data);
                    cosFeedbacks.push(feedback);
                  } catch (e) {
                    console.error('Parse feedback error:', e);
                  }
                }
                
                count++;
                if (count === contents.length) {
                  feedbacks = cosFeedbacks;
                  // 同时从本地存储获取
                  loadLocalFeedbacks();
                }
              });
            });
          }
        } catch (err) {
          console.error('Parse XML error:', err);
          cosError = err;
          // 从本地存储获取
          loadLocalFeedbacks();
        }
      } else {
        console.error('List COS directory error:', error);
        // 从本地存储获取
        loadLocalFeedbacks();
      }
      
      // 从本地存储加载反馈
      function loadLocalFeedbacks() {
        try {
          const feedbackDir = path.join(__dirname, 'feedback');
          if (fs.existsSync(feedbackDir)) {
            const files = fs.readdirSync(feedbackDir);
            files.forEach(file => {
              if (file.endsWith('.json')) {
                const filePath = path.join(feedbackDir, file);
                try {
                  const content = fs.readFileSync(filePath, 'utf8');
                  const feedback = JSON.parse(content);
                  feedbacks.push(feedback);
                } catch (e) {
                  console.error('Read local feedback error:', e);
                }
              }
            });
          }
          // 返回所有反馈
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(feedbacks));
        } catch (localError) {
          console.error('Load local feedbacks error:', localError);
          response.statusCode = 500;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ error: '获取反馈列表失败' }));
        }
      }
    });
    return;
  }

  if (pathname === '/api/save-feedback' && request.method === 'POST') {
    // 处理保存反馈
    let body = '';
    request.on('data', chunk => {
      body += chunk.toString();
    });
    request.on('end', () => {
      console.log('Received request body:', body);
      try {
        const feedbackData = JSON.parse(body);
        console.log('Parsed feedback data:', feedbackData);
        
        // 保存到COS
  const key = `feedback/${Date.now()}.json`;
  console.log('Saving to COS with key:', key);
  saveToCOS(key, JSON.stringify(feedbackData), (error, result) => {
    if (error || (result && result.statusCode !== 200)) {
      console.error('Save to COS error:', error || result.data);
      // 回退到本地存储
      console.log('Falling back to local storage');
      try {
        // 确保本地feedback目录存在
        const feedbackDir = path.join(__dirname, 'feedback');
        if (!fs.existsSync(feedbackDir)) {
          fs.mkdirSync(feedbackDir, { recursive: true });
        }
        // 保存到本地文件
        const localFilePath = path.join(feedbackDir, `${Date.now()}.json`);
        fs.writeFileSync(localFilePath, JSON.stringify(feedbackData));
        console.log('Saved feedback to local storage:', localFilePath);
        // 返回成功
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ success: true, message: '反馈保存成功' }));
      } catch (localError) {
        console.error('Save to local storage error:', localError);
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ success: false, message: '保存反馈失败' }));
      }
      return;
    }
    
    console.log('COS response status:', result.statusCode);
    console.log('COS response data:', result.data);
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ success: true, message: '反馈保存成功' }));
  });
      } catch (error) {
        console.error('Parse feedback data error:', error);
        response.statusCode = 400;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ success: false, message: '请求数据格式错误' }));
      }
    });
    return;
  }

  if (pathname === '/api/sts' && request.method === 'GET') {
    // 模拟返回临时密钥
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({
      credentials: {
        tmpSecretId: 'mock-tmp-secret-id',
        tmpSecretKey: 'mock-tmp-secret-key',
        sessionToken: 'mock-session-token'
      },
      expiredTime: Math.floor(Date.now() / 1000) + 7200
    }));
    return;
  }

  // 默认返回404
  response.statusCode = 404;
  response.end('Not found');
}

// 创建服务器
const server = http.createServer(handleRequest);
const port = process.env.PORT || 3001;

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
  console.log(`You can access your website at http://localhost:${port}/InteractiveChinaMap/index.html`);
});