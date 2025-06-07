const net = require('net');
const tls = require('tls');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

// 配置参数
const INPUT_URL = 'https://raw.githubusercontent.com/Jason9699/ffip/refs/heads/main/proxies/proxies.txt';
const OUTPUT_FILE = path.join(__dirname, 'output', 'valid-ips.txt');
const TEST_HOST = 'speed.cloudflare.com';
const TEST_PATH = '/cdn-cgi/trace';
const TEST_PORT = 443;
const TIMEOUT = 5000; // 5秒超时
const CONCURRENCY = 50; // 并发检测数量
const MAX_RETRIES = 2; // 最大重试次数

// 下载IP列表函数
async function downloadIPList(url) {
  try {
    console.log(`⬇⬇️ 正在从 ${url} 下载IP列表...`);
    const response = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`下载失败: HTTP ${res.statusCode}`));
          return;
        }
        
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
    
    console.log('✅ IP列表下载成功');
    return response;
  } catch (error) {
    console.error(`❌❌ 下载IP列表失败: ${error.message}`);
    process.exit(1);
  }
}

// 检测代理IP函数
async function checkProxyIP(ip) {
  let retryCount = 0;
  
  while (retryCount <= MAX_RETRIES) {
    try {
      return await new Promise((resolve) => {
        // 使用TLS连接（HTTPS）
        const socket = tls.connect({
          host: ip,
          port: TEST_PORT,
          servername: TEST_HOST,
          rejectUnauthorized: false, // 忽略证书验证错误
          timeout: TIMEOUT
        }, () => {
          // 连接建立后发送HTTP请求
          const httpRequest = 
            `GET ${TEST_PATH} HTTP/1.1\r\n` +
            `Host: ${TEST_HOST}\r\n` +
            `User-Agent: ProxyChecker/github\r\n` +
            `Connection: close\r\n\r\n`;
          socket.write(httpRequest);
        });

        let responseData = '';
        let timer = setTimeout(() => {
          socket.destroy();
          resolve(false);
        }, TIMEOUT);

        socket.on('data', (data) => {
          responseData += data.toString();
          // 如果已经收到完整的响应头，则提前结束
          if (responseData.includes('\r\n\r\n')) {
            clearTimeout(timer);
            socket.destroy();
            const isValid = responseData.includes('cloudflare') || 
                           responseData.includes('Cloudflare');
            resolve(isValid);
          }
        });

        socket.on('error', (error) => {
          clearTimeout(timer);
          resolve(false);
        });

        socket.on('end', () => {
          clearTimeout(timer);
          const isValid = responseData.includes('cloudflare') || 
                         responseData.includes('Cloudflare');
          resolve(isValid);
        });
      });
    } catch (error) {
      retryCount++;
      if (retryCount > MAX_RETRIES) {
        console.error(`❌❌ IP检测失败 ${ip}: ${error.message}`);
        return false;
      }
      // 等待片刻后重试
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return false;
}

// 处理IP列表
async function processIPList() {
  try {
    // 确保输出目录存在
    await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

    // 下载IP列表
    const data = await downloadIPList(INPUT_URL);
    
    // 解析IP列表
    const ips = data.split('\n')
      .map(ip => ip.trim())
      .filter(ip => {
        // 验证IP格式 (IPv4)
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ip && !ip.startsWith('#') && ipv4Regex.test(ip);
      });
    
    console.log(`📥📥 加载 ${ips.length} 个IP进行检测...`);

    // 并发检测
    const validIPs = [];
    const queue = [...ips];
    let processedCount = 0;
    
    // 创建进度条函数
    function updateProgress() {
      const progress = Math.round((processedCount / ips.length) * 100);
      process.stdout.write(`\r🚀🚀 进度: ${processedCount}/${ips.length} (${progress}%) | 有效IP: ${validIPs.length}`);
    }
    
    console.log('\n⏳⏳⏳ 开始检测IP...');
    updateProgress();
    
    while (queue.length > 0) {
      const batch = queue.splice(0, CONCURRENCY);
      // 修复这里的括号匹配问题
      const results = await Promise.all(
        batch.map(ip => checkProxyIP(ip).then(valid => {
          processedCount++;
          updateProgress();
          return valid ? ip : null;
        }))  // 添加了额外的闭合括号
      );
      
      validIPs.push(...results.filter(ip => ip !== null));
    }
    
    // 保存结果
    await fs.writeFile(OUTPUT_FILE, validIPs.join('\n'));
    console.log(`\n\n🎉🎉 检测完成！有效IP数量: ${validIPs.length}`);
    console.log(`💾💾 结果已保存至: ${OUTPUT_FILE}`);

    // 打印部分有效IP示例
    const sampleIPs = validIPs.slice(0, Math.min(5, validIPs.length));
    if (sampleIPs.length > 0) {
      console.log('\n🔍🔍 有效IP示例:');
      sampleIPs.forEach(ip => console.log(`  - ${ip}`));
    }

  } catch (error) {
    console.error('\n❌❌ 处理过程中出错:', error);
    process.exit(1);
  }
}

// 启动检测
processIPList();
