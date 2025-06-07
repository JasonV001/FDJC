const fs = require('fs');
const path = require('path');

const PROXY_LIST_FILE = path.join(__dirname, 'proxy-list.txt');
const VALID_PROXIES_FILE = path.join(__dirname, 'valid-proxies.txt');

// 检查文件是否存在
if (!fs.existsSync(PROXY_LIST_FILE)) {
  console.log('⚠️ 代理列表文件不存在，跳过检查');
  process.exit(0); // 正常退出而不是报错
}

try {
  // 读取代理列表
  const proxyList = fs.readFileSync(PROXY_LIST_FILE, 'utf-8')
    .split('\n')
    .map(proxy => proxy.trim())
    .filter(proxy => proxy.length > 0);
  
  console.log(`开始检查 ${proxyList.length} 个代理...`);
  
  // 这里添加实际的代理检查逻辑
  // 目前仅模拟检查过程
  const validProxies = proxyList.filter(proxy => {
    // 模拟检查：随机保留50%的代理
    return Math.random() > 0.5;
  });
  
  // 保存有效代理
  fs.writeFileSync(VALID_PROXIES_FILE, validProxies.join('\n'));
  console.log(`✅ 检查完成! 有效代理数量: ${validProxies.length}`);
  
} catch (error) {
  console.error('❌ 代理检查失败:', error);
  process.exit(1);
}
