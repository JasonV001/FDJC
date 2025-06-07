const net = require('net');
const fs = require('fs');
const { promisify } = require('util');
const readline = require('readline');

const OUTPUT_FILE = 'valid-proxies.txt';
const CONCURRENCY_LIMIT = 200; // 提高并发数
const TIMEOUT = 4000; // 4秒超时

async function checkProxy(ip, port = 443) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let timedOut = false;
    
    const timer = setTimeout(() => {
      timedOut = true;
      socket.destroy();
      resolve({ ip, port, valid: false, error: 'Timeout' });
    }, TIMEOUT);

    socket.on('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve({ ip, port, valid: true });
    });

    socket.on('error', (err) => {
      if (!timedOut) clearTimeout(timer);
      resolve({ ip, port, valid: false, error: err.code });
    });

    socket.connect(port, ip);
  });
}

async function processIps(ipList) {
  const validIps = [];
  const pending = [];
  
  for (const fullIp of ipList) {
    // 解析IP和端口
    let [host, port] = fullIp.split(':');
    port = port ? parseInt(port) : 443;
    
    // 清理IPv6地址
    if (host.startsWith('[') && host.endsWith(']')) {
      host = host.slice(1, -1);
    }
    
    if (pending.length >= CONCURRENCY_LIMIT) {
      const results = await Promise.all(pending.splice(0, CONCURRENCY_LIMIT));
      validIps.push(...results.filter(r => r.valid).map(r => r.ip));
    }
    
    pending.push(checkProxy(host, port));
  }
  
  // 处理剩余的检测
  if (pending.length > 0) {
    const results = await Promise.all(pending);
    validIps.push(...results.filter(r => r.valid).map(r => r.ip));
  }
  
  return validIps;
}

async function main() {
  try {
    const ipList = [];
    
    // 从文件读取IP列表
    const fileStream = fs.createReadStream('scripts/proxy-list.txt');
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    for await (const line of rl) {
      const ip = line.trim();
      if (ip) ipList.push(ip);
    }
    
    console.log(`⏳ 开始检测 ${ipList.length} 个代理IP...`);
    const validIps = await processIps(ipList);
    console.log(`✅ 检测完成! 有效IP数量: ${validIps.length}`);
    
    // 保存有效IP
    fs.writeFileSync(OUTPUT_FILE, validIps.join('\n'));
    console.log(`📝 结果已保存到 ${OUTPUT_FILE}`);
    
  } catch (error) {
    console.error('❌ 发生错误:', error);
    process.exit(1);
  }
}

main();
