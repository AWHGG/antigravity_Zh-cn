// 枚举组完整性检查：常见"同类列表"（程度/频率/方向/状态等）在字典中的覆盖情况
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'dicts');
const all = {};
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
  Object.assign(all, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}
const norm = s => String(s).replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trim();
const has = k => {
  const n = norm(k).toLowerCase();
  return Object.keys(all).some(x => norm(x).toLowerCase() === n);
};

// 常见枚举组（每组内应"全有或全无"）
const groups = {
  '思考强度': ['Low', 'Medium', 'High'],
  '速度': ['Fast', 'Slow'],
  '布局': ['Narrow', 'Wide', 'Compact'],
  '频率': ['Daily', 'Weekly', 'Monthly'],
  '开关': ['On', 'Off'],
  '启用状态': ['Enabled', 'Disabled', 'Active', 'Inactive'],
  '连接状态': ['Connected', 'Disconnected', 'Connecting...', 'Failed to connect'],
  '方向': ['Previous', 'Next'],
  '面板方向': ['Left', 'Right', 'Center', 'Top', 'Bottom'],
  '权限': ['Allow', 'Deny', 'Ask'],
  '反馈': ['Good response', 'Bad response'],
  '时段': ['Today', 'Yesterday', 'Tomorrow', 'Now', 'Later'],
  '系统主题': ['System', 'Light', 'Dark'],
  '严重度': ['Critical', 'Warning', 'Error', 'Info'],
  '数量单位': ['None', 'All', 'Some'],
  '程度': ['Minimum', 'Maximum', 'Default', 'Custom'],
  '计划类型': ['One-time', 'Recurring', 'Scheduled'],
  '浏览策略': ['Ask every time', 'Always run', 'Never run', 'Ask first'],
  '审查策略': ['Always Proceeds', 'Asks for Review', 'Agent Decides', 'Request Review'],
  '模型级别': ['Pro', 'Ultra', 'Flash', 'Standard'],
  '对话动作': ['Pin', 'Unpin', 'Archive', 'Unarchive'],
  '窗口动作': ['Minimize', 'Maximize', 'Close', 'Restore'],
  '缩放': ['Zoom In', 'Zoom Out', 'Reset Zoom'],
  '编辑动作': ['Cut', 'Copy', 'Paste', 'Select All'],
  '确认': ['Yes', 'No', 'OK', 'Cancel', 'Confirm'],
  '读取权限': ['Read', 'Write', 'Read/Write', 'Read and Write'],
  'git状态': ['Modified', 'Added', 'Deleted', 'Renamed', 'Untracked', 'Staged', 'Committed'],
  '文件类型': ['File', 'Folder', 'Directory'],
  '消息状态': ['Sent', 'Delivered', 'Read', 'Failed', 'Pending'],
  '任务状态': ['Running', 'Completed', 'Failed', 'Cancelled', 'Queued', 'In Progress', 'Idle', 'Stopped'],
  '时间单位': ['Second', 'Minute', 'Hour', 'Day', 'Week', 'Month', 'Year'],
  '时间单位复数': ['Seconds', 'Minutes', 'Hours', 'Days', 'Weeks', 'Months', 'Years'],
  '语气': ['Normal', 'Polite', 'Formal', 'Casual'],
  '编码': ['UTF-8', 'ASCII', 'GBK', 'Base64', 'Hex'],
  '对齐': ['Left align', 'Center align', 'Right align'],
  '排序': ['Ascending', 'Descending'],
  '显示模式': ['List', 'Grid', 'Table'],
  '大小': ['Small', 'Medium', 'Large', 'Extra Large'],
  '浏览器动作': ['Open URL', 'Navigate', 'Refresh', 'Go Back', 'Go Forward'],
  '评分': ['Excellent', 'Good', 'Average', 'Poor'],
  '更新状态': ['Up to date', 'Update Available', 'Checking for Updates...', 'Downloading Update...', 'Restart to Update'],
};

let issues = 0;
for (const [gname, keys] of Object.entries(groups)) {
  const covered = keys.filter(has);
  const missing = keys.filter(k => !has(k));
  if (covered.length > 0 && missing.length > 0) {
    issues++;
    console.log(`[半翻译] ${gname}: 有 ${covered.length}/${keys.length}`);
    console.log(`   已有: ${covered.join(' | ')}`);
    console.log(`   缺失: ${missing.join(' | ')}`);
  } else if (missing.length === keys.length) {
    console.log(`[全缺] ${gname}（整组都没翻，可忽略或视需要补）`);
  } else {
    console.log(`[完整] ${gname} ✓`);
  }
}
console.log(`\n半翻译组数: ${issues}`);
// 门禁判定：半翻译（部分翻译部分遗留英文）计入失败；全缺组整组未翻译仅提示
process.exit(issues ? 1 : 0);
