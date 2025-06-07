const fs = require('fs');
const path = require('path');

// 输入输出文件路径
const RAW_IPS_FILE = path.join(__dirname, 'raw-ips.txt');
const PROXY_LIST_FILE = path.join(__dirname, 'proxy-list.txt');

function processRawIps() {
  try {
    // 读取原始IP数据
    const rawData = fs.readFileSync(RAW_IPS_FILE, 'utf-8').trim();
    
    // 预处理IP格式
    const processedData = rawData
      .replace(/\.{2,}/g, '.')  // 替换连续多个点为单个点
      .replace(/[^0-9\.$$$$:]/g, '') // 移除非IP字符
      .replace(/(\d)\.(\d)/g, '$1.$2'); // 确保数字间有分隔符
    
    // 分割IP地址
    const ipList = processedData.split(/[\s,;]+/);
    
    // 过滤有效IP
    const validIps = ipList.filter(ip => {
      // IPv4格式验证
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
      
      // 完全重写的IPv6正则表达式
      // 匹配格式: [2001:db8::1] 或 2001:db8::1 或 [2001:db8::1]:443
      const ipv6Regex = /^($$([0-9a-fA-F:]+)$$(:\d+)?|([0-9a-fA-F:]+)(:\d+)?)$/;
      
      return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    });
    
    // 去重并排序
    const uniqueIps = [...new Set(validIps)];
    
    // 保存处理后的IP列表
    fs.writeFileSync(PROXY_LIST_FILE, uniqueIps.join('\n'));
    
    console.log(`✅ 处理完成! 有效IP数量: ${uniqueIps.length}`);
    return uniqueIps.length;
  } catch (error) {
    console.error('❌ 预处理失败:', error);
    process.exit(1);
  }
}

processRawIps();
