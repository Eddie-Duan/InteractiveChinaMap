const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// 加载环境变量
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=').map(s => s.trim());
      if (key && value) {
        process.env[key] = value;
      }
    });
  }
}
loadEnv();

const FEEDBACK_FILE = path.join(__dirname, 'feedback.json');
const USER_LOGIN_FILE = path.join(__dirname, 'user_login.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const MESSAGE_READ_STATUS_FILE = path.join(__dirname, 'message_read_status.json');
const ACHIEVEMENTS_FILE = path.join(__dirname, 'achievements.json');
const DAILY_CHALLENGE_FILE = path.join(__dirname, 'daily_challenges.json');
const DAILY_CHALLENGE_SCORES_FILE = path.join(__dirname, 'daily_challenge_user_scores.json');
const PUZZLE_STATS_FILE = path.join(__dirname, 'puzzle_stats.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const DAILY_QUESTIONS_FILE = path.join(__dirname, 'daily_questions.json');

function initDataFiles() {
  const files = [
    FEEDBACK_FILE, USER_LOGIN_FILE, MESSAGES_FILE, 
    MESSAGE_READ_STATUS_FILE, ACHIEVEMENTS_FILE, DAILY_CHALLENGE_FILE, 
    DAILY_CHALLENGE_SCORES_FILE, PUZZLE_STATS_FILE,
    USERS_FILE, DAILY_QUESTIONS_FILE
  ];
  files.forEach(file => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify([]));
    }
  });
}

function handleCORS(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('读取JSON文件失败:', error);
    return [];
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('写入JSON文件失败:', error);
    return false;
  }
}

function handleBody(request, response, callback) {
  let body = '';
  request.on('data', chunk => {
    body += chunk.toString();
  });
  request.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      callback(data);
    } catch (error) {
      console.error('解析JSON失败:', error, body);
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ success: false, message: '数据格式错误' }));
    }
  });
}

