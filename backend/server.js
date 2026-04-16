const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// 处理CORS
function handleCORS(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
    // 移除 /InteractiveChinaMap 前缀，直接使用相对路径
    const relativePath = pathname.replace('/InteractiveChinaMap', '');
    const filePath = path.join(__dirname, '..', relativePath);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error('File not found:', filePath);
        response.statusCode = 404;
        response.end('File not found: ' + filePath);
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
        } else if (filePath.endsWith('.gif')) {
          response.setHeader('Content-Type', 'image/gif');
        } else if (filePath.endsWith('.svg')) {
          response.setHeader('Content-Type', 'image/svg+xml');
        }
        response.statusCode = 200;
        response.end(data);
      }
    });
    return;
  }

  // 处理API请求
  if (pathname === '/api/feedbacks' && request.method === 'GET') {
    // 从本地存储获取反馈列表
    try {
      const feedbacks = [];
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
    } catch (error) {
      console.error('Load local feedbacks error:', error);
      response.statusCode = 500;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: '获取反馈列表失败' }));
    }
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
        
        // 保存到本地存储
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
      } catch (error) {
        console.error('Parse feedback data error:', error);
        response.statusCode = 400;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ success: false, message: '请求数据格式错误' }));
      }
    });
    return;
  }

  // 处理用户登录信息
  if (pathname === '/api/login' && request.method === 'POST') {
    let body = '';
    request.on('data', chunk => {
      body += chunk.toString();
    });
    request.on('end', () => {
      try {
        const userData = JSON.parse(body);
        console.log('Received user login data:', userData);
        
        // 保存用户登录信息
        try {
          // 确保本地users目录存在
          const usersDir = path.join(__dirname, 'users');
          if (!fs.existsSync(usersDir)) {
            fs.mkdirSync(usersDir, { recursive: true });
          }
          
          // 生成唯一文件名（使用时间戳和随机数）
          const fileName = `${Date.now()}_${Math.floor(Math.random() * 10000)}.json`;
          const localFilePath = path.join(usersDir, fileName);
          
          // 保存用户信息
          fs.writeFileSync(localFilePath, JSON.stringify(userData));
          console.log('Saved user login to local storage:', localFilePath);
          
          // 返回成功
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ success: true, message: '登录信息保存成功' }));
        } catch (localError) {
          console.error('Save user login to local storage error:', localError);
          response.statusCode = 500;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ success: false, message: '保存登录信息失败' }));
        }
      } catch (error) {
        console.error('Parse user login data error:', error);
        response.statusCode = 400;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ success: false, message: '请求数据格式错误' }));
      }
    });
    return;
  }

  // 处理获取已登录用户列表
  if (pathname === '/api/users' && request.method === 'GET') {
    try {
      const users = [];
      const usersDir = path.join(__dirname, 'users');
      
      if (fs.existsSync(usersDir)) {
        const files = fs.readdirSync(usersDir);
        files.forEach(file => {
          if (file.endsWith('.json')) {
            const filePath = path.join(usersDir, file);
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              const user = JSON.parse(content);
              users.push(user);
            } catch (e) {
              console.error('Read local user error:', e);
            }
          }
        });
      }
      
      // 按登录时间降序排序
      users.sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime));
      
      // 返回用户列表
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(users));
    } catch (error) {
      console.error('Load local users error:', error);
      response.statusCode = 500;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: '获取用户列表失败' }));
    }
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