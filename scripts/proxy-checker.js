const net = require('net');
const tls = require('tls');
const fs = require('fs').promises;
const path = require('path');

// 配置参数
const INPUT_FILE = path.join(__dirname, 'input', 'ips.txt');
const OUTPUT_FILE = path.join(__dirname, 'output', 'valid-ips.txt');
const TEST_HOST = 'speed.cloudflare.com';
const TEST_PATH = '/cdn-cgi/trace';
const TEST_PORT = 443;
const TIMEOUT = 5000; // 5秒超时
const CONCURRENCY = 10; // 并发检测数量

async function checkProxyIP(ip) {
  return new Promise((resolve) => {
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
        resolve(responseData.includes('cloudflare') || responseData.includes('Cloudflare'));
      }
    });

    socket.on('error', (error) => {
      clearTimeout(timer);
      resolve(false);
    });

    socket.on('end', () => {
      clearTimeout(timer);
      resolve(responseData.includes('cloudflare') || responseData.includes('Cloudflare'));
    });
  });
}

async function processIPList() {
  try {
    // 确保输出目录存在
    await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

    // 读取IP列表
    const data = await fs.readFile(INPUT_FILE, 'utf-8');
    const ips = data.split('\n')
      .map(ip => ip.trim())
      .filter(ip => ip && !ip.startsWith('#') && ip.split('.').length === 4);
    
    console.log(`📥 加载 ${ips.length} 个IP进行检测...`);

    // 并发检测
    const validIPs = [];
    const queue = [...ips];
    
    while (queue.length > 0) {
      const batch = queue.splice(0, CONCURRENCY);
      const results = await Promise.all(
        batch.map(ip => checkProxyIP(ip).then(valid => valid ? ip : null))
      );
      
      validIPs.push(...results.filter(ip => ip !== null));
      console.log(`✅ 已完成 ${ips.length - queue.length}/${ips.length}，有效IP: ${validIPs.length}`);
    }

    // 保存结果
    await fs.writeFile(OUTPUT_FILE, validIPs.join('\n'));
    console.log(`\n🎉 检测完成！有效IP数量: ${validIPs.length}`);
    console.log(`💾 结果已保存至: ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('❌ 处理过程中出错:', error);
    process.exit(1);
  }
}

// 启动检测
processIPList();
