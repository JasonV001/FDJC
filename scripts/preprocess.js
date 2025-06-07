const fs = require('fs');
const path = require('path');

// 输入输出文件路径
const RAW_IPS_FILE = path.join(__dirname, 'raw-ips.txt');
const PROXY_LIST_FILE = path.join(__dirname, 'proxy-list.txt');

function processRawIps() {
  try {
    // 1. 确保原始文件存在
    if (!fs.existsSync(RAW_IPS_FILE)) {
      throw new Error(`原始IP文件不存在: ${RAW_IPS_FILE}`);
    }
    
    // 2. 读取原始IP数据
    const rawData = fs.readFileSync(RAW_IPS_FILE, 'utf-8').trim();
    console.log(`原始数据长度: ${rawData.length} 字符`);
    
    // 3. 提取所有IP地址（简化提取逻辑）
    const ipList = [];
    
    // IPv4地址提取（带端口）
    const ipv4Matches = rawData.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g) || [];
    ipList.push(...ipv4Matches);
    
    // IPv6地址提取（带端口）
    const ipv6Matches = rawData.match(/$$?[0-9a-fA-F:]+$$?(:\d+)?/g) || [];
    ipList.push(...ipv6Matches);
    
    console.log(`提取到 ${ipList.length} 个IP地址`);
    
    // 4. 去重
    const uniqueIps = [...new Set(ipList)];
    console.log(`去重后剩余 ${uniqueIps.length} 个唯一IP`);
    
    // 5. 保存处理后的IP列表
    if (uniqueIps.length > 0) {
      fs.writeFileSync(PROXY_LIST_FILE, uniqueIps.join('\n'));
      console.log(`✅ 处理完成! 有效IP数量: ${uniqueIps.length}`);
    } else {
      console.log('⚠️ 未找到有效IP地址，跳过文件写入');
    }
    
    return uniqueIps.length;
  } catch (error) {
    console.error('❌ 预处理失败:', error);
    process.exit(1);
  }
}

processRawIps();
