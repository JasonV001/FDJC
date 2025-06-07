
const { connect } = require('cloudflare:sockets');
const fs = require('fs').promises;
const path = require('path');

// 配置参数
const INPUT_FILE = path.join(__dirname, 'input/ips.txt');
const OUTPUT_FILE = path.join(__dirname, 'output/valid-ips.txt');
const TEST_HOST = 'speed.cloudflare.com';
const TEST_PATH = '/cdn-cgi/trace';
const TEST_PORT = 443;
const TIMEOUT = 5000; // 5秒超时
const CONCURRENCY = 10; // 并发检测数量

async function checkProxyIP(ip) {
  const tcpSocket = connect({
    hostname: ip,
    port: TEST_PORT,
  });

  try {
    // 构建HTTP请求
    const httpRequest = 
      `GET ${TEST_PATH} HTTP/1.1\r\n` +
      `Host: ${TEST_HOST}\r\n` +
      `User-Agent: ProxyChecker/github\r\n` +
      `Connection: close\r\n\r\n`;

    // 发送请求
    const writer = tcpSocket.writable.getWriter();
    await writer.write(new TextEncoder().encode(httpRequest));
    writer.releaseLock();

    // 读取响应
    const reader = tcpSocket.readable.getReader();
    let responseData = new Uint8Array(0);
    let receivedData = false;

    const timer = setTimeout(async () => {
      await reader.cancel();
      await tcpSocket.close();
    }, TIMEOUT);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      receivedData = true;
      const newData = new Uint8Array(responseData.length + value.length);
      newData.set(responseData);
      newData.set(value, responseData.length);
      responseData = newData;

      // 检查是否收到完整响应
      const responseText = new TextDecoder().decode(newData);
      if (responseText.includes("\r\n\r\n")) {
        break;
      }
    }

    clearTimeout(timer);
    reader.releaseLock();
    await tcpSocket.close();

    // 验证响应
    const responseText = new TextDecoder().decode(responseData);
    return responseText.includes('cloudflare') || 
           responseText.includes('Cloudflare');

  } catch (error) {
    return false;
  }
}

async function processIPList() {
  try {
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
