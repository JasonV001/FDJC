# Cloudflare 代理IP检测工具

此工具用于批量检测Cloudflare反代IP的有效性，基于Cloudflare Workers运行时环境实现。

## 功能特性
- 批量检测IP的反代有效性
- 多并发检测提高效率
- 自动过滤无效IP
- 每日自动运行并生成报告

## 使用说明
1. 将需要检测的IP放入 `scripts/input/ips.txt` 文件
2. 工作流会自动运行（每日00:00 UTC）
3. 检测结果可在Actions页面下载 `valid-proxy-ips` 产物
4. 有效IP将保存在 `scripts/output/valid-ips.txt`

## 手动运行
1. 在GitHub仓库转到 **Actions** 标签页
2. 选择 **Proxy IP Checker** 工作流
3. 点击 **Run workflow** 手动触发检测

## 结果格式
输出文件为纯文本格式，每行一个有效IP：