function handleRequest(request, response) {
  handleCORS(response);

  const parsedUrl = url.parse(request.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  if (request.method === 'OPTIONS') {
    response.statusCode = 200;
    response.end();
    return;
  }

  if (!pathname.startsWith('/api/')) {
    let filePath = path.join(__dirname, '..', 'frontend', pathname);
    
    if (pathname === '/' || pathname === '') {
      filePath = path.join(__dirname, '..', 'frontend', 'index.html');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        const htmlPath = filePath + '.html';
        fs.readFile(htmlPath, (htmlErr, htmlData) => {
          if (htmlErr) {
            response.statusCode = 404;
            response.end('File not found');
          } else {
            response.setHeader('Content-Type', 'text/html');
            response.statusCode = 200;
            response.end(htmlData);
          }
        });
      } else {
        if (filePath.endsWith('.html')) response.setHeader('Content-Type', 'text/html');
        else if (filePath.endsWith('.css')) response.setHeader('Content-Type', 'text/css');
        else if (filePath.endsWith('.js')) response.setHeader('Content-Type', 'application/javascript');
        else if (filePath.endsWith('.json')) response.setHeader('Content-Type', 'application/json');
        else if (filePath.endsWith('.png')) response.setHeader('Content-Type', 'image/png');
        else if (filePath.endsWith('.jpg')) response.setHeader('Content-Type', 'image/jpeg');
        else if (filePath.endsWith('.ico')) response.setHeader('Content-Type', 'image/x-icon');
        else if (filePath.endsWith('.gif')) response.setHeader('Content-Type', 'image/gif');
        else if (filePath.endsWith('.svg')) response.setHeader('Content-Type', 'image/svg+xml');
        else if (filePath.endsWith('.txt')) response.setHeader('Content-Type', 'text/plain');
        response.statusCode = 200;
        response.end(data);
      }
    });
    return;
  }

  const endRequest = (statusCode, data) => {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(data));
  };

  if (pathname === '/api/feedbacks' && request.method === 'GET') {
    const feedbacks = readJsonFile(FEEDBACK_FILE);
    endRequest(200, feedbacks);
    return;
  }

  if (pathname === '/api/save-feedback' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const feedbacks = readJsonFile(FEEDBACK_FILE);
      feedbacks.unshift(data);
      writeJsonFile(FEEDBACK_FILE, feedbacks);
      endRequest(200, { success: true, message: '反馈保存成功' });
    });
    return;
  }

  if (pathname === '/api/update-feedback' && request.method === 'PUT') {
    handleBody(request, response, (data) => {
      const feedbacks = readJsonFile(FEEDBACK_FILE);
      const index = feedbacks.findIndex(f => f.id === data.id);
      if (index !== -1) {
        feedbacks[index].resolved = data.resolved;
        writeJsonFile(FEEDBACK_FILE, feedbacks);
        endRequest(200, { success: true, message: '状态更新成功' });
      } else {
        endRequest(404, { success: false, message: '反馈不存在' });
      }
    });
    return;
  }

  if (pathname === '/api/delete-feedback' && request.method === 'DELETE') {
    const id = parseInt(query.id);
    if (!id || isNaN(id)) {
      endRequest(400, { success: false, message: '无效的反馈ID' });
      return;
    }
    let feedbacks = readJsonFile(FEEDBACK_FILE);
    feedbacks = feedbacks.filter(f => f.id !== id);
    writeJsonFile(FEEDBACK_FILE, feedbacks);
    endRequest(200, { success: true, message: '删除成功' });
    return;
  }

  if (pathname === '/api/messages' && request.method === 'GET') {
    const messages = readJsonFile(MESSAGES_FILE);
    const readStatus = readJsonFile(MESSAGE_READ_STATUS_FILE);
    const readMap = {};
    readStatus.forEach(item => {
      readMap[item.messageId] = item.read;
    });
    const messagesWithReadStatus = messages.map(msg => ({
      ...msg,
      read: readMap[msg.id] === true
    }));
    messagesWithReadStatus.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
    endRequest(200, messagesWithReadStatus);
    return;
  }

  if (pathname === '/api/save-message' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const messages = readJsonFile(MESSAGES_FILE);
      messages.unshift(data);
      writeJsonFile(MESSAGES_FILE, messages);
      endRequest(200, { success: true, message: '消息保存成功' });
    });
    return;
  }

  if (pathname === '/api/delete-message' && request.method === 'DELETE') {
    const id = parseInt(query.id);
    if (!id || isNaN(id)) {
      endRequest(400, { success: false, message: '无效的消息ID' });
      return;
    }
    let messages = readJsonFile(MESSAGES_FILE);
    messages = messages.filter(m => m.id !== id);
    writeJsonFile(MESSAGES_FILE, messages);
    endRequest(200, { success: true, message: '删除成功' });
    return;
  }

  if (pathname === '/api/mark-message-read' && request.method === 'PUT') {
    handleBody(request, response, (data) => {
      if (!data.id || isNaN(data.id)) {
        endRequest(400, { success: false, message: '无效的消息ID' });
        return;
      }
      const messages = readJsonFile(MESSAGES_FILE);
      const messageExists = messages.some(m => m.id === data.id);
      if (!messageExists) {
        endRequest(404, { success: false, message: '消息不存在' });
        return;
      }
      const readStatus = readJsonFile(MESSAGE_READ_STATUS_FILE);
      const index = readStatus.findIndex(item => item.messageId === data.id);
      if (index !== -1) {
        readStatus[index].read = true;
      } else {
        readStatus.push({ messageId: data.id, read: true });
      }
      writeJsonFile(MESSAGE_READ_STATUS_FILE, readStatus);
      endRequest(200, { success: true, message: '标记已读成功' });
    });
    return;
  }

  if (pathname === '/api/users' && request.method === 'GET') {
    const users = readJsonFile(USER_LOGIN_FILE);
    users.sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime));
    endRequest(200, users);
    return;
  }

  if (pathname === '/api/login' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const users = readJsonFile(USER_LOGIN_FILE);
      users.unshift(data);
      writeJsonFile(USER_LOGIN_FILE, users);
      endRequest(200, { success: true, message: '登录信息保存成功' });
    });
    return;
  }

  // 计算字符串的MD5哈希值
  function md5Hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // 管理员登录验证（密码从环境变量读取）
  if (pathname === '/api/admin-login' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '@2356046371';
      const ADMIN_PASSWORD_HASH = md5Hash(ADMIN_PASSWORD);
      // 前端已经对密码进行了哈希处理，后端直接比较哈希值
      if (data.password === ADMIN_PASSWORD_HASH) {
        endRequest(200, { success: true, message: '管理员登录成功' });
      } else {
        endRequest(401, { success: false, message: '密码错误' });
      }
    });
    return;
  }

  if (pathname === '/api/register' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const users = readJsonFile(USERS_FILE);
      const existingUser = users.find(u => u.username === data.username);
      if (existingUser) {
        endRequest(400, { success: false, message: '用户名已存在' });
        return;
      }
      const createTime = new Date().toISOString();
      users.push({
        username: data.username,
        password: data.password,
        createTime: createTime
      });
      writeJsonFile(USERS_FILE, users);
      endRequest(200, { success: true, message: '注册成功', createTime: createTime });
    });
    return;
  }

  if (pathname === '/api/user-login' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const users = readJsonFile(USERS_FILE);
      const userExists = users.find(u => u.username === data.username);
      if (!userExists) {
        endRequest(401, { success: false, message: '请先注册' });
        return;
      }
      const user = users.find(u => u.username === data.username && u.password === data.password);
      if (user) {
        const loginRecords = readJsonFile(USER_LOGIN_FILE);
        loginRecords.unshift({
          username: data.username,
          loginTime: new Date().toISOString()
        });
        writeJsonFile(USER_LOGIN_FILE, loginRecords);
        endRequest(200, { success: true, message: '登录成功', createTime: user.createTime });
      } else {
        endRequest(401, { success: false, message: '密码错误' });
      }
    });
    return;
  }

  if (pathname === '/api/forgot-password' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const users = readJsonFile(USERS_FILE);
      const userIndex = users.findIndex(u => u.username === data.username);
      if (userIndex === -1) {
        endRequest(404, { success: false, message: '用户不存在' });
        return;
      }
      users[userIndex].password = data.newPassword;
      writeJsonFile(USERS_FILE, users);
      endRequest(200, { success: true, message: '密码重置成功' });
    });
    return;
  }

  if (pathname === '/api/all-users' && request.method === 'GET') {
    const users = readJsonFile(USERS_FILE);
    const loginRecords = readJsonFile(USER_LOGIN_FILE);
    const userList = users.map(u => {
      const lastLogin = loginRecords.find(l => l.username === u.username);
      return {
        username: u.username,
        createTime: u.createTime,
        lastLoginTime: lastLogin ? lastLogin.loginTime : null
      };
    });
    userList.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
    endRequest(200, userList);
    return;
  }

  if (pathname === '/api/achievements' && request.method === 'GET') {
    const achievements = readJsonFile(ACHIEVEMENTS_FILE);
    endRequest(200, achievements);
    return;
  }

  if (pathname === '/api/save-achievement' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const achievements = readJsonFile(ACHIEVEMENTS_FILE);
      const index = achievements.findIndex(a => a.userId === data.userId);
      if (index !== -1) {
        const userAchievements = achievements[index].achievements || {};
        Object.assign(userAchievements, data.achievements);
        achievements[index].achievements = userAchievements;
        
        const userStats = achievements[index].stats || {};
        if (data.stats) {
          Object.keys(data.stats).forEach(key => {
            if (key === 'totalAnswers' || key === 'correctAnswers' || key === 'bestStreak' || 
                key === 'puzzleProvinceCorrect' || key === 'puzzleCityCorrect' || key === 'quizCorrect' ||
                key === 'puzzleProvinceStreak' || key === 'puzzleCityStreak' || key === 'quizStreak') {
              userStats[key] = Math.max(userStats[key] || 0, data.stats[key]);
            } else if (key === 'quizTotal') {
              userStats[key] = (userStats[key] || 0) + data.stats[key];
            } else {
              userStats[key] = data.stats[key];
            }
          });
        }
        achievements[index].stats = userStats;
        achievements[index].lastUpdate = new Date().toISOString();
      } else {
        achievements.push({
          userId: data.userId,
          achievements: data.achievements || {},
          stats: data.stats || {},
          lastUpdate: new Date().toISOString()
        });
      }
      writeJsonFile(ACHIEVEMENTS_FILE, achievements);
      endRequest(200, { success: true, message: '成就保存成功' });
    });
    return;
  }

  if (pathname === '/api/daily-challenge' && request.method === 'GET') {
    const challenges = readJsonFile(DAILY_CHALLENGE_FILE);
    const today = new Date().toISOString().split('T')[0];
    const todayChallenge = challenges.find(c => c.date === today);
    endRequest(200, todayChallenge || { date: today, completed: false, bestTime: null });
    return;
  }

  if (pathname === '/api/daily-challenge' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const challenges = readJsonFile(DAILY_CHALLENGE_FILE);
      const today = new Date().toISOString().split('T')[0];
      const index = challenges.findIndex(c => c.date === today);
      if (index !== -1) {
        if (!challenges[index].completed || (data.completed && data.time < challenges[index].bestTime)) {
          challenges[index] = { date: today, completed: data.completed, bestTime: data.time || challenges[index].bestTime };
        }
      } else {
        challenges.push({ date: today, completed: data.completed, bestTime: data.time });
      }
      writeJsonFile(DAILY_CHALLENGE_FILE, challenges);
      endRequest(200, { success: true, message: '挑战记录保存成功' });
    });
    return;
  }

  if (pathname === '/api/daily-challenge-scores' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const scores = readJsonFile(DAILY_CHALLENGE_SCORES_FILE);
      const today = new Date().toISOString().split('T')[0];
      const { username, gpa, time, correct, isRetry } = data;
      
      if (!username) {
        endRequest(400, { success: false, message: '用户名不能为空' });
        return;
      }
      
      const existingIndex = scores.findIndex(s => s.date === today && s.username === username);
      
      if (existingIndex !== -1) {
        const existing = scores[existingIndex];
        if (existing.correct && !existing.isRetry) {
          endRequest(403, { success: false, message: '今日已完成答题，无法再次参与' });
          return;
        }
        if (isRetry && correct) {
          scores[existingIndex] = {
            ...existing,
            gpa: Math.max(existing.gpa, 1.6),
            time: Math.min(existing.time || Infinity, time || Infinity),
            correct: true,
            isRetry: true
          };
        } else if (!existing.isRetry) {
          scores[existingIndex] = {
            ...existing,
            gpa: Math.max(existing.gpa, gpa),
            time: Math.min(existing.time || Infinity, time || Infinity)
          };
        }
      } else {
        scores.push({
          date: today,
          username,
          gpa,
          time,
          correct,
          isRetry: isRetry || false,
          createTime: new Date().toISOString()
        });
      }
      
      writeJsonFile(DAILY_CHALLENGE_SCORES_FILE, scores);
      endRequest(200, { success: true, message: '分数保存成功' });
    });
    return;
  }

  if (pathname === '/api/daily-challenge-rankings' && request.method === 'GET') {
    const scores = readJsonFile(DAILY_CHALLENGE_SCORES_FILE);
    const today = new Date().toISOString().split('T')[0];
    const todayScores = scores
      .filter(s => s.date === today)
      .sort((a, b) => b.gpa - a.gpa || (a.time || Infinity) - (b.time || Infinity));
    
    const rankings = todayScores.map((s, index) => ({
      rank: index + 1,
      username: s.username,
      gpa: s.gpa,
      time: s.time,
      correct: s.correct
    }));
    
    endRequest(200, rankings);
    return;
  }

  if (pathname === '/api/user-daily-status' && request.method === 'GET') {
    const scores = readJsonFile(DAILY_CHALLENGE_SCORES_FILE);
    const today = new Date().toISOString().split('T')[0];
    const username = query.username || '';
    
    if (!username) {
      endRequest(400, { success: false, message: '用户名不能为空' });
      return;
    }
    
    const userTodayRecord = scores.find(s => s.date === today && s.username === username);
    
    if (userTodayRecord) {
      endRequest(200, {
        completed: userTodayRecord.correct && !userTodayRecord.isRetry,
        gpa: userTodayRecord.gpa,
        time: userTodayRecord.time,
        correct: userTodayRecord.correct,
        isRetry: userTodayRecord.isRetry,
        hasAnswered: true
      });
    } else {
      endRequest(200, {
        completed: false,
        hasAnswered: false
      });
    }
    return;
  }

  if (pathname === '/api/all-rankings' && request.method === 'GET') {
    const scores = readJsonFile(DAILY_CHALLENGE_SCORES_FILE);
    const allScores = scores
      .sort((a, b) => b.gpa - a.gpa || (a.time || Infinity) - (b.time || Infinity));
    
    const rankings = allScores.map((s, index) => ({
      rank: index + 1,
      username: s.username,
      gpa: s.gpa,
      time: s.time,
      date: s.date,
      correct: s.correct
    }));
    
    endRequest(200, rankings);
    return;
  }

  if (pathname === '/api/puzzle-stats' && request.method === 'GET') {
    const stats = readJsonFile(PUZZLE_STATS_FILE);
    endRequest(200, stats);
    return;
  }

  if (pathname === '/api/puzzle-stats' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const stats = readJsonFile(PUZZLE_STATS_FILE);
      if (data.type === 'province') {
        const index = stats.findIndex(s => s.name === data.name);
        if (index !== -1) {
          stats[index].count++;
        } else {
          stats.push({ type: 'province', name: data.name, count: 1 });
        }
      } else if (data.type === 'city') {
        const index = stats.findIndex(s => s.name === data.name);
        if (index !== -1) {
          stats[index].count++;
        } else {
          stats.push({ type: 'city', name: data.name, count: 1 });
        }
      }
      writeJsonFile(PUZZLE_STATS_FILE, stats);
      endRequest(200, { success: true, message: '统计数据保存成功' });
    });
    return;
  }

  if (pathname === '/api/record-answer' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const achievements = readJsonFile(ACHIEVEMENTS_FILE);
      const index = achievements.findIndex(a => a.userId === data.userId);
      
      if (index === -1) {
        achievements.push({
          userId: data.userId,
          achievements: {},
          stats: {
            totalAnswers: 0,
            correctAnswers: 0,
            puzzleProvinceCorrect: 0,
            puzzleCityCorrect: 0,
            quizCorrect: 0,
            currentStreak: 0,
            bestStreak: 0,
            totalTime: 0,
            dailyChallenges: {}
          },
          lastUpdate: new Date().toISOString()
        });
      }
      
      const userData = achievements[index === -1 ? achievements.length - 1 : index];
      if (!userData.stats) userData.stats = {};
      
      userData.stats.totalAnswers = (userData.stats.totalAnswers || 0) + 1;
      if (data.correct) {
        userData.stats.correctAnswers = (userData.stats.correctAnswers || 0) + 1;
        userData.stats.currentStreak = (userData.stats.currentStreak || 0) + 1;
        if (userData.stats.currentStreak > (userData.stats.bestStreak || 0)) {
          userData.stats.bestStreak = userData.stats.currentStreak;
        }
      } else {
        userData.stats.currentStreak = 0;
      }
      
      if (data.mode === 'province-puzzle') {
        userData.stats.puzzleProvinceCorrect = (userData.stats.puzzleProvinceCorrect || 0) + (data.correct ? 1 : 0);
      } else if (data.mode === 'city-puzzle') {
        userData.stats.puzzleCityCorrect = (userData.stats.puzzleCityCorrect || 0) + (data.correct ? 1 : 0);
      } else if (data.mode === 'quiz') {
        userData.stats.quizCorrect = (userData.stats.quizCorrect || 0) + (data.correct ? 1 : 0);
      }
      
      if (data.time) {
        userData.stats.totalTime = (userData.stats.totalTime || 0) + data.time;
      }
      
      userData.lastUpdate = new Date().toISOString();
      writeJsonFile(ACHIEVEMENTS_FILE, achievements);
      endRequest(200, { success: true, message: '答题记录保存成功' });
    });
    return;
  }

  if (pathname === '/api/user-stats' && request.method === 'GET') {
    const userId = query.userId;
    const achievements = readJsonFile(ACHIEVEMENTS_FILE);
    const userData = achievements.find(a => a.userId === userId);
    endRequest(200, userData ? userData : { userId, achievements: {}, stats: {} });
    return;
  }

  if (pathname === '/api/all-user-stats' && request.method === 'GET') {
    const achievements = readJsonFile(ACHIEVEMENTS_FILE);
    const result = achievements.map(a => {
      const stats = a.stats || {};
      const totalAnswers = stats.totalAnswers || 0;
      const correctAnswers = stats.correctAnswers || 0;
      const accuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;
      const gpa = totalAnswers > 0 ? (accuracy * 0.04).toFixed(3) : '0.000';
      return {
        userId: a.userId,
        totalAnswers,
        correctAnswers,
        accuracy: Math.round(accuracy * 100) / 100,
        gpa: Math.round(gpa * 1000) / 1000
      };
    });
    result.sort((a, b) => b.gpa - a.gpa);
    result.forEach((item, index) => {
      item.rank = index + 1;
    });
    endRequest(200, result);
    return;
  }

  if (pathname === '/api/daily-questions' && request.method === 'GET') {
    const questions = readJsonFile(DAILY_QUESTIONS_FILE);
    endRequest(200, questions);
    return;
  }

  if (pathname === '/api/save-daily-question' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const questions = readJsonFile(DAILY_QUESTIONS_FILE);
      if (data.id) {
        const index = questions.findIndex(q => q.id === data.id);
        if (index !== -1) {
          questions[index] = { ...questions[index], ...data };
        } else {
          questions.push(data);
        }
      } else {
        data.id = Date.now().toString();
        questions.push(data);
      }
      writeJsonFile(DAILY_QUESTIONS_FILE, questions);
      endRequest(200, { success: true, message: '题目保存成功', id: data.id });
    });
    return;
  }

  if (pathname === '/api/delete-daily-question' && request.method === 'DELETE') {
    const id = query.id;
    let questions = readJsonFile(DAILY_QUESTIONS_FILE);
    questions = questions.filter(q => q.id !== id);
    writeJsonFile(DAILY_QUESTIONS_FILE, questions);
    endRequest(200, { success: true, message: '删除成功' });
    return;
  }

  if (pathname === '/api/today-question' && request.method === 'GET') {
    const questions = readJsonFile(DAILY_QUESTIONS_FILE);
    const today = new Date().toISOString().split('T')[0];
    const todayQuestion = questions.find(q => q.date === today);
    endRequest(200, todayQuestion || null);
    return;
  }

  if (pathname === '/api/set-today-question' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const questions = readJsonFile(DAILY_QUESTIONS_FILE);
      const today = new Date().toISOString().split('T')[0];
      const existingIndex = questions.findIndex(q => q.date === today);
      if (existingIndex !== -1) {
        questions[existingIndex] = { ...data, date: today };
      } else {
        questions.push({ ...data, date: today });
      }
      writeJsonFile(DAILY_QUESTIONS_FILE, questions);
      endRequest(200, { success: true, message: '今日题目设置成功' });
    });
    return;
  }

  if (pathname === '/api/question-bank' && request.method === 'GET') {
    const questions = readJsonFile(DAILY_QUESTIONS_FILE);
    questions.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    endRequest(200, questions);
    return;
  }

  if (pathname === '/api/add-question' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const questions = readJsonFile(DAILY_QUESTIONS_FILE);
      if (!data.id) {
        data.id = 'q_' + Date.now();
      }
      questions.push(data);
      const success = writeJsonFile(DAILY_QUESTIONS_FILE, questions);
      if (success) {
        endRequest(200, { success: true, message: '题目添加成功', question: data });
      } else {
        endRequest(500, { success: false, message: '保存失败：无法写入文件' });
      }
    });
    return;
  }

  if (pathname === '/api/update-question' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const questions = readJsonFile(DAILY_QUESTIONS_FILE);
      const index = questions.findIndex(q => q.id === data.id);
      if (index !== -1) {
        questions[index] = { ...questions[index], ...data };
        const success = writeJsonFile(DAILY_QUESTIONS_FILE, questions);
        if (success) {
          endRequest(200, { success: true, message: '题目更新成功' });
        } else {
          endRequest(500, { success: false, message: '保存失败：无法写入文件' });
        }
      } else {
        endRequest(404, { success: false, message: '题目不存在' });
      }
    });
    return;
  }

  if (pathname === '/api/delete-question' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      let questions = readJsonFile(DAILY_QUESTIONS_FILE);
      
      if (data.index !== undefined && data.index !== null) {
        const index = parseInt(data.index);
        if (!isNaN(index) && index >= 0 && index < questions.length) {
          questions.splice(index, 1);
        }
      } else if (data.id) {
        questions = questions.filter(q => q.id !== data.id);
      }
      
      writeJsonFile(DAILY_QUESTIONS_FILE, questions);
      endRequest(200, { success: true, message: '题目删除成功' });
    });
    return;
  }

  if (pathname === '/api/search-questions' && request.method === 'GET') {
    const keyword = query.keyword || '';
    const questions = readJsonFile(DAILY_QUESTIONS_FILE);
    if (!keyword) {
      questions.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
      endRequest(200, questions);
      return;
    }
    const filtered = questions.filter(q =>
      (q.question && q.question.includes(keyword)) ||
      (q.id && q.id.includes(keyword)) ||
      (q.answer && q.answer.includes(keyword)) ||
      (q.options && q.options.some(opt => opt.includes(keyword)))
    );
    filtered.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    endRequest(200, filtered);
    return;
  }

  if (pathname === '/api/change-password' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const { username, currentPassword, newPassword } = data;
      const users = readJsonFile(USERS_FILE);
      const userIndex = users.findIndex(u => u.username === username);
      
      if (userIndex === -1) {
        endRequest(404, { success: false, message: '用户不存在' });
        return;
      }
      
      if (users[userIndex].password !== currentPassword) {
        endRequest(401, { success: false, message: '当前密码错误' });
        return;
      }
      
      users[userIndex].password = newPassword;
      users[userIndex].passwordUpdateTime = new Date().toISOString();
      writeJsonFile(USERS_FILE, users);
      endRequest(200, { success: true, message: '密码修改成功' });
    });
    return;
  }

  if (pathname === '/api/delete-account' && request.method === 'POST') {
    handleBody(request, response, (data) => {
      const { username, password } = data;
      const users = readJsonFile(USERS_FILE);
      const userIndex = users.findIndex(u => u.username === username);
      
      if (userIndex === -1) {
        endRequest(404, { success: false, message: '用户不存在' });
        return;
      }
      
      if (users[userIndex].password !== password) {
        endRequest(401, { success: false, message: '密码错误' });
        return;
      }
      
      users.splice(userIndex, 1);
      writeJsonFile(USERS_FILE, users);
      
      const achievements = readJsonFile(ACHIEVEMENTS_FILE);
      const filteredAchievements = achievements.filter(a => a.userId !== username);
      writeJsonFile(ACHIEVEMENTS_FILE, filteredAchievements);
      
      const progress = readJsonFile(PROGRESS_FILE);
      const filteredProgress = progress.filter(p => p.userId !== username);
      writeJsonFile(PROGRESS_FILE, filteredProgress);
      
      endRequest(200, { success: true, message: '账户已注销' });
    });
    return;
  }

  endRequest(404, { message: 'API not found' });
}

initDataFiles();

const server = http.createServer(handleRequest);
const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});